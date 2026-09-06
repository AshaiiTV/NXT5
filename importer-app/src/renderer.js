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
let progressTimer;
let unsubscribeProgress;
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function cleanError(error) {
  return String(
    error?.message || error || "Une erreur est survenue. Réessayez.",
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
  const names = {
    export: "Nouvel export",
    history: "Exports récents",
    settings: "Paramètres",
  };
  if (!names[view]) return;
  activeView = view;
  for (const name of Object.keys(names)) {
    $(`#${name}View`).hidden = name !== view;
    const button = $(`#${name}Tab`);
    button.classList.toggle("active", name === view);
    if (name === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  $("#viewName").textContent = names[view];
  if (view === "history") renderHistory();
  if (focus) $(`#${view}Heading`).focus({ preventScroll: true });
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
  $("#railVersion").textContent = `v${appState.version}`;
  $("#currentVersion").textContent = `v${appState.version}`;
  const mac = appState.platform === "darwin" || appState.platform === "mac";
  $("#systemInfo").textContent =
    `${mac ? "macOS" : appState.platform === "win32" || appState.platform === "windows" ? "Windows" : appState.platform} · ${appState.arch === "arm64" ? (mac ? "Apple Silicon" : "ARM64") : "Intel / x64"}`;
  $("#exportShortcut").textContent = mac ? "⌘ ↵" : "Ctrl ↵";
  if (initial && regions.has(appState.settings?.platform))
    regionInput.value = appState.settings.platform;
  updatePath();
  renderHistory();
  $("#historyCount").textContent = String(appState.history.length);
  $("#historyTotal").textContent = String(appState.history.length);
  const last = appState.history[0];
  $("#lastExport").hidden = !last;
  if (last)
    $("#lastExportId").textContent =
      `${last.gameId} · ${date(last.exportedAt)}`;
}
function renderHistory() {
  const query = $("#historySearch").value.trim().toUpperCase();
  const items = appState.history.filter((item) =>
    String(item.gameId).toUpperCase().includes(query),
  );
  const list = $("#historyList");
  list.replaceChildren();
  $("#historyEmpty").hidden = items.length > 0;
  $("#historyEmpty h3").textContent = query
    ? "Aucun export ne correspond"
    : "Aucune game exportée pour le moment";
  $("#historyEmpty p").textContent = query
    ? "Essayez avec une autre partie de l’identifiant."
    : "Vos prochains fichiers apparaîtront ici après leur enregistrement.";
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
      gameInput.value = item.gameId;
      syncInputRegion();
      clearInputError();
      showView("export");
      gameInput.focus();
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
        "Ce fichier a été déplacé ou supprimé. Vous pouvez réexporter la game.",
      );
    notice("#globalNotice", "", "");
  } catch (error) {
    notice("#globalNotice", "error", cleanError(error));
  } finally {
    button.disabled = false;
  }
}
async function checkClient() {
  if (!api?.getClientStatus || checkingClient) return;
  checkingClient = true;
  $("#refreshClient").disabled = true;
  $("#clientIndicator").dataset.state = "checking";
  $("#clientLabel").textContent = "Recherche du client…";
  try {
    const result = await api.getClientStatus();
    $("#clientIndicator").dataset.state = result.connected
      ? "connected"
      : "disconnected";
    $("#clientLabel").textContent = result.connected
      ? "Client LoL connecté"
      : "Client LoL non détecté";
    $("#clientIndicator").title = result.message || "";
  } catch (error) {
    $("#clientIndicator").dataset.state = "disconnected";
    $("#clientLabel").textContent = "Client LoL non détecté";
    $("#clientIndicator").title = cleanError(error);
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
    $("#update").hidden = !info.updateAvailable;
    $("#latestVersion").textContent = info.updateAvailable
      ? `Version ${info.latestVersion} disponible`
      : "Votre application est à jour";
    $("#updateText").textContent =
      `Version ${info.latestVersion} · installée : ${appState.version || info.currentVersion}`;
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
      `${cleanError(error)} Vous pouvez continuer à utiliser l’application.`;
  } finally {
    checkingUpdate = false;
    $("#manualUpdateButton").disabled = false;
    $("#manualUpdateButton").textContent = "Vérifier les mises à jour";
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
      ? "Ajoutez l’identifiant de la game à exporter."
      : "Utilisez un numéro de game ou un ID complet, comme EUW1_7861632138.";
    gameInput.focus();
    return false;
  }
  syncInputRegion();
  clearInputError();
  return true;
}
function setGenerating(value) {
  generating = value;
  document.body.classList.toggle("is-generating", value);
  form.setAttribute("aria-busy", String(value));
  submit.disabled = value;
  gameInput.disabled = value;
  regionInput.disabled = value;
  $("#submit span").textContent = value
    ? "Export en cours…"
    : "Exporter la game";
  $("#cancelImport").disabled = false;
  $("#cancelImport").textContent = "Annuler";
  $("#chooseLeaguePath").disabled = value;
  $("#resetLeaguePath").disabled = value;
  if (activeView === "history") renderHistory();
}
function renderProgress(progress) {
  if (!generating) return;
  const stages = ["fetch", "timeline", "save", "complete"];
  const index = stages.indexOf(progress.stage);
  for (const step of $("#progressSteps").children) {
    const stepIndex = stages.indexOf(step.dataset.stage);
    step.classList.toggle("active", stepIndex === Math.max(0, index));
    step.classList.toggle("done", stepIndex < index);
    if (stepIndex === Math.max(0, index))
      step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  }
  $("#progressMessage").textContent =
    progress.message || "Préparation du fichier…";
  if (progress.stage === "save" || progress.stage === "complete")
    $("#cancelImport").disabled = true;
}
function renderResult(result) {
  $("#resultPanel").hidden = false;
  $("#resultGameId").textContent = result.gameId;
  $("#resultPath").textContent = result.filePath;
  const summary = result.summary || {};
  const facts = [
    summary.participantCount ? `${summary.participantCount} joueurs` : null,
    summary.duration ? duration(summary.duration) : null,
    summary.timelineAvailable ? "Timeline incluse" : "Sans timeline",
    sourceLabel(summary.source),
  ].filter(Boolean);
  $("#resultFacts").replaceChildren(
    ...facts.map((value) => {
      const span = document.createElement("span");
      span.textContent = value;
      return span;
    }),
  );
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  $("#resultWarning").hidden = !warnings.length;
  $("#resultWarning").textContent = warnings.join(" ");
  $("#revealFile").disabled = !resultHistoryId;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (generating || !api?.generateImport || !validateInput()) return;
  const payload = {
    gameId: gameInput.value.trim(),
    platform: regionInput.value,
  };
  setGenerating(true);
  notice("#status", "", "");
  notice("#globalNotice", "", "");
  $("#resultPanel").hidden = true;
  $("#progressPanel").hidden = false;
  resultHistoryId = "";
  renderProgress({
    stage: "validate",
    message: "Vérification de l’identifiant…",
  });
  const start = Date.now();
  $("#progressTime").textContent =
    "Vous pourrez choisir l’emplacement du fichier à la fin.";
  progressTimer = setInterval(() => {
    $("#progressTime").textContent =
      `${Math.round((Date.now() - start) / 1000)} s écoulées · La disponibilité des données dépend de Riot et du client LoL.`;
  }, 1000);
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
      if (!$("#status").textContent)
        notice(
          "#status",
          "success",
          `Export ${result.gameId} enregistré. Vous pouvez l’ajouter dans NXT5.`,
        );
    }
  } catch (error) {
    notice("#status", "error", cleanError(error));
  } finally {
    clearInterval(progressTimer);
    $("#progressPanel").hidden = true;
    setGenerating(false);
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
document
  .querySelectorAll("[data-open-site]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      openExternal(appState.siteUrl ? `${appState.siteUrl}/integration` : ""),
    ),
  );
