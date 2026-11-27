"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import Papa from "papaparse";
import {
  ArrowDownToLine, Upload, Plus, Trash2, Moon, Sun, Printer, Copy,
  Download, Wifi, Mail, Link as LinkIcon, MessageSquare, Phone, Bitcoin,
  FileText, AtSign, Shuffle, QrCode, History, Palette, X, Check, FileUp
} from "lucide-react";

type Kind = "random" | "url" | "email" | "text" | "sms" | "tel" | "bitcoin" | "wifi" | "twitter" | "pdf";
type Entry = { id: string; name: string; kind: Kind; payload: string; createdAt: number };
type Settings = { foreground: string; background: string; size: number; errorCorrectionLevel: "L"|"M"|"Q"|"H"; margin: number };
const labels: Record<Kind,string> = { random:"Random", url:"URL", email:"Email", text:"Text", sms:"SMS", tel:"Telephone", bitcoin:"Bitcoin", wifi:"Wi-Fi", twitter:"X / Twitter", pdf:"PDF link" };
const kinds: {kind:Kind; icon:any; desc:string}[] = [
  {kind:"random",icon:Shuffle,desc:"Create unique random QR payloads"},
  {kind:"url",icon:LinkIcon,desc:"Open a website or link"},
  {kind:"email",icon:Mail,desc:"Compose an email"},
  {kind:"text",icon:FileText,desc:"Share plain text"},
  {kind:"sms",icon:MessageSquare,desc:"Prepare a text message"},
  {kind:"tel",icon:Phone,desc:"Call a phone number"},
  {kind:"bitcoin",icon:Bitcoin,desc:"Bitcoin payment URI"},
  {kind:"wifi",icon:Wifi,desc:"Connect to a Wi-Fi network"},
  {kind:"twitter",icon:AtSign,desc:"Open an X profile or post"},
  {kind:"pdf",icon:FileUp,desc:"Link to a hosted PDF"}
];
const initialSettings: Settings = { foreground:"#171717", background:"#ffffff", size:640, errorCorrectionLevel:"M", margin:2 };
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const randomText = () => `QR-${Array.from(crypto.getRandomValues(new Uint8Array(12))).map(n=>n.toString(16).padStart(2,"0")).join("").toUpperCase()}`;

