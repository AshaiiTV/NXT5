import React, { useId, useMemo } from "react";
import { ArrowUpRight, ChevronDown, Compass, Crosshair, Eye, FileText, Flag, Users } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { buildPlaystyleAnalysis } from "../../utils/playstyle-analysis.js";
import { matchDisplayName } from "../../utils/matches.js";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Surface } from "../ui/Core.jsx";
import "./playstyle-analysis.css";

const EMPTY = [];
const METRICS = {
  gold10: { label: "Écart d’or à 10 min", digits: 0, signed: true, unit: "or" },
  fightPace: { label: "Éliminations des deux équipes / min", digits: 2 },
  deaths: { label: "Morts de l’équipe / partie", digits: 1 },
  deathDiff: { label: "Écart de morts / partie", digits: 1, signed: true },
  visionDiffPerMin: { label: "Écart de score de vision / min", digits: 2, signed: true },
  dragonShare: { label: "Part des dragons pris", digits: 1, percent: true },
  baronShare: { label: "Part des Nashors pris", digits: 1, percent: true },
  towerDiff: { label: "Écart de tours détruites / partie", digits: 1, signed: true },
};
const ROLE_METRICS = {
  goldShare: { label: "Part de l’or de l’équipe", digits: 1, percent: true },
  damageShare: { label: "Part des dégâts aux champions", digits: 1, percent: true },
  cs10Diff: { label: "Écart de CS à 10 min", digits: 1, signed: true },
  kp: { label: "Participation aux éliminations", digits: 1, percent: true },
  visionPerMin: { label: "Score de vision / min", digits: 2 },
  deaths: { label: "Morts / partie", digits: 1 },
};
const ROLE_LABELS = { TOP: "Top", JGL: "Jungle", MID: "Mid", ADC: "ADC", SUP: "Support" };
const EXPERIMENTS = {
  early: {
    title: "Tester la préparation des dix premières minutes",
    action: "Sur les 3 prochaines parties, annoncer le premier retour à la base et le côté joué par la jungle. Revoir ensuite un extrait avant 10 min dans chaque partie.",
    check: "Noter l’écart d’or et de CS à 10 min, puis les vagues et déplacements visibles dans la VOD. Chercher ce qui change, sans attribuer l’écart à une seule décision.",
  },
  combat: {
    title: "Rendre les décisions de combat explicites",
    action: "Sur les 3 prochaines parties, annoncer ensemble le choix avant un combat : engager, temporiser ou reculer. Garder un extrait par partie pour le débrief.",
    check: "Revoir les positions au moment de l’annonce, les joueurs présents et les morts qui suivent. Le total de morts seul ne permet pas de juger la décision.",
  },
  vision: {
    title: "Tester une préparation collective de la rivière",
    action: "Sur les 3 prochaines parties, choisir une préparation d’objectif et annoncer la zone à contrôler 45 secondes avant. Désigner qui pose la vision et qui peut accompagner.",
    check: "Revoir la vision réellement disponible, les positions et les entrées en rivière. Un meilleur score de vision ne suffit pas à valider la préparation.",
  },
  objectives: {
    title: "Expliciter le choix autour du dragon",
    action: "Sur les 3 prochaines parties, annoncer 45 secondes avant un dragon le choix collectif : le contester, l’échanger ou le céder. Conserver un extrait par partie.",
    check: "Comparer les vagues, les joueurs disponibles et l’information avant la décision. La part de dragons pris ne dit pas si chaque contestation était souhaitable.",
  },
  resources: {
    title: "Vérifier le plan autour du rôle le plus alimenté",
    action: "Avant les 3 prochaines parties, préciser quel rôle doit recevoir les ressources et comment l’équipe l’accompagne. Garder un extrait de transition vers un combat par partie.",
    check: "Comparer le plan annoncé aux parts d’or finales et aux positions en combat. Les dégâts aux champions décrivent une contribution, pas la valeur du joueur ni l’efficacité de son or.",
  },
  observe: {
    title: "Construire un point de comparaison sur trois parties",
    action: "Choisir un seul constat chiffré ci-dessous avec l’équipe. Garder la même consigne pendant les 3 prochaines parties et un extrait VOD par partie pour le vérifier.",
    check: "Comparer la même mesure, sa couverture et le contexte des extraits. Une seule partie ne suffit pas à identifier une habitude.",
  },
  data: {
    title: "Compléter les données avant de choisir une consigne",
    action: "Vérifier les participants et les statistiques des imports. Ajouter 3 parties exploitables ; joindre une chronologie pour examiner les dix premières minutes.",
    check: "Une donnée absente reste indisponible. Les pistes de jeu apparaissent à partir des mesures réellement renseignées.",
  },
};

