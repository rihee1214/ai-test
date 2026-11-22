import {
  CLEANUP, ScheduleError, clock, decodeState, filmById, initialState, issuesFor, parseClock,
  publishDraft, restorePrevious, roomById, sameSlot, showEnd, staffNotice, suggestSlot, timeRange,
} from "./schedule.mjs";
import {
  audiencePage, closureList, closuresDialog, editDialog, icon, issueList, noticeDialog,
  plannerPage, restoreDialog, resetDialog, reviewDialog,
} from "./views.mjs";

const STORAGE_KEY = "little-film-festival.v1";
const main = document.querySelector("#main");
const dialog = document.querySelector("#dialog");
const toast = document.querySelector("#toast");
let state;
let storageProblem = "";
let modal = null;
let restoreFocus = null;
let writing = false;
let toastTimer;

function readLatest() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? initialState() : decodeState(raw);
}

function withStorageLock(work) {
  return navigator.locks.request(STORAGE_KEY, work);
}

function renderPage() {
  const audience = location.hash === "#audience";
  document.title = "작은 영화제의 하루 · " + (audience ? "관객 시간표" : "편성실");
  document.querySelector("#nav-planner").setAttribute("aria-current", audience ? "false" : "page");
  document.querySelector("#nav-audience").setAttribute("aria-current", audience ? "page" : "false");
  const status = document.querySelector("#storage-status");
  status.textContent = storageProblem ? "저장 확인 필요" : "이 브라우저에 저장됨";
  status.classList.toggle("storage-warning", Boolean(storageProblem));
  const warning = storageProblem ? `<p class="storage-warning-box" role="alert">${storageProblem}</p>` : "";
  if (!state) {
    main.innerHTML = `<h1>저장된 편성 확인</h1>${warning}<button class="button" data-action="reset">초기 데이터 복원</button>`;
    return;
  }
  main.innerHTML = warning + (audience ? audiencePage(state) : plannerPage(state));
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3400);
}

function openDialog(type, markup, extra = {}) {
  toast.classList.remove("visible");
  if (!dialog.open) {
    const opener = document.activeElement?.closest("[data-action]");
    restoreFocus = opener ? { ...opener.dataset } : null;
  }
  modal = { type, ...extra };
  dialog.classList.toggle("drawer", type === "edit");
  dialog.innerHTML = markup;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector("#dialog-title").focus({ preventScroll: true });
}

dialog.addEventListener("close", () => {
  if (dialog.open) return;
  modal = null;
  if (restoreFocus && (document.activeElement === document.body || document.activeElement === dialog)) {
    const selector = `[data-action="${restoreFocus.action}"]` +
      (restoreFocus.film ? `[data-film="${restoreFocus.film}"]` : "");
    (main.querySelector(selector) ?? main).focus({ preventScroll: true });
  }
  restoreFocus = null;
});

function openEditor(id) {
  const film = filmById.get(id);
  const original = state.draft[id];
  const slot = original ?? suggestSlot(film, state.draft, state.closures);
  openDialog("edit", editDialog(film, slot, Boolean(original)), { film, original });
  updateEditor();
}

function editorSlot() {
  const form = dialog.querySelector("#edit-form");
  const start = parseClock(form.elements.start.value);
  return start === null ? null : { room: form.elements.room.value, start };
}

function updateEditor() {
  const { film, original } = modal;
  const slot = editorSlot();
  const end = slot ? showEnd(film, slot.start) : null;
  dialog.querySelector("#show-end").textContent = slot ? clock(end) : "—";
  dialog.querySelector("#clear-end").textContent = slot ? clock(end + CLEANUP) : "—";
  const stale = !sameSlot(original, state.draft[film.id]);
  dialog.querySelector('[type="submit"]').disabled = stale || !slot;
  const remove = dialog.querySelector('[data-action="unassign"]');
  if (remove) remove.disabled = stale;
  const feedback = dialog.querySelector("#edit-feedback");
  if (stale) {
    feedback.innerHTML = `<p class="dialog-error">다른 창에서 이 작품의 편성이 바뀌었습니다.</p>
      <button class="button small" data-action="edit" data-film="${film.id}">현재 편성 불러오기</button>`;
    return;
  }
  if (!slot) {
    feedback.textContent = "시작 시각을 입력해 주세요.";
    return;
  }
  const preview = { ...state.draft, [film.id]: slot };
  const issues = issuesFor(preview, state.closures).filter((issue) => issue.filmIds.includes(film.id));
  feedback.innerHTML = issues.length ? `<h3 class="error-title">편성 문제 ${issues.length}건</h3>
    ${issueList(issues, false)}<p class="muted">초안에 저장한 뒤 발행 전에 고칠 수 있습니다.</p>` :
    `<p class="inline-pass">${icon("check")}이 시간에 상영할 수 있습니다.</p>`;
}

function reviewToken(snapshot) {
  return JSON.stringify([snapshot.edition, snapshot.published, snapshot.draft, snapshot.closures]);
}

function openReview() {
  openDialog("review", reviewDialog(state), { token: reviewToken(state) });
}

function refreshDialog() {
  if (!dialog.open || !modal) return;
  if (!state && modal.type !== "reset") {
    dialog.close();
    return;
  }
  switch (modal.type) {
    case "edit": updateEditor(); break;
    case "closures": dialog.querySelector("#closure-list").innerHTML = closureList(state); break;
    case "review": openReview(); break;
    case "notice": openDialog("notice", noticeDialog(state)); break;
  }
}

