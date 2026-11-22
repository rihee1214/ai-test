import test from 'node:test'
import assert from 'node:assert/strict'
import {initial, problems, changes, publish, restorePrevious, publicationChanges, loadState} from './model.mjs'
test('GV·정리 경계와 좌석, 운영 시간, 중단 구간', () => {
  const s=initial()
  assert.equal(problems(s).flat().length,0)
  s.draft[6]=[0,840]
  assert.match(problems(s)[6].join(),/긴 오후/)
  s.draft[6]=[1,1000]
  assert.equal(problems(s).flat().length,0)
  s.blocks.push([1,1054,1060])
  assert.match(problems(s)[6].join(),/중단/)
  s.blocks[0][1]=1055
  assert.equal(problems(s).flat().length,0)
  s.draft[7]=[1,1040]
  assert.match(problems(s)[7].join(),/좌석/)
  assert.match(problems(s)[7].join(),/운영/)
  assert.throws(()=>publish(s))
})
test('발행본 독립성과 추가·변경·해제 기록',()=>{
  const s=initial()
  s.draft[0]=null
  s.draft[6]=[1,1000]
  s.draft[5][1]=935
  assert.equal(s.live[5][1],930)
  assert.equal(changes(s.live,s.draft).length,3)
  publish(s)
  assert.equal(s.notice.length,3)
  s.draft[5][1]=930
  assert.equal(s.live[5][1],935)
})
test('직전 발행본을 초안으로 열고 확인 후 재발행',()=>{
  let s=initial()
  s.draft[6]=[1,1000]
  s.blocks=[[0,1030,1060]]
  publish(s)
  const expected=structuredClone(s)
  s.draft[6]=null
  s.blocks=[[1,1000,1020]]
  publish(s)
  const before=structuredClone(s)
  s=loadState(JSON.stringify(s))
  restorePrevious(s)
  assert.deepEqual(s,{...before,draft:expected.live,blocks:expected.liveBlocks})
  s.blocks[0][1]++
  assert.deepEqual(s.previous.blocks,expected.liveBlocks)
  restorePrevious(s)
  publish(s)
  assert.equal(s.version,4)
  assert.deepEqual(s.live,expected.live)
  assert.deepEqual(s.liveBlocks,expected.liveBlocks)
  restorePrevious(s)
  assert.deepEqual(s.blocks,before.blocks)
  assert.deepEqual(s.draft,before.live)
})
test('중단 구간만 변경한 발행과 이전 형식 저장 데이터',()=>{
  const old=initial()
  delete old.liveBlocks
  delete old.previous
  old.blocks=[[0,1050,1080]]
  const s=loadState(JSON.stringify(old))
  assert.deepEqual(s.liveBlocks,[])
  assert.ok(publicationChanges(s).length)
  publish(s)
  restorePrevious(s)
  assert.deepEqual(s.blocks,[])
  old.version=3
  const legacy=loadState(JSON.stringify(old))
  assert.deepEqual(legacy.draft,old.draft)
  assert.deepEqual(legacy.blocks,old.blocks)
  assert.throws(()=>restorePrevious(legacy))
  publish(legacy)
  assert.equal(legacy.previous,null)
  legacy.blocks=[]
  publish(legacy)
  restorePrevious(legacy)
  assert.deepEqual(legacy.blocks,old.blocks)
})
