// TutoDiscord's own schematic cards (its `views`, TutoDiscord.tsx) for the Discord side of the journey: the bot's
// authorisation, /nxt lier and the bot's private replies, /nxt connecter, the test message and the published game in
// #résultats, the game visual. Real Discord screenshots could not be taken, so these are illustrations in the NXT5
// charte, like the Importer's schematics (src/tuto/shots/Schematics.tsx): night, violet glass, Inter, lucide icons, cyan
// accents, tagged « Illustration ». They do not imitate Discord: no logo, wordmark, blurple or Discord font, no server
// rail or channel list, no « APP » / « BOT » badge, ephemeral wording or command picker. A neutral chat panel stands for
// the channel (context and channel chips, messages with an avatar and a name, a composer); the bot is « NXT5 » with the
// NXT5 emblem, the coach an initial avatar. A bot message is drawn like NXT5's own preview of a Discord message
// (src/components/discord/discord-shared.jsx DiscordPreview and discord.css): surface card with a cyan left edge (the
// bot's embed colour, #67E8F9), footer, link buttons with their external-link icon; NXT5 buttons (2 px radius, primary
// gradient). A private reply carries the schematic's own neutral note « Réponse privée : visible seulement par toi »,
// the coach's command « Commande : visible seulement par toi » (a command is not posted to the channel, and NXT5 answers
// every command privately). Only texts produced by NXT5 are quoted, verbatim (source next to each); names come from
// capture/discord/names.json and the posted messages from the payloads the repository's code renders
// (capture/discord/fixtures), so they match the site captures. Content the schematic does not know (other members'
// messages, the footer's technical reference) is drawn as neutral skeleton bars.
//
// Layout is computed, not measured: each message has a known height (fixed line heights, lines broken here), so the
// chat stacks and scrolls like a chat (bottom-anchored, a new message slides in and pushes the others up) and the
// cursor aims at the very buttons drawn. Frames are local; the beats come from the shot (t, clicks, keys, typing in
// script.ts), every cursor glide ends 8 f before its click, and each click's ripple stays on the control clicked.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import names from '../../capture/discord/names.json';
import previewPayload from '../../capture/discord/fixtures/payload-preview.json';
import testPayload from '../../capture/discord/fixtures/payload-test.json';
import { CAM_EASE } from '../tuto/camera';
import type { CardShot, Click, Move, Pt, Rect } from '../tuto/engine';
import { frSpaces } from '../tuto/engine';
import { TutoBackdrop } from '../tuto/parts/Backdrop';
import { CursorArrow, cursorOpacity, cursorPoint, pressAt, Ripple } from '../tuto/parts/Cursor';
import { Emblem, IconTile, Panel, Skel, Txt } from '../tuto/parts/Glass';
import { Halo, Ring } from '../tuto/parts/Halo';
import { Icon } from '../tuto/parts/icons';
import { areaMask } from '../tuto/parts/Stage';
import { KeycapHint } from '../tuto/parts/Typing';
import { AREA, AREA_H, BRAND, COL, IO, lerp, ramp, TOP } from '../tuto/style';
import { FONT, PRIMARY_GRADIENT } from '../theme';

// ───────────────────────── texts (verbatim) ─────────────────────────
/** netlify/functions/_lib/discord-bot-account.ts:15-17 (beginDiscordAccountLink): private reply to /nxt lier. */
const LINK_REQUEST = {
  title: 'Lier ton compte NXT5',
  description: '1. Ouvre NXT5 et confirme ton compte.\n2. Reviens ici et vérifie la liaison.\n3. Confirme le compte affiché dans Discord.\n\nCe lien personnel expire dans 10 minutes. Il ne rejoint aucune équipe.',
};
/** discord-bot-account.ts:28-30 (reviewDiscordAccountLink): new private message on « Vérifier la liaison » (botText
 * names in bold). */
const LINK_REVIEW = {
  title: 'Vérifie les deux comptes',
  description: 'Discord : **' + names.ownerDiscordName + '**\nCompte NXT5 : **' + names.nxt5AccountName + '**\n\nConfirme uniquement si ces deux comptes sont les tiens.',
};
/** discord-bot-account.ts:61 (finishDiscordAccountLink): new private message on « Confirmer la liaison ». */
const LINKED = { title: 'Compte lié', description: 'Va dans le salon de commandes de ton équipe, puis utilise `/nxt voir`. Tes droits restent ceux de ton compte NXT5.' };
/** netlify/functions/discord-interactions.ts:103: private reply to /nxt connecter (plain text, no embed). */
const CONNECTED = 'Serveur relié à cette équipe NXT5. Retourne dans Bot Discord pour choisir son salon de commandes et ses salons de publication. Les autres équipes du serveur conservent leurs réglages.';
/** shared/discord-command.js:105 and :113: descriptions of the two /nxt subcommands typed in the film. */
const CMD_LIER = { name: '/nxt lier', description: 'Associer ton compte Discord à NXT5.' };
const CMD_CONNECT = { name: '/nxt connecter', description: 'Relier une équipe NXT5 à ce serveur.' };
/** src/components/discord/DiscordSettings.jsx:184: the site's own sentence on the « Administrateur » permission. */
const ADMIN_LINE = 'Elle donne tous les droits au bot, y compris dans les salons privés.';
/** The two messages the bot posts in #résultats (capture/discord/render-payloads.cjs, the repository's own code):
 * netlify/functions/_lib/discord-test.ts (test) and discord-client.ts buildDiscordMessage (the game). Their images are
 * the PNGs the bot attaches (fixtures/payload-*.png, copied to public/tuto-discord/). */
const TEST_MSG = testPayload.message;
const GAME_MSG = previewPayload.message;
const TEST_PNG = 'tuto-discord/payload-test.png';
const GAME_PNG = 'tuto-discord/payload-preview.png';

/** Breaks a verbatim text into display lines before each marker (a soft wrap: the lines joined by spaces give the text
 * back). */
const wrapBefore = (text: string, at: string[]) => {
  const out: string[] = [];
  let rest = text;
  for (const m of at) {
    const i = rest.indexOf(m);
    if (i <= 0) throw new Error(`coupure « ${m} » introuvable`);
    out.push(rest.slice(0, i).trimEnd());
    rest = rest.slice(i);
  }
  return [...out, rest];
};

