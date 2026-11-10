import React from "react";
import "./public-scene.css";
import GlassScene from "../../components/brand/GlassScene.jsx";

/** Page-specific atmosphere around the selected Prisme sculpture. */
export function PublicScene({ className = "", imageClassName = "", children }) {
  return <div className={`nxt5-public-scene ${className}`} aria-hidden="true">
    <div className="nxt5-public-scene-plane" />
    <div className="nxt5-public-scene-plane nxt5-public-scene-plane--edge" />
    <div className="nxt5-public-scene-horizon" />
    <GlassScene className={`nxt5-public-scene-glass ${imageClassName}`} />
    {children}
  </div>;
}
