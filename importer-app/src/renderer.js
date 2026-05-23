const form = document.querySelector('#form');
const submit = document.querySelector('#submit');
const statusBox = document.querySelector('#status');

function setStatus(type, text) {
  statusBox.hidden = false;
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  submit.textContent = 'Génération...';
  setStatus('info', 'Connexion à Riot et préparation du fichier...');

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await window.nxt5.generateImport(payload);
    if (result.canceled) setStatus('info', 'Sauvegarde annulée. Aucun fichier créé.');
    else setStatus('success', `Fichier prêt : ${result.filePath}`);
  } catch (err) {
    setStatus('error', err.message || 'Erreur inconnue pendant la génération.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Générer le fichier NXT5';
  }
});
