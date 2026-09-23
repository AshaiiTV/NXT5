import React, { useState } from "react";
import { AlertTriangle, BarChart3, Check, ChevronDown, Eye, EyeOff, Loader2, X } from "lucide-react";
import { cx, tone } from "../../app/helpers.js";
import "./core.css";

export function Badge({ children, tone: t = "slate", pulse = false, className = "", ...props }) {
  return (
    <span {...props} className={cx("nxt5-badge inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[0.68rem] font-semibold leading-4 whitespace-normal", tone(t), className)}>
      {pulse && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export function Surface({ children, className = "", delay = 0, glow = false }) {
  return (
    <div
      className={cx(
        "nxt5-panel nxt5-premium-panel nxt5-surface group relative max-w-full overflow-hidden border",
        glow && "nxt5-surface-emphasis",
        className
      )}
    >
      {glow && <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-fuchsia-100/25" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function Button({ children, icon: Icon, variant = "primary", className = "", disabled = false, ...props }) {
  const base = "nxt5-cyber-button nxt5-control inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-semibold leading-5 transition duration-200 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "nxt5-button-primary border",
    ghost: "nxt5-button-secondary border",
    danger: "nxt5-button-danger border",
  };
  return (
    <button disabled={disabled} className={cx(base, variants[variant], className)} {...props}>
      {Icon && <Icon aria-hidden="true" className={cx("h-4 w-4 shrink-0", Icon === Loader2 && "animate-spin")} />}
      {children}
    </button>
  );
}

export function TabNav({ items, activeId, onChange, label = "Sous-navigation", className = "", columns = "" }) {
  return (
    <div role="tablist" aria-label={label} className={cx("nxt5-tab-nav overflow-x-auto", className)}>
      <div className={cx("grid min-w-max grid-flow-col auto-cols-fr gap-1 sm:min-w-0", columns)}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(item.id)} className="nxt5-tab group relative flex min-h-12 min-w-max items-center justify-center gap-2 px-3 py-2.5 text-left sm:min-w-0">
            {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
            <span className="min-w-0"><span className="block whitespace-nowrap text-sm font-semibold">{item.label}</span>{item.description && <span className="nxt5-tab-description mt-0.5 block break-words text-xs font-normal">{item.description}</span>}</span>
            {item.meta !== undefined && <span className="nxt5-tab-count ml-auto shrink-0 px-2 py-0.5 text-xs tabular-nums">{item.meta}</span>}
          </button>;
        })}
      </div>
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon, disabled = false, ...inputProps }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && passwordVisible ? "text" : type;
  return (
    <label className="nxt5-field block">
      <span className="nxt5-field-label">{label}</span>
      <div className="nxt5-field-control relative">
        {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/75" />}
        <input {...inputProps} type={inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} disabled={disabled} className={cx("nxt5-input-shell nxt5-control w-full rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-60", Icon && "pl-10", isPassword && "pr-12")} />
        {isPassword && <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} disabled={disabled} aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={passwordVisible} className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-300 transition hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{passwordVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}</button>}
      </div>
    </label>
  );
}

export function TextAreaInput({ label, value, onChange, placeholder, icon: Icon, rows = 4, ...textareaProps }) {
  return (
    <label className="nxt5-field block">
      <span className="nxt5-field-label">{label}</span>
      <div className="nxt5-field-control relative">
        {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-cyan-200/75" />}
        <textarea {...textareaProps} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={cx("nxt5-input-shell nxt5-control w-full resize-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12", Icon && "pl-10")} />
      </div>
    </label>
  );
}

export function SelectInput({ label, value, onChange, children, disabled = false, ...selectProps }) {
  return (
    <label className="nxt5-field block">
      <span className="nxt5-field-label">{label}</span>
      <div className="nxt5-field-control relative">
        <select {...selectProps} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="nxt5-input-shell nxt5-control w-full appearance-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/65 focus:ring-4 focus:ring-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-45">
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
    </label>
  );
}

export function PremiumToggle({ checked, onChange, title, text }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="nxt5-toggle group flex w-full items-center justify-between gap-4 p-3 text-left transition">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{title}</span>
        {text && <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">{text}</span>}
      </span>
      <span aria-hidden="true" className="nxt5-toggle-track">
        <span className="nxt5-toggle-thumb" />
      </span>
    </button>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="nxt5-page-header">
      <div className="min-w-0">
        {eyebrow && <p className="nxt5-page-eyebrow">{eyebrow}</p>}
        <h2 className="nxt5-page-title">{title}</h2>
        {subtitle && <p className="nxt5-page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="nxt5-page-actions">{children}</div>}
    </div>
  );
}

export function ToastStack({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-4 z-[80] max-w-[calc(100vw-2rem)] space-y-3" aria-live="polite" aria-atomic="false">
      <React.Fragment>
        {toasts.map((toast) => (
          <div key={toast.id} className={cx("nxt5-enter-fast w-[min(92vw,380px)] max-w-full rounded-[1.25rem] border p-4 shadow-2xl backdrop-blur-xl", tone(toast.type || "cyan"))}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-white/10 p-2">{toast.type === "red" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 whitespace-pre-line text-sm leading-5 opacity-80">{toast.text}</p>}</div>
              <button type="button" aria-label="Fermer la notification" onClick={() => removeToast(toast.id)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"><X aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </React.Fragment>
    </div>
  );
}

export function EmptyState({ icon: Icon = BarChart3, title, text, action }) {
  return (
    <div className="relative flex min-h-[190px] flex-col items-center justify-center overflow-hidden rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.018] p-5 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(126deg,rgba(34,211,238,.05),transparent_38%,rgba(167,139,250,.04))]" />
      <div className="relative rounded-xl border border-white/10 bg-white/[0.05] p-3 text-cyan-100"><Icon className="h-5 w-5" /></div>
      <h3 className="relative mt-3 text-lg font-black text-white">{title}</h3>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ count = 4 }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div>;
}
