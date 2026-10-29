export const CHAMPION_ASSET_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  fiddlesticks: "Fiddlesticks",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  viego: "Viego",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

/** Case- and punctuation-insensitive key of a champion name ("Kai'Sa" → "kaisa"), aliases not applied. */
export function championNameKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalChampion(value) {
  const raw = String(value || "").trim();
  return CHAMPION_ASSET_ALIASES[championNameKey(raw)] || raw.replace(/[^A-Za-z0-9]/g, "");
}

/** Human-readable names shared by the interface and canvas exports. */
export function championDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const names = {
    AurelionSol: "Aurelion Sol", Chogath: "Cho'Gath", DrMundo: "Dr. Mundo",
    JarvanIV: "Jarvan IV", Kaisa: "Kai'Sa", Khazix: "Kha'Zix", KogMaw: "Kog'Maw",
    KSante: "K'Sante", Leblanc: "LeBlanc", LeeSin: "Lee Sin", MasterYi: "Master Yi",
    MissFortune: "Miss Fortune", MonkeyKing: "Wukong", Nunu: "Nunu & Willump",
    RekSai: "Rek'Sai", TahmKench: "Tahm Kench", TwistedFate: "Twisted Fate",
    Velkoz: "Vel'Koz", XinZhao: "Xin Zhao",
  };
  return names[canonicalChampion(raw)] || raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}
