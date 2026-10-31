import { canonicalChampion } from "./champions.js";

// One catalogue for composition options, style analysis and server validation.
export function knownChampionId(value) {
  if (typeof value !== "string") return "";
  return championIdsByKey.get(canonicalChampion(value).toLowerCase()) || "";
}

export const CHAMPION_STYLE_TAGS = {
  Aatrox: ["bruiser", "teamfight"], Ahri: ["pick", "tempo"], Akali: ["assassin", "side"], Alistar: ["engage", "peel"], Amumu: ["engage", "teamfight"], Anivia: ["control", "scaling"], Annie: ["burst", "engage"], Aphelios: ["scaling", "front-to-back"], Ashe: ["utility", "pick"], AurelionSol: ["scaling", "control"], Azir: ["scaling", "front-to-back"],
  Bard: ["roam", "pick"], Blitzcrank: ["pick", "engage"], Brand: ["poke", "teamfight"], Braum: ["peel", "front-to-back"], Caitlyn: ["lane", "siege"], Camille: ["side", "pick"], Cassiopeia: ["scaling", "front-to-back"], Chogath: ["frontline", "objective"], Corki: ["poke", "scaling"],
  Darius: ["bruiser", "lane"], Diana: ["engage", "burst"], DrMundo: ["frontline", "scaling"], Draven: ["lane", "snowball"], Ekko: ["assassin", "side"], Elise: ["early", "dive"], Evelynn: ["pick", "assassin"], Ezreal: ["poke", "safe"], Fiddlesticks: ["engage", "teamfight"], Fiora: ["side", "duel"], Fizz: ["assassin", "pick"],
  Galio: ["engage", "cover"], Gangplank: ["scaling", "teamfight"], Garen: ["bruiser", "simple"], Gnar: ["teamfight", "side"], Gragas: ["engage", "disengage"], Graves: ["tempo", "skirmish"], Gwen: ["scaling", "side"], Hecarim: ["engage", "tempo"], Heimerdinger: ["control", "siege"], Hwei: ["control", "poke"],
  Irelia: ["side", "snowball"], Ivern: ["utility", "peel"], Janna: ["peel", "disengage"], JarvanIV: ["engage", "early"], Jax: ["side", "scaling"], Jayce: ["poke", "lane"], Jhin: ["utility", "pick"], Jinx: ["scaling", "front-to-back"], Kaisa: ["dive", "scaling"], Kalista: ["lane", "objective"], Karma: ["poke", "tempo"], Karthus: ["scaling", "farm"], Kassadin: ["scaling", "side"], Katarina: ["reset", "snowball"], Kayle: ["scaling", "front-to-back"], Kayn: ["tempo", "skirmish"], Kennen: ["engage", "teamfight"], Khazix: ["pick", "assassin"], Kindred: ["tempo", "scaling"], Kled: ["engage", "snowball"], KogMaw: ["scaling", "front-to-back"], KSante: ["frontline", "side"],
  LeBlanc: ["pick", "poke"], LeeSin: ["early", "playmaker"], Leona: ["engage", "lane"], Lillia: ["tempo", "teamfight"], Lissandra: ["engage", "lockdown"], Lucian: ["lane", "tempo"], Lulu: ["peel", "scaling"], Lux: ["poke", "pick"], Malphite: ["engage", "teamfight"], Malzahar: ["lockdown", "pick"], Maokai: ["engage", "vision"], MasterYi: ["scaling", "reset"], Milio: ["peel", "scaling"], MissFortune: ["teamfight", "lane"], MonkeyKing: ["engage", "teamfight"], Mordekaiser: ["frontline", "side"], Morgana: ["pick", "control"], Nami: ["lane", "utility"], Nasus: ["scaling", "side"], Nautilus: ["engage", "pick"], Neeko: ["engage", "teamfight"], Nidalee: ["tempo", "poke"], Nilah: ["dive", "teamfight"], Nocturne: ["dive", "pick"], Nunu: ["objective", "gank"], Olaf: ["bruiser", "tempo"], Orianna: ["control", "teamfight"], Ornn: ["frontline", "scaling"], Pantheon: ["early", "pick"], Poppy: ["disengage", "frontline"], Pyke: ["pick", "roam"], Qiyana: ["assassin", "teamfight"], Quinn: ["side", "lane"], Rakan: ["engage", "roam"], Rammus: ["engage", "frontline"], RekSai: ["early", "dive"], Rell: ["engage", "teamfight"], Renata: ["disengage", "teamfight"], Renekton: ["lane", "early"], Rengar: ["assassin", "pick"], Riven: ["side", "snowball"], Rumble: ["teamfight", "lane"], Ryze: ["side", "scaling"], Samira: ["dive", "reset"], Sejuani: ["engage", "frontline"], Senna: ["scaling", "utility"], Seraphine: ["teamfight", "scaling"], Sett: ["frontline", "engage"], Shen: ["side", "cover"], Shyvana: ["farm", "teamfight"], Singed: ["side", "disrupt"], Sion: ["frontline", "engage"], Sivir: ["waveclear", "front-to-back"], Skarner: ["pick", "frontline"], Smolder: ["scaling", "front-to-back"], Sona: ["scaling", "teamfight"], Soraka: ["peel", "sustain"], Swain: ["teamfight", "frontline"], Sylas: ["skirmish", "pick"], Syndra: ["burst", "control"], TahmKench: ["peel", "frontline"], Taliyah: ["control", "roam"], Talon: ["roam", "assassin"], Taric: ["peel", "teamfight"], Teemo: ["side", "control"], Thresh: ["pick", "peel"], Tristana: ["lane", "siege"], Trundle: ["frontline", "objective"], Tryndamere: ["side", "scaling"], TwistedFate: ["roam", "pick"], Twitch: ["scaling", "flank"], Udyr: ["tempo", "frontline"], Urgot: ["bruiser", "frontline"], Varus: ["poke", "pick"], Vayne: ["scaling", "duel"], Veigar: ["scaling", "control"], Velkoz: ["poke", "control"], Vex: ["burst", "anti-dive"], Vi: ["dive", "lockdown"], Viego: ["reset", "skirmish"], Viktor: ["control", "scaling"], Vladimir: ["scaling", "teamfight"], Volibear: ["dive", "early"], Warwick: ["early", "skirmish"], Xayah: ["self-peel", "front-to-back"], Xerath: ["poke", "siege"], XinZhao: ["early", "dive"], Yasuo: ["skirmish", "teamfight"], Yone: ["side", "teamfight"], Yorick: ["side", "siege"], Yuumi: ["scaling", "attach"], Zac: ["engage", "teamfight"], Zed: ["assassin", "side"], Zeri: ["scaling", "teamfight"], Ziggs: ["poke", "siege"], Zilean: ["utility", "scaling"], Zoe: ["poke", "pick"], Zyra: ["poke", "control"],
};

export const ADDITIONAL_CHAMPION_STYLE_TAGS = {
  Akshan: ["roam", "reset"],
  Ambessa: ["dive", "skirmish"],
  Aurora: ["teamfight", "side"],
  Belveth: ["scaling", "skirmish"],
  Briar: ["dive", "snowball"],
  Illaoi: ["side", "teamfight"],
  Leblanc: ["pick", "poke"],
  Locke: ["assassin", "burst"],
  Mel: ["control", "poke"],
  Naafiri: ["assassin", "dive"],
  Shaco: ["pick", "assassin"],
  Yunara: ["scaling", "front-to-back"],
  Zaahen: ["bruiser", "dive"],
};

export const ALL_CHAMPION_STYLE_TAGS = {
  ...CHAMPION_STYLE_TAGS,
  ...ADDITIONAL_CHAMPION_STYLE_TAGS,
};

export const CHAMPION_IDS = Object.freeze([...new Set(Object.keys(ALL_CHAMPION_STYLE_TAGS).map(canonicalChampion))]);
const championIdsByKey = new Map(CHAMPION_IDS.map(id => [id.toLowerCase(), id]));