$("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  showView("export", true);
});
$("#viewHistory").addEventListener("click", () => showView("history", true));
$("#openClientSettings").addEventListener("click", () =>
  showView("settings", true),
);
$("#firstExport").addEventListener("click", () => {
  showView("export");
  gameInput.focus();
});
$("#historySearch").addEventListener("input", renderHistory);
$("#refreshClient").addEventListener("click", checkClient);
$("#manualUpdateButton").addEventListener("click", () =>
  checkForUpdate({ manual: true }),
);
$("#updateLink").addEventListener("click", () =>
  openExternal(updateDownloadUrl),
);
$("#revealFile").addEventListener("click", () =>
  revealExport(resultHistoryId, $("#revealFile")),
);
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
    return;
  if (["1", "2", "3"].includes(event.key)) {
    event.preventDefault();
    showView({ 1: "export", 2: "history", 3: "settings" }[event.key], true);
  }
  if (event.key === "Enter" && activeView === "export") {
    event.preventDefault();
    form.requestSubmit();
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
      "Le moteur local ne s’est pas chargé. Fermez puis rouvrez NXT5 Importer. Si le problème persiste, réinstallez la dernière version.",
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
  void checkClient();
  void checkForUpdate();
}
window.addEventListener("pagehide", () => {
  clearInterval(progressTimer);
  unsubscribeProgress?.();
});
void initialize();
