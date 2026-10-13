import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, Lightbulb, Plus, Swords, Users } from "lucide-react";
import { NAV } from "../../app/constants.jsx";
import { cx } from "../../app/helpers.js";
import { TUTORIAL_ACTS, TUTORIAL_CHAPTERS, TUTORIAL_FAQ, TUTORIAL_GLOSSARY, TUTORIAL_PATHS, TUTORIAL_PLAN, TUTORIAL_RIGHTS } from "./tutorial-content.js";
import { TUTORIAL_MOCKS } from "./TutorialMocks.jsx";
import { ChapterContext, FAVICON, Rich, typeset } from "./tutorial-ui.jsx";
import "./tutorial.css";

const STORAGE_KEY = "nxt5_tutorial_v1";
const POSTER = "/assets/home-motion/glass-poster.webp";

function readProgress() {
  try {
    const saved = JSON.parse(globalThis.window?.localStorage?.getItem(STORAGE_KEY) || "{}");
    return { parcours: saved.parcours === "joueur" ? "joueur" : "staff", checks: saved.checks && typeof saved.checks === "object" ? saved.checks : {} };
  } catch {
    return { parcours: "staff", checks: {} };
  }
}

function saveProgress(progress) {
  try { globalThis.window?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Private browsing can disable storage. */ }
}

