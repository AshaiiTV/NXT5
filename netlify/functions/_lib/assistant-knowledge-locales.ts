import type { AssistantKnowledgeEntry } from './assistant-knowledge';
import { IMPORTER_TUTORIAL_URL } from '../../../shared/importer-tutorial.js';

type Translation = Omit<AssistantKnowledgeEntry, 'id' | 'path'>;

export const ASSISTANT_TRANSLATIONS: Record<string, Record<string, Translation>> = {
  en: {
    'importer-video': {
      title: 'NXT5 Importer video tutorial', actionLabel: 'Open the import tutorial',
      summary: `This French video shows how to export a game with NXT5 Importer on Windows and add it to NXT5: ${IMPORTER_TUTORIAL_URL}. The YouTube link is also available in the assistant and beside the import controls.`,
      keywords: ['tutorial', 'video', 'youtube', 'importer', 'windows', 'export', 'first game'],
      steps: ['Open Video tutorial: import a game on Windows. The video is in French, lasts 2 min 31 and opens on YouTube in a new tab.', 'Keep the League of Legends client open, export the JSON file with NXT5 Importer, then add it in Games.'],
      suggestions: ['Where is the video tutorial for importing a game?', 'How do I import my first game?'],
      faq: [{ question: 'Where is the video tutorial for importing a game?', triggers: ['tutorial', 'video import', 'youtube', 'use importer'], answer: `Watch the NXT5 Importer tutorial for Windows: ${IMPORTER_TUTORIAL_URL}. The video is in French and lasts 2 min 31. You can also find it in the assistant, in Guide → Import, and beside the file picker in Games.` }],
    },
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
        { question: 'How do I copy the whole team’s multi OP.GG?', triggers: ['copy opgg', 'copy multi op gg', 'multi opgg', 'op gg main team', 'team opgg', 'roster opgg', 'starters opgg'], answer: 'In Team, Copy multi OP.GG includes starters and substitutes with a valid Riot ID. Staff are not included.' },
        { question: 'Why does a player have fewer games?', triggers: ['fewer games', 'missing games', 'different game count', 'adc fewer', 'games missing'], answer: 'The count depends on the profile linked to each imported participant. In Games, open the relevant game and its options to check the linked player and position. Correct the link if the player changed their Riot ID or a duplicate profile was selected.' },
      ],
    },
    'imports-and-games': {
      title: 'Importing and managing games', actionLabel: 'Open Games',
      summary: 'Games brings together imported games and their summaries. Import a game opens the file picker. Corrections remain available from each game’s options.',
      keywords: ['import', 'json', 'game id', 'games', 'match', 'side', 'lane', 'profile', 'create profiles', 'category', 'scrim', 'upload', 'history'],
      steps: ["To stop doing anything by hand: in Games → Automatic import, link NXT5 Importer to the team with a code, then keep the Importer open during customs. Recognised games arrive on their own; the others wait to be finalised.", 'Prepare the .json file with NXT5 Importer. The No file yet? help explains how to get it.', 'In Games, choose Import a game, then Choose my file.', 'Choose your team’s side, check both teams’ positions and link five different profiles. Create missing profiles during import if needed.', 'Name the game and select at least one category. Opponent team (optional) lets you choose a profile or New team; then confirm the import.'],
      suggestions: ['Why is my import failing?', 'How do I correct the linked player?', 'How do I find an imported game?'],
      faq: [
        { question: "How do I import my games automatically?", triggers: ["automatic import", "import automatically", "link the importer", "link code", "automatic collection", "received game", "to finalise"], answer: "In Games → Automatic import, the staff generates a code and pastes it in the Automatic collection tab of NXT5 Importer (valid 15 minutes, once). Then every custom played with the Importer open arrives on its own, with the side, roles and players recognised from the roster Riot IDs. An unrecognised game appears under Received games with a Finalise button that opens the usual import form. The link expires after 90 days and can be revoked in one click." },
        { question: 'Where is Automatic collection in NXT5 Importer 0.4.1?', triggers: ['importer 0.4.1', 'importer sidebar', 'where is automatic collection', 'new importer interface'], answer: 'In NXT5 Importer 0.4.1, the sidebar contains Export, Automatic collection, History and Settings. In windows narrower than 900 px it becomes a top bar. Collection behaviour and shortcuts have not changed since version 0.4.0.' },
        { question: 'Why does automatic collection ignore a game?', triggers: ['collection ignores', 'ignored game', 'ranked game', 'normal game', 'ranked', 'not a custom', 'game not collected'], answer: 'Since NXT5 Importer 0.4.9, automatic collection keeps only custom games. NXT5 also ignores any game received through the link that is not a custom. A ranked or normal game can still be added by manually importing its JSON file. Also check that the Importer stayed open until the end of the game and that its link has not expired.' },
        {"question": "How do I choose an opponent team during import?", "triggers": ["opponent during import", "opponent team on import", "new team during import", "reimport opponent"], "answer": "After the file and side selection, use Opponent team (optional) to select a profile or New team. The new profile and its link are saved only when you confirm the import; cancelling does not create that opponent profile. Not specified leaves a new game without an opponent and preserves an existing link when reimporting. If a group requires that opponent, change the group link to choose another."},
        {"question": "Is a category required to import?", "triggers": ["category required", "mandatory tag", "without a category", "without a tag"], "answer": "Yes. Select at least one category before confirming the import, as well as your team’s side and five distinct player profiles. Choosing an opponent team remains optional."},
        { question: 'Why is my import not working?', triggers: ['import fails', 'import error', 'json rejected', 'game not found', 'upload stuck', 'import stuck'], answer: 'Check your management permissions, chosen side, both teams’ positions and the five different linked player profiles. Missing profiles can be created during import. Use a recent .json file from NXT5 Importer for a finished game. If uploading succeeds but analysis fails, export the game again from the PC where it appears in the LoL client.' },
        { question: 'Do I need to create all profiles before importing?', triggers: ['create profiles', 'missing profiles', 'profiles before importing', 'without five players'], answer: 'You can start importing before preparing every profile. After choosing the side, check the suggested names and Riot IDs, then create missing profiles during import. Link each of the five positions to a different profile before confirming the game.' },
        { question: 'How do I correct a player or position?', triggers: ['correct profile', 'wrong lane', 'wrong player', 'assignment', 'edit import', 'wrong position'], answer: 'In Games, open the game and its management options. Check the side, positions and linked players before saving. Summaries and analyses will then use the corrected links.' },
      ],
    },
    opponents: {
      title: 'Preparing for opposing teams', actionLabel: 'Open opposing teams',
      summary: "In Games → Teams, each opponent profile offers Overview, Games and Drafts with linked groups, observed champions and staff notes. A game or group can be linked to an opponent team without a Drafter draft.",
      keywords: ['opposing team', 'opponent team', 'opponent teams', 'opponent profile', 'opponent dossier', 'link a game', 'associate an opponent', 'save opponent', 'without drafter', 'scouting', "group opponent team", "group link"],
      steps: ["Select your team, then open Games → Teams. Staff can add a profile with a name and optional notes.", "In a game’s details, open Opponent team and choose an existing profile or Create an opponent team.", "Click Save opponent. For a whole session, open the group in Games → Groups, choose Group’s opponent team then Save link.", "Return to Games → Teams: Overview shows frequencies and coverage, Games shows groups and results, and Drafts shows the boards to review."],
      suggestions: ['How do I link a game to an opponent team?', 'Do I need a Drafter link to associate an opponent?', 'What do the frequencies in an opponent profile count?'],
      faq: [
        {"question": "How do I associate an opponent team with a group?", "triggers": ["opponent team with a group", "group opponent team", "link a group", "scrim opponent"], "answer": "In Games → Groups, open the group then Group’s opponent team. Staff choose a profile or create a team, then click Save link. Creating the profile alone does not link the group. The link applies to existing games and games added later. If a game belongs to several linked groups, they must name the same opponent; a conflict is rejected without partial changes."},
        {"question": "What happens to game opponents if I remove the group link?", "triggers": ["remove the group link", "delete the group", "remove a game from the group", "opponent required by a group"], "answer": "Removing the group link, removing a game from the group or deleting the group preserves the opponents already associated with games. Before changing one, check other linked groups: while a group requires the opponent, the game details point to that group. Once those links are removed, staff can change the opponent from the game. The Drafter link stays independent."},
        {"question": "How do I browse an opponent team’s dossier?", "triggers": ["browse the dossier", "opponent profile tabs", "results against an opponent", "dossier drafts"], "answer": "In Games → Teams, search for and open the profile. Overview shows our record against them, their played champions, their bans against us and staff notes. Games brings together groups and games with a filter for our team’s result. Drafts lets you review each pick and ban board and reopen its source or linked game. These observations do not predict the next draft."},
        { question: 'How do I link a game to an opponent team?', triggers: ['link a game to an opponent team', 'associate an opponent', 'save opponent', 'create an opponent team'], answer: 'In Games, open the game then Opponent team. Choose an existing profile or Create an opponent team, then click Save opponent: creating the profile alone does not link the game. Staff can change this link. To remove it, choose No opponent team and save. If the opponent comes from a group, open the listed groups to change their links. Find the linked games in Games → Teams.' },
        { question: 'Do I need a Drafter link to associate an opponent?', triggers: ['without drafter', 'without a drafter link', 'drafter mandatory', 'drafter link to associate'], answer: 'No. In the game’s details, Opponent team lets you choose or create a profile and save the opponent without a Drafter link. Conversely, a draft can be linked to a game without an opponent profile. Both links are optional and independent.' },
        { question: 'What do the frequencies in an opponent profile count?', triggers: ['frequencies in an opponent profile', 'observed champions', 'bans from linked drafts', 'where do champions in an opponent profile come from'], answer: 'In Games → Teams, each linked game counts once, even across several groups. Played champions come from participants; Draft picks not confirmed in game separately shows picks from a linked draft when champion data is incomplete. Ban frequencies use drafts linked to those games with all five bans recorded or explicitly skipped. Missing data stays excluded from the relevant calculation: check coverage and source games.' },
      ],
    },
    'match-drafter': {
      title: 'Linking a Drafter draft to a game', actionLabel: 'Open games',
      summary: 'The game’s details offer Game draft (optional) to check a public Drafter.lol link and save its picks and bans. Staff can add, replace or unlink this draft.',
      keywords: ['drafter link', 'drafter import', 'import drafter', 'drafter.lol', 'check draft', 'link draft', 'game draft', 'replace draft', 'unlink draft'],
      steps: ['In Games, open the game then Game draft (optional).', 'Paste the public Drafter.lol link for the correct game. The preview opens automatically.', 'Check the preview, game number, teams, picks and bans, then choose Our team’s side.', 'Click Link draft to save. Use Analyse this draft to open Drafts & bans in Analyses; an opponent profile is optional.'],
      suggestions: ['How do I import a Drafter link into a game?', 'What happens to a replaced or unlinked draft?', 'Why is my Drafter link not working?'],
      faq: [
        { question: 'How do I import a Drafter link into a game?', triggers: ['import a drafter link', 'import drafter', 'link draft', 'check draft'], answer: 'With staff permissions, open the game in Games then Game draft (optional). Paste the public Drafter.lol link to load the preview. Check the game, teams, picks and bans, choose Our team’s side then Link draft. The preview alone does not save anything. No opponent profile is required.' },
        { question: 'Do I need an opponent team to import a draft?', triggers: ['opponent team to import a draft', 'draft without an opponent team', 'opponent profile required'], answer: 'No. In Game draft (optional), you can check the Drafter link, choose your team’s side and link the draft without creating an opponent profile. The game’s Opponent team panel separately lets you choose or create a profile and save the opponent. These two links remain optional and independent.' },
        { question: 'What happens to a replaced or unlinked draft?', triggers: ['replace draft', 'unlink draft', 'replaced draft', 'unlinked draft'], answer: 'From the game, staff can choose Replace draft and check the new link before saving it, or Unlink draft and confirm. The old draft remains in the Analyses → Drafts & bans history without a link to that game. Unlinking deletes neither the game nor its association with an opponent team.' },
        { question: 'Why is my Drafter link not working?', triggers: ['drafter link not working', 'invalid drafter link', 'drafter unavailable', 'drafter error'], answer: 'Check that the link points to a public draft on Drafter.lol and the correct game, then use Check draft. NXT5 checks the URL format. The free workflow uses the imported game file. NXT5 checks Riot for missing bans when the match is available. Bans recorded only on Drafter can remain unknown. After a valid preview, choose your team’s side and save. NXT5 does not guess missing picks or bans.' },
      ],
    },
    statistics: {
      title: 'Reading a game summary', actionLabel: 'View games',
      summary: 'Summary brings together the team compositions, gold chart, kill map and key moments. How to read this data explains the indicators and missing data.',
      keywords: ['statistics', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'gold', 'vision', 'build', 'objective', 'timeline', 'group', 'summary', 'difference', 'minions', 'key moments', 'game review', 'kill map', 'head-to-head', 'drafting', 'how to read this data'],
      steps: ['In Games, find and open the game you are interested in.', 'In Summary, read the result and team compositions, then explore the gold chart, kill map and key moments. Filter the map by team; choose a phase in key moments.', 'Use Head-to-head to compare players and Drafting to view champion choices.', 'Open Notes and choose New note to write about this game.'],
      suggestions: ['How do I read the difference at 20 minutes?', 'How do I create a group of games?', 'How do I go from a summary to a debrief?'],
      faq: [{ question: 'How do I read the differences at 10 and 20 minutes?', triggers: ['diff10', 'diff20', 'lane difference', 'cs10', 'cs20', 'difference at 20', 'difference at 10'], answer: 'CS 10 and CS 20 show minions and monsters killed at 10 and 20 minutes. In Head-to-head, select a role to see the available checkpoints for both players. Compare these values with gold, deaths and the key moments in Summary. Missing data remains displayed as —.' },
        { question: 'How do I read the five role matchups?', triggers: ['five matchups', 'role matchups', 'head to head roles', 'side colours'], answer: 'In Head-to-head, open each role for details and compare the two players. Values are shown blue then red; the arrow points to the leading side. A dash marks unavailable data.' }],
    },
    reviews: {
      title: "Team notes", actionLabel: "Open notes",
      summary: "Saved debriefs are available in each linked game’s Summary. Coaches and players write observations in Notes.",
      keywords: ["review","report","decision","notes","source game","library","staff","group","create review","edit review","debrief","prepare a debrief","linked games","gear","manage this review","automated analysis","group title"],
      steps: ["Open a game in Games, then use Summary to read its saved debriefs.", "Open Notes, choose New note and write your observations.", "Link any other relevant games.", "Save the note to share it with the team."],
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
    "answer": "In Notes, use Edit or Delete according to your permissions. To copy an observation, paste it into a new note."
  },
  {
    "question": "Why does the debrief use the group’s name?",
    "triggers": [
      "group name",
      "group title",
      "debrief title"
    ],
    "answer": "Older group debriefs keep their title. For a new note, choose a title and link the relevant games."
  },
  {
    "question": "Where can I find a debrief’s automated analysis?",
    "triggers": [
      "debrief automated analysis",
      "find automated analysis",
      "notes before analysis"
    ],
    "answer": "Open the game’s Summary in Games for saved debriefs and role differences in gold, damage and vision."
  }

    ,
{
  "question": "How do I combine several games in a debrief?",
  "triggers": [
    "combine several games",
    "debrief several games",
    "group games in a debrief"
  ],
  "answer": "In Notes, choose New note, link up to 20 games, then save."
}
],
    },
    trends: {
      title: 'Analysing several games', actionLabel: 'Open Analyses',
      summary: 'Analyses brings together results from several games in Summary, Evolution, Compare, Statistics, Champions, Drafts & bans and Playstyle. Statistics compares players. Playstyle connects observed habits with areas to work on. Period and category filters define the games studied. Drafts & bans has separate filters for saved Drafter drafts.',
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
    'drafter-analysis': {
      title: 'Analysing drafts and bans', actionLabel: 'Open Drafts & bans',
      summary: "In Analyses → Drafts & bans, examine bans against us or our bans, affected options and pick rotations. Saved Drafter drafts remain available without a linked game, with their selection order when it can be verified.",
      keywords: ['drafts & bans', 'drafter analysis', 'analyse drafts', 'pick order', 'ban order', 'selection order', 'first overall pick', 'ban phases', 'drafts without games', 'draft frequencies', "bans against us", "our bans", "affected role", "rotations", "who loses options"],
      steps: ["Open Analyses → Drafts & bans after linking a draft from a game’s details.", "Choose Linked opponent team, Bans to analyze (Bans against us or Our bans) and Our team’s side. Refine the scope filters included drafts, patch and format.", "Filter bans by phase, Affected role or champion, then open a champion to read observations, affected options and source drafts with their coverage.", "Review our pick rotations, then expand Pick and ban order to choose a Draft to review. Pick positions are not the roles played."],
      suggestions: ['How do I view the pick and ban order?', 'Why is the selection order unavailable?', 'What do frequencies and the first overall pick mean?'],
      faq: [
        {"question": "How do I find a draft without a linked game?", "triggers": ["find a draft without a linked game", "drafts without a linked game", "draft without a game"], "answer": "In Analyses → Drafts & bans, open Refine the scope then choose No linked match in Included drafts. Also check Linked opponent team: All teams, including unassigned games or No linked team lets you find this history. Expand Pick and ban order, choose the Draft to review and open its Drafter source. Replacing or unlinking a draft keeps its snapshot; no game or result is created."},
        {"question": "How do I analyze bans against us and affected roles?", "triggers": ["bans against us", "affected roles", "affected role", "who loses options", "pool pressure"], "answer": "In Analyses → Drafts & bans, choose Bans against us or Our bans, then filter by Ban phase, Affected role or champion. Open a champion to inspect phases, affected players and roles, choices observed in the same role and source drafts. Who loses options? matches bans with current declared pools, not their historical state. Roles come from compatible games or, for enemy bans, current pools; the data proves neither ban intent nor guaranteed replacements. Each rate keeps its own sample."},
        {"question": "How do I read pick rotations?", "triggers": ["pick rotations", "selection rotation", "our position in the pick order", "consecutive picks"], "answer": "In Analyses → Drafts & bans, the pick rotations panel groups our consecutive picks before the other team picks again. Choose Our position in the pick order depending on whether we have or respond to first pick. Identified roles require a compatible linked game; missing or different champions prevent role assignment. Check this rotation opens source drafts. Pick positions are not played roles and do not measure pick effectiveness."},
        { question: 'How do I view the pick and ban order?', triggers: ['pick and ban order', 'pick order', 'ban order', 'draft chronology'], answer: 'In Analyses → Drafts & bans, expand Pick and ban order then select a Draft to review. Order is reconstructed from Drafter’s verified final slots and the first-picking side. It does not describe corrections or their timestamps during the draft. Pick and ban phases are displayed by side; the roles actually played remain separate. You can reopen the Drafter source and linked game if one exists.' },
        { question: 'Why is the selection order unavailable?', triggers: ['selection order unavailable', 'order unavailable', 'unverified order'], answer: 'Order remains unavailable if the import has no verified slot evidence, the format is unsupported or picks are incomplete. From the game, staff can choose Replace draft, paste the link and Check draft, choose their side and save with Replace linked draft. The preview alone does not update the history, and an unknown format may remain unavailable. Available picks and bans remain viewable without inventing a chronology or deriving the order from played roles.' },
        { question: 'What do frequencies and the first overall pick mean?', triggers: ['first overall pick', 'draft frequencies', 'ban phases'], answer: 'Drafts & bans frequencies describe only the saved and selected drafts, with a separate count of usable drafts for each metric. Incomplete data is excluded from the relevant calculation. The first overall pick counts only drafts where the analysed side opens the selection; picks 1 to 5 are its own slots, not roles. These observations prove neither a lasting preference nor a pick’s effectiveness.' },
      ],
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
    'draft-room': {
      title: 'Live draft room', actionLabel: 'Open the draft room',
      summary: 'The draft room runs a live draft against the opposing captain, for one game or a series of 1 to 5 games, in Standard or Fearless. Recorded picks and bans are added to Drafts & bans in Analysis.',
      keywords: ['draft room', 'live draft', 'fearless', 'standard', 'opposing captain', 'opponent link', 'spectator link', 'spectator', 'series', 'timer', 'decision time', 'ready', 'champion voices', 'correct the draft', 'recent rooms', 'delete room', 'first pick'],
      steps: ['In Draft & Pool, open Draft room. The owner or staff enter the opponent (optional), Our side, First pick, the number of games (1 to 5), the decision time per turn (Unlimited, 30 s or 60 s) and the Standard or Fearless format, then choose Create room.', 'Copy the opponent link for the other team’s captain and, if needed, the spectator link. These links open without an NXT5 account.', 'Each captain confirms that their team is ready before the first ban. With a timer, time starts once the opponent is ready; every choice must be confirmed and a ban can be skipped.', 'At the end, Analyze draft opens Drafts & bans and Link to match connects the draft to an imported game. In a series, Start the next game lets you choose sides again.'],
      suggestions: ['How do I invite the opposing captain to the draft room?', 'What is the difference between Standard and Fearless?', 'How do I correct or delete a draft room?'],
      faq: [
        { question: 'How do I invite the opposing captain to the draft room?', triggers: ['invite the opposing captain', 'opponent link', 'spectator link', 'opposing captain', 'draft room without account'], answer: 'After Create room, use Copy opponent link and send it only to the other team’s captain: anyone who opens this link plays for the opposing side. Copy spectator link lets people follow the draft without playing. These links open without an NXT5 account. Both captains then confirm that their team is ready before the first ban.' },
        { question: 'What is the difference between Standard and Fearless?', triggers: ['fearless', 'draft format', 'standard draft', 'locked champions'], answer: 'In Standard, every champion is available again in each game of the series. In Fearless, a played champion is locked for both sides until the end of the series; the room shows locked champions. Format, number of games and decision time are chosen when creating the room.' },
        { question: 'How do I correct or delete a draft room?', triggers: ['correct the draft', 'delete room', 'recent rooms', 'pick mistake', 'edit the draft'], answer: 'Once the game is finished, the owner or staff choose Correct the draft, select a slot then a champion and save the correction; in Fearless, a champion already played in the series is refused. In Recent rooms, Delete room removes the whole series and its picks and bans from analyses. This deletion is permanent.' },
      ],
    },
    planning: {
      title: 'Schedule and availability', actionLabel: 'Open Schedule',
      summary: 'The schedule brings together availability, sessions and weekly notes. Saved notes are visible to the whole team.',
      keywords: ['schedule', 'planning', 'availability', 'week', 'scrim', 'match', 'session', 'event', 'time', 'staff', 'weekly notes', 'schedule note', 'late', 'practice', 'debrief'],
      steps: ['Choose the week to prepare.', 'Enter availability and, if needed, a note for this week (up to 500 characters).', 'Add team sessions with their type and time.', 'Check availability before confirming a session.'],
      suggestions: ['How do I enter availability?', 'Who can add a session?', 'Who can see my schedule notes?'],
      faq: [{ question: 'Who can see my schedule notes?', triggers: ['schedule notes', 'schedule note', 'weekly notes', 'note visible', 'late'], answer: 'Saved notes are visible to the whole team for the displayed week, with a 500-character limit. Staff share one common note. Refresh notes reloads saved notes; if saving fails, use Retry saving.' }],
    },
    scrims: {
      title: 'Scrims between NXT5 teams', actionLabel: 'Open Scrims',
      summary: 'Scrims has Find an opponent and My scrims tabs. Staff publish a slot for 1 to 5 games, BO3 or BO5; once confirmed, the session appears in both teams’ schedules.',
      keywords: ['scrims', 'scrim', 'opponent', 'offer', 'slot', 'level', 'opposing team', 'find a team', 'confirm a scrim', 'answer an offer', 'find an opponent', 'my scrims', 'format', 'bo3', 'bo5'],
      steps: ['In My scrims, staff publish an offer with a date, format (1 to 5 games, BO3 or BO5), minimum and maximum levels, and optional details. Duration is no longer entered.', 'In Find an opponent, browse other teams’ offers and reply with a message.', 'In My scrims, confirm a received reply: the others are declined and the session appears in both teams’ schedules.', 'With active Discord publishing and a planning channel, the bot announces the confirmed scrim.'],
      suggestions: ['How do I offer a scrim to another team?', 'Who can confirm a scrim?', 'Where does a confirmed scrim appear?'],
      faq: [
        { question: 'Who can confirm a scrim?', triggers: ['confirm a scrim', 'who confirms', 'accept a scrim', 'publish a scrim', 'offer a scrim'], answer: 'Only the team staff (owner, captain, coach, assistant, analyst, manager, board) publishes an offer, answers other teams’ offers and confirms an answer. Other members can browse the offers.' },
        { question: 'Where does a confirmed scrim appear?', triggers: ['confirmed scrim', 'where does it appear', 'scrim schedule', 'scrim session'], answer: 'Confirming creates a scrim session in both teams’ schedules, visible in Schedule and in /nxt planning. If Discord publishing is active with a planning channel, the bot announces it there on its next pass.' },
        { question: 'Which scrim formats and tabs are available?', triggers: ['scrim format', 'scrim formats', 'bo3', 'bo5', 'find an opponent', 'my scrims', 'scrim duration'], answer: 'Find an opponent shows offers from other teams. My scrims groups your team’s offers, sent replies and confirmed scrims. When publishing, choose 1 to 5 games, BO3 or BO5; duration is no longer entered. The confirmed schedule session defaults to two hours.' },
      ],
    },
    'nexus-rising': {
      title: 'Nexus Rising league', actionLabel: 'Open Nexus Rising',
      summary: 'Nexus Rising is the league portal linked to NXT5 accounts and teams. During pre-opening, visitors and non-admin accounts see Coming soon; registration and fixtures are reserved for authorised administrators.',
      keywords: ['nexus rising', 'league', 'tournament', 'season', 'registration', 'standings', 'playoffs', 'coming soon', 'fixture code', 'nexus importer', 'tie breaker'],
      steps: ['Open Nexus Rising from the NXT5 menu in the same tab.', 'During pre-opening, view Coming soon. Only authorised administrators can access the portal and registration.', 'The portal uses existing NXT5 teams; results count only after staff accept the submitted games.', 'For an authorised fixture, staff give a Nexus pairing code to a roster captain; it does not create a League of Legends lobby.'],
      suggestions: ['Why does Nexus Rising show Coming soon?', 'Can I register my team for Nexus Rising?', 'How are Nexus Rising results validated?'],
      faq: [
        { question: 'Why does Nexus Rising show Coming soon?', triggers: ['nexus coming soon', 'nexus unavailable', 'nexus portal closed', 'nexus pre-opening'], answer: 'Nexus Rising is in pre-opening. Visitors and non-admin accounts see Coming soon at /nexus-rising. Only authorised NXT5 administrators can access the preparation portal; signing in with an ordinary account does not unlock registration.' },
        { question: 'Can I register my team for Nexus Rising?', triggers: ['register my team for nexus', 'nexus rising registration', 'join the league', 'nexus season'], answer: 'Not during the current pre-opening: registration is reserved for authorised administrators. At a future opening, the portal will reuse an existing NXT5 team; its owner, captain or manager will be able to request registration, then staff will check the roster and eligibility.' },
        { question: 'How are Nexus Rising results validated?', triggers: ['nexus results', 'fixture code', 'nexus importer', 'accepted game', 'nexus standings'], answer: 'Staff prepare the fixture and give a personal one-use code to an authorised captain. The captain links NXT5 Importer to the fixture and starts collection before the game ends. Staff then review submissions: only an accepted game counts toward the series score, standings and bracket. Receipt alone does not validate a result.' },
        { question: 'How are tied teams ranked in Nexus Rising?', triggers: ['nexus tie breaker', 'nexus tie', 'nexus tiebreak', 'nexus seeds'], answer: 'The points tie-break rule is chosen explicitly for each season. It may use head-to-head results and game difference in the order set by staff. A remaining tie never qualifies a team automatically: staff document the decision before assigning an affected seed.' },
      ],
    },
    'player-profile': {
      title: 'Player profile and follow-up', actionLabel: 'Open My profile',
      summary: 'My profile brings together Summary, Played champions, Champion pool, History and Tracking. The card and Wrapped appear at the top of Summary. Notes and notebooks remain subject to access permissions.',
      keywords: ['profile', 'my profile', 'player', 'history', 'coaching', 'goal', 'champions', 'matchups', 'notebook', 'average damage', 'champion damage', 'progress', 'notes', 'follow-up', 'duel'],
      steps: ['Check that your account is linked to the correct player in Team management.', 'Start with the overview to identify a point to work on.', 'In Played champions, open a champion, then Statistics or Matchups to examine results, damage and notebooks. Champion pool shows the champions prepared in Draft.', 'In History, find the linked games to verify an observation (Matches per page sets the display), then open Tracking for goals and notes.'],
      suggestions: ['Why is my profile empty?', 'Where can I see my history?', 'How do I track a goal?'],
      faq: [
        { question: 'Why is my profile empty?', triggers: ['empty profile', 'no profile stats', 'no profile games', 'empty history', 'no games in profile'], answer: 'First check that your NXT5 account is linked to the correct player in Team management. Then check the players linked to imported games: a game assigned to a duplicate profile or no player cannot populate your profile correctly.' },
        { question: 'Where can I read average champion damage?', triggers: ['average damage', 'damage to champions', 'champion damage'], answer: 'In My profile → Played champions, select a champion, then Statistics. Average damage to champions uses games with available data; “—” means unavailable. Open a game to compare players: damage differences are measured at the end of the game.' },
        { question: 'How do I save a matchup notebook?', triggers: ['matchup notebook', 'save notebook', 'starting plan', 'prepare notebook'], answer: 'In My profile → Played champions, open a champion, then Matchups. Prepare notebook or Edit notebook lets you enter the starting plan and experiments, subject to your permissions. The draft is kept while navigating, but click Save notebook to save your changes.' },
      ],
    },
    'player-showcase': {
      title: 'Player card and Wrapped', actionLabel: 'Open the card in Summary',
      summary: 'At the top of Summary, the two-sided player card and the five-chapter Wrapped sum up the games linked to the player in the selected category.',
      keywords: ['card', 'player card', 'wrapped', 'my sheet', 'poster', 'export', 'export png', 'png', 'front', 'back', 'chapter'],
      steps: ['In My profile, choose the player and category: the card and Wrapped chapters appear at the top of Summary.', 'On The card, use View back or View front to switch sides.', 'Choose a Wrapped chapter, then move on with the buttons, the keyboard arrows or a swipe on the visual.', 'Download the displayed visual as a PNG. Data and method for this edition explains the games and values used.'],
      suggestions: ['How do I export my card as a PNG?', 'Why is my card empty?', 'How do I explore Wrapped?'],
      faq: [{ question: 'Why is my card empty?', triggers: ['empty card', 'my card empty', 'empty wrapped', 'no card'], answer: 'The card and Wrapped need at least one game linked to the player in the selection. Change the category or import a game, then check that the correct player profile is linked to it.' }],
    },
    discord: {
      title: 'Discord account and bot', actionLabel: 'Open Discord bot',
      summary: 'Discord bot brings together your account link, the server connection, each team’s command channel and publications. In Discord, five commands are enough: /nxt help, /nxt lier, /nxt profil, /nxt voir and /nxt connecter.',
      keywords: ['discord', 'bot', 'link', 'linking', 'server', 'channel', 'command channel', 'publication', 'publishing', 'nxt', 'nxt voir', 'nxt profil', 'discord command', 'discord role'],
      steps: ['For your account, run /nxt lier and open the personal link. Confirm your account on NXT5, then Check link and Confirm link in Discord after checking the username shown.', 'The owner or a captain creates a code in Discord bot, then runs /nxt connecter code:<code> with the same linked account. They then choose the team’s command channel and, separately, the publication channels.', 'In the command channel, /nxt voir shows the latest game, the summary, statistics, schedule, goals, debriefs or compositions. The channel determines the team.', 'Send the fictional example with Test and activate, check that it arrived, then activate publishing. Installation does not republish old games.'],
      suggestions: ['How do I link my Discord account?', 'How do I view team data on Discord?', 'Why does the bot refuse my command?'],
      faq: [
        { question: 'How do I link my Discord account?', triggers: ['link my discord account', 'discord account', 'nxt lier'], answer: 'In Discord, run /nxt lier and open your personal link, valid for 10 minutes. Your NXT5 email address must be verified. Confirm your account on NXT5, then return to Discord: Check link shows your Discord username and ID. Click Confirm link only if both accounts are yours, and never confirm a link someone else sent you. An email then notifies you; Unlink my account, in Discord bot, revokes this link. /nxt help remains available without a linked account.' },
        { question: 'How do I view team data on Discord?', triggers: ['nxt voir', 'view on discord', 'data on discord', 'command channel', 'use the bot'], answer: 'In your team’s command channel, run /nxt voir and choose a topic: derniere, bilan, stats, planning, objectifs, reviews or draft. The channel determines the team; the bot checks your linked account, your team membership and, if the team requires one, your Discord role. The latest game, summary and statistics are posted in the channel, at most once per topic every 30 seconds; other topics stay visible only to you.' },
        { question: 'Why does the bot refuse my command?', triggers: ['command refused', 'bot refuses', 'discord access denied', 'discord refusal', 'wrong channel'], answer: 'Use /nxt profil to check that your account is linked, that you are writing in your team’s command channel and that your NXT5 account is a member of that team. If the team selected roles in Command access, you must also have one of them: even a Discord administrator cannot bypass this rule. A command run in another channel is refused without posting anything.' },
        { question: 'What do Discord publications share?', triggers: ['discord publications', 'private notes discord', 'discord sharing', 'publish on discord'], answer: 'From a game, use Export to Discord if your permissions allow it. Choose the channel, prepare the preview, then confirm publication. The result, statistics and visual are shared. Private staff notes are not included. Channel members can read the message; opening the game in NXT5 still requires team access.' },
      ],
    },
    'permissions-and-account': {
      title: 'Access and account settings', actionLabel: 'Open settings',
      summary: 'Your team role determines which actions are available. Settings manages your username, email, security, related connections and NXT5 emails; Team management organises players and their access.',
      keywords: ['permission', 'rights', 'access', 'captain', 'coach', 'manager', 'analyst', 'player', 'account', 'email', 'password', 'security', 'settings', 'related connections', 'google', 'keep me logged in', 'session'],
      steps: ['Check your role in the active team.', 'Open Settings for your username, email, password, related connections and NXT5 emails.', 'Open Team management for player profiles and their access.', 'If an action remains blocked, ask the captain or an authorised staff member.'],
      suggestions: ['How do I change my email address?', 'How do I link Google or Discord to my account?', 'Why is a button blocked?'],
      faq: [
        { question: 'How do I change my email address?', triggers: ['change my email', 'edit my email', 'new address', 'email change'], answer: 'In Settings → Username and email, enter the new address and your current password. A link is sent to the new address: open it in this browser, signed in to your account, within 24 hours. Your current address stays active until then, and Cancel the change drops the request. If your account has no NXT5 password yet, create one first from Account security.' },
        { question: 'How do I link Google or Discord to my account?', triggers: ['related connections', 'link google', 'google sign in', 'sign in with discord', 'unlink', 'other sign-in method'], answer: 'First sign in to your existing NXT5 account, then open Settings → Related Connections and choose Associate for an available service; services that are not enabled are shown as unavailable. Unlinking a service or changing your email requires an NXT5 password: without one, Account security lets you receive a link to create it. This site sign-in does not link the Discord bot, which uses /nxt lier.' },
        { question: 'What does Keep me logged in change?', triggers: ['keep me logged in', 'stay logged in', 'logged out', 'session length'], answer: 'With Keep me logged in, your session lasts 30 days on this device. Without it, the session ends when the browser closes and after 12 hours at most. After a confirmed email change, other sessions are signed out.' },
      ],
    },
    support: {
      title: 'Support NXT5', actionLabel: 'Open Support NXT5',
      summary: 'Support NXT5 presents optional support for development. Support does not change any access or unlock any feature.',
      keywords: ['support', 'ko-fi', 'kofi', 'donation', 'donate', 'contribution', 'fund'],
      steps: ['Open Support NXT5 from the home page or the footer.', 'When contributions are open, Support the project opens Ko-fi in a new tab; amount, frequency and confirmation are handled on that platform.'],
      suggestions: ['How do I support NXT5?'],
      faq: [{ question: 'How do I support NXT5?', triggers: ['support nxt5', 'ko-fi', 'kofi', 'make a donation', 'financial support'], answer: 'The Support NXT5 page presents optional support. When contributions are open, Support the project opens Ko-fi in a new tab to choose a one-off or monthly amount. NXT5 collects no payment data, and support does not change any access or feature.' }],
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
        { question: 'The site is slow on my device, what can I do?', triggers: ['slow site', 'slows down', 'performance mode', 'visual effects', 'stutter', 'not smooth'], answer: 'In Settings → Display on this device, choose Performance mode to reduce visual effects. This setting only applies to this browser; Complete rendering restores the effects.' },
      ],
    },
  },
  es: {
    'importer-video': {
      title: 'Vídeo tutorial de NXT5 Importer', actionLabel: 'Abrir el tutorial de importación',
      summary: `Este vídeo en francés muestra cómo exportar una partida con NXT5 Importer en Windows y añadirla a NXT5: ${IMPORTER_TUTORIAL_URL}. El enlace de YouTube también está en el asistente y junto a los controles de importación.`,
      keywords: ['tutorial', 'vídeo', 'youtube', 'importer', 'windows', 'exportar', 'primera partida'],
      steps: ['Abre Vídeo tutorial: importar una partida en Windows. El vídeo está en francés, dura 2 min 31 y se abre en YouTube en una nueva pestaña.', 'Mantén abierto el cliente de League of Legends, exporta el archivo JSON con NXT5 Importer y añádelo en Partidas.'],
      suggestions: ['¿Dónde está el vídeo tutorial para importar una partida?', '¿Cómo importo mi primera partida?'],
      faq: [{ question: '¿Dónde está el vídeo tutorial para importar una partida?', triggers: ['tutorial', 'vídeo importar', 'youtube', 'usar importer'], answer: `Mira el tutorial de NXT5 Importer para Windows: ${IMPORTER_TUTORIAL_URL}. Está en francés y dura 2 min 31. También está en el asistente, en Guía → Importar y junto al selector de archivos en Partidas.` }],
    },
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
        { question: '¿Cómo copio el multi OP.GG de todo el equipo?', triggers: ['copiar opgg', 'copiar multi op gg', 'multi opgg', 'op gg titulares', 'opgg equipo', 'opgg plantilla', 'opgg titulares'], answer: 'En Equipo, Copiar multi OP.GG incluye a titulares y suplentes con un Riot ID válido. El cuerpo técnico no está incluido.' },
        { question: '¿Por qué un jugador tiene menos partidas?', triggers: ['menos partidas', 'partidas faltantes', 'cantidad de partidas diferente', 'adc menos', 'faltan partidas'], answer: 'El contador depende del perfil vinculado a cada participante importado. En Partidas, abre la partida correspondiente y sus opciones para comprobar el jugador asociado y su posición. Corrige la asociación si el jugador ha cambiado de Riot ID o se ha elegido un perfil duplicado.' },
      ],
    },
    'imports-and-games': {
      title: 'Importar y gestionar partidas', actionLabel: 'Abrir Partidas',
      summary: 'Partidas reúne las partidas importadas y sus resúmenes. Importar una partida abre el selector de archivos. Las correcciones están disponibles en las opciones de cada partida.',
      keywords: ['importar', 'importación', 'json', 'game id', 'partida', 'lado', 'calle', 'perfil', 'crear perfiles', 'categoría', 'scrim', 'subir', 'historial'],
      steps: ["Para no hacer nada a mano: en Partidas → Importación automática, vincula NXT5 Importer al equipo con un código y deja el Importer abierto durante las customs. Las partidas reconocidas llegan solas; las demás quedan por finalizar.", 'Prepara el archivo .json con NXT5 Importer. La ayuda ¿Aún no tienes un archivo? explica cómo obtenerlo.', 'En Partidas, elige Importar una partida y después Elegir mi archivo.', 'Elige el lado de tu equipo, comprueba las posiciones de ambos equipos y vincula cinco perfiles diferentes. Crea los perfiles que falten durante la importación si es necesario.', 'Pon un nombre a la partida y selecciona al menos una categoría. Equipo rival (opcional) permite elegir una ficha o Nuevo equipo; después confirma la importación.'],
      suggestions: ['¿Por qué falla mi importación?', '¿Cómo corrijo el jugador asociado?', '¿Cómo encuentro una partida importada?'],
      faq: [
        { question: "¿Cómo importo mis partidas automáticamente?", triggers: ["importación automática", "importar automáticamente", "vincular el importer", "código de vinculación", "recogida automática", "partida recibida", "por finalizar"], answer: "En Partidas → Importación automática, el staff genera un código y lo pega en la pestaña Recogida automática de NXT5 Importer (válido 15 minutos, una sola vez). Después, cada custom jugada con el Importer abierto llega sola, con el lado, los puestos y los jugadores reconocidos gracias a los Riot ID de la plantilla. Una partida no reconocida aparece en Partidas recibidas con el botón Finalizar, que abre el formulario de importación habitual. La vinculación caduca a los 90 días y se revoca con un clic." },
        { question: '¿Dónde está la recogida automática en NXT5 Importer 0.4.1?', triggers: ['importer 0.4.1', 'barra lateral importer', 'dónde está recogida automática', 'nueva interfaz importer'], answer: 'En NXT5 Importer 0.4.1, la barra lateral reúne Exportar, Recogida automática, Historial y Ajustes. En ventanas de menos de 900 px se convierte en barra superior. El funcionamiento y los atajos de recogida no han cambiado desde la versión 0.4.0.' },
        { question: '¿Por qué la recogida automática ignora una partida?', triggers: ['recogida ignora', 'partida ignorada', 'partida clasificatoria', 'partida normal', 'ranked', 'no es custom', 'partida no recogida'], answer: 'Desde NXT5 Importer 0.4.9, la recogida automática solo conserva las partidas personalizadas (customs). NXT5 también ignora cualquier partida recibida por la vinculación que no sea una custom. Una partida clasificatoria o normal todavía puede añadirse importando manualmente su archivo JSON. Comprueba también que el Importer siguió abierto hasta el final de la partida y que su vinculación no ha caducado.' },
        {"question": "¿Cómo elijo un equipo rival durante la importación?", "triggers": ["rival durante la importación", "equipo rival al importar", "nuevo equipo al importar", "reimportar rival"], "answer": "Después del archivo y de elegir tu lado, usa Equipo rival (opcional) para seleccionar una ficha o Nuevo equipo. La nueva ficha y su vínculo se guardan solo al confirmar la importación; cancelar no crea esa ficha rival. Sin especificar deja una partida nueva sin rival y conserva el vínculo existente al reimportar. Si un grupo impone ese rival, modifica el vínculo del grupo para cambiarlo."},
        {"question": "¿Es obligatoria una categoría para importar?", "triggers": ["categoría obligatoria", "etiqueta obligatoria", "sin categoría", "sin etiqueta"], "answer": "Sí. Selecciona al menos una categoría antes de confirmar la importación, además del lado de tu equipo y cinco perfiles de jugador distintos. Elegir un equipo rival sigue siendo opcional."},
        { question: '¿Por qué no funciona mi importación?', triggers: ['importación falla', 'error de importación', 'json rechazado', 'partida no encontrada', 'subida bloqueada', 'importación bloqueada'], answer: 'Comprueba tus permisos de gestión, el lado elegido, las posiciones de ambos equipos y los cinco perfiles diferentes vinculados. Los perfiles que falten se pueden crear durante la importación. Utiliza un archivo .json reciente de NXT5 Importer para una partida terminada. Si la subida funciona pero falla el análisis, vuelve a exportar la partida desde el PC donde aparece en el cliente de LoL.' },
        { question: '¿Tengo que crear todos los perfiles antes de importar?', triggers: ['crear perfiles', 'perfiles que faltan', 'perfiles antes de importar', 'sin cinco jugadores'], answer: 'Puedes empezar a importar sin haber preparado todos los perfiles. Después de elegir el lado, comprueba los nombres y Riot IDs propuestos y crea los perfiles que falten durante la importación. Vincula cada una de las cinco posiciones a un perfil diferente antes de confirmar la partida.' },
        { question: '¿Cómo corrijo un jugador o una posición?', triggers: ['corregir perfil', 'calle incorrecta', 'jugador incorrecto', 'asignación', 'modificar importación', 'posición incorrecta'], answer: 'En Partidas, abre la partida y sus opciones de gestión. Comprueba el lado, las posiciones y los jugadores asociados antes de guardar. Los resúmenes y análisis utilizarán las asociaciones corregidas.' },
      ],
    },
    opponents: {
      title: 'Preparar los equipos rivales', actionLabel: 'Abrir equipos rivales',
      summary: "En Partidas → Equipos, cada ficha rival ofrece Vista general, Partidas y Drafts con los grupos vinculados, los campeones observados y las notas del cuerpo técnico. Una partida o un grupo puede vincularse a un equipo rival sin un draft de Drafter.",
      keywords: ['equipo rival', 'equipos rivales', 'ficha rival', 'fichas de rivales', 'dossier rival', 'vincular una partida', 'asociar un rival', 'guardar rival', 'sin drafter', 'scouting', "equipo rival del grupo", "vínculo del grupo"],
      steps: ["Selecciona tu equipo y abre Partidas → Equipos. El cuerpo técnico puede añadir una ficha con un nombre y notas opcionales.", "En los detalles de una partida, abre Equipo rival y elige una ficha existente o Crear un equipo rival.", "Pulsa Guardar rival. Para toda una sesión, abre el grupo en Partidas → Grupos, elige Equipo rival del grupo y pulsa Guardar vínculo.", "Vuelve a Partidas → Equipos: Vista general presenta frecuencias y cobertura, Partidas muestra grupos y resultados, y Drafts permite revisar los tableros."],
      suggestions: ['¿Cómo vinculo una partida a un equipo rival?', '¿Necesito un enlace de Drafter para asociar un rival?', '¿Qué cuentan las frecuencias de una ficha rival?'],
      faq: [
        {"question": "¿Cómo asocio un equipo rival a un grupo?", "triggers": ["rival a un grupo", "equipo rival del grupo", "vincular un grupo", "rival del scrim"], "answer": "En Partidas → Grupos, abre el grupo y después Equipo rival del grupo. El cuerpo técnico elige una ficha o crea un equipo y pulsa Guardar vínculo. Crear la ficha por sí solo no vincula el grupo. El vínculo se aplica a las partidas actuales y a las añadidas después. Si una partida pertenece a varios grupos vinculados, todos deben indicar el mismo rival; un conflicto se rechaza sin cambios parciales."},
        {"question": "¿Qué ocurre con los rivales de las partidas al quitar el vínculo del grupo?", "triggers": ["quitar el vínculo del grupo", "eliminar el grupo", "quitar una partida del grupo", "rival impuesto por un grupo"], "answer": "Quitar el vínculo del grupo, quitar una partida del grupo o eliminar el grupo conserva los rivales ya asociados a las partidas. Antes de cambiarlos, revisa los otros grupos vinculados: mientras un grupo imponga el rival, los detalles de la partida remiten a ese grupo. Tras quitar esos vínculos, el cuerpo técnico puede modificar el rival desde la partida. El enlace de Drafter sigue siendo independiente."},
        {"question": "¿Cómo recorro el dossier de un equipo rival?", "triggers": ["recorrer el dossier", "pestañas de la ficha rival", "resultados contra un rival", "drafts del dossier"], "answer": "En Partidas → Equipos, busca y abre la ficha. Vista general muestra nuestro balance contra ellos, sus campeones jugados, sus bloqueos contra nosotros y las notas del cuerpo técnico. Partidas reúne grupos y partidas con un filtro del resultado de nuestro equipo. Drafts permite revisar cada tablero de selecciones y bloqueos y abrir su fuente o partida vinculada. Estas observaciones no predicen el próximo draft."},
        { question: '¿Cómo vinculo una partida a un equipo rival?', triggers: ['vincular una partida a un equipo rival', 'asociar un rival', 'guardar rival', 'crear un equipo rival'], answer: 'En Partidas, abre la partida y después Equipo rival. Elige una ficha existente o Crear un equipo rival y pulsa Guardar rival: crear la ficha por sí solo no vincula la partida. El cuerpo técnico puede cambiar este vínculo. Para quitarlo, elige Ningún equipo rival y guarda. Si el rival depende de un grupo, abre los grupos indicados para modificar sus vínculos. Encontrarás las partidas vinculadas en Partidas → Equipos.' },
        { question: '¿Necesito un enlace de Drafter para asociar un rival?', triggers: ['sin drafter', 'sin enlace de drafter', 'drafter obligatorio', 'enlace de drafter para asociar'], answer: 'No. En los detalles de la partida, Equipo rival permite elegir o crear una ficha y guardar el rival sin enlace de Drafter. A la inversa, un draft puede vincularse a la partida sin ficha rival. Ambos vínculos son opcionales e independientes.' },
        { question: '¿Qué cuentan las frecuencias de una ficha rival?', triggers: ['frecuencias de una ficha rival', 'campeones observados', 'bloqueos de drafts vinculados', 'de dónde vienen los campeones de una ficha rival'], answer: 'En Partidas → Equipos, cada partida vinculada cuenta una vez, aunque esté en varios grupos. Los campeones jugados proceden de los participantes; Selecciones del draft no confirmadas en partida muestra por separado los picks de un draft vinculado cuando faltan datos de campeones. Las frecuencias de bloqueos utilizan los drafts vinculados a esas partidas con sus cinco bloqueos registrados o explícitamente no utilizados. Los datos ausentes se excluyen del cálculo correspondiente: consulta la cobertura y las partidas de origen.' },
      ],
    },
    'match-drafter': {
      title: 'Vincular un draft de Drafter a una partida', actionLabel: 'Abrir partidas',
      summary: 'Los detalles de una partida ofrecen Draft de la partida (opcional) para comprobar un enlace público de Drafter.lol y guardar sus selecciones y bloqueos. El cuerpo técnico puede añadir, reemplazar o desvincular este draft.',
      keywords: ['enlace drafter', 'enlace de drafter', 'importar drafter', 'importación drafter', 'drafter.lol', 'comprobar draft', 'vincular draft', 'draft de la partida', 'reemplazar draft', 'desvincular draft'],
      steps: ['En Partidas, abre la partida y después Draft de la partida (opcional).', 'Pega el enlace público de Drafter.lol de la game correcta. La vista previa se abre automáticamente.', 'Comprueba la vista previa, el número de game, los equipos, las selecciones y los bloqueos, y elige el Lado de nuestro equipo.', 'Pulsa Vincular draft para guardar. Usa Analizar este draft para abrir Drafts y bloqueos en Análisis; la ficha rival es opcional.'],
      suggestions: ['¿Cómo importo un enlace de Drafter en una partida?', '¿Qué ocurre con un draft reemplazado o desvinculado?', '¿Por qué no funciona mi enlace de Drafter?'],
      faq: [
        { question: '¿Cómo importo un enlace de Drafter en una partida?', triggers: ['importar un enlace de drafter', 'importo un enlace de drafter', 'importar drafter', 'vincular draft', 'comprobar draft'], answer: 'Con permisos del cuerpo técnico, abre la partida en Partidas y después Draft de la partida (opcional). Pega el enlace público de Drafter.lol. La vista previa se abre automáticamente. Comprueba la game, los equipos, las selecciones y los bloqueos, elige el Lado de nuestro equipo y después Vincular draft. La vista previa por sí sola no guarda nada. No se necesita ninguna ficha rival.' },
        { question: '¿Necesito un equipo rival para importar un draft?', triggers: ['equipo rival para importar un draft', 'draft sin equipo rival', 'ficha rival obligatoria'], answer: 'No. En Draft de la partida (opcional), puedes comprobar el enlace de Drafter, elegir el lado de tu equipo y vincular el draft sin crear una ficha rival. El panel Equipo rival de la partida permite elegir o crear una ficha y guardar el rival por separado. Ambos vínculos siguen siendo opcionales e independientes.' },
        { question: '¿Qué ocurre con un draft reemplazado o desvinculado?', triggers: ['reemplazar draft', 'desvincular draft', 'draft reemplazado', 'draft desvinculado'], answer: 'Desde la partida, el cuerpo técnico puede elegir Reemplazar draft y comprobar el nuevo enlace antes de guardarlo, o Desvincular draft y confirmar. El draft anterior permanece en el historial de Análisis → Drafts y bloqueos sin vínculo con esa partida. Desvincular no elimina la partida ni su asociación con un equipo rival.' },
        { question: '¿Por qué no funciona mi enlace de Drafter?', triggers: ['no funciona mi enlace de drafter', 'enlace drafter no válido', 'drafter no disponible', 'error drafter'], answer: 'Comprueba que el enlace lleve a un draft público en Drafter.lol y a la game correcta. NXT5 comprueba el formato del enlace. El flujo gratuito usa los campeones del archivo de partida. NXT5 busca los bloqueos que falten en Riot si la partida está disponible. Los bloqueos registrados solo en Drafter pueden quedar como desconocidos. Tras una vista previa válida, elige el lado de tu equipo y guarda. NXT5 no inventa las selecciones o bloqueos ausentes.' },
      ],
    },
    statistics: {
      title: 'Leer el resumen de una partida', actionLabel: 'Ver las partidas',
      summary: 'Resumen reúne las composiciones, la curva de oro, el mapa de eliminaciones y los momentos clave. Cómo interpretar estos datos explica los indicadores y los datos que faltan.',
      keywords: ['estadísticas', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'oro', 'visión', 'objetos', 'objetivo', 'cronología', 'grupo', 'resumen', 'diferencia', 'súbditos', 'momentos clave', 'análisis de la partida', 'mapa de eliminaciones', 'cara a cara', 'drafting', 'cómo interpretar estos datos'],
      steps: ['En Partidas, busca y abre la partida que te interesa.', 'En Resumen, consulta el resultado y las composiciones, y recorre la curva de oro, el mapa de eliminaciones y los momentos clave. Filtra el mapa por equipo y elige una fase en los momentos clave.', 'Usa Cara a cara para comparar jugadores y Drafting para consultar las elecciones de campeones.', 'Abre Notas y elige Nueva nota para escribir sobre esta partida.'],
      suggestions: ['¿Cómo leo la diferencia a los 20 minutos?', '¿Cómo creo un grupo de partidas?', '¿Cómo paso del resumen a una revisión?'],
      faq: [{ question: '¿Cómo leo las diferencias a los 10 y 20 minutos?', triggers: ['diff10', 'diff20', 'diferencia de calle', 'cs10', 'cs20', 'diferencia a los 20', 'diferencia a los 10'], answer: 'CS 10 y CS 20 indican los súbditos y monstruos eliminados a los 10 y 20 minutos. En Cara a cara, selecciona un rol para consultar los registros disponibles de ambos jugadores. Compara estos valores con el oro, las muertes y los momentos clave del Resumen. Los datos ausentes se muestran como —.' },
        { question: '¿Cómo leo los cinco duelos por puesto?', triggers: ['cinco duelos', 'duelos por puesto', 'cara a cara puestos', 'colores de los lados'], answer: 'En Cara a cara, abre los detalles de cada puesto para comparar a los dos jugadores. Los valores se leen primero azul y luego rojo; la flecha señala el lado que va por delante. Un guion indica datos no disponibles.' }],
    },
    reviews: {
      title: "Notas del equipo", actionLabel: "Abrir notas",
      summary: "Los análisis guardados se leen en el Resumen de cada partida vinculada. El entrenador y los jugadores escriben sus observaciones en Notas.",
      keywords: ["revisión","review","informe","decisión","notas","partida de origen","biblioteca","cuerpo técnico","grupo","crear revisión","modificar revisión","debrief","partidas vinculadas","análisis postpartida","preparar un análisis postpartida","engranaje","gestionar este análisis postpartida","análisis automático","nombre del grupo"],
      steps: ["En Partidas, abre el Resumen para leer los análisis guardados.", "En Notas, elige Nueva nota y escribe tus observaciones.", "Vincula las demás partidas que correspondan.", "Guarda la nota para compartirla con el equipo."],
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
    "answer": "En Notas, utiliza Editar o Eliminar según tus permisos. Para copiar una observación, pega el texto en una nota nueva."
  },
  {
    "question": "¿Por qué el análisis postpartida usa el nombre del grupo?",
    "triggers": [
      "nombre del grupo",
      "título del grupo",
      "título del análisis postpartida"
    ],
    "answer": "Los análisis de grupo anteriores conservan su título. Al crear una nota, elige un título y vincula las partidas correspondientes."
  },
  {
    "question": "¿Dónde encuentro el análisis automático de un análisis postpartida?",
    "triggers": [
      "análisis automático postpartida",
      "encontrar análisis automático",
      "notas antes del análisis"
    ],
    "answer": "En Partidas, abre el Resumen para ver los análisis guardados y las diferencias por posición en oro, daño y visión."
  }

    ,
{
  "question": "¿Cómo reúno varias partidas en un análisis postpartida?",
  "triggers": [
    "reúno varias partidas",
    "reunir varias partidas",
    "análisis postpartida varias partidas"
  ],
  "answer": "En Notas, elige Nueva nota, vincula las partidas (máximo 20) y guarda."
}
],
    },
    trends: {
      title: 'Analizar varias partidas', actionLabel: 'Abrir Análisis',
      summary: 'Análisis reúne los resultados de varias partidas en Resumen, Evolución, Comparar, Estadísticas, Campeones, Drafts y bloqueos y Estilo de juego. Estadísticas compara a los jugadores. Estilo de juego relaciona los hábitos observados con los aspectos a trabajar. Los filtros de periodo y categoría definen las partidas estudiadas. Drafts y bloqueos tiene filtros propios para los drafts de Drafter guardados.',
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
    'drafter-analysis': {
      title: 'Analizar los drafts y bloqueos', actionLabel: 'Abrir Drafts y bloqueos',
      summary: "En Análisis → Drafts y bloqueos, examina los bloqueos contra nosotros o nuestros bloqueos, las opciones afectadas y las rotaciones de selecciones. Los drafts de Drafter guardados siguen disponibles sin partida vinculada, con su orden de selección cuando puede verificarse.",
      keywords: ['drafts y bloqueos', 'análisis drafter', 'analizar drafts', 'orden de selecciones', 'orden de bloqueos', 'orden de selección', 'primera selección global', 'fases de bloqueo', 'drafts sin partida', 'frecuencias de drafts', "bloqueos contra nosotros", "nuestros bloqueos", "rol afectado", "rotaciones", "quién pierde opciones"],
      steps: ["Abre Análisis → Drafts y bloqueos después de vincular un draft desde los detalles de una partida.", "Elige Equipo rival vinculado, Bloqueos que analizar (Bloqueos contra nosotros o Nuestros bloqueos) y Lado de nuestro equipo. Ajustar el alcance filtra los drafts incluidos, el parche y el formato.", "Filtra los bloqueos por fase, Rol afectado o campeón y abre un campeón para leer las observaciones, las opciones afectadas y los drafts de origen con su cobertura.", "Consulta nuestras rotaciones de selecciones y despliega Orden de selecciones y bloqueos para elegir un Draft que revisar. Las posiciones de selección no son los roles jugados."],
      suggestions: ['¿Cómo consulto el orden de selecciones y bloqueos?', '¿Por qué no está disponible el orden de selección?', '¿Qué significan las frecuencias y la primera selección global?'],
      faq: [
        {"question": "¿Cómo encuentro un draft sin partida vinculada?", "triggers": ["encontrar un draft sin partida vinculada", "drafts sin partida vinculada", "draft sin partida"], "answer": "En Análisis → Drafts y bloqueos, abre Ajustar el alcance y elige Sin partida vinculada en Drafts incluidos. Comprueba también Equipo rival vinculado: Todos los equipos y partidas sin equipo o Sin equipo vinculado permite encontrar este historial. Despliega Orden de selecciones y bloqueos, elige el Draft que revisar y abre su fuente de Drafter. Reemplazar o desvincular un draft conserva su instantánea; no se crea ninguna partida ni resultado."},
        {"question": "¿Cómo analizo los bloqueos contra nosotros y los roles afectados?", "triggers": ["bloqueos contra nosotros", "roles afectados", "rol afectado", "quién pierde opciones", "presión sobre los repertorios"], "answer": "En Análisis → Drafts y bloqueos, elige Bloqueos contra nosotros o Nuestros bloqueos y filtra por Fase de bloqueos, Rol afectado o campeón. Abre un campeón para ver fases, jugadores y roles afectados, opciones observadas en el mismo rol y drafts de origen. ¿Quién pierde opciones? cruza los bloqueos con los repertorios declarados actuales, no con su estado histórico. Los roles proceden de partidas compatibles o, para los bloqueos rivales, de los repertorios actuales; los datos no demuestran la intención del bloqueo ni sustitutos garantizados. Cada tasa conserva su propia muestra."},
        {"question": "¿Cómo leo las rotaciones de selecciones?", "triggers": ["rotaciones de selecciones", "rotación de selección", "nuestra posición en el orden de selección", "selecciones consecutivas"], "answer": "En Análisis → Drafts y bloqueos, el panel de rotaciones agrupa nuestras selecciones consecutivas antes de devolver el turno. Elige Nuestra posición en el orden de selección según tengamos o respondamos a la primera selección. Los roles identificados exigen una partida vinculada compatible; los campeones ausentes o distintos impiden asignarlos. Comprobar esta rotación abre los drafts de origen. Las posiciones de selección no son roles jugados ni miden la eficacia de las opciones."},
        { question: '¿Cómo consulto el orden de selecciones y bloqueos?', triggers: ['orden de selecciones', 'orden de bloqueos', 'cronología de draft'], answer: 'En Análisis → Drafts y bloqueos, despliega Orden de selecciones y bloqueos y selecciona un Draft que revisar. El orden se reconstruye a partir de las posiciones finales verificadas de Drafter y del lado que selecciona primero. No describe las correcciones ni sus horarios durante el draft. Las fases de selecciones y bloqueos se muestran por lado; los roles realmente jugados siguen siendo independientes. Puedes volver a abrir la fuente de Drafter y la partida vinculada si existe.' },
        { question: '¿Por qué no está disponible el orden de selección?', triggers: ['orden de selección no disponible', 'orden no disponible', 'orden no verificado'], answer: 'El orden no está disponible si la importación no contiene pruebas verificadas de las posiciones, el formato no es compatible o las selecciones están incompletas. Desde la partida, el cuerpo técnico puede elegir Reemplazar draft, pegar el enlace y Comprobar draft, elegir su lado y guardar con Reemplazar draft vinculado. La vista previa por sí sola no actualiza el historial y un formato desconocido puede seguir sin estar disponible. Las selecciones y bloqueos disponibles siguen siendo consultables sin inventar una cronología ni deducir el orden de los roles jugados.' },
        { question: '¿Qué significan las frecuencias y la primera selección global?', triggers: ['primera selección global', 'frecuencias de drafts', 'fases de bloqueo'], answer: 'Las frecuencias de Drafts y bloqueos describen únicamente los drafts guardados y seleccionados, con un número de drafts utilizables propio de cada medida. Los datos incompletos se excluyen del cálculo correspondiente. La primera selección global solo cuenta los drafts en los que el lado analizado elige primero; las selecciones 1 a 5 son sus propias posiciones, no los roles. Estas observaciones no demuestran una preferencia duradera ni la eficacia de una elección.' },
      ],
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
    'draft-room': {
      title: 'Sala de draft en directo', actionLabel: 'Abrir la sala de draft',
      summary: 'La sala de draft permite jugar un draft en directo contra el capitán rival, para una partida o una serie de 1 a 5 partidas, en Estándar o Fearless. Las selecciones y bloqueos registrados se añaden a Drafts y bloqueos en Análisis.',
      keywords: ['sala de draft', 'draft en directo', 'fearless', 'estándar', 'capitán rival', 'enlace del rival', 'enlace de espectador', 'espectador', 'serie', 'cronómetro', 'tiempo de decisión', 'listo', 'voces de campeones', 'corregir el draft', 'salas recientes', 'eliminar la sala', 'primera selección'],
      steps: ['En Draft & Pool, abre Sala de draft. El propietario o el cuerpo técnico indica el rival (opcional), Nuestro lado, Primera selección, el número de partidas (1 a 5), el tiempo de decisión por turno (Sin límite, 30 s o 60 s) y el formato Estándar o Fearless, y después elige Crear sala.', 'Copia el enlace del rival para el capitán del otro equipo y, si hace falta, el enlace de espectador. Estos enlaces se abren sin cuenta NXT5.', 'Cada capitán confirma que su equipo está listo antes del primer bloqueo. Con cronómetro, el tiempo empieza cuando el rival está listo; cada elección debe confirmarse y un bloqueo puede saltarse.', 'Al final, Analizar el draft abre Drafts y bloqueos y Vincular a la partida asocia el draft a una partida importada. En una serie, Empezar la siguiente partida permite elegir de nuevo los lados.'],
      suggestions: ['¿Cómo invito al capitán rival a la sala de draft?', '¿Qué diferencia hay entre Estándar y Fearless?', '¿Cómo corrijo o elimino una sala de draft?'],
      faq: [
        { question: '¿Cómo invito al capitán rival a la sala de draft?', triggers: ['invitar al capitán rival', 'enlace del rival', 'enlace de espectador', 'capitán rival', 'sala de draft sin cuenta'], answer: 'Después de Crear sala, utiliza Copiar enlace del rival y envíalo solo al capitán del otro equipo: cualquier persona que abra este enlace juega por el lado rival. Copiar enlace de espectador permite seguir el draft sin jugar. Estos enlaces se abren sin cuenta NXT5. Después, los dos capitanes confirman que su equipo está listo antes del primer bloqueo.' },
        { question: '¿Qué diferencia hay entre Estándar y Fearless?', triggers: ['fearless', 'formato de draft', 'draft estándar', 'campeones bloqueados'], answer: 'En Estándar, todos los campeones vuelven a estar disponibles en cada partida de la serie. En Fearless, un campeón jugado queda bloqueado para los dos lados hasta el final de la serie; la sala muestra los campeones bloqueados. El formato, el número de partidas y el tiempo de decisión se eligen al crear la sala.' },
        { question: '¿Cómo corrijo o elimino una sala de draft?', triggers: ['corregir el draft', 'eliminar la sala', 'salas recientes', 'error de selección', 'modificar el draft'], answer: 'Cuando la partida termina, el propietario o el cuerpo técnico elige Corregir el draft, selecciona una posición y luego un campeón y guarda la corrección; en Fearless, se rechaza un campeón ya jugado en la serie. En Salas recientes, Eliminar la sala retira toda la serie y sus selecciones y bloqueos de los análisis. Esta eliminación es definitiva.' },
      ],
    },
    planning: {
      title: 'Calendario y disponibilidad', actionLabel: 'Abrir el Calendario',
      summary: 'El calendario reúne la disponibilidad, las sesiones y las notas de la semana. Las notas guardadas son visibles para todo el equipo.',
      keywords: ['calendario', 'planning', 'disponibilidad', 'semana', 'scrim', 'partido', 'sesión', 'evento', 'horario', 'cuerpo técnico', 'notas semanales', 'nota del calendario', 'retraso', 'entrenamiento', 'revisión'],
      steps: ['Elige la semana que preparar.', 'Indica la disponibilidad y, si es necesario, una nota para esta semana (500 caracteres como máximo).', 'Añade las sesiones del equipo con su tipo y horario.', 'Comprueba la disponibilidad antes de confirmar una sesión.'],
      suggestions: ['¿Cómo indico mi disponibilidad?', '¿Quién puede añadir una sesión?', '¿Quién ve mis notas del calendario?'],
      faq: [{ question: '¿Quién ve mis notas del calendario?', triggers: ['notas del calendario', 'nota del calendario', 'notas semanales', 'nota visible', 'retraso'], answer: 'Las notas guardadas son visibles para todo el equipo durante la semana mostrada, con un límite de 500 caracteres. El cuerpo técnico comparte una nota común. Actualizar notas recarga las notas guardadas; si falla el guardado, utiliza Reintentar el guardado.' }],
    },
    scrims: {
      title: 'Scrims entre equipos NXT5', actionLabel: 'Abrir los Scrims',
      summary: 'Scrims separa Buscar rival y Mis scrims. El staff publica una franja para 1 a 5 partidas, BO3 o BO5; al confirmar, la sesión aparece en el calendario de ambos equipos.',
      keywords: ['scrims', 'scrim', 'rival', 'propuesta', 'franja', 'nivel', 'equipo rival', 'encontrar un equipo', 'confirmar un scrim', 'responder a una propuesta', 'buscar rival', 'mis scrims', 'formato', 'bo3', 'bo5'],
      steps: ['En Mis scrims, el staff publica una propuesta con fecha, formato (1 a 5 partidas, BO3 o BO5), niveles mínimo y máximo y detalles opcionales. Ya no se indica la duración.', 'En Buscar rival, consulta las propuestas de otros equipos y responde con un mensaje.', 'En Mis scrims, confirma una respuesta recibida: las demás se rechazan y la sesión aparece en el calendario de ambos equipos.', 'Con la difusión de Discord activa y un canal de planning, el bot anuncia el scrim confirmado.'],
      suggestions: ['¿Cómo propongo un scrim a otro equipo?', '¿Quién puede confirmar un scrim?', '¿Dónde aparece un scrim confirmado?'],
      faq: [
        { question: '¿Quién puede confirmar un scrim?', triggers: ['confirmar un scrim', 'quién confirma', 'aceptar un scrim', 'publicar un scrim', 'proponer un scrim'], answer: 'Solo el staff del equipo (propietario, capitán, coach, asistente, analista, manager, board) publica una propuesta, responde a las de otros equipos y confirma una respuesta. Los demás miembros consultan las propuestas.' },
        { question: '¿Dónde aparece un scrim confirmado?', triggers: ['scrim confirmado', 'dónde aparece', 'calendario scrim', 'sesión scrim'], answer: 'La confirmación crea una sesión de tipo scrim en el calendario de los dos equipos, visible en Calendario y en /nxt planning. Si la difusión de Discord está activa con un canal de planning, el bot lo anuncia allí en su próximo paso.' },
        { question: '¿Qué formatos y pestañas tienen los scrims?', triggers: ['formato de scrim', 'formatos de scrims', 'bo3', 'bo5', 'buscar rival', 'mis scrims', 'duración scrim'], answer: 'Buscar rival muestra las propuestas de otros equipos. Mis scrims reúne las propuestas de tu equipo, las respuestas enviadas y los scrims confirmados. Al publicar, elige entre 1 y 5 partidas, BO3 o BO5; ya no se indica la duración. La sesión confirmada dura dos horas por defecto en el calendario.' },
      ],
    },
    'nexus-rising': {
      title: 'Liga Nexus Rising', actionLabel: 'Abrir Nexus Rising',
      summary: 'Nexus Rising es el portal de la liga vinculado a las cuentas y equipos NXT5. Durante la preapertura, visitantes y cuentas no administradoras ven Próximamente; las inscripciones y los encuentros están reservados a la administración autorizada.',
      keywords: ['nexus rising', 'liga', 'torneo', 'temporada', 'inscripción', 'clasificación', 'playoffs', 'próximamente', 'código de encuentro', 'importer nexus', 'desempate'],
      steps: ['Abre Nexus Rising desde el menú NXT5 en la misma pestaña.', 'Durante la preapertura, consulta Próximamente. Solo la administración autorizada puede acceder al portal y a las inscripciones.', 'El portal usa equipos NXT5 existentes; los resultados cuentan solo cuando el staff acepta las partidas enviadas.', 'Para un encuentro autorizado, el staff entrega un código Nexus a un capitán de la plantilla; no crea una sala de League of Legends.'],
      suggestions: ['¿Por qué Nexus Rising muestra Próximamente?', '¿Puedo inscribir mi equipo en Nexus Rising?', '¿Cómo se validan los resultados de Nexus Rising?'],
      faq: [
        { question: '¿Por qué Nexus Rising muestra Próximamente?', triggers: ['nexus próximamente', 'nexus inaccesible', 'portal nexus cerrado', 'preapertura nexus'], answer: 'Nexus Rising está en preapertura. Visitantes y cuentas no administradoras ven Próximamente en /nexus-rising. Solo la administración NXT5 autorizada accede al portal de preparación; iniciar sesión con una cuenta normal no abre las inscripciones.' },
        { question: '¿Puedo inscribir mi equipo en Nexus Rising?', triggers: ['inscribir mi equipo en nexus', 'inscripción nexus rising', 'unirme a la liga', 'temporada nexus'], answer: 'No durante la preapertura actual: las inscripciones están reservadas a la administración autorizada. En una apertura futura, el portal reutilizará un equipo NXT5 existente; su propietario, capitán o mánager podrá solicitar la inscripción y el staff revisará la plantilla y la elegibilidad.' },
        { question: '¿Cómo se validan los resultados de Nexus Rising?', triggers: ['resultados nexus', 'código de encuentro', 'importer nexus', 'partida aceptada', 'clasificación nexus'], answer: 'El staff prepara el encuentro y entrega un código personal de un solo uso a un capitán autorizado. El capitán vincula NXT5 Importer al encuentro y activa la recogida antes de terminar la partida. Después el staff revisa las contribuciones: solo una partida aceptada cuenta para el marcador de la serie, la clasificación y el cuadro. La recepción sola no valida ningún resultado.' },
        { question: '¿Cómo se desempata a los equipos en Nexus Rising?', triggers: ['desempate nexus', 'empate nexus', 'tie breaker nexus', 'seeds nexus'], answer: 'La regla de desempate por puntos se elige explícitamente para cada temporada. Puede usar los enfrentamientos directos y la diferencia de partidas en el orden fijado por el staff. Un empate restante no clasifica automáticamente a ningún equipo: el staff documenta su decisión antes de asignar una posición afectada.' },
      ],
    },
    'player-profile': {
      title: 'Perfil y seguimiento del jugador', actionLabel: 'Abrir Mi perfil',
      summary: 'Mi perfil reúne Resumen, Campeones jugados, Champion pool, Historial y Seguimiento. La carta y el Wrapped aparecen al principio de Resumen. Las notas y cuadernos siguen sujetos a los permisos de acceso.',
      keywords: ['perfil', 'mi perfil', 'jugador', 'historial', 'coaching', 'objetivo', 'campeones', 'enfrentamientos', 'cuaderno', 'daño medio', 'daño a campeones', 'progreso', 'notas', 'seguimiento', 'duelo'],
      steps: ['Comprueba que tu cuenta está vinculada al jugador correcto en Gestión del equipo.', 'Empieza por el resumen para identificar un punto que trabajar.', 'En Campeones jugados, abre un campeón y después Estadísticas o Enfrentamientos para examinar los resultados, el daño y los cuadernos. Champion pool muestra los campeones preparados en Draft.', 'En Historial, encuentra las partidas vinculadas para verificar una observación (Partidas por página ajusta la visualización); después, abre Seguimiento para los objetivos y las notas.'],
      suggestions: ['¿Por qué mi perfil está vacío?', '¿Dónde veo mi historial?', '¿Cómo hago el seguimiento de un objetivo?'],
      faq: [
        { question: '¿Por qué mi perfil está vacío?', triggers: ['perfil vacío', 'sin estadísticas de perfil', 'sin partidas de perfil', 'historial vacío', 'ninguna partida en perfil'], answer: 'Comprueba primero que tu cuenta NXT5 está vinculada al jugador correcto en Gestión del equipo. Después revisa los jugadores asociados a las partidas importadas: una partida asignada a un perfil duplicado o a ningún jugador no puede alimentar correctamente tu perfil.' },
        { question: '¿Dónde veo el daño medio a campeones?', triggers: ['daño medio', 'daño a campeones', 'daño contra campeones'], answer: 'En Mi perfil → Campeones jugados, selecciona un campeón y después Estadísticas. El daño medio a campeones utiliza las partidas con datos disponibles; «—» significa que el dato no está disponible. Abre una partida para comparar jugadores: las diferencias de daño se miden al final de la partida.' },
        { question: '¿Cómo guardo un cuaderno de enfrentamiento?', triggers: ['cuaderno de enfrentamiento', 'guardar cuaderno', 'plan inicial', 'preparar cuaderno'], answer: 'En Mi perfil → Campeones jugados, abre un campeón y después Enfrentamientos. Preparar cuaderno o Editar cuaderno permite indicar el plan inicial y las pruebas según tus permisos. El borrador se conserva durante la navegación, pero debes pulsar Guardar cuaderno para guardar los cambios.' },
      ],
    },
    'player-showcase': {
      title: 'Carta del jugador y Wrapped', actionLabel: 'Abrir la carta en Resumen',
      summary: 'Al principio de Resumen, la carta del jugador con anverso y reverso y el Wrapped en cinco capítulos resumen las partidas vinculadas al jugador en la categoría seleccionada.',
      keywords: ['carta', 'tarjeta', 'tarjeta del jugador', 'wrapped', 'mi ficha', 'póster', 'exportar', 'exportar png', 'png', 'anverso', 'reverso', 'capítulo'],
      steps: ['En Mi perfil, elige el jugador y la categoría: la carta y los capítulos del Wrapped aparecen al principio de Resumen.', 'En La carta, utiliza Ver el reverso o Ver el anverso para cambiar de cara.', 'Elige un capítulo del Wrapped y avanza con los botones, las flechas del teclado o deslizando sobre el visual.', 'Descarga el visual mostrado en PNG. Datos y método de esta edición explica las partidas y los valores utilizados.'],
      suggestions: ['¿Cómo exporto mi tarjeta en PNG?', '¿Por qué mi tarjeta está vacía?', '¿Cómo recorro Wrapped?'],
      faq: [{ question: '¿Por qué mi tarjeta está vacía?', triggers: ['tarjeta vacía', 'mi tarjeta está vacía', 'wrapped vacío', 'ninguna tarjeta'], answer: 'La tarjeta y Wrapped necesitan al menos una partida vinculada al jugador en la selección. Cambia la categoría o importa una partida y comprueba que el perfil de jugador correcto esté vinculado a ella.' }],
    },
    discord: {
      title: 'Cuenta y bot de Discord', actionLabel: 'Abrir Bot de Discord',
      summary: 'Bot de Discord reúne la vinculación de tu cuenta, la conexión del servidor, el canal de comandos de cada equipo y las publicaciones. En Discord bastan cinco comandos: /nxt help, /nxt lier, /nxt profil, /nxt voir y /nxt connecter.',
      keywords: ['discord', 'cuenta de discord', 'bot', 'vincular', 'vinculación', 'servidor', 'canal', 'canal de comandos', 'publicación', 'difusión', 'nxt', 'nxt voir', 'nxt profil', 'comando de discord', 'rol de discord'],
      steps: ['Para tu cuenta, ejecuta /nxt lier y abre el enlace personal. Confirma tu cuenta en NXT5 y después Verificar vinculación y Confirmar vinculación en Discord, tras comprobar el nombre de usuario mostrado.', 'El propietario o un capitán crea un código en Bot de Discord y ejecuta /nxt connecter code:<código> con la misma cuenta vinculada. Después elige el canal de comandos del equipo y, por separado, los canales de publicación.', 'En el canal de comandos, /nxt voir muestra la última partida, el resumen, las estadísticas, el calendario, los objetivos, los análisis postpartida o las composiciones. El canal determina el equipo.', 'Envía el ejemplo ficticio con Probar y activar, comprueba su recepción y activa la difusión. La instalación no vuelve a publicar partidas antiguas.'],
      suggestions: ['¿Cómo vinculo mi cuenta de Discord?', '¿Cómo consulto los datos del equipo en Discord?', '¿Por qué el bot rechaza mi comando?'],
      faq: [
        { question: '¿Cómo vinculo mi cuenta de Discord?', triggers: ['vincular mi cuenta de discord', 'cuenta de discord', 'nxt lier'], answer: 'En Discord, ejecuta /nxt lier y abre tu enlace personal, válido 10 minutos. Tu correo de NXT5 debe estar verificado. Confirma tu cuenta en NXT5 y vuelve a Discord: Verificar vinculación muestra tu nombre de usuario y tu identificador de Discord. Pulsa Confirmar vinculación solo si las dos cuentas son tuyas y nunca confirmes un enlace que te haya enviado otra persona. Después recibirás un correo; Desvincular mi cuenta, en Bot de Discord, revoca esta vinculación. /nxt help sigue disponible sin una cuenta vinculada.' },
        { question: '¿Cómo consulto los datos del equipo en Discord?', triggers: ['nxt voir', 'consultar en discord', 'datos en discord', 'canal de comandos', 'usar el bot'], answer: 'En el canal de comandos de tu equipo, ejecuta /nxt voir y elige un tema: derniere, bilan, stats, planning, objectifs, reviews o draft. El canal determina el equipo; el bot comprueba tu cuenta vinculada, tu pertenencia al equipo y, si el equipo lo exige, tu rol de Discord. La última partida, el resumen y las estadísticas se publican en el canal, como máximo una vez por tema cada 30 segundos; los demás temas solo los ves tú.' },
        { question: '¿Por qué el bot rechaza mi comando?', triggers: ['comando rechazado', 'bot rechaza', 'acceso denegado discord', 'rechazo de discord', 'canal equivocado'], answer: 'Comprueba con /nxt profil que tu cuenta está vinculada, que escribes en el canal de comandos de tu equipo y que tu cuenta NXT5 es miembro de ese equipo. Si el equipo eligió roles en Acceso a los comandos, también debes tener uno de ellos: ni siquiera un administrador de Discord puede saltarse esta regla. Un comando ejecutado en otro canal se rechaza sin publicar nada.' },
        { question: '¿Qué comparten las publicaciones de Discord?', triggers: ['publicaciones de discord', 'notas privadas discord', 'compartir discord', 'publicar en discord'], answer: 'Desde una partida, utiliza Exportar a Discord si tus permisos lo permiten. Elige el canal, prepara la vista previa y confirma la publicación. Se comparten el resultado, las estadísticas y el visual; las notas privadas del cuerpo técnico no se incluyen. Los miembros del canal pueden leer el mensaje; abrir la partida en NXT5 sigue requiriendo acceso al equipo.' },
      ],
    },
    'permissions-and-account': {
      title: 'Acceso y ajustes de la cuenta', actionLabel: 'Abrir los ajustes',
      summary: 'Tu rol en el equipo determina las acciones disponibles. Ajustes gestiona tu nombre de usuario, tu correo, tu seguridad, tus conexiones relacionadas y los correos de NXT5; Gestión del equipo organiza a los jugadores y sus accesos.',
      keywords: ['permiso', 'derechos', 'acceso', 'capitán', 'entrenador', 'mánager', 'analista', 'jugador', 'cuenta', 'correo', 'contraseña', 'seguridad', 'ajustes', 'conexiones relacionadas', 'google', 'mantener la sesión', 'sesión'],
      steps: ['Comprueba tu rol en el equipo activo.', 'Abre Ajustes para tu nombre de usuario, correo, contraseña, conexiones relacionadas y correos de NXT5.', 'Abre Gestión del equipo para los perfiles de jugador y sus accesos.', 'Si una acción sigue bloqueada, pregunta al capitán o a un miembro autorizado del cuerpo técnico.'],
      suggestions: ['¿Cómo cambio mi dirección de correo?', '¿Cómo vinculo Google o Discord a mi cuenta?', '¿Por qué está bloqueado un botón?'],
      faq: [
        { question: '¿Cómo cambio mi dirección de correo?', triggers: ['cambiar mi correo', 'modificar mi correo', 'nueva dirección', 'cambio de correo'], answer: 'En Ajustes → Nombre de usuario y correo electrónico, introduce la nueva dirección y tu contraseña actual. Se envía un enlace a la nueva dirección: ábrelo en este navegador, con la sesión iniciada en tu cuenta, en un plazo de 24 horas. Tu dirección actual sigue activa hasta entonces, y Cancelar el cambio anula la solicitud. Si tu cuenta todavía no tiene contraseña de NXT5, créala primero desde Seguridad de la cuenta.' },
        { question: '¿Cómo vinculo Google o Discord a mi cuenta?', triggers: ['conexiones relacionadas', 'vincular google', 'inicio de sesión con google', 'iniciar sesión con discord', 'desvincular', 'otro método de inicio de sesión'], answer: 'Inicia sesión primero en tu cuenta NXT5 existente y abre Ajustes → Conexiones relacionadas; elige Asociar para un servicio disponible. Los servicios no activados aparecen como no disponibles. Desvincular un servicio o cambiar tu correo requiere una contraseña de NXT5: sin ella, Seguridad de la cuenta permite recibir un enlace para crearla. Este inicio de sesión en el sitio no vincula el bot de Discord, que usa /nxt lier.' },
        { question: '¿Qué cambia la opción Mantener la sesión iniciada?', triggers: ['mantener la sesión iniciada', 'seguir conectado', 'sesión cerrada', 'duración de la sesión'], answer: 'Con Mantener la sesión iniciada, tu sesión dura 30 días en este dispositivo. Sin esta opción, termina al cerrar el navegador y como máximo a las 12 horas. Tras un cambio de correo confirmado, se cierran las demás sesiones.' },
      ],
    },
    support: {
      title: 'Apoyar a NXT5', actionLabel: 'Abrir Apoyar a NXT5',
      summary: 'Apoyar a NXT5 presenta un apoyo opcional al desarrollo. El apoyo no modifica ningún acceso ni desbloquea ninguna función.',
      keywords: ['apoyar', 'apoyo', 'ko-fi', 'kofi', 'donación', 'donar', 'contribución', 'financiar'],
      steps: ['Abre Apoyar a NXT5 desde la página de inicio o el pie de página.', 'Cuando las contribuciones están abiertas, Apoyar el proyecto abre Ko-fi en una pestaña nueva; el importe, la frecuencia y la confirmación se gestionan en esa plataforma.'],
      suggestions: ['¿Cómo apoyo a NXT5?'],
      faq: [{ question: '¿Cómo apoyo a NXT5?', triggers: ['apoyar a nxt5', 'ko-fi', 'kofi', 'hacer una donación', 'apoyo económico'], answer: 'La página Apoyar a NXT5 presenta un apoyo opcional. Cuando las contribuciones están abiertas, Apoyar el proyecto abre Ko-fi en una pestaña nueva para elegir un importe puntual o mensual. NXT5 no recoge ningún dato de pago y el apoyo no modifica ningún acceso ni ninguna función.' }],
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
        { question: 'El sitio va lento en mi dispositivo, ¿qué hago?', triggers: ['sitio lento', 'se ralentiza', 'modo de rendimiento', 'efectos visuales', 'tirones', 'poca fluidez'], answer: 'En Ajustes → Mostrar en este dispositivo, elige Modo de rendimiento para reducir los efectos visuales. Este ajuste solo afecta a este navegador; Renderizado completo restablece los efectos.' },
      ],
    },
  },
};
