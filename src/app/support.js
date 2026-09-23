// Public destination only. Never put payment credentials in a VITE_ variable.
export function normalizeSupportUrl(value = "") {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

export const SUPPORT_URL = normalizeSupportUrl(import.meta.env.VITE_NXT5_SUPPORT_URL);
