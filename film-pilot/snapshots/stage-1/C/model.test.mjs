import test from 'node:test'
import assert from 'node:assert/strict'
import {initial, problems, changes, publish} from './model.mjs'
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