function formatValue(value, definition, locale) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(definition.digits));
  const number = new Intl.NumberFormat(locale, {
    style: definition.percent ? "percent" : "decimal",
    maximumFractionDigits: definition.digits,
    minimumFractionDigits: definition.digits,
    signDisplay: definition.signed ? "exceptZero" : "auto",
  }).format(definition.percent ? rounded / 100 : rounded);
  return definition.unit ? `${number} ${t(definition.unit)}` : number;
}

const coverage = (count, games) => t(games === 1 ? "{0} / {1} partie mesurée" : "{0} / {1} parties mesurées", [count, games]);
const matchKey = (match) => match?.id != null && String(match.id).trim() ? `id:${match.id}` : match?.game_id != null && String(match.game_id).trim() ? `game:${match.game_id}` : match;
const uniqueMatches = (measurements) => [...new Set(measurements.flatMap((metric) => metric.matches))];

function Measurements({ items, games, locale }) {
  return <dl className="playstyle-measurements">{items.map(({ key, metric, definition }) => <div key={key}>
    <dt>{t(definition.label)}<span>{coverage(metric.count, games)}</span></dt>
    <dd>{formatValue(metric.value, definition, locale)}</dd>
  </div>)}</dl>;
}

function SourcesButton({ entries, games, model, sourceGames, onOpenSources, locale, title }) {
  if (!onOpenSources) return null;
  const matches = uniqueMatches(entries.map((entry) => entry.metric));
  const open = () => {
    const knownSources = new Map(sourceGames.map((game) => [matchKey(game.match || game), game]));
    onOpenSources({
      title: t("Sources du style de jeu"), subtitle: title, playstyle: true,
      metrics: [{ label: "Parties mesurées", value: coverage(matches.length, games) }, { label: "Sélection", value: t(model.games === 1 ? "{0} partie sélectionnée" : "{0} parties sélectionnées", [model.games]) }],
      games: matches.map((match) => ({
        ...(knownSources.get(matchKey(match)) || { id: match.id || match.game_id || "", match, title: matchDisplayName(match, t("Partie")), result: match.result || t("Résultat inconnu"), duration: match.duration || "—", side: "—", patch: match.patch || "—" }),
        match,
        playstyleEvidence: entries.flatMap(({ metric, definition, prefix }) => {
          const observation = metric.observations.find((item) => item.match === match);
          return observation ? [{ label: prefix ? t("{0} · {1}", [t(ROLE_LABELS[prefix]), t(definition.label)]) : t(definition.label), value: formatValue(observation.value, definition, locale) }] : [];
        }),
        playstyleRead: t("Mesures de cette partie. Les moyennes portent uniquement sur les parties renseignées."),
      })),
    });
  };
  return <button type="button" className="playstyle-link" disabled={!matches.length} onClick={open}>
    <FileText aria-hidden="true" />{t("Voir les parties mesurées")}<ArrowUpRight aria-hidden="true" />
  </button>;
}

function Axis({ id, icon: Icon, title, children, entries, sourceEntries = entries, sourceProps, method, review }) {
  return <section className="playstyle-axis" aria-labelledby={id}>
    <h4 id={id}><Icon aria-hidden="true" />{t(title)}</h4>
    <div className="playstyle-axis-reading">{children}</div>
    <Measurements items={entries} games={sourceProps.games} locale={sourceProps.locale} />
    <div className="playstyle-axis-actions"><SourcesButton entries={sourceEntries} title={t(title)} {...sourceProps} /></div>
    <details className="playstyle-disclosure"><summary>{t("Comment vérifier ce constat")}<ChevronDown aria-hidden="true" /></summary>
      <div><p>{t(method)}</p><p className="playstyle-review"><strong>{t("À revoir avec l’équipe : ")}</strong>{t(review)}</p></div>
    </details>
  </section>;
}

