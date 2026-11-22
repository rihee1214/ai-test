import {
  CLEANUP, CLOSE, FILMS, OPEN, ROOMS, changesBetween, clock, describeSlot, filmById,
  issuesFor, roomById, roomShows, timeRange,
} from "./schedule.mjs";

export const icon = (name) => `<span class="icon i-${name}" aria-hidden="true"></span>`;
export const poster = (film) => `<span class="poster p-${film.id}" aria-hidden="true"><i></i></span>`;

function filmLinks(ids) {
  return ids.map((id) =>
    `<button class="film-link" data-action="edit" data-film="${id}">${filmById.get(id).title} 편집 ${icon("arrow")}</button>`
  ).join("");
}

export function issueList(issues, editable = true) {
  return `<ul class="issue-list">${issues.map((issue) => `
    <li><strong>${issue.label}</strong><p>${issue.detail}</p>
    ${editable ? `<div class="film-links">${filmLinks(issue.filmIds)}</div>` : ""}</li>`).join("")}</ul>`;
}

function timeAxis() {
  const ticks = [];
  for (let t = OPEN; t <= CLOSE; t += 30) {
    ticks.push(`<span class="tick ${t % 60 ? "half" : ""}" style="left:${percent(t)}%">${clock(t)}</span>`);
  }
  return `<div class="axis"><div class="axis-label">상영관</div>
    <div class="ticks">${ticks.join("")}</div></div>`;
}

function percent(time) {
  return (time - OPEN) * 100 / (CLOSE - OPEN);
}

function roomLane(room, draft, closures, troubledFilms) {
  const trackEnds = [];
  const cards = [];
  for (const { film, start, end, clear } of roomShows(draft, room.id)) {
    if (clear <= OPEN || start >= CLOSE) continue;
    let track = trackEnds.findIndex((lastEnd) => lastEnd <= start);
    if (track === -1) track = trackEnds.length;
    trackEnds[track] = clear;
    const from = Math.max(OPEN, start);
    const to = Math.min(CLOSE, clear);
    const screenWidth = Math.max(0, Math.min(end, to) - from) * 100 / (to - from);
    const slotLabel = `${film.title}, ${room.name} ${timeRange(start, end)}, 정리 종료 ${clock(clear)}`;
    const problem = troubledFilms.has(film.id);
    cards.push(`<button class="slot ${problem ? "problem-slot" : ""}"
      data-action="edit" data-film="${film.id}" aria-label="${slotLabel} 편집${problem ? ", 편성 문제 있음" : ""}"
      title="${slotLabel}" style="left:${percent(from)}%;width:${percent(to) - percent(from)}%;--track:${track}">
      <span class="show-part" style="width:${screenWidth}%">
        <strong>${film.title}</strong><span class="slot-time">${timeRange(start, end)}</span>
      </span><span class="cleanup-part"></span></button>`);
  }
  const bands = closures.filter((block) => block.room === room.id && block.end > OPEN && block.start < CLOSE)
    .map((block) => {
      const left = percent(Math.max(OPEN, block.start));
      const width = percent(Math.min(CLOSE, block.end)) - left;
      return `<span class="block-band" style="left:${left}%;width:${width}%" title="사용 중단 ${timeRange(block.start, block.end)}"></span>`;
    });
  return `<div class="hall-row" data-hall="${room.id}">
    <div class="hall-name"><strong><i class="hall-dot"></i>${room.name}</strong><small>${room.seats}석</small></div>
    <div class="plot" style="--tracks:${Math.max(1, trackEnds.length)}">${bands.join("")}${cards.join("")}</div>
  </div>`;
}

