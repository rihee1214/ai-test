const byId = id => document.getElementById(id);
const notice = byId("notice");

async function openDesk() {
  const response = await fetch("seed.json");
  if (!response.ok) throw new Error("seed");
  const { session, item, totalUnits, requests } = await response.json();
  const key = `kit-desk:${item}:${session}`;
  const initial = requests.filter(row => row.status === "allocated").map(row => row.id);
  let allocated = new Set(initial);
  const available = ids => totalUnits - requests.reduce(
    (used, row) => used + (ids.has(row.id) ? row.units : 0), 0
  );
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try {
      const ids = JSON.parse(saved);
      if (Array.isArray(ids) && ids.every(id => requests.some(row => row.id === id))) {
        const restored = new Set(ids);
        if (available(restored) >= 0) allocated = restored;
      }
    } catch { /* Use the seed when a saved value cannot be decoded. */ }
  }
  byId("session").textContent = session;
  const rows = requests.map(request => {
    const row = byId("requests").insertRow();
    for (const value of [request.id, request.className, `${request.units}개`]) {
      row.insertCell().textContent = value;
    }
    const status = row.insertCell();
    const button = document.createElement("button");
    row.insertCell().append(button);
    button.addEventListener("click", () => {
      const next = new Set(allocated);
      if (next.has(request.id)) {
        next.delete(request.id);
      } else {
        const shortage = request.units - available(allocated);
        if (shortage > 0) {
          notice.textContent = `재고 부족 · ${request.className}에 ${shortage}개 부족`;
          return;
        }
        next.add(request.id);
      }
      commit(next);
    });
    return { request, status, button };
  });
  function render() {
    byId("remaining").textContent = `${available(allocated)}개`;
    const packing = [];
    for (const { request, status, button } of rows) {
      const done = allocated.has(request.id);
      status.textContent = done ? "배정 완료" : "대기";
      button.textContent = done ? "취소" : "배정";
      button.classList.toggle("cancel", done);
      button.setAttribute("aria-label", `${request.className} ${button.textContent}`);
      if (done) packing.push(`${request.className} ${request.units}개`);
    }
    byId("packing").textContent = packing.join(" · ") || "배정된 수업 없음";
  }
  function commit(next, reset = false) {
    try {
      if (reset) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      notice.textContent = "배정 상태를 저장할 수 없습니다.";
      return;
    }
    allocated = next;
    notice.textContent = "";
    render();
  }
  byId("reset").addEventListener("click", () => commit(new Set(initial), true));
  render();
  byId("reset").disabled = false;
}

openDesk().catch(() => { notice.textContent = "차수 정보를 불러올 수 없습니다."; });