// ───────────────────────── small parts ─────────────────────────
/** Three lucide icons the engine set does not have (same stroke conventions as parts/icons.tsx). */
const PATHS = {
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  externalLink: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
};
const LIcon: React.FC<{ name: keyof typeof PATHS; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    {PATHS[name]}
  </svg>
);

const id = (p: unknown) => p as Pt;
/** Panel entrance shared by the schematics: rise + fade over 14 f. */
const useIn = (f: number, at = 0) => ramp(f, at, at + 14, BRAND);
const abs = (r: Rect): React.CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h });
/** Glide of the cursor onto a target, arriving 8 f before the click. */
const onto = (c: Click, to: Pt, dur = 18): Move => ({ f: c.f - 8 - dur, dur, to });
/** Point of a rect (fractions of its size). */
const at = (r: Rect, ax: number, ay: number): Pt => [r.x + r.w * ax, r.y + r.h * ay];

/** Check badge popping in (success). */
const CheckPop: React.FC<{ f: number; at: number; size?: number }> = ({ f, at: a0, size = 30 }) => {
  const a = ramp(f, a0, a0 + 10, BRAND);
  if (a <= 0) return null;
  return (
    <div style={{ width: size * 1.35, height: size * 1.35, borderRadius: '50%', background: COL.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: a, transform: `scale(${lerp(0.85, 1, a)})`, flexShrink: 0 }}>
      <Icon name="check" size={size * 0.9} color={COL.onAccent} stroke={3} />
    </div>
  );
};

/** Bold (**…**, as the bot writes names) and inline code (`…`) of the bot's texts, French spacing applied. */
const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {frSpaces(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, i) => {
      if (p.startsWith('**')) return <span key={i} style={{ fontWeight: 700, color: COL.text }}>{p.slice(2, -2)}</span>;
      if (p.startsWith('`')) return <span key={i} style={{ fontWeight: 600, color: COL.fileText, background: 'rgba(167,139,250,.16)', borderRadius: 6, padding: '1px 6px', marginRight: -2 }}>{p.slice(1, -1)}</span>;
      return <span key={i}>{p}</span>;
    })}
  </>
);

/** Cursor of a schematic: screen points, or points of a zoomed layer mapped by its camera (`map`). Each ripple stays
 * on the control clicked (the arrow glides back to the margin a few frames after a click; the ring must not follow):
 * at the click point, moved by `drift` (how far that control has moved since the click, e.g. pushed up the chat by an
 * arriving message). */
const SchemCursor: React.FC<{ f: number; start: Pt; moves: Move[]; clicks: Click[]; show: number; hide?: number; map?: (p: Pt) => Pt; drift?: (c: Click) => Pt }> = ({ f, start, moves, clicks, show, hide, map, drift }) => {
  const m = map ?? ((q: Pt) => q);
  const [x, y] = m(cursorPoint(start, moves, f, id));
  return (
    <>
      {clicks.map((c) => {
        const [px, py] = cursorPoint(start, moves, c.f, id);
        const [dx, dy] = drift?.(c) ?? [0, 0];
        const [cx, cy] = m([px + dx, py + dy]);
        return <Ripple key={c.f} x={cx} y={cy} t={f - c.f} />;
      })}
      <CursorArrow x={x} y={y} size={46} press={pressAt(clicks, f)} opacity={cursorOpacity(f, show, hide)} />
    </>
  );
};

/** Halos stay inside the working area (a spotlight dims the area only, as on the captures). */
const HaloLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...areaMask({ x: 0, y: AREA.top, w: 1920, h: AREA_H }) }}>{children}</div>
);

// ───────────────────────── schematic camera ─────────────────────────
/** A calm zoom over a schematic (no capture: the layer is scaled, so its texts and images stay sharp). `at`: layout
 * point placed at the centre of the working area; z 1 at the area's centre is the identity. Keys eased with IO, zoom
 * interpolated in log space (as camera.ts). */