function buildPayload(kind: Kind, v: Record<string,string>): string {
  const value = (v.value || "").trim();
  switch(kind) {
    case "random": return v.value?.trim() || randomText();
    case "url": case "pdf": case "twitter": {
      if (!value) throw new Error("Enter a link.");
      const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try { new URL(normalized); } catch { throw new Error("Enter a valid URL."); }
      return normalized;
    }
    case "text": if (!value) throw new Error("Enter some text."); return value;
    case "email": {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
      const p = new URLSearchParams(); if(v.subject) p.set("subject",v.subject); if(v.body) p.set("body",v.body);
      return `mailto:${value}${p.size ? `?${p.toString()}` : ""}`;
    }
    case "sms": if(!value) throw new Error("Enter a phone number."); return `SMSTO:${value}:${v.body || ""}`;
    case "tel": if(!value) throw new Error("Enter a phone number."); return `tel:${value}`;
    case "bitcoin": {
      if(!value) throw new Error("Enter a Bitcoin wallet address.");
      const p = new URLSearchParams(); if(v.amount) p.set("amount",v.amount);
      return `bitcoin:${value}${p.size ? `?${p.toString()}` : ""}`;
    }
    case "wifi": {
      if(!v.ssid?.trim()) throw new Error("Enter the Wi-Fi network name (SSID).");
      const security = v.security || "WPA";
      const esc = (s:string) => s.replace(/([\\;,:"])/g,"\\$1");
      return `WIFI:T:${security};S:${esc(v.ssid)};P:${esc(v.password || "")};H:${v.hidden === "true" ? "true" : "false"};;`;
    }
  }
}

async function qrData(payload:string, settings:Settings, format:"png"|"svg"="png") {
  const options = { errorCorrectionLevel: settings.errorCorrectionLevel, margin: settings.margin, width: settings.size, color: { dark: settings.foreground, light: settings.background } };
  if(format==="svg") return QRCode.toString(payload,{...options,type:"svg"});
  return QRCode.toDataURL(payload,options);
}
function downloadUrl(url:string, filename:string) {
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}
function safeName(s:string) { return (s || "qr-code").toLowerCase().replace(/[^a-z0-9-_]+/g,"-").replace(/^-|-$/g,"").slice(0,48) || "qr-code"; }

export default function Home() {
  const [kind,setKind]=useState<Kind>("url");
  const [values,setValues]=useState<Record<string,string>>({value:"https://example.com",ssid:"",password:"",security:"WPA",subject:"",body:"",amount:"",hidden:"false"});
  const [settings,setSettings]=useState<Settings>(initialSettings);
  const [current,setCurrent]=useState<Entry|null>(null);
  const [preview,setPreview]=useState("");
  const [history,setHistory]=useState<Entry[]>([]);
  const [batch,setBatch]=useState<Entry[]>([]);
  const [count,setCount]=useState(10);
  const [activeTab,setActiveTab]=useState<"create"|"bulk"|"history">("create");
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [logo,setLogo]=useState<string>("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [batchMode,setBatchMode]=useState<"random"|"csv">("random");
  const fileRef=useRef<HTMLInputElement>(null);
  const logoRef=useRef<HTMLInputElement>(null);

  useEffect(()=> {
    try {
      const saved=localStorage.getItem("qr-studio-history");
      if(saved) setHistory(JSON.parse(saved));
      const savedTheme=localStorage.getItem("qr-studio-theme");
      if(savedTheme==="dark"||savedTheme==="light") setTheme(savedTheme);
    } catch {}
  },[]);
  useEffect(()=>{ document.documentElement.dataset.theme=theme; try{localStorage.setItem("qr-studio-theme",theme)}catch{} },[theme]);
  useEffect(()=>{ try{localStorage.setItem("qr-studio-history",JSON.stringify(history.slice(0,100)))}catch{} },[history]);
  useEffect(()=> {
    let cancelled=false;
    if(!current){setPreview("");return;}
    qrData(current.payload,settings,"png").then(url=>{if(!cancelled)setPreview(url)}).catch(()=>{if(!cancelled)setPreview("")});
    return ()=>{cancelled=true};
  },[current,settings]);

  const update=(key:string,value:string)=>setValues(old=>({...old,[key]:value}));
  const remember=(entry:Entry)=>setHistory(old=>[entry,...old.filter(x=>x.id!==entry.id)].slice(0,100));
  const makeEntry=(k:Kind,payload:string,name?:string):Entry=>({id:uid(),name:name||labels[k],kind:k,payload,createdAt:Date.now()});
  const createOne=()=> {
    setError("");setNotice("");
    try {
      const payload=buildPayload(kind,values);
      const entry=makeEntry(kind,payload,values.name || labels[kind]);
      setCurrent(entry);remember(entry);setNotice("QR code generated successfully.");
    } catch(e) {setError(e instanceof Error?e.message:"Could not generate QR code.");}
  };
  const downloadCurrent=async(format:"png"|"svg")=>{
    if(!current)return;
    try{
      let data=await qrData(current.payload,settings,format);
      if(format==="png"&&logo){
        const canvas=document.createElement("canvas"); canvas.width=settings.size;canvas.height=settings.size;
        const ctx=canvas.getContext("2d"); if(!ctx)throw new Error("Canvas is unavailable.");
        const img=new Image(); img.src=data; await new Promise((r,j)=>{img.onload=r;img.onerror=j});
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const mark=new Image();mark.src=logo;await new Promise((r,j)=>{mark.onload=r;mark.onerror=j});
        const side=settings.size*.19;const x=(settings.size-side)/2,y=(settings.size-side)/2;
        ctx.fillStyle=settings.background;ctx.fillRect(x-8,y-8,side+16,side+16);ctx.drawImage(mark,x,y,side,side);
        data=canvas.toDataURL("image/png");
      }
      if(format==="png")downloadUrl(data,`${safeName(current.name)}.png`);
      else {const blob=new Blob([data],{type:"image/svg+xml"});downloadUrl(URL.createObjectURL(blob),`${safeName(current.name)}.svg`);}
      setNotice(`${format.toUpperCase()} downloaded.`);
    }catch{setError("Download failed. Try removing the logo or using a smaller QR size.");}
  };
  const downloadBatch=async()=>{
    if(!batch.length)return;setBusy(true);setError("");
    try{
      const zip=new JSZip();
      for(let i=0;i<batch.length;i++){
        const entry=batch[i]; const data=await qrData(entry.payload,settings,"png");
        zip.file(`${String(i+1).padStart(3,"0")}-${safeName(entry.name)}.png`,data.split(",")[1],{base64:true});
      }
      const blob=await zip.generateAsync({type:"blob"});downloadUrl(URL.createObjectURL(blob),"qr-studio-batch.zip");setNotice(`${batch.length} QR codes downloaded as ZIP.`);
    }catch{setError("Could not create ZIP. Try a smaller batch.");}finally{setBusy(false);}
  };
  const generateRandomBatch=()=>{
    const n=Math.max(1,Math.min(100,Number(count)||1));
    const entries=Array.from({length:n},(_,i)=>makeEntry("random",randomText(),`Random QR ${i+1}`));
    setBatch(entries);setNotice(`${n} unique random QR codes generated.`);setError("");
  };
  const handleCsv=(file?:File)=>{
    if(!file)return;
    Papa.parse<Record<string,string>>(file,{header:true,skipEmptyLines:true,complete:(result)=>{
      try{
        const entries=result.data.slice(0,100).map((row,i)=>{
          const raw=(row.type||"text").toLowerCase().trim() as Kind;
          const k=(raw in labels?raw:"text") as Kind;
          const payload=buildPayload(k,{...row,value:row.value||row.url||row.text||row.ssid||"",ssid:row.ssid||row.value||""});
          return makeEntry(k,payload,row.name||`${labels[k]} ${i+1}`);
        });
        if(!entries.length)throw new Error("No valid rows found in the CSV.");
        setBatch(entries);setNotice(`${entries.length} QR codes imported from CSV (maximum 100).`);setError("");
      }catch(e){setError(e instanceof Error?e.message:"Could not read CSV.");}
    },error:()=>setError("Could not parse the CSV file.")});
  };
  const selectHistory=(entry:Entry)=>{setCurrent(entry);setKind(entry.kind);setActiveTab("create");setValues(v=>({...v,value:entry.payload}));};
  const printBatch=async()=>{
    if(!batch.length)return;
    try{
      const cards=await Promise.all(batch.map(async e=>({e,url:await qrData(e.payload,{...settings,size:260},"png")})));
      const win=window.open("","_blank");if(!win){setError("Allow pop-ups to print QR codes.");return;}
      win.document.write(`<html><head><title>QR Studio print sheet</title><style>body{font-family:Arial;padding:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{text-align:center;border:1px solid #ddd;padding:12px;break-inside:avoid}.card img{width:150px;height:150px}.label{font-size:12px;overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body><h1>QR Studio</h1><div class="grid">${cards.map(c=>`<div class="card"><img src="${c.url}"/><div class="label">${c.e.name.replace(/[&<>"']/g,"")}</div></div>`).join("")}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
      win.document.close();
    }catch{setError("Could not prepare print sheet.");}
  };
  const typeName=labels[kind];
  const activeBatch=useMemo(()=>batch.slice(0,100),[batch]);

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><QrCode size={22}/></span><span>QR<span className="brand-light"> Studio</span></span></a>
      <div className="top-actions"><span className="privacy"><span className="privacy-dot"/> Browser-based · No account required</span><button className="icon-btn" aria-label="Toggle theme" onClick={()=>setTheme(theme==="light"?"dark":"light")}>{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button></div>
    </header>
    <section className="hero">
      <div className="eyebrow"><span/> SIMPLE. FAST. PRIVATE.</div>
      <h1>Create QR codes<br/><span>for anything.</span></h1>
      <p>Generate, customize and download beautiful QR codes in seconds. Your data stays in your browser.</p>
    </section>
    <nav className="tabs">
      <button className={activeTab==="create"?"tab active": "tab"} onClick={()=>setActiveTab("create")}><Plus size={16}/> Create QR</button>
      <button className={activeTab==="bulk"?"tab active":"tab"} onClick={()=>setActiveTab("bulk")}><QrCode size={16}/> Bulk generator</button>
      <button className={activeTab==="history"?"tab active":"tab"} onClick={()=>setActiveTab("history")}><History size={16}/> History <span className="count">{history.length}</span></button>
    </nav>

    {error&&<div className="alert error"><X size={16}/>{error}<button onClick={()=>setError("")}>Dismiss</button></div>}
    {notice&&<div className="alert success"><Check size={16}/>{notice}<button onClick={()=>setNotice("")}>Dismiss</button></div>}

    {activeTab==="create"&&<section className="workspace">
      <div className="panel editor">
        <div className="panel-heading"><div><span className="step">01</span><h2>Choose QR type</h2></div><span className="muted">Select a format</span></div>
        <div className="type-grid">{kinds.map(({kind:k,icon:Icon,desc})=><button key={k} title={desc} className={`type-card ${kind===k?"selected":""}`} onClick={()=>{setKind(k);if(k==="random")setValues(v=>({...v,value:""}));setError("");}}><span className="type-icon"><Icon size={19}/></span><span>{labels[k]}</span>{kind===k&&<Check className="type-check" size={14}/>}</button>)}</div>
        <div className="section-rule"/>
        <div className="panel-heading"><div><span className="step">02</span><h2>Enter your content</h2></div></div>
        <div className="form-fields">
          {kind==="wifi"?<><label>Network name (SSID)<input value={values.ssid} onChange={e=>update("ssid",e.target.value)} placeholder="e.g. MyHomeWiFi"/></label><label>Password<input type="text" value={values.password} onChange={e=>update("password",e.target.value)} placeholder="Wi-Fi password"/></label><div className="field-row"><label>Security<select value={values.security} onChange={e=>update("security",e.target.value)}><option>WPA</option><option>WEP</option><option>nopass</option></select></label><label className="check-label"><input type="checkbox" checked={values.hidden==="true"} onChange={e=>update("hidden",String(e.target.checked))}/> Hidden network</label></div></>:
          kind==="email"?<><label>Email address<input value={values.value||""} onChange={e=>update("value",e.target.value)} placeholder="hello@example.com"/></label><label>Subject (optional)<input value={values.subject} onChange={e=>update("subject",e.target.value)} placeholder="Hello"/></label><label>Message (optional)<textarea value={values.body} onChange={e=>update("body",e.target.value)} placeholder="Write a message..." rows={3}/></label></>:
          kind==="sms"?<><label>Phone number<input value={values.value||""} onChange={e=>update("value",e.target.value)} placeholder="+1 555 123 4567"/></label><label>Message (optional)<textarea value={values.body} onChange={e=>update("body",e.target.value)} placeholder="Your message..." rows={3}/></label></>:
          kind==="bitcoin"?<><label>Bitcoin wallet address<input value={values.value||""} onChange={e=>update("value",e.target.value)} placeholder="Bitcoin address"/></label><label>Amount in BTC (optional)<input value={values.amount} onChange={e=>update("amount",e.target.value)} placeholder="0.001"/></label></>:
          kind==="tel"?<label>Phone number<input value={values.value||""} onChange={e=>update("value",e.target.value)} placeholder="+1 555 123 4567"/></label>:
          kind==="random"?<label>Custom random payload (optional)<input value={values.value||""} onChange={e=>update("value",e.target.value)} placeholder="Leave blank to generate random text"/></label>:
          <label>{kind==="text"?"Your text":kind==="twitter"?"X profile or post URL":kind==="pdf"?"Public PDF URL":"Website URL"}<textarea value={values.value||""} onChange={e=>update("value",e.target.value)} rows={kind==="text"?5:2} placeholder={kind==="text"?"Type your message here...":kind==="pdf"?"https://example.com/document.pdf":kind==="twitter"?"https://x.com/username":"https://example.com"}/></label>}
          <label>QR label (optional)<input value={values.name||""} onChange={e=>update("name",e.target.value)} placeholder={`${typeName} QR code`}/></label>
        </div>
        <div className="section-rule"/>
        <div className="panel-heading"><div><span className="step">03</span><h2>Customize design</h2></div><Palette size={17} className="muted-icon"/></div>
        <div className="design-grid">
          <label>Foreground<div className="color-input"><input type="color" value={settings.foreground} onChange={e=>setSettings(s=>({...s,foreground:e.target.value}))}/><code>{settings.foreground}</code></div></label>
          <label>Background<div className="color-input"><input type="color" value={settings.background} onChange={e=>setSettings(s=>({...s,background:e.target.value}))}/><code>{settings.background}</code></div></label>
          <label>Size<select value={settings.size} onChange={e=>setSettings(s=>({...s,size:Number(e.target.value)}))}><option value="256">256 × 256</option><option value="512">512 × 512</option><option value="640">640 × 640</option><option value="1024">1024 × 1024</option></select></label>
          <label>Error correction<select value={settings.errorCorrectionLevel} onChange={e=>setSettings(s=>({...s,errorCorrectionLevel:e.target.value as Settings["errorCorrectionLevel"]}))}><option value="L">Low (L)</option><option value="M">Medium (M)</option><option value="Q">Quartile (Q)</option><option value="H">High (H)</option></select></label>
        </div>
        <label className="upload-logo">Center logo <span className="muted">Optional · PNG, JPG, SVG</span><input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>2*1024*1024){setError("Logo must be 2 MB or smaller.");return;}const r=new FileReader();r.onload=()=>setLogo(String(r.result));r.readAsDataURL(f);}}}/>{logo&&<button className="text-btn" onClick={()=>{setLogo("");if(logoRef.current)logoRef.current.value=""}}>Remove logo</button>}</label>
        <button className="primary-btn full" onClick={createOne}><QrCode size={18}/> Generate QR code</button>
      </div>
      <div className="panel preview-panel">
        <div className="panel-heading"><div><span className="step">04</span><h2>Preview & download</h2></div><span className="live-pill">LIVE PREVIEW</span></div>
        <div className="qr-stage">
          {preview?<div className="qr-wrap"><img src={preview} alt="Generated QR code preview"/>{logo&&<img className="qr-logo" src={logo} alt="QR center logo"/>}</div>:<div className="empty-qr"><QrCode size={48}/><strong>Your QR code will appear here</strong><span>Choose a type, enter content and generate.</span></div>}
        </div>
        {current&&<div className="result-meta"><strong>{current.name}</strong><span>{labels[current.kind]} · {new Date(current.createdAt).toLocaleString()}</span><div className="payload-preview">{current.payload}</div></div>}
        <div className="download-actions"><button className="primary-btn" disabled={!current} onClick={()=>downloadCurrent("png")}><Download size={17}/> PNG</button><button className="secondary-btn" disabled={!current} onClick={()=>downloadCurrent("svg")}><Download size={17}/> SVG</button><button className="secondary-btn" disabled={!current} onClick={()=>{if(current){navigator.clipboard?.writeText(current.payload);setNotice("QR content copied.");}}}><Copy size={16}/> Copy content</button></div>
        <div className="tip-box"><strong>Scan-ready tip</strong><span>Use a dark foreground on a light background for the most reliable scanning. Test your QR code with a phone before printing.</span></div>
      </div>
    </section>}

    {activeTab==="bulk"&&<section className="bulk-layout">
      <div className="panel bulk-controls">
        <div className="panel-heading"><div><span className="step">01</span><h2>Bulk QR generator</h2></div></div>
        <div className="segmented"><button className={batchMode==="random"?"chosen":""} onClick={()=>setBatchMode("random")}><Shuffle size={15}/> Random batch</button><button className={batchMode==="csv"?"chosen":""} onClick={()=>setBatchMode("csv")}><Upload size={15}/> Import CSV</button></div>
        {batchMode==="random"? <><label>Number of QR codes<input type="number" min="1" max="100" value={count} onChange={e=>setCount(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label><p className="muted small">Generate up to 100 unique random QR codes in one batch.</p><button className="primary-btn full" onClick={generateRandomBatch}><Shuffle size={17}/> Generate {count} QR codes</button></>:
        <div className="csv-drop" onClick={()=>fileRef.current?.click()}><FileUp size={30}/><strong>Choose a CSV file</strong><span>Header row required · Up to 100 rows</span><button className="secondary-btn">Browse CSV</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e=>handleCsv(e.target.files?.[0])}/></div>}
        <div className="csv-help"><strong>CSV example</strong><pre>{`type,name,value\nurl,Website,https://example.com\ntext,Welcome,Hello there\nemail,Contact,hello@example.com`}</pre><button className="text-btn" onClick={()=>downloadUrl(URL.createObjectURL(new Blob(["type,name,value,subject,body,password,security,amount\\nurl,Website,https://example.com,,,,,,\\ntext,Welcome,Hello there,,,,,,\\nemail,Contact,hello@example.com,Hello,Message,,,,\\nwifi,Guest WiFi,GuestNetwork,,,password123,WPA,,\\n"],{type:"text/csv"})),"qr-studio-template.csv")}>Download CSV template</button></div>
      </div>
      <div className="panel batch-results">
        <div className="panel-heading"><div><span className="step">02</span><h2>Generated QR codes</h2></div><span className="muted">{batch.length} items</span></div>
        {!batch.length?<div className="empty-batch"><QrCode size={44}/><strong>No QR codes yet</strong><span>Generate a random batch or import a CSV file to get started.</span></div>:
          <><div className="batch-toolbar"><span>{batch.length} QR codes ready</span><div><button className="secondary-btn small-btn" onClick={printBatch}><Printer size={15}/> Print</button><button className="primary-btn small-btn" disabled={busy} onClick={downloadBatch}><Download size={15}/> {busy?"Preparing...":"Download ZIP"}</button></div></div><div className="batch-grid">{activeBatch.map((entry,i)=><BatchCard key={entry.id} entry={entry} settings={settings} index={i} onRemove={()=>setBatch(old=>old.filter(x=>x.id!==entry.id))}/>)}</div></>}
      </div>
    </section>}

    {activeTab==="history"&&<section className="panel history-panel">
      <div className="panel-heading"><div><span className="step">LOCAL</span><h2>QR history</h2></div><div className="history-actions"><span className="muted">Saved on this device</span><button className="text-btn danger-text" onClick={()=>{if(confirm("Clear all saved QR history?"))setHistory([])}} disabled={!history.length}><Trash2 size={15}/> Clear history</button></div></div>
      {!history.length?<div className="empty-batch"><History size={42}/><strong>Your history is empty</strong><span>QR codes you create will appear here.</span></div>:<div className="history-list">{history.map(entry=><div className="history-row" key={entry.id}><div className="history-symbol"><QrCode size={20}/></div><div className="history-info"><strong>{entry.name}</strong><span>{labels[entry.kind]} · {new Date(entry.createdAt).toLocaleString()}</span><small>{entry.payload}</small></div><button className="secondary-btn small-btn" onClick={()=>selectHistory(entry)}>Open</button><button className="icon-btn" aria-label="Delete history item" onClick={()=>setHistory(old=>old.filter(x=>x.id!==entry.id))}><Trash2 size={16}/></button></div>)}</div>}
    </section>}
    <footer><div className="footer-brand"><QrCode size={17}/> QR Studio</div><span>Free QR tools · Private by design · Made for the web</span><span>QR generation happens locally in your browser.</span></footer>
  </main>;
}

function BatchCard({entry,settings,index,onRemove}:{entry:Entry;settings:Settings;index:number;onRemove:()=>void}) {
  const [src,setSrc]=useState("");
  useEffect(()=>{let live=true;qrData(entry.payload,settings,"png").then(u=>{if(live)setSrc(u)});return()=>{live=false}},[entry,settings]);
  return <div className="batch-card"><div className="batch-number">#{String(index+1).padStart(2,"0")}</div>{src?<img src={src} alt={`QR ${entry.name}`}/>:<div className="batch-placeholder"/>}<strong title={entry.name}>{entry.name}</strong><span>{labels[entry.kind]}</span><div className="batch-card-actions"><button onClick={()=>src&&downloadUrl(src,`${safeName(entry.name)}.png`)} disabled={!src} title="Download PNG"><Download size={15}/></button><button onClick={onRemove} title="Remove"><Trash2 size={15}/></button></div></div>;
}
