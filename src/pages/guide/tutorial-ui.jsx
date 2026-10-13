import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { cx } from "../../app/helpers.js";

export const FAVICON = "/assets/nxt5-loader-favicon-256.webp";
export const championIcon = (name) => `/assets/home-motion/champions/${name.replace(/[\s’']/g, "")}-icon.webp`;
export const championArt = (name) => `/assets/home-motion/champions/${name.replace(/[\s’']/g, "")}-loading.webp`;

export const formatNumber = (value, options) => new Intl.NumberFormat(getLocale(), options).format(value);
export const formatSigned = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}`;
export const formatDate = (iso, options = { day: "numeric", month: "short", year: "numeric" }) =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: "Europe/Paris", ...options }).format(new Date(iso));

/** Active annotated zone of the current chapter: steps and screen share it. */
export const ChapterContext = createContext({ active: null, activate: () => {} });

function Token({ value }) {
  if (typeof value === "string") return <span className="tuto-ui">{t(value)}</span>;
  if (value?.raw) return <code className="tuto-cmd">{value.raw}</code>;
  if (value?.cmd) return <><code className="tuto-cmd">{value.cmd}</code>{value.copy && <CopyButton text={value.cmd} />}</>;
  return null;
}

/** Keep French high punctuation and guillemets on the same line as their word. */
export const typeset = (text) => String(text).replace(/ ([:;?!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");

/** Translate a sentence, then place interface labels or commands in its {n} slots. */
export function Rich({ text, values = [] }) {
  useLanguage();
  return typeset(t(text)).split(/(\{\d+\})/g).map((part, index) => {
    const slot = /^\{(\d+)\}$/.exec(part);
    return slot ? <Token key={index} value={values[Number(slot[1])]} /> : <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function CopyButton({ text }) {
  useLanguage();
  const [state, setState] = useState("idle");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  };
  return <button type="button" className={cx("tuto-copier", state === "copied" && "is-ok")} onClick={copy}>
    <Copy aria-hidden="true" />{state === "copied" ? t("Copié") : state === "failed" ? t("Copie impossible") : t("Copier")}<span className="sr-only"> {text}</span>
  </button>;
}

/** Part of an example screen linked to a numbered step. */
export function Zone({ z, as: Tag = "div", className = "", children }) {
  const { active, activate } = useContext(ChapterContext);
  return <Tag className={cx("tuto-z", active === z && "is-actif", className)}>
    {children}
    <span className="tuto-spot" aria-hidden="true" onClick={(event) => { event.stopPropagation(); activate(z); }}>{z}</span>
  </Tag>;
}

export function Screen({ path, bar = true, children, className = "" }) {
  useLanguage();
  return <div className={cx("tuto-cadre", className)}>
    {bar && <div className="tuto-m-barre"><img src={FAVICON} alt="" width="28" height="28" loading="lazy" decoding="async" /><span className="tuto-m-chemin">{path}</span><span className="tuto-m-fictif">{t("Exemple fictif")}</span></div>}
    <div className="tuto-m-corps">{children}</div>
  </div>;
}

export function Champion({ name, className = "" }) {
  return <span className={cx("tuto-m-champ", className)}><img src={championIcon(name)} alt="" width="96" height="96" loading="lazy" decoding="async" /></span>;
}
