import {films,rooms,clock,end,initial,issues,changes,describe,loadFestival,blockChanges,hasDraftChanges,publishDraft,canRestore,restoreDraft} from './model.mjs'
const key='film-day.v1', app=document.querySelector('#app'), modal=document.querySelector('#modal'), content=document.querySelector('#content')
const read=()=>loadFestival(JSON.parse(localStorage.getItem(key)||'null'))
let data=read(), timer
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const timeValue=s=>s?Number(s.slice(0,2))*60+Number(s.slice(3,5)):NaN
const btn=(label,action,cls='')=>'<button class="'+cls+'" data-action="'+action+'">'+label+'</button>'
const filmButton=(id,html,cls,style='')=>'<button class="'+cls+'" data-film="'+id+'" style="'+style+'">'+html+'</button>'
const roomSelect=room=>'<label>상영관<select name="room">'+Object.keys(rooms).map(r=>'<option '+(room===r?'selected':'')+'>'+r+'</option>').join('')+'</select></label>'
const timeInput=(label,name,m)=>'<label>'+label+'<input type="time" required name="'+name+'" value="'+clock(m)+'"></label>'
function notify(text){const el=document.querySelector('#toast');el.textContent=text;clearTimeout(timer);timer=setTimeout(()=>el.textContent='',3000)}
function save(message){localStorage.setItem(key,JSON.stringify(data));modal.close();render();notify(message)}
function open(html){content.innerHTML=html;if(!modal.open)modal.showModal()}
function diff(from,to){
 const list=changes(from,to)
 return list.length?list.map(c=>'<div class="change"><b>'+films[c.id][0]+'</b><small>'+c.type+'</small><p>'+describe(c.id,c.old)+' → '+describe(c.id,c.next)+'</p></div>').join(''):'<p class="muted">변경된 작품이 없습니다.</p>'
}
function describeBlock(b){
 return b.room+' '+clock(b.start)+'–'+clock(b.stop)+(b.reason?' · '+b.reason:'')
}
function blockLines(before,after){
 if(after===null)return ['구버전 발행본에는 사용 중단 기록이 없습니다.']
 if(before===null){
  return ['이전 사용 중단 기록 없음 · 확인할 구간 '+after.length+'건',...after.map(describeBlock)]
 }
 const {added,removed}=blockChanges(before,after)
 return [...removed.map(b=>'[중단 해제] '+describeBlock(b)),...added.map(b=>'[중단 등록] '+describeBlock(b))]
}
function blockDiff(before,after){
 return blockLines(before,after).map(line=>'<p>'+esc(line)+'</p>').join('')
}
function recoveryControl(){
 if(!data.previous)return '<p>다음 발행부터 직전 발행본을 복구할 수 있습니다.</p>'
 if(!canRestore(data))return '<p>제 '+(data.version-1)+'판은 구버전에서 사용 중단 정보를 기록하지 않아 전체 복구가 불가능합니다.</p>'
 return btn('직전 발행본 복구','restore')
}
function timeline(room){
 const entries=data.draft.flatMap((s,i)=>s?.room===room?[{i,start:s.start,stop:end(i,s.start)+10}]:[])
 const breaks=data.blocks.filter(b=>b.room===room)
 const lanes=[]
 const cards=entries.sort((a,b)=>a.start-b.start).map(({i,start,stop})=>{
 let lane=lanes.findIndex(t=>t<=start);if(lane<0)lane=lanes.length;lanes[lane]=stop
 const style='left:'+Math.max(0,Math.min(98,(start-780)/3))+'%;width:'+Math.max(2,(Math.min(1080,stop)-Math.max(780,start))/3)+'%;top:'+(12+lane*72)+'px'
 return filmButton(i,'<span>'+clock(start)+' – '+clock(stop-10)+'</span><strong>'+films[i][0]+'</strong><i style="width:'+1000/(stop-start)+'%"></i>','card '+(room==='큰관'?'mint':'peach'),style)
 }).join('')
 return '<div class="row"><div class="room"><b>'+room+'</b><small>'+rooms[room]+'석</small></div><div class="track" style="height:'+Math.max(88,16+lanes.length*72)+'px">'+breaks.map(b=>'<div class="closure" title="'+esc(b.reason||'사용 중단')+'" style="left:'+(b.start-780)/3+'%;width:'+(b.stop-b.start)/3+'%"></div>').join('')+cards+'</div></div>'
}
function render(){
 const audience=location.hash==='#audience'
 document.querySelectorAll('nav a').forEach((a,i)=>a.classList.toggle('active',i===Number(audience)))
 const count=data.draft.filter(Boolean).length, errors=issues(data.draft,data.blocks)
 app.innerHTML='<div class="intro"><div><div class="eyebrow"><i></i> '+(audience?'AUDIENCE PROGRAM':'PROGRAMMING DESK')+'</div><h1>'+(audience?'관객 시간표':'하루 편성표')+'</h1><p>13:00 — 18:00 <em>/</em> 2개 상영관 <em>/</em> '+(audience?data.live.filter(Boolean).length+'편 상영':'전체 8개 작품')+'</p></div><div>'+(audience?'<span class="badge">발행본 '+data.version+'</span>':btn('변경 확인 및 발행 ↗','review','primary'))+'</div></div>'
 if(audience){app.innerHTML+='<div class="aud">'+Object.keys(rooms).map(r=>'<section class="panel"><h2>'+r+' <small>'+rooms[r]+'석</small></h2>'+data.live.map((s,i)=>({s,i})).filter(x=>x.s?.room===r).sort((a,b)=>a.s.start-b.s.start).map(({s,i})=>'<div class="show"><time>'+clock(s.start)+' – '+clock(end(i,s.start))+'</time><b>'+films[i][0]+'</b></div>').join('')+'</section>').join('')+'</div>';return}
 app.innerHTML+='<section class="board"><div class="boardhead"><h2>상영 타임라인 <small>초안</small></h2><div class="legend">▨ 정리 10분 '+btn('＋ 사용 중단','blocks')+'</div></div><div class="axis">'+[13,14,15,16,17,18].map(h=>'<span>'+h+':00</span>').join('')+'</div>'+Object.keys(rooms).map(timeline).join('')+'<div class="foot"><span class="'+(errors.length?'warn':'good')+'">● '+(errors.length?'편성 문제 '+errors.length+'건':'편성 가능')+'</span><span>편성 '+count+'편 · 미편성 '+(8-count)+'편</span></div></section>'
 if(errors.length)app.innerHTML+='<div class="errors">'+errors.map(e=>'<p>'+e+'</p>').join('')+'</div>'
 app.innerHTML+='<div class="lower"><section class="panel"><h2>미편성 작품 <small>'+(8-count)+'</small></h2>'+films.map(([name,m,g,n],i)=>data.draft[i]?'':filmButton(i,'<span class="filmicon">▤</span><span><strong>'+name+'</strong><small>영화 '+m+'분 · GV '+g+'분 · 예상 '+n+'명</small></span><b>＋</b>','pool')).join('')+(count===8?'<p>모든 작품이 편성되었습니다.</p>':'')+'</section><section class="panel publication"><div class="eyebrow">PUBLICATION</div><h2>발행 기록 <small>제 '+data.version+'판</small></h2><p>마지막 발행 이후 '+changes(data.live,data.draft).length+'개 작품 변경'+(data.liveBlocks===null?' · 중단 기록 확인 필요':blockLines(data.liveBlocks,data.blocks).length?' · 중단 구간 변경':'')+'</p>'+btn('스태프 변경 안내 →','staff')+' <a href="#audience" target="_blank" rel="noopener">관객 창 열기 ↗</a> '+recoveryControl()+'</section></div><footer>'+btn('초기 데이터 복원','reset')+'</footer>'
}
function edit(id){
 const [name,m,g,n]=films[id],s=data.draft[id]||{room:n>40?'큰관':'작은관',start:980}
 open('<div class="eyebrow">SCREENING</div><h2>'+name+'</h2><p>영화 '+m+'분 · GV '+g+'분 · 예상 '+n+'명</p><form id="edit"><div class="fields">'+roomSelect(s.room)+timeInput('시작 시각','start',s.start)+'</div><div id="preview"></div><div class="actions">'+(data.draft[id]?btn('미편성으로 이동','remove'):'')+'<button class="primary">초안 저장</button></div></form>')
 const f=content.querySelector('#edit')
 function candidate(){const draft=data.draft.slice();draft[id]={room:f.room.value,start:timeValue(f.start.value)};return draft}
 function preview(){const d=candidate(),s=d[id];content.querySelector('#preview').innerHTML=Number.isFinite(s.start)?'<p>'+rooms[s.room]+'석 · 상영 종료 '+clock(end(id,s.start))+' · 정리 종료 '+clock(end(id,s.start)+10)+'</p>'+issues(d,data.blocks).map(e=>'<p class="warn">'+e+'</p>').join(''):'<p>시작 시각을 입력하세요.</p>'}
 f.oninput=preview;preview()
 f.onsubmit=e=>{e.preventDefault();data.draft=candidate();save('초안을 저장했습니다.')}
 const remove=f.querySelector('[data-action=remove]');if(remove)remove.onclick=e=>{e.preventDefault();data.draft[id]=null;save('미편성으로 이동했습니다.')}
}
function blocks(){
 open('<div class="eyebrow">VENUE AVAILABILITY</div><h2>상영관 사용 중단</h2>'+data.blocks.map((b,i)=>'<p>'+b.room+' '+clock(b.start)+'–'+clock(b.stop)+' '+esc(b.reason)+' '+btn('해제','del-'+i)+'</p>').join('')+'<form id="block"><div class="fields">'+roomSelect('작은관')+timeInput('시작','start',1030)+timeInput('종료','stop',1050)+'</div><label>사유 (선택)<input name="reason" maxlength="100"></label><p id="error" class="warn"></p><button class="primary">중단 구간 등록</button></form>')
 const f=content.querySelector('#block');f.onsubmit=e=>{e.preventDefault();const start=timeValue(f.start.value),stop=timeValue(f.stop.value);if(start<780||stop>1080||start>=stop){content.querySelector('#error').textContent='13:00~18:00 안에서 종료를 시작보다 늦게 입력하세요.';return}data.blocks.push({room:f.room.value,start,stop,reason:f.reason.value.trim()});save('중단 구간을 등록했습니다.')}
}
function action(a){
 if(a==='blocks')blocks()
 if(a.startsWith('del-')){data.blocks.splice(Number(a.slice(4)),1);save('중단 구간을 해제했습니다.')}
 if(a==='restore'&&canRestore(data)){
  open('<h2>제 '+(data.version-1)+'판을 초안으로 열까요?</h2><p>현재 초안의 작품 배정과 중단 구간을 교체합니다. 관객은 발행할 때까지 제 '+data.version+'판을 봅니다.</p>'+
   diff(data.draft,data.previous)+'<h3>복구할 사용 중단 구간</h3>'+
   (data.previousBlocks.map(b=>'<p>'+esc(describeBlock(b))+'</p>').join('')||'<p>등록된 구간 없음</p>')+
   '<div class="actions">'+btn('취소','cancel')+btn('초안으로 복구','restore-confirm','primary')+'</div>')
 }
 if(a==='restore-confirm'&&canRestore(data)){data=restoreDraft(data);save('직전 발행본을 초안으로 복구했습니다.')}
 if(a==='review'){const errors=issues(data.draft,data.blocks);open('<div class="eyebrow">PUBLISH PREVIEW</div><h2>발행 전 변경 확인</h2>'+diff(data.live,data.draft)+blockDiff(data.liveBlocks,data.blocks)+errors.map(e=>'<p class="warn">'+e+'</p>').join('')+'<button class="primary" data-action="publish" '+(errors.length||!hasDraftChanges(data)?'disabled':'')+'>시간표 발행</button>')}
 if(a==='publish'){const next=publishDraft(data);if(next!==data){data=next;save('새 시간표를 발행했습니다.')}}
 if(a==='staff')open('<div class="eyebrow">STAFF NOTICE</div><h2>스태프 변경 안내</h2><p>발행본 '+data.version+'</p>'+(data.previous?diff(data.previous,data.live)+blockDiff(data.previousBlocks,data.liveBlocks)+btn('텍스트 내려받기','download','primary'):'<p>최초 발행본입니다. 다음 발행부터 변경 안내가 생깁니다.</p>'))
 if(a==='download'){const lines=changes(data.previous,data.live).map(c=>'['+c.type+'] '+films[c.id][0]+' | 이전 '+describe(c.id,c.old)+' → 새 일정 '+describe(c.id,c.next));lines.push(...blockLines(data.previousBlocks,data.liveBlocks));const url=URL.createObjectURL(new Blob(['\uFEFF작은 영화제의 하루 · 스태프 변경 안내 · 제 '+data.version+'판\r\n'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='영화제-변경안내-'+data.version+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 if(a==='reset')open('<h2>초기 데이터를 복원할까요?</h2><p>초안, 발행 기록, 중단 구간을 지우고 첫 방문의 여섯 편으로 돌아갑니다.</p><div class="actions">'+btn('취소','cancel')+btn('복원하기','confirm','primary')+'</div>')
 if(a==='cancel')modal.close()
 if(a==='confirm'){data=initial();save('초기 데이터를 복원했습니다.')}
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.film!==undefined)edit(Number(b.dataset.film));if(b.dataset.action)action(b.dataset.action)})
window.addEventListener('hashchange',()=>{modal.close();render()})
window.addEventListener('storage',e=>{if(e.key===key){data=read();modal.close();render()}})
render()
