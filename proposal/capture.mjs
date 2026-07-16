import { chromium } from "playwright";
import fs from "fs";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
const browser = await chromium.launch(exe?{executablePath:exe}:{channel:"chrome"});
const go = async (page,url)=>{ try{ await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000}); }catch{} await page.waitForTimeout(3000); };

// Desktop homepage
const ctx = await browser.newContext({ viewport:{width:1366,height:1000}, deviceScaleFactor:2 });
const page = await ctx.newPage();
await go(page,"https://kartawarta.com/");
try{ await page.screenshot({path:"proposal/shot-home.png"}); console.log("home OK"); }catch(e){console.log("home FAIL",e.message);}

// Article
let href=null;
try{ href = await page.evaluate(()=>{const l=[...document.querySelectorAll('a[href*="/berita/"]')].map(a=>a.href).filter(h=>/\/berita\/[^/?#]+$/.test(h));return l[0]||null;}); }catch{}
if(href){ await go(page,href); try{ await page.screenshot({path:"proposal/shot-article.png"}); console.log("article OK:",href.slice(0,60)); }catch(e){console.log("article FAIL",e.message);} }
else console.log("no article link");
await ctx.close();

// Mobile homepage
const mctx = await browser.newContext({ viewport:{width:390,height:860}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const mp = await mctx.newPage();
await go(mp,"https://kartawarta.com/");
try{ await mp.screenshot({path:"proposal/shot-mobile.png"}); console.log("mobile OK"); }catch(e){console.log("mobile FAIL",e.message);}
await mctx.close();
await browser.close();
console.log("done");
