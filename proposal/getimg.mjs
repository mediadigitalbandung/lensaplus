import { chromium } from "playwright";
import sharp from "sharp";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const imgdir=path.join(dir,"img"); fs.mkdirSync(imgdir,{recursive:true});
const exe=["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>fs.existsSync(p));
const browser=await chromium.launch(exe?{executablePath:exe}:{channel:"chrome"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
// topic -> list of search terms (try in order)
const items=[
  ["news",  ["newsroom","press conference journalist","newspaper editor desk"]],
  ["write", ["journalist writing laptop","reporter notebook writing","person typing laptop office"]],
  ["mobile",["person reading smartphone news","hand holding smartphone city","reading phone screen"]],
  ["deal",  ["business handshake meeting","handshake office deal","two people shaking hands suit"]],
  ["team",  ["business team meeting office","office teamwork discussion","colleagues meeting table"]],
  ["tech",  ["server room data center","network server racks","data center technology"]],
];
const used=new Set();
async function json(url){ try{ const r=await page.goto(url,{waitUntil:"load",timeout:40000}); if(r&&r.ok()) return await r.json(); }catch{} return null; }
async function body(url){ try{ const r=await page.goto(url,{waitUntil:"load",timeout:40000}); if(r&&r.ok()){ const b=await r.body(); if(b.length>15000) return b; } }catch{} return null; }
async function search(term){
  const api="https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search"
    +"&gsrsearch="+encodeURIComponent("filetype:bitmap "+term)+"&gsrnamespace=6&gsrlimit=12"
    +"&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600";
  const j=await json(api); if(!j||!j.query||!j.query.pages) return null;
  const pages=Object.values(j.query.pages);
  const cand=pages.map(p=>p.imageinfo&&p.imageinfo[0]).filter(Boolean)
    .filter(i=>/jpeg|jpg/i.test(i.mime||"")&&i.width>=1100&&i.height>=700)
    .filter(i=>!used.has(i.thumburl));
  return cand[0]?cand[0].thumburl:null;
}
for(const [name,terms] of items){
  let thumb=null;
  for(const t of terms){ thumb=await search(t); if(thumb) break; }
  let buf=thumb?await body(thumb):null;
  let src=thumb?"commons":"picsum";
  if(!buf){ buf=await body("https://picsum.photos/seed/"+name+"42/1600/640"); }
  if(buf){ if(thumb) used.add(thumb); const raw=path.join(imgdir,"raw-"+name); fs.writeFileSync(raw,buf);
    try{ await sharp(raw).resize(1600,540,{fit:"cover",position:"attention"}).jpeg({quality:80}).toFile(path.join(imgdir,"img-"+name+".jpg")); fs.unlinkSync(raw); console.log(name,"OK",src); }
    catch(e){ console.log(name,"SHARP-FAIL",e.message); } }
  else console.log(name,"FAIL");
}
await browser.close(); console.log("done");
