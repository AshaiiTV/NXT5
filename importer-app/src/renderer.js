const $ = (selector) => document.querySelector(selector);
const api = window.nxt5;
const form = $("#form");
const gameInput = $("#gameId");
const regionInput = $("#platform");
const submit = $("#submit");
const regions = new Set(
  Array.from(regionInput.options, (option) => option.value),
);
const regionAliases = {
  EUW: "EUW1",
  EUNE: "EUN1",
  EUN: "EUN1",
  NA: "NA1",
  JP: "JP1",
  BR: "BR1",
  LAN: "LA1",
  LAS: "LA2",
  OCE: "OC1",
  OC: "OC1",
  TR: "TR1",
  ME: "ME1",
  PH: "PH2",
  SG: "SG2",
  TH: "TH2",
  TW: "TW2",
  VN: "VN2",
};
const canonicalRegion = (value) => regionAliases[value] || value;
let appState = { settings: {}, history: [], siteUrl: "" };
let activeView = "export";
let generating = false;
let checkingUpdate = false;
let checkingClient = false;
let resultHistoryId = "";
let updateDownloadUrl = "";
let latestUpdateVersion = "";
let installingUpdate = false;
let unsubscribeUpdate;
let unsubscribeProgress;
let unsubscribeCollector;
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function cleanError(error) {
  return String(
    error?.message || error || "Une erreur est survenue. Réessaie.",
  )
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
    .replace(/^Error:\s*/, "");
}
function notice(selector, type, message) {
  const box = $(selector);
  box.hidden = !message;
  box.className = `notice ${type}`;
  box.textContent = message || "";
}
function showView(view, focus = false) {
  const views = ["export", "collect", "history", "settings"];
  if (!views.includes(view)) return;
  activeView = view;
  window.scrollTo({ top: 0, behavior: "instant" });
  for (const name of views) {
    $(`#${name}View`).hidden = name !== view;
    const button = $(`#${name}Tab`);
    button.classList.toggle("active", name === view);
    if (name === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (view === "history") renderHistory();
  if (view === "collect") void refreshCollector();
  if (view === "export" && !$("#resultPanel").hidden && $("#globalNotice").classList.contains("success"))
    notice("#globalNotice", "", "");
  if (focus) $(`#${view}Heading`).focus({ preventScroll: true });
}
let collectorState = null;
let collectorBusy = false;
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
function collectorStatusLabel(game) {
  if (game.status === "sent")
    return { sent: "Envoyée", imported: "Importée dans NXT5", pending: "À finaliser dans NXT5", skipped: "Ignorée par NXT5" }[game.result?.status || "sent"] || "Envoyée";
  return { queued: game.attempts ? "Nouvel essai prévu" : "En file d’envoi", failed: "Échec", unauthorized: "Liaison révoquée" }[game.status] || game.status;
}
function renderCollector(snapshot) {
  if (!snapshot) return;
  collectorState = snapshot;
  const linked = snapshot.linked;
  $("#collectLinkForm").hidden = linked;
  $("#collectLinked").hidden = !linked;
  $("#collectRunCard").hidden = !linked;
  $("#collectGamesCard").hidden = !snapshot.games.length;
  const invalid = snapshot.link?.invalidReason || "";
  $("#exportTeam").hidden = false;
  $("#exportTeamState").textContent = linked
    ? [snapshot.link.teamName, invalid || (snapshot.active ? "Collecte active" : "Collecte arrêtée")].filter(Boolean).join(" · ")
    : "Lier cet ordinateur pour envoyer automatiquement tes customs.";
  $("#collectInvalid").hidden = !invalid;
  $("#collectInvalid").textContent = invalid;
  $("#collectRunHint").hidden = snapshot.active || Boolean(invalid);
  if (!linked) {
    $("#collectLinked").open = false;
    $("#collectManualForm").closest("details").open = false;
  }
  if (linked) {
    $("#collectTeam").textContent = `${snapshot.link.teamName}${snapshot.link.teamTag ? ` (${snapshot.link.teamTag})` : ""}`;
    $("#collectDevice").textContent = snapshot.link.label || appState.deviceName || "—";
    const players = snapshot.link.roster?.length || 0;
    $("#collectRoster").textContent = `${players} joueur${players > 1 ? "s" : ""} avec Riot ID`;
    const expires = new Date(snapshot.link.expiresAt);
    $("#collectExpires").textContent = Number.isFinite(expires.getTime()) ? longDate.format(expires) : "—";
  }
  const toggle = $("#collectToggle");
  toggle.replaceChildren(document.createTextNode(snapshot.active ? "Arrêter la collecte" : "Activer la collecte"), icon(snapshot.active ? "stop" : "arrow"));
  toggle.classList.toggle("primary", !snapshot.active);
  toggle.disabled = collectorBusy || Boolean(snapshot.link?.invalidReason);
  const phases = { idle: "Collecte arrêtée.", starting: "Démarrage…", "no-client": snapshot.clientMessage, watching: snapshot.clientMessage || "En attente d’une custom.", "in-game": `Partie en cours (${snapshot.currentGame}). Elle sera envoyée à la fin.`, capturing: `${snapshot.clientMessage} ${snapshot.currentGame}`.trim() };
  const phase = phases[snapshot.phase] || snapshot.clientMessage || "Collecte arrêtée.";
  const phaseLabel = $("#collectPhase");
  phaseLabel.dataset.phase = snapshot.phase;
  if (phaseLabel.textContent !== phase) phaseLabel.textContent = phase;
  const count = $("#collectCount");
  count.hidden = !snapshot.pending;
  count.textContent = String(snapshot.pending);
  const list = $("#collectGames");
  list.replaceChildren();
  for (const game of snapshot.games.slice(0, 20)) {
    const row = document.createElement("article");
    row.className = "history-row";
    row.dataset.status = game.status === "sent" ? game.result?.status || "sent" : game.status;
    const details = document.createElement("div");
    details.className = "history-detail";
    const name = document.createElement("strong");
    name.textContent = game.gameId;
    const meta = document.createElement("p");
    meta.textContent = [collectorStatusLabel(game), game.capturedAt ? date(game.capturedAt) : "", game.result?.reason || game.lastError || ""].filter(Boolean).join(" · ");
    details.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "history-actions";
    if (game.status === "failed" || (game.status === "queued" && game.attempts > 0)) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-button";
      retry.textContent = "Réessayer";
      retry.setAttribute("aria-label", `Réessayer l’envoi de ${game.gameId}`);
      retry.addEventListener("click", () => collectorAction(() => api.collector.retry(game.gameId), "#collectRunStatus"));
      actions.append(retry);
    }
    row.append(details, actions);
    list.append(row);
  }
}
async function refreshCollector() {
  if (!api?.collector) return;
  try { renderCollector(await api.collector.state()); } catch (error) { notice("#collectLinkStatus", "error", cleanError(error)); }
}
async function collectorAction(run, target, success = "") {
  if (!api?.collector || collectorBusy) return false;
  collectorBusy = true;
  $("#collectToggle").disabled = true;
  $("#collectConnect").disabled = true;
  $("#collectManualSend").disabled = true;
  try {
    const snapshot = await run();
    if (snapshot) renderCollector(snapshot);
    if (success && !snapshot?.link?.invalidReason) notice(target, "success", success);
    else notice(target, "success", "");
    return true;
  } catch (error) {
    notice(target, "error", cleanError(error));
    return false;
  } finally {
    collectorBusy = false;
    $("#collectConnect").disabled = false;
    $("#collectManualSend").disabled = false;
    if (collectorState) renderCollector(collectorState);
  }
}
function icon(name) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  element.setAttribute("aria-hidden", "true");
  element.append(use);
  return element;
}
function duration(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return seconds
    ? `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`
    : "Durée indisponible";
}
function date(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? dateFormat.format(parsed)
    : "Date indisponible";
}
function sourceLabel(value) {
  return /lcu|local/i.test(String(value)) ? "Client LoL" : "Riot via NXT5";
}
function updatePath() {
  $("#leaguePath").textContent =
    appState.settings?.leaguePath || "Détection automatique";
  $("#resetLeaguePath").hidden = !appState.settings?.leaguePath;
}
async function refreshAppState({ initial = false } = {}) {
  appState = await api.getAppState();
  if (initial && appState.warning)
    notice("#globalNotice", "warning", appState.warning);
  appState.history = Array.isArray(appState.history) ? appState.history : [];
  $("#currentVersion").textContent = `v${appState.version}`;
  const mac = appState.platform === "darwin" || appState.platform === "mac";
  $("#systemInfo").textContent =
    `${mac ? "macOS" : appState.platform === "win32" || appState.platform === "windows" ? "Windows" : appState.platform} · ${appState.arch === "arm64" ? (mac ? "Apple Silicon" : "ARM64") : "Intel / x64"}`;
  if (initial && regions.has(appState.settings?.platform))
    regionInput.value = appState.settings.platform;
  updatePath();
  renderHistory();
  $("#historyCount").textContent = String(appState.history.length);
  $("#historyCount").hidden = !appState.history.length;
  $("#historyToolbar").hidden = !appState.history.length;
}
function renderHistory() {
  const query = $("#historySearch").value.trim().toUpperCase();
  const items = appState.history.filter((item) =>
    String(item.gameId).toUpperCase().includes(query),
  );
  const total = appState.history.length;
  $("#historyTotal").textContent = query
    ? `${items.length} résultat${items.length > 1 ? "s" : ""} sur ${total}`
    : `${total} export${total > 1 ? "s" : ""}`;
  const list = $("#historyList");
  list.replaceChildren();
  $("#historyEmpty").hidden = items.length > 0;
  $("#historyEmpty h2").textContent = query
    ? "Aucun export ne correspond"
    : "Aucun export sur cet appareil";
  $("#firstExport").hidden = Boolean(query);
  for (const item of items) {
    const row = document.createElement("article");
    row.className = "history-row";
    const fileIcon = document.createElement("span");
    fileIcon.className = "history-file-icon";
    fileIcon.append(icon("file"));
    const details = document.createElement("div");
    details.className = "history-detail";
    const name = document.createElement("strong");
    name.textContent = item.gameId;
    const meta = document.createElement("p");
    meta.textContent = `${date(item.exportedAt)} · ${duration(item.duration)} · ${item.timelineAvailable ? "Avec timeline" : "Sans timeline"}`;
    details.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-button";
    retry.textContent = "Réexporter";
    retry.disabled = generating;
    retry.setAttribute("aria-label", `Réexporter ${item.gameId}`);
    retry.addEventListener("click", () => {
      if (generating) return;
      showView("export");
      startNewExport(item.gameId);
    });
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "button compact";
    reveal.append(icon("folder"), document.createTextNode("Voir le fichier"));
    reveal.setAttribute("aria-label", `Afficher le fichier ${item.gameId}`);
    reveal.addEventListener("click", () => revealExport(item.id, reveal));
    actions.append(retry, reveal);
    row.append(fileIcon, details, actions);
    list.append(row);
  }
}
async function revealExport(id, button) {
  button.disabled = true;
  try {
    if (!id || !(await api.showExport(id)))
      throw new Error(
        "Ce fichier a été déplacé ou supprimé. Tu peux réexporter la game.",
      );
    notice("#globalNotice", "", "");
  } catch (error) {
    notice("#globalNotice", "error", cleanError(error));
  } finally {
    button.disabled = false;
  }
}
function renderClientStatus(state, message = "") {
  const labels = {
    checking: ["Recherche du client…", "Recherche…"],
    connected: ["Client LoL connecté", "Connecté"],
    disconnected: ["Client LoL non détecté", "Non détecté"],
  };
  const [sidebarLabel, routeLabel] = labels[state];
  $("#clientIndicator").dataset.state = state;
  $("#clientIndicator").title = message;
  $("#clientLabel").textContent = sidebarLabel;
  const routeStatus = $("#routeClientStatus");
  routeStatus.dataset.state = state;
  routeStatus.textContent = routeLabel;
}
async function checkClient() {
  if (!api?.getClientStatus || checkingClient) return;
  checkingClient = true;
  $("#refreshClient").disabled = true;
  renderClientStatus("checking");
  try {
    const result = await api.getClientStatus();
    renderClientStatus(result.connected ? "connected" : "disconnected", result.message);
  } catch (error) {
    renderClientStatus("disconnected", cleanError(error));
  } finally {
    checkingClient = false;
    $("#refreshClient").disabled = false;
  }
}
async function checkForUpdate({ manual = false } = {}) {
  if (!api?.checkUpdate || checkingUpdate) return;
  checkingUpdate = true;
  $("#manualUpdateButton").disabled = true;
  $("#manualUpdateButton").textContent = "Vérification…";
  $("#updateStatus").textContent = "";
  try {
    const info = await api.checkUpdate();
    if (info.checked === false)
      throw new Error(
        info.message ||
          "La recherche de mise à jour est temporairement indisponible.",
      );
    updateDownloadUrl = info.updateAvailable ? info.downloadUrl : "";
    latestUpdateVersion = info.updateAvailable ? info.latestVersion : "";
    renderUpdate(info.update);
    if (manual)
      $("#updateStatus").textContent =
        "Vérification terminée à " +
        new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()) +
        ".";
  } catch (error) {
    $("#latestVersion").textContent = "Vérification indisponible";
    $("#updateStatus").textContent =
      `${cleanError(error)} Tu peux continuer à utiliser l’application.`;
  } finally {
    checkingUpdate = false;
    $("#manualUpdateButton").disabled = false;
    $("#manualUpdateButton").textContent = "Vérifier les mises à jour";
  }
}
// The update downloads on its own; the banner only asks for a restart once it is ready.
function renderUpdate(state = {}) {
  const version = state.version || latestUpdateVersion;
  if (!version) {
    $("#update").hidden = true;
    $("#latestVersion").textContent = "Ton application est à jour";
    return;
  }
  const status = state.status || "idle";
  const manual = status === "manual" || status === "error";
  $("#update").hidden = false;
  $("#updateInstall").hidden = status !== "ready";
  $("#updateInstall").disabled = installingUpdate;
  $("#updateLink").hidden = !manual || !updateDownloadUrl;
  const percent = Math.round((Number(state.progress) || 0) * 100);
  $("#updateText").textContent =
    status === "ready"
      ? `Mise à jour v${version} prête`
      : status === "downloading" || status === "idle"
        ? `Téléchargement de la v${version}… ${percent ? `${percent} %` : ""}`.trim()
        : status === "error"
          ? `Mise à jour v${version} : téléchargement automatique impossible`
          : `Mise à jour disponible · v${version}`;
  $("#latestVersion").textContent =
    status === "ready"
      ? `Version ${version} prête : elle s’installe au prochain redémarrage.`
      : `Version ${version} disponible`;
  if (state.message) $("#updateStatus").textContent = state.message;
}
async function installUpdate() {
  if (installingUpdate || !api?.installUpdate) return;
  installingUpdate = true;
  $("#updateInstall").disabled = true;
  $("#updateInstall").textContent = "Redémarrage…";
  try {
    await api.installUpdate();
  } catch (error) {
    installingUpdate = false;
    $("#updateInstall").disabled = false;
    $("#updateInstall").textContent = "Redémarrer pour mettre à jour";
    $("#updateStatus").textContent = cleanError(error);
  }
}
async function openExternal(url) {
  try {
    if (!url || !(await api.openExternal(url)))
      throw new Error("Ce lien ne peut pas être ouvert.");
  } catch (error) {
    notice("#globalNotice", "error", cleanError(error));
  }
}
function clearInputError() {
  gameInput.removeAttribute("aria-invalid");
  $("#gameIdError").hidden = true;
  $("#gameIdError").textContent = "";
}
function startNewExport(gameId = "") {
  if (generating) return;
  $("#resultPanel").hidden = true;
  $("#newExport").hidden = true;
  form.hidden = false;
  gameInput.value = gameId;
  if (regions.has(appState.settings?.platform)) regionInput.value = appState.settings.platform;
  syncInputRegion();
  clearInputError();
  notice("#status", "", "");
  gameInput.focus();
}
function syncInputRegion() {
  const full = gameInput.value
    .trim()
    .toUpperCase()
    .match(/\b([A-Z0-9]{2,5})[_-](\d{6,20})\b/);
  if (full && regions.has(canonicalRegion(full[1])))
    regionInput.value = canonicalRegion(full[1]);
}
function validateInput() {
  const input = gameInput.value.trim().toUpperCase();
  const full = input.match(/\b([A-Z0-9]{2,5})[_-](\d{6,20})\b/);
  const numeric = input.match(/^\d{6,20}$/);
  if (
    !input ||
    (!full && !numeric) ||
    (full && !regions.has(canonicalRegion(full[1]))) ||
    /^0+$/.test(full?.[2] || numeric?.[0] || "")
  ) {
    gameInput.setAttribute("aria-invalid", "true");
    $("#gameIdError").hidden = false;
    $("#gameIdError").textContent = !input
      ? "Saisis l’identifiant de la partie."
      : "Saisis un numéro de partie ou un identifiant complet, par exemple EUW1_7861632138.";
    gameInput.focus();
    return false;
  }
  syncInputRegion();
  clearInputError();
  return true;
}
function setGenerating(value) {
  generating = value;
  form.setAttribute("aria-busy", String(value));
  submit.disabled = value;
  gameInput.disabled = value;
  regionInput.disabled = value;
  $("#cancelImport").disabled = false;
  $("#cancelImport").textContent = "Annuler";
  $("#chooseLeaguePath").disabled = value;
  $("#resetLeaguePath").disabled = value;
  if (activeView === "history") renderHistory();
}
function renderProgress(progress) {
  if (!generating) return;
  $("#progressMessage").textContent =
    progress.message || "Préparation du fichier…";
  if (progress.stage === "save" || progress.stage === "complete")
    $("#cancelImport").disabled = true;
}
function renderResult(result) {
  $("#newExport").hidden = false;
  $("#resultPanel").hidden = false;
  const fileName = result.filePath.split(/[\\/]/).pop();
  $("#resultFileName").textContent = fileName || result.gameId;
  const fileId = fileName.replace(/^nxt5-/i, "").replace(/\.json$/i, "").toUpperCase();
  $("#resultGameId").textContent = fileId === result.gameId.toUpperCase() ? "" : result.gameId;
  $("#resultPath").closest("details").open = false;
  $("#resultPath").textContent = result.filePath;
  const summary = result.summary || {};
  const facts = [
    summary.participantCount ? `${summary.participantCount} joueurs` : null,
    summary.duration ? duration(summary.duration) : null,
    summary.timelineAvailable ? "Timeline incluse" : "Sans timeline",
    sourceLabel(summary.source),
  ].filter(Boolean);
  $("#resultFacts").textContent = facts.join(" · ");
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  $("#resultWarning").hidden = !warnings.length;
  $("#resultWarning").textContent = warnings.join(" ");
  $("#revealFile").disabled = !resultHistoryId;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.hidden || generating || !api?.generateImport || !validateInput()) return;
  const payload = {
    gameId: gameInput.value.trim(),
    platform: regionInput.value,
  };
  setGenerating(true);
  form.hidden = true;
  notice("#status", "", "");
  notice("#globalNotice", "", "");
  $("#resultPanel").hidden = true;
  $("#progressPanel").hidden = false;
  resultHistoryId = "";
  $("#cancelImport").focus({ preventScroll: true });
  $("#progressPanel").scrollIntoView({ block: "nearest", behavior: "instant" });
  renderProgress({
    stage: "validate",
    message: "Vérification de l’identifiant…",
  });
  try {
    const result = await api.generateImport(payload);
    if (result.canceled)
      notice("#status", "", "Export annulé. Aucun nouveau fichier enregistré.");
    else {
      resultHistoryId = result.historyId || "";
      try {
        await refreshAppState();
        resultHistoryId ||=
          appState.history.find((item) => item.filePath === result.filePath)
            ?.id || "";
      } catch {
        notice(
          "#status",
          "warning",
          "Le fichier a été enregistré, mais l’historique n’a pas pu être actualisé.",
        );
      }
      renderResult(result);
      if (activeView !== "export" && !$("#status").textContent)
        notice(
          "#globalNotice",
          "success",
          `Export ${result.gameId} enregistré. Tu peux l’ajouter dans NXT5.`,
        );
    }
  } catch (error) {
    notice("#status", "error", cleanError(error));
  } finally {
    $("#progressPanel").hidden = true;
    setGenerating(false);
    form.hidden = !$("#resultPanel").hidden;
    if (activeView === "export") {
      const resultPanel = $("#resultPanel");
      const feedback = resultPanel.hidden ? $("#status") : resultPanel;
      if (!resultPanel.hidden) $("#resultHeading").focus({ preventScroll: true });
      else gameInput.focus({ preventScroll: true });
      if (!feedback.hidden) feedback.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    if (activeView !== "export" && $("#status").textContent) {
      notice(
        "#globalNotice",
        $("#status").className.replace("notice", "").trim(),
        $("#status").textContent,
      );
    }
  }
});
$("#cancelImport").addEventListener("click", async () => {
  $("#cancelImport").disabled = true;
  $("#cancelImport").textContent = "Annulation…";
  try {
    await api.cancelImport();
  } catch (error) {
    notice("#status", "error", cleanError(error));
    $("#cancelImport").disabled = false;
    $("#cancelImport").textContent = "Annuler";
  }
});
gameInput.addEventListener("input", () => {
  clearInputError();
  syncInputRegion();
});
regionInput.addEventListener("change", async () => {
  try {
    appState.settings = await api.saveSettings({ platform: regionInput.value });
  } catch (error) {
    notice(
      "#status",
      "error",
      `La région n’a pas pu être mémorisée. ${cleanError(error)}`,
    );
  }
});
$("#chooseLeaguePath").addEventListener("click", async () => {
  const button = $("#chooseLeaguePath");
  button.disabled = true;
  try {
    const result = await api.chooseLeaguePath();
    if (!result.canceled) {
      await refreshAppState();
      notice("#settingsStatus", "success", "Emplacement du client enregistré.");
      await checkClient();
    }
  } catch (error) {
    notice("#settingsStatus", "error", cleanError(error));
  } finally {
    button.disabled = generating;
  }
});
$("#resetLeaguePath").addEventListener("click", async () => {
  const button = $("#resetLeaguePath");
  button.disabled = true;
  try {
    appState.settings = await api.saveSettings({ leaguePath: "" });
    updatePath();
    notice("#settingsStatus", "success", "Détection automatique rétablie.");
    await checkClient();
  } catch (error) {
    notice("#settingsStatus", "error", cleanError(error));
  } finally {
    button.disabled = generating;
  }
});
document
  .querySelectorAll("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.view, true)),
  );
