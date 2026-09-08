import { useEffect, useRef, useState } from "react";
import { BarChart3, ClipboardList, Tags, Users } from "lucide-react";
import { Button, TabNav } from "../ui/Core.jsx";

const TABS = [
  { id: "admin", label: "Vue d’ensemble", icon: BarChart3, path: "/admin" },
  { id: "account-subscriptions", label: "Profils et abonnements", icon: Users, path: "/admin/abonnements" },
  { id: "access-requests", label: "Demandes d’accès", icon: ClipboardList, path: "/admin/demandes-acces" },
  { id: "pricing", label: "Tarifs", icon: Tags, path: "/tarifs" },
];

function revealTab(tab) {
  const list = tab?.closest?.('[role="tablist"]');
  if (!list) return;
  const bounds = list.getBoundingClientRect(), target = tab.getBoundingClientRect();
  if (target.left < bounds.left) list.scrollLeft -= bounds.left - target.left + 8;
  else if (target.right > bounds.right) list.scrollLeft += target.right - bounds.right + 8;
}

export default function AdminTabNav({ activeId, navigate, disabled = false, dirty = false }) {
  const [pendingId, setPendingId] = useState("");
  const rootRef = useRef(null);
  const confirmationRef = useRef(null);

  useEffect(() => {
    setPendingId("");
    revealTab(rootRef.current?.querySelector('[aria-selected="true"]'));
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
    rootRef.current?.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
  }

  function moveFocus(event) {
    if (disabled || event.target.getAttribute?.("role") !== "tab") return;
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const tabs = Array.from(rootRef.current.querySelectorAll('[role="tab"]'));
    const current = tabs.indexOf(event.target);
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[index]?.focus({ preventScroll: true });
    revealTab(tabs[index]);
  }

  return <div ref={rootRef} className="mb-5 min-w-0" onKeyDown={moveFocus}>
    <fieldset disabled={disabled} className={`min-w-0 border-0 p-0 ${disabled ? "opacity-60" : ""}`}>
      <legend className="sr-only">Sections de l’administration</legend>
      <TabNav label="Sections de l’administration" items={TABS} activeId={activeId} onChange={select} columns="!min-w-max" />
    </fieldset>
    {pendingId && <div ref={confirmationRef} tabIndex={-1} role="alert" className="mt-3 border-l-2 border-amber-200/40 pl-4 text-sm leading-6 text-slate-300">
      <p className="font-bold text-white">Modifications non enregistrées</p>
      <p>Quitter cet onglet abandonnera tes modifications.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={disabled} onClick={stay}>Rester sur cet onglet</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => { if (!disabled) navigate(TABS.find((tab) => tab.id === pendingId).path); }}>Quitter sans enregistrer</Button>
      </div>
    </div>}
  </div>;
}
