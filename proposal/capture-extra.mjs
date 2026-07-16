import { chromium } from "playwright";
import fs from "fs";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
const browser = await chromium.launch(exe?{executablePath:exe}:{channel:"chrome"});
const ctx = await browser.newContext({ viewport:{width:1366,height:1000}, deviceScaleFactor:2 });
const page = await ctx.newPage();
const go = async (url)=>{ try{ await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000}); }catch{} await page.waitForTimeout(2500); };

// Footer element
await go("https://kartawarta.com/");
try{ const f = page.locator("footer").first(); await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await f.screenshot({path:"proposal/shot-footer.png"}); console.log("footer OK"); }catch(e){console.log("footer FAIL",e.message);}

// A category page
let cat=null;
try{ cat = await page.evaluate(()=>{const a=[...document.querySelectorAll('a[href*="/kategori/"]')].map(x=>x.href);return a[0]||null;}); }catch{}
if(cat){ await go(cat); try{ await page.screenshot({path:"proposal/shot-category.png"}); console.log("category OK:",cat.slice(0,55)); }catch(e){console.log("cat FAIL",e.message);} }
else console.log("no category link");

// Market / bursa page
await go("https://kartawarta.com/pasar");
try{ await page.screenshot({path:"proposal/shot-pasar.png"}); console.log("pasar OK"); }catch(e){console.log("pasar FAIL",e.message);}

await ctx.close(); await browser.close(); console.log("done");