type SCam = { f: number; z: number; at: Pt };
const HOME: Pt = [AREA.cx, AREA.cy];
const sCamAt = (keys: SCam[], f: number): SCam => {
  if (f <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f < b.f) {
      const t = ramp(f, a.f, b.f, IO);
      return { f, z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), t)), at: [lerp(a.at[0], b.at[0], t), lerp(a.at[1], b.at[1], t)] };
    }
  }
  return keys[keys.length - 1];
};
const mapPt = (c: SCam, [x, y]: Pt): Pt => [AREA.cx + (x - c.at[0]) * c.z, AREA.cy + (y - c.at[1]) * c.z];
const mapRect = (c: SCam, r: Rect): Rect => {
  const [x, y] = mapPt(c, [r.x, r.y]);
  return { x, y, w: r.w * c.z, h: r.h * c.z };
};
/** The zoomed layer, clipped to the working area once it outgrows it (Stage.tsx areaMask, soft edges). */
const CamLayer: React.FC<{ cam: SCam; frame: Rect; children: React.ReactNode }> = ({ cam, frame, children }) => (
  <div style={{ position: 'absolute', inset: 0, ...areaMask(mapRect(cam, frame)) }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${AREA.cx - cam.at[0] * cam.z}px, ${AREA.cy - cam.at[1] * cam.z}px) scale(${cam.z})` }}>
      {children}
    </div>
  </div>
);

// ───────────────────────── chat: geometry ─────────────────────────
/** Chat panel: header (context and channel chips), messages, composer. */
const CP = { x: 260, y: 128, w: 1400, h: 710 };
const HEAD = 76;
const VP = { x: CP.x + 36, top: CP.y + HEAD + 12, w: CP.w - 72 };
const COMPOSER: Rect = { x: CP.x + 36, y: CP.y + CP.h - 24 - 68, w: CP.w - 72, h: 68 };
const vpBottom = (composer: boolean) => (composer ? COMPOSER.y - 22 : CP.y + CP.h - 24);
/** Neutral margin right of the chat panel, where the cursor waits while a message is read. */
const REST: Pt = [1748, 520];

/** Message: avatar, name row, then text lines, an embed (title, lines, image, footer) and buttons. */
const M = { av: 60, col: 84, name: 40, nameGap: 10, line: 38, blank: 14, gap: 22, font: 28 };
const E = { w: 1040, padX: 24, padY: 18, edge: 4, title: 42, titleGap: 10, imgGap: 14, footGap: 10, foot: 30, textGap: 12 };
const B = { h: 58, gap: 16, top: 14 };

type BtnSpec = { label: string; w: number; kind: 'primary' | 'secondary' | 'link' };
type EmbedSpec = { title: string; lines: string[]; image?: { src: string; w: number; h: number }; footer?: boolean };
type MsgSpec =
  | { who: 'member'; bars: number[] }
  | { who: 'coach'; command: string; priv?: boolean }
  | { who: 'bot'; priv?: boolean; text?: string[]; embed?: EmbedSpec; buttons?: BtnSpec[] };
type MsgLayout = { h: number; textLines: Rect[]; embed?: Rect; title?: Rect; lines: Rect[]; image?: Rect; footer?: Rect; buttons: Rect[] };

/** Positions inside a message (relative to its top-left corner, the avatar's). */
const layoutMsg = (s: MsgSpec): MsgLayout => {
  const L: MsgLayout = { h: 0, textLines: [], lines: [], buttons: [] };
  let y = M.name + M.nameGap;
  const textW = VP.w - M.col;
  if (s.who === 'member') return { ...L, h: y + s.bars.length * M.line };
  if (s.who === 'coach') return { ...L, textLines: [{ x: M.col, y, w: textW, h: M.line }], h: y + M.line };
  for (const _ of s.text ?? []) {
    L.textLines.push({ x: M.col, y, w: textW, h: M.line });
    y += M.line;
  }
  if (s.embed) {
    const e = s.embed;
    if (s.text?.length) y += E.textGap;
    const w = e.image ? e.image.w + 2 * E.padX + E.edge : E.w;
    const x0 = M.col + E.edge + E.padX;
    const inner = w - E.edge - 2 * E.padX;
    const top = y;
    y += E.padY;
    L.title = { x: x0, y, w: inner, h: E.title };
    y += E.title + E.titleGap;
    for (const l of e.lines) {
      const h = l === '' ? M.blank : M.line;
      L.lines.push({ x: x0, y, w: inner, h });
      y += h;
    }
    if (e.image) {
      y += E.imgGap;
      L.image = { x: x0, y, w: e.image.w, h: e.image.h };
      y += e.image.h;
    }
    if (e.footer) {
      y += E.footGap;
      L.footer = { x: x0, y, w: inner, h: E.foot };
      y += E.foot;
    }
    y += E.padY;
    L.embed = { x: M.col, y: top, w, h: y - top };
  }
  if (s.buttons?.length) {
    y += B.top;
    let x = M.col;
    for (const b of s.buttons) {
      L.buttons.push({ x, y, w: b.w, h: B.h });
      x += b.w + B.gap;
    }
    y += B.h;
  }
  return { ...L, h: y };
};

type Item = { key: string; at: number; spec: MsgSpec };
/** `headA`: opacity of a message's head (avatar, name row and text lines above its embed), faded out by a view, e.g.
 * before a zoom slides it off the area. */
type Placed = Item & { lay: MsgLayout; top: number; a: number; headA?: number };
/** Frames over which an arriving message scrolls the chat up. */
const SCROLL = 14;
/** Bottom-anchored chat at frame f: the messages already posted, their layout, top (screen y) and opacity. An arriving
 * message starts entirely below the viewport bottom and the column rises by its height (IO, SCROLL f), pushing the
 * older ones up. */
const placeChat = (items: Item[], f: number, bottom: number): Placed[] => {
  const shown = items.filter((m) => f >= m.at).map((m) => ({ ...m, lay: layoutMsg(m.spec) }));
  let y = bottom;
  for (const m of shown) y += (1 - ramp(f, m.at, m.at + SCROLL, IO)) * (m.lay.h + M.gap);
  const out: Placed[] = [];
  for (let i = shown.length - 1; i >= 0; i--) {
    const m = shown[i];
    y -= m.lay.h;
    out[i] = { ...m, top: y, a: ramp(f, m.at, m.at + 10) };
    y -= M.gap;
  }
  return out;
};
/** Screen rect of a part of a message (`pick` from its layout), in the chat as placed by placeChat. */
const rectIn = (placed: Placed[], key: string, pick: (l: MsgLayout) => Rect | undefined): Rect => {
  const m = placed.find((p) => p.key === key);
  const r = m && pick(m.lay);
  if (!m || !r) throw new Error(`message ${key} : cible absente`);
  return { x: VP.x + r.x, y: m.top + r.y, w: r.w, h: r.h };
};
/** How far message `key` has moved since frame f0 (the chat scrolls as messages arrive). */
const driftOf = (items: Item[], placed: Placed[], key: string, f0: number, bottom: number): Pt => {
  const top = (p: Placed[]) => p.find((m) => m.key === key)?.top ?? 0;
  return [0, top(placed) - top(placeChat(items, f0, bottom))];
};
/** Screen rect of a whole message (avatar to its widest part), for a spotlight. */
const msgRect = (placed: Placed[], key: string): Rect => {
  const m = placed.find((p) => p.key === key);
  if (!m) throw new Error(`message ${key} absent`);
  const w = Math.max(M.col + (m.lay.embed?.w ?? 0), ...m.lay.buttons.map((b) => b.x + b.w), m.lay.textLines.length ? VP.w - 60 : 0);
  return { x: VP.x, y: m.top, w, h: m.lay.h };
};

// ───────────────────────── chat: drawing ─────────────────────────
const Avatar: React.FC<{ who: MsgSpec['who'] }> = ({ who }) => {
  if (who === 'bot') return <Emblem size={M.av} />;
  if (who === 'member') return <div style={{ width: M.av, height: M.av, borderRadius: '50%', background: 'rgba(203,213,225,.10)', border: '1.5px solid rgba(203,213,225,.16)', boxSizing: 'border-box' }} />;
  return (
    <div style={{ width: M.av, height: M.av, borderRadius: '50%', boxSizing: 'border-box', background: 'linear-gradient(135deg, #334155, #1E293B)', border: '1.5px solid rgba(203,213,225,.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 28, color: COL.text2 }}>
      {names.ownerDiscordName.charAt(0).toUpperCase()}
    </div>
  );
};

/** The schematic's own note on a private message (not Discord's wording): the bot's reply, or the coach's command (a
 * command is never posted to the channel, and NXT5 answers every command privately: discord-interactions.ts, flags 64). */
const PrivateNote: React.FC<{ label?: string }> = ({ label = 'Réponse privée : visible seulement par toi' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 14px', borderRadius: 999, boxSizing: 'border-box', background: 'rgba(167,139,250,.12)', border: '1.5px solid rgba(196,181,253,.42)' }}>
    <LIcon name="lock" size={22} color={COL.violetText} />
    <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 26, color: COL.violetText, whiteSpace: 'nowrap' }}>{frSpaces(label)}</span>
  </div>
);

const MsgButton: React.FC<{ b: BtnSpec; r: Rect }> = ({ b, r }) => (
  <div
    style={{
      ...abs(r), boxSizing: 'border-box', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      fontFamily: FONT, fontWeight: 700, fontSize: 26, whiteSpace: 'nowrap',
      ...(b.kind === 'primary'
        ? { background: PRIMARY_GRADIENT, color: COL.onAccent }
        : { background: 'rgba(15,23,42,.85)', color: COL.text, border: '1.5px solid rgba(203,213,225,.38)' }),
    }}
  >
    {b.label}
    {b.kind === 'link' ? <LIcon name="externalLink" size={24} color={COL.text} /> : null}
  </div>
);

const line = (r: Rect, children: React.ReactNode, style?: React.CSSProperties): React.ReactNode => (
  <div style={{ ...abs(r), display: 'flex', alignItems: 'center', whiteSpace: 'pre', fontFamily: FONT, fontSize: M.font, fontWeight: 500, color: COL.text, letterSpacing: '-0.005em', ...style }}>{children}</div>
);

/** One message, drawn from its layout (`decor`: rings and marks in the message's own coordinates). */
const Message: React.FC<{ m: Placed; decor?: React.ReactNode }> = ({ m, decor }) => {
  const { spec: s, lay } = m;
  const head = m.headA ?? 1;
  return (
    <div style={{ position: 'absolute', left: VP.x, top: m.top, width: VP.w, height: lay.h, opacity: m.a }}>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: head }}><Avatar who={s.who} /></div>
      <div style={{ position: 'absolute', left: M.col, top: 0, height: M.name, display: 'flex', alignItems: 'center', gap: 16, opacity: head }}>
        {s.who === 'member' ? <Skel w={150} h={14} o={0.9} /> : <Txt size={28} weight={700}>{s.who === 'bot' ? names.botName : names.ownerDiscordName}</Txt>}
        {s.who !== 'member' && s.priv ? <PrivateNote label={s.who === 'coach' ? 'Commande : visible seulement par toi' : undefined} /> : null}
      </div>
      {s.who === 'member'
        ? s.bars.map((w, k) => <div key={k} style={{ position: 'absolute', left: M.col, top: M.name + M.nameGap + k * M.line + 12 }}><Skel w={w} h={14} o={0.75} /></div>)
        : null}
      {s.who === 'coach' ? line(lay.textLines[0], <Rich text={'`' + s.command + '`'} />) : null}
      {s.who === 'bot' ? (
        <>
          {(s.text ?? []).map((t, k) => <React.Fragment key={k}>{line(lay.textLines[k], <Rich text={t} />, { opacity: head })}</React.Fragment>)}
          {s.embed && lay.embed ? (
            <>
              <div style={{ ...abs(lay.embed), boxSizing: 'border-box', borderRadius: 10, background: 'rgba(15,23,42,.72)', border: '1.5px solid rgba(203,213,225,.16)', borderLeft: `${E.edge}px solid ${COL.cyan}` }} />
              {line(lay.title!, frSpaces(s.embed.title), { fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em' })}
              {s.embed.lines.map((t, k) => (t === '' ? null : <React.Fragment key={k}>{line(lay.lines[k], <Rich text={t} />, { color: COL.text2 })}</React.Fragment>))}
              {s.embed.image && lay.image ? <EmbedImage src={s.embed.image.src} r={lay.image} /> : null}
              {lay.footer ? (
                <div style={{ ...abs(lay.footer), display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 24, color: COL.muted }}>{'NXT5 ·'}</span>
                  <Skel w={170} h={12} o={0.8} />
                </div>
              ) : null}
            </>
          ) : null}
          {(s.buttons ?? []).map((b, k) => <MsgButton key={b.label} b={b} r={lay.buttons[k]} />)}
        </>
      ) : null}
      {decor}
    </div>
  );
};

/** The bot's PNG in a message: the top of the image (where its summary is), at the embed's width, fading out at the
 * bottom (the image goes on below). */
const EmbedImage: React.FC<{ src: string; r: Rect }> = ({ src, r }) => (
  <div style={{ ...abs(r), borderRadius: 8, overflow: 'hidden' }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: r.w, height: 'auto' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: 'linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.92))' }} />
  </div>
);

/** A ring around a part of a message (message coordinates), before a click or while it is pointed out. */
const RingAt: React.FC<{ r: Rect; f: number; f0: number; f1: number; pad?: number; radius?: number }> = ({ r, f, f0, f1, pad = 6, radius = 8 }) => (
  <div style={abs(r)}><Ring f={f} f0={f0} f1={f1} pad={pad} radius={radius} /></div>
);

const ChannelHeader: React.FC<{ channel: string }> = ({ channel }) => (
  <div style={{ position: 'absolute', left: 32, top: 0, height: HEAD, display: 'flex', alignItems: 'center', gap: 18 }}>
    <IconTile name="messages" size={48} tint="neutral" />
    <Txt size={28} weight={600} color={COL.muted}>Dans Discord</Txt>
    <div style={{ height: 44, padding: '0 18px', borderRadius: 999, display: 'flex', alignItems: 'center', boxSizing: 'border-box', background: 'rgba(103,232,249,.08)', border: '1.5px solid rgba(103,232,249,.38)' }}>
      <Txt size={28} weight={700} color={COL.cyan}>#{channel}</Txt>
    </div>
  </div>
);

/** Composer: the coach's message field. `focus`: frame of the click into it (focus edge, caret). */
const Composer: React.FC<{ f: number; text: string; focus?: number }> = ({ f, text, focus }) => {
  const on = focus !== undefined && f >= focus;
  const caret = on && Math.floor((f - focus) / 15) % 2 === 0;
  return (
    <div style={{ ...abs(COMPOSER), boxSizing: 'border-box', borderRadius: 14, background: COL.inputBg, border: `1.5px solid ${on ? 'rgba(103,232,249,.62)' : 'rgba(203,213,225,.28)'}`,
      boxShadow: on ? '0 0 0 4px rgba(103,232,249,.12)' : undefined, display: 'flex', alignItems: 'center', padding: '0 26px' }}>
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: M.font, color: COL.fileText, whiteSpace: 'pre' }}>{text}</span>
      {on ? <span style={{ width: 2.5, height: 34, marginLeft: 2, background: COL.text, opacity: caret ? 1 : 0 }} /> : null}
    </div>
  );
};

/** A neutral suggestion line above the composer: the command and its description (shared/discord-command.js). It
 * fades out over f1 → f1 + 6; the views start that 4 f before « Entrée », so it is gone when the sent command arrives. */
const Suggestion: React.FC<{ f: number; f0: number; f1: number; cmd: { name: string; description: string } }> = ({ f, f0, f1, cmd }) => {
  const a = Math.min(ramp(f, f0, f0 + 8, BRAND), 1 - ramp(f, f1, f1 + 6));
  if (a <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', left: COMPOSER.x, top: COMPOSER.y - 12 - 58, height: 58, opacity: a, transform: `translateY(${(1 - a) * 8}px)`, display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 22px', borderRadius: 12, boxSizing: 'border-box', background: '#161C30', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 14px 40px rgba(2,6,17,.5)' }}>
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: COL.fileText }}>{cmd.name}</span>
      <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 26, color: COL.muted }}>{frSpaces(cmd.description)}</span>
    </div>
  );
};

/** The chat panel at frame f: header, messages (clipped to their viewport, soft top edge) and, for a channel where the
 * coach types, the composer. */
const ChatPanel: React.FC<{ channel: string; placed: Placed[]; composer?: React.ReactNode; decor?: Record<string, React.ReactNode>; a: number }> = ({ channel, placed, composer, decor, a }) => {
  const bottom = vpBottom(!!composer);
  const fade = `linear-gradient(180deg, transparent ${CP.y + HEAD}px, #000 ${CP.y + HEAD + 44}px, #000 ${bottom}px, transparent ${bottom + 1}px)`;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
      <Panel {...CP}>
        <ChannelHeader channel={channel} />
        <div style={{ position: 'absolute', left: 28, right: 28, top: HEAD, height: 1.5, background: 'rgba(203,213,225,.14)' }} />
      </Panel>
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: fade, maskImage: fade }}>
        {placed.map((m) => <Message key={m.key} m={m} decor={decor?.[m.key]} />)}
      </div>
      {composer}
    </div>
  );
};