function roleReview(role) {
  if (role.role === "SUP" && role.metrics.visionPerMin.count) return t("Revoir trois préparations d’objectif : vision réellement disponible, accompagnement et entrées en rivière. Le score de vision ne décrit pas toute la préparation.");
  if (role.metrics.cs10Diff.count) return role.role === "JGL"
    ? t("Revoir trois extraits avant 10 min : camps pris, retours à la base et déplacements. Les CS de la jungle incluent les monstres ; ils ne résument pas l’utilité des actions sur les voies.")
    : t("Revoir trois extraits avant 10 min : vagues, échanges et premier retour à la base. Comparer le contexte avec le rôle adverse, sans déduire la qualité de la lane du seul écart de CS.");
  if (role.metrics.kp.count) return t("Revoir trois actions collectives : position du rôle, possibilité de rejoindre et choix annoncé. La participation aux éliminations ne juge pas les décisions de jeu sur une voie latérale.");
  if (role.metrics.goldShare.count) return t("Avant la prochaine partie, préciser la place de ce rôle dans le plan de ressources. Vérifier ensuite les vagues reçues et les déplacements, au-delà de sa part d’or finale.");
  if (role.metrics.deaths.count) return t("Choisir trois situations de mort et revoir les positions et l’information disponibles. Le nombre de morts seul ne permet pas de juger les prises de risque.");
  return t("Compléter les statistiques de ce rôle avant de lui attribuer une consigne de jeu.");
}

