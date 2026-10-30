import { canonicalChampion } from '../../../shared/champions.js';
import { draftSlotState } from '../../../shared/draft-order.js';

/** Only verified champion identities and numerical aggregates leave the server. */
export function globalChampionStats(played: any[], drafts: any[], catalog: Map<number, { id:string;name:string;imageUrl?:string }>, gameBanRows: any[] = []) {
  const known = new Map([...catalog.values()].map(champion=>[canonicalChampion(champion.id).toLowerCase(),champion]));
  const resolve = (value: unknown) => typeof value==='string' ? known.get(canonicalChampion(value).toLowerCase()) : undefined;
  const games = new Map<string,any>();
  let selections=0, unknownSelections=0;
  for (const row of played) {
    const champion=resolve(row.champion);
    if (!champion) { unknownSelections+=Number(row.picks || 0);continue; }
    const previous=games.get(champion.id) || { champion:champion.id,name:champion.name,picks:0,wins:0,knownResults:0 };
    previous.picks+=Number(row.picks || 0);previous.wins+=Number(row.wins || 0);previous.knownResults+=Number(row.known_results || 0);
    selections+=Number(row.picks || 0);games.set(champion.id,previous);
  }
  const picked=new Map<string,number>(), banned=new Map<string,number>();
  let pickDrafts=0,banDrafts=0,excludedDrafts=0;
  const add=(map:Map<string,number>,ids:Set<string>)=>ids.forEach(id=>map.set(id,(map.get(id)||0)+1));
  for (const row of drafts) {
    const snapshot=row.snapshot;
    if (snapshot?.status!=='completed' || snapshot.source!=='drafter.lol') { excludedDrafts++;continue; }
    const picks=['blue','red'].map(side=>snapshot[side+'Picks']);
    if (!picks.every(values=>Array.isArray(values) && values.length===5 && values.every(resolve)
      && new Set(values.map((value:string)=>resolve(value)?.id)).size===5)) { excludedDrafts++;continue; }
    pickDrafts++;add(picked,new Set(picks.flat().map(value=>resolve(value)!.id)));
    const validBans=['blue','red'].every(side=>Array.isArray(snapshot[side+'Bans']) && snapshot[side+'Bans'].length===5
      && snapshot[side+'Bans'].every((value:unknown,index:number)=>draftSlotState(snapshot,side,'ban',index+1)==='skipped'
        || (draftSlotState(snapshot,side,'ban',index+1)==='selected' && resolve(value))));
    if (validBans) {
      banDrafts++;
      add(banned,new Set([...snapshot.blueBans,...snapshot.redBans].map(resolve).filter(Boolean).map(champion=>champion!.id)));
    }
  }
  const order=(rows:any[],key:string)=>rows.sort((a,b)=>b[key]-a[key] || a.name.localeCompare(b.name));
  const draftRows=(map:Map<string,number>,denominator:number)=>order([...map].map(([id,count])=>({ champion:id,name:resolve(id)!.name,count,rate:denominator ? count/denominator*100:null })), 'count');
  const gameBanned=new Map<string,number>();
  let banGames=0;
  for (const row of gameBanRows) {
    const teams=row.teams;
    if (!Array.isArray(teams) || teams.length!==2 || ![100,200].every(id=>teams.some(team=>Number(team.teamId)===id))) continue;
    if (!teams.every(team=>Array.isArray(team.bans) && team.bans.length===5
      && team.bans.every((ban:any)=>ban.championId===-1 || (Number.isInteger(ban.championId) && catalog.has(ban.championId))))) continue;
    banGames++;
    add(gameBanned,new Set(teams.flatMap(team=>team.bans).filter(ban=>ban.championId!==-1).map(ban=>catalog.get(ban.championId)!.id)));
  }
  return {
    played:order([...games.values()].map(row=>({...row,rate:selections ? row.picks/selections*100:null,winRate:row.knownResults ? row.wins/row.knownResults*100:null})), 'picks'),
    picks:draftRows(picked,pickDrafts),bans:draftRows(banned,banDrafts),gameBans:draftRows(gameBanned,banGames),
    coverage:{ selections,unknownSelections,pickDrafts,banDrafts,excludedDrafts,totalDrafts:drafts.length,banGames }
  };
}