// ───────────────────────── chat: messages of the film ─────────────────────────
const BTN = {
  open: { label: 'Ouvrir NXT5', w: 250, kind: 'link' },
  verify: { label: 'Vérifier la liaison', w: 270, kind: 'primary' },
  confirm: { label: 'Confirmer la liaison', w: 300, kind: 'primary' },
  cancel: { label: 'Annuler', w: 160, kind: 'secondary' },
  game: { label: GAME_MSG.components[0].components[0].label, w: 380, kind: 'link' },
} satisfies Record<string, BtnSpec>;

/** Earlier messages of other members (not known: skeletons). */
const MEMBERS: Item[] = [
  { key: 'm0', at: -100, spec: { who: 'member', bars: [420, 520] } },
  { key: 'm1', at: -100, spec: { who: 'member', bars: [560, 380] } },
  { key: 'm2', at: -100, spec: { who: 'member', bars: [470] } },
];
const linkRequest = (at: number): Item => ({ key: 'request', at, spec: { who: 'bot', priv: true, embed: { title: LINK_REQUEST.title, lines: LINK_REQUEST.description.split('\n') }, buttons: [BTN.open, BTN.verify] } });
const linkReview = (at: number): Item => ({ key: 'review', at, spec: { who: 'bot', priv: true, embed: { title: LINK_REVIEW.title, lines: LINK_REVIEW.description.split('\n') }, buttons: [BTN.confirm, BTN.cancel] } });
const linked = (at: number): Item => ({ key: 'linked', at, spec: { who: 'bot', priv: true, embed: { title: LINKED.title, lines: wrapBefore(LINKED.description, ['Tes droits']) } } });
const coach = (key: string, command: string, at: number): Item => ({ key, at, spec: { who: 'coach', command, priv: true } });
const connected = (at: number): Item => ({ key: 'connected', at, spec: { who: 'bot', priv: true, text: wrapBefore(CONNECTED, ['de commandes', 'conservent']) } });
/** Embed image of a posted message: the top of the PNG at 760 px (the zoom of testMsg brings it to ≈ 1180 px, under the
 * PNG's 1440), down to its summary row (result, duration, kills, gold). The whole game message (572 px) then fits the
 * #résultats viewport under its soft top edge. */
