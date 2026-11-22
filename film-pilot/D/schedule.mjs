export const rooms = { 큰관: 80, 작은관: 40 }
export const films = Object.fromEntries([
  ['first','첫차',40,10,65], ['ripple','잔물결',35,0,30],
  ['long','긴 오후',50,10,70], ['window','창문',35,5,36],
  ['steps','다섯 걸음',40,0,55], ['spring','봄 편지',30,10,25],
  ['boat','종이배',35,10,35], ['north','북쪽 길',45,0,60]
].map(([id,title,film,gv,people]) => [id,{ title,film,gv,people }]))
export function initial() {
  const live = {}
  const starts = [780,780,850,850,940,930]
  Object.keys(films).slice(0,6).forEach((id,i) => {
    live[id] = {room: i % 2 ? '작은관' : '큰관', start: starts[i]}
  })
  return { draft: structuredClone(live), live, previous: null, blocks: [], liveBlocks: [], previousBlocks: null, version: 1 }
}
export function loadSchedule(saved) {
  if (!saved) return initial()
  // Only the first published edition is known to have had no closures.
  if (!Object.hasOwn(saved,'liveBlocks')) saved.liveBlocks = saved.version===1 ? [] : null
  if (!Object.hasOwn(saved,'previousBlocks')) saved.previousBlocks = saved.version===2 ? [] : null
  return saved
}
export function blocksDiffer(a,b) {
  if (a===null || b===null) return a!==b
  const signature = list => list.map(b=>[b.room,b.start,b.end].join('/')).sort().join('|')
  return signature(a)!==signature(b)
}
export function restorePrevious(s) {
  if (!s.previous || !Array.isArray(s.previousBlocks)) throw Error('복구 가능한 직전 발행 기록이 없습니다.')
  s.draft = structuredClone(s.previous)
  s.blocks = structuredClone(s.previousBlocks)
}
export const clock = n => [Math.floor(n/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')
export const end = (id,a) => a.start + films[id].film + films[id].gv
export const describe = (id,a) => a ? a.room+' '+clock(a.start)+'–'+clock(end(id,a)) : '미편성'
export function issues(s) {
  const result = []
  const rows = Object.entries(s.draft)
  for (const [i,[id,a]] of rows.entries()) {
    const f = films[id], finish = end(id,a)+10
    const add = message => result.push({id,message: f.title+' · '+a.room+' · '+message})
    if (rooms[a.room]<f.people) add('예상 '+f.people+'명이 좌석 '+rooms[a.room]+'석을 초과합니다.')
    if (a.start<780 || finish>1080) add(clock(a.start)+'–'+clock(finish)+' 편성이 운영 시간(13:00–18:00)을 벗어납니다.')
    for (const [other,b] of rows.slice(0,i)) {
      const from = Math.max(a.start,b.start), to = Math.min(finish,end(other,b)+10)
      if (a.room===b.room && from<to) add(films[other].title+' 편성과 '+clock(from)+'–'+clock(to)+' 겹칩니다.')
    }
    for (const b of s.blocks) {
      const from = Math.max(a.start,b.start), to = Math.min(finish,b.end)
      if (a.room===b.room && from<to) add(clock(from)+'–'+clock(to)+' 사용 중단과 겹칩니다.')
    }
  }
  return result
}
export function changes(before,after) {
  return Object.keys(films).filter(id=>describe(id,before[id])!==describe(id,after[id])).map(id=>({
    id, kind: !after[id] ? '해제' : before[id] ? '변경' : '추가',
    before: describe(id,before[id]), after: describe(id,after[id])
  }))
}
export function publish(s) {
  if (issues(s).length) throw Error('편성 문제를 먼저 해결해 주세요.')
  s.previous = s.live
  s.previousBlocks = s.liveBlocks
  s.liveBlocks = structuredClone(s.blocks)
  s.live = structuredClone(s.draft)
  s.version++
}
