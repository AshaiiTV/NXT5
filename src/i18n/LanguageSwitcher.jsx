import React from "react";
import { ChevronDown, Languages } from "lucide-react";
import { setLanguage } from "./locale.js";
import { useLanguage } from "./useLanguage.js";
import "./language-switcher.css";

const LABELS = {
  fr: "Langue du site",
  en: "Site language",
  es: "Idioma del sitio",
};

/** A native select keeps touch, keyboard and assistive-technology behavior intact. */
export default function LanguageSwitcher() {
  const language = useLanguage();
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function changeLanguage(event) {
    const value = event.target.value;
    setPending(true);
    setFailed(false);
    try { await setLanguage(value); }
    catch { if (mounted.current) setFailed(true); }
    finally { if (mounted.current) setPending(false); }
  }
  return (
    <label className="nxt5-language-switcher" translate="no" aria-busy={pending}>
      <span className="nxt5-language-display" aria-hidden="true">
        <Languages size={17} />
        <span>{language.toUpperCase()}</span>
        <ChevronDown size={13} />
      </span>
      <select
        className="nxt5-language-select"
        aria-label={LABELS[language]}
        title={LABELS[language]}
        value={language}
        disabled={pending}
        onChange={changeLanguage}
      >
        <option value="fr" lang="fr">Français</option>
        <option value="en" lang="en">English</option>
        <option value="es" lang="es">Español</option>
      </select>
      {failed && <span className="nxt5-language-error" role="alert">{language === 'en' ? 'Unable to load this language. Try again.' : language === 'es' ? 'No se puede cargar el idioma. Inténtalo de nuevo.' : 'Impossible de charger cette langue. Réessaie.'}</span>}
    </label>
  );
}
