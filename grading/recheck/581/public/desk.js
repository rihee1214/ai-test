const notice = document.querySelector('#notice');
const reset = document.querySelector('#reset');

async function openDesk() {
  const response = await fetch('seed.json');
  if (!response.ok) throw new Error('초기 데이터 읽기 실패');
  const {session, item, totalUnits, requests} = await response.json();
  const storageKey = JSON.stringify(['kit-desk', session, item]);
  const allocated = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
  document.querySelector('#session').textContent = session;
  const body = document.querySelector('tbody');
  const rows = requests.map(request => {
    const row = body.insertRow();
    for (const text of [request.id, request.className, request.units + '개']) {
      row.insertCell().textContent = text;
    }
    const status = row.insertCell();
    const button = document.createElement('button');
    button.type = 'button';
    row.insertCell().append(button);
    button.addEventListener('click', () => toggle(request));
    return {request, status, button};
  });

  function remaining() {
    return totalUnits - requests.reduce((sum, request) =>
      sum + (allocated.has(request.id) ? request.units : 0), 0);
  }

  function render() {
    document.querySelector('#remaining').textContent = remaining() + '개';
    const packing = [];
    for (const {request, status, button} of rows) {
      const done = allocated.has(request.id);
      status.textContent = done ? '배정 완료' : '대기';
      button.textContent = done ? '취소' : '배정';
      button.classList.toggle('allocate', !done);
      button.setAttribute('aria-label', request.className + ' ' + button.textContent);
      if (done) packing.push(request.className + ' ' + request.units + '개');
    }
    document.querySelector('#packing').textContent = packing.join(' · ') || '배정된 수업 없음';
    notice.textContent = '';
  }

  function toggle(request) {
    if (allocated.has(request.id)) {
      allocated.delete(request.id);
    } else {
      const shortage = request.units - remaining();
      if (shortage > 0) {
        notice.textContent = '재고 부족 · ' + shortage + '개 부족';
        return;
      }
      allocated.add(request.id);
    }
    localStorage.setItem(storageKey, JSON.stringify([...allocated]));
    render();
  }

  reset.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    allocated.clear();
    render();
  });
  render();
  reset.disabled = false;
}

openDesk().catch(() => {
  notice.textContent = '차수 데이터를 열 수 없습니다. 새로고침해 주세요.';
});
