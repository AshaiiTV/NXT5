// Real browser checks for the common frame and control geometry, not CSS snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const output=path.resolve('artifacts/ui-framing');
await fs.mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false}});
let browser;
try {
  await server.listen();browser=await chromium.launch({headless:true});const results=[];
  for(const order of ['normal','reset-last']) for(const width of [320,360,390,768,1024,1440,1920]) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(server.resolvedUrls.local[0]+'tools/framing-qa/index.html?'+order,{waitUntil:'domcontentloaded'});
    await page.locator('[data-framing-row] input').waitFor();await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await page.evaluate(()=>{
      const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const topbar=document.querySelector('.nxt5-topbar'),main=document.querySelector('main');
      return {overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelector('[data-framing-row]').children].map(n=>rect(n.matches('button')?n:n.querySelector('input,select'))),long:rect(document.querySelector('[data-framing-long]')),brand:rect(document.querySelector('.nxt5-sidebar-brand')),topbar:rect(topbar),gutterTop:parseFloat(getComputedStyle(topbar).paddingLeft),gutterMain:parseFloat(getComputedStyle(main).paddingLeft)};
    });
    const label=`${width}px/${order}`;
    assert.deepEqual(errors,[],label+': page errors');assert.equal(geometry.overflow,false,label+': overflow');
    for(const control of geometry.controls) {assert.equal(control.height,48,label+': standard control height');assert(control.left>=0&&control.right<=width,label+': control clipped');}
    if(width>=768)assert(geometry.controls.every(r=>Math.abs(r.bottom-geometry.controls[0].bottom)<.1),label+': row baselines');
    assert.equal(geometry.gutterTop,geometry.gutterMain,label+': header/content gutters');
    if(width>=1024)assert.equal(geometry.brand.bottom,geometry.topbar.bottom,label+': sidebar/header divider');
    assert(geometry.long.height>=48,label+': long button grows');
    if(width===320)assert(geometry.long.height>48,label+': long button must wrap');
    await page.locator('[data-framing-action]').focus();
    assert(await page.locator('[data-framing-action]').evaluate(n=>n===document.activeElement&&getComputedStyle(n).outlineStyle!=='none'),label+': keyboard focus');
    if(width>=1024){await page.getByRole('button',{name:'Réduire le menu',exact:true}).click();assert.equal(await page.locator('.nxt5-sidebar').evaluate(n=>n.getBoundingClientRect().width),80,label+': collapsed sidebar');}
    else {await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();assert(await page.locator('.nxt5-sidebar.is-open').isVisible(),label+': mobile drawer');await page.keyboard.press('Escape');}
    results.push({width,order,...geometry});await page.close();
  }
  for(const order of ['normal','reset-last']) for(const width of [320,360]) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    await page.goto(server.resolvedUrls.local[0]+'tools/framing-qa/index.html?view=profile&'+order);
    await page.getByRole('heading',{name:'Ton Wrapped',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
    const g=await page.evaluate(()=>{
      const box=n=>n.getBoundingClientRect();const header=document.querySelector('.profile-identity-header'), title=header.querySelector('.nxt5-page-title'), action=header.querySelector('button');
      const label=document.querySelector('.profile-showcase-chapter-index li:last-child small'), range=document.createRange();range.selectNodeContents(label);
      return {overflow:document.documentElement.scrollWidth>innerWidth,titleWidth:box(title).width,innerWidth:header.clientWidth-parseFloat(getComputedStyle(header).paddingLeft)-parseFloat(getComputedStyle(header).paddingRight),actionRight:box(action).right,titleRight:box(title).right,labelLines:range.getClientRects().length,selectOverflow:getComputedStyle(document.querySelector('.profile-filters select')).textOverflow};
    });
    const label=`profile/${width}px/${order}`;assert.equal(g.overflow,false,label+': overflow');assert(Math.abs(g.titleWidth-g.innerWidth)<1,label+': full-width name');assert(Math.abs(g.actionRight-g.titleRight)<1,label+': export aligned right');assert.equal(g.labelLines,1,label+': team label not broken');assert.equal(g.selectOverflow,'ellipsis',label+': explicit select truncation');results.push({view:'profile',width,order,...g});await page.close();
  }
  await fs.writeFile(path.join(output,'geometry.json'),JSON.stringify(results,null,2));
  console.log(`UI framing: ${results.length} configurations passed, controls, gutters, dividers, wrapping, focus and menus.`);
} finally {await browser?.close();await server.close();}
