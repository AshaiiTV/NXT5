import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import { NexusSeasonManager, NexusStandings, NexusPlayoffs } from "../pages/nexus/NexusTournament.jsx";
import { NexusScheduleActions } from "../pages/nexus/NexusTournamentActions.jsx";
import NexusScheduleEditor from "../pages/nexus/NexusScheduleEditor.jsx";
import NexusRegistration from "../pages/nexus/NexusRegistration.jsx";
import NexusWorkspace from "../pages/nexus/NexusWorkspace.jsx";

let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer=null; vi.clearAllMocks(); });
async function mount(component) { await act(async()=>{renderer=TestRenderer.create(component);}); }
const button = label => renderer.root.findAllByType(Button).find(node=>node.props.children===label);
const season = { id:"season",name:"Saison test",status:"open",legs:1,regularBestOf:3,playoffSize:4,playoffBestOf:3,scheduleGenerated:false };
const text=()=>JSON.stringify(renderer.toJSON());
const select=label=>renderer.root.findAllByType(SelectInput).find(node=>node.props.label===label);
const approved=Array.from({length:4},(_,index)=>({id:`r${index}`,teamId:`team${index}`,teamName:`Team ${index}`,status:"approved"}));

describe("season management",()=>{
  it("creates an explicit draft with chosen rules without creating official data on mount",async()=>{
    const action=vi.fn();
    await mount(<NexusSeasonManager data={{seasons:[],registrations:[]}} seasonId="" setSeasonId={vi.fn()} action={action} busy={false}/>);
    expect(action).not.toHaveBeenCalled();
    act(()=>button("Nouvelle saison").props.onClick());
    act(()=>renderer.root.findByType(TextInput).props.onChange("Saison de test"));
    act(()=>renderer.root.findAllByType(SelectInput).find(node=>node.props.label==="Saison régulière").props.onChange("2"));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[0][0]).toMatchObject({action:"createSeason",name:"Saison de test",legs:2,status:"draft"});
  });
  it("allows staff to review candidates but prevents schedule regeneration",async()=>{
    const action=vi.fn();
    await mount(<NexusSeasonManager data={{seasons:[{...season,scheduleGenerated:true}],registrations:[{id:"r1",seasonId:season.id,teamId:"a",teamName:"Alpha",status:"approved"},{id:"r2",seasonId:season.id,teamId:"b",teamName:"Beta",status:"pending"}]}} seasonId={season.id} setSeasonId={vi.fn()} action={action} busy={false}/>);
    expect(button("Calendrier généré").props.disabled).toBe(true);
    expect(button("Accepter").props.disabled).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });
  it("shows server ranks and explicit unresolved ties without exposing player details",async()=>{
    await mount(<NexusStandings standings={{rows:[{teamId:"a",teamName:"Alpha",rank:1,tied:true,points:3,seriesWon:1,seriesLost:0,gamesWon:2,gamesLost:1}],complete:true,ties:[{crossesQualification:true}],qualificationBlocked:true}}/>);
    expect(text()).toContain("Alpha");
    expect(text()).toContain("staff doit valider le départage");
    expect(text()).not.toContain("riotId");
  });
  it("offers six operational families and only relevant configuration fields",async()=>{
    const action=vi.fn();
    await mount(<NexusSeasonManager data={{seasons:[]}} seasonId="" setSeasonId={vi.fn()} busy={false} action={action}/>);
    act(()=>button("Nouvelle saison").props.onClick());
    expect(select("Type de tournoi").findAllByType("option").map(node=>node.props.value)).toEqual(["round_robin","groups","single_elimination","double_elimination","swiss","custom"]);
    act(()=>select("Type de tournoi").props.onChange("swiss"));
    expect(renderer.root.findAllByType(TextInput).some(node=>node.props.label==="Nombre de rondes suisses")).toBe(true);
    expect(select("Saison régulière")).toBeUndefined();
    act(()=>select("Type de tournoi").props.onChange("double_elimination"));
    expect(select("Variante de double élimination")).toBeTruthy();
    expect(select("Taille du tableau").findAllByType("option").map(node=>node.props.value)).toEqual([4,8,16]);
    expect(select("Format des rencontres régulières")).toBeUndefined();
    act(()=>button("Reprendre le format bêta").props.onClick());
    act(()=>renderer.root.findAllByType(TextInput).find(node=>node.props.label==="Nom de la saison").props.onChange("Essai bêta"));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[0][0]).toMatchObject({format:"round_robin",doubleVariant:"nexus_site",playoffSize:6,rulesConfirmed:false,status:"draft"});
  });
  it("requires an explicit unique order for direct elimination and never seeds on the first click",async()=>{
    const action=vi.fn();
    await mount(<NexusScheduleActions season={{...season,format:"single_elimination",playoffSize:4}} teams={approved} busy={false} action={action}/>);
    act(()=>button("Générer le calendrier").props.onClick());
    expect(action).not.toHaveBeenCalled();
    act(()=>select("Tête de série 2").props.onChange("team0"));
    expect(button("Confirmer le tableau initial").props.disabled).toBe(true);
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action).not.toHaveBeenCalled();
    act(()=>select("Tête de série 2").props.onChange("team1"));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[0][0]).toEqual({action:"generateSchedule",seasonId:"season",seeds:["team0","team1","team2","team3"]});
  });
  it("retries the same custom fixture with the same request identifier, then renews it after success",async()=>{
    const action=vi.fn();
    await mount(<NexusScheduleActions season={{...season,format:"custom",scheduleGenerated:true}} teams={approved} busy={false} action={action}/>);
    act(()=>select("Équipe A").props.onChange("team0"));
    act(()=>select("Équipe B").props.onChange("team0"));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action).not.toHaveBeenCalled();
    act(()=>select("Équipe B").props.onChange("team1"));
    act(()=>renderer.root.findAllByType(TextInput).find(node=>node.props.label==="Libellé de la rencontre").props.onChange("Rencontre test"));
    for(let n=0;n<2;n++)act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[0][0]).toMatchObject({action:"createManualFixture",teamAId:"team0",teamBId:"team1",round:1,bestOf:3});
    expect(action.mock.calls[0][0].requestId).toBe(action.mock.calls[1][0].requestId);
    act(()=>action.mock.calls[1][1]({}));
    act(()=>select("Équipe A").props.onChange("team0"));act(()=>select("Équipe B").props.onChange("team2"));
    act(()=>renderer.root.findAllByType(TextInput).find(node=>node.props.label==="Libellé de la rencontre").props.onChange("Autre rencontre"));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[2][0].requestId).not.toBe(action.mock.calls[0][0].requestId);
  });
  it("targets one explicit Swiss round so retries cannot skip ahead",async()=>{
    const action=vi.fn();
    await mount(<NexusScheduleActions season={{...season,format:"swiss",scheduleGenerated:true,swissRounds:3,swissState:{rounds:[{round:1,byes:[]}]}}} teams={approved} busy={false} action={action}/>);
    act(()=>button("Générer la ronde 2").props.onClick());
    expect(action.mock.calls[0][0]).toEqual({action:"advanceSwissRound",seasonId:"season",round:2});
    await act(async()=>renderer.update(<NexusScheduleActions season={{...season,format:"swiss",scheduleGenerated:true,swissRounds:2,swissState:{rounds:[{round:1},{round:2}]}}} teams={approved} busy={false} action={action}/>));
    expect(button("Toutes les rondes sont générées").props.disabled).toBe(true);
  });
  it("separates upper and lower brackets and leaves unknown participants unresolved",async()=>{
    await mount(<NexusPlayoffs fixtures={[{id:"upper",stage:"playoff",bracketGroup:"upper",round:1,label:"U1",teamA:"Alpha",teamB:"Beta",bestOf:3,series:{winsA:2,winsB:0}},{id:"lower",stage:"playoff",bracketGroup:"lower",round:1,label:"L1",teamA:null,teamB:null,bestOf:3}]}/>);
    expect(renderer.root.findByProps({"aria-label":"Tableau supérieur"})).toBeTruthy();
    expect(renderer.root.findByProps({"aria-label":"Tableau inférieur"})).toBeTruthy();
    expect(text()).toContain("Équipe à déterminer");
  });
  it("renders future bracket sources and distinguishes unfinished play from a qualification tie",async()=>{
    await mount(<NexusPlayoffs fixtures={[]} bracket={{matches:[{key:"m1",order:1,round:1,stage:"upper",bestOf:3,sourceA:{type:"seed",seed:1,teamId:"a"},sourceB:{type:"seed",seed:2,teamId:"b"}},{key:"m2",order:2,round:1,stage:"lower",bestOf:3,sourceA:{type:"loser",matchKey:"m1"},sourceB:{type:"seed",seed:3,teamId:"c"}}]}} teams={[{teamId:"a",teamName:"Alpha"}]}/>);
    expect(text()).toContain("Perdant de Rencontre 1");
    expect(text()).toContain("Tête de série 3");
    await act(async()=>renderer.update(<NexusStandings standings={{rows:[{teamId:"a",teamName:"Alpha",rank:1}],complete:false,qualificationBlocked:true,ties:[]}}/>));
    expect(text()).toContain("classement est provisoire");
    expect(text()).not.toContain("staff doit valider le départage");
  });
});

