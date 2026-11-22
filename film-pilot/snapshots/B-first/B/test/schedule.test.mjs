import test from "node:test";
import assert from "node:assert/strict";
import { restorePrevious } from "../public/schedule.mjs";
import {
  CLEANUP, FILMS, changesBetween, clock, decodeState, describeSlot, filmById, initialState,
  issuesFor, parseClock, publishDraft, showEnd, staffNotice, suggestSlot,
} from "../public/schedule.mjs";

const boat = filmById.get("paper-boat");
test("구버전 작업을 보존하고 중단 구간만 달라진 일정도 복구·재발행한다", () => {
  const legacy = initialState();
  legacy.schema = 1;
  legacy.edition = 4;
  legacy.previousPublished = structuredClone(legacy.published);
  delete legacy.previousPublished.ripple;
  delete legacy.draft.window;
  legacy.closures.push({ room: "small", start: 1040, end: 1050 });
  delete legacy.previousClosures;
  delete legacy.publishedClosures;
  const state = decodeState(JSON.stringify(legacy));
  for (const key of ["draft", "published", "previousPublished", "closures", "edition"]) {
    assert.deepEqual(state[key], legacy[key]);
  }
  assert.throws(() => restorePrevious(state));
  publishDraft(state);
  state.closures = [];
  publishDraft(state);
  const before = staffNotice(state);
  restorePrevious(state);
  assert.deepEqual(state.closures, legacy.closures);
  assert.deepEqual(state.publishedClosures, []);
  assert.equal(staffNotice(state), before);
  publishDraft(state);
  assert.deepEqual(state.publishedClosures, legacy.closures);
  const second = decodeState(JSON.stringify({ ...legacy, edition: 2 }));
  restorePrevious(second);
  assert.deepEqual(second.closures, []);
});
const road = filmById.get("north-road");
function slot(room, time) {
  return { room, start: parseClock(time) };
}

test("초기 여덟 작품, 두 미편성작, 독립된 첫 발행본", () => {
  const state = initialState();
  assert.deepEqual(FILMS.map((f) => [f.title, f.run, f.gv, f.people]), [
    ["첫차", 40, 10, 65], ["잔물결", 35, 0, 30], ["긴 오후", 50, 10, 70], ["창문", 35, 5, 36],
    ["다섯 걸음", 40, 0, 55], ["봄 편지", 30, 10, 25], ["종이배", 35, 10, 35], ["북쪽 길", 45, 0, 60],
  ]);
  assert.deepEqual(FILMS.map((f) => describeSlot(f, state.draft[f.id])), [
    "큰관 13:00–13:50", "작은관 13:00–13:35", "큰관 14:10–15:10", "작은관 14:10–14:50",
    "큰관 15:40–16:20", "작은관 15:30–16:10", "미편성", "미편성",
  ]);
  assert.deepEqual(state.published, state.draft);
  assert.deepEqual(state.closures, []);
  assert.deepEqual(issuesFor(state.draft, []), []);
  assert.equal(state.edition, 1);
  state.draft.ripple.start += 1;
  assert.equal(describeSlot(filmById.get("ripple"), state.published.ripple), "작은관 13:00–13:35");
});

test("분 단위 시작 입력, GV와 정리 경계", () => {
  for (const input of ["", "13:60", "24:00", "13:00:30"]) assert.equal(parseClock(input), null);
  const end = showEnd(boat, parseClock("16:20"));
  assert.equal(clock(end), "17:05");
  assert.equal(clock(end + CLEANUP), "17:15");
  for (const [start, valid] of [["12:59", false], ["13:00", true], ["17:05", true], ["17:06", false]]) {
    const issues = issuesFor({ [boat.id]: slot("small", start) }, []);
    assert.equal(!issues.length, valid, start);
    if (!valid) assert.equal(issues[0].code, "hours");
  }
});

test("예상 인원이 좌석을 넘으면 발행을 차단한다", () => {
  const state = initialState();
  state.draft[road.id] = slot("small", "16:20");
  const [issue] = issuesFor(state.draft, []);
  assert.equal(issue.code, "capacity");
  assert.match(issue.detail, /40석.*60명/);
  const before = structuredClone(state);
  assert.throws(() => publishDraft(state));
  assert.deepEqual(state, before);
  state.draft[road.id] = slot("large", "16:30");
  assert.deepEqual(issuesFor(state.draft, []), []);
});

