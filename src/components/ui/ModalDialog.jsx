import React, { useEffect, useRef } from "react";
import "./modal-dialog.css";
import { registerDialog } from "./dialog-registry.js";

const openDialogs = [];
let previousOverflow = "";

/** Native modality supplies focus containment and makes the rest of the page inert. */
export function ModalDialog({ children, onClose, busy = false, dirty = false, dismissable = true, handleHistory = false, returnFocusRef, className = "", ...props }) {
  const ref = useRef(null);
  const latest = useRef(null);
  latest.current = { onClose, busy, dirty, dismissable };
  function requestClose(reason = "dismiss") {
    const current = latest.current;
    if (current.busy || !current.dismissable) return false;
    if (current.dirty && !window.confirm("Fermer cette fenêtre et abandonner les modifications non enregistrées ?")) return false;
    current.onClose?.({ reason });
    return true;
  }
  useEffect(() => {
    const dialog = ref.current;
    const target = returnFocusRef?.current;
    const previousFocus = target?.querySelector?.("button, a[href], input, select, textarea, [tabindex]") || target || document.activeElement;
    const openedUrl = window.location.href;
    const openedState = window.history.state;
    if (!openDialogs.length) previousOverflow = document.body.style.overflow;
    openDialogs.push(dialog);
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    const unregister = registerDialog(dialog);
    const onHistory = (event) => {
      if (!event.isTrusted || openDialogs.at(-1) !== dialog) return;
      // A rejected Back creates a replacement entry without overwriting the
      // previous page. A successful Back is allowed to update the app route.
      if (!requestClose("history")) {
        event.stopImmediatePropagation();
        window.history.pushState(openedState, "", openedUrl);
      }
    };
    if (handleHistory) window.addEventListener("popstate", onHistory, true);
    return () => {
      if (handleHistory) window.removeEventListener("popstate", onHistory, true);
      unregister();
      if (dialog?.open) dialog.close();
      const index = openDialogs.indexOf(dialog);
      if (index >= 0) openDialogs.splice(index, 1);
      if (!openDialogs.length) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected !== false) previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);
  return <dialog {...props} ref={ref} className={`nxt5-native-dialog ${className}`} aria-modal="true" aria-busy={busy || undefined} onCancel={(event) => {
    event.preventDefault();
    event.stopPropagation?.();
    requestClose();
  }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
  }}>{children}</dialog>;
}
