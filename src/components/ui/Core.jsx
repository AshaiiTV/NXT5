import React, { useState } from "react";
import { AlertTriangle, BarChart3, Check, ChevronDown, Eye, EyeOff, Loader2, X } from "lucide-react";
import { cx, tone } from "../../app/helpers.js";

export function Badge({ children, tone: t = "slate", pulse = false, className = "", ...props }) {
  return (
    <span {...props} className={cx("inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-left text-[0.64rem] font-black uppercase leading-4 tracking-[0.08em] whitespace-normal", tone(t), className)}>
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export function Surface({ children, className = "", delay = 0, glow = false }) {
  return (
    <div
      className={cx(
        "nxt5-panel nxt5-premium-panel group relative max-w-full overflow-hidden border border-cyan-200/18 p-4 backdrop-blur-2xl transition duration-300 sm:p-4",
        glow && "border-cyan-200/24 shadow-[0_0_26px_rgba(34,211,238,.075),0_18px_54px_rgba(0,0,0,.38)] hover:border-cyan-200/34",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-fuchsia-100/45" />
      <div className="pointer-events-none absolute bottom-0 left-5 z-[1] h-px w-20 bg-gradient-to-r from-cyan-300/55 to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function Button({ children, icon: Icon, variant = "primary", className = "", disabled = false, ...props }) {
  const base = "nxt5-cyber-button inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-black leading-5 transition duration-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "border border-cyan-100/36 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.32)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_46px_rgba(217,70,239,.28)]",
    ghost: "border border-cyan-100/16 bg-[#071221]/72 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.11] hover:text-white hover:shadow-[0_0_28px_rgba(34,211,238,.14)]",
    danger: "border border-rose-300/28 bg-rose-500/12 text-rose-100 hover:-translate-y-0.5 hover:bg-rose-500/18 hover:shadow-[0_0_28px_rgba(244,63,94,.14)]",
  };
  return (
    <button disabled={disabled} className={cx(base, variants[variant], className)} {...props}>
      {Icon && <Icon className={cx("h-4 w-4 shrink-0", Icon === Loader2 && "animate-spin")} />}
      {children}
    </button>
  );
}

export function TabNav({ items, activeId, onChange, label = "Sous-navigation", className = "", columns = "" }) {
  return (
    <div role="tablist" aria-label={label} className={cx("nxt5-tab-nav overflow-x-auto rounded-2xl border border-white/10 bg-[#050814]/84 p-1.5 shadow-[0_14px_38px_rgba(0,0,0,.20)] backdrop-blur-xl", className)}>
      <div className={cx("grid min-w-max grid-flow-col auto-cols-fr gap-1.5 sm:min-w-0", columns)}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(item.id)} className={cx("group relative flex min-h-12 min-w-[9rem] items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 sm:min-w-0", active ? "border-cyan-200/35 bg-gradient-to-r from-cyan-400/18 via-blue-500/12 to-fuchsia-500/14 text-white shadow-[0_0_24px_rgba(34,211,238,.12)]" : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.055] hover:text-white")}>
            <span className={cx("pointer-events-none absolute inset-x-4 bottom-0 h-0.5 origin-center bg-gradient-to-r from-cyan-200 via-blue-300 to-fuchsia-300 transition-transform duration-300", active ? "scale-x-100" : "scale-x-0")} />
            {Icon && <Icon className={cx("h-4 w-4 shrink-0 transition-colors duration-300", active ? "text-cyan-100" : "text-slate-500 group-hover:text-cyan-200")} />}
            <span className="min-w-0"><span className="block truncate text-xs font-black uppercase tracking-[0.1em]">{item.label}</span>{item.description && <span className={cx("mt-0.5 block truncate text-[0.6rem] font-semibold normal-case tracking-normal transition-colors", active ? "text-cyan-50/70" : "text-slate-500 group-hover:text-slate-300")}>{item.description}</span>}</span>
            {item.meta !== undefined && <span className={cx("ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[0.6rem] font-black transition-colors", active ? "bg-cyan-300/14 text-cyan-100" : "bg-white/[0.05] text-slate-500")}>{item.meta}</span>}
          </button>;
        })}
      </div>
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon, disabled = false }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && passwordVisible ? "text" : type;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/75" />}
        <input type={inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} disabled={disabled} className={cx("nxt5-input-shell w-full rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-60", Icon && "pl-10", isPassword && "pr-12")} />
        {isPassword && <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} disabled={disabled} aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
      </div>
    </label>
  );
}

export function TextAreaInput({ label, value, onChange, placeholder, icon: Icon, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-cyan-200/75" />}
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={cx("nxt5-input-shell w-full resize-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12", Icon && "pl-10")} />
      </div>
    </label>
  );
}

export function SelectInput({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="nxt5-input-shell w-full appearance-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/65 focus:ring-4 focus:ring-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-45">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
    </label>
  );
}

export function PremiumToggle({ checked, onChange, title, text }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cx("group flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition", checked ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-black/[0.18] hover:border-cyan-300/20 hover:bg-white/[0.045]")}>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{title}</span>
        {text && <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{text}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full border transition", checked ? "border-cyan-200/45 bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-white/[0.08]")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="nxt5-page-header mb-5 flex flex-col gap-3 border-b border-cyan-100/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2"><span className="h-px w-7 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-transparent" /><p className="text-[0.64rem] font-black uppercase tracking-[0.26em] text-cyan-100/80">{eyebrow}</p></div>
        <h2 className="nxt5-metal-text max-w-4xl break-words py-1 text-2xl font-black leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">{subtitle}</p>}
      </div>
      {children && <div className="flex w-full min-w-0 flex-wrap gap-2 xl:w-auto xl:justify-end">{children}</div>}
    </div>
  );
}

export function ToastStack({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-[80] space-y-3">
      <React.Fragment>
        {toasts.map((toast) => (
          <div key={toast.id} className={cx("nxt5-enter-fast w-[min(92vw,380px)] rounded-3xl border p-4 shadow-2xl backdrop-blur-xl", tone(toast.type || "cyan"))}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-white/10 p-2">{toast.type === "red" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 whitespace-pre-line text-sm leading-5 opacity-80">{toast.text}</p>}</div>
              <button onClick={() => removeToast(toast.id)} className="rounded-xl p-1.5 opacity-70 hover:bg-white/10 hover:opacity-100"><X className="h-4 w-4" /></button>
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
      <div className="absolute inset-0 bg-[linear-gradient(126deg,rgba(34,211,238,.10),transparent_38%,rgba(249,115,22,.06))]" />
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
