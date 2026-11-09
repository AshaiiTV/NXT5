import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useEffect, useState } from "react";
import { BarChart3, Crown, Settings, ShieldCheck, UserPlus, Users } from "lucide-react";
import { cx } from "../../app/helpers.js";
import "./brand.css";

export function ResponsiveImage({ src, sources = [], alt, className = "", fetchPriority, sizes, ...props }) {
  useLanguage();
  const priorityProps = fetchPriority ? { fetchPriority } : {};
  return (
    <picture>
      {sources.map((source) => <source key={source.srcSet} type={source.type || "image/webp"} media={source.media} srcSet={source.srcSet} sizes={source.sizes || sizes} />)}
      <img src={src} alt={alt} className={className} sizes={sizes} {...priorityProps} {...props} />
    </picture>
  );
}

// Logo NXT5 « verre » : NXT en verre dépoli, 5 en cristal violet (outil : tools/logo-verre).
const LOGO = { src: "/assets/brand/nxt5-logo.png", srcSet: "/assets/brand/nxt5-logo-640.webp 640w, /assets/brand/nxt5-logo-320.webp 320w", width: "1280", height: "461" };
// Icône : le 5 gravé dans une tuile de verre fumé, pour les petites tailles et l’emblème d’équipe par défaut.
const ICON = { src: "/assets/brand/nxt5-icone-512.png", srcSet: "/assets/brand/nxt5-icone-256.webp", width: "512", height: "529" };

export function BrandLogo({ compact = false, className = "" }) {
  useLanguage();
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <ResponsiveImage
        src={LOGO.src}
        sources={[{ srcSet: LOGO.srcSet }]}
        sizes={compact ? "112px" : "(max-width: 639px) 220px, 300px"}
        alt="NXT5"
        width={LOGO.width}
        height={LOGO.height}
        loading={compact ? "lazy" : "eager"}
        decoding="async"
        className={cx(
          "object-contain drop-shadow-[0_0_24px_rgba(139,92,246,.28)]",
          compact ? "h-12 w-28 object-left" : "h-16 w-auto max-w-[220px] sm:max-w-[300px]"
        )}
      />
    </div>
  );
}

export function Nxt5Wordmark({ className = "", sizes, loading = "lazy" }) {
  useLanguage();
  return <ResponsiveImage src={LOGO.src} sources={[{ srcSet: LOGO.srcSet }]} alt="NXT5" width={LOGO.width} height={LOGO.height} sizes={sizes} loading={loading} decoding="async" className={cx("object-contain drop-shadow-[0_0_18px_rgba(139,92,246,.26)]", className)} />;
}

export function BrandIcon({ className = "h-12 w-12", loading = "lazy", alt = "NXT5" }) {
  useLanguage();
  return <ResponsiveImage src={ICON.src} sources={[{ srcSet: ICON.srcSet }]} alt={alt} width={ICON.width} height={ICON.height} loading={loading} decoding="async" className={cx("object-contain", className)} />;
}

export function TeamAvatar({ team, className = "h-12 w-12" }) {
  useLanguage();
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || t("Team")} className="h-full w-full object-cover" loading="lazy" decoding="async" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <BrandIcon className={className} />;
}

export function RoleIcon({ role, className = "h-7 w-7", lightweight = false }) {
  useLanguage();
  const roleKey = String(role || "").toUpperCase();
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [roleKey]);
  const staffIcon = {
    COACH: ShieldCheck,
    ASSISTANT: Users,
    ANALYST: BarChart3,
    MANAGER: Settings,
    BOARD: Crown,
    OWNER: Crown,
    CAPTAIN: ShieldCheck,
    STAFF: ShieldCheck,
    SUB: UserPlus,
  }[roleKey];
  if (staffIcon) {
    const Icon = staffIcon;
    return <Icon className={cx("text-cyan-100", className)} />;
  }
  const key = { TOP: "top", JGL: "jungle", MID: "middle", ADC: "bottom", SUP: "utility" }[roleKey];
  if (!key) return <Users className={cx("text-slate-300", className)} />;
  const sources = [
    `/assets/roles/position-${key}.svg`,
  ];
  const source = sources[sourceIndex];
  if (!source) return <span className={cx("inline-flex items-center justify-center text-[0.62rem] font-black text-cyan-100", className)}>{roleKey}</span>;
  return <img src={source} alt={roleKey} className={cx("nxt5-role-icon object-contain", className)} loading="lazy" decoding="async" onError={() => setSourceIndex((index) => index + 1)} />;
}
