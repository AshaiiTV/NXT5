/** Compile the approved glyph renders and the shared vector contours.
 * Usage: node tools/prisme/build-unified-brand.mjs /absolute/path/to/renders
 * Render glyph-{N,X,T,5}.png using glass.html?glyph=… at729×665/DPR3,
 * reduced-motion, transparent canvas, then inspect before compiling. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {brandGlyphPath} from '../../src/components/brand/brand-geometry.js';
const renders=process.argv[2];
if(!renders)throw new Error('Provide the reviewed glyph render directory.');
const root='public/assets/brand/prisme';
const glyphs=[];
for(const glyph of ['N','X','T','5']){
 const img=await loadImage(path.join(renders,`glyph-${glyph}.png`));
 const c=createCanvas(img.width,img.height),ctx=c.getContext('2d');ctx.drawImage(img,0,0);
 const rgba=ctx.getImageData(0,0,c.width,c.height).data;
 const rows=[];let minX=c.width,maxX=0,minY=c.height,maxY=0;
 for(let y=0;y<c.height;y++){let left=c.width,right=-1;for(let x=0;x<c.width;x++)if(rgba[(y*c.width+x)*4+3]>12){left=Math.min(left,x);right=x;}
 rows.push([left,right]);if(right>=0){minX=Math.min(minX,left);maxX=Math.max(maxX,right);minY=Math.min(minY,y);maxY=y;}}
 glyphs.push({glyph,img,rows,minX,maxX,minY,maxY,x:0});
}
for(let i=1;i<glyphs.length;i++){
 let x=0;const prev=glyphs[i-1],next=glyphs[i];
 for(let y=0;y<prev.rows.length;y++)if(prev.rows[y][1]>=0&&next.rows[y][1]>=0)x=Math.max(x,prev.x+prev.rows[y][1]-next.rows[y][0]+85);
 next.x=x;
}
const left=Math.min(...glyphs.map(g=>g.x+g.minX)),right=Math.max(...glyphs.map(g=>g.x+g.maxX));
const top=Math.min(...glyphs.map(g=>g.minY)),bottom=Math.max(...glyphs.map(g=>g.maxY));
const master=createCanvas(7680,2160),mc=master.getContext('2d');
const scale=Math.min(7440/(right-left),1960/(bottom-top));
const ox=(7680-(right-left)*scale)/2-left*scale,oy=(2160-(bottom-top)*scale)/2-top*scale;
for(const g of glyphs)mc.drawImage(g.img,ox+g.x*scale,oy,g.img.width*scale,g.img.height*scale);
await fs.writeFile(path.join(root,'nxt5-unified-8k.png'),master.toBuffer('image/png'));
for(const width of [320,640,1280,1536]){const c=createCanvas(width,Math.round(width*2160/7680));c.getContext('2d').drawImage(master,0,0,c.width,c.height);await fs.writeFile(path.join(root,width===1536?'nxt5-unified-source.png':`nxt5-unified-${width}.webp`),width===1536?c.toBuffer('image/png'):c.toBuffer('image/webp',94));}
for(const [name,color] of [['blanc','#F5F3FF'],['nuit','#070A14']]){
 const paths=['N','X','T','5'].map((g,i)=>`<path d="${brandGlyphPath(g,i*400)}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="432" viewBox="0 0 1640 460"><title>NXT5</title><g fill="${color}">${paths}</g></svg>`;
 await fs.writeFile(path.join(root,`nxt5-unified-mono-${name}.svg`),svg);
 const five=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 460"><title>NXT5</title><path d="${brandGlyphPath('5')}" fill="${color}"/></svg>`;
 await fs.writeFile(path.join(root,`nxt5-unified-5-${name}.svg`),five);
 if(name==='blanc'){const c=createCanvas(640,180);c.getContext('2d').drawImage(await loadImage(Buffer.from(svg)),0,0,640,180);await fs.writeFile(path.join(root,'nxt5-unified-mono-640.png'),c.toBuffer('image/png'));}
}
const five=glyphs[3];
for(const size of [256,512,2048]){const c=createCanvas(size,size),ctx=c.getContext('2d'),s=size*.84/(five.maxY-five.minY);ctx.drawImage(five.img,(size-(five.maxX-five.minX)*s)/2-five.minX*s,size*.08-five.minY*s,five.img.width*s,five.img.height*s);await fs.writeFile(path.join(root,`nxt5-unified-5-${size}.${size===2048?'png':'webp'}`),size===2048?c.toBuffer('image/png'):c.toBuffer('image/webp',94));}
await fs.writeFile(path.join(root,'favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>NXT5</title><rect width="64" height="64" rx="12" fill="#070A14"/><path transform="translate(8 6) scale(.112)" d="${brandGlyphPath('5')}" fill="#C4B5FD"/></svg>`);
for(const file of ['nxt5-unified-mono-blanc.svg','nxt5-unified-640.webp','nxt5-unified-5-512.webp'])await fs.copyFile(path.join(root,file),path.join('importer-app/assets/prisme',file));
console.log(JSON.stringify({master:[7680,2160],renderScale:scale,sourceGlyphs:glyphs.map(({glyph,minX,maxX,minY,maxY,x})=>({glyph,minX,maxX,minY,maxY,x}))}));
// Retained URLs are compatibility aliases; active consumers use versioned names.
for(const file of await fs.readdir(root))if(file.startsWith('nxt5-unified-')&&!file.includes('-8k'))await fs.copyFile(path.join(root,file),path.join(root,file.replace('nxt5-unified-','nxt5-prisme-')));
for(const file of ['nxt5-unified-mono-blanc.svg','nxt5-unified-640.webp','nxt5-unified-5-512.webp'])await fs.copyFile(path.join(root,file),path.join('importer-app/assets/prisme',file.replace('nxt5-unified-','nxt5-prisme-')));
