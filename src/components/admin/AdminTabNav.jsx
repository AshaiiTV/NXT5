import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { useEffect, useRef, useState } from "react";
import { BarChart3, ClipboardList, Tags, Users } from "lucide-react";
import { Button } from "../ui/Core.jsx";

const TABS = [
  { id: "admin", label: "Administration", icon: BarChart3, path: "/admin" },
  { id: "account-subscriptions", label: "Comptes et abonnements", icon: Users, path: "/admin/abonnements" },
  { id: "access-requests", label: "Demandes d’accès", icon: ClipboardList, path: "/admin/demandes-acces" },
  { id: "pricing", label: "Tarifs", icon: Tags, path: "/tarifs" },
];

function revealTab(tab) {
  const list = tab?.closest?.('nav');
  if (!list) return;
  const bounds = list.getBoundingClientRect(), target = tab.getBoundingClientRect();
  if (target.left < bounds.left) list.scrollLeft -= bounds.left - target.left + 8;
  else if (target.right > bounds.right) list.scrollLeft += target.right - bounds.right + 8;
}

export default function AdminTabNav({ activeId, navigate, disabled = false, dirty = false }) {
  useLanguage();
  const [pendingId, setPendingId] = useState("");
  const rootRef = useRef(null);
  const confirmationRef = useRef(null);

  useEffect(() => {
    setPendingId("");
    revealTab(rootRef.current?.querySelector('[aria-current="page"]'));
  }, [activeId]);
  useEffect(() => { if (pendingId) confirmationRef.current?.focus(); }, [pendingId]);
  useEffect(() => { if (!dirty) setPendingId(""); }, [dirty]);

  function select(id) {
    if (disabled || id === activeId || !TABS.some((tab) => tab.id === id)) return;
    if (dirty) setPendingId(id);
    else navigate(TABS.find((tab) => tab.id === id).path);
  }

  function stay() {
    setPendingId("");
    rootRef.current?.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
  }

  return <div ref={rootRef} className="mb-5 min-w-0">
    <nav aria-label={t("Sections de l’administration")} className={`nxt5-tab-nav overflow-x-auto ${disabled ? "opacity-60" : ""}`}>
      <div className="grid min-w-max grid-flow-col auto-cols-fr gap-1">{TABS.map((tab) => {
        const Icon = tab.icon;
        return <a key={tab.id} href={tab.path} aria-current={activeId === tab.id ? "page" : undefined} aria-disabled={disabled || undefined} className="nxt5-tab flex min-h-12 items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold" onClick={(event) => {
          if (disabled) { event.preventDefault(); return; }
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          select(tab.id);
        }}><Icon aria-hidden="true" className="h-4 w-4" />{t(tab.label)}</a>;
      })}</div>
    </nav>
    {pendingId && <div ref={confirmationRef} tabIndex={-1} role="alert" className="mt-3 border-l-2 border-amber-200/40 pl-4 text-sm leading-6 text-slate-300">
      <p className="font-bold text-white">{t("Modifications non enregistrées")}</p>
      <p>{t("Quitter cet onglet abandonnera tes modifications.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={disabled} onClick={stay}>{t("Rester sur cet onglet")}</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => { if (!disabled) navigate(TABS.find((tab) => tab.id === pendingId).path); }}>{t("Quitter sans enregistrer")}</Button>
      </div>
    </div>}
  </div>;
}