const reducedMotion = () => Boolean(globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** Scroll inside the tutorial without changing the route or its query. */
function goTo(id) {
  const target = globalThis.document?.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  const heading = target.matches("h2, h3") ? target : target.querySelector("h2, h3");
  heading?.focus({ preventScroll: true });
}

function InPageLink({ target, className, children }) {
  return <a href={`#${target}`} className={className} onClick={(event) => { event.preventDefault(); goTo(target); }}>{children}</a>;
}

/** Shared paint servers: glass outlines, light sweep and gold curve. */
function TutorialDefs({ svgRef }) {
  return <svg ref={svgRef} className="tuto-defs" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="nxt5-tuto-encre" x1="0" y1="1" x2="1" y2="0">
        <stop stopColor="#67e8f9" stopOpacity=".9" />
        <stop offset=".3" stopColor="#dbeafe" />
        <stop offset=".52" stopColor="#c4b5fd" stopOpacity=".95" />
        <stop offset=".76" stopColor="#f1f5f9" />
        <stop offset="1" stopColor="#e879f9" stopOpacity=".9" />
      </linearGradient>
      <linearGradient id="nxt5-tuto-balayage" gradientUnits="userSpaceOnUse" x1="-360" y1="0" x2="0" y2="0">
        <stop stopColor="#ffffff" stopOpacity="0" />
        <stop offset=".55" stopColor="#e0f2fe" stopOpacity="1" />
        <stop offset="1" stopColor="#f5d0fe" stopOpacity="0" />
        <animateTransform attributeName="gradientTransform" type="translate" from="-160 0" to="1900 0" dur="8s" repeatCount="indefinite" />
      </linearGradient>
      <linearGradient id="nxt5-tuto-orbite" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#67e8f9" /><stop offset=".5" stopColor="#c4b5fd" /><stop offset="1" stopColor="#e879f9" />
      </linearGradient>
      <linearGradient id="nxt5-tuto-or" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#67e8f9" /><stop offset=".6" stopColor="#a78bfa" /><stop offset="1" stopColor="#e879f9" />
      </linearGradient>
      <linearGradient id="nxt5-tuto-or-aire" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#8b5cf6" stopOpacity=".38" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
      </linearGradient>
      <filter id="nxt5-tuto-contour" x="-3%" y="-10%" width="106%" height="120%" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceGraphic" operator="dilate" radius="2" result="large" />
        <feComposite in="large" in2="SourceGraphic" operator="out" result="contour" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .1 0" result="verre" />
        <feMerge><feMergeNode in="verre" /><feMergeNode in="contour" /></feMerge>
      </filter>
      <filter id="nxt5-tuto-reflet" x="-3%" y="-14%" width="106%" height="128%" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceGraphic" operator="dilate" radius="2.6" result="large" />
        <feComposite in="large" in2="SourceGraphic" operator="out" result="contour" />
        <feGaussianBlur in="contour" stdDeviation="4" result="halo" />
        <feMerge><feMergeNode in="halo" /><feMergeNode in="contour" /></feMerge>
      </filter>
    </defs>
  </svg>;
}

/** Large outlined word in violet glass; the view box is fitted to the glyphs once fonts are ready. */
function GlassWord({ word }) {
  const text = t(word);
  return <svg className="tuto-mot" viewBox="0 0 1200 210" preserveAspectRatio="xMinYMid meet" aria-hidden="true" focusable="false">
    <text className="tuto-mot-trait" x="8" y="166" fill="url(#nxt5-tuto-encre)" filter="url(#nxt5-tuto-contour)">{text}</text>
    <text className="tuto-mot-reflet" x="8" y="166" fill="url(#nxt5-tuto-balayage)" filter="url(#nxt5-tuto-reflet)">{text}</text>
  </svg>;
}

function fitGlassWords(root) {
  const measure = globalThis.document?.createElement("canvas").getContext?.("2d");
  for (const svg of root.querySelectorAll("svg.tuto-mot")) {
    const text = svg.querySelector(".tuto-mot-trait");
    try {
      const box = text.getBBox();
      if (!box.width) continue;
      let top = box.height * .72;
      let bottom = 0;
      if (measure) {
        measure.font = `800 200px ${getComputedStyle(text).fontFamily}`;
        const metrics = measure.measureText(text.textContent);
        if (metrics.actualBoundingBoxAscent) { top = metrics.actualBoundingBoxAscent; bottom = metrics.actualBoundingBoxDescent; }
      }
      const margin = 8;
      const baseline = Number(text.getAttribute("y"));
      svg.setAttribute("viewBox", `${box.x - margin} ${baseline - top - margin} ${box.width + margin * 2} ${top + bottom + margin * 2}`);
    } catch { /* The word keeps its default frame. */ }
  }
}

function Hero({ navigate }) {
  useLanguage();
  return <section className="tuto-hero" aria-labelledby="tuto-titre">
    <div className="tuto-hero-texte">
      <p className="tuto-surtitre">{t("Tutoriel")} <span aria-hidden="true">·</span> {t("Joue. Analyse. Recommence.")}</p>
      <h2 id="tuto-titre" tabIndex={-1}>{t("De ta première partie")} <span className="tuto-degrade">{t("à ta prochaine séance.")}</span></h2>
      <p className="tuto-chapeau">{typeset(t("Le tour complet de NXT5 en quinze chapitres : monter l’équipe, importer une partie, la lire ensemble, préparer la draft et partager le bilan. Suis l’ordre, ou va directement à la rubrique qui t’intéresse."))}</p>
      <div className="tuto-actions">
        <InPageLink target="tuto-depart" className="tuto-btn tuto-btn-cta">{t("Commencer le parcours")}<ArrowDown aria-hidden="true" /></InPageLink>
        <button type="button" className="tuto-btn tuto-btn-verre" onClick={() => navigate?.("/guide")}><ArrowLeft aria-hidden="true" />{t("Rubriques du guide")}</button>
      </div>
      <dl className="tuto-faits">
        <div><dt>{t("Actes")}</dt><dd>3</dd></div>
        <div><dt>{t("Chapitres")}</dt><dd>15</dd></div>
        <div><dt>{t("Équipe d’exemple")}</dt><dd>Horizon</dd></div>
      </dl>
    </div>
    <div className="tuto-orbite">
      <svg className="tuto-orbite-arriere" viewBox="0 0 100 92" aria-hidden="true" focusable="false">
        <ellipse className="tuto-anneau-halo" cx="50" cy="53" rx="46" ry="13" />
        <ellipse className="tuto-anneau" cx="50" cy="53" rx="46" ry="13" />
        <ellipse className="tuto-comete-trace" cx="50" cy="53" rx="46" ry="13" pathLength="100" stroke="url(#nxt5-tuto-orbite)" />
        <ellipse className="tuto-comete" cx="50" cy="53" rx="46" ry="13" pathLength="100" stroke="url(#nxt5-tuto-orbite)" />
      </svg>
      <div className="tuto-cinq" aria-hidden="true">
        <div className="tuto-cinq-flotte"><img src={POSTER} alt="" width="729" height="665" decoding="async" /><span className="tuto-cinq-reflet" /></div>
      </div>
      <svg className="tuto-orbite-avant" viewBox="0 0 100 92" aria-hidden="true" focusable="false">
        <ellipse className="tuto-anneau-halo" cx="50" cy="53" rx="46" ry="13" />
        <ellipse className="tuto-anneau" cx="50" cy="53" rx="46" ry="13" />
        <ellipse className="tuto-comete-trace" cx="50" cy="53" rx="46" ry="13" pathLength="100" stroke="url(#nxt5-tuto-orbite)" />
        <ellipse className="tuto-comete" cx="50" cy="53" rx="46" ry="13" pathLength="100" stroke="url(#nxt5-tuto-orbite)" />
      </svg>
      {TUTORIAL_ACTS.map((act) => <InPageLink key={act.id} target={`tuto-${act.id}`} className={cx("tuto-noeud", `is-${act.id}`)}><b aria-hidden="true">{act.numeral}</b>{t(act.word)}</InPageLink>)}
      <p className="tuto-orbite-legende" aria-hidden="true">{t("La boucle d’une équipe")}</p>
    </div>
  </section>;
}

function Depart({ progress, setProgress }) {
  useLanguage();
  const items = TUTORIAL_PATHS[progress.parcours];
  const done = items.filter((item) => progress.checks[item.id]).length;
  const chapterNumber = (id) => TUTORIAL_CHAPTERS.find((chapter) => chapter.id === id)?.num;
  const choose = (parcours) => setProgress((current) => ({ ...current, parcours }));
  const toggle = (id, checked) => setProgress((current) => ({ ...current, checks: { ...current.checks, [id]: checked } }));
  const navIcon = (label) => NAV.find((item) => item.label === label)?.icon || Users;
  return <section id="tuto-depart" className="tuto-depart" aria-labelledby="tuto-depart-titre">
    <div className="tuto-titre-section">
      <p className="tuto-etiquette">{t("Avant de commencer")}</p>
      <h2 id="tuto-depart-titre" tabIndex={-1}>{t("Choisis ton point de départ.")}</h2>
      <p>{typeset(t("NXT5 ne propose pas le même premier parcours au responsable et au joueur. Choisis le tien : les chapitres utiles portent ensuite la mention « Pour toi »."))}</p>
    </div>
    <div className="tuto-depart-grille">
      <div className="tuto-depart-choix">
        <fieldset className="tuto-parcours">
          <legend className="sr-only">{t("Ton rôle dans l’équipe")}</legend>
          {[["staff", Users, "Je gère l’équipe", "Propriétaire, capitaine, coach ou staff autorisé. Tu crées l’espace, importes les parties et invites les joueurs."],
            ["joueur", Swords, "Je rejoins mon équipe", "Joueur ou joueuse. Tu utilises l’invitation reçue, découvres ton profil et donnes tes disponibilités."]].map(([value, Icon, title, text]) =>
            <label key={value} className={cx("tuto-parcours-carte", progress.parcours === value && "is-choisi")}>
              <input type="radio" name="nxt5-tuto-parcours" value={value} checked={progress.parcours === value} onChange={() => choose(value)} />
              <span className="tuto-parcours-coche" aria-hidden="true"><Check /></span>
              <span className="tuto-parcours-icone" aria-hidden="true"><Icon /></span>
              <strong>{t(title)}</strong>
              <span>{t(text)}</span>
            </label>)}
        </fieldset>
        <div className="tuto-soiree">
          <div className="tuto-soiree-tete"><h3>{t("Ta première soirée sur NXT5")}</h3><span className="tuto-soiree-compte" aria-live="polite">{done} / {items.length}</span></div>
          <svg className="tuto-jauge" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect className="tuto-jauge-fond" width="100" height="4" rx="2" /><rect width={(done / items.length) * 100} height="4" rx="2" fill="url(#nxt5-tuto-orbite)" /></svg>
          <ol>
            {items.map((item) => <li key={item.id}>
              <input type="checkbox" id={`nxt5-tuto-${item.id}`} checked={Boolean(progress.checks[item.id])} onChange={(event) => toggle(item.id, event.target.checked)} />
              <label htmlFor={`nxt5-tuto-${item.id}`}>{t(item.label)}</label>
              <InPageLink target={`tuto-${item.chapter}`} className="tuto-soiree-lien">{t("Chapitre {0}", [chapterNumber(item.chapter)])}<ArrowRight aria-hidden="true" /></InPageLink>
            </li>)}
          </ol>
          <p className="tuto-note">{t("Tes coches restent dans ce navigateur uniquement.")}</p>
        </div>
      </div>
      <nav className="tuto-plan" aria-label={t("Le plan de ton espace")}>
        <div className="tuto-plan-tete"><img src={FAVICON} alt="" width="34" height="34" loading="lazy" decoding="async" /><div><strong>{t("Le plan de ton espace")}</strong><span>{t("Les rubriques de la navigation NXT5")}</span></div></div>
        {TUTORIAL_PLAN.map((group) => <div key={group.group} className="tuto-plan-groupe">
          <p>{t(group.group)}</p>
          <ul>{group.items.map((item) => { const Icon = navIcon(item.label); return <li key={item.label}>
            <InPageLink target={`tuto-${item.chapter}`} className="tuto-plan-lien"><Icon aria-hidden="true" /><span><strong>{t(item.label)}</strong><small>{t(item.hint)}</small></span><em>{chapterNumber(item.chapter)}</em></InPageLink>
          </li>; })}</ul>
        </div>)}
      </nav>
    </div>
  </section>;
}

function Chapter({ chapter, index, parcours, navigate }) {
  useLanguage();
  const [active, setActive] = useState(null);
  const context = useMemo(() => ({ active, activate: setActive }), [active]);
  const Mock = TUTORIAL_MOCKS[chapter.mock];
  const forYou = chapter.for.includes("tous") || chapter.for.includes(parcours);
  const titleId = `tuto-${chapter.id}-titre`;
  return <ChapterContext.Provider value={context}>
    <article id={`tuto-${chapter.id}`} className={cx("tuto-chapitre", index % 2 === 1 && "is-inverse")} aria-labelledby={titleId}>
      <div className="tuto-ch-texte">
        <div className="tuto-ch-meta">
          <span className="tuto-ch-num" aria-hidden="true">{chapter.num}</span>
          <span className="tuto-ch-rubrique"><b>{chapter.rubric.map((label) => t(label)).join(" › ")}</b><span>{chapter.where}</span></span>
          {forYou && <span className="tuto-pour-toi">{t("Pour toi")}</span>}
        </div>
        <h3 id={titleId} className="tuto-ch-titre" tabIndex={-1}><span className="sr-only">{t("Chapitre {0}", [chapter.num])} · </span>{t(chapter.title)}</h3>
        <p className="tuto-ch-intro">{typeset(chapter.intro.map((sentence) => t(sentence)).join(" "))}</p>
        <ol className="tuto-etapes" onMouseLeave={() => setActive(null)}>
          {chapter.steps.map((step, position) => <li key={step.lead} className={cx(step.z && "has-zone", step.z && active === step.z && "is-actif")}
            onMouseEnter={step.z ? () => setActive(step.z) : undefined} onClick={step.z ? () => setActive(step.z) : undefined}>
            <span className="tuto-pastille" aria-hidden="true">{position + 1}</span>
            <p><strong><Rich text={step.lead} values={step.values} /></strong> <Rich text={step.text} values={step.values} /></p>
          </li>)}
        </ol>
        <aside className="tuto-retenir"><Lightbulb aria-hidden="true" /><p><strong><Rich text={chapter.tip.lead} values={chapter.tip.values} /></strong> <Rich text={chapter.tip.text} values={chapter.tip.values} /></p></aside>
        <button type="button" className="tuto-lien" onClick={() => navigate?.(chapter.link.path)}>{t(chapter.link.label)}<ArrowRight aria-hidden="true" /></button>
      </div>
      <figure className="tuto-ecran">
        <Mock />
        <figcaption>{chapter.demo && <span className="tuto-essai">{t("Essaie")}</span>}{t(chapter.caption)}</figcaption>
      </figure>
    </article>
  </ChapterContext.Provider>;
}

function Act({ act, parcours, navigate }) {
  useLanguage();
  const chapters = TUTORIAL_CHAPTERS.filter((chapter) => chapter.act === act.id);
  const firstIndex = TUTORIAL_CHAPTERS.indexOf(chapters[0]);
  return <section id={`tuto-${act.id}`} className="tuto-acte" aria-labelledby={`tuto-${act.id}-titre`}>
    <header className="tuto-acte-tete">
      <p className="tuto-acte-num">{t("Acte {0} · Chapitres {1} à {2}", [act.numeral, act.from, act.to])}</p>
      <h2 id={`tuto-${act.id}-titre`} className="tuto-acte-titre" tabIndex={-1}><span className="sr-only">{t("Acte {0} : {1}", [act.numeral, t(act.word)])}</span><GlassWord word={act.word} /></h2>
      <p className="tuto-acte-promesse">{t(act.promise)}</p>
      <ol className="tuto-sommaire">{chapters.map((chapter) => <li key={chapter.id}><InPageLink target={`tuto-${chapter.id}`} className="tuto-sommaire-lien"><b>{chapter.num}</b>{t(chapter.short)}</InPageLink></li>)}</ol>
    </header>
    {chapters.map((chapter, position) => <Chapter key={chapter.id} chapter={chapter} index={firstIndex + position} parcours={parcours} navigate={navigate} />)}
  </section>;
}

function HelpSection() {
  useLanguage();
  return <section id="tuto-aide" className="tuto-aide" aria-labelledby="tuto-aide-titre">
    <div className="tuto-titre-section">
      <p className="tuto-etiquette">{t("Accès, dépannage et vocabulaire")}</p>
      <h2 id="tuto-aide-titre" tabIndex={-1}>{t("Quand quelque chose bloque.")}</h2>
      <p>{t("Ton rôle dans l’équipe détermine ce que tu peux consulter ou modifier. Si une action nécessaire reste bloquée, demande au propriétaire de l’équipe de vérifier tes droits.")}</p>
    </div>
    <div className="tuto-aide-grille">
      <div className="tuto-bloc">
        <h3>{t("Qui fait quoi")}</h3>
        <p>{t("Les actions réservées, telles que NXT5 les décrit.")}</p>
        <ul className="tuto-droits">{TUTORIAL_RIGHTS.map((right) => <li key={right.action}>
          <span>{t(right.action)}</span>
          <span className="tuto-qui">{right.who.map((who) => <i key={who} className={cx(right.everyone && "is-tous")}>{t(who)}</i>)}</span>
          {right.note && <small>{t(right.note)}</small>}
        </li>)}</ul>
      </div>
      <div className="tuto-bloc tuto-faq">
        <h3>{t("Dépannage")}</h3>
        <p>{t("Commence toujours par recharger la page une fois, puis vérifie l’équipe et le profil affichés.")}</p>
        {TUTORIAL_FAQ.map(([question, answer]) => <details key={question}><summary>{t(question)}<Plus aria-hidden="true" /></summary><p>{typeset(t(answer))}</p></details>)}
      </div>
    </div>
    <div className="tuto-bloc tuto-glossaire">
      <h3>{t("Les mots de l’équipe")}</h3>
      <p>{t("Le vocabulaire que tu croiseras dans NXT5.")}</p>
      <dl>{TUTORIAL_GLOSSARY.map(([term, meaning]) => <div key={term}><dt>{t(term)}</dt><dd>{typeset(t(meaning))}</dd></div>)}</dl>
    </div>
  </section>;
}

function Finale({ navigate }) {
  useLanguage();
  return <section className="tuto-finale" aria-labelledby="tuto-finale-titre">
    <img className="tuto-finale-cinq" src={POSTER} alt="" width="729" height="665" loading="lazy" decoding="async" />
    <div className="tuto-finale-texte">
      <p className="tuto-surtitre">{t("La prochaine partie vous attend")}</p>
      <h2 id="tuto-finale-titre"><span className="sr-only">{t("Entrez à cinq.")} {t("Avancez ensemble.")}</span><GlassWord word="Entrez à cinq." /><span aria-hidden="true">{t("Avancez ensemble.")}</span></h2>
      <p>{t("Une partie importée, un fait, une question, une action. Puis on rejoue, et on vérifie.")}</p>
      <div className="tuto-actions">
        <button type="button" className="tuto-btn tuto-btn-cta" onClick={() => navigate?.("/games?import=1")}>{t("Importer une partie")}<ArrowRight aria-hidden="true" /></button>
        <button type="button" className="tuto-btn tuto-btn-verre" onClick={() => navigate?.("/guide")}><ArrowLeft aria-hidden="true" />{t("Rubriques du guide")}</button>
      </div>
    </div>
  </section>;
}

export default function TutorialPage({ navigate }) {
  const language = useLanguage();
  const rootRef = useRef(null);
  const defsRef = useRef(null);
  const [progress, setProgressState] = useState(readProgress);
  const setProgress = useCallback((update) => setProgressState((current) => {
    const next = typeof update === "function" ? update(current) : update;
    saveProgress(next);
    return next;
  }), []);

  // Fit the glass words to their glyphs, again when the language changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof document === "undefined") return undefined;
    let cancelled = false;
    const fit = () => { if (!cancelled) fitGlassWords(root); };
    fit();
    document.fonts?.load?.("800 200px Inter").then(fit, fit);
    return () => { cancelled = true; };
  }, [language]);

  // Light passes over the screens as they arrive, and the glass sweep pauses off screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const arrivals = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.dataset.vu = "1"; arrivals.unobserve(entry.target); }
    }, { threshold: .25 });
    root.querySelectorAll(".tuto-chapitre").forEach((chapter) => arrivals.observe(chapter));
    const visible = new Set();
    const sweep = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
      try { visible.size && !reducedMotion() ? defsRef.current?.unpauseAnimations() : defsRef.current?.pauseAnimations(); } catch { /* SMIL unavailable. */ }
    });
    root.querySelectorAll("svg.tuto-mot").forEach((word) => sweep.observe(word));
    return () => { arrivals.disconnect(); sweep.disconnect(); };
  }, []);

  // A copied link to a chapter opens that chapter once the page is drawn.
  useEffect(() => {
    const hash = globalThis.location?.hash || "";
    if (!hash.startsWith("#tuto-")) return undefined;
    const frame = requestAnimationFrame(() => goTo(decodeURIComponent(hash.slice(1))));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div ref={rootRef} className="nxt5-tutorial">
    <TutorialDefs svgRef={defsRef} />
    <Hero navigate={navigate} />
    <Depart progress={progress} setProgress={setProgress} />
    {TUTORIAL_ACTS.map((act) => <Act key={act.id} act={act} parcours={progress.parcours} navigate={navigate} />)}
    <HelpSection />
    <Finale navigate={navigate} />
  </div>;
}
