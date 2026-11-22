import test from 'node:test'
import assert from 'node:assert/strict'
import { initial, issues, publish, changes, loadSchedule, restorePrevious, blocksDiffer } from './schedule.mjs'

test('초기 편성과 분 경계', () => {
  const s = initial()
  assert.equal(Object.keys(s.live).length, 6)
  assert.deepEqual(issues(s), [])
  s.draft.boat = { room: '작은관', start: 980 }
  assert.deepEqual(issues(s), [])
  s.draft.boat.start--
  assert.match(issues(s)[0].message, /봄 편지/)
  s.draft.boat.start = 1025
  assert.deepEqual(issues(s), [])
  s.draft.boat.start++
  assert.match(issues(s)[0].message, /운영/)
})

test('좌석, 운영 시작, 관별 상영 및 정리 중단', () => {
  const s = initial()
  s.draft.north = { room: '작은관', start: 779 }
  assert.ok(issues(s).length >= 2)
  delete s.draft.north
  s.blocks.push({ id: 'block', room: '작은관', start: 1025, end: 1035 })
  s.draft.boat = { room: '작은관', start: 980 }
  assert.match(issues(s)[0].message, /중단/)
  assert.throws(() => publish(s))
  s.draft.boat.room = '큰관'
  s.draft.boat.start = 990
  assert.deepEqual(issues(s), [])
})

test('발행 스냅샷과 추가·이동·해제 비교', () => {
  const s = initial()
  s.draft.boat = { room: '작은관', start: 980 }
  publish(s)
  assert.equal(changes(s.previous, s.live)[0].kind, '추가')
  s.draft.boat.start += 10
  assert.equal(s.live.boat.start, 980)
  assert.equal(changes(s.live, s.draft)[0].kind, '변경')
  delete s.draft.boat
  publish(s)
  assert.equal(changes(s.previous, s.live)[0].kind, '해제')
})

test('직전 판의 작품과 중단 구간을 독립된 초안으로 복구한다', () => {
  const s=initial()
  assert.throws(()=>restorePrevious(s))
  s.blocks.push({id:'a',room:'작은관',start:1000,end:1010})
  s.draft.north={room:'큰관',start:995}
  publish(s)
  const target=structuredClone({draft:s.live,blocks:s.liveBlocks})
  delete s.draft.north
  s.blocks[0].end=1020
  publish(s)
  const audience=structuredClone(s.live)
  restorePrevious(s)
  assert.deepEqual({draft:s.draft,blocks:s.blocks},target)
  assert.deepEqual(s.live,audience)
  assert.equal(s.version,3)
  s.blocks[0].start++
  s.draft.north.start++
  restorePrevious(s)
  assert.deepEqual({draft:s.draft,blocks:s.blocks},target)
  publish(s)
  assert.equal(s.version,4)
  assert.deepEqual(s.live,target.draft)
  assert.deepEqual(s.liveBlocks,target.blocks)
})

test('구형 저장 자료는 보존하고 과거에 기록되지 않은 중단 정보는 구분한다', () => {
  const old=initial()
  delete old.liveBlocks
  delete old.previousBlocks
  old.blocks.push({id:'b',room:'작은관',start:1000,end:1020})
  old.previous=structuredClone(old.live)
  old.version=3
  const s=loadSchedule(structuredClone(old))
  assert.deepEqual(s.blocks,old.blocks)
  assert.deepEqual(s.previous,old.previous)
  assert.equal(s.liveBlocks,null)
  assert.throws(()=>restorePrevious(s))
  publish(s)
  assert.throws(()=>restorePrevious(s))
  s.blocks=[]
  publish(s)
  restorePrevious(s)
  assert.deepEqual(s.blocks,old.blocks)
  assert.ok(blocksDiffer(s.blocks,s.liveBlocks))
  const second=loadSchedule({...old,version:2})
  restorePrevious(second)
  assert.deepEqual(second.blocks,[])
})
