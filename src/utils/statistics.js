import { importedGameSide } from "./imported-games.js";
import { t } from "../i18n/translate.js";

export function availableNumber(value) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function matchResult(match) {
  const value = String(match?.result || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["victoire", "win", "victory"].includes(value) ? 1 : ["defaite", "loss", "defeat"].includes(value) ? 0 : null;
}

export function resultSummary(matches = []) {
  const results = matches.map(matchResult);
  const known = results.filter((value) => value !== null).length;
  const wins = results.filter((value) => value === 1).length;
  return { games: matches.length, known, wins, losses: known - wins, unknown: matches.length - known, winrate: known ? wins / known * 100 : null };
}

export const winrateLabel = (value) => Number.isFinite(value) ? `${Math.round(value)}%` : "—";
export const sideLabel = (side) => side === "blue" ? t("Côté bleu") : side === "red" ? t("Côté rouge") : "—";
export const matchSideLabel = (match) => sideLabel(importedGameSide(match));
export const resultLabel = ({ wins, losses, unknown }) => [
  t(wins > 1 ? "{0} victoires" : "{0} victoire", [wins]),
  t(losses > 1 ? "{0} défaites" : "{0} défaite", [losses]),
  unknown ? t(unknown > 1 ? "{0} résultats indisponibles" : "{0} résultat indisponible", [unknown]) : null,
].filter(Boolean).join(" · ");

export function sideResults(matches) {
  return ["blue", "red"].map((side) => ({ side, ...resultSummary(matches.filter((match) => importedGameSide(match) === side)) }));
}

// Product threshold: three known results on EACH side; this is not statistical significance.
export function comparableSides(sides) {
  return sides.length === 2 && sides.every((side) => side.known >= 3);
}
