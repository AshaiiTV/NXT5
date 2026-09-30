import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function loadMigrations() {
  const definitions = [
    ['baseline-20260906-v1', '../database/migrations/20260906_baseline.sql'],
    ['audit-runtime-20260906-v1', '../database/migrations/20260906_runtime_schema.sql'],
    ['pricing-access-requests-20260908-v1', '../database/migrations/20260908_access_requests.sql'],
    ['pricing-access-requests-structure-20260908-v1', '../database/migrations/20260908_access_requests_structure.sql'],
    ['account-subscriptions-20260908-v1', '../database/migrations/20260908_account_subscriptions.sql'],
    ['account-subscriptions-discovery-default-20260908-v1', '../database/migrations/20260908_account_subscriptions_discovery_default.sql'],
    ['account-subscriptions-catalog-20260909-v1', '../database/migrations/20260909_account_subscriptions_catalog.sql'],
    ['administration-purchases-20260914-v1', '../database/migrations/20260914_purchases.sql'],
    ['audience-20260914-v1', '../database/migrations/20260914_audience.sql'],
    ['player-matchups-20260915-v1', '../database/migrations/20260915_player_matchups.sql'],
    ['discord-publications-20260915-v1', '../database/migrations/20260915_discord_publications.sql'],
    ['discord-connection-tests-20260921-v1', '../database/migrations/20260921_discord_connection_tests.sql'],
    ['discord-shared-servers-20260921-v1', '../database/migrations/20260921_discord_shared_servers.sql'],
    ['discord-bot-identity-20260922-v1', '../database/migrations/20260922_discord_bot_identity.sql'],
    ['discord-bot-workflows-20260922-v1', '../database/migrations/20260922_discord_bot_workflows.sql'],
    ['discord-bot-role-access-20260923-v1', '../database/migrations/20260923_discord_bot_role_access.sql'],
    ['discord-command-channel-20260924-v1', '../database/migrations/20260924_discord_command_channel.sql'],
    ['social-auth-20260923-v1', '../database/migrations/20260923_social_auth.sql'],
    ['discord-community-announcements-20260924-v1', '../database/migrations/20260924_discord_community_announcements.sql'],
    ['discord-community-destinations-20260925-v1', '../database/migrations/20260925_discord_community_destinations.sql'],
    ['audience-activation-20260928-v1', '../database/migrations/20260928_audience_activation.sql'],
    ['team-activation-milestones-20260928-v1', '../database/migrations/20260928_team_activation_milestones.sql'],
    ['discord-group-exports-20260924-v1', '../database/migrations/20260924_discord_group_exports.sql'],
    ['server-timezones-20260929-v1', '../database/migrations/20260929_server_timezones.sql'],
    ['server-reminders-20260929-v1', '../database/migrations/20260929_server_reminders.sql'],
    ['social-email-signup-20260929-v1', '../database/migrations/20260929_social_email_signup.sql'],
    ['report-source-20260929-v1', '../database/migrations/20260929_report_source.sql'],
    ['report-source-v3-20260929-v1', '../database/migrations/20260929_report_source_v3.sql'],
    ['canonical-champions-20260929-v1', '../database/migrations/20260929_canonical_champions.mjs'],
    ['timeline-cs-rule-20260929-v2', '../database/migrations/20260929_timeline_cs_rule.mjs'],
  ];
  return Promise.all(definitions.map(async ([key, file]) => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const script = file.endsWith('.mjs') ? await import(new URL(file, import.meta.url).href) : null;
    return { key, sql: script ? script.sql : source, run: script?.run, checksum: createHash('sha256').update(source).digest('hex') };
  }));
}

// The dedicated connection keeps the lock and all DDL in one transaction.
// A failure also rolls back the migration ledger.
export async function applyMigrations(client, migrations) {
  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '30s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query('select pg_advisory_xact_lock($1)', [1853387829]);
    await client.query(`create table if not exists app_schema_migrations (
      migration_key text primary key,
      applied_at timestamptz not null default now(),
      checksum text
    )`);
    await client.query('alter table app_schema_migrations add column if not exists checksum text');
    const applied = [];
    for (const migration of migrations) {
      const result = await client.query('select checksum from app_schema_migrations where migration_key = $1', [migration.key]);
      if (result.rows.length) {
        if (result.rows[0].checksum !== migration.checksum) throw new Error(`Migration already applied with a different checksum: ${migration.key}`);
        continue;
      }
      if (migration.sql) await client.query(migration.sql);
      if (migration.run) await migration.run(client);
      await client.query('insert into app_schema_migrations (migration_key, checksum) values ($1, $2)', [migration.key, migration.checksum]);
      applied.push(migration.key);
    }
    await client.query('commit');
    return applied;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
