import test from 'node:test'
import assert from 'node:assert/strict'
import {initial,issues,changes,loadFestival,publishDraft,restoreDraft,canRestore,hasDraftChanges,blockChanges} from './model.mjs'

test('초기 편성과 초안 분리',()=>{
 const d=initial()
 assert.equal(d.live.filter(Boolean).length,6)
 assert.deepEqual(d.live,d.draft)
 assert.deepEqual(issues(d.draft,[]),[])
 d.draft[0].start++
 assert.equal(d.live[0].start,780)
})

test('좌석, 운영 시간, 정리 경계',()=>{
 const d=initial().draft
 d[7]={room:'작은관',start:1025}
 assert.match(issues(d,[]).join(),/초과/)
 d[7].room='큰관'
 assert.deepEqual(issues(d,[]),[])
 d[7].start++
 assert.match(issues(d,[]).join(),/18:00/)
 d[0].start=779
 assert.match(issues(d,[]).join(),/첫차/)
})

test('정리 충돌과 변경 안내',()=>{
 const s=initial(),b=[{room:'작은관',start:1030,stop:1050}]
 s.draft[6]={room:'작은관',start:980}
 assert.deepEqual(issues(s.draft,[]),[])
 s.draft[6].start--
 assert.match(issues(s.draft,[]).join(),/봄 편지/)
 s.draft[6].start++
 assert.equal(changes(s.live,s.draft)[0].type,'추가')
 const old=structuredClone(s.draft)
 assert.match(issues(s.draft,b).join(),/사용 중단/)
 s.draft[6]={room:'큰관',start:990}
 assert.deepEqual(issues(s.draft,b),[])
 assert.deepEqual(changes(old,s.draft),[{id:6,type:'이동',old:old[6],next:s.draft[6]}])
 s.draft[6]=null
 assert.equal(changes(old,s.draft)[0].type,'편성 취소')
})

const smallClosure={room:'작은관',start:1030,stop:1050,reason:'점검'}
const bigClosure={room:'큰관',start:1030,stop:1050,reason:'리허설'}

test('발행 스냅샷을 초안으로 복구하고 검토 후 재발행',()=>{
 let state=initial()
 assert.equal(canRestore(state),false)
 state.draft[0].start++
 state.blocks.push({...smallClosure})
 state=publishDraft(state)
 const second=structuredClone(state)
 state.draft[0].start++
 state.blocks=[{...bigClosure}]
 state=publishDraft(state)
 const third=structuredClone(state)
 state.blocks=[]
 state.draft[0]=null
 state=restoreDraft(state)
 assert.deepEqual(state.draft,second.live)
 assert.deepEqual(state.blocks,second.liveBlocks)
 assert.deepEqual(state.live,third.live)
 assert.deepEqual(state.liveBlocks,third.liveBlocks)
 assert.equal(state.version,3)
 state.blocks[0].reason='수정'
 assert.equal(state.previousBlocks[0].reason,'점검')
 state=restoreDraft(loadFestival(JSON.parse(JSON.stringify(state))))
 state=publishDraft(state)
 assert.deepEqual(state.live,second.live)
 assert.deepEqual(state.liveBlocks,second.liveBlocks)
 assert.deepEqual(state.previous,third.live)
 assert.deepEqual(state.previousBlocks,third.liveBlocks)
 assert.equal(state.version,4)
})

test('사용 중단만 변경된 발행과 복구, 충돌 검증',()=>{
 let state=initial()
 assert.equal(publishDraft(state),state)
 state.blocks=[{...smallClosure,start:780,stop:800}]
 assert.equal(publishDraft(state),state)
 state.blocks=[{...smallClosure}]
 state=publishDraft(state)
 assert.equal(state.version,2)
 state=restoreDraft(state)
 assert.equal(state.blocks.length,0)
 assert.equal(hasDraftChanges(state),true)
 state=publishDraft(state)
 assert.deepEqual(state.liveBlocks,[])
 assert.deepEqual(state.previousBlocks,[smallClosure])
 assert.deepEqual(blockChanges([bigClosure,smallClosure],[smallClosure,bigClosure]),{added:[],removed:[]})
})

test('구버전 업무 보존 및 누락된 중단 기록 처리',()=>{
 const legacy=initial()
 delete legacy.liveBlocks
 delete legacy.previousBlocks
 legacy.draft[0].start++
 legacy.blocks.push({...bigClosure})
 assert.deepEqual(loadFestival(legacy).liveBlocks,[])
 legacy.previous=structuredClone(legacy.live)
 legacy.version=2
 const second=loadFestival(legacy)
 assert.deepEqual(restoreDraft(second).blocks,[])
 legacy.version=6
 const loaded=loadFestival(legacy)
 for(const field of Object.keys(legacy))assert.deepEqual(loaded[field],legacy[field])
 assert.equal(canRestore(loaded),false)
 assert.equal(loaded.liveBlocks,null)
 let state=publishDraft(loaded)
 assert.equal(canRestore(state),false)
 state.blocks=[]
 state=publishDraft(state)
 assert.deepEqual(restoreDraft(state).blocks,[bigClosure])
})
