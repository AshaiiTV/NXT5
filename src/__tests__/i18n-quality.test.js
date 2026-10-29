import { describe, expect, it } from "vitest";
import { en, es } from "../i18n/quality-overrides.js";

describe("reviewed game terminology", () => {
  it.each(['Draft', 'Riot', 'Riot Games', 'Windows', 'Apple', 'Google', 'Discord', 'League of Legends', 'NXT5 Importer'])("preserves the product name %s", brand => {
    expect(en[brand]).toBe(brand);
    expect(es[brand]).toBe(brand);
  });

  it("uses game terminology while distinguishing figurative French and keeping technical text out", () => {
    expect(es['Rechercher une partie']).toBe('Buscar una partida');
    expect(es['{0} parties reçues sur {1}']).toBe('{0} partidas recibidas de {1}');
    expect(es["Le rôle porte déjà une grosse partie de l'identité : l'objectif devient la répétition consciente du plan."]).toContain('buena parte de la identidad');
    expect(Object.keys(es).some(source => /^(?:select|update|insert|delete)\b|^\[data-/i.test(source))).toBe(false);
  });

  it("keeps every dynamic placeholder intact", () => {
    const placeholders = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
    for (const [source, translated] of Object.entries(es)) expect(placeholders(translated), source).toEqual(placeholders(source));
  });
});
