import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId } from "react";
import { ModalDialog } from "../ui/ModalDialog.jsx";
import { X } from "lucide-react";
import { cx } from "../../app/helpers.js";
import "../../pages/workspace/GameOperations.css";

/** Native modal shared with account and review dialogs. */
export function GameOperationDialog({ title, description, children, onClose, busy = false, dirty = false, returnFocusRef, compact = false, className = "" }) {
  useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (busy || (dirty && !window.confirm(t("Fermer cette fenêtre et abandonner les modifications non enregistrées ?")))) return;
    onClose({ reason: "dismiss" });
  };
  return <ModalDialog className={cx("game-operation-dialog nxt5-data-dense", compact && "game-operation-dialog-compact", className)} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onClose={onClose} busy={busy} dirty={dirty} returnFocusRef={returnFocusRef} handleHistory>
    <div className="game-operation-dialog-inner">
      <header className="game-operation-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="game-operation-close" aria-label={t("Fermer la fenêtre")} onClick={close} disabled={busy} autoFocus><X aria-hidden="true" className="h-5 w-5" /></button>
      </header>
      <div className="game-operation-dialog-content">{children}</div>
    </div>
  </ModalDialog>;
}
