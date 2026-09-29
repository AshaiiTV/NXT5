// Riot match-v5 `championName` values that differ from a champion's display name
// once punctuation is removed ("Wukong" -> "MonkeyKing", "Kai'Sa" -> "Kaisa"),
// plus lowercase inputs whose Riot casing cannot be guessed ("drmundo").
const RIOT_CHAMPION_NAMES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  fiddlesticks: "FiddleSticks",
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

/** Riot's internal champion name ("MonkeyKing"), whatever spelling was imported. */
export function canonicalChampionName(value) {
  const compact = String(value ?? "").trim().replace(/[^A-Za-z0-9]/g, "");
  return RIOT_CHAMPION_NAMES[compact.toLowerCase()] || compact;
}

/** Case-insensitive key shared by every spelling: "Wukong" and "MonkeyKing" give "monkeyking". */
export function championGroupKey(value) {
  return canonicalChampionName(value).toLowerCase();
}
