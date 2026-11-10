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

const LOGO = { src: "/assets/brand/prisme/nxt5-prisme-source.png", srcSet: "/assets/brand/prisme/nxt5-prisme-640.webp 640w, /assets/brand/prisme/nxt5-prisme-320.webp 320w", width: "1536", height: "432" };
const MONO = "/assets/brand/prisme/nxt5-prisme-mono-blanc.svg";
const ICON = { src: "/assets/brand/prisme/icon-512.png", width: "512", height: "512" };

export function BrandLogo({ compact = false, className = "" }) {
  useLanguage();
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <ResponsiveImage
        src={compact ? MONO : LOGO.src}
        sources={compact ? [] : [{ srcSet: LOGO.srcSet }]}
        sizes={compact ? "112px" : "(max-width: 639px) 220px, 300px"}
        alt="NXT5"
        width={LOGO.width}
        height={LOGO.height}
        loading="eager"
        decoding="async"
        className={cx(
          "object-contain",
          compact ? "h-12 w-28 object-left" : "h-16 w-auto max-w-[220px] sm:max-w-[300px]"
        )}
      />
    </div>
  );
}

export function Nxt5Wordmark({ className = "", sizes, loading = "lazy" }) {
  useLanguage();
  return <ResponsiveImage src={MONO} alt="NXT5" width={LOGO.width} height={LOGO.height} sizes={sizes} loading={loading} decoding="async" className={cx("object-contain", className)} />;
}

export function BrandIcon({ className = "h-12 w-12", loading = "lazy", alt = "NXT5" }) {
  useLanguage();
  return <ResponsiveImage src={ICON.src} alt={alt} width={ICON.width} height={ICON.height} loading={loading} decoding="async" className={cx("object-contain", className)} />;
}

export function TeamAvatar({ team, className = "h-12 w-12" }) {
  useLanguage();
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || t("Team")} className="h-full w-full object-cover" loading="lazy" decoding="async" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <BrandIcon className={className} loading="eager" />;
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
