import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { multiOpggUrlFromRoster, rosterPlayersByStatus } from "../../utils/roster.js";

export default function AdminRosterOpgg({ team, disabled = false }) {
  useLanguage();
  const descriptionId = useId();
  const roster = rosterPlayersByStatus(team?.mainRoster, "MAIN");
  const linked = roster.filter(player => {
    const parts = String(player.riot_id || "").split("#");
    return parts.length === 2 && parts.every(part => part.trim());
  });
  const link = multiOpggUrlFromRoster(linked, team?.region);
  const [status, setStatus] = useState("idle");
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setStatus("idle");
    return () => { generation.current += 1; };
  }, [link, team?.id]);
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    if (disabled || !link || pending.current) return;
    pending.current = true;
    const operation = generation.current;
    setStatus("copying");
    try {
      // Invoke within the click gesture, without a network round trip (Safari).
      await navigator.clipboard.writeText(link);
      if (operation === generation.current) setStatus("copied");
    } catch {
      if (operation === generation.current) setStatus("error");
    } finally {
      if (operation === generation.current) pending.current = false;
    }
  }

  return <div className="admin-roster-opgg">
    <Button type="button" variant="ghost" icon={status === "copied" ? Check : status === "copying" ? Loader2 : Copy}
      disabled={disabled || !link || status === "copying"} onClick={copy} aria-describedby={descriptionId}
      aria-label={t("Copier OP.GG titulaires de {0}", [team?.name || ""])}>
      {status === "copied" ? t("Copié") : status === "copying" ? t("Copie…") : t("Copier OP.GG titulaires")}
    </Button>
    <p id={descriptionId} className="admin-roster-opgg-hint" role="status">
      {!roster.length ? t("Aucun titulaire dans cette équipe.")
        : !link ? t("Renseigne les Riot IDs des titulaires au format Pseudo#TAG.")
        : status === "copied" ? t("Lien copié · {0}/{1} titulaires inclus", [linked.length, roster.length])
        : t("{0}/{1} titulaires dans le lien", [linked.length, roster.length])}
      {link && linked.length < roster.length && <> · {t("Riot IDs manquants ou invalides.")}</>}
    </p>
    {status === "error" && <div className="admin-roster-opgg-fallback">
      <p role="alert">{t("Copie impossible. Réessaie ou copie le lien ci-dessous.")}</p>
      <input className="nxt5-input-shell" aria-label={t("Lien OP.GG des titulaires")} value={link} readOnly onFocus={event => event.target.select()} onClick={event => event.currentTarget.select()} />
    </div>}
  </div>;
}
