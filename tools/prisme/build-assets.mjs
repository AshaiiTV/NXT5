import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root=path.resolve('public/assets/brand/prisme');
const iconSvg=await fs.readFile(path.join(root,'favicon.svg'),'utf8');
async function icon(size){
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
  const source=iconSvg.replace('<svg ','<svg width="'+size+'" height="'+size+'" ');
  ctx.drawImage(await loadImage(Buffer.from(source)),0,0,size,size);
  return canvas.toBuffer('image/png');
}
const icoEntries=[];
for(const size of [16,32,48,64,128,180,192,256,512,1024]){
  const png=await icon(size);
  await fs.writeFile(path.join(root,`icon-${size}.png`),png);
  if([16,32,48,64,128,256].includes(size))icoEntries.push({size,png});
}
const icoHeader=Buffer.alloc(6+16*icoEntries.length);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(icoEntries.length,4);
let offset=icoHeader.length;
icoEntries.forEach(({size,png},i)=>{const n=6+i*16;icoHeader[n]=size===256?0:size;icoHeader[n+1]=size===256?0:size;icoHeader.writeUInt16LE(1,n+4);icoHeader.writeUInt16LE(32,n+6);icoHeader.writeUInt32LE(png.length,n+8);icoHeader.writeUInt32LE(offset,n+12);offset+=png.length;});
const ico=Buffer.concat([icoHeader,...icoEntries.map(e=>e.png)]);
await fs.writeFile('public/favicon.ico',ico);await fs.writeFile('importer-app/assets/icon.ico',ico);
const chunks=[];
for(const [type,size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]){
 const png=await icon(size),header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(png.length+8,4);chunks.push(header,png);
}
const icns=Buffer.alloc(8);icns.write('icns');icns.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);await fs.writeFile('importer-app/assets/icon.icns',Buffer.concat([icns,...chunks]));
for(const [from,to] of [[16,'favicon-16x16.png'],[32,'favicon-32x32.png'],[180,'apple-touch-icon.png']])await fs.copyFile(path.join(root,`icon-${from}.png`),`public/${to}`);
await fs.copyFile(path.join(root,'favicon.svg'),'public/favicon.svg');
await fs.copyFile(path.join(root,'icon-512.png'),'importer-app/assets/prisme/icon-512.png');
const five=await loadImage(path.join(root,'nxt5-prisme-5-2048.png')),canvas=createCanvas(512,512);canvas.getContext('2d').drawImage(five,0,0,512,512);await fs.writeFile(path.join(root,'nxt5-prisme-5-512.webp'),canvas.toBuffer('image/webp',94));
// Compatible aliases for retained external URLs; active code uses Prisme paths.
await fs.copyFile(path.join(root,'nxt5-prisme-source.png'),'public/assets/brand/nxt5-logo-3d.png');
await fs.copyFile(path.join(root,'nxt5-prisme-640.webp'),'public/assets/brand/nxt5-logo-3d-640.webp');
await fs.copyFile(path.join(root,'nxt5-prisme-320.webp'),'public/assets/brand/nxt5-logo-3d-320.webp');
console.log('Prisme: favicons, PWA, Windows ICO, macOS ICNS, scene and compatibility assets generated.');

for (const size of [192,512]) await fs.copyFile(path.join(root,`icon-${size}.png`),`public/android-chrome-${size}x${size}.png`);
// The maskable 5 sits within the central 80% safe zone.
const maskable=createCanvas(512,512),maskCtx=maskable.getContext('2d'); maskCtx.fillStyle='#070a14';maskCtx.fillRect(0,0,512,512);maskCtx.drawImage(await loadImage(await icon(512)),52,52,408,408);await fs.writeFile('public/android-chrome-maskable-512x512.png',maskable.toBuffer('image/png'));
const mono=createCanvas(640,180),monoCtx=mono.getContext('2d');
const monoSvg=(await fs.readFile(path.join(root,'nxt5-prisme-mono-blanc.svg'),'utf8')).replace('width="1536"','width="640"').replace('height="432"','height="180"');
monoCtx.drawImage(await loadImage(Buffer.from(monoSvg)),0,0,640,180);await fs.writeFile(path.join(root,'nxt5-prisme-mono-640.png'),mono.toBuffer('image/png'));

await fs.copyFile('public/android-chrome-maskable-512x512.png',path.join(root,'icon-maskable-512.png'));

// Apple touch icons use an opaque square; iOS applies its own corner mask.
const apple=createCanvas(180,180),appleCtx=apple.getContext('2d');appleCtx.fillStyle='#070a14';appleCtx.fillRect(0,0,180,180);appleCtx.drawImage(await loadImage(await icon(180)),0,0);await fs.writeFile('public/apple-touch-icon.png',apple.toBuffer('image/png'));
