import React from "react";
import "./public-scene.css";

/** Static composition using the exact sculpture and atmosphere from the home hero. */
export function PublicScene({ className = "", imageClassName = "", children }) {
  return <div className={`nxt5-public-scene ${className}`} aria-hidden="true">
    <div className="nxt5-public-scene-plane" />
    <div className="nxt5-public-scene-plane nxt5-public-scene-plane--edge" />
    <div className="nxt5-public-scene-horizon" />
    <img className={`nxt5-public-scene-glass ${imageClassName}`} src="/assets/home-motion/glass-poster.webp" width="729" height="665" alt="" decoding="async" draggable="false" />
    {children}
  </div>;
}
