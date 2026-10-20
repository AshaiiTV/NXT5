// TutoImporter's own schematic cards (its `views`, TutoImporter.tsx) for what is not captured: browser download,
// Windows protection message, League of Legends client (open, history), save dialog, file picker. They are drawn in the
// NXT5 charte (night, violet glass, Inter, lucide icons, 2 px buttons) and tagged « Illustration »: they imitate
// neither Windows (no logo, colours, fonts or window chrome) nor Riot (no logo, client styling or game art). Only real
// texts from the product and the storyboard are quoted; content the schematic does not know is drawn as neutral
// skeleton bars.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { CardShot, Click, Move, Pt } from '../engine';
import { frSpaces } from '../engine';
import { TutoBackdrop } from '../parts/Backdrop';
import { Btn, Emblem, IconTile, Panel, Skel, StepBadge, Txt } from '../parts/Glass';
import { Icon } from '../parts/icons';
import { Ring } from '../parts/Halo';
import { cursorOpacity, cursorPoint, CursorLayer } from '../parts/Cursor';
import { BRAND, clamp, COL, IO, lerp, ramp } from '../style';

const id = (p: unknown) => p as Pt;

/** Panel entrance shared by the schematics: rise + fade over 14 f. */
const useIn = (f: number, at = 0) => ramp(f, at, at + 14, BRAND);

const ScreenCursor: React.FC<{ f: number; start: Pt; moves: Move[]; clicks: Click[]; show: number; hide?: number }> = ({ f, start, moves, clicks, show, hide }) => (
  <CursorLayer f={f} point={cursorPoint(start, moves, f, id)} clicks={clicks} size={46} opacity={cursorOpacity(f, show, hide)} />
);

/** Check badge popping in (success). */
const CheckPop: React.FC<{ f: number; at: number; label?: string; size?: number }> = ({ f, at, label, size = 30 }) => {
  const a = ramp(f, at, at + 10, BRAND);
  if (a <= 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: a, transform: `scale(${lerp(0.85, 1, a)})`, transformOrigin: 'left center' }}>
      <div style={{ width: size * 1.35, height: size * 1.35, borderRadius: '50%', background: COL.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={size * 0.9} color={COL.onAccent} stroke={3} />
      </div>
      {label ? <Txt size={size} weight={700} color={COL.cyan}>{label}</Txt> : null}
    </div>
  );
};