function timeline(state, issues) {
  const troubledFilms = new Set(issues.flatMap((issue) => issue.filmIds));
  const closureCount = state.closures.length;
  return `<section class="panel timeline" aria-labelledby="timeline-title">
    <div class="panel-heading"><h2 id="timeline-title">상영 타임라인</h2>
      <button class="button small" data-action="closures">${icon("block")}사용 중단 관리${closureCount ? ` <b>${closureCount}</b>` : ""}</button>
    </div>
    <div class="timeline-scroll"><div class="timeline-grid">
      ${timeAxis()}
      ${ROOMS.map((room) => roomLane(room, state.draft, state.closures, troubledFilms)).join("")}
    </div></div>
    <div class="timeline-key"><div class="legend">
      <span><i class="screen-key"></i>상영 · GV</span><span><i class="cleanup-key"></i>정리 ${CLEANUP}분</span>
      <span><i class="block-key"></i>사용 중단</span></div><span class="hint">작품을 선택해 편집</span>
    </div>${closureCount ? `<div class="blocked-times"><strong>중단 구간</strong>
      ${[...state.closures].sort((a, b) => a.start - b.start).map((block) =>
        `<button data-action="closures">${roomById.get(block.room).name} <span class="digits">${timeRange(block.start, block.end)}</span></button>`
      ).join("")}</div>` : ""}</section>`;
}

function library(state) {
  const waiting = FILMS.filter((film) => !state.draft[film.id]);
  return `<section class="panel library" aria-labelledby="library-title">
    <div class="panel-heading"><h2 id="library-title">미편성 작품 <span class="count">${waiting.length}</span></h2></div>
    ${waiting.length ? `<div class="film-shelf">${waiting.map((film) => `
      <button class="film-card" data-action="edit" data-film="${film.id}" aria-label="${film.title} 편성하기">
        ${poster(film)}<span class="film-info"><strong>${film.title}</strong>
        <span>영화 ${film.run}분 · GV ${film.gv}분</span><span>예상 ${film.people}명</span></span>
        <span class="add-film">${icon("plus")}</span>
      </button>`).join("")}</div>` : `<p class="empty">전체 ${FILMS.length}편을 모두 편성했습니다.</p>`}
    </section>`;
}

function checkPanel(state, issues, changeCount) {
  return `<section class="panel check-panel" aria-labelledby="check-title">
    <div class="panel-heading"><h2 id="check-title">편성 점검</h2>
      <span class="check-count ${issues.length ? "has-issues" : ""}">${issues.length ? "문제 " + issues.length + "건" : "문제 없음"}</span></div>
    ${issues.length ? issueList(issues) : `<div class="check-pass">
      <span class="check-emblem">${icon("check")}</span><div><strong>운영 규칙을 충족합니다</strong>
      <p>좌석 · 운영 시간 · 일정 겹침 점검 완료</p></div></div>`}
    <div class="edition-line"><span>발행본 ${state.edition}</span>
      ${changeCount ? `<button class="text-button" data-action="review">미발행 변경 ${changeCount}건 ${icon("arrow")}</button>`
        : "<span>초안과 동일</span>"}</div></section>`;
}

function pageHeading(title, badge, size, actions = "") {
  return `<div class="page-heading"><div><div class="title-line"><h1>${title}</h1><span class="badge">${badge}</span></div>
    <div class="page-meta"><span>${icon("clock")}<span class="digits">${timeRange(OPEN, CLOSE)}</span></span>
      <i></i><span>상영관 ${ROOMS.length}곳</span><i></i><span>${size}</span></div></div>${actions}</div>`;
}

export function plannerPage(state) {
  const issues = issuesFor(state.draft, state.closures);
  const changes = changesBetween(state.published, state.draft);
  const actions = `<div class="page-actions">
    <button class="button" data-action="notice">${icon("note")}발행 변경 안내</button>
    <button class="button primary" data-action="review">발행 검토 ${icon("arrow")}</button></div>`;
  return pageHeading("상영 편성표", "초안", `전체 ${FILMS.length}편 중 ${Object.keys(state.draft).length}편 편성`, actions) +
    timeline(state, issues) + `<div class="lower-grid">${library(state)}${checkPanel(state, issues, changes.length)}</div>
    <footer class="page-footer"><button class="quiet-button" data-action="reset">${icon("reset")}초기 데이터 복원</button></footer>`;
}

