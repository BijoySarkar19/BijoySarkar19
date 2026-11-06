import fs from "node:fs";
import path from "node:path";

const USER = process.env.GITHUB_USERNAME || "BijoySarkar19";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required.");

const outDir = path.join(process.cwd(), "assets", "generated");
fs.mkdirSync(outDir, { recursive: true });

const colors = {
  Python:"#3572A5", JavaScript:"#F1E05A", TypeScript:"#3178C6", Java:"#B07219",
  "C++":"#F34B7D", C:"#555555", Dart:"#00B4AB", HTML:"#E34C26", CSS:"#563D7C",
  Jupyter:"#DA5B0B", Shell:"#89E051", Go:"#00ADD8", Rust:"#DEA584", Kotlin:"#A97BFF",
  PHP:"#4F5D95", Swift:"#F05138", Ruby:"#701516", "C#":"#178600", SQL:"#E38C00"
};
const esc = (s="") => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
async function api(url) {
  const r = await fetch(url, {headers:{
    "Authorization":`Bearer ${TOKEN}`,
    "Accept":"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"BijoySarkar-profile-readme"
  }});
  if (!r.ok) throw new Error(`GitHub API ${r.status} for ${url}: ${await r.text()}`);
  return r.json();
}
async function graphql(query, variables) {
  const r = await fetch("https://api.github.com/graphql", {method:"POST",headers:{
    "Authorization":`Bearer ${TOKEN}`, "Content-Type":"application/json",
    "User-Agent":"BijoySarkar-profile-readme"
  }, body:JSON.stringify({query,variables})});
  const body=await r.json();
  if (!r.ok || body.errors) throw new Error(`GitHub GraphQL error: ${JSON.stringify(body.errors || body)}`);
  return body.data;
}
function svgHeader(w,h,title,sub) {
 return `<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071426"/><stop offset=".6" stop-color="#102B50"/><stop offset="1" stop-color="#1D2255"/></linearGradient>
 <linearGradient id="accent"><stop stop-color="#38BDF8"/><stop offset=".55" stop-color="#818CF8"/><stop offset="1" stop-color="#C084FC"/></linearGradient>
 <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 </defs><rect width="${w}" height="${h}" rx="24" fill="url(#bg)" stroke="#294B79" stroke-width="2"/>
 <rect x="24" y="24" width="6" height="${h-48}" rx="3" fill="url(#accent)"/>
 <text x="52" y="54" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="#8CCBFF" letter-spacing="2">${esc(title)}</text>
 <text x="52" y="80" font-family="Arial,sans-serif" font-size="13" fill="#8EA9CE">${esc(sub)}</text>`;
}
function statSvg(user, repos, totalStars, totalForks, contributions) {
 const w=1000,h=250;
 const metrics=[
  ["PUBLIC REPOSITORIES",repos],["FOLLOWERS",user.followers],["TOTAL STARS",totalStars],["CONTRIBUTIONS · 1 YEAR",contributions]
 ];
 let body=svgHeader(w,h,"GITHUB / LIVE METRICS",`@${USER}  •  refreshed ${new Date().toISOString().slice(0,10)}`);
 const cardW=220, gap=18, x0=48, y=112;
 metrics.forEach(([label,value],i)=>{
  const x=x0+i*(cardW+gap);
  body+=`<rect x="${x}" y="${y}" width="${cardW}" height="105" rx="15" fill="#0C2342" stroke="#284A76"/>
  <text x="${x+17}" y="${y+34}" fill="#9DB9DE" font-family="Arial,sans-serif" font-size="12" font-weight="700">${esc(label)}</text>
  <text x="${x+17}" y="${y+82}" fill="#F4F8FF" font-family="Arial,sans-serif" font-size="38" font-weight="700">${Number(value).toLocaleString("en-US")}</text>`;
 });
 body+=`<text x="${w-45}" y="${h-18}" text-anchor="end" fill="#6686B3" font-family="Arial,sans-serif" font-size="11">PUBLIC GITHUB DATA · ${totalForks.toLocaleString("en-US")} FORKS ACROSS REPOSITORIES</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
function languageSvg(langs) {
 const w=1000,h=240; const items=langs.slice(0,6); const total=items.reduce((a,b)=>a+b.bytes,0)||1;
 let body=svgHeader(w,h,"LANGUAGES / REPOSITORY BREAKDOWN","Aggregated from the language data of your public repositories");
 const barX=52,barY=108,barW=896,barH=18;
 let cursor=barX;
 for (const l of items) {
   const ww=barW*l.bytes/total;
   body+=`<rect x="${cursor}" y="${barY}" width="${Math.max(1,ww)}" height="${barH}" fill="${colors[l.name]||"#60A5FA"}"/>`;
   cursor+=ww;
 }
 const rowY=165, colW=295;
 items.forEach((l,i)=>{
   const x=52+(i%3)*colW, y=rowY+Math.floor(i/3)*34;
   body+=`<circle cx="${x+5}" cy="${y-5}" r="6" fill="${colors[l.name]||"#60A5FA"}"/>
   <text x="${x+20}" y="${y}" fill="#DCEBFF" font-family="Arial,sans-serif" font-size="15">${esc(l.name)}</text>
   <text x="${x+250}" y="${y}" text-anchor="end" fill="#8DAED9" font-family="Arial,sans-serif" font-size="14">${(100*l.bytes/total).toFixed(1)}%</text>`;
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
function contributionSvg(calendar) {
 const cell=12,gap=4,startX=52,startY=103;
 const weeks=calendar.weeks;
 const w=Math.max(960,startX+weeks.length*(cell+gap)+32),h=224;
 let body=svgHeader(w,h,"CONTRIBUTION ACTIVITY","Your real GitHub contribution calendar · rolling 12-month view");
 const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 weeks.forEach((week,wi)=>{
   const firstOfMonth=(week.contributionDays||[]).find(day=>day.date.slice(8,10)==="01");
   if(firstOfMonth){
    const d=new Date(firstOfMonth.date+"T00:00:00Z");
    const x=startX+wi*(cell+gap);
    body+=`<text x="${x}" y="91" fill="#8EACD2" font-family="Arial,sans-serif" font-size="11">${monthNames[d.getUTCMonth()]}</text>`;
   }
   (week.contributionDays||[]).forEach((day,di)=>{
     const count=Number(day.contributionCount)||0;
     const level=count===0?0:count<3?1:count<6?2:count<10?3:4;
     const palette=["#142844","#164E63","#0E7490","#0284C7","#38BDF8"];
     const x=startX+wi*(cell+gap), y=startY+di*(cell+gap);
     body+=`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${palette[level]}" stroke="#223E62" stroke-width=".4"><title>${esc(day.date)}: ${count} contributions</title></rect>`;
   });
 });
 const legendX=w-112;
 body+=`<text x="${startX}" y="218" fill="#8EACD2" font-family="Arial,sans-serif" font-size="12">${Number(calendar.totalContributions).toLocaleString("en-US")} contributions in the last year</text>
 <text x="${legendX-34}" y="218" fill="#8EACD2" font-family="Arial,sans-serif" font-size="11">LESS</text>`;
 ["#142844","#164E63","#0E7490","#0284C7","#38BDF8"].forEach((c,i)=>body+=`<rect x="${legendX+i*13}" y="207" width="10" height="10" rx="2" fill="${c}"/>`);
 body+=`<text x="${w-24}" y="218" text-anchor="end" fill="#8EACD2" font-family="Arial,sans-serif" font-size="11">MORE</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

function makeRecentRepos(repos) {
 const selected=repos.filter(r=>!r.fork).slice(0,5);
 if(!selected.length) return "_No public repositories were returned by the GitHub API._";
 const lines=selected.map(r=>{
  const desc=(r.description||"No description provided.").replace(/\s+/g," ").slice(0,125);
  const meta=[r.language,`★ ${r.stargazers_count}`,`Updated ${new Date(r.updated_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})}`].filter(Boolean).join(" · ");
  return `- **[${r.name}](${r.html_url})** — ${desc}  \n  <sub>${esc(meta)}</sub>`;
 });
 return `<!-- AUTO-UPDATED FROM THE GITHUB API -->\n${lines.join("\n")}`;
}

const user=await api(`https://api.github.com/users/${USER}`);
let repos=[];
for(let page=1;page<=5;page++){
 const batch=await api(`https://api.github.com/users/${USER}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
 repos.push(...batch);
 if(batch.length<100) break;
}
const owned=repos.filter(r=>!r.fork);
const totalStars=owned.reduce((s,r)=>s+r.stargazers_count,0);
const totalForks=owned.reduce((s,r)=>s+r.forks_count,0);

// Fetch language byte counts with a small concurrency limit.
const languageTotals={};
for(let i=0;i<owned.length;i+=5){
 const batch=owned.slice(i,i+5);
 const results=await Promise.all(batch.map(async r=>{
  try{return await api(`https://api.github.com/repos/${USER}/${r.name}/languages`)}catch(e){console.warn(e.message);return {}}
 }));
 for(const obj of results) for(const [name,bytes] of Object.entries(obj)) languageTotals[name]=(languageTotals[name]||0)+bytes;
}
const langs=Object.entries(languageTotals).map(([name,bytes])=>({name,bytes})).sort((a,b)=>b.bytes-a.bytes);