function refreshFromStorage() {
  try {
    state = readLatest();
    storageProblem = "";
  } catch {
    state = null;
    storageProblem = "저장된 편성을 읽을 수 없습니다. 브라우저의 사이트 데이터 설정을 확인하거나 초기 데이터를 복원해 주세요.";
  }
  renderPage();
  refreshDialog();
}

function showFormError(message) {
  const error = dialog.querySelector(".dialog-error[role=alert]");
  if (dialog.open && error) {
    error.textContent = message;
    error.hidden = false;
  } else {
    notify(message);
  }
}

// Re-read inside the lock so edits in another tab survive this write.
async function commit(change, onSaved, reset = false) {
  if (writing) return;
  writing = true;
  try {
    await withStorageLock(() => {
      const next = reset ? initialState() : readLatest();
      change(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      state = next;
    });
  } catch (error) {
    if (error instanceof ScheduleError) {
      refreshFromStorage();
      showFormError(error.message);
    } else {
      storageProblem = "변경 내용을 저장하지 못했습니다. 브라우저의 저장 공간과 사이트 데이터 설정을 확인해 주세요.";
      renderPage();
      showFormError(storageProblem);
    }
    return;
  } finally {
    writing = false;
  }
  storageProblem = "";
  renderPage();
  onSaved();
}

function saveFilm(slot) {
  const { film, original } = modal;
  return commit((next) => {
    if (!sameSlot(next.draft[film.id], original)) {
      throw new ScheduleError("다른 창에서 이 작품의 편성이 바뀌었습니다. 현재 편성을 확인해 주세요.");
    }
    if (slot) next.draft[film.id] = slot;
    else delete next.draft[film.id];
  }, () => {
    dialog.close();
    notify(slot ? `‘${film.title}’ 편성을 초안에 저장했습니다.` : `‘${film.title}’을 미편성으로 옮겼습니다.`);
  });
}

function publish() {
  const token = modal.token;
  return commit((next) => {
    if (token !== reviewToken(next)) {
      throw new ScheduleError("검토 중 편성이 바뀌었습니다. 갱신된 변경 내용을 확인해 주세요.");
    }
    publishDraft(next);
  }, () => {
    openDialog("notice", noticeDialog(state, true));
  });
}

function downloadNotice() {
  const blob = new Blob(["\uFEFF", staffNotice(state)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `작은영화제-발행본${state.edition}-변경안내.txt`;
  dialog.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function sameBlock(a, b) {
  return a.room === b.room && a.start === b.start && a.end === b.end;
}

function saveBlock(block, removing) {
  return commit((next) => {
    if (removing) {
      next.closures = next.closures.filter((item) => !sameBlock(item, block));
    } else {
      if (next.closures.some((item) => sameBlock(item, block))) {
        throw new ScheduleError("같은 관에 동일한 사용 중단 구간이 이미 있습니다.");
      }
      next.closures.push(block);
    }
  }, () => {
    refreshDialog();
    dialog.querySelector(".dialog-error").hidden = true;
    dialog.querySelector("#closure-status").textContent =
      `${roomById.get(block.room).name} ${timeRange(block.start, block.end)} 사용 중단을 ${removing ? "해제" : "등록"}했습니다.`;
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const data = button.dataset;
  switch (data.action) {
    case "edit": openEditor(data.film); break;
    case "closures": openDialog("closures", closuresDialog(state)); break;
    case "review": openReview(); break;
    case "publish": publish(); break;
    case "notice": openDialog("notice", noticeDialog(state)); break;
    case "download": downloadNotice(); break;
    case "unassign": saveFilm(null); break;
    case "remove-block": saveBlock({ room: data.room, start: Number(data.start), end: Number(data.end) }, true); break;
    case "restore":
      openDialog("restore", restoreDialog(state), { token: JSON.stringify(state) });
      break;
    case "apply-restore": {
      const expected = modal.token;
      commit((next) => {
        if (JSON.stringify(next) !== expected) throw new ScheduleError("편성이 변경됐습니다. 닫은 뒤 복구할 발행본을 다시 확인해 주세요.");
        restorePrevious(next);
      }, () => {
        dialog.close();
        notify("직전 발행본을 초안으로 복구했습니다. 확인 후 발행해 주세요.");
      });
      break;
    }
    case "reset": openDialog("reset", resetDialog()); break;
    case "confirm-reset":
      commit(() => {}, () => {
        dialog.close();
        notify("초안과 발행본을 초기 데이터로 복원했습니다.");
      }, true);
      break;
    case "close": dialog.close(); break;
  }
});

dialog.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "edit-form") {
    const slot = editorSlot();
    if (slot) saveFilm(slot);
  }
  if (form.id === "closure-form") {
    const start = parseClock(form.elements.start.value);
    const end = parseClock(form.elements.end.value);
    if (start === null || end === null || end <= start) {
      showFormError("중단 종료 시각을 시작 시각보다 늦게 입력해 주세요.");
      return;
    }
    saveBlock({ room: form.elements.room.value, start, end }, false);
  }
});

dialog.addEventListener("input", () => {
  const error = dialog.querySelector(".dialog-error[role=alert]");
  if (error) error.hidden = true;
  if (modal?.type === "edit") updateEditor();
});

window.addEventListener("hashchange", () => {
  if (dialog.open) dialog.close();
  toast.classList.remove("visible");
  renderPage();
  window.scrollTo(0, 0);
});
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("storage", (event) => {
  if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null)) refreshFromStorage();
});

try {
  await withStorageLock(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw === null ? initialState() : decodeState(raw);
    if (raw === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
} catch {
  storageProblem = "저장된 편성을 확인할 수 없습니다. 브라우저의 사이트 데이터 설정을 확인하거나 초기 데이터를 복원해 주세요.";
}
renderPage();