describe("native NXT5 teams",()=>{
  it("submits existing team and season identifiers and prevents a concurrent duplicate",async()=>{
    let finish;
    const request=vi.fn().mockImplementation((_path,options)=>options?.method==="POST"?new Promise(resolve=>{finish=resolve;}):Promise.resolve({seasons:[season],teams:[{id:"team-a",name:"Alpha"}],registrations:[]}));
    await mount(<NexusRegistration request={request} onClose={vi.fn()}/>);
    const form=renderer.root.findByType("form");
    let first;
    act(()=>{first=form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});});
    expect(request.mock.calls.filter(([,options])=>options?.method==="POST")).toHaveLength(1);
    expect(JSON.parse(request.mock.calls.find(([,options])=>options?.method==="POST")[1].body)).toEqual({action:"register",seasonId:"season",teamId:"team-a"});
    await act(async()=>{finish({registration:{id:"r"}});await first;});
    expect(text()).toContain("Candidature envoyée");
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });
  it("does not offer arbitrary team registration to a member without management rights",async()=>{
    const request=vi.fn().mockResolvedValue({seasons:[season],teams:[],registrations:[]});
    await mount(<NexusRegistration request={request} onClose={vi.fn()}/>);
    expect(button("Envoyer la candidature")).toBeUndefined();
    expect(text()).toContain("Tu ne gères aucune équipe");
  });
  it("selects five source player IDs per side and rejects an incomplete lineup",async()=>{
    const rosterA=Array.from({length:6},(_,index)=>({id:`a${index}`,name:`Alpha${index}`,riotId:`Alpha${index}#EUW`}));
    const rosterB=Array.from({length:5},(_,index)=>({id:`b${index}`,name:`Beta${index}`,riotId:`Beta${index}#EUW`}));
    const action=vi.fn();
    await mount(<NexusScheduleEditor fixture={{id:"fixture",teamA:"Alpha",teamB:"Beta",roster:[],rosterReady:false}} request={vi.fn().mockResolvedValue({rosterA,rosterB})} action={action} busy={false}/>);
    for(const [label,value] of [["Début de la collecte","2027-01-10T18:00"],["Fin de la collecte","2027-01-10T23:00"]])act(()=>renderer.root.findAllByType(TextInput).find(node=>node.props.label===label).props.onChange(value));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action).not.toHaveBeenCalled();
    expect(text()).toContain("Sélectionne cinq joueurs");
    for(const group of renderer.root.findAllByType("fieldset"))for(const checkbox of group.findAllByType("input").slice(0,5))act(()=>checkbox.props.onChange());
    expect(renderer.root.findAllByType("fieldset")[0].findAllByType("input")[5].props.disabled).toBe(true);
    const informed=renderer.root.findAllByType("input").find(node=>node.props.required&&node.props.type==="checkbox");
    act(()=>informed.props.onChange({target:{checked:true}}));
    act(()=>renderer.root.findByType("form").props.onSubmit({preventDefault(){}}));
    expect(action.mock.calls[0][0]).toMatchObject({action:"scheduleFixture",fixtureId:"fixture",playerIdsA:["a0","a1","a2","a3","a4"],playerIdsB:["b0","b1","b2","b3","b4"]});
    expect(action.mock.calls[0][0]).not.toHaveProperty("roster");
  });
  it("retries failed source roster loading and reports revoked access",async()=>{
    const onAccessLost=vi.fn();
    const request=vi.fn().mockRejectedValueOnce(new Error("Connexion interrompue")).mockRejectedValueOnce(Object.assign(new Error("Accès révoqué"),{status:403}));
    await mount(<NexusScheduleEditor fixture={{id:"f",roster:[]}} request={request} busy={false} action={vi.fn()} onAccessLost={onAccessLost}/>);
    expect(text()).toContain("Connexion interrompue");
    await act(async()=>button("Réessayer").props.onClick());
    expect(request).toHaveBeenCalledTimes(2);
    expect(onAccessLost).toHaveBeenCalledOnce();
  });
  it("reloads the active match's player choices immediately after refreshing its native team roster",async()=>{
    let refreshed=false;
    const fixture={id:"f",seasonId:"season",teamAId:"a",teamBId:"b",teamA:"Alpha",teamB:"Beta",label:"Rencontre",roster:[],rosterReady:false};
    const data={seasons:[{...season,status:"running",scheduleGenerated:true}],fixtures:[fixture],registrations:[{id:"reg-a",seasonId:"season",teamId:"a",teamName:"Alpha",status:"approved"}],pairings:[],submissions:[]};
    const request=vi.fn(async(path,options)=>{
      if(options?.method==="POST"){expect(JSON.parse(options.body)).toEqual({action:"refreshRegistrationRoster",registrationId:"reg-a"});refreshed=true;return {};}
      if(path.includes("fixtureId="))return {fixture,rosterA:[{id:refreshed?"new":"old",name:refreshed?"Nouveau joueur":"Ancien joueur",riotId:refreshed?"Nouveau#EUW":"Ancien#EUW"}],rosterB:[]};
      return data;
    });
    await mount(<NexusWorkspace request={request}/>);
    expect(text()).toContain("Ancien joueur");
    await act(async()=>button("Actualiser l’effectif NXT5").props.onClick());
    expect(text()).toContain("Nouveau joueur");
    expect(text()).not.toContain("Ancien joueur");
    expect(request.mock.calls.filter(([path])=>path.includes("fixtureId="))).toHaveLength(2);
  });
});
