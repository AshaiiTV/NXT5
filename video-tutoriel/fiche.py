import json,re
L=json.load(open("log.json"));T=json.load(open("texts.json"));N=json.load(open("narration.json"))
f=lambda x:"%02d:%02d:%02d,%03d"%(x//3600,x//60%60,int(x)%60,round((x%1)*1000)%1000)
st={};cues=[]
for kind,k,t in L:
  if kind=="cap": st[k]=t
  elif kind=="end": cues.append((st[k],t,re.sub("<[^>]+>","",T["captions"][k])))
open("livrable/nxt5-tuto-sous-titres-fr.srt","w").write("\n".join(f"{i+1}\n{f(a)} --> {f(b)}\n{c}\n" for i,(a,b,c) in enumerate(cues)))
m=lambda t:"%d:%02d"%(t//60,t%60)
steps={k:t for kind,k,t in L if kind=="step"}; vo={k:t for kind,k,t in L if kind=="vo"}
ch=[("0:00","Introduction"),(m(st["c1"]-0.5),"L’accueil de NXT5"),(m(steps["s1"]),"La démo : rechercher une partie"),(m(steps["s2"]),"Le bilan d’une partie"),(m(steps["s3"]),"Les analyses"),(m(steps["s4"]),"Le débrief"),(m(steps["s5"]),"Créer son espace et importer ses parties"),(m(vo["n99"]-0.6),"Conclusion")]
p="livrable/fiche-youtube.md"; s=open(p).read()
s=re.sub(r"Chapitres\n.*?\n\n","Chapitres\n"+"\n".join(f"{a} {b}" for a,b in ch)+"\n\n",s,flags=re.S)
s=s.split("## Texte de la voix off")[0]+"## Texte de la voix off\n"+"".join(f"- {m(t)} — {N[k]}\n" for k,t in sorted(vo.items(),key=lambda x:x[1]))
open(p,"w").write(s); print(" | ".join(f"{a} {b}" for a,b in ch))
