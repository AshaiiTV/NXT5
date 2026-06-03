const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');
const updateBox = document.querySelector('#update');
const updateText = document.querySelector('#updateText');
const updateLink = document.querySelector('#updateLink');
let generating = false;
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