const IMG_W = 760;
const IMG_H = 232;
const testPost = (at: number): Item => ({
  key: 'test', at,
  spec: { who: 'bot', text: [TEST_MSG.content], embed: { title: TEST_MSG.embeds[0].title, lines: TEST_MSG.embeds[0].description.split('\n'), image: { src: TEST_PNG, w: IMG_W, h: IMG_H }, footer: true } },
});
const gamePost = (at: number): Item => ({
  key: 'game', at,
  spec: { who: 'bot', embed: { title: GAME_MSG.embeds[0].title, lines: GAME_MSG.embeds[0].description.split('\n'), image: { src: GAME_PNG, w: IMG_W, h: IMG_H }, footer: true }, buttons: [BTN.game] },
});

/** While the suggestion line shows, the chat rises to make room for it above the composer, so it never covers a
 * message; it comes back down as the sent command arrives (same easing and duration as that arrival, so the column
 * moves in one motion). */
const SUGG_ROOM = 70;
const liftAt = (f: number, s0: number, s1: number) => SUGG_ROOM * Math.min(ramp(f, s0, s0 + SCROLL, IO), 1 - ramp(f, s1, s1 + SCROLL, IO));

/** Where the coach clicks into the composer: its right part, clear of the text typed or pasted at its left. */
const FIELD_PT: Pt = [COMPOSER.x + COMPOSER.w - 120, COMPOSER.y + 42];
/** Keycaps above the composer's right end, over the arrow, in the room left of the messages' right edge and right of the
 * suggestion line. */
const KEYCAP_PT: Pt = [COMPOSER.x + COMPOSER.w - 80, COMPOSER.y - 14];
const Keycaps: React.FC<{ f: number; shot: CardShot }> = ({ f, shot }) => (
  <>
    {(shot.keys ?? []).map((k) => (
      <KeycapHint key={k.f} keys={k.paste ? ['Ctrl', 'V'] : ['Entrée']} f={f} f0={k.f - 8} f1={k.f + 10} x={KEYCAP_PT[0]} y={KEYCAP_PT[1]} />
    ))}
  </>
);
const typedAt = (shot: CardShot, f: number) => {
  const t = shot.typing;
  if (!t || f < t.f0) return '';
  return t.text.slice(0, Math.min(t.text.length, Math.floor(ramp(f, t.f0, t.f1) * t.text.length) + 1));
};

