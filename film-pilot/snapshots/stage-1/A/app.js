const films=[['첫차',40,10,65],['잔물결',35,0,30],['긴 오후',50,10,70],['창문',35,5,36],['다섯 걸음',40,0,55],['봄 편지',30,10,25],['종이배',35,10,35],['북쪽 길',45,0,60]]
const rooms=['큰관','작은관'], seats=[80,40], key='film-day-v1'
const initial=[[0,780],[1,780],[0,850],[1,850],[0,940],[1,930],null,null]
const fresh=()=>structuredClone({draft:initial,published:structuredClone(initial),previous:null,blocks:[],version:1})
let state=JSON.parse(localStorage.getItem(key))||fresh(), tab=0, message=''
const $=id=>document.getElementById(id)
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
const mins=s=>Number(s.slice(0,2))*60+Number(s.slice(3))
const end=(i,start)=>start+films[i][1]+films[i][2]
const overlap=(a,b,c,d)=>a<d&&c<b
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const diff=(a,b)=>films.map((_,i)=>i).filter(i=>!same(a[i],b[i]))
const schedule=(i,slot)=>slot?rooms[slot[0]]+' '+time(slot[1])+'–'+time(end(i,slot[1])):'미편성'
function problems(){
 const list=[]
 state.draft.forEach((slot,i)=>{
  if(!slot)return
  const [r,s]=slot,e=end(i,s)+10,name=films[i][0]
  if(s<780||e>1080)list.push(name+' · 상영과 정리를 13:00–18:00 안에 배치하세요.')
  if(films[i][3]>seats[r])list.push(name+' · 예상 '+films[i][3]+'명이 '+rooms[r]+' '+seats[r]+'석을 초과합니다.')
  state.blocks.forEach(([room,a,b])=>{if(room===r&&overlap(s,e,a,b))list.push(name+' · '+rooms[r]+' 중단 '+time(a)+'–'+time(b)+'과 겹칩니다.')})
  state.draft.slice(0,i).forEach((other,j)=>{if(other&&other[0]===r&&overlap(s,e,other[1],end(j,other[1])+10))list.push(films[j][0]+' / '+name+' · '+rooms[r]+' 상영 또는 정리가 겹칩니다.')})
 })
 return list
}
const button=(text,action,cls='',disabled=false)=>'<button class="'+cls+'" data-act="'+action+'" '+(disabled?'disabled':'')+'>'+text+'</button>'
function board(data,editing){
 return '<div class="rooms">'+rooms.map((room,r)=>'<section class="room"><div class="roomhead"><span class="num">0'+(r+1)+'</span>'+room+'<span class="count">'+seats[r]+'석</span></div>'+data.map((slot,i)=>({slot,i})).filter(x=>x.slot&&x.slot[0]===r).sort((a,b)=>a.slot[1]-b.slot[1]).map(({slot:[,s],i})=>{
 const tag=editing?'button':'article'
 return '<'+tag+' class="card" '+(editing?'data-act="film'+i+'"':'')+'><span class="time">'+time(s)+' — '+time(end(i,s))+'</span>'+(editing?'<span class="edit">✎</span>':'')+'<strong>'+films[i][0]+'</strong>'+(editing?'<span class="meta">영화 '+films[i][1]+'분 · GV '+films[i][2]+'분　|　정리 ~'+time(end(i,s)+10)+'</span>':'')+'</'+tag+'>'
 }).join('')+'</section>').join('')+'</div>'
}
function changes(a,b){return diff(a,b).map(i=>films[i][0]+'　'+schedule(i,a[i])+' → '+schedule(i,b[i])).join('\n')}
function render(){
 const tabs=['편성 보드','관객 시간표','변경 안내']
 $('nav').innerHTML=tabs.map((t,i)=>button(t,'tab'+i,i===tab?'active':'')).join('')
 $('title').textContent=tabs[tab]
 $('subtitle').textContent=['두 상영관의 일정을 조율하고 시간표를 발행하세요.','현재 발행된 상영 일정을 확인하세요.','발행 전후의 변경 사항을 확인하고 현장 스태프에게 전달하세요.'][tab]
 const {draft,published,previous,version,blocks}=state,issues=problems(),pending=diff(draft,published)
 const head=(en,title)=>'<div><small>'+en+'</small><h2>'+title+'</h2></div>'
 let html=''
 if(tab===0){
 html='<div class="grid"><section class="panel"><div class="head">'+head('PROGRAM BOARD','상영관별 편성')+button('시간표 발행 ↗','publish','primary',!!issues.length||!pending.length)+'</div><p class="muted">13:00 — 18:00　 ·　 '+draft.filter(Boolean).length+'편 편성　 ·　 초안 변경 '+pending.length+'건</p>'+board(draft,true)+'</section><aside class="side"><section class="panel">'+head('FILM POOL','미편성 작품　'+draft.filter(x=>!x).length)+films.map(([n,m,g,p],i)=>draft[i]?'':'<div class="row film"><div><strong>'+n+'</strong><span class="meta">'+(m+g)+'분 · 예상 '+p+'명</span></div>'+button('＋','film'+i,'plus')+'</div>').join('')+'</section><section class="panel">'+head('CHECKLIST','운영 점검')+(issues.length?issues.map(x=>'<p class="status bad">'+x+'</p>').join(''):'<p class="status">✓　모든 편성이 운영 기준을 충족합니다.</p>')+'</section><section class="panel"><div class="head">'+head('RESTRICTIONS','상영관 사용 중단')+button('＋','block','plus')+'</div>'+(blocks.length?blocks.map(([r,a,b],i)=>'<div class="line">'+rooms[r]+' '+time(a)+'–'+time(b)+' '+button('삭제','del'+i)+'</div>').join(''):'<p class="muted">등록된 중단 구간이 없습니다.</p>')+'</section></aside></div>'
 }else if(tab===1)html='<section class="panel wide">'+head('PUBLISHED PROGRAM','상영 시간표 · 제'+version+'판')+board(published,false)+'</section>'
 else{
 const report=previous?changes(previous,published):''
 html='<section class="panel wide"><div class="head">'+head('STAFF BULLETIN','제'+version+'판 발행 변경 안내')+'<div class="actions">'+button('복사','copy','',!report)+button('텍스트 저장','download','primary',!report)+'</div></div><pre>'+ (report||'첫 발행본입니다.')+'</pre></section><section class="panel wide">'+head('DRAFT PREVIEW','현재 초안의 변경 사항')+'<pre>'+(changes(published,draft)||'현재 발행본과 같습니다.')+'</pre></section>'
 }
 $('content').innerHTML=html+(message?'<div class="notice" role="status">'+message+'</div>':'')
}
function save(msg){localStorage.setItem(key,JSON.stringify(state));message=msg;render()}
const modal=$('dialog')
function form(title,body,commit,extra=''){
 modal.innerHTML='<form><h2>'+title+'</h2>'+body+'<div class="actions"><button class="primary">저장</button><button type="button" data-act="cancel">취소</button>'+extra+'</div></form>'
 modal.querySelector('form').onsubmit=e=>{e.preventDefault();commit(new FormData(e.target))}
 modal.showModal()
}
const roomField=r=>'<label>상영관<select name="room">'+rooms.map((n,i)=>'<option value="'+i+'" '+(r===i?'selected':'')+'>'+n+' · '+seats[i]+'석</option>').join('')+'</select></label>'
const field=(name,label,t)=>'<label>'+label+'<input name="'+name+'" type="time" required value="'+time(t)+'"></label>'
function edit(i){
 const [n,m,g,p]=films[i],[r,s]=state.draft[i]||[p<=40?1:0,990]
 form(n,'<p class="muted">영화 '+m+'분 · GV '+g+'분 · 예상 '+p+'명</p>'+roomField(r)+field('start','시작 시각',s),data=>{state.draft[i]=[+data.get('room'),mins(data.get('start'))];modal.close();save('초안을 저장했습니다.')},state.draft[i]?'<button type="button" data-act="remove'+i+'">편성 해제</button>':'')
}
document.addEventListener('click',async e=>{
 const action=e.target.closest('[data-act]')?.dataset.act
 if(!action)return
 message=''
 const i=Number(action.match(/\d+$/)?.[0])
 if(action.startsWith('tab')){tab=i;render()}
 else if(action.startsWith('film'))edit(i)
 else if(action.startsWith('remove')){state.draft[i]=null;modal.close();save('편성을 해제했습니다.')}
 else if(action==='cancel')modal.close()
 else if(action==='block')form('상영관 사용 중단',roomField(0)+field('start','중단 시작',780)+field('end','중단 종료',810),data=>{
 const a=mins(data.get('start')),b=mins(data.get('end'))
 if(a>=b||a<780||b>1080){alert('13:00–18:00 안에서 종료가 시작보다 늦도록 입력하세요.');return}
 state.blocks.push([+data.get('room'),a,b]);modal.close();save('중단 구간을 등록했습니다.')})
 else if(action.startsWith('del')){state.blocks.splice(i,1);save('중단 구간을 삭제했습니다.')}
 else if(action==='publish'&&!problems().length){state.previous=state.published;state.published=structuredClone(state.draft);state.version++;save('제'+state.version+'판 시간표를 발행했습니다.')}
 else if(action==='copy'||action==='download'){
 const report='작은 영화제의 하루 · 제'+state.version+'판 변경 안내\n'+changes(state.previous,state.published)
 if(action==='copy'){try{await navigator.clipboard.writeText(report);message='변경 안내를 복사했습니다.'}catch{message='클립보드 접근이 제한되었습니다. 텍스트 저장을 이용하세요.'}render()}
 else{const url=URL.createObjectURL(new Blob(['\uFEFF',report],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='영화제-변경안내-'+state.version+'판.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
})
$('reset').onclick=()=>{if(confirm('초안과 발행 이력을 지우고 첫 방문 상태로 복원할까요?')){state=fresh();tab=0;save('초기 데이터를 복원했습니다.')}}
render()

window.addEventListener('storage',event=>{
 if(event.key!==key)return
 state=event.newValue?JSON.parse(event.newValue):fresh()
 if(modal.open)modal.close()
 message='다른 탭에서 저장한 변경 사항을 반영했습니다.'
 render()
})
