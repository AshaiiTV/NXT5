const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');
const updateBox = document.querySelector('#update');
const updateText = document.querySelector('#updateText');
const updateLink = document.querySelector('#updateLink');
const upgradeDrop = document.querySelector('#upgradeDrop');
const upgradeButton = document.querySelector('#upgradeButton');
let generating = false;
let upgrading = false;
let updateDownloadUrl = '';

function setStatus(type, text) {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

function resetSubmit() {
  generating = false;
  submit.disabled = false;
  submit.textContent = 'Generer le fichier';
}

function resetUpgrade() {
  upgrading = false;
  if (upgradeButton) {
    upgradeButton.disabled = false;
    upgradeButton.textContent = 'Mettre a jour un JSON';
  }
  upgradeDrop?.classList.remove('dragging');
}

if (!window.nxt5?.generateImport) {
  submit.disabled = true;
  setStatus('error', "Le moteur local de l'application ne s'est pas charge. Ferme l'app, supprime l'ancienne version, puis ouvre la derniere version de NXT5 Importer.");
}

async function checkForUpdate() {
  if (!window.nxt5?.checkUpdate || !updateBox || !updateText || !updateLink) return;
  try {
    const info = await window.nxt5.checkUpdate();
    if (!info?.updateAvailable) return;
    updateText.textContent = `Ta version : ${info.currentVersion}. Derniere version : ${info.latestVersion}. Mets a jour pour profiter des derniers imports, timeline, wards et stats.`;
    updateDownloadUrl = info.downloadUrl;
    updateLink.href = info.downloadUrl;
    updateLink.textContent = info.platform === 'mac' ? 'Telecharger Mac' : 'Telecharger Windows';
    updateBox.hidden = false;
  } catch {
    // Offline or GitHub temporarily unavailable: importing must remain possible.
  }
}

checkForUpdate();

updateLink?.addEventListener('click', async (event) => {
  if (!updateDownloadUrl || !window.nxt5?.openExternal) return;
  event.preventDefault();
  await window.nxt5.openExternal(updateDownloadUrl);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generating) return;
  if (!window.nxt5?.generateImport) {
    setStatus('error', "Le moteur local de l'application ne repond pas. Telecharge de nouveau NXT5 Importer depuis NXT5, puis remplace l'ancienne app.");
    return;
  }
  if (!form.reportValidity()) return;
  generating = true;
  submit.disabled = true;
  submit.textContent = 'Generation...';
  setStatus('info', 'Recherche de la game et preparation du fichier...');

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await window.nxt5.generateImport(payload);
    if (result.canceled) setStatus('info', 'Sauvegarde annulee. Aucun fichier cree.');
    else setStatus('success', `Fichier pret : ${result.filePath}`);
  } catch (err) {
    setStatus('error', err.message || 'Erreur inconnue pendant la generation.');
  } finally {
    resetSubmit();
  }
});

async function updateExistingJson(filePath = '') {
  if (upgrading) return;
  if (!window.nxt5?.updateImport) {
    setStatus('error', "Le moteur local de mise a jour n'est pas disponible. Telecharge la derniere version de NXT5 Importer.");
    return;
  }
  upgrading = true;
  if (upgradeButton) {
    upgradeButton.disabled = true;
    upgradeButton.textContent = 'Mise a jour...';
  }
  setStatus('info', 'Lecture du JSON et recuperation de la timeline dans le client LoL...');
  try {
    const result = await window.nxt5.updateImport({ filePath });
    if (result.canceled) setStatus('info', 'Mise a jour annulee. Aucun fichier cree.');
    else setStatus('success', `JSON mis a jour : ${result.filePath} (${result.frames} frames timeline, ${result.wards} wards).`);
  } catch (err) {
    setStatus('error', err.message || 'Erreur inconnue pendant la mise a jour du JSON.');
  } finally {
    resetUpgrade();
  }
}

upgradeButton?.addEventListener('click', () => updateExistingJson());

upgradeDrop?.addEventListener('dragover', (event) => {
  event.preventDefault();
  upgradeDrop.classList.add('dragging');
});

upgradeDrop?.addEventListener('dragleave', () => {
  upgradeDrop.classList.remove('dragging');
});

upgradeDrop?.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  const filePath = file?.path || '';
  if (!filePath) {
    resetUpgrade();
    setStatus('error', 'Impossible de lire le chemin du fichier. Utilise le bouton "Mettre a jour un JSON".');
    return;
  }
  if (!String(filePath).toLowerCase().endsWith('.json')) {
    resetUpgrade();
    setStatus('error', 'Le fichier doit etre un JSON NXT5.');
    return;
  }
  updateExistingJson(filePath);
});