for (const [selector, path] of [
  ["[data-open-site]", "/games"],
  ["[data-open-import]", "/games?import=1"],
  ["[data-open-link]", "/games?import=1&liaison=1"],
]) {
  document.querySelectorAll(selector).forEach((button) =>
    button.addEventListener("click", () =>
      openExternal(appState.siteUrl ? `${appState.siteUrl}${path}` : ""),
    ),
  );
}
$("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  showView("export", true);
});
$("#exportTeam").addEventListener("click", () => showView("collect", true));
$("#newExport").addEventListener("click", () => startNewExport());
$("#firstExport").addEventListener("click", () => {
  showView("export", true);
  startNewExport();
});
$("#historySearch").addEventListener("input", renderHistory);
$("#refreshClient").addEventListener("click", checkClient);
$("#manualUpdateButton").addEventListener("click", () =>
  checkForUpdate({ manual: true }),
);
$("#updateInstall").addEventListener("click", installUpdate);
$("#updateLink").addEventListener("click", () =>
  openExternal(updateDownloadUrl),
);
$("#revealFile").addEventListener("click", () =>
  revealExport(resultHistoryId, $("#revealFile")),
);
$("#collectLinkForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("#collectCode").value.trim();
  const label = $("#collectLabel").value.trim() || appState.deviceName || "";
  collectorAction(() => api.collector.connect({ code, label }), "#collectLinkStatus").then((linked) => {
    if (linked) {
      $("#collectCode").value = "";
      if (activeView === "collect") $("#collectToggle").focus();
    }
  });
});
$("#collectVerify").addEventListener("click", () => collectorAction(() => api.collector.verify(), "#collectLinkStatus", "Liaison vérifiée."));
$("#collectForget").addEventListener("click", () => {
  if (!window.confirm("Oublier la liaison sur cet ordinateur ? Il faudra un nouveau code pour la rétablir.")) return;
  collectorAction(() => api.collector.forget(), "#collectLinkStatus", "Liaison oubliée.");
});
$("#collectToggle").addEventListener("click", () => collectorAction(() => (collectorState?.active ? api.collector.stop() : api.collector.start()), "#collectRunStatus"));
$("#collectManualForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const gameId = $("#collectManualId").value.trim();
  if (!gameId) {
    $("#collectManualId").focus();
    return;
  }
  collectorAction(() => api.collector.submit(gameId), "#collectRunStatus").then((sent) => {
    if (sent) $("#collectManualId").value = "";
  });
});
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
    return;
  if (["1", "2", "3", "4"].includes(event.key)) {
    event.preventDefault();
    showView({ 1: "export", 2: "history", 3: "collect", 4: "settings" }[event.key], true);
  }
  if (event.key === "Enter" && activeView === "export") {
    event.preventDefault();
    if (!$("#resultPanel").hidden) startNewExport();
    else if (!form.hidden) form.requestSubmit();
  }
});
async function initialize() {
  if (!api?.getAppState || !api?.generateImport) {
    submit.disabled = true;
    $("#refreshClient").disabled = true;
    $("#manualUpdateButton").disabled = true;
    $("#chooseLeaguePath").disabled = true;
    regionInput.disabled = true;
    $("#clientLabel").textContent = "Moteur local indisponible";
    $("#latestVersion").textContent = "Version indisponible";
    notice(
      "#globalNotice",
      "error",
      "Le moteur local ne s’est pas chargé. Ferme puis rouvre NXT5 Importer. Si le problème persiste, réinstalle la dernière version.",
    );
    return;
  }
  submit.disabled = true;
  try {
    await refreshAppState({ initial: true });
  } catch (error) {
    notice(
      "#globalNotice",
      "error",
      `Les préférences n’ont pas pu être chargées. ${cleanError(error)}`,
    );
  } finally {
    submit.disabled = false;
  }
  if (api.onProgress) unsubscribeProgress = api.onProgress(renderProgress);
  if (api.onUpdateState) unsubscribeUpdate = api.onUpdateState(renderUpdate);
  if (api.collector?.onUpdate) unsubscribeCollector = api.collector.onUpdate(renderCollector);
  if (!$("#collectLabel").value) $("#collectLabel").value = appState.deviceName || "";
  if (appState.collector) renderCollector(appState.collector);
  void checkClient();
  void checkForUpdate();
}
window.addEventListener("pagehide", () => {
  unsubscribeProgress?.();
  unsubscribeCollector?.();
  unsubscribeUpdate?.();
});
void initialize();
