import { films, rooms, initial, end, clock, describe, issues, changes, publish } from './schedule.mjs'

const key = 'small-film-festival-v1'
const root = document.querySelector('#app'), dialog = document.querySelector('#dialog')
const contents = document.querySelector('#contents'), toast = document.querySelector('#toast')
const read = () => JSON.parse(localStorage.getItem(key)) || initial()
let state = read()
let timer
function notice(message) {
  toast.textContent = message
  clearTimeout(timer)
  timer = setTimeout(()=>toast.textContent='',4000)
}
function save(next,message) {
  try { localStorage.setItem(key,JSON.stringify(next)) }
  catch { notice('저장 공간을 확인해 주세요. 변경을 저장하지 못했습니다.'); return }
  state = next
  dialog.close()
  render()
  notice(message)
}
function openPanel(title,body) {
  contents.innerHTML = '<h2 id="panel-title">'+title+'</h2>'+body
  dialog.setAttribute('aria-labelledby','panel-title')
  if (!dialog.open) dialog.showModal()
}
const button = (action,label,cls='',id='') => '<button type="button" class="'+cls+'" data-action="'+action+'" data-id="'+id+'">'+label+'</button>'
const roomSelect = current => '<label>상영관<select name="room">'+Object.entries(rooms).map(([r,n])=>'<option value="'+r+'" '+(r===current?'selected':'')+'>'+r+' · '+n+'석</option>').join('')+'</select></label>'
const timeInput = (name,label,value) => '<label>'+label+'<input type="time" name="'+name+'" value="'+clock(value)+'" required></label>'
const minutes = value => { const [h,m]=value.split(':').map(Number); return h*60+m }
const order = (a,b) => a[1].start-b[1].start
const audience = () => location.hash==='#audience'
function board(room) {
  const rows = Object.entries(state.draft).filter(([,a])=>a.room===room).map(([id,a])=>({
    id, start:a.start, finish:end(id,a)+10, screening:end(id,a)
  }))
  rows.push(...state.blocks.filter(b=>b.room===room).map(b=>({...b,finish:b.end,block:true})))
  rows.sort((a,b)=>a.start-b.start)
  let group=[], lanes=[], html=''
  function flush() {
    for (const row of group) {
      const from=Math.max(780,row.start), to=Math.min(1080,row.finish)
      if (from>=to) continue
      const pos='top:'+((from-780)/3)+'%;height:'+((to-from)/3)+'%;left:'+(100*row.lane/lanes.length)+'%;width:'+(100/lanes.length)+'%'
      const label=row.block?'사용 중단':films[row.id].title
      const times=clock(row.start)+'–'+clock(row.block?row.finish:row.screening)
      html+='<button class="slot '+(row.block?'blocked':'')+'" data-action="'+(row.block?'block':'edit')+'" data-id="'+row.id+'" style="'+pos+'" title="'+label+' '+times+'"><span class="slotline"><b>'+label+'</b><span>'+times+'</span></span>'+(row.block?'':'<small>정리 완료 '+clock(row.finish)+'</small>')+'</button>'
    }
    group=[]; lanes=[]
  }
  for (const row of rows) {
    if (group.length && Math.max(...lanes)<=row.start) flush()
    let lane=lanes.findIndex(finish=>finish<=row.start)
    if (lane<0) lane=lanes.length
    row.lane=lane; lanes[lane]=row.finish; group.push(row)
  }
  flush()
  return '<div class="lane '+(room==='큰관'?'large':'small')+'">'+html+'</div>'
}
const fmtNum=n=>String(n).padStart(2,'0')
function render() {
  document.querySelectorAll('nav a').forEach(a=>a.setAttribute('aria-current',a.hash===(audience()?'#audience':'#desk')?'page':'false'))
  if (audience()) {
    root.innerHTML='<section class="heading"><div><h1>관객 시간표</h1><p>작은 영화제의 하루 · '+Object.keys(state.live).length+'편 상영</p></div><span class="stamp">발행 '+state.version+'판</span></section><section class="public">'+Object.entries(state.live).sort(order).map(([id,a])=>'<article><time>'+clock(a.start)+'<small> — '+clock(end(id,a))+'</small></time><h2>'+films[id].title+'</h2><b>'+a.room+'</b></article>').join('')+(!Object.keys(state.live).length?'<p>편성된 작품이 없습니다.</p>':'')+'</section>'
    return
  }
  const errors=issues(state), pending=changes(state.live,state.draft), pool=Object.keys(films).filter(id=>!state.draft[id])
  root.innerHTML='<section class="heading"><div><h1>하루 편성표</h1><p>13:00 — 18:00 <span>／</span> 상영관 2곳 <span>／</span> 전체 작품 8편</p></div><div class="actions">'+button('history','발행 기록','quiet')+button('review','발행 검토 →','primary')+'</div></section>'+
    '<div class="workspace"><section class="timeline"><div class="sectionhead"><h2>상영 타임라인</h2><span class="stamp">편성 초안</span></div>'+
    '<div class="roomheads"><span></span>'+Object.entries(rooms).map(([r,n])=>'<div><i class="dot '+(r==='큰관'?'navy':'gold')+'"></i>'+r+' <small>'+n+'석</small></div>').join('')+'</div>'+
    '<div class="tracks"><div class="axis">'+[13,14,15,16,17,18].map((h,i)=>'<span style="top:'+i*20+'%">'+h+':00</span>').join('')+'</div>'+board('큰관')+board('작은관')+'</div>'+
    '<div class="legend"><span class="legendMark"></span> 상영 및 GV <span class="legendMark clean"></span> 정리 10분</div></section>'+
    '<aside><section class="card"><div class="sectionhead"><h2>미편성 작품</h2><strong>'+fmtNum(pool.length)+'</strong></div>'+pool.map(id=>button('edit','<span><b>'+films[id].title+'</b><small>영화 '+films[id].film+'분 · GV '+films[id].gv+'분 · '+films[id].people+'명</small></span><i>＋</i>','filmrow',id)).join('')+(pool.length?'':'<p>모든 작품을 편성했습니다.</p>')+'</section>'+
    '<section class="card"><div class="sectionhead"><h2>상영관 사용 중단</h2>'+button('block','＋ 등록','textbtn')+'</div>'+state.blocks.map(b=>button('block',b.room+' · '+clock(b.start)+'–'+clock(b.end),'blockrow',b.id)).join('')+(!state.blocks.length?'<p>등록된 중단 구간이 없습니다.</p>':'')+'</section>'+
    '<section class="card check"><div class="sectionhead"><h2>편성 점검</h2></div><b class="'+(errors.length?'warn':'ok')+'">'+(errors.length?'편성 문제 '+errors.length+'건':'✓ 발행 가능한 편성')+'</b>'+errors.map(e=>button('edit',e.message+' ›','issue',e.id)).join('')+'<p>발행본 대비 작품 변경 '+pending.length+'건</p></section></aside></div>'+
    '<footer><span>현재 발행본 · '+state.version+'판</span>'+button('reset','초기 데이터 복원','textbtn')+'</footer>'
}
function editFilm(id) {
  const film=films[id], assignment=state.draft[id]
  openPanel(film.title,'<p>영화 '+film.film+'분 · GV '+film.gv+'분 · 예상 '+film.people+'명</p><form>'+roomSelect(assignment?.room || (film.people>40?'큰관':'작은관'))+timeInput('start','시작 시각',assignment?.start??780)+'<div class="preview"></div><div class="formactions">'+(assignment?button('remove','미편성으로 이동','quiet',id):'')+'<button class="primary">초안 저장</button></div></form>')
  const form=contents.querySelector('form')
  function candidate() {
    const next=structuredClone(state)
    next.draft[id]={room:form.elements.room.value,start:minutes(form.elements.start.value)}
    return next
  }
  function preview() {
    if (!form.elements.start.value) return
    const next=candidate(), a=next.draft[id]
    const messages=issues(next).filter(e=>e.id===id || e.message.includes(film.title+' 편성과'))
    form.querySelector('.preview').textContent='상영 종료 '+clock(end(id,a))+' · 정리 완료 '+clock(end(id,a)+10)+(messages.length?'\n'+messages.map(e=>e.message).join('\n'):'')
  }
  form.oninput=preview; preview()
  form.onsubmit=e=>{e.preventDefault();save(candidate(),'초안을 저장했습니다.')}
}
function editBlock(id) {
  const b=state.blocks.find(x=>x.id===id)
  openPanel('사용 중단 '+(b?'편집':'등록'),'<form>'+roomSelect(b?.room)+timeInput('start','중단 시작',b?.start??780)+timeInput('end','중단 종료',b?.end??810)+'<div class="formactions">'+(b?button('unblock','구간 삭제','quiet',id):'')+'<button class="primary">구간 저장</button></div></form>')
  const form=contents.querySelector('form')
  form.oninput=()=>form.elements.end.setCustomValidity('')
  form.onsubmit=e=>{
    e.preventDefault()
    const start=minutes(form.elements.start.value), end=minutes(form.elements.end.value)
    if (start<780 || end>1080 || start>=end) {
      form.elements.end.setCustomValidity('운영 시간 안에서 시작보다 늦은 종료 시각을 입력하세요.')
      form.reportValidity(); return
    }
    const next=structuredClone(state)
    next.blocks=next.blocks.filter(x=>x.id!==id)
    next.blocks.push({id:id||crypto.randomUUID(),room:form.elements.room.value,start,end})
    save(next,'중단 구간을 저장했습니다.')
  }
}
function review(history) {
  const rows=history?changes(state.previous||state.live,state.live):changes(state.live,state.draft)
  const errors=history?[]:issues(state)
  openPanel(history?'발행 기록 · '+state.version+'판':'발행 검토','<p>'+(history?'직전 발행본과 비교한 결과입니다.':'현재 발행본과 초안을 비교합니다.')+'</p>'+
    rows.map(r=>'<div class="diff"><strong>'+films[r.id].title+' · '+r.kind+'</strong><small>이전　'+r.before+'</small><small>새 일정　'+r.after+'</small></div>').join('')+
    (rows.length?'':'<p>변경된 작품이 없습니다.</p>')+errors.map(e=>button('edit',e.message+' ›','issue',e.id)).join('')+
    (history?button('download','스태프 변경 안내 내려받기','primary'):'<button class="primary" data-action="publish" '+(errors.length||!rows.length?'disabled':'')+'>관객 시간표 발행</button>'))
}
function action(name,id) {
  const next=structuredClone(state)
  switch(name) {
    case 'edit': return editFilm(id)
    case 'block': return editBlock(id)
    case 'review': return review(false)
    case 'history': return review(true)
    case 'remove': delete next.draft[id]; return save(next,'미편성 목록으로 이동했습니다.')
    case 'unblock': next.blocks=next.blocks.filter(b=>b.id!==id); return save(next,'중단 구간을 삭제했습니다.')
    case 'publish': publish(next); return save(next,'관객 시간표를 발행했습니다.')
    case 'reset': return openPanel('초기 데이터를 복원할까요?','<p>작성한 초안과 발행 기록을 지우고 최초 6편의 시간표로 돌아갑니다.</p><div class="formactions">'+button('cancel','취소','quiet')+button('restore','초기 데이터 복원','primary')+'</div>')
    case 'cancel': return dialog.close()
    case 'restore': return save(initial(),'초기 데이터를 복원했습니다.')
    case 'download': {
      const lines=changes(state.previous||state.live,state.live).map(r=>films[r.id].title+' ['+r.kind+']\r\n  이전: '+r.before+'\r\n  새 일정: '+r.after)
      const blob=new Blob(['\uFEFF작은 영화제의 하루 · '+state.version+'판 스태프 변경 안내\r\n\r\n'+(lines.join('\r\n\r\n')||'변경된 작품이 없습니다.')],{type:'text/plain;charset=utf-8'})
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='작은영화제-'+state.version+'판-변경안내.txt'; a.click()
      setTimeout(()=>URL.revokeObjectURL(a.href),2000)
    }
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]'); if(b) action(b.dataset.action,b.dataset.id)})
document.querySelector('#close').onclick=()=>dialog.close()
window.addEventListener('hashchange',()=>{dialog.close(); render()})
window.addEventListener('storage',e=>{if(e.key===key){state=read(); dialog.close(); render()}})
render()
