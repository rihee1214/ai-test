export const films=[
  ['첫차',40,10,65],['잔물결',35,0,30],['긴 오후',50,10,70],['창문',35,5,36],
  ['다섯 걸음',40,0,55],['봄 편지',30,10,25],['종이배',35,10,35],['북쪽 길',45,0,60]
]
export const rooms=['큰관','작은관']
export const end=(id,start)=>start+films[id][1]+films[id][2]
export const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
export function initial(){
  const draft=[[0,780],[1,780],[0,850],[1,850],[0,940],[1,930],null,null]
  return {draft,live:structuredClone(draft),blocks:[],notice:[],version:1}
}
export function problems(s){
  return s.draft.map((slot,id)=>{
    const errors=[]
    if(!slot)return errors
    const [room,start]=slot, finish=end(id,start)+10
    if(films[id][3]>[80,40][room])errors.push('예상 인원이 좌석 수를 초과합니다.')
    if(start<780||finish>1080)errors.push('상영과 정리가 운영 시간을 벗어납니다.')
    s.draft.forEach((other,j)=>{
      if(other&&j!==id&&room===other[0]&&start<end(j,other[1])+10&&other[1]<finish)
        errors.push(films[j][0]+' 상영·정리 시간과 겹칩니다.')
    })
    if(s.blocks.some(([r,a,b])=>r===room&&start<b&&a<finish))errors.push('사용 중단 구간과 겹칩니다.')
    return errors
  })
}
export function describe(id,slot){
  return slot?rooms[slot[0]]+' '+time(slot[1])+'–'+time(end(id,slot[1])):'미편성'
}
export function changes(before,after){
  return films.flatMap(([name],i)=>JSON.stringify(before[i])===JSON.stringify(after[i])?[]:
    [name+'  |  '+describe(i,before[i])+' → '+describe(i,after[i])])
}
export function publish(s){
  if(problems(s).flat().length)throw Error('편성 문제를 먼저 해결해 주세요.')
  s.notice=changes(s.live,s.draft)
  s.live=structuredClone(s.draft)
  s.version++
}
