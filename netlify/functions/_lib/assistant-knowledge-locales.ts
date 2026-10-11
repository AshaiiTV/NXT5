import type { AssistantKnowledgeEntry } from './assistant-knowledge';

type Translation = Omit<AssistantKnowledgeEntry, 'id' | 'path'>;

export const ASSISTANT_TRANSLATIONS: Record<string, Record<string, Translation>> = {
  en: {
    'getting-started': {
      title: 'Getting started with NXT5', actionLabel: 'Open Home',
      summary: 'Home suggests the next step based on your role and team activity: initial setup, a game to review, availability or player follow-up.',
      keywords: ['start', 'begin', 'first time', 'guide', 'help', 'use the site', 'home', 'next step'],
      steps: ['Create a team or join one with a temporary code.', 'Follow the next step on Home. Player profiles can be prepared in Team management or created during import.', 'In Games, import the JSON file and link the five positions to five different profiles before confirming.', 'Read the game summary, then prepare a debrief with the points to work on.'],
      suggestions: ['How do I import my first game?', 'How do I add players?', 'How do I prepare a useful debrief?'],
    },
    'teams-and-roster': {
      title: 'Team, players and access', actionLabel: 'Manage the team',
      summary: 'Team shows the players and staff. Team management lets you add profiles, choose starters and substitutes, link accounts and manage access.',
      keywords: ['team', 'roster', 'player', 'staff', 'starter', 'starters', 'main team', 'substitute', 'substitutes', 'riot id', 'opgg', 'invitation', 'link account', 'rename', 'access', 'data health', 'reliability'],
      steps: ['Open Team management from Team or the button at the top of the app.', 'Add the profile and position, then choose Starter or Substitute in Roster.', 'Link the correct NXT5 account to the player profile once the person has an account.', 'Check the assigned role before sharing an invitation code.'],
      suggestions: ['How do I add a player?', 'How do I organise starters and substitutes?', 'How do I change a player’s name or position?'],
      faq: [
        { question: 'How do I copy the whole team’s multi OP.GG?', triggers: ['copy opgg', 'copy multi op gg', 'multi opgg', 'op gg main team', 'team opgg', 'roster opgg', 'starters opgg'], answer: 'In Team, Copy multi OP.GG includes starters and substitutes with a valid Riot ID. Separate links remain available in OP.GG links by group. Staff are not included.' },
        { question: 'Why does a player have fewer games?', triggers: ['fewer games', 'missing games', 'different game count', 'adc fewer', 'games missing'], answer: 'The count depends on the profile linked to each imported participant. In Games, open the relevant game and its options to check the linked player and position. Correct the link if the player changed their Riot ID or a duplicate profile was selected.' },
      ],
    },
    'imports-and-games': {
      title: 'Importing and managing games', actionLabel: 'Open Games',
      summary: 'Games brings together imported games and their summaries. Import a game opens the file picker. Corrections remain available from each game’s options.',
      keywords: ['import', 'json', 'game id', 'games', 'match', 'side', 'lane', 'profile', 'create profiles', 'category', 'scrim', 'upload', 'history'],
      steps: ['Prepare the .json file with NXT5 Importer. The No file yet? help explains how to get it.', 'In Games, choose Import a game, then Choose my file.', 'Choose your team’s side, check both teams’ positions and link five different profiles. Create missing profiles during import if needed.', 'Name the game, add a category if useful, then confirm the import.'],
      suggestions: ['Why is my import failing?', 'How do I correct the linked player?', 'How do I find an imported game?'],
      faq: [
        { question: 'Why is my import not working?', triggers: ['import fails', 'import error', 'json rejected', 'game not found', 'upload stuck', 'import stuck'], answer: 'Check your management permissions, chosen side, both teams’ positions and the five different linked player profiles. Missing profiles can be created during import. Use a recent .json file from NXT5 Importer for a finished game. If uploading succeeds but analysis fails, export the game again from the PC where it appears in the LoL client.' },
        { question: 'Do I need to create all profiles before importing?', triggers: ['create profiles', 'missing profiles', 'profiles before importing', 'without five players'], answer: 'You can start importing before preparing every profile. After choosing the side, check the suggested names and Riot IDs, then create missing profiles during import. Link each of the five positions to a different profile before confirming the game.' },
        { question: 'How do I correct a player or position?', triggers: ['correct profile', 'wrong lane', 'wrong player', 'assignment', 'edit import', 'wrong position'], answer: 'In Games, open the game and its management options. Check the side, positions and linked players before saving. Summaries and analyses will then use the corrected links.' },
      ],
    },
    statistics: {
      title: 'Reading a game summary', actionLabel: 'View games',
      summary: 'The summary starts with the game essentials. Statistics, points to investigate and the timeline can then be opened depending on your question.',
      keywords: ['statistics', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'gold', 'vision', 'build', 'objective', 'timeline', 'group', 'summary', 'difference', 'minions'],
      steps: ['In Games, find and open the game you are interested in.', 'Read the result, points to keep or check, and the suggested next action.', 'Open Statistics and 5v5 comparison for numbers, or Game timeline for events.', 'Use a group to bring together games from the same session.'],
      suggestions: ['How do I read the difference at 20 minutes?', 'How do I create a group of games?', 'How do I go from a summary to a debrief?'],
      faq: [{ question: 'How do I read the differences at 10 and 20 minutes?', triggers: ['diff10', 'diff20', 'lane difference', 'cs10', 'cs20', 'difference at 20', 'difference at 10'], answer: 'CS 10 and CS 20 show minions and monsters killed at 10 and 20 minutes. In the position comparison, the displayed difference compares these counts between the two opponents. Relate the difference to gold, deaths and game events before drawing a conclusion.' }],
    },
    reviews: {
      title: 'Preparing a debrief', actionLabel: 'Open Debriefs',
      summary: "A debrief brings together observations and decisions after one or more games. Team notes come before the automated analysis, which you can expand to check an observation.",
      keywords: ["review","report","decision","notes","source game","library","staff","group","create review","edit review","debrief","prepare a debrief","linked games","gear","manage this review","automated analysis","group title"],
      steps: [
      "Open a game or group from Games, then choose Prepare a debrief.",
      "Write what the team should keep, what needs checking and the next action to try, then save. Edit lets you update notes if you have permission.",
      "Read Team notes, then open Automated match analysis if needed. Linked games let you check the findings.",
      "In the library, the Manage this review gear menu contains Duplicate and, if permitted, Delete. When the linked games exactly match a group of several games, the title uses that group’s name."
    ],
      suggestions: [
      "What should I put in a debrief?",
      "Where do I find Duplicate and Delete for a debrief?",
      "Why does the debrief use the group’s name?"
    ],
      faq: [{ question: 'What should I put in a debrief?', triggers: ['what to write in review', 'review content', 'useful review', 'staff notes', 'useful debrief', 'put in a debrief'], answer: 'Keep the debrief short: one useful decision, one point to check and one observable action for the next game. Link the relevant games so the team can verify the observations.' },

  {
    "question": "Where do I find Duplicate and Delete for a debrief?",
    "triggers": [
      "duplicate a debrief",
      "delete a debrief",
      "manage this review",
      "debrief gear"
    ],
    "answer": "In Debriefs, open the debrief in the library, then click the Manage this review gear icon. The menu contains Duplicate and, if you can manage this debrief, Delete. Edit remains available separately to update notes if you have permission."
  },
  {
    "question": "Why does the debrief use the group’s name?",
    "triggers": [
      "group name",
      "group title",
      "debrief title"
    ],
    "answer": "When the games linked to a debrief exactly match a group of several games, its title uses that group’s name. A partial selection does not use the group name. Check the linked games and the relevant group in Games."
  },
  {
    "question": "Where can I find a debrief’s automated analysis?",
    "triggers": [
      "debrief automated analysis",
      "find automated analysis",
      "notes before analysis"
    ],
    "answer": "In the debrief, Team notes appear first. Then open Automated match analysis to find the observations and suggested points to investigate. Check them against the linked games and video before drawing a conclusion."
  }

    ,
{
  "question": "How do I combine several games in a debrief?",
  "triggers": [
    "combine several games",
    "debrief several games",
    "group games in a debrief"
  ],
  "answer": "In the debrief editor, select the relevant games, up to 20, add the team notes and save. You can also start from a group in Games with Prepare a debrief. The linked games then let you check the observations."
}
],
    },
    trends: {
      title: 'Analysing several games', actionLabel: 'Open Analyses',
      summary: 'Analyses brings together results from several games in Overview, Evolution, Compare, Champions and Goals. Period and category filters define the games studied.',
      keywords: ['trends', 'winrate', 'win rate', 'blue side', 'red side', 'identity', 'pattern', 'role', 'block', 'context', 'filter', 'game to review', 'analyses', 'games'],
      steps: ['Choose the period and category of games to analyse.', 'Start with the overview, then examine the details relevant to your question.', 'Compare blue and red side results alongside the number of games played.', 'Open the associated games before drawing a conclusion.'],
      suggestions: ['How do I read win rate by side?', 'How do I choose games to analyse?', 'How do I find the game behind a metric?'],
    },
    'champion-analysis': {
      title: 'Analysing champions played', actionLabel: 'Open Analyses',
      summary: 'In Analyses, Champions lets you search for a champion, filter by role and find the games behind their results.',
      keywords: ['champion analysis', 'analyse', 'champions', 'champions played', 'search champion', 'filter role', 'losses', 'allied pairings', 'compare champions'],
      steps: ['In Analyses, choose the period and category, then open Champions.', 'Search for a champion or filter the role, then select the champion to examine.', 'Open View games or Review losses to find the source data.', 'In Compare and deepen, examine other champions in the same role, opponents and allied pairings. Treat small samples with caution.'],
      suggestions: ['How do I find a champion’s losses?', 'How do I compare champions in the same role?', 'Do allied pairings prove synergy?'],
      faq: [{ question: 'Do allied pairings prove synergy?', triggers: ['allied pairings', 'prove synergy', 'proven synergy'], answer: 'Allied pairings describe champions played together in the selection. They do not prove synergy or a champion’s effect on the result. Open the source games and consider the number of known results.' }],
    },
    'champion-pool': {
      title: 'Players’ champions', actionLabel: 'View champions',
      summary: 'The champion pool brings together each player’s picks. Mastery levels and statuses help the team prepare its compositions.',
      keywords: ['champion pool', 'pool', 'champion', 'tier', 'mastery', 'confidence', 'situational', 'validation', 'development', 'locked', 'pick', 'level', 'practice', 'champions'],
      steps: ['Choose the player and position.', 'Add a champion and indicate the actual mastery level.', 'Use the status to distinguish a mastered, situational, unvalidated or practice pick.', 'Find these champions again in compositions.'],
      suggestions: ['How do I indicate a champion’s mastery level?', 'What are statuses for?', 'How do I use these champions in a composition?'],
    },
    compositions: {
      "title": "Preparing compositions",
      "actionLabel": "Open compositions",
      "summary": "Prepare your team’s five champions and game plan. Pick assistance compares the player’s pool and games on the team; suggested enemy responses remain ideas to check.",
      "keywords": [
        "composition",
        "enemy composition",
        "opponents",
        "draft",
        "our drafts",
        "their draft",
        "pick",
        "ban",
        "side",
        "counter",
        "drag drop",
        "pick assistance",
        "champion pick assistance",
        "champion choice assistance",
        "champion picks",
        "available picks",
        "available choices",
        "missing champion",
        "opponent",
        "patch",
        "category",
        "ranking",
        "mobalytics",
        "save composition"
      ],
      "steps": [
        "Name the composition and choose the player and champion for each of the five roles.",
        "Open Pick assistance: champion pool and team games. Choose the role to prepare, optionally add an enemy champion and filter games by category or patch.",
        "Compare declared proficiency and source games. Pick adds the champion to the draft; save the composition to share the pick with the team. You can save an incomplete composition and complete it later.",
        "Describe the game plan. Go deeper: playing style and opposing responses suggests enemy champions to watch; duplicate a composition to prepare a variation."
      ],
      "suggestions": [
        "How do I use champion pick assistance?",
        "How are champion picks ranked?",
        "Why is my champion missing from available choices?"
      ],
      "faq": [
        {
          "question": "How do I use champion pick assistance?",
          "triggers": [
            "pick assistance",
            "champion choice assistance",
            "prepare our champion picks",
            "pick a champion in the composition"
          ],
          "answer": "In Draft → Compositions, open Pick assistance: champion pool and team games below the five roles. Choose the role to prepare, then optionally an enemy champion. You can filter games by category and patch. To change players, use the corresponding role in the composition. Check the source games, then click Pick. Picking updates the draft: save the composition to share it with the team."
        },
        {
          "question": "How are champion picks ranked?",
          "triggers": [
            "picks ranked",
            "champion ranking",
            "suggestion order",
            "win rate ranking",
            "best counter"
          ],
          "answer": "Assistance ranks champions from the player’s manual pool first by declared proficiency, then by the number of games that player has with a known result on the team. Win rate does not determine the order. Results cover whole games; they prove neither a lane win nor a guaranteed counter. Check source games and the number of known results before choosing."
        },
        {
          "question": "Why is my champion missing from available choices?",
          "triggers": [
            "champion missing",
            "missing champion",
            "champion not shown",
            "no available picks",
            "no champions available"
          ],
          "answer": "Check the selected player and role: only champions from that player’s manual pool on this team are suggested. Champions already picked in another role and the enemy champion are excluded. Add the champion to the correct player’s pool if needed; if there is no player in this role, add their profile first."
        },
        {
          "question": "Are Mobalytics statistics used in the suggestions?",
          "triggers": [
            "mobalytics",
            "external statistics",
            "imported counters"
          ],
          "answer": "After choosing an enemy champion, the Mobalytics link opens their counters for the selected role in a new tab. These statistics are not imported and do not affect the NXT5 ranking. Check the role, patch, rank and number of games on the external source. A champion missing from its list is not a proven bad matchup."
        }
      ]
    },
    planning: {
      title: 'Schedule and availability', actionLabel: 'Open Schedule',
      summary: 'The schedule brings together availability, sessions and weekly notes. Saved notes are visible to the whole team.',
      keywords: ['schedule', 'planning', 'availability', 'week', 'scrim', 'match', 'session', 'event', 'time', 'staff', 'weekly notes', 'schedule note', 'late', 'practice', 'debrief'],
      steps: ['Choose the week to prepare.', 'Enter availability and, if needed, a note for this week (up to 500 characters).', 'Add team sessions with their type and time.', 'Check availability before confirming a session.'],
      suggestions: ['How do I enter availability?', 'Who can add a session?', 'Who can see my schedule notes?'],
      faq: [{ question: 'Who can see my schedule notes?', triggers: ['schedule notes', 'schedule note', 'weekly notes', 'note visible', 'late'], answer: 'Saved notes are visible to the whole team for the displayed week, with a 500-character limit. Staff share one common note. Refresh notes reloads saved notes; if saving fails, use Retry saving.' }],
    },
    'player-profile': {
      title: 'Player profile and follow-up', actionLabel: 'Open My profile',
      summary: 'My profile brings together Summary, Champions, Champions declared, History, Tracking and Card & Wrapped. Notes and notebooks remain subject to access permissions.',
      keywords: ['profile', 'my profile', 'player', 'history', 'coaching', 'goal', 'champions', 'matchups', 'notebook', 'average damage', 'champion damage', 'progress', 'notes', 'follow-up', 'duel'],
      steps: ['Check that your account is linked to the correct player in Team management.', 'Start with the overview to identify a point to work on.', 'In Champions, open a champion, then Statistics or Matchups to examine results, damage and notebooks. Declared champions retains mastery levels.', 'Check the history and linked games to verify an observation, then follow-up for goals and notes.'],
      suggestions: ['Why is my profile empty?', 'Where can I see my history?', 'How do I track a goal?'],
      faq: [
        { question: 'Why is my profile empty?', triggers: ['empty profile', 'no profile stats', 'no profile games', 'empty history', 'no games in profile'], answer: 'First check that your NXT5 account is linked to the correct player in Team management. Then check the players linked to imported games: a game assigned to a duplicate profile or no player cannot populate your profile correctly.' },
        { question: 'Where can I read average champion damage?', triggers: ['average damage', 'damage to champions', 'champion damage'], answer: 'In My profile → Champions, select a champion, then Statistics. Average damage to champions uses games with available data; “—” means unavailable. Open a game to compare players: damage differences are measured at the end of the game.' },
        { question: 'How do I save a matchup notebook?', triggers: ['matchup notebook', 'save notebook', 'starting plan', 'prepare notebook'], answer: 'In My profile → Champions, open a champion, then Matchups. Prepare notebook or Edit notebook lets you enter the starting plan and experiments, subject to your permissions. The draft is kept while navigating, but click Save notebook to save your changes.' },
      ],
    },
    'player-showcase': {
      title: 'Player card and Wrapped', actionLabel: 'Open Card & Wrapped',
      summary: 'Card & Wrapped creates a two-sided player card and a five-chapter story from games linked to the player in the selection.',
      keywords: ['card', 'player card', 'wrapped', 'my sheet', 'poster', 'export', 'export png', 'png', 'front', 'back', 'chapter'],
      steps: ['In My profile, choose the player and category, then open Card & Wrapped.', 'On The card, use View back or View front to switch sides.', 'Choose Discover Wrapped to explore the five chapters at your own pace.', 'Download the displayed visual as a PNG. Data and method for this edition explains the games and values used.'],
      suggestions: ['How do I export my card as a PNG?', 'Why is my card empty?', 'How do I explore Wrapped?'],
      faq: [{ question: 'Why is my card empty?', triggers: ['empty card', 'my card empty', 'empty wrapped', 'no card'], answer: 'The card and Wrapped need at least one game linked to the player in the selection. Change the category or import a game, then check that the correct player profile is linked to it.' }],
    },
    discord: {
      title: 'Discord account and bot', actionLabel: 'Open Discord bot',
      summary: 'Discord bot brings together personal account linking, the team’s server connection and game publications. Each team keeps its own settings.',
      keywords: ['discord', 'bot', 'link', 'linking', 'server', 'channel', 'publication', 'publishing', 'nxt'],
      steps: ['For your account, run /nxt lier in Discord and open the personal link. Confirm your account on NXT5, then Check link and Confirm link in Discord.', 'The owner or a captain configures the server in Discord bot: Connect server, then Choose channels.', 'Assign a channel to the team’s commands and choose publication channels separately.', 'Send the fictional example with Test and activate, check that it arrived, then activate publishing. Installation does not republish old games.'],
      suggestions: ['How do I link my Discord account?', 'How do I connect the Discord server?', 'What do Discord publications share?'],
      faq: [
        { question: 'How do I link my Discord account?', triggers: ['link my discord account', 'discord account', 'nxt lier'], answer: 'In Discord, run /nxt lier and open your personal link. Check the accounts and confirm your NXT5 account. Return to Discord, click Check link, then Confirm link. Personal linking is separate from the team server connection. /nxt help remains available without a linked account.' },
        { question: 'What do Discord publications share?', triggers: ['discord publications', 'private notes discord', 'discord sharing', 'publish on discord'], answer: 'From a game, use Export to Discord if your permissions allow it. Choose the channel, prepare the preview, then confirm publication. The result, statistics and visual are shared. Private staff notes are not included. Channel members can read the message; opening the game in NXT5 still requires team access.' },
      ],
    },
    'permissions-and-account': {
      title: 'Access and account settings', actionLabel: 'Open settings',
      summary: 'Your team role determines which actions are available. Settings manages your account and security; Team management organises players and their access.',
      keywords: ['permission', 'rights', 'access', 'captain', 'coach', 'manager', 'analyst', 'player', 'account', 'email', 'password', 'security', 'settings'],
      steps: ['Check your role in the active team.', 'Open Settings for your account, email and password.', 'Open Team management for player profiles and their access.', 'If an action remains blocked, ask the captain or an authorised staff member.'],
      suggestions: ['Why is a button blocked?', 'How do I change access?', 'How do I secure my account?'],
    },
    troubleshooting: {
      title: 'Solving common problems', actionLabel: 'Open settings',
      summary: 'A problem may come from the imported file, missing events, an incorrectly linked player, access permissions or an old version loaded in the browser.',
      keywords: ['problem', 'error', 'blocked', 'not working', 'broken', 'frozen', 'loading', 'timeline', 'image', 'permission', 'cache', 'troubleshooting', 'game'],
      steps: ['Reload the page once.', 'Check the active team, the affected player and your role.', 'For an import, prepare the file again with a recent version of NXT5 Importer.', 'If the problem persists, note the page, action and displayed message.'],
      suggestions: ['Why does the page keep loading?', 'Why is the timeline incomplete?', 'Why is a button disabled?'],
      faq: [
        { question: 'Why is the timeline incomplete?', triggers: ['incomplete timeline', 'missing timeline', 'missing objectives', 'no timeline'], answer: 'NXT5 does not invent events missing from the file. Prepare the file again with a recent version of NXT5 Importer. If Riot still does not provide the full timeline, final statistics remain available but some events and times cannot be displayed.' },
        { question: 'Why does the site keep loading?', triggers: ['frozen site', 'infinite loading', 'synchronisation in progress', 'stays stuck'], answer: 'Reload the page, then check your connection. If an error appears, use Retry. If the problem persists, keep the displayed message to share along with the affected page.' },
      ],
    },
  },
  es: {
    'getting-started': {
      title: 'Empezar en NXT5', actionLabel: 'Abrir Inicio',
      summary: 'Inicio propone el siguiente paso según tu rol y la actividad del equipo: configuración inicial, una partida que revisar, disponibilidad o seguimiento del jugador.',
      keywords: ['empezar', 'comenzar', 'primera vez', 'guía', 'ayuda', 'usar el sitio', 'inicio', 'siguiente paso'],
      steps: ['Crea un equipo o únete con un código temporal.', 'Sigue el siguiente paso de Inicio. Los perfiles se pueden preparar en Gestión del equipo o crear durante la importación.', 'En Partidas, importa el archivo JSON y vincula las cinco posiciones a cinco perfiles diferentes antes de confirmar.', 'Lee el resumen de la partida y prepara una revisión con los puntos que trabajar.'],
      suggestions: ['¿Cómo importo mi primera partida?', '¿Cómo añado jugadores?', '¿Cómo preparo una revisión útil?'],
    },
    'teams-and-roster': {
      title: 'Equipo, jugadores y acceso', actionLabel: 'Gestionar el equipo',
      summary: 'Equipo muestra a los jugadores y al cuerpo técnico. Gestión del equipo permite añadir perfiles, elegir titulares y suplentes, vincular cuentas y configurar los accesos.',
      keywords: ['equipo', 'plantilla', 'jugador', 'cuerpo técnico', 'staff', 'titular', 'suplente', 'riot id', 'opgg', 'invitación', 'vincular cuenta', 'cambiar nombre', 'acceso', 'fiabilidad'],
      steps: ['Abre Gestión del equipo desde Equipo o el botón de la parte superior de la aplicación.', 'Añade el perfil y su posición, y elige Titular o Suplente en Plantilla.', 'Vincula la cuenta NXT5 correcta al perfil del jugador cuando tenga una cuenta.', 'Comprueba el rol asignado antes de compartir un código de invitación.'],
      suggestions: ['¿Cómo añado un jugador?', '¿Cómo organizo a los titulares y suplentes?', '¿Cómo cambio el nombre o la posición de un jugador?'],
      faq: [
        { question: '¿Cómo copio el multi OP.GG de todo el equipo?', triggers: ['copiar opgg', 'copiar multi op gg', 'multi opgg', 'op gg titulares', 'opgg equipo', 'opgg plantilla', 'opgg titulares'], answer: 'En Equipo, Copiar multi OP.GG incluye a titulares y suplentes con un Riot ID válido. Los enlaces separados siguen disponibles en Enlaces OP.GG por grupo. El cuerpo técnico no está incluido.' },
        { question: '¿Por qué un jugador tiene menos partidas?', triggers: ['menos partidas', 'partidas faltantes', 'cantidad de partidas diferente', 'adc menos', 'faltan partidas'], answer: 'El contador depende del perfil vinculado a cada participante importado. En Partidas, abre la partida correspondiente y sus opciones para comprobar el jugador asociado y su posición. Corrige la asociación si el jugador ha cambiado de Riot ID o se ha elegido un perfil duplicado.' },
      ],
    },
    'imports-and-games': {
      title: 'Importar y gestionar partidas', actionLabel: 'Abrir Partidas',
      summary: 'Partidas reúne las partidas importadas y sus resúmenes. Importar una partida abre el selector de archivos. Las correcciones están disponibles en las opciones de cada partida.',
      keywords: ['importar', 'importación', 'json', 'game id', 'partida', 'lado', 'calle', 'perfil', 'crear perfiles', 'categoría', 'scrim', 'subir', 'historial'],
      steps: ['Prepara el archivo .json con NXT5 Importer. La ayuda ¿Aún no tienes un archivo? explica cómo obtenerlo.', 'En Partidas, elige Importar una partida y después Elegir mi archivo.', 'Elige el lado de tu equipo, comprueba las posiciones de ambos equipos y vincula cinco perfiles diferentes. Crea los perfiles que falten durante la importación si es necesario.', 'Pon un nombre a la partida, añade una categoría si resulta útil y confirma la importación.'],
      suggestions: ['¿Por qué falla mi importación?', '¿Cómo corrijo el jugador asociado?', '¿Cómo encuentro una partida importada?'],
      faq: [
        { question: '¿Por qué no funciona mi importación?', triggers: ['importación falla', 'error de importación', 'json rechazado', 'partida no encontrada', 'subida bloqueada', 'importación bloqueada'], answer: 'Comprueba tus permisos de gestión, el lado elegido, las posiciones de ambos equipos y los cinco perfiles diferentes vinculados. Los perfiles que falten se pueden crear durante la importación. Utiliza un archivo .json reciente de NXT5 Importer para una partida terminada. Si la subida funciona pero falla el análisis, vuelve a exportar la partida desde el PC donde aparece en el cliente de LoL.' },
        { question: '¿Tengo que crear todos los perfiles antes de importar?', triggers: ['crear perfiles', 'perfiles que faltan', 'perfiles antes de importar', 'sin cinco jugadores'], answer: 'Puedes empezar a importar sin haber preparado todos los perfiles. Después de elegir el lado, comprueba los nombres y Riot IDs propuestos y crea los perfiles que falten durante la importación. Vincula cada una de las cinco posiciones a un perfil diferente antes de confirmar la partida.' },
        { question: '¿Cómo corrijo un jugador o una posición?', triggers: ['corregir perfil', 'calle incorrecta', 'jugador incorrecto', 'asignación', 'modificar importación', 'posición incorrecta'], answer: 'En Partidas, abre la partida y sus opciones de gestión. Comprueba el lado, las posiciones y los jugadores asociados antes de guardar. Los resúmenes y análisis utilizarán las asociaciones corregidas.' },
      ],
    },
    statistics: {
      title: 'Leer el resumen de una partida', actionLabel: 'Ver las partidas',
      summary: 'El resumen empieza por lo esencial de la partida. Después puedes abrir las estadísticas, los puntos que investigar y la cronología según tu pregunta.',
      keywords: ['estadísticas', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'oro', 'visión', 'objetos', 'objetivo', 'cronología', 'grupo', 'resumen', 'diferencia', 'súbditos'],
      steps: ['En Partidas, busca y abre la partida que te interesa.', 'Lee el resultado, los puntos que conservar o comprobar y la siguiente acción sugerida.', 'Abre Estadísticas y comparación 5 contra 5 para las cifras, o Cronología de la partida para los eventos.', 'Utiliza un grupo para reunir las partidas de una misma sesión.'],
      suggestions: ['¿Cómo leo la diferencia a los 20 minutos?', '¿Cómo creo un grupo de partidas?', '¿Cómo paso del resumen a una revisión?'],
      faq: [{ question: '¿Cómo leo las diferencias a los 10 y 20 minutos?', triggers: ['diff10', 'diff20', 'diferencia de calle', 'cs10', 'cs20', 'diferencia a los 20', 'diferencia a los 10'], answer: 'CS 10 y CS 20 indican los súbditos y monstruos eliminados a los 10 y 20 minutos. En la comparación por posición, la diferencia compara estas cifras entre los dos rivales. Relaciónala con el oro, las muertes y los eventos de la partida antes de sacar conclusiones.' }],
    },
    reviews: {
      title: 'Preparar una revisión', actionLabel: 'Abrir Revisiones',
      summary: "Un análisis postpartida reúne observaciones y decisiones tras una o varias partidas. Las notas del equipo aparecen antes del análisis automático, que puedes desplegar para comprobar una observación.",
      keywords: ["revisión","review","informe","decisión","notas","partida de origen","biblioteca","cuerpo técnico","grupo","crear revisión","modificar revisión","debrief","partidas vinculadas","análisis postpartida","preparar un análisis postpartida","engranaje","gestionar este análisis postpartida","análisis automático","nombre del grupo"],
      steps: [
      "Abre una partida o grupo desde Partidas y elige preparar un informe.",
      "Escribe lo que el equipo debe conservar, lo que hay que comprobar y la próxima acción, y guarda. Editar permite completar las notas si tienes permiso.",
      "Lee Notas del equipo y abre Análisis automático de las partidas si lo necesitas. Las partidas vinculadas permiten comprobar las observaciones.",
      "En la biblioteca, el engranaje Gestionar este análisis postpartida contiene Duplicar y, si tienes permiso, Eliminar. Si las partidas vinculadas coinciden exactamente con un grupo de varias partidas, el título usa el nombre del grupo."
    ],
      suggestions: [
      "¿Qué debo incluir en un análisis postpartida?",
      "¿Dónde encuentro Duplicar y Eliminar un análisis postpartida?",
      "¿Por qué el análisis postpartida usa el nombre del grupo?"
    ],
      faq: [{ question: '¿Qué incluyo en una revisión?', triggers: ['qué escribir en revisión', 'contenido de revisión', 'revisión útil', 'notas del cuerpo técnico', 'incluir en una revisión'], answer: 'Haz una revisión breve: una decisión útil, un punto que comprobar y una acción observable para la próxima partida. Vincula las partidas correspondientes para que el equipo pueda verificar las observaciones.' },

  {
    "question": "¿Dónde encuentro Duplicar y Eliminar un análisis postpartida?",
    "triggers": [
      "duplicar un análisis postpartida",
      "eliminar un análisis postpartida",
      "gestionar este análisis postpartida",
      "engranaje del análisis"
    ],
    "answer": "En Análisis postpartida, abre el análisis en la biblioteca y pulsa el engranaje Gestionar este análisis postpartida. El menú contiene Duplicar y, si puedes gestionar ese análisis, Eliminar. Editar sigue disponible por separado para modificar las notas si tienes permiso."
  },
  {
    "question": "¿Por qué el análisis postpartida usa el nombre del grupo?",
    "triggers": [
      "nombre del grupo",
      "título del grupo",
      "título del análisis postpartida"
    ],
    "answer": "Cuando las partidas vinculadas al análisis coinciden exactamente con un grupo de varias partidas, el título usa el nombre del grupo. Una selección parcial no utiliza ese nombre. Comprueba las partidas vinculadas y el grupo correspondiente en Partidas."
  },
  {
    "question": "¿Dónde encuentro el análisis automático de un análisis postpartida?",
    "triggers": [
      "análisis automático postpartida",
      "encontrar análisis automático",
      "notas antes del análisis"
    ],
    "answer": "En el análisis postpartida, Notas del equipo aparece primero. Después, abre Análisis automático de las partidas para consultar las observaciones y las ideas que investigar. Compruébalas en las partidas vinculadas y el vídeo antes de concluir."
  }

    ,
{
  "question": "¿Cómo reúno varias partidas en un análisis postpartida?",
  "triggers": [
    "reúno varias partidas",
    "reunir varias partidas",
    "análisis postpartida varias partidas"
  ],
  "answer": "En el editor del análisis postpartida, selecciona las partidas correspondientes, máximo 20, añade las notas del equipo y guarda. También puedes empezar desde un grupo en Partidas con preparar un informe. Las partidas vinculadas permiten comprobar las observaciones."
}
],
    },
    trends: {
      title: 'Analizar varias partidas', actionLabel: 'Abrir Análisis',
      summary: 'Análisis reúne los resultados de varias partidas en Resumen, Evolución, Comparar, Campeones y Objetivos. Los filtros de periodo y categoría definen las partidas estudiadas.',
      keywords: ['tendencias', 'winrate', 'tasa de victorias', 'lado azul', 'lado rojo', 'identidad', 'patrón', 'rol', 'bloque', 'contexto', 'filtro', 'partida para revisar', 'análisis', 'partidas'],
      steps: ['Elige el periodo y la categoría de partidas que analizar.', 'Empieza por el resumen y consulta los detalles relacionados con tu pregunta.', 'Compara los resultados de los lados azul y rojo junto con el número de partidas jugadas.', 'Abre las partidas asociadas antes de sacar una conclusión.'],
      suggestions: ['¿Cómo leo la tasa de victorias por lado?', '¿Cómo elijo las partidas que analizar?', '¿Cómo encuentro la partida detrás de un indicador?'],
    },
    'champion-analysis': {
      title: 'Analizar los campeones jugados', actionLabel: 'Abrir Análisis',
      summary: 'En Análisis, Campeones permite buscar un campeón, filtrar por rol y encontrar las partidas detrás de sus resultados.',
      keywords: ['análisis de campeones', 'analizar', 'campeones', 'campeones jugados', 'buscar campeón', 'filtrar rol', 'derrotas', 'asociaciones aliadas', 'comparar campeones'],
      steps: ['En Análisis, elige el periodo y la categoría y abre Campeones.', 'Busca un campeón o filtra por rol y selecciona el campeón que quieres examinar.', 'Abre Ver partidas o Revisar derrotas para encontrar los datos de origen.', 'En Comparar y profundizar, examina otros campeones del mismo rol, los adversarios y las asociaciones aliadas. Interpreta con prudencia las muestras pequeñas.'],
      suggestions: ['¿Cómo encuentro las derrotas de un campeón?', '¿Cómo comparo campeones del mismo rol?', '¿Las asociaciones aliadas demuestran una sinergia?'],
      faq: [{ question: '¿Las asociaciones aliadas demuestran una sinergia?', triggers: ['asociaciones aliadas', 'demuestran una sinergia', 'sinergia demostrada'], answer: 'Las asociaciones aliadas describen campeones jugados juntos en la selección. No demuestran una sinergia ni el efecto de un campeón en el resultado. Abre las partidas de origen y considera el número de resultados conocidos.' }],
    },
    'champion-pool': {
      title: 'Campeones de los jugadores', actionLabel: 'Ver los campeones',
      summary: 'El repertorio de campeones reúne las elecciones de cada jugador. Los niveles de dominio y los estados ayudan al equipo a preparar sus composiciones.',
      keywords: ['champion pool', 'pool', 'repertorio', 'campeón', 'tier', 'dominio', 'confianza', 'situacional', 'validación', 'desarrollo', 'selección', 'nivel', 'entrenamiento', 'campeones'],
      steps: ['Elige al jugador y su posición.', 'Añade un campeón e indica su nivel de dominio real.', 'Utiliza el estado para distinguir una elección dominada, situacional, por validar o en entrenamiento.', 'Encuentra estos campeones después en las composiciones.'],
      suggestions: ['¿Cómo indico el nivel de dominio de un campeón?', '¿Para qué sirven los estados?', '¿Cómo utilizo estos campeones en una composición?'],
    },
    compositions: {
      "title": "Preparar composiciones",
      "actionLabel": "Abrir las composiciones",
      "summary": "Prepara los cinco campeones y el plan de juego de tu equipo. La ayuda para elegir compara el repertorio del jugador y sus partidas en el equipo; las respuestas rivales siguen siendo ideas que comprobar.",
      "keywords": [
        "composición",
        "composición rival",
        "adversarios",
        "draft",
        "nuestras selecciones",
        "sus selecciones",
        "pick",
        "ban",
        "lado",
        "counter",
        "arrastrar",
        "ayuda para elegir",
        "ayuda para elegir campeones",
        "elecciones de campeones",
        "opciones disponibles",
        "campeón ausente",
        "campeón no aparece",
        "rival",
        "parche",
        "categoría",
        "clasificación",
        "mobalytics",
        "borrador",
        "guardar composición"
      ],
      "steps": [
        "Pon un nombre a la composición y elige el jugador y el campeón para cada una de las cinco posiciones.",
        "Abre Ayuda para elegir: repertorio y partidas del equipo. Elige el rol que preparar, añade opcionalmente un campeón rival y filtra las partidas por categoría o parche.",
        "Compara el dominio declarado y las partidas de referencia. Elegir añade el campeón al borrador; guarda la composición para compartir la elección con el equipo. Puedes guardar una composición incompleta y completarla más tarde.",
        "Describe el plan de juego. Profundizar: estilo de juego y respuestas del rival propone campeones rivales que vigilar; duplica una composición para preparar una variante."
      ],
      "suggestions": [
        "¿Cómo utilizo la ayuda para elegir campeones?",
        "¿Cómo se ordenan las opciones de campeones?",
        "¿Por qué mi campeón no aparece en las opciones disponibles?"
      ],
      "faq": [
        {
          "question": "¿Cómo utilizo la ayuda para elegir campeones?",
          "triggers": [
            "ayuda para elegir",
            "preparo nuestras elecciones de campeones",
            "elegir un campeón en la composición"
          ],
          "answer": "En Draft → Composiciones, abre Ayuda para elegir: repertorio y partidas del equipo debajo de los cinco roles. Elige el rol que preparar y, opcionalmente, un campeón rival. Puedes filtrar las partidas por categoría y parche. Para cambiar de jugador, usa el rol correspondiente en la composición. Consulta las partidas de referencia y pulsa Elegir. La elección modifica el borrador: guarda la composición para compartirla con el equipo."
        },
        {
          "question": "¿Cómo se ordenan las opciones de campeones?",
          "triggers": [
            "ordenan las opciones",
            "clasificación de campeones",
            "orden de sugerencias",
            "clasificación por victorias",
            "mejor counter"
          ],
          "answer": "La ayuda ordena los campeones del repertorio manual del jugador primero por dominio declarado y después por el número de partidas de ese jugador con resultado conocido en el equipo. El porcentaje de victorias no determina el orden. Los resultados corresponden a partidas enteras; no demuestran una victoria en línea ni un counter garantizado. Consulta las partidas de referencia y el número de resultados conocidos antes de elegir."
        },
        {
          "question": "¿Por qué mi campeón no aparece en las opciones disponibles?",
          "triggers": [
            "campeón no aparece",
            "campeón ausente",
            "falta un campeón",
            "no hay opciones disponibles",
            "no hay campeones disponibles"
          ],
          "answer": "Comprueba el jugador y el rol seleccionados: solo se proponen los campeones de su repertorio manual en este equipo. Se excluyen los campeones elegidos en otro rol y el campeón rival. Añade el campeón al repertorio del jugador correcto si hace falta; si no hay ningún jugador en ese rol, añade primero su perfil."
        },
        {
          "question": "¿Se utilizan las estadísticas de Mobalytics en las sugerencias?",
          "triggers": [
            "mobalytics",
            "estadísticas externas",
            "counters importados"
          ],
          "answer": "Después de elegir un campeón rival, el enlace de Mobalytics abre sus counters para el rol seleccionado en una pestaña nueva. Estas estadísticas no se importan ni modifican la clasificación de NXT5. Comprueba el rol, el parche, el rango y el número de partidas en la fuente externa. Que un campeón no aparezca en su lista no demuestra que sea un mal enfrentamiento."
        }
      ]
    },
    planning: {
      title: 'Calendario y disponibilidad', actionLabel: 'Abrir el Calendario',
      summary: 'El calendario reúne la disponibilidad, las sesiones y las notas de la semana. Las notas guardadas son visibles para todo el equipo.',
      keywords: ['calendario', 'planning', 'disponibilidad', 'semana', 'scrim', 'partido', 'sesión', 'evento', 'horario', 'cuerpo técnico', 'notas semanales', 'nota del calendario', 'retraso', 'entrenamiento', 'revisión'],
      steps: ['Elige la semana que preparar.', 'Indica la disponibilidad y, si es necesario, una nota para esta semana (500 caracteres como máximo).', 'Añade las sesiones del equipo con su tipo y horario.', 'Comprueba la disponibilidad antes de confirmar una sesión.'],
      suggestions: ['¿Cómo indico mi disponibilidad?', '¿Quién puede añadir una sesión?', '¿Quién ve mis notas del calendario?'],
      faq: [{ question: '¿Quién ve mis notas del calendario?', triggers: ['notas del calendario', 'nota del calendario', 'notas semanales', 'nota visible', 'retraso'], answer: 'Las notas guardadas son visibles para todo el equipo durante la semana mostrada, con un límite de 500 caracteres. El cuerpo técnico comparte una nota común. Actualizar notas recarga las notas guardadas; si falla el guardado, utiliza Reintentar el guardado.' }],
    },
    'player-profile': {
      title: 'Perfil y seguimiento del jugador', actionLabel: 'Abrir Mi perfil',
      summary: 'Mi perfil reúne Resumen, Campeones, Campeones declarados, Historial, Seguimiento y Carta y Wrapped. Las notas y cuadernos siguen sujetos a los permisos de acceso.',
      keywords: ['perfil', 'mi perfil', 'jugador', 'historial', 'coaching', 'objetivo', 'campeones', 'enfrentamientos', 'cuaderno', 'daño medio', 'daño a campeones', 'progreso', 'notas', 'seguimiento', 'duelo'],
      steps: ['Comprueba que tu cuenta está vinculada al jugador correcto en Gestión del equipo.', 'Empieza por el resumen para identificar un punto que trabajar.', 'En Campeones, abre un campeón y después Estadísticas o Enfrentamientos para examinar los resultados, el daño y los cuadernos. Campeones declarados conserva los niveles de dominio.', 'Consulta el historial y las partidas vinculadas para verificar una observación; después, el seguimiento para los objetivos y las notas.'],
      suggestions: ['¿Por qué mi perfil está vacío?', '¿Dónde veo mi historial?', '¿Cómo hago el seguimiento de un objetivo?'],
      faq: [
        { question: '¿Por qué mi perfil está vacío?', triggers: ['perfil vacío', 'sin estadísticas de perfil', 'sin partidas de perfil', 'historial vacío', 'ninguna partida en perfil'], answer: 'Comprueba primero que tu cuenta NXT5 está vinculada al jugador correcto en Gestión del equipo. Después revisa los jugadores asociados a las partidas importadas: una partida asignada a un perfil duplicado o a ningún jugador no puede alimentar correctamente tu perfil.' },
        { question: '¿Dónde veo el daño medio a campeones?', triggers: ['daño medio', 'daño a campeones', 'daño contra campeones'], answer: 'En Mi perfil → Campeones, selecciona un campeón y después Estadísticas. El daño medio a campeones utiliza las partidas con datos disponibles; «—» significa que el dato no está disponible. Abre una partida para comparar jugadores: las diferencias de daño se miden al final de la partida.' },
        { question: '¿Cómo guardo un cuaderno de enfrentamiento?', triggers: ['cuaderno de enfrentamiento', 'guardar cuaderno', 'plan inicial', 'preparar cuaderno'], answer: 'En Mi perfil → Campeones, abre un campeón y después Enfrentamientos. Preparar cuaderno o Editar cuaderno permite indicar el plan inicial y las pruebas según tus permisos. El borrador se conserva durante la navegación, pero debes pulsar Guardar cuaderno para guardar los cambios.' },
      ],
    },
    'player-showcase': {
      title: 'Carta del jugador y Wrapped', actionLabel: 'Abrir Carta y Wrapped',
      summary: 'Carta y Wrapped crea una carta del jugador con anverso y reverso y un relato en cinco capítulos a partir de las partidas vinculadas al jugador en la selección.',
      keywords: ['carta', 'tarjeta', 'tarjeta del jugador', 'wrapped', 'mi ficha', 'póster', 'exportar', 'exportar png', 'png', 'anverso', 'reverso', 'capítulo'],
      steps: ['En Mi perfil, elige el jugador y la categoría y abre Carta y Wrapped.', 'En La carta, utiliza Ver el reverso o Ver el anverso para cambiar de cara.', 'Elige Descubrir el Wrapped para recorrer los cinco capítulos a tu ritmo.', 'Descarga el visual mostrado en PNG. Datos y método de esta edición explica las partidas y los valores utilizados.'],
      suggestions: ['¿Cómo exporto mi tarjeta en PNG?', '¿Por qué mi tarjeta está vacía?', '¿Cómo recorro Wrapped?'],
      faq: [{ question: '¿Por qué mi tarjeta está vacía?', triggers: ['tarjeta vacía', 'mi tarjeta está vacía', 'wrapped vacío', 'ninguna tarjeta'], answer: 'La tarjeta y Wrapped necesitan al menos una partida vinculada al jugador en la selección. Cambia la categoría o importa una partida y comprueba que el perfil de jugador correcto esté vinculado a ella.' }],
    },
    discord: {
      title: 'Cuenta y bot de Discord', actionLabel: 'Abrir Bot de Discord',
      summary: 'Bot de Discord reúne la vinculación de la cuenta personal, la conexión del servidor del equipo y las publicaciones de partidas. Cada equipo conserva sus propios ajustes.',
      keywords: ['discord', 'cuenta de discord', 'bot', 'vincular', 'vinculación', 'servidor', 'canal', 'publicación', 'difusión', 'nxt'],
      steps: ['Para tu cuenta, ejecuta /nxt lier en Discord y abre el enlace personal. Confirma tu cuenta en NXT5 y después Verificar vinculación y Confirmar vinculación en Discord.', 'El propietario o un capitán configura el servidor en Bot de Discord: Conectar servidor y después Elegir canales.', 'Asocia un canal a los comandos del equipo y elige por separado los canales de publicación.', 'Envía el ejemplo ficticio con Probar y activar, comprueba su recepción y activa la difusión. La instalación no vuelve a publicar partidas antiguas.'],
      suggestions: ['¿Cómo vinculo mi cuenta de Discord?', '¿Cómo conecto el servidor de Discord?', '¿Qué comparten las publicaciones de Discord?'],
      faq: [
        { question: '¿Cómo vinculo mi cuenta de Discord?', triggers: ['vincular mi cuenta de discord', 'cuenta de discord', 'nxt lier'], answer: 'En Discord, ejecuta /nxt lier y abre tu enlace personal. Comprueba las cuentas y confirma tu cuenta NXT5. Vuelve a Discord, pulsa Verificar vinculación y después Confirmar vinculación. La vinculación personal es distinta de la conexión del servidor del equipo. /nxt help sigue disponible sin una cuenta vinculada.' },
        { question: '¿Qué comparten las publicaciones de Discord?', triggers: ['publicaciones de discord', 'notas privadas discord', 'compartir discord', 'publicar en discord'], answer: 'Desde una partida, utiliza Exportar a Discord si tus permisos lo permiten. Elige el canal, prepara la vista previa y confirma la publicación. Se comparten el resultado, las estadísticas y el visual; las notas privadas del cuerpo técnico no se incluyen. Los miembros del canal pueden leer el mensaje; abrir la partida en NXT5 sigue requiriendo acceso al equipo.' },
      ],
    },
    'permissions-and-account': {
      title: 'Acceso y ajustes de la cuenta', actionLabel: 'Abrir los ajustes',
      summary: 'Tu rol en el equipo determina las acciones disponibles. Ajustes gestiona tu cuenta y su seguridad; Gestión del equipo organiza a los jugadores y sus accesos.',
      keywords: ['permiso', 'derechos', 'acceso', 'capitán', 'entrenador', 'mánager', 'analista', 'jugador', 'cuenta', 'correo', 'contraseña', 'seguridad', 'ajustes'],
      steps: ['Comprueba tu rol en el equipo activo.', 'Abre Ajustes para tu cuenta, correo y contraseña.', 'Abre Gestión del equipo para los perfiles de jugador y sus accesos.', 'Si una acción sigue bloqueada, pregunta al capitán o a un miembro autorizado del cuerpo técnico.'],
      suggestions: ['¿Por qué está bloqueado un botón?', '¿Cómo modifico un acceso?', '¿Cómo protejo mi cuenta?'],
    },
    troubleshooting: {
      title: 'Resolver problemas habituales', actionLabel: 'Abrir los ajustes',
      summary: 'Un problema puede deberse al archivo importado, eventos ausentes, un jugador mal asociado, los permisos de acceso o una versión antigua cargada en el navegador.',
      keywords: ['problema', 'error', 'bloqueado', 'no funciona', 'roto', 'congelado', 'cargando', 'cronología', 'imagen', 'permiso', 'caché', 'solucionar', 'partida'],
      steps: ['Recarga la página una vez.', 'Comprueba el equipo activo, el jugador afectado y tu rol.', 'Para una importación, prepara el archivo de nuevo con una versión reciente de NXT5 Importer.', 'Si el problema persiste, anota la página, la acción y el mensaje mostrado.'],
      suggestions: ['¿Por qué la página sigue cargando?', '¿Por qué está incompleta la cronología?', '¿Por qué está desactivado un botón?'],
      faq: [
        { question: '¿Por qué está incompleta la cronología?', triggers: ['cronología incompleta', 'cronología ausente', 'faltan objetivos', 'sin cronología'], answer: 'NXT5 no inventa los eventos ausentes del archivo. Prepara el archivo de nuevo con una versión reciente de NXT5 Importer. Si Riot sigue sin proporcionar la cronología completa, las estadísticas finales siguen disponibles, pero algunos eventos y horarios no pueden mostrarse.' },
        { question: '¿Por qué el sitio sigue cargando?', triggers: ['sitio congelado', 'carga infinita', 'sincronización en curso', 'sigue bloqueado'], answer: 'Recarga la página y comprueba tu conexión. Si aparece un error, utiliza Reintentar. Si el problema persiste, conserva el mensaje mostrado para compartirlo junto con la página afectada.' },
      ],
    },
  },
};