// ───────────────────────── 2c · download ─────────────────────────
/** Right edge (screen px) of the schematic « Télécharger » button, measured on a render (Inter 700, 28 px). */
const BTN_RIGHT = 520;
export const DownloadSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { arc, fly, land, check } = shot.t;
  const a = useIn(f);
  const SRC = { x: 230, y: 388, w: 420, h: 190 };
  const DEST = { x: 760, y: 278, w: 930, h: 410 };
  const SLOT = { x: DEST.x + 40, y: DEST.y + 132, w: 850, h: 112 };
  // « Télécharger » button (padding 34, 60 px title row, 22 px gap, 28 px button): right edge, vertical centre.
  const start: Pt = [BTN_RIGHT + 6, SRC.y + 34 + 60 + 22 + (28 * 2.05) / 2];
  // The file (its emblem) flies through the empty space right of the button and between the two cards, into the
  // slot at the emblem's own place in the file row: it never crosses a label. The row then appears around it.
  const EMB = 68;
  const end: Pt = [SLOT.x + 26 + EMB / 2, SLOT.y + SLOT.h / 2];
  const ctrl: Pt = [690, 400];
  const t = ramp(f, fly, land, IO);
  const u = 1 - t;
  const p: Pt = [u * u * start[0] + 2 * u * t * ctrl[0] + t * t * end[0], u * u * start[1] + 2 * u * t * ctrl[1] + t * t * end[1]];
  const flyO = ramp(f, fly, fly + 6) * (1 - ramp(f, land, land + 4));
  const rowA = ramp(f, land - 2, land + 8, BRAND);
  const dash = 1 - ramp(f, arc, arc + 26, IO);
  const arcO = 0.55 * (1 - ramp(f, land, land + 12));
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...SRC} style={{ padding: 34, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <IconTile name="globe" size={60} tint="cyan" />
            <Txt size={38} weight={700}>nxt5.org</Txt>
          </div>
          <Btn label="Télécharger" icon="download" size={28} style={{ alignSelf: 'flex-start', background: 'rgba(15,23,42,.85)' }} />
        </Panel>
        <Panel {...DEST} style={{ padding: '36px 40px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <IconTile name="folder" size={70} tint="violet" />
            <Txt size={42} weight={700}>Téléchargements</Txt>
          </div>
          {[0, 1].map((k) => (
            <div key={k} style={{ position: 'absolute', left: 40, top: 270 + k * 62, display: 'flex', alignItems: 'center', gap: 22, opacity: 0.7 }}>
              <Icon name="file" size={34} color="rgba(203,213,225,.35)" />
              <Skel w={k ? 300 : 380} h={14} />
            </div>
          ))}
          <div style={{ position: 'absolute', left: 40, top: 132, width: SLOT.w, height: SLOT.h, borderRadius: 14, border: '1.5px dashed rgba(196,181,253,.3)', opacity: 1 - ramp(f, land - 4, land + 2) }} />
        </Panel>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: arcO * a }}>
        <path d={`M${start[0]},${start[1]} Q${ctrl[0]},${ctrl[1]} ${end[0]},${end[1]}`} fill="none" stroke={COL.cyan} strokeWidth={3} strokeDasharray="10 12" pathLength={1000} strokeDashoffset={dash * 1000} />
      </svg>
      {rowA > 0 ? (
        <div
          style={{
            position: 'absolute', left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, opacity: rowA, transform: `scale(${lerp(0.97, 1, rowA)})`,
            transformOrigin: `${26 + EMB / 2}px 50%`, borderRadius: 14, background: 'linear-gradient(135deg, #2A3552, #262049)',
            border: '1.5px solid rgba(103,232,249,.55)', boxShadow: '0 18px 44px rgba(2,6,17,.5)', display: 'flex', alignItems: 'center', gap: 22,
            padding: '0 26px', boxSizing: 'border-box',
          }}
        >
          <Emblem size={EMB} />
          <div style={{ flex: 1 }}>
            <Txt size={34} weight={600} color={COL.fileText}>NXT5-Importer-Windows-0.3.8.exe</Txt>
            <Txt size={26} weight={500} color={COL.muted}>NXT5 Importer</Txt>
          </div>
          <CheckPop f={f} at={check} size={28} />
        </div>
      ) : null}
      {flyO > 0 ? (
        <div style={{ position: 'absolute', left: p[0] - EMB / 2, top: p[1] - EMB / 2, opacity: flyO, transform: `scale(${lerp(0.8, 1, t)})`, filter: 'drop-shadow(0 12px 24px rgba(2,6,17,.55))' }}>
          <Emblem size={EMB} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ───────────────────────── 3a (end) · double-click on the downloaded file ─────────────────────────
/** The 2c « Téléchargements » card again (same panel, same file row), centred: the cursor double-clicks the file (two
 * presses 6 f apart, two ripples), the row is selected and the emblem pulses as the program starts. « Double-clic » is
 * an annotation of the gesture (like 5a's « copie l’identifiant »), not a UI label. */
export const OpenFileSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [c1, c2] = shot.clicks;
  const { open } = shot.t;
  const a = useIn(f);
  const P = { x: 495, y: 278, w: 930, h: 410 };
  const ROW = { x: P.x + 40, y: P.y + 132, w: 850, h: 112 };
  const EMB = 68;
  const target: Pt = [1190, 470]; // just under « .exe » (the arrow stays below the name: the version stays legible)
  const sel = f >= c1.f + 1;
  const hint = Math.min(ramp(f, c1.f - 8, c1.f, BRAND), 1 - ramp(f, shot.dur - 14, shot.dur - 6));
  const bump = interpolate(f, [open, open + 5, open + 12], [0, 1, 0], clamp);
  const pulse = f >= open && f < open + 24 ? interpolate(f - open, [0, 22], [0, 1], clamp) : -1;
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...P} style={{ padding: '36px 40px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <IconTile name="folder" size={70} tint="violet" />
            <Txt size={42} weight={700}>Téléchargements</Txt>
          </div>
          {[0, 1].map((k) => (
            <div key={k} style={{ position: 'absolute', left: 40, top: 270 + k * 62, display: 'flex', alignItems: 'center', gap: 22, opacity: 0.7 }}>
              <Icon name="file" size={34} color="rgba(203,213,225,.35)" />
              <Skel w={k ? 300 : 380} h={14} />
            </div>
          ))}
        </Panel>
        <div
          style={{
            position: 'absolute', left: ROW.x, top: ROW.y, width: ROW.w, height: ROW.h, borderRadius: 14, boxSizing: 'border-box',
            background: sel ? 'linear-gradient(135deg, #31406A, #2D2759)' : 'linear-gradient(135deg, #2A3552, #262049)',
            border: `1.5px solid ${sel ? 'rgba(103,232,249,.85)' : 'rgba(103,232,249,.55)'}`, boxShadow: '0 18px 44px rgba(2,6,17,.5)',
            display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px',
          }}
        >
          <div style={{ position: 'relative', width: EMB, height: EMB, flexShrink: 0 }}>
            <Emblem size={EMB} style={{ transform: `scale(${1 + 0.07 * bump})` }} />
            {pulse >= 0 ? (
              <div style={{ position: 'absolute', left: EMB / 2 - (EMB / 2 + 34 * pulse), top: EMB / 2 - (EMB / 2 + 34 * pulse), width: EMB + 68 * pulse, height: EMB + 68 * pulse,
                borderRadius: EMB * 0.22 + 20 * pulse, border: `2px solid ${COL.cyan}`, opacity: 0.8 * (1 - pulse) }} />
            ) : null}
          </div>
          <div style={{ flex: 1 }}>
            <Txt size={34} weight={600} color={COL.fileText}>NXT5-Importer-Windows-0.3.8.exe</Txt>
            <Txt size={26} weight={500} color={COL.muted}>NXT5 Importer</Txt>
          </div>
          <CheckPop f={f} at={-10} size={28} />
          <Ring f={f} f0={c1.f - 16} f1={c2.f + 12} pad={6} radius={18} />
        </div>
      </div>
      {hint > 0.001 ? (
        <div
          style={{
            position: 'absolute', right: 1920 - (ROW.x + ROW.w), top: ROW.y - 12, transform: `translateY(-100%) translateY(${(1 - hint) * 10}px)`, opacity: hint,
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 16, whiteSpace: 'nowrap',
            background: 'rgba(17,24,39,.92)', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 14px 40px rgba(2,6,17,.5)',
          }}
        >
          <Icon name="mouse" size={30} color={COL.cyan} />
          <Txt size={30} weight={700}>Double-clic</Txt>
        </div>
      ) : null}
      <ScreenCursor f={f} start={[1250, 790]} show={6} clicks={shot.clicks} moves={[{ f: 14, dur: 20, to: target }]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 3b · Windows protection message ─────────────────────────
export const SmartScreenSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [c1, c2] = shot.clicks;
  const { reveal, done } = shot.t;
  const a = useIn(f);
  const P = { x: 420, y: 150, w: 1080, h: 660 };
  const rv = ramp(f, reveal, reveal + 16, BRAND);
  const dn = ramp(f, done, done + 14, BRAND);
  const linkDone = f >= c1.f + 2;
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...P}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.75 * dn }}>
            <div style={{ position: 'absolute', left: 56, top: 48, display: 'flex', gap: 26, alignItems: 'center' }}>
              <IconTile name="shieldAlert" size={92} tint="violet" />
              <div>
                <Txt size={28} weight={500} color={COL.muted}>Message de protection</Txt>
                <Txt size={40} weight={700}>{frSpaces('« Windows a protégé votre ordinateur »')}</Txt>
              </div>
            </div>
            <Txt size={30} weight={500} color={COL.text2} style={{ position: 'absolute', left: 56, top: 182, width: 940, lineHeight: 1.4 }}>
              Si cette version de NXT5 Importer n’est pas encore reconnue, Windows peut afficher ce message.
            </Txt>
            <div style={{ position: 'absolute', left: 56, top: 300, display: 'flex', alignItems: 'center', gap: 20 }}>
              <StepBadge n={1} on={!linkDone || true} />
              <div style={{ position: 'relative' }}>
                <Txt size={36} weight={600} color={COL.cyan} style={{ textDecoration: 'underline', textUnderlineOffset: 6, padding: '4px 6px' }}>Informations complémentaires</Txt>
                <Ring f={f} f0={c1.f - 18} f1={c1.f + 12} pad={8} radius={10} />
              </div>
              {linkDone ? <CheckPop f={f} at={c1.f + 4} size={24} /> : null}
            </div>
            <div style={{ position: 'absolute', left: 56, right: 56, top: 392, opacity: rv, transform: `translateY(${(1 - rv) * 14}px)` }}>
              <div style={{ height: 1.5, background: 'rgba(203,213,225,.16)', marginBottom: 26 }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <Txt size={28} weight={500} color={COL.muted}>Fichier</Txt>
                <Txt size={32} weight={600} color={COL.fileText}>NXT5-Importer-Windows-0.3.8.exe</Txt>
              </div>
              <Txt size={28} weight={500} color={COL.text2} style={{ marginTop: 10 }}>Vérifie que le fichier correspond à NXT5 Importer.</Txt>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 34 }}>
                <StepBadge n={2} />
                <div style={{ position: 'relative' }}>
                  <Btn label="Exécuter quand même" size={34} />
                  <Ring f={f} f0={c2.f - 20} f1={c2.f + 12} pad={8} radius={8} />
                </div>
              </div>
            </div>
          </div>
          {dn > 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: dn }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '28px 44px', borderRadius: 20, background: 'rgba(17,24,39,.9)', border: '1.5px solid rgba(103,232,249,.45)', transform: `scale(${lerp(0.94, 1, dn)})` }}>
                <Emblem size={84} />
                <Txt size={44} weight={700}>NXT5 Importer s’ouvre.</Txt>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
      <ScreenCursor f={f} start={[1250, 790]} show={8} hide={done + 4} clicks={shot.clicks}
        moves={[{ f: c1.f - 34, dur: 18, to: [1030, 500] }, { f: c2.f - 34, dur: 18, to: [940, 752] }]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 4a · League of Legends client open, the Importer connects ─────────────────────────
// No order imposed (no « D’abord / Ensuite », no numbers): at this point the viewer has already opened the Importer
// (step 2). The client goes green, then the Importer shows « Client LoL connecté ».
export const LolOpenSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { client, arrow, importer } = shot.t;
  const a1 = useIn(f, 4);
  const a2 = useIn(f, 10);
  const on1 = ramp(f, client, client + 10, BRAND);
  const on2 = ramp(f, importer, importer + 10, BRAND);
  const ar = ramp(f, arrow, arrow + 16, IO);
  const pulse = (at: number) => (f >= at && f < at + 26 ? interpolate(f - at, [0, 24], [0, 1], clamp) : -1);
  const Tile: React.FC<{ x: number; lead: string; title: string; icon: React.ReactNode; on: number; status: string; pulseT: number; a: number }> = ({ x, lead, title, icon, on, status, pulseT, a }) => (
    <Panel
      x={x} y={252} w={620} h={440}
      style={{ opacity: a, transform: `translateY(${(1 - a) * 16}px)`, padding: '40px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 26,
        border: `1.5px solid ${on > 0 ? `rgba(103,232,249,${0.3 + 0.35 * on})` : COL.glassBorder}`,
        boxShadow: `inset 0 1px 0 rgba(226,232,255,.1), 0 30px 80px rgba(2,6,17,.5)${on > 0 ? `, 0 0 ${40 * on}px rgba(103,232,249,${0.18 * on})` : ''}` }}
    >
      <Txt size={30} weight={600} color={COL.muted}>{lead}</Txt>
      {icon}
      <Txt size={40} weight={700}>{title}</Txt>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: on, position: 'relative' }}>
        <div style={{ position: 'relative', width: 20, height: 20 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: COL.success }} />
          {pulseT >= 0 ? <div style={{ position: 'absolute', left: 10 - 30 * pulseT, top: 10 - 30 * pulseT, width: 60 * pulseT, height: 60 * pulseT, borderRadius: '50%', border: `2px solid ${COL.success}`, opacity: 1 - pulseT }} /> : null}
        </div>
        <Txt size={32} weight={600} color={COL.success}>{status}</Txt>
      </div>
    </Panel>
  );
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <Tile x={260} lead="Ouvre aussi" title="Client League of Legends" icon={<IconTile name="gamepad" size={104} tint="neutral" />} on={on1} status="Client ouvert" pulseT={pulse(client)} a={a1} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d="M 900 472 L 1010 472" stroke={COL.cyan} strokeWidth={4} strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 * (1 - ar)} fill="none" />
        {/* a link, not a sequence: heads on both ends */}
        <path d="M 990 452 L 1012 472 L 990 492" stroke={COL.cyan} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={ramp(f, arrow + 12, arrow + 18)} />
        <path d="M 920 452 L 898 472 L 920 492" stroke={COL.cyan} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={ramp(f, arrow + 12, arrow + 18)} />
      </svg>
      <Tile x={1040} lead="Se connecte au client" title="NXT5 Importer" icon={<Emblem size={104} />} on={on2} status="Client LoL connecté" pulseT={pulse(importer)} a={a2} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 5a · client history, copy the ID ─────────────────────────
