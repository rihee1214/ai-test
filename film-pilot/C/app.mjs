import {films,rooms,end,time,initial,problems,publicationChanges,publish,loadState,restorePrevious} from './model.mjs'
const key='little-film-festival-v1'
let s=loadState(localStorage.getItem(key)), audience=false
const main=document.querySelector('main'), dlg=document.querySelector('dialog')
const btn=(act,label,cls='')=>`<button class="${cls}" data-act="${act}">${label}</button>`
const tag=i=>String(i+1).padStart(2,'0')
function render(){
  document.querySelector('#status').textContent=''
  const slots=audience?s.live:s.draft, count=slots.filter(Boolean).length, errs=problems(s)
  document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('active',i===Number(audience)))
  const roomBoard=rooms.map((name,r)=>{
    const ids=films.map((_,i)=>i).filter(i=>slots[i]?.[0]===r).sort((a,b)=>slots[a][1]-slots[b][1])
    return `<section class="hall h${r}"><div class="hallhead"><div><small>SCREEN 0${r+1}</small><h2>${name} <span>${r?40:80}석</span></h2></div><b class="counter">${ids.length}편</b></div><div class="cards">${ids.map(i=>{
      const t=slots[i][1],err=!audience&&errs[i].length
      const elem=audience?'article':'button'
      return `<${elem} class="film ${err?'invalid':''}" ${audience?'':'data-act="edit-'+i+'"'}><span class="art a${i}"><i></i><small>F / ${tag(i)}</small></span><span class="info"><strong>${films[i][0]}</strong><b>${time(t)} – ${time(end(i,t))}</b>${audience?'':`<small>영화 ${films[i][1]}분 · GV ${films[i][2]}분</small><small>정리 종료 ${time(end(i,t)+10)}</small>`}</span>${audience?'':'<span class="arrow">↗</span>'}${err?`<em>${errs[i].join(' ')}</em>`:''}</${elem}>`
    }).join('')||'<p>편성된 작품이 없습니다.</p>'}</div></section>`
  }).join('')
  main.innerHTML=`<div class="hero"><div><small class="eyebrow"><i></i> FESTIVAL PROGRAM</small><h1>${audience?'관객 시간표':'상영 편성표'}</h1><p>운영 시간 <b>13:00 — 18:00</b><span> / </span>상영관 2개</p></div><div class="actions">${audience?`발행본 v${s.version}`:btn('recover','직전 발행본 복구')+btn('notice','변경 안내')+btn('review','시간표 발행 ↗','primary')}</div></div><div class="sectiontitle"><h2>${audience?'오늘의 상영':'상영관별 편성'}</h2><small>${audience?'발행본':'초안'} · ${count}편</small></div><div class="layout ${audience?'public':''}">${roomBoard}${audience?'':`<aside><section class="panel"><small class="eyebrow">FILM POOL</small><h2>미편성 작품 <span>${8-count}</span></h2>${films.map(([name,m,g,p],i)=>slots[i]?'':`<button class="pool" data-act="edit-${i}"><span><strong>${name}</strong><small>상영 ${m+g}분 · 예상 ${p}명</small></span><b>＋</b></button>`).join('')||'<p>모든 작품을 편성했습니다.</p>'}</section><section class="panel"><small class="eyebrow">OPERATIONS</small><h2>상영관 사용 중단</h2>${s.blocks.map(([r,a,b],i)=>`<p>${rooms[r]} ${time(a)}–${time(b)} ${btn('remove-'+i,'삭제')}</p>`).join('')||'<p>등록된 중단 구간이 없습니다.</p>'}${btn('block','＋ 중단 구간 등록','wide')}</section><div class="health ${errs.flat().length?'bad':''}"><b>${errs.flat().length?'!　편성 확인 필요':'✓　편성 가능'}</b><small>${errs.flat().length?'표시된 작품의 일정을 수정해 주세요.':'모든 상영이 운영 조건을 충족합니다.'}</small></div></aside>`}</div><footer>작은 영화제의 하루 <span>${audience?'관객용 시간표':btn('reset','초기 데이터 복원')}</span></footer>`
}
function save(){localStorage.setItem(key,JSON.stringify(s));render()}
function modal(title,body){
  dlg.innerHTML=`<div class="modalhead"><h2>${title}</h2>${btn('close','닫기')}</div>${body}`
  if(!dlg.open)dlg.showModal()
}
const roomSelect=r=>`<label>상영관<select name="room">${rooms.map((n,i)=>`<option value="${i}" ${i===r?'selected':''}>${n} · ${i?40:80}석</option>`).join('')}</select></label>`
const timeField=(title,name,t)=>`<label>${title}<input type="time" required name="${name}" value="${time(t)}"></label>`
const minutes=v=>v.split(':').reduce((h,m)=>Number(h)*60+Number(m),0)
function edit(i){
  const [r,t]=s.draft[i]||[films[i][3]>40?0:1,990]
  modal(films[i][0],`<p>영화 ${films[i][1]}분 · GV ${films[i][2]}분 · 예상 ${films[i][3]}명</p><form>${roomSelect(r)}${timeField('시작 시각','start',t)}<p id="hint"></p><div class="actions">${s.draft[i]?'<button type="button" data-act="unset-'+i+'">편성 해제</button>':''}<button class="primary">초안 저장</button></div></form>`)
  const f=dlg.querySelector('form')
  function proposed(){return [Number(f.room.value),minutes(f.start.value)]}
  f.oninput=()=>{
    const copy=structuredClone(s);copy.draft[i]=proposed()
    dlg.querySelector('#hint').textContent=f.start.value?'상영 종료 '+time(end(i,copy.draft[i][1]))+' · 정리 종료 '+time(end(i,copy.draft[i][1])+10)+' '+problems(copy)[i].join(' '):'시작 시각을 입력해 주세요.'
  }
  f.oninput()
  f.onsubmit=e=>{e.preventDefault();s.draft[i]=proposed();save();dlg.close()}
}
function block(){
  modal('중단 구간 등록',`<form>${roomSelect(0)}${timeField('중단 시작','start',840)}${timeField('중단 종료','finish',870)}<p id="hint"></p><button class="primary">구간 등록</button></form>`)
  const f=dlg.querySelector('form')
  f.onsubmit=e=>{e.preventDefault();const a=minutes(f.start.value),b=minutes(f.finish.value)
    if(a<780||b>1080||a>=b){dlg.querySelector('#hint').textContent='13:00~18:00 안에서 시작보다 늦은 종료 시각을 선택하세요.';return}
    s.blocks.push([Number(f.room.value),a,b]);save();dlg.close()
  }
}
const lines=items=>items.map(t=>'<p class="line">'+t+'</p>').join('')
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-act]')?.dataset.act
  if(!action)return
  const [a,n]=action.split('-'),i=Number(n)
  switch(a){
    case 'desk':case 'audience':audience=a==='audience';render();break
    case 'edit':edit(i);break
    case 'block':block();break
    case 'close':dlg.close();break
    case 'remove':s.blocks.splice(i,1);save();break
    case 'unset':s.draft[i]=null;save();dlg.close();break
    case 'recover':
      if(!s.previous){
        modal('직전 발행본 복구',s.version===1?'<p>첫 발행본입니다. 다음 발행부터 직전 일정을 복구할 수 있습니다.</p>':'<p>이전 형식에는 발행 당시의 중단 구간 기록이 없습니다. 새 형식으로 연속 두 번 발행하면 두 발행본 사이에서 복구할 수 있습니다.</p>')
        break
      }
      modal('직전 발행본 v'+s.previous.version+' 복구','<p>현재 초안의 작품 배정과 사용 중단 구간을 이 발행본의 내용으로 교체합니다. 관객 시간표에는 확인 후 발행할 때 반영됩니다.</p>'+btn('recoverDraft','초안으로 불러오기','primary'))
      break
    case 'recoverDraft':
      restorePrevious(s);save();dlg.close()
      document.querySelector('#status').textContent='직전 발행본을 초안으로 불러왔습니다.'
      break
    case 'review':{
      const diff=publicationChanges(s), invalid=problems(s).flat().length
      modal('시간표 발행',lines(diff)||'<p>발행본과 초안의 일정이 같습니다.</p>')
      dlg.insertAdjacentHTML('beforeend',invalid?'<p>편성 문제를 해결한 뒤 발행할 수 있습니다.</p>':diff.length?btn('publish','관객 시간표로 발행','primary'):'')
      break}
    case 'publish':publish(s);save();modal('발행 완료','<p>관객 시간표에 반영했습니다.</p>'+btn('notice','스태프 변경 안내'));break
    case 'notice':modal('스태프 변경 안내',`<p>발행본 v${s.version} · 이전 일정 → 새 일정</p>`+(s.notice.length?lines(s.notice)+btn('download','안내문 저장 (.txt)','primary'):'<p>첫 발행본입니다. 변경 내역이 없습니다.</p>'));break
    case 'download':{
      const url=URL.createObjectURL(new Blob(['\ufeff작은 영화제의 하루 · 스태프 변경 안내 v'+s.version+'\n이전 일정 → 새 일정\n'+s.notice.join('\n')],{type:'text/plain;charset=utf-8'}))
      const link=document.createElement('a');link.href=url;link.download='영화제-변경안내-v'+s.version+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);break}
    case 'reset':modal('초기 데이터 복원','<p>초안, 발행본, 변경 안내와 중단 구간을 초기 편성으로 되돌립니다.</p>'+btn('restore','초기 데이터로 복원','primary'));break
    case 'restore':s=initial();save();dlg.close();break
  }
})
window.addEventListener('storage',e=>{if(e.key===key){s=loadState(e.newValue);dlg.close();render()}})
render()