function parseCalendarFromPublicProfile(html) {
 const cells = [];
 const tags = [...html.matchAll(/<td\b[^>]*>/gi)].map(match => match[0]);
 const readAttr = (tag, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}=["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
 };
 for (const tag of tags) {
  const date = readAttr(tag, "data-date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const countAttr = readAttr(tag, "data-count");
  const aria = readAttr(tag, "aria-label");
  const countMatch = aria.match(/(\d+)\s+contributions?/i);
  const count = countAttr !== "" ? Number(countAttr) : (countMatch ? Number(countMatch[1]) : 0);
  const level = readAttr(tag, "data-level");
  cells.push({ date, contributionCount: Number.isFinite(count) ? count : 0, contributionLevel: Number(level || 0) });
 }
 if (cells.length < 300) {
  throw new Error(`GitHub public contributions page returned only ${cells.length} daily cells.`);
 }
 cells.sort((a,b)=>a.date.localeCompare(b.date));
 const byDate = new Map(cells.map(day=>[day.date,day.contributionCount]));
 const first = new Date(`${cells[0].date}T00:00:00Z`);
 const last = new Date(`${cells[cells.length-1].date}T00:00:00Z`);
 const start = new Date(first);
 start.setUTCDate(start.getUTCDate() - start.getUTCDay());
 const end = new Date(last);
 end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
 const weeks = [];
 for (let cursor=new Date(start); cursor<=end; cursor.setUTCDate(cursor.getUTCDate()+7)) {
  const days=[];
  for(let dow=0;dow<7;dow++) {
   const d=new Date(cursor);
   d.setUTCDate(d.getUTCDate()+dow);
   const date=d.toISOString().slice(0,10);
   const count=byDate.get(date) || 0;
   days.push({date,contributionCount:count});
  }
  weeks.push({contributionDays:days});
 }
 const totalContributions=cells.reduce((sum,day)=>sum+day.contributionCount,0);
 return {totalContributions,weeks};
}

async function fetchPublicCalendar() {
 const response=await fetch(`https://github.com/users/${USER}/contributions`,{
  headers:{
   "Accept":"text/html",
   "User-Agent":"BijoySarkar-profile-readme"
  }
 });
 if(!response.ok) throw new Error(`GitHub contributions page returned HTTP ${response.status}`);
 const html=await response.text();
 return parseCalendarFromPublicProfile(html);
}

let calendar=null;
try {
 const data=await graphql(`query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}`,{login:USER});
 calendar=data?.user?.contributionsCollection?.contributionCalendar;
 if(!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length<40) throw new Error("GraphQL returned an incomplete contribution calendar.");
 console.log("Contribution calendar loaded through GitHub GraphQL.");
} catch(e) {
 console.warn("GraphQL contribution lookup unavailable; using GitHub's public contribution page:",e.message);
 calendar=await fetchPublicCalendar();
 console.log("Contribution calendar loaded from GitHub's public profile page.");
}
if(!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length<40) {
 throw new Error("A complete contribution calendar could not be generated. No placeholder chart will be published.");
}

fs.writeFileSync(path.join(outDir,"github-stats.svg"),statSvg(user,owned.length,totalStars,totalForks,calendar.totalContributions));
fs.writeFileSync(path.join(outDir,"top-languages.svg"),languageSvg(langs));
fs.writeFileSync(path.join(outDir,"contributions.svg"),contributionSvg(calendar));

const readmePath=path.join(process.cwd(),"README.md");
let readme=fs.readFileSync(readmePath,"utf8");
const start="<!-- RECENT-REPOS:START -->", end="<!-- RECENT-REPOS:END -->";
if(readme.includes(start)&&readme.includes(end)){
 const left=readme.indexOf(start)+start.length, right=readme.indexOf(end);
 readme=readme.slice(0,left)+"\n\n"+makeRecentRepos(owned.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)))+"\n\n"+readme.slice(right);
 fs.writeFileSync(readmePath,readme);
}
console.log(`Updated profile assets: ${owned.length} public repositories, ${langs.length} languages, ${calendar.totalContributions} contributions.`);