// The exact screen and control of the League of Legends client are not documented (TUTO-IMPORTER-PARCOURS.md §6 and
// point C1): the copy action is a generic copy icon with a lowercase caption outside any button styling, and the field
// label is a skeleton bar. Only the ID value itself is shown, because the viewer pastes it in the next step.
export const LolHistorySchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [c1, c2] = shot.clicks;
  const { expand, pill, show } = shot.t;
  const a = useIn(f);
  const P = { x: 400, y: 146, w: 1120, h: 668 };
  const e = ramp(f, expand, expand + 16, BRAND);
  const sel = f >= c1.f + 2;
  const EXP = 128;
  const pl = ramp(f, pill, pill + 22, IO);
  const plO = ramp(f, pill, pill + 6);
  const row = (k: number) => {
    const top = 156 + k * 112 + (k > 0 ? EXP * e : 0);
    const isSel = k === 0 && sel;
    return (
      <div key={k} style={{ position: 'absolute', left: 40, top, width: 1040, height: 96, borderRadius: 14, boxSizing: 'border-box',
        background: isSel ? 'rgba(103,232,249,.07)' : 'rgba(15,23,42,.45)', border: `1.5px solid ${isSel ? 'rgba(103,232,249,.6)' : 'rgba(203,213,225,.14)'}`,
        display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px' }}>
        <IconTile name="gamepad" size={58} tint="neutral" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <Skel w={k === 1 ? 260 : 320} h={16} />
          <Skel w={k === 2 ? 150 : 200} h={12} o={0.7} />
        </div>
        <Skel w={120} h={14} o={0.7} />
        <Icon name="chevronRight" size={30} color="rgba(203,213,225,.5)" />
        {k === 0 ? <Ring f={f} f0={c1.f - 16} f1={c1.f + 10} pad={6} radius={18} /> : null}
      </div>
    );
  };
  const btn: Pt = [1420, 457]; // centre of the copy icon tile (expanded row, right end)
  const pillEnd: Pt = [1300, 748];
  const pp: Pt = [lerp(btn[0], pillEnd[0], pl), lerp(btn[1], pillEnd[1], pl) - Math.sin(pl * Math.PI) * 40];
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...P}>
          <div style={{ position: 'absolute', left: 40, top: 36, display: 'flex', alignItems: 'center', gap: 22 }}>
            <IconTile name="history" size={80} tint="violet" />
            <div>
              <Txt size={42} weight={700}>Historique des parties</Txt>
              <Txt size={28} weight={500} color={COL.muted}>Client League of Legends</Txt>
            </div>
          </div>
          {[0, 1, 2].map(row)}
          <div style={{ position: 'absolute', left: 40, top: 252, width: 1040, height: EXP * e, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 28, top: 22, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Skel w={230} h={14} o={0.8} />
                <Txt size={40} weight={700} style={{ letterSpacing: '0.01em' }}>EUW1_7861632138</Txt>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <Txt size={28} weight={500} color={COL.violetText}>copie l’identifiant</Txt>
                <Icon name="arrowRight" size={26} color={COL.violetText} />
                <div style={{ position: 'relative' }}>
                  <IconTile name="copy" size={64} tint="neutral" />
                  <Ring f={f} f0={c2.f - 16} f1={c2.f + 10} pad={8} radius={18} />
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      {plO > 0 ? (
        <div style={{ position: 'absolute', left: pp[0], top: pp[1], transform: `translate(-50%, -50%) scale(${lerp(0.3, 1, pl)})`, opacity: plO,
          display: 'flex', alignItems: 'center', gap: 20, padding: '20px 30px', borderRadius: 20, background: 'rgba(17,24,39,.94)',
          border: '1.5px solid rgba(103,232,249,.6)', boxShadow: `0 18px 50px rgba(2,6,17,.55), 0 0 ${30 * pl}px rgba(103,232,249,.25)` }}>
          <Icon name="clipboardCheck" size={44} color={COL.cyan} />
          <div>
            <Txt size={26} weight={500} color={COL.muted}>Presse-papiers</Txt>
            <Txt size={36} weight={700}>EUW1_7861632138</Txt>
          </div>
        </div>
      ) : null}
      <ScreenCursor f={f} start={[1330, 800]} show={show} clicks={shot.clicks}
        moves={[{ f: 52, dur: 18, to: [1060, 372] }, { f: 106, dur: 18, to: [1424, 462] }]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 6b · « Enregistrer le JSON NXT5 » ─────────────────────────
export const SaveJsonSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [c1] = shot.clicks;
  const { folder, drop, done } = shot.t;
  const a = useIn(f);
  const P = { x: 420, y: 180, w: 1080, h: 600 };
  const d = ramp(f, drop, done, IO);
  const label = (txt: string) => <Txt size={28} weight={500} color={COL.muted} style={{ width: 250 }}>{txt}</Txt>;
  const from: Pt = [P.x + 330 + 260, P.y + 300];
  const to: Pt = [P.x + 330 + 150, P.y + 202];
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...P}>
          <div style={{ position: 'absolute', left: 56, top: 40, display: 'flex', alignItems: 'center', gap: 22 }}>
            <IconTile name="save" size={80} tint="violet" />
            <div>
              <Txt size={42} weight={700}>Enregistrer le JSON NXT5</Txt>
              <Txt size={28} weight={500} color={COL.muted}>Fenêtre d’enregistrement</Txt>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 56, top: 172, display: 'flex', alignItems: 'center', gap: 20 }}>
            {label('Dossier')}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
              <Icon name="folder" size={36} color={COL.violetText} />
              <Txt size={34} weight={600}>Téléchargements</Txt>
              <div style={{ padding: '4px 14px', borderRadius: 999, border: '1.5px solid rgba(103,232,249,.5)', color: COL.cyan }}>
                <Txt size={24} weight={600} color={COL.cyan}>par défaut</Txt>
              </div>
              <Ring f={f} f0={folder} f1={folder + 52} pad={12} radius={14} />
              <div style={{ marginLeft: 10 }}><CheckPop f={f} at={done} size={24} /></div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 56, top: 268, display: 'flex', alignItems: 'center', gap: 20 }}>
            {label('Nom du fichier')}
            <div style={{ width: 640, height: 66, borderRadius: 12, background: COL.inputBg, border: '1.5px solid rgba(203,213,225,.28)', display: 'flex', alignItems: 'center', padding: '0 22px', boxSizing: 'border-box' }}>
              <Txt size={32} weight={500} color={COL.fileText}>nxt5-EUW1_7861632138.json</Txt>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 56, top: 374, display: 'flex', alignItems: 'center', gap: 20 }}>
            {label('Type')}
            <Txt size={32} weight={500}>NXT5 JSON</Txt>
          </div>
          <div style={{ position: 'absolute', right: 56, top: 486, display: 'flex', gap: 20 }}>
            <Btn label="Annuler" size={32} />
            <div style={{ position: 'relative' }}>
              <Btn label="Enregistrer" primary size={32} />
              <Ring f={f} f0={c1.f - 18} f1={c1.f + 10} pad={8} radius={8} />
            </div>
          </div>
        </Panel>
      </div>
      {f >= drop && f < done + 4 ? (
        <div style={{ position: 'absolute', left: lerp(from[0], to[0], d), top: lerp(from[1], to[1], d) - Math.sin(d * Math.PI) * 50, transform: `translate(-50%, -50%) scale(${lerp(1, 0.5, d)})`, opacity: 1 - ramp(f, done - 2, done + 4) }}>
          <Icon name="fileJson" size={64} color={COL.fileText} />
        </div>
      ) : null}
      <ScreenCursor f={f} start={[1230, 800]} show={30} clicks={shot.clicks} moves={[{ f: 60, dur: 18, to: [1430, 702] }]} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 7b · file picker ─────────────────────────
