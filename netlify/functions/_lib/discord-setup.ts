import { DISCORD_INSTALL_PERMISSIONS, DISCORD_INSTALL_SCOPES, nxtDiscordCommand } from '../../../shared/discord-command.js';
import { discordRequest } from './discord-client';
import { getDiscordConfig, isDiscordId } from './discord-config';

export class DiscordSetupError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const object = (value: any) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, length = 100) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, length) : '';
const indices = (value: unknown) => Array.isArray(value) ? value.filter((item) => Number.isInteger(item) && item >= 0 && item <= 3).slice(0, 4) : [];

function validateApplication(application: any, applicationId: string, publicKey: string) {
  if (!object(application) || application.id !== applicationId) {
    throw new DiscordSetupError(409, 'DISCORD_APPLICATION_MISMATCH', 'Le jeton ne correspond pas à l’application NXT5 attendue.');
  }
  if (typeof application.verify_key !== 'string' || application.verify_key.toLowerCase() !== publicKey.toLowerCase()) {
    throw new DiscordSetupError(409, 'DISCORD_PUBLIC_KEY_MISMATCH', 'La clé publique configurée ne correspond pas à cette application.');
  }
  for (const key of ['install_params', 'integration_types_config']) {
    if (application[key] != null && !object(application[key])) {
      throw new DiscordSetupError(502, 'DISCORD_SETUP_INVALID_RESPONSE', 'La configuration renvoyée par Discord est invalide.');
    }
  }
  if (Object.values(application.integration_types_config || {}).some((entry: any) => !object(entry)
    || (entry.oauth2_install_params != null && !object(entry.oauth2_install_params)))) {
    throw new DiscordSetupError(502, 'DISCORD_SETUP_INVALID_RESPONSE', 'Les contextes d’installation renvoyés par Discord sont invalides.');
  }
}

function installParams(value: any) {
  return { scopes: Array.isArray(value?.scopes) ? value.scopes.filter((scope: unknown) => typeof scope === 'string' && /^[a-z._]{1,80}$/.test(scope)).slice(0, 32) : [],
    permissions: typeof value?.permissions === 'string' && /^\d{1,30}$/.test(value.permissions) ? value.permissions : null };
}
function installationMatches(value: any) {
  const params = installParams(value);
  return params.permissions === DISCORD_INSTALL_PERMISSIONS && params.scopes.length === DISCORD_INSTALL_SCOPES.length
    && DISCORD_INSTALL_SCOPES.every((scope) => params.scopes.includes(scope));
}
// Compare only fields we manage; Discord adds IDs, versions and default values.
function containsDefinition(actual: any, expected: any): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => containsDefinition(actual[index], item));
  if (object(expected)) return object(actual) && Object.entries(expected).every(([key, value]) => {
    // Discord may omit `required: false`: command options are optional by
    // default. Keep explicit true and every other managed field strict.
    if (key === 'required' && value === false && actual[key] === undefined) return true;
    return containsDefinition(actual[key], value);
  });
  return actual === expected;
}
function publicEndpoint(value: unknown) {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return (url.origin + url.pathname).slice(0, 500);
  } catch { return null; }
}
function inspection(application: any, commands: any[], endpoint: string) {
  const guildInstall = application.integration_types_config?.['0'];
  const nxt = commands.find((command) => command?.name === 'nxt' && command?.type === 1);
  const checks = {
    publicBot: application.bot_public === true,
    codeGrantDisabled: application.bot_require_code_grant === false,
    interactionsEndpoint: application.interactions_endpoint_url === endpoint,
    defaultInstall: installationMatches(application.install_params),
    guildInstall: installationMatches(guildInstall?.oauth2_install_params),
    globalCommand: containsDefinition(nxt, nxtDiscordCommand()),
  };
  return {
    application: { id: application.id, name: text(application.name), botPublic: typeof application.bot_public === 'boolean' ? application.bot_public : null,
      botRequireCodeGrant: typeof application.bot_require_code_grant === 'boolean' ? application.bot_require_code_grant : null,
      interactionsEndpointUrl: publicEndpoint(application.interactions_endpoint_url), expectedInteractionsEndpointUrl: endpoint,
      installParams: installParams(application.install_params), guildInstall: { enabled: object(guildInstall), ...installParams(guildInstall?.oauth2_install_params) } },
    commands: commands.slice(0, 150).map((command) => ({ id: isDiscordId(command?.id) ? command.id : null, name: text(command?.name, 32), type: Number.isInteger(command?.type) ? command.type : null,
      contexts: indices(command?.contexts), integrationTypes: indices(command?.integration_types) })),
    checks, ready: Object.values(checks).every(Boolean),
  };
}

export async function setupDiscordApplication(action: 'inspect' | 'configure', expectedApplicationId: string) {
  const config = getDiscordConfig();
  if (!isDiscordId(expectedApplicationId) || expectedApplicationId !== config.applicationId) {
    throw new DiscordSetupError(409, 'DISCORD_EXPECTED_APPLICATION_MISMATCH', 'L’identifiant attendu doit correspondre à la configuration serveur.');
  }
  if (!config.configured) throw new DiscordSetupError(503, 'DISCORD_NOT_CONFIGURED', 'Termine la configuration serveur du bot avant cette opération.');
  const endpoint = config.siteUrl + '/.netlify/functions/discord-interactions';
  let application = await discordRequest('/applications/@me');
  validateApplication(application, config.applicationId, config.publicKey);
  const commandPath = '/applications/' + config.applicationId + '/commands';
  if (action === 'configure') {
    const params = { scopes: [...DISCORD_INSTALL_SCOPES], permissions: DISCORD_INSTALL_PERMISSIONS };
    const contexts = application.integration_types_config || {};
    const guild = contexts['0'] || {};
    // Only these application properties are changed; other installation contexts
    // and all unrelated application properties remain as they were.
    const updated = await discordRequest('/applications/@me', { method: 'PATCH', body: {
      interactions_endpoint_url: endpoint,
      install_params: { ...application.install_params, ...params },
      integration_types_config: { ...contexts, '0': { ...guild, oauth2_install_params: { ...guild.oauth2_install_params, ...params } } },
    } });
    validateApplication(updated, config.applicationId, config.publicKey);
    // POST is an upsert of this one command. Never bulk-replace the app's commands.
    await discordRequest(commandPath, { method: 'POST', body: nxtDiscordCommand() });
  }
  const [verifiedApplication, commands] = await Promise.all([
    action === 'configure' ? discordRequest('/applications/@me') : Promise.resolve(application),
    discordRequest(commandPath),
  ]);
  application = verifiedApplication;
  validateApplication(application, config.applicationId, config.publicKey);
  if (!Array.isArray(commands)) throw new DiscordSetupError(502, 'DISCORD_SETUP_INVALID_RESPONSE', 'La liste de commandes renvoyée par Discord est invalide.');
  const result = inspection(application, commands, endpoint);
  if (action === 'configure' && !['interactionsEndpoint', 'defaultInstall', 'guildInstall', 'globalCommand'].every((key) => result.checks[key])) {
    throw new DiscordSetupError(502, 'DISCORD_SETUP_VERIFICATION_FAILED', 'La configuration Discord n’est pas entièrement confirmée. Relance une inspection.');
  }
  return { action, ...result };
}
