export const films = [
 ['첫차',40,10,65],['잔물결',35,0,30],['긴 오후',50,10,70],['창문',35,5,36],
 ['다섯 걸음',40,0,55],['봄 편지',30,10,25],['종이배',35,10,35],['북쪽 길',45,0,60]
]
export const rooms = {큰관:80,작은관:40}
export const clock = m => [Math.floor(m/60),m%60].map(n=>String(n).padStart(2,'0')).join(':')
export const end = (id,start) => start+films[id][1]+films[id][2]
export function initial(){
 const live=[780,780,850,850,940,930,null,null].map((start,i)=>start===null?null:{room:i%2?'작은관':'큰관',start})
 return {draft:structuredClone(live),live,previous:null,blocks:[],liveBlocks:[],previousBlocks:null,version:1}
}

// The old format saved closures only for the working draft. Only edition 1
// has a known closure history (the festival starts with both rooms open).
export function loadFestival(saved){
 if(!saved)return initial()
 if(Object.hasOwn(saved,'liveBlocks'))return saved
 return {...saved,liveBlocks:saved.version===1?[]:null,previousBlocks:saved.version===2?[]:null}
}

export function blockChanges(before,after){
 const remaining=before.slice()
 const added=[]
 for(const block of after){
  const index=remaining.findIndex(b=>b.room===block.room && b.start===block.start &&
   b.stop===block.stop && b.reason===block.reason)
  if(index<0)added.push(block)
  else remaining.splice(index,1)
 }
 return {added,removed:remaining}
}

export function hasDraftChanges(state){
 if(changes(state.live,state.draft).length || state.liveBlocks===null)return true
 const {added,removed}=blockChanges(state.liveBlocks,state.blocks)
 return added.length+removed.length>0
}

export function publishDraft(state){
 if(!hasDraftChanges(state)||issues(state.draft,state.blocks).length)return state
 return {...state,version:state.version+1,previous:state.live,previousBlocks:state.liveBlocks,
  live:structuredClone(state.draft),liveBlocks:structuredClone(state.blocks)}
}

export function canRestore(state){
 return Array.isArray(state.previous) && Array.isArray(state.previousBlocks)
}

export function restoreDraft(state){
 if(!canRestore(state))return state
 return {...state,draft:structuredClone(state.previous),blocks:structuredClone(state.previousBlocks)}
}
export function issues(schedule,blocks){
 const errors=[]
 schedule.forEach((s,i)=>{
  if(!s)return
  const finish=end(i,s.start)+10, name=films[i][0]
  if(s.start<780||finish>1080)errors.push(name+' · 정리까지 13:00~18:00 안에 마쳐야 합니다.')
  if(films[i][3]>rooms[s.room])errors.push(name+' · 예상 '+films[i][3]+'명이 '+s.room+' '+rooms[s.room]+'석을 초과합니다.')
  schedule.slice(0,i).forEach((o,j)=>{
   if(o&&o.room===s.room&&s.start<end(j,o.start)+10&&o.start<finish)errors.push(name+' · '+films[j][0]+'의 상영 또는 정리 시간과 겹칩니다.')
  })
  blocks.forEach(b=>{if(b.room===s.room&&s.start<b.stop&&b.start<finish)errors.push(name+' · '+s.room+' 사용 중단 '+clock(b.start)+'–'+clock(b.stop)+'에 겹칩니다.')})
 })
 return errors
}
export function changes(before,after){
 return after.flatMap((s,i)=>s?.room===before[i]?.room&&s?.start===before[i]?.start?[]:[{id:i,type:!s?'편성 취소':before[i]?'이동':'추가',old:before[i],next:s}])
}
export const describe=(id,s)=>s?s.room+' '+clock(s.start)+'–'+clock(end(id,s.start)):'미편성'