export const PickFileSchema: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const [c1, c2] = shot.clicks;
  const { done } = shot.t;
  const a = useIn(f);
  const P = { x: 420, y: 190, w: 1080, h: 580 };
  const sel = f >= c1.f + 2;
  const fileRow = (top: number, icon: React.ReactNode, name: string, active: boolean, ring?: boolean) => (
    <div style={{ position: 'absolute', left: 56, top, width: 968, height: 92, borderRadius: 14, boxSizing: 'border-box', padding: '0 26px',
      display: 'flex', alignItems: 'center', gap: 22, background: active ? 'rgba(103,232,249,.08)' : 'rgba(15,23,42,.45)',
      border: `1.5px solid ${active ? 'rgba(103,232,249,.6)' : 'rgba(203,213,225,.14)'}` }}>
      {icon}
      <Txt size={32} weight={600} color={active || ring ? COL.fileText : COL.text2} style={{ flex: 1 }}>{name}</Txt>
      {active ? <CheckPop f={f} at={done} size={24} /> : null}
      {ring ? <Ring f={f} f0={c1.f - 16} f1={c1.f + 10} pad={6} radius={18} /> : null}
    </div>
  );
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <Panel {...P}>
          <div style={{ position: 'absolute', left: 56, top: 40, display: 'flex', alignItems: 'center', gap: 22 }}>
            <IconTile name="folderOpen" size={80} tint="violet" />
            <div>
              <Txt size={42} weight={700}>Sélection du fichier</Txt>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="folder" size={26} color={COL.muted} />
                <Txt size={28} weight={500} color={COL.muted}>Téléchargements</Txt>
              </div>
            </div>
          </div>
          {fileRow(176, <Emblem size={52} />, 'NXT5-Importer-Windows-0.3.8.exe', false)}
          {fileRow(282, <IconTile name="fileJson" size={52} tint="cyan" />, 'nxt5-EUW1_7861632138.json', sel, true)}
          <div style={{ position: 'absolute', right: 56, top: 470, display: 'flex', gap: 20 }}>
            <Btn label="Annuler" size={32} />
            <div style={{ position: 'relative' }}>
              <Btn label="Ouvrir" primary size={32} />
              <Ring f={f} f0={c2.f - 16} f1={c2.f + 10} pad={8} radius={8} />
            </div>
          </div>
        </Panel>
      </div>
      <ScreenCursor f={f} start={[1240, 800]} show={4} clicks={shot.clicks}
        moves={[{ f: 18, dur: 18, to: [1130, 516] }, { f: 62, dur: 16, to: [1436, 696] }]} />
    </AbsoluteFill>
  );
};
