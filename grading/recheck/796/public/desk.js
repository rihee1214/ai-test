const find = selector => document.querySelector(selector);
const notice = find('#notice');

async function start() {
  const response = await fetch('seed.json');
  if (!response.ok) throw new Error();
  const { session, totalUnits, requests } = await response.json();
  find('#session').textContent = session;
  const key = 'kit-desk:' + session;
  const initial = requests.filter(row => row.status === 'allocated').map(row => row.id);
  let allocated = new Set(initial);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) {
      const restored = requests.filter(row => saved.includes(row.id));
      if (restored.reduce((sum, row) => sum + row.units, 0) <= totalUnits) {
        allocated = new Set(restored.map(row => row.id));
      }
    }
  } catch { /* Use seed data if the saved selection cannot be read. */ }

  const controls = requests.map(row => {
    const tr = find('tbody').insertRow();
    for (const value of [row.id, row.className, row.units + '개']) {
      tr.insertCell().textContent = value;
    }
    const status = tr.insertCell();
    const button = document.createElement('button');
    tr.insertCell().append(button);
    button.onclick = () => {
      if (allocated.has(row.id)) allocated.delete(row.id);
      else {
        const shortage = row.units - remaining();
        if (shortage > 0) {
          notice.textContent = '재고 부족 · ' + shortage + '개 부족';
          return;
        }
        allocated.add(row.id);
      }
      save();
    };
    return { row, status, button };
  });
  function remaining() {
    return requests.reduce((left, row) => left - (allocated.has(row.id) ? row.units : 0), totalUnits);
  }
  function render() {
    find('#remaining').textContent = remaining() + '개';
    const deliveries = [];
    for (const { row, status, button } of controls) {
      const done = allocated.has(row.id);
      status.textContent = done ? '배정 완료' : '대기';
      button.textContent = done ? '취소' : '배정';
      button.classList.toggle('cancel', done);
      if (done) deliveries.push(row.className + ' ' + row.units + '개');
    }
    find('#delivery').textContent = deliveries.join(' · ') || '배정된 수업 없음';
  }
  function save() {
    notice.textContent = '';
    render();
    try { localStorage.setItem(key, JSON.stringify([...allocated])); }
    catch { notice.textContent = '이 브라우저에 배정 결과를 저장할 수 없습니다.'; }
  }
  find('#reset').onclick = () => {
    allocated = new Set(initial);
    save();
  };
  render();
}

start().catch(() => { notice.textContent = '신청 자료를 불러올 수 없습니다.'; });
