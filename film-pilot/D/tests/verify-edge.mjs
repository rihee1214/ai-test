// Run with the local festival server already listening.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const profile=await mkdtemp(path.join(tmpdir(),'film-festival-edge-'))
const downloads=path.join(profile,'exports')
await mkdir(downloads)
const edge=path.join(process.env['ProgramFiles(x86)'],'Microsoft/Edge/Application/msedge.exe')
let processEdge, browser, exitPromise
const errors=[]
async function waitFor(check,label) {
  const until=Date.now()+15000
  let detail
  do {
    try { const result=await check(); if(result) return result } catch(e) {detail=e.message}
    await delay(100)
  } while(Date.now()<until)
  throw Error(label+' '+(detail||''))
}
async function connect(url) {
  const ws=new WebSocket(url), pending=new Map()
  let counter=0
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data)
    if (msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails)
    const p=pending.get(msg.id)
    if (p) { pending.delete(msg.id); msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result) }
  }
  return (method,params={})=>new Promise((resolve,reject)=>{
    pending.set(++counter,{resolve,reject}); ws.send(JSON.stringify({id:counter,method,params}))
  })
}
let base, lastEndpoint
async function start() {
  processEdge=spawn(edge,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'})
  exitPromise=new Promise(resolve=>processEdge.once('exit',resolve))
  const info=await waitFor(async()=>{
    const [port,endpoint]=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/)
    if(endpoint===lastEndpoint)return
    base='http://127.0.0.1:'+port
    return (await fetch(base+'/json/version')).json()
  },'Edge 시작')
  lastEndpoint=new URL(info.webSocketDebuggerUrl).pathname
  browser=await connect(info.webSocketDebuggerUrl)
  await browser('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads})
  console.log(info.Browser)
}
async function stop() { await browser('Browser.close'); await exitPromise; processEdge=null }
async function page(role) {
  const {targetId}=await browser('Target.createTarget',{url:'about:blank'})
  const t=(await (await fetch(base+'/json/list')).json()).find(t=>t.id===targetId)
  const call=await connect(t.webSocketDebuggerUrl)
  await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false})
  await call('Page.navigate',{url:'http://127.0.0.1:43127/#'+role})
  const run=async expression=>{
    const r=await call('Runtime.evaluate',{expression,returnByValue:true})
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text)
    return r.result.value
  }
  await waitFor(()=>run('!!document.querySelector("main h1")'),'페이지 로드')
  if (role==='desk' && process.env.FESTIVAL_SCREENSHOT) {
    const {data}=await call('Page.captureScreenshot',{format:'png'})
    await writeFile(process.env.FESTIVAL_SCREENSHOT,Buffer.from(data,'base64'))
    delete process.env.FESTIVAL_SCREENSHOT
  }
  return run
}
const sel=(action,id)=>'[data-action="'+action+'"]'+(id?'[data-id="'+id+'"]':'')
const click=(p,selector)=>p('document.querySelector('+JSON.stringify(selector)+').click()')
const act=(p,action,id)=>click(p,sel(action,id))
const fill=(p,name,value)=>p('document.querySelector("[name='+name+']").value='+JSON.stringify(value)+';document.querySelector("[name='+name+']").dispatchEvent(new Event("input",{bubbles:true}))')
const submit=p=>click(p,'dialog form button.primary')
const count=p=>p('document.querySelectorAll(".public article").length')
const txt=p=>p('document.body.innerText')
try {
  await start()
  let desk=await page('desk'), audience=await page('audience')
  assert.equal(await count(audience),6)
  assert.deepEqual(await desk('[innerWidth,innerHeight,document.documentElement.scrollWidth]'),[1280,800,1280])
  await act(desk,'edit','boat')
  await fill(desk,'start','16:20')
  await submit(desk)
  assert.equal(await count(audience),6)
  await act(desk,'review')
  await act(desk,'publish')
  await waitFor(async()=>await count(audience)===7,'관객 탭 발행 반영')
  assert.match(await txt(audience),/17:05/)
  await act(desk,'block')
  await fill(desk,'room','작은관'); await fill(desk,'start','17:05'); await fill(desk,'end','17:15')
  await submit(desk)
  await act(desk,'review')
  assert.equal(await desk('document.querySelector("[data-action=publish]").disabled'),true)
  await click(desk,'dialog .issue')
  await fill(desk,'room','큰관'); await fill(desk,'start','16:30'); await submit(desk)
  await act(desk,'review'); await act(desk,'publish')
  await waitFor(async()=>(await txt(audience)).includes('17:15'),'재발행')
  await act(desk,'history'); await act(desk,'download')
  const file=await waitFor(async()=>(await readdir(downloads)).find(n=>n.endsWith('.txt')),'안내문 다운로드')
  const content=await readFile(path.join(downloads,file),'utf8')
  assert.match(content,/종이배 \[변경\]/)
  assert.match(content,/이전: 작은관 16:20–17:05/)
  assert.match(content,/새 일정: 큰관 16:30–17:15/)
  await click(desk,'#close')
  await act(desk,'edit','boat'); await act(desk,'remove','boat')
  await stop(); await start()
  desk=await page('desk'); audience=await page('audience')
  assert.equal(await count(audience),7)
  assert.equal(await desk('document.querySelectorAll(".filmrow").length'),2)
  assert.equal(await desk('document.querySelectorAll(".slot.blocked").length'),1)
  await click(desk,'.blockrow'); await fill(desk,'end','17:16'); await submit(desk)
  assert.match(await txt(desk),/17:05–17:16/)
  await click(desk,'.blockrow'); await act(desk,'unblock')
  assert.equal(await desk('document.querySelectorAll(".slot.blocked").length'),0)
  await act(desk,'history'); assert.match(await txt(desk),/작은관 16:20–17:05/); await click(desk,'#close')
  // Publish the two removals, then recover the edition that contained both.
  await act(desk,'review'); await act(desk,'publish')
  await waitFor(async()=>await count(audience)===6,'4판 발행')
  await act(desk,'history'); await act(desk,'recover'); await act(desk,'cancel')
  assert.equal(await desk('document.querySelectorAll(".slot.blocked").length'),0)
  await act(desk,'history'); await act(desk,'recover'); await act(desk,'recover-draft')
  await stop(); await start()
  desk=await page('desk'); audience=await page('audience')
  assert.equal(await count(audience),6)
  assert.match(await txt(audience),/발행 4판/)
  assert.equal(await desk('document.querySelector(".large [data-id=boat]").title'),'종이배 16:30–17:15')
  assert.equal(await desk('document.querySelector(".blockrow").innerText'),'작은관 · 17:05–17:15')
  await act(desk,'review')
  assert.match(await desk('document.querySelector("dialog").innerText'),/종이배 · 추가/)
  await act(desk,'publish')
  await waitFor(async()=>await count(audience)===7,'복구 초안 발행')
  assert.match(await txt(audience),/발행 5판/)
  // A closure-only revision must also be publishable and reversible.
  await click(desk,'.blockrow'); await act(desk,'unblock')
  await act(desk,'review'); await act(desk,'publish')
  await waitFor(async()=>(await txt(audience)).includes('발행 6판'),'중단만 변경 발행')
  await act(desk,'history'); await act(desk,'recover'); await act(desk,'recover-draft')
  assert.equal(await desk('document.querySelector(".blockrow").innerText'),'작은관 · 17:05–17:15')
  await act(desk,'review'); await act(desk,'publish')
  await waitFor(async()=>(await txt(audience)).includes('발행 7판'),'중단만 복구 발행')
  // Reopen an old-format store with a pending edit and an unknown closure history.
  await act(desk,'edit','boat'); await act(desk,'remove','boat')
  await desk(`{
    const key='small-film-festival-v1', old=JSON.parse(localStorage.getItem(key))
    delete old.liveBlocks; delete old.previousBlocks
    localStorage.setItem(key,JSON.stringify(old))
  }`)
  desk=await page('desk')
  assert.equal(await desk('document.querySelectorAll(".filmrow").length'),2)
  assert.equal(await count(audience),7)
  assert.equal(await desk('document.querySelector(".blockrow").innerText'),'작은관 · 17:05–17:15')
  await act(desk,'history')
  assert.match(await txt(desk),/직전 판에 사용 중단 기록이 없어/)
  await click(desk,'#close')
  await act(desk,'reset'); await act(desk,'cancel')
  assert.equal(await count(audience),7)
  await act(desk,'reset'); await act(desk,'restore')
  await waitFor(async()=>await count(audience)===6,'초기화')
  assert.equal(await desk('document.querySelectorAll(".slot").length'),6)
  assert.equal(await desk('document.querySelectorAll(".filmrow").length'),2)
  assert.deepEqual(errors,[])
  console.log('PASS: draft isolation, publish, closure conflict, TXT download, restart, recovery and cancellation, closure-only recovery, legacy data, reset')
} finally {
  if(processEdge && browser)await stop()
}