// ───────────────────────── Étape 1 · authorise the bot on the server ─────────────────────────
/** « Autoriser NXT5 sur ton serveur »: a neutral form, not Discord's page. The server picker (a short list: the server,
 * then unknown ones as skeletons) is set to the demo server and « Continuer » goes on, as the real invitation does (two
 * pages: server, then permissions); the form then names the permission the invitation asks for (permissions=8,
 * netlify/functions/_lib/discord-config.ts), with the site's own explanation, and the same button, now « Autoriser »,
 * confirms. */
const OP = { x: 360, y: 146, w: 1200, h: 670 };
const PICK: Rect = { x: OP.x + 48, y: OP.y + 214, w: OP.w - 96, h: 80 };
const ROW_H = 72;
const LIST: Rect = { x: PICK.x, y: PICK.y + PICK.h + 10, w: PICK.w, h: 3 * ROW_H + 16 };
const PERM_ROW: Rect = { x: OP.x + 48, y: OP.y + 376, w: OP.w - 96, h: 118 };
const AUTH: Rect = { x: OP.x + OP.w - 48 - 280, y: OP.y + OP.h - 48 - 72, w: 280, h: 72 };

const ServerMark: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, flexShrink: 0, background: 'linear-gradient(135deg, #3B4A6B, #2A2F55)', border: '1.5px solid rgba(203,213,225,.3)', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: size * 0.46, color: COL.text }}>
    {names.server.charAt(0)}
  </div>
);

