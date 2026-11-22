export const OPEN = 13 * 60;
export const CLOSE = 18 * 60;
export const CLEANUP = 10;
export const ROOMS = [
  { id: "large", name: "큰관", seats: 80 },
  { id: "small", name: "작은관", seats: 40 },
];
export const FILMS = [
  { id: "first-train", title: "첫차", run: 40, gv: 10, people: 65 },
  { id: "ripple", title: "잔물결", run: 35, gv: 0, people: 30 },
  { id: "long-afternoon", title: "긴 오후", run: 50, gv: 10, people: 70 },
  { id: "window", title: "창문", run: 35, gv: 5, people: 36 },
  { id: "five-steps", title: "다섯 걸음", run: 40, gv: 0, people: 55 },
  { id: "spring-letter", title: "봄 편지", run: 30, gv: 10, people: 25 },
  { id: "paper-boat", title: "종이배", run: 35, gv: 10, people: 35 },
  { id: "north-road", title: "북쪽 길", run: 45, gv: 0, people: 60 },
];
export const filmById = new Map(FILMS.map((film) => [film.id, film]));
export const roomById = new Map(ROOMS.map((room) => [room.id, room]));

export function initialState() {
  const draft = {
    "first-train": { room: "large", start: OPEN },
    ripple: { room: "small", start: OPEN },
    "long-afternoon": { room: "large", start: 850 },
    window: { room: "small", start: 850 },
    "five-steps": { room: "large", start: 940 },
    "spring-letter": { room: "small", start: 930 },
  };
  return {
    schema: 2, edition: 1, draft, closures: [], publishedClosures: [], previousClosures: null,
    published: structuredClone(draft), previousPublished: null,
  };
}