export function audiencePage(state) {
  return pageHeading("관객 시간표", "발행본 " + state.edition, "상영작 " + Object.keys(state.published).length + "편") +
    `<div class="programs">${ROOMS.map((room) => {
      const shows = roomShows(state.published, room.id);
      return `<section class="program panel" data-hall="${room.id}">
        <div class="program-heading"><h2><i class="hall-dot"></i>${room.name}</h2><span>${shows.length}편 상영</span></div>
        ${shows.length ? `<ol>${shows.map(({ film, start, end }) => `<li>
          <span class="program-time"><b>${clock(start)}</b><span>${clock(end)} 종료</span></span>
          ${poster(film)}<strong>${film.title}</strong>
          ${film.gv ? `<span class="gv-label">GV ${film.gv}분 포함</span>` : ""}
        </li>`).join("")}</ol>` : '<p class="empty">발행된 상영 일정이 없습니다.</p>'}</section>`;
    }).join("")}</div>`;
}

export function dialogHead(title, closeLabel = "닫기") {
  return `<header class="dialog-head"><h2 id="dialog-title" tabindex="-1">${title}</h2>
    <button type="button" class="icon-button" data-action="close" aria-label="${closeLabel}">${icon("close")}</button></header>`;
}

export function roomPicker(selected) {
  return `<fieldset class="room-picker"><legend>상영관</legend><div>${ROOMS.map((room) => `
    <label data-hall="${room.id}"><input type="radio" name="room" value="${room.id}" ${selected === room.id ? "checked" : ""}>
      <span><strong>${room.name}</strong><small>${room.seats}석</small></span></label>`).join("")}</div></fieldset>`;
}

export function editDialog(film, slot, assigned) {
  return `${dialogHead("작품 편성")}<form id="edit-form" class="drawer-form"><div class="dialog-body">
    <div class="selected-film">${poster(film)}<div><h3>${film.title}</h3>
    <p>영화 ${film.run}분 · GV ${film.gv}분</p><p>예상 관객 ${film.people}명</p></div></div>
    ${roomPicker(slot.room)}
    <label class="field">시작 시각<input type="time" name="start" step="60" required value="${clock(slot.start)}"></label>
    <div class="end-times" aria-live="polite">
      <div><span>상영 종료</span><output id="show-end">—</output></div>
      <div><span>정리 종료 <small>+${CLEANUP}분</small></span><output id="clear-end">—</output></div></div>
    <div id="edit-feedback" aria-live="polite"></div>
    <p class="dialog-error" role="alert" hidden></p>
    </div><footer class="dialog-foot">
      ${assigned ? '<button type="button" class="quiet-button remove" data-action="unassign">편성 해제</button>' : ""}
      <button type="button" class="button" data-action="close">취소</button>
      <button type="submit" class="button primary">초안에 저장</button></footer></form>`;
}

export function closureList(state) {
  if (!state.closures.length) return '<p class="empty compact">등록된 사용 중단 구간이 없습니다.</p>';
  return `<ul class="closures">${[...state.closures].sort((a, b) => a.start - b.start).map((block) => {
    const affected = roomShows(state.draft, block.room)
      .filter((show) => show.start < block.end && block.start < show.clear).map((show) => show.film.title);
    return `<li><div><strong>${roomById.get(block.room).name}</strong> <span class="digits">${timeRange(block.start, block.end)}</span>
      ${affected.length ? `<small>겹치는 작품 · ${affected.join(", ")}</small>` : ""}</div>
      <button class="button small" data-action="remove-block" data-room="${block.room}" data-start="${block.start}" data-end="${block.end}" aria-label="${roomById.get(block.room).name} ${timeRange(block.start, block.end)} 중단 해제">해제</button></li>`;
  }).join("")}</ul>`;
}