export const OauthSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [cPick, cServer, cCont, cAuth] = shot.clicks;
  const { show, perm, spot0, spot1, done, hide } = shot.t;
  const a = useIn(f);
  const open = f >= cPick.f + 2 && f < cServer.f + 2;
  const chosen = f >= cServer.f + 2;
  const listA = open ? ramp(f, cPick.f + 2, cPick.f + 8, BRAND) : 0;
  const rv = ramp(f, perm, perm + 16, BRAND);
  const dn = ramp(f, done, done + 14, BRAND);
  // the button waits, dimmed, until a server is chosen; « Continuer » becomes « Autoriser » as the permission appears
  const ready = ramp(f, cServer.f + 2, cServer.f + 10);
  const local = (r: Rect): Rect => ({ x: r.x - OP.x, y: r.y - OP.y, w: r.w, h: r.h });
  const rowPt: Pt = [LIST.x + 440, LIST.y + 8 + ROW_H / 2 + 6];
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...OP} style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.86 * dn, filter: dn > 0 ? `blur(${4 * dn}px)` : undefined }}>
            <div style={{ position: 'absolute', left: 48, top: 36, display: 'flex', alignItems: 'center', gap: 26 }}>
              <Emblem size={84} />
              <div>
                <Txt size={42} weight={700}>Autoriser NXT5 sur ton serveur</Txt>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <Icon name="messages" size={26} color={COL.muted} />
                  <Txt size={26} weight={500} color={COL.muted}>Dans Discord</Txt>
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 32, right: 32, top: 150, height: 1.5, background: 'rgba(203,213,225,.14)' }} />
            <Txt size={28} weight={600} color={COL.muted} style={{ position: 'absolute', left: 48, top: 172 }}>Serveur</Txt>
            <div style={{ ...abs(local(PICK)), boxSizing: 'border-box', borderRadius: 12, background: COL.inputBg, border: `1.5px solid ${open ? 'rgba(103,232,249,.62)' : 'rgba(203,213,225,.28)'}`,
              display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px' }}>
              {chosen ? (
                <>
                  <ServerMark size={48} />
                  <Txt size={32} weight={700} style={{ flex: 1 }}>{names.server}</Txt>
                  <CheckPop f={f} at={cServer.f + 2} size={22} />
                </>
              ) : (
                <div style={{ flex: 1 }}><Skel w={280} h={16} /></div>
              )}
              <LIcon name="chevronDown" size={34} color={COL.text2} />
              <Ring f={f} f0={cPick.f - 16} f1={cPick.f + 2} pad={6} radius={14} />
            </div>
            <div style={{ position: 'absolute', left: 48, right: 48, top: PERM_ROW.y - OP.y - 46, opacity: rv, transform: `translateY(${(1 - rv) * 14}px)` }}>
              <Txt size={28} weight={600} color={COL.muted}>Autorisation demandée</Txt>
            </div>
            <div style={{ ...abs(local(PERM_ROW)), opacity: rv, transform: `translateY(${(1 - rv) * 14}px)`, boxSizing: 'border-box', borderRadius: 14,
              background: 'rgba(15,23,42,.45)', border: '1.5px solid rgba(203,213,225,.16)', display: 'flex', alignItems: 'center', gap: 24, padding: '0 26px' }}>
              <IconTile name="shieldAlert" size={72} tint="violet" />
              <div>
                <Txt size={36} weight={700}>Administrateur</Txt>
                <Txt size={28} weight={500} color={COL.text2} style={{ marginTop: 6, whiteSpace: 'nowrap' }}>{ADMIN_LINE}</Txt>
              </div>
            </div>
            <div style={{ ...abs(local(AUTH)) }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 2, background: PRIMARY_GRADIENT, opacity: lerp(0.45, 1, ready) }}>
                {(['Continuer', 'Autoriser'] as const).map((label, k) => (
                  <div key={label} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 34, color: COL.onAccent,
                    opacity: k === 0 ? 1 - ramp(rv, 0.3, 0.5) : ramp(rv, 0.5, 0.7) }}>
                    {label}
                  </div>
                ))}
              </div>
              <Ring f={f} f0={cCont.f - 18} f1={cCont.f + 4} pad={8} radius={8} />
              <Ring f={f} f0={cAuth.f - 18} f1={cAuth.f + 4} pad={8} radius={8} />
            </div>
          </div>
          {dn > 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: dn }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '30px 46px', borderRadius: 20, background: 'rgba(17,24,39,.92)', border: '1.5px solid rgba(103,232,249,.45)', transform: `scale(${lerp(0.94, 1, dn)})` }}>
                <Emblem size={84} />
                <Txt size={42} weight={700}>{`${names.botName} a rejoint ${names.server}.`}</Txt>
                <CheckPop f={f} at={done + 6} size={32} />
              </div>
            </div>
          ) : null}
        </Panel>
        {listA > 0 ? (
          <div style={{ ...abs(LIST), opacity: listA, transform: `translateY(${(1 - listA) * -8}px)`, boxSizing: 'border-box', borderRadius: 12, padding: 8,
            background: '#161C30', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 18px 50px rgba(2,6,17,.6)' }}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center', gap: 18, padding: '0 16px', borderRadius: 8, background: k === 0 && f >= cServer.f - 20 ? 'rgba(103,232,249,.08)' : undefined }}>
                {k === 0 ? <ServerMark size={46} /> : <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(203,213,225,.10)' }} />}
                {k === 0 ? <Txt size={30} weight={600}>{names.server}</Txt> : <Skel w={k === 1 ? 240 : 190} h={14} o={0.8} />}
                {k === 0 ? <Ring f={f} f0={cServer.f - 18} f1={cServer.f + 2} pad={2} radius={10} /> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <HaloLayer>
        <Halo r={{ x: PERM_ROW.x - 8, y: PERM_ROW.y - 8, w: PERM_ROW.w + 16, h: PERM_ROW.h + 16 }} f={f} f0={spot0} f1={spot1} radius={18} spot />
      </HaloLayer>
      {/* out of the form right after « Continuer », so the cursor is clear of the permission while it is read (t.perm) */}
      <SchemCursor f={f} start={REST} show={show} hide={hide} clicks={shot.clicks}
        moves={[onto(cPick, at(PICK, 0.9, 0.62)), onto(cServer, rowPt), onto(cCont, at(AUTH, 0.72, 0.7)), { f: cCont.f + 2, dur: 14, to: REST }, onto(cAuth, at(AUTH, 0.72, 0.7))]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Étape 2 · /nxt lier, the private reply, « Ouvrir NXT5 » ─────────────────────────
export const LierSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [cField, cOpen] = shot.clicks;
  const enter = shot.keys![0].f;
  const { show, reply, spot0, spot1, hide } = shot.t;
  const a = useIn(f);
  const t0 = shot.typing!.f0;
  const bottom = vpBottom(true);
  const items = [...MEMBERS, coach('cmd', CMD_LIER.name, enter + 2), linkRequest(reply)];
  const placed = placeChat(items, f, bottom - liftAt(f, t0 + 12, enter + 2));
  const settled = placeChat(items, cOpen.f, bottom);
  const open = rectIn(settled, 'request', (l) => l.buttons[0]);
  const req = msgRect(settled, 'request');
  const typed = f >= enter + 1 ? '' : typedAt(shot, f);
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <ChatPanel a={a} channel={names.commandChannel} placed={placed}
        decor={{ request: <RingAt r={settled.find((m) => m.key === 'request')!.lay.buttons[0]} f={f} f0={cOpen.f - 18} f1={cOpen.f + 4} /> }}
        composer={<Composer f={f} text={typed} focus={f < enter + 1 ? cField.f + 1 : undefined} />} />
      <Suggestion f={f} f0={t0 + 12} f1={enter - 4} cmd={CMD_LIER} />
      <Keycaps f={f} shot={shot} />
      <HaloLayer>
        <Halo r={{ x: req.x - 10, y: req.y - 10, w: req.w + 20, h: req.h + 20 }} f={f} f0={spot0} f1={spot1} radius={18} spot />
      </HaloLayer>
      <SchemCursor f={f} start={REST} show={show} hide={hide} clicks={shot.clicks} moves={[onto(cField, FIELD_PT), onto(cOpen, at(open, 0.72, 0.7))]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Étape 2 (suite) · « Vérifier la liaison », « Confirmer la liaison » ─────────────────────────
export const VerifySchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [cVerify, cConfirm] = shot.clicks;
  const { show, review, accounts0, accounts1, done, spot0, spot1, hide } = shot.t;
  const a = useIn(f);
  const bottom = vpBottom(true);
  const items = [...MEMBERS, coach('cmd', CMD_LIER.name, -100), linkRequest(-100), linkReview(review), linked(done)];
  const placed = placeChat(items, f, bottom);
  const atVerify = placeChat(items, cVerify.f, bottom);
  const atConfirm = placeChat(items, cConfirm.f, bottom);
  const verifyBtn = rectIn(atVerify, 'request', (l) => l.buttons[1]);
  const confirmBtn = rectIn(atConfirm, 'review', (l) => l.buttons[0]);
  const l0 = rectIn(atConfirm, 'review', (l) => l.lines[0]);
  const l1 = rectIn(atConfirm, 'review', (l) => l.lines[1]);
  const acc = { x: l0.x - 16, y: l0.y - 3, w: 560, h: l1.y + l1.h - l0.y + 6 };
  const end = msgRect(placeChat(items, hide, bottom), 'linked');
  const lay = (k: string) => placed.find((m) => m.key === k)?.lay;
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <ChatPanel a={a} channel={names.commandChannel} placed={placed}
        decor={{
          request: lay('request') ? <RingAt r={lay('request')!.buttons[1]} f={f} f0={cVerify.f - 18} f1={cVerify.f + 4} /> : null,
          review: lay('review') ? <RingAt r={lay('review')!.buttons[0]} f={f} f0={cConfirm.f - 18} f1={cConfirm.f + 4} /> : null,
        }}
        composer={<Composer f={f} text="" />} />
      <HaloLayer>
        <Halo r={acc} f={f} f0={accounts0} f1={accounts1} radius={12} spot />
        <Halo r={{ x: end.x - 10, y: end.y - 10, w: end.w + 20, h: end.h + 20 }} f={f} f0={spot0} f1={spot1} radius={18} spot />
      </HaloLayer>
      {/* each new message pushes the clicked button up while its ripple plays: the ripple rides with it */}
      <SchemCursor f={f} start={REST} show={show} hide={hide} clicks={shot.clicks}
        drift={(c) => driftOf(items, placed, c === cVerify ? 'request' : 'review', c.f, bottom)}
        moves={[onto(cVerify, at(verifyBtn, 0.72, 0.7)), { f: cVerify.f + 6, dur: 18, to: REST }, onto(cConfirm, at(confirmBtn, 0.72, 0.7)), { f: cConfirm.f + 6, dur: 18, to: REST }]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Étape 3 (suite) · paste /nxt connecter, Entrée ─────────────────────────
export const ConnectSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [cField] = shot.clicks;
  const [paste, enter] = shot.keys!;
  const { show, ring0, reply, spot0, spot1, hide } = shot.t;
  const a = useIn(f);
  const bottom = vpBottom(true);
  const items = [...MEMBERS, coach('cmd', CMD_LIER.name, -100), linkRequest(-100), linkReview(-100), linked(-100), coach('cmd2', names.linkCommand, enter.f + 2), connected(reply)];
  // the room opens as the keycap appears, before the suggestion line (paste.f + 2) needs it
  const placed = placeChat(items, f, bottom - liftAt(f, paste.f - 8, enter.f + 2));
  const end = msgRect(placeChat(items, hide, bottom), 'connected');
  const text = f >= paste.f && f < enter.f + 1 ? names.linkCommand : '';
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <ChatPanel a={a} channel={names.commandChannel} placed={placed} composer={<Composer f={f} text={text} focus={f < enter.f + 1 ? cField.f + 1 : undefined} />} />
      <Suggestion f={f} f0={paste.f + 2} f1={enter.f - 4} cmd={CMD_CONNECT} />
      <Keycaps f={f} shot={shot} />
      <HaloLayer>
        <Halo r={{ x: COMPOSER.x + 12, y: COMPOSER.y + 8, w: 650, h: COMPOSER.h - 16 }} f={f} f0={ring0} f1={enter.f - 8} radius={10} />
        <Halo r={{ x: end.x - 10, y: end.y - 10, w: end.w + 20, h: end.h + 20 }} f={f} f0={spot0} f1={spot1} radius={18} spot />
      </HaloLayer>
      <SchemCursor f={f} start={REST} show={show} hide={hide} clicks={shot.clicks} moves={[onto(cField, FIELD_PT)]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Étape 5 (suite) · the test message in #résultats ─────────────────────────
/** The public test message arrives; the camera then moves in on its card (title and the top of its image, whose
 * summary becomes legible). The message's head (avatar, name, content line) fades out as the camera starts: the zoom
 * would slide it through the area's top edge, and the content line off the frame's right edge. */
export const TestMsgSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { msg, spot0, spot1, zoom0, zoom1 } = shot.t;
  const a = useIn(f);
  const bottom = vpBottom(false);
  const items = [...MEMBERS, testPost(msg)];
  const placed = placeChat(items, f, bottom).map((m) => (m.key === 'test' ? { ...m, headA: 1 - ramp(f, zoom0, zoom0 + 12, IO) } : m));
  const settled = placeChat(items, zoom0, bottom);
  const embed = rectIn(settled, 'test', (l) => l.embed);
  const post = msgRect(settled, 'test');
  // z 1.55: the embed's content (title to footer, 418 px) fills ≈ 650 px of the 734 px area, its image ≈ 1180 px wide
  const cam = sCamAt([{ f: 0, z: 1, at: HOME }, { f: zoom0, z: 1, at: HOME }, { f: zoom1, z: 1.55, at: [embed.x + embed.w / 2, embed.y + embed.h / 2] }], f);
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <CamLayer cam={cam} frame={CP}>
        <ChatPanel a={a} channel={names.publishChannel} placed={placed} />
      </CamLayer>
      <HaloLayer>
        <Halo r={mapRect(cam, { x: post.x - 10, y: post.y - 10, w: post.w + 20, h: post.h + 20 })} f={f} f0={spot0} f1={spot1} radius={18} spot />
      </HaloLayer>
    </AbsoluteFill>
  );
};

// ───────────────────────── Étape 6 (fin) · the game in #résultats, click on its visual ─────────────────────────
export const PublishedSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [cImage] = shot.clicks;
  const { msg, show, title0, title1, hide } = shot.t;
  const a = useIn(f);
  const bottom = vpBottom(false);
  const items = [...MEMBERS, testPost(-100), gamePost(msg)];
  const placed = placeChat(items, f, bottom);
  const settled = placeChat(items, cImage.f, bottom);
  const title = rectIn(settled, 'game', (l) => l.title);
  const desc = rectIn(settled, 'game', (l) => l.lines[l.lines.length - 1]);
  const img = rectIn(settled, 'game', (l) => l.image);
  const lay = placed.find((m) => m.key === 'game')?.lay;
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <ChatPanel a={a} channel={names.publishChannel} placed={placed}
        decor={{ game: lay?.image ? <RingAt r={lay.image} f={f} f0={cImage.f - 18} f1={cImage.f + 4} pad={6} radius={12} /> : null }} />
      <HaloLayer>
        <Halo r={{ x: title.x - 16, y: title.y - 4, w: 440, h: desc.y + desc.h - title.y + 8 }} f={f} f0={title0} f1={title1} radius={12} />
      </HaloLayer>
      <SchemCursor f={f} start={REST} show={show} hide={hide} clicks={shot.clicks} moves={[onto(cImage, at(img, 0.62, 0.55))]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── C’est fait · the game visual, large ─────────────────────────
/** The PNG the bot posted, opened large: it starts on its summary (title, result, duration, kills, gold), held while it
 * is read, then pans slowly down to the team's players. */
const FR: Rect = { x: 400, y: 128, w: 1120, h: 710 };
const PAN = 600;
export const VisualSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { pan0, pan1, chip1 } = shot.t;
  const a = useIn(f);
  const y = -PAN * ramp(f, pan0, pan1, CAM_EASE.glide);
  const chip = Math.min(ramp(f, 8, 20, BRAND), 1 - ramp(f, chip1, chip1 + 10, IO));
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ ...abs(FR), opacity: a, transform: `translateY(${(1 - a) * 16}px)`, borderRadius: 18, overflow: 'hidden', boxShadow: `0 0 0 1.5px ${COL.glassBorder}, 0 30px 80px rgba(2,6,17,.55)` }}>
        <Img src={staticFile(GAME_PNG)} style={{ position: 'absolute', left: 0, top: y, width: FR.w, height: 'auto' }} />
      </div>
      {chip > 0.001 ? (
        <div style={{ position: 'absolute', left: TOP.left, top: AREA.top + 8, opacity: chip, transform: `translateX(${(1 - chip) * -14}px)`, display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px 14px 14px', borderRadius: 18, background: '#161C30', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 14px 40px rgba(2,6,17,.5)' }}>
          <IconTile name="messages" size={48} tint="cyan" />
          <div>
            <Txt size={30} weight={700}>Dans Discord</Txt>
            <Txt size={26} weight={500} color={COL.muted}>#{names.publishChannel}</Txt>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
