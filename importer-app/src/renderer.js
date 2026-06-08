const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');
const updateBox = document.querySelector('#update');
const updateText = document.querySelector('#updateText');
const updateLink = document.querySelector('#updateLink');
const exportTab = document.querySelector('#exportTab');
const settingsTab = document.querySelector('#settingsTab');
const settingsPanel = document.querySelector('#settingsPanel');
const manualUpdateButton = document.querySelector('#manualUpdateButton');
const currentVersion = document.querySelector('#currentVersion');
const latestVersion = document.querySelector('#latestVersion');
const railVersion = document.querySelector('#railVersion');
let generating = false;
let updateDownloadUrl = '';
let lastUpdateInfo = null;

function setStatus(type, text) {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

function resetSubmit() {
  generating = false;
  submit.disabled = false;
  submit.textContent = 'Generer le fichier NXT5';
}

function setActiveTab(tab) {
  const settings = tab === 'settings';
  exportTab?.classList.toggle('active', !settings);
  settingsTab?.classList.toggle('active', settings);
  form.hidden = settings;
  form.classList.toggle('active', !settings);
  settingsPanel.hidden = !settings;
  settingsPanel.classList.toggle('active', settings);
  if (settings) renderUpdateInfo(lastUpdateInfo);
}

function renderUpdateInfo(info) {
  if (!currentVersion || !latestVersion || !manualUpdateButton) return;
  if (!info) {
    currentVersion.textContent = 'Verification...';
    latestVersion.textContent = 'Derniere version : verification...';
    manualUpdateButton.textContent = 'Verifier les mises a jour';
    manualUpdateButton.disabled = false;
    return;
  }
  currentVersion.textContent = info.currentVersion || 'Inconnue';
  if (railVersion) railVersion.textContent = `v${info.currentVersion || '...'}`;
  latestVersion.textContent = `Derniere version : ${info.latestVersion || 'inconnue'}`;
  manualUpdateButton.disabled = false;
  manualUpdateButton.textContent = info.updateAvailable ? 'Telecharger la mise a jour' : 'Application a jour';
}

if (!window.nxt5?.generateImport) {
  submit.disabled = true;
  setStatus('error', "Le moteur local de l'application ne s'est pas charge. Ferme l'app, supprime l'ancienne version, puis ouvre la derniere version de NXT5 Importer.");
}

async function checkForUpdate({ showStatus = false } = {}) {
  if (!window.nxt5?.checkUpdate) return null;
  try {
    if (manualUpdateButton) {
      manualUpdateButton.disabled = true;
      manualUpdateButton.textContent = 'Verification...';
    }
    const info = await window.nxt5.checkUpdate();
    lastUpdateInfo = info;
    renderUpdateInfo(info);
    if (info?.updateAvailable) {
      updateText.textContent = `Ta version : ${info.currentVersion}. Derniere version : ${info.latestVersion}.`;
      updateDownloadUrl = info.downloadUrl;
      updateLink.href = info.downloadUrl;
      updateLink.textContent = info.platform === 'mac' ? 'Telecharger Mac' : 'Telecharger Windows';
      updateBox.hidden = false;
      if (showStatus) setStatus('info', 'Une mise a jour de NXT5 Importer est disponible.');
    } else {
      updateBox.hidden = true;
      if (showStatus) setStatus('success', 'NXT5 Importer est deja a jour.');
    }
    return info;
  } catch (err) {
    renderUpdateInfo({ currentVersion: lastUpdateInfo?.currentVersion || 'Inconnue', latestVersion: 'indisponible', updateAvailable: false });
    if (showStatus) setStatus('error', err.message || 'Verification de mise a jour impossible.');
    return null;
  }
}

checkForUpdate();

exportTab?.addEventListener('click', () => setActiveTab('export'));
settingsTab?.addEventListener('click', () => setActiveTab('settings'));

updateLink?.addEventListener('click', async (event) => {
  if (!updateDownloadUrl || !window.nxt5?.openExternal) return;
  event.preventDefault();
  await window.nxt5.openExternal(updateDownloadUrl);
});

manualUpdateButton?.addEventListener('click', async () => {
  const info = await checkForUpdate({ showStatus: true });
  if (info?.updateAvailable && info.downloadUrl && window.nxt5?.openExternal) {
    await window.nxt5.openExternal(info.downloadUrl);
  }
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
  document.body.classList.add('is-generating');
  submit.disabled = true;
  submit.textContent = 'Generation NXT5...';
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
    document.body.classList.remove('is-generating');
    resetSubmit();
  }
});