export function closuresDialog(state) {
  return `${dialogHead("상영관 사용 중단")}<div class="dialog-body">
    <p class="intro">중단 구간에는 상영과 정리를 진행할 수 없습니다.</p>
    <form id="closure-form">${roomPicker("large")}<div class="field-pair">
      <label class="field">중단 시작<input type="time" name="start" required step="60" value="13:00"></label>
      <label class="field">중단 종료<input type="time" name="end" required step="60" value="13:30"></label></div>
      <p class="dialog-error" role="alert" hidden></p>
      <button type="submit" class="button primary">${icon("plus")}구간 등록</button>
    </form><section class="registered-blocks"><h3>등록된 구간</h3><div id="closure-list">${closureList(state)}</div></section>
    <p class="form-status" id="closure-status" role="status"></p></div>`;
}

function changeCards(changes) {
  return `<ul class="changes">${changes.map((change) => `<li>
    <div class="change-title"><strong>${change.film.title}</strong><span>${change.kind}</span></div>
    <dl><dt>이전 일정</dt><dd>${describeSlot(change.film, change.before)}</dd>
    <dt>새 일정</dt><dd>${describeSlot(change.film, change.after)}</dd></dl></li>`).join("")}</ul>`;
}

export function reviewDialog(state) {
  const issues = issuesFor(state.draft, state.closures);
  const changes = changesBetween(state.published, state.draft);
  return `${dialogHead("발행 검토")}<div class="dialog-body">
    <p class="intro">발행본 ${state.edition}과 비교한 초안의 변경 내용입니다.</p>
    ${issues.length ? `<h3 class="error-title">발행 전 고칠 문제 ${issues.length}건</h3>${issueList(issues)}` : ""}
    <h3>변경된 작품 <span class="count">${changes.length}</span></h3>
    ${changes.length ? changeCards(changes) : '<p class="empty compact">현재 발행본과 편성이 같습니다.</p>'}
    <p class="dialog-error" role="alert" hidden></p></div>
    <footer class="dialog-foot"><button class="button" data-action="close">닫기</button>
    <button class="button primary" data-action="publish" ${issues.length || !changes.length ? "disabled" : ""}>관객 시간표 발행 ${icon("arrow")}</button></footer>`;
}

export function noticeDialog(state, justPublished = false) {
  const changes = state.previousPublished ? changesBetween(state.previousPublished, state.published) : [];
  return `${dialogHead("발행 변경 안내")}<div class="dialog-body">
    ${justPublished ? `<p class="published-message" role="status">${icon("check")}발행본 ${state.edition}을 관객 시간표에 반영했습니다.</p>` : ""}
    ${state.previousPublished ? `<div class="notice-summary"><b>발행본 ${state.edition - 1} → 발행본 ${state.edition}</b>
      <span>변경 ${changes.length}건</span></div>${changeCards(changes)}`
      : '<p class="empty compact">첫 발행본입니다. 다음 발행부터 변경된 작품의 이전 일정과 새 일정이 표시됩니다.</p>'}
    </div><footer class="dialog-foot"><button class="button" data-action="close">닫기</button>
    ${changes.length ? `<button class="button primary" data-action="download">${icon("download")}변경 안내 내려받기 (.txt)</button>` : ""}</footer>`;
}

export function resetDialog() {
  return `${dialogHead("초기 데이터 복원")}<div class="dialog-body"><p class="intro">
    초안과 관객 시간표를 최초 여섯 편의 편성으로 되돌립니다. 등록한 사용 중단 구간과 발행 변경 안내도 지워집니다.</p>
    <p class="dialog-error" role="alert" hidden></p></div><footer class="dialog-foot">
    <button class="button" data-action="close">취소</button><button class="button danger" data-action="confirm-reset">초기 상태로 복원</button></footer>`;
}
