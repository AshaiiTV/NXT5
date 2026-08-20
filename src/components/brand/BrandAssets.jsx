import React, { useEffect, useState } from "react";
import { BarChart3, Crown, Settings, ShieldCheck, UserPlus, Users } from "lucide-react";
import { cx } from "../../app/helpers.js";

export function ResponsiveImage({ src, sources = [], alt, className = "", fetchPriority, ...props }) {
  const priorityProps = fetchPriority ? { fetchpriority: fetchPriority } : {};
  return (
    <picture>
      {sources.map((source) => <source key={source.srcSet} type={source.type || "image/webp"} media={source.media} srcSet={source.srcSet} />)}
      <img src={src} alt={alt} className={className} {...priorityProps} {...props} />
    </picture>
  );
}

export function BrandLogo({ compact = false, className = "" }) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <ResponsiveImage
        src="/assets/nxt5-logo.png"
        sources={[
          { srcSet: compact ? "/assets/nxt5-logo-320.webp" : "/assets/nxt5-logo-640.webp" },
        ]}
        alt="NXT5"
        width="1254"
        height="989"
        loading={compact ? "lazy" : "eager"}
        decoding="async"
        className={cx(
          "object-contain drop-shadow-[0_0_30px_rgba(34,211,238,.36)]",
          compact ? "h-12 w-28 object-left" : "h-16 w-auto max-w-[220px] sm:max-w-[300px]"
        )}
      />
    </div>
  );
}

export function Nxt5Wordmark({ className = "" }) {
  return <ResponsiveImage src="/assets/nxt5-wordmark.png?v=3" sources={[{ srcSet: "/assets/nxt5-wordmark-640.webp 640w, /assets/nxt5-wordmark-320.webp 320w" }]} alt="NXT5" width="1115" height="350" loading="lazy" decoding="async" className={cx("object-contain drop-shadow-[0_0_18px_rgba(34,211,238,.30)]", className)} />;
}

export function TeamAvatar({ team, className = "h-12 w-12" }) {
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || "Team"} className="h-full w-full object-cover" loading="lazy" decoding="async" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <ResponsiveImage src="/assets/nxt5-logo.png" sources={[{ srcSet: "/assets/nxt5-logo-320.webp 320w, /assets/nxt5-logo-640.webp 640w" }]} alt="NXT5" width="1254" height="989" loading="lazy" decoding="async" className={cx("object-contain object-left drop-shadow-[0_0_18px_rgba(34,211,238,.35)]", className)} />;
}

export function RoleIcon({ role, className = "h-7 w-7", lightweight = false }) {
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
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champ-select/global/default/svg/position-${key}.svg`,
    `https://raw.communitydragon.org/12.23/plugins/rcp-fe-lol-champ-select/global/default/svg/position-${key}.svg`,
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${key}.svg`,
  ];
  const source = sources[sourceIndex];
  if (!source) return <span className={cx("inline-flex items-center justify-center text-[0.62rem] font-black text-cyan-100", className)}>{roleKey}</span>;
  return <img src={source} alt={roleKey} className={cx("object-contain opacity-95 invert", !lightweight && "drop-shadow-[0_0_10px_rgba(96,165,250,.28)]", className)} loading="lazy" decoding="async" onError={() => setSourceIndex((index) => index + 1)} />;
}
