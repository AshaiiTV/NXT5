import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cx } from "../../app/helpers.js";
import "../../pages/workspace/GameOperations.css";

let activeDialogs = 0;
let previousBodyOverflow = "";

/** Native modal: the browser traps focus and makes the statistics behind it inert. */
export function GameOperationDialog({ title, description, children, onClose, busy = false, returnFocusRef, compact = false, className = "" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef?.current;
    const previousFocus = returnTarget?.querySelector?.("button, a[href], input, select, textarea, [tabindex]") || returnTarget || document.activeElement;
    const protectedUrl = window.location.href;
    const protectedState = window.history.state;
    // Browser back/forward must not unmount a draft or an in-flight import.
    // App navigation after a successful import uses a synthetic popstate.
    const protectDraft = (event) => {
      if (!event.isTrusted) return;
      event.stopImmediatePropagation();
      window.history.replaceState(protectedState, "", protectedUrl);
    };
    window.addEventListener("popstate", protectDraft, true);
    if (activeDialogs === 0) previousBodyOverflow = document.body.style.overflow;
    activeDialogs += 1;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      window.removeEventListener("popstate", protectDraft, true);
      activeDialogs -= 1;
      if (activeDialogs === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus?.isConnected !== false) previousFocus?.focus?.();
    };
  }, []);
  const close = () => { if (!latest.current.busy) latest.current.onClose(); };
  return <dialog ref={dialogRef} className={cx("game-operation-dialog nxt5-data-dense", compact && "game-operation-dialog-compact", className)} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined} onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="game-operation-dialog-inner">
      <header className="game-operation-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="game-operation-close" aria-label="Fermer la fenêtre" onClick={close} disabled={busy} autoFocus><X aria-hidden="true" className="h-5 w-5" /></button>
      </header>
      <div className="game-operation-dialog-content">{children}</div>
    </div>
  </dialog>;
}
