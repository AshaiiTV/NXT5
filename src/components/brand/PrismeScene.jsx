import React from "react";
import "./prisme-scene.css";
// Static, exact selected material: no former glyph or WebGL dependency.
export default function PrismeScene({ className = "", posterClassName = "", signature = false }) {
  return <div className={`nxt5-prisme-scene ${className}`} aria-hidden="true">
    <img className={`nxt5-prisme-poster ${posterClassName}`}
      src={signature ? "/assets/brand/prisme/nxt5-prisme-1280.webp" : "/assets/brand/prisme/nxt5-prisme-5-512.webp"}
      srcSet={signature ? "/assets/brand/prisme/nxt5-prisme-640.webp 640w, /assets/brand/prisme/nxt5-prisme-1280.webp 1280w" : "/assets/brand/prisme/nxt5-prisme-5-256.webp 256w, /assets/brand/prisme/nxt5-prisme-5-512.webp 512w"}
      sizes={signature ? "(max-width: 760px) 92vw, 54vw" : "(max-width: 760px) 60vw, 440px"}
      width={signature ? 1536 : 512} height={signature ? 432 : 512} alt="" decoding="async" draggable="false" />
  </div>;
}
