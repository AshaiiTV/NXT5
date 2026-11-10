// Visual regression specimen of the shared PNG primitives, with fictitious values.
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {writeFile} from 'node:fs/promises';
import {pngBackground,pngHeader,pngPanel,pngMetricStrip,pngFooter,PNG_THEME} from '../../src/utils/png-report.js';
GlobalFonts.registerFromPath('node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2','Inter');
GlobalFonts.registerFromPath('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2','Inter');
const canvas=createCanvas(1200,720),ctx=canvas.getContext('2d');
const logo=await loadImage('public/assets/brand/prisme/nxt5-prisme-source.png');
pngBackground(ctx,1200,720);pngHeader(ctx,{width:1200,title:'Bilan de séance',subtitle:'Spécimen visuel · données fictives',eyebrow:'ÉQUIPE DE DÉMONSTRATION',logo});
pngPanel(ctx,64,230,1072,350);ctx.fillStyle=PNG_THEME.text;ctx.font='700 30px Inter';ctx.fillText('Repères pour le prochain entraînement',92,290);
for(const [i,text] of ['Victoire · 32:10','Côté bleu · 5 joueurs','Vision · 74 balises posées','Décision · préparer le prochain objectif'].entries()){ctx.fillStyle=i===0?PNG_THEME.green:PNG_THEME.muted;ctx.font='500 25px Inter';ctx.fillText(text,92,350+i*54);}
pngFooter(ctx,{width:1200,height:720,label:'Spécimen des composants d’export — aucun résultat réel'});
await writeFile(process.argv[2],canvas.toBuffer('image/png'));