export function PlaystyleAnalysis({ matches = EMPTY, players = EMPTY, sourceGames = EMPTY, onOpenSources, onOpenContracts }) {
  useLanguage();
  const id = useId();
  const locale = getLocale();
  const model = useMemo(() => buildPlaystyleAnalysis(matches, players), [matches, players]);
  const m = model.metrics;
  const entry = (key) => ({ key, metric: m[key], definition: METRICS[key] });
  const sourceProps = { games: model.games, model, sourceGames, onOpenSources, locale };
  const focus = model.resourceFocus;
  const focusRole = focus ? model.roles.find((role) => role.role === focus.role) : null;
  const resourceEntries = focusRole ? ["goldShare", "damageShare"].map((key) => ({ key, metric: focusRole.metrics[key], definition: ROLE_METRICS[key], prefix: focus.role })) : [];
  const allResourceEntries = model.roles.flatMap((role) => ["goldShare", "damageShare"].map((key) => ({ key: `${role.role}-${key}`, metric: role.metrics[key], definition: ROLE_METRICS[key], prefix: role.role })));
  const experiment = EXPERIMENTS[model.priority];
  const priorityEvidence = model.priority === "early" ? t("Retard d’or à 10 min dans {0} / {1} parties mesurées.", [m.gold10.negative, m.gold10.count])
    : model.priority === "combat" ? t("Plus de morts que l’adversaire dans {0} / {1} parties mesurées.", [m.deathDiff.positive, m.deathDiff.count])
    : model.priority === "vision" ? t("Score de vision par minute inférieur dans {0} / {1} parties mesurées.", [m.visionDiffPerMin.negative, m.visionDiffPerMin.count])
    : model.priority === "objectives" ? t("Moins de la moitié des dragons pris dans {0} / {1} parties mesurées.", [model.lowerDragonShare, m.dragonShare.count])
    : model.priority === "resources" ? t("La plus grande part d’or revient au rôle {0} dans {1} / {2} parties mesurées.", [t(ROLE_LABELS[focus.role]), focus.count, focus.total])
    : t("La sélection ne fait pas encore ressortir un constat répété assez nettement pour choisir une priorité automatique.");

  return <Surface className="playstyle-surface"><section className="playstyle-analysis" aria-labelledby={`${id}-title`}>
    <header className="playstyle-heading"><div><h3 id={`${id}-title`}><Compass aria-hidden="true" />{t("Style de jeu observé")}</h3>
      <p>{t("Ce que l’équipe fait dans cette sélection, puis une expérience à vérifier ensemble.")}</p></div>
      <span>{t(model.games === 1 ? "{0} partie sélectionnée" : "{0} parties sélectionnées", [model.games])}</span>
    </header>
    <p className="playstyle-context">{t("Chaque chiffre garde son propre échantillon. Les écarts comparent notre équipe aux adversaires ; ils ne prouvent pas pourquoi une partie est gagnée ou perdue.")}</p>
    {model.games < 3 && <p className="playstyle-sample" role="status">{t("Moins de 3 parties : ces constats ne suffisent pas à identifier une habitude.")}</p>}
    {!model.metricsAvailable && <p className="playstyle-empty" role="status">{t("Les statistiques renseignées ne permettent pas encore de décrire le style de jeu de cette sélection.")}</p>}

    <section className="playstyle-experiment" aria-labelledby={`${id}-experiment`}>
      <p className="playstyle-eyebrow">{t("Une expérience pour la prochaine session")}</p>
      <h4 id={`${id}-experiment`}>{t(experiment.title)}</h4>
      {model.priority !== "data" && <p className="playstyle-evidence">{priorityEvidence}</p>}
      <p>{t(experiment.action)}</p>
      <details className="playstyle-disclosure"><summary>{t("Comment débriefer l’expérience")}<ChevronDown aria-hidden="true" /></summary><div><p>{t(experiment.check)}</p><p>{t("Cette proposition est un point de départ pour le staff, pas un objectif déjà validé.")}</p></div></details>
    </section>

    <div className="playstyle-axes">
      <Axis id={`${id}-resources`} icon={Users} title="Ressources et contributions" entries={resourceEntries} sourceEntries={allResourceEntries} sourceProps={sourceProps}
        method="Les parts sont calculées par partie puis moyennées. Elles exigent cinq alliés et toutes les valeurs connues. Les ex æquo ne désignent aucun rôle le plus alimenté."
        review="Comparer le plan de ressources annoncé, les vagues reçues et les positions en combat. La part des dégâts ne mesure pas le rendement de l’or ni la valeur d’un rôle.">
        {focus ? <><p className="playstyle-finding">{t("La plus grande part d’or revient au rôle {0} dans {1} / {2} parties mesurées.", [t(ROLE_LABELS[focus.role]), focus.count, focus.total])}</p><p>{t("Les deux mesures ci-dessous décrivent ce rôle. Leurs couvertures peuvent différer.")}</p></>
          : <p>{model.resourceGames.length ? t("Aucun rôle ne reçoit seul la plus grande part d’or plus souvent que les autres dans cette sélection.") : t("La répartition des ressources exige cinq alliés et des statistiques complètes.")}</p>}
        <p className="playstyle-secondary">{coverage(model.resourceGames.length, model.games)}{model.resourceTies > 0 && <> · {t("{0} partie(s) avec des rôles ex æquo", [model.resourceTies])}</>}</p>
      </Axis>
      <Axis id={`${id}-combat`} icon={Eye} title="Combats et vision" entries={[entry("fightPace"), entry("deaths"), entry("visionDiffPerMin")]} sourceEntries={[entry("fightPace"), entry("deaths"), entry("deathDiff"), entry("visionDiffPerMin")]} sourceProps={sourceProps}
        method="Le rythme compte les éliminations des deux équipes par minute. Les morts d’équipe exigent cinq alliés ; les écarts de vision exigent dix scores et une durée connue."
        review="Revoir trois combats ou entrées en rivière : positions, joueurs présents, information disponible et choix collectif annoncé.">
        {m.deathDiff.count ? <p className="playstyle-finding">{t("Plus de morts que l’adversaire dans {0} / {1} parties mesurées.", [m.deathDiff.positive, m.deathDiff.count])}</p> : <p>{t("Les données complètes des deux équipes manquent pour comparer les morts.")}</p>}
        <p>{t("Le score de vision ne mesure pas toute l’information disponible. Le rythme des éliminations ne dit pas qui a choisi les combats.")}</p>
      </Axis>
      <Axis id={`${id}-objectives`} icon={Flag} title="Objectifs pris" entries={[entry("dragonShare"), entry("towerDiff")]} sourceProps={sourceProps}
        method="Seuls les compteurs explicites des deux équipes sont utilisés. La part des dragons est moyennée par partie où au moins un dragon est pris. Une timeline vide ou partielle ne devient jamais zéro prise."
        review="Revoir les choix de contestation et d’échange avec les vagues, les joueurs disponibles et l’information avant l’objectif.">
        <p>{t("Ces chiffres décrivent les objectifs obtenus, pas la qualité de chaque décision de contestation.")}</p>
      </Axis>
    </div>

    <section className="playstyle-roles" aria-labelledby={`${id}-roles`}>
      <h4 id={`${id}-roles`}><Crosshair aria-hidden="true" />{t("La place de chaque rôle")}</h4>
      <p>{t("Les mesures regroupent les joueurs ayant occupé ce poste, y compris les remplaçants. Elles ne constituent pas un classement de performance.")}</p>
      <div>{model.roles.map((role) => {
        const entries = Object.entries(ROLE_METRICS).map(([key, definition]) => ({ key, metric: role.metrics[key], definition, prefix: role.role }));
        return <details key={role.role} className="playstyle-role playstyle-disclosure" data-role={role.role}>
          <summary><span className="playstyle-role-identity"><RoleIcon role={role.role} lightweight /><strong>{t(ROLE_LABELS[role.role])}</strong><span>{t(model.games === 1 ? "{0} / {1} partie à ce poste" : "{0} / {1} parties à ce poste", [role.games, model.games])}</span></span><ChevronDown aria-hidden="true" /></summary>
          <div>{role.players.length > 0 && <p className="playstyle-roster">{t("Profils du roster à ce poste : {0}", [role.players.join(", ")])}</p>}
            <Measurements items={entries} games={model.games} locale={locale} />
            <p className="playstyle-review"><strong>{t("Piste à tester : ")}</strong>{roleReview(role)}</p>
            <SourcesButton entries={entries} title={t("La place de chaque rôle")} {...sourceProps} />
          </div>
        </details>;
      })}</div>
    </section>
    <footer className="playstyle-footer">
      {onOpenContracts && <button type="button" className="playstyle-link" onClick={onOpenContracts}><Users aria-hidden="true" />{t("Consulter les propositions d’objectifs par joueur")}<ArrowUpRight aria-hidden="true" /></button>}
      <details className="playstyle-disclosure playstyle-method"><summary>{t("Méthode et limites de cette lecture")}<ChevronDown aria-hidden="true" /></summary><div>
        <p>{t("Chaque moyenne utilise uniquement ses parties mesurées. « — » indique une donnée absente ; zéro reste un zéro mesuré. Les mesures par minute exigent une durée connue.")}</p>
        <p>{t("Une répétition est signalée à partir de 3 parties mesurées et d’un même constat dans au moins deux tiers d’entre elles. Ce repère de lecture n’est pas un seuil de significativité statistique.")}</p>
        <p>{t("Les CS à 10 min comptent les sbires et monstres tués, comparés au même rôle adverse. Les parts d’or et de dégâts sont des statistiques finales ; elles ne révèlent ni les intentions de draft ni la causalité d’une victoire.")}</p>
        <p>{t("Une participation aux éliminations reste indisponible lorsque l’équipe n’a aucune élimination. Les rôles absents ou ambigus ne reçoivent aucune mesure attribuée par défaut.")}</p>
        <Measurements items={[entry("deathDiff"), entry("baronShare")]} games={model.games} locale={locale} />
        <SourcesButton entries={[entry("gold10"), ...allResourceEntries, ...["fightPace", "deaths", "deathDiff", "visionDiffPerMin", "dragonShare", "baronShare", "towerDiff"].map(entry)]} title={t("Méthode et limites de cette lecture")} {...sourceProps} />
      </div></details>
    </footer>
  </section></Surface>;
}