export function clock(minutes) {
  return [Math.floor(minutes / 60), minutes % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
}

export function parseClock(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function showEnd(film, start) {
  return start + film.run + film.gv;
}

export function timeRange(start, end) {
  return clock(start) + "–" + clock(end);
}

export function describeSlot(film, slot) {
  if (!slot) return "미편성";
  return roomById.get(slot.room).name + " " + timeRange(slot.start, showEnd(film, slot.start));
}

export function sameSlot(left, right) {
  return left?.room === right?.room && left?.start === right?.start;
}

export function roomShows(schedule, room) {
  return FILMS.filter((film) => schedule[film.id]?.room === room)
    .map((film) => {
      const start = schedule[film.id].start;
      const end = showEnd(film, start);
      return { film, start, end, clear: end + CLEANUP };
    })
    .sort((a, b) => a.start - b.start);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function issuesFor(schedule, closures) {
  const issues = [];
  for (const room of ROOMS) {
    const shows = roomShows(schedule, room.id);
    for (const [index, { film, start, end, clear }] of shows.entries()) {
      const add = (code, label, detail) => issues.push({ code, label, detail, filmIds: [film.id] });
      if (film.people > room.seats) {
        add("capacity", "좌석 부족", `${room.name} ${room.seats}석에 예상 관객이 ${film.people}명입니다.`);
      }
      if (start < OPEN || clear > CLOSE) {
        add("hours", "운영 시간 초과",
          `${room.name}에서 ${clock(start)} 시작, ${clock(clear)} 정리 종료입니다. 운영 시간은 ${timeRange(OPEN, CLOSE)}입니다.`);
      }
      for (const block of closures) {
        if (room.id !== block.room || !overlaps(start, clear, block.start, block.end)) continue;
        const activity = overlaps(start, end, block.start, block.end) ? "상영" : "정리";
        const span = activity === "상영" ? timeRange(start, end) : timeRange(end, clear);
        add("closure", "사용 중단과 겹침",
          `${room.name} 사용 중단 ${timeRange(block.start, block.end)}에 ${activity} 시간 ${span}이 겹칩니다.`);
      }
      for (const next of shows.slice(index + 1)) {
        if (next.start >= clear) break;
        issues.push({
          code: "overlap", label: "작품 간 시간 겹침", filmIds: [film.id, next.film.id],
          detail: `${room.name}에서 ‘${film.title}’ 정리가 ${clock(clear)}에 끝나고 ‘${next.film.title}’이 ${clock(next.start)}에 시작합니다.`,
        });
      }
    }
  }
  return issues;
}

export function suggestSlot(film, schedule, closures) {
  const suitable = ROOMS.filter((room) => room.seats >= film.people).sort((a, b) => a.seats - b.seats);
  const length = film.run + film.gv + CLEANUP;
  for (const room of suitable) {
    const busy = [
      ...roomShows(schedule, room.id).map((show) => ({ start: show.start, end: show.clear })),
      ...closures.filter((block) => block.room === room.id),
    ].sort((a, b) => a.start - b.start);
    let start = OPEN;
    for (const block of busy) {
      if (start + length <= block.start) break;
      start = Math.max(start, block.end);
    }
    if (start + length <= CLOSE) return { room: room.id, start };
  }
  return { room: suitable[0].id, start: OPEN };
}

export function changesBetween(before, after) {
  const changes = [];
  for (const film of FILMS) {
    const oldSlot = before[film.id];
    const newSlot = after[film.id];
    if (sameSlot(oldSlot, newSlot)) continue;
    let kind = "이동";
    if (!oldSlot) kind = "추가";
    if (!newSlot) kind = "편성 해제";
    changes.push({ film, kind, before: oldSlot, after: newSlot });
  }
  return changes;
}

export class ScheduleError extends Error {}

function closureKeys(blocks) {
  return blocks.map((b) => [b.room, b.start, b.end].join("/")).sort().join("|");
}

export function closuresChanged(state) {
  return state.publishedClosures === null || closureKeys(state.closures) !== closureKeys(state.publishedClosures);
}

export function restorePrevious(state) {
  if (!state.previousPublished || state.previousClosures === null) {
    throw new ScheduleError("직전 발행 당시의 전체 기록이 없습니다.");
  }
  state.draft = structuredClone(state.previousPublished);
  state.closures = structuredClone(state.previousClosures);
}

export function publishDraft(state) {
  if (issuesFor(state.draft, state.closures).length) {
    throw new ScheduleError("편성 문제를 고친 뒤 발행해 주세요.");
  }
  if (!changesBetween(state.published, state.draft).length && !closuresChanged(state)) {
    throw new ScheduleError("현재 발행본과 편성이 같습니다.");
  }
  state.previousPublished = structuredClone(state.published);
  state.previousClosures = structuredClone(state.publishedClosures);
  state.publishedClosures = structuredClone(state.closures);
  state.published = structuredClone(state.draft);
  state.edition += 1;
}

export function staffNotice(state) {
  const lines = ["작은 영화제의 하루", "스태프 변경 안내 · 발행본 " + state.edition];
  if (state.previousPublished) {
    lines.push(`발행본 ${state.edition - 1} → 발행본 ${state.edition}`);
    for (const change of changesBetween(state.previousPublished, state.published)) {
      lines.push("", `[${change.kind}] ${change.film.title}`,
        "이전 일정  " + describeSlot(change.film, change.before),
        "새 일정    " + describeSlot(change.film, change.after));
    }
  }
  return lines.join("\r\n") + "\r\n";
}

const dayMinute = (value) => Number.isInteger(value) && value >= 0 && value < 1440;
function validSchedule(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([id, slot]) => filmById.has(id) && slot &&
      roomById.has(slot.room) && dayMinute(slot.start));
}

function validBlocks(blocks) {
  return Array.isArray(blocks) && blocks.every((block) => block &&
    roomById.has(block.room) && dayMinute(block.start) && dayMinute(block.end) && block.start < block.end);
}

export function decodeState(raw) {
  const data = JSON.parse(raw);
  if (data?.schema === 1) {
    // Only the initial edition has a reconstructible closure history.
    data.publishedClosures = data.edition === 1 ? [] : null;
    data.previousClosures = data.edition === 2 ? [] : null;
    data.schema = 2;
  }
  if (data?.schema !== 2 || !Number.isSafeInteger(data.edition) || data.edition < 1 ||
      !validSchedule(data.draft) || !validSchedule(data.published) ||
      !(data.edition === 1 ? data.previousPublished === null : validSchedule(data.previousPublished)) ||
      !validBlocks(data.closures) ||
      !(data.publishedClosures === null || validBlocks(data.publishedClosures)) ||
      !(data.previousClosures === null || validBlocks(data.previousClosures))) {
    throw new Error("저장된 편성 데이터 형식을 확인할 수 없습니다.");
  }
  return data;
}
