import test from 'node:test'
import assert from 'node:assert/strict'
import { initial, issues, publish, changes } from './schedule.mjs'

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