test("같은 관의 정리와 1분 겹치면 충돌, 정리 종료 시각에 바로 시작할 수 있다", () => {
  const draft = { ...initialState().draft, [boat.id]: slot("small", "16:19") };
  assert.deepEqual(issuesFor(draft, []).map((i) => [i.code, i.filmIds]), [["overlap", ["spring-letter", boat.id]]]);
  draft[boat.id] = slot("small", "16:20");
  assert.deepEqual(issuesFor(draft, []), []);
  draft[boat.id] = slot("small", "15:30");
  assert.equal(issuesFor(draft, [])[0].code, "overlap");
});

test("사용 중단은 해당 관의 상영·GV·정리와 비교하고 맞닿은 끝점은 허용한다", () => {
  const draft = { [boat.id]: slot("small", "16:20") };
  for (const [start, end, expected] of [
    ["16:00", "16:20", []], ["16:19", "16:21", ["closure"]], ["16:55", "17:05", ["closure"]],
    ["17:05", "17:15", ["closure"]], ["17:14", "17:17", ["closure"]], ["17:15", "17:20", []],
  ]) {
    const block = { ...slot("small", start), end: parseClock(end) };
    assert.deepEqual(issuesFor(draft, [block]).map((i) => i.code), expected);
    assert.deepEqual(issuesFor(draft, [{ ...block, room: "large" }]), []);
  }
});

test("새 작품의 기본 배정은 좌석·정리·사용 중단을 반영한다", () => {
  const state = initialState();
  assert.deepEqual(suggestSlot(boat, state.draft, []), slot("small", "16:20"));
  assert.deepEqual(suggestSlot(road, state.draft, []), slot("large", "16:30"));
  const closure = { ...slot("small", "16:20"), end: parseClock("18:00") };
  assert.deepEqual(suggestSlot(boat, state.draft, [closure]), slot("large", "16:30"));
});

test("부분 발행, 중단 후 재편성, 다음 초안과 분리된 직전 발행 변경 안내", () => {
  const state = initialState();
  state.draft[boat.id] = slot("small", "16:20");
  assert.equal(state.published[boat.id], undefined);
  publishDraft(state);
  assert.equal(state.edition, 2);
  assert.equal(state.published[road.id], undefined);
  assert.match(staffNotice(state), /\[추가\] 종이배\r\n이전 일정  미편성/);
  state.closures.push({ ...slot("small", "17:05"), end: parseClock("17:15") });
  assert.throws(() => publishDraft(state));
  state.draft[boat.id] = slot("large", "17:10");
  assert.throws(() => publishDraft(state));
  state.draft[boat.id] = slot("large", "17:05");
  publishDraft(state);
  assert.equal(state.edition, 3);
  const notice = staffNotice(state);
  assert.match(notice, /\[이동\] 종이배\r\n이전 일정  작은관 16:20–17:05\r\n새 일정    큰관 17:05–17:50/);
  assert.doesNotMatch(notice, /첫차|17:15|18:00/);
  delete state.draft.ripple;
  assert.equal(staffNotice(state), notice);
  assert.deepEqual(decodeState(JSON.stringify(state)), state);
  publishDraft(state);
  assert.match(staffNotice(state), /\[편성 해제\] 잔물결\r\n이전 일정  작은관 13:00–13:35\r\n새 일정    미편성/);
  assert.throws(() => publishDraft(state));
});

test("같은 작품의 시간·관 수정과 해제·재편성은 최종 배정 하나로 비교한다", () => {
  const state = initialState();
  delete state.draft.window;
  state.draft.window = slot("small", "14:20");
  assert.deepEqual(changesBetween(state.published, state.draft).map((c) => c.kind), ["이동"]);
  state.draft.window = slot("large", "14:10");
  assert.deepEqual(changesBetween(state.published, state.draft).map((c) => c.kind), ["이동"]);
  state.draft.window = slot("small", "14:10");
  assert.deepEqual(changesBetween(state.published, state.draft), []);
});
