const dialogs = [];
const listeners = new Set();
export const getTopDialog = () => dialogs.at(-1) || null;
export function subscribeDialogs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function registerDialog(dialog) {
  if (!dialog) return () => {};
  dialogs.push(dialog);
  listeners.forEach(listener => listener());
  return () => {
    const index = dialogs.indexOf(dialog);
    if (index >= 0) dialogs.splice(index, 1);
    listeners.forEach(listener => listener());
  };
}
