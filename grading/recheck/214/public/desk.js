const select = selector => document.querySelector(selector);
const key = 'kit-desk.allocations.v1';
const notice = select('#notice');

async function openDesk() {
  const response = await fetch('seed.json');
  if (!response.ok) throw new Error('seed');
  const seed = await response.json();
  select('#session').textContent = seed.session;
  const initial = seed.requests.filter(row => row.status === 'allocated').map(row => row.id);
  let allocated = new Set(initial);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) {
      const rows = seed.requests.filter(row => saved.includes(row.id));
      if (rows.reduce((sum, row) => sum + row.units, 0) <= seed.totalUnits) {
        allocated = new Set(rows.map(row => row.id));
      }
    }
  } catch { /* A fresh desk can still be used when storage is unavailable. */ }

  const controls = new Map();
  let remaining;
  function render() {
    const packed = seed.requests.filter(row => allocated.has(row.id));
    remaining = seed.totalUnits - packed.reduce((sum, row) => sum + row.units, 0);
    select('#remaining').textContent = remaining + '개';
    select('#list').textContent = packed.map(row => row.className + ' ' + row.units + '개').join(' · ') || '배정된 수업 없음';
    for (const [id, { status, button }] of controls) {
      const done = allocated.has(id);
      status.textContent = done ? '배정 완료' : '대기';
      button.textContent = done ? '취소' : '배정';
      button.classList.toggle('cancel', done);
    }
  }
  function save() {
    notice.textContent = '';
    try { localStorage.setItem(key, JSON.stringify([...allocated])); }
    catch { notice.textContent = '현재 브라우저에 배정 결과를 저장할 수 없습니다.'; }
    render();
  }
  for (const row of seed.requests) {
    const tr = select('tbody').insertRow();
    for (const value of [row.id, row.className, row.units + '개']) tr.insertCell().textContent = value;
    const status = tr.insertCell();
    const button = document.createElement('button');
    tr.insertCell().append(button);
    controls.set(row.id, { status, button });
    button.onclick = () => {
      if (allocated.has(row.id)) allocated.delete(row.id);
      else if (row.units <= remaining) allocated.add(row.id);
      else {
        notice.textContent = '재고 부족 · ' + (row.units - remaining) + '개 부족';
        return;
      }
      save();
    };
  }
  select('#reset').onclick = () => { allocated = new Set(initial); save(); };
  render();
}
openDesk().catch(() => { notice.textContent = '신청 정보를 불러올 수 없습니다. 새로고침해 주세요.'; });
