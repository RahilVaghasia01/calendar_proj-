/* ============================================
   WIZZ · Space Calendar — JavaScript
   app.js  (API-connected + Search + Completion)
   ============================================ */

/* ── STAR FIELD GENERATOR ── */
(function generateStars() {
  const layer = document.getElementById('stars');
  for (let i = 0; i < 180; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.2 + 0.3;
    star.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      `top:${Math.random() * 100}%`,
      `left:${Math.random() * 100}%`,
      `--d:${(Math.random() * 4 + 2).toFixed(1)}s`,
      `--dl:-${(Math.random() * 6).toFixed(1)}s`,
      `--mo:${(Math.random() * 0.28 + 0.04).toFixed(2)}`
    ].join(';');
    layer.appendChild(star);
  }
})();

/* ============================================
   API HELPER
   ============================================ */
const API_BASE = '';

function getToken()     { return localStorage.getItem('wizz_token'); }
function setToken(t)    { if (t) localStorage.setItem('wizz_token', t); else localStorage.removeItem('wizz_token'); }
function getUsername()  { return localStorage.getItem('wizz_username'); }
function setUsername(u) { if (u) localStorage.setItem('wizz_username', u); else localStorage.removeItem('wizz_username'); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}

  if (!res.ok) throw new Error(data?.error || res.statusText || 'Request failed');
  return data;
}

/* ============================================
   PAGE NAVIGATION
   ============================================ */
function showPage(name) {
  document.querySelectorAll('.page, .app-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (name === 'board') renderTaskBoard();
}

/* ============================================
   UI HELPERS
   ============================================ */
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled    = loading;
  btn.textContent = loading ? 'PLEASE WAIT...' : label;
}

function showErr(elId, msg) {
  document.getElementById(elId).textContent = msg;
}

function escHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/* ============================================
   AUTH — LOGIN
   ============================================ */
document.getElementById('loginBtn').onclick = async () => {
  const ident = document.getElementById('l-ident').value.trim();
  const pass  = document.getElementById('l-pass').value;
  showErr('login-err', '');

  if (!ident || !pass) { showErr('login-err', '⚠ All fields required.'); return; }

  setLoading('loginBtn', true, 'LAUNCH INTO WIZZ');
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: ident, password: pass })
    });
    setToken(data.token);
    setUsername(data.user.username);
    launchApp(data.user.username);
  } catch (e) {
    showErr('login-err', '⚠ ' + e.message);
  } finally {
    setLoading('loginBtn', false, 'LAUNCH INTO WIZZ');
  }
};

/* ============================================
   AUTH — REGISTER
   ============================================ */
document.getElementById('registerBtn').onclick = async () => {
  const username = document.getElementById('r-user').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const pass     = document.getElementById('r-pass').value;
  const pass2    = document.getElementById('r-pass2').value;
  showErr('reg-err', '');
  document.getElementById('reg-ok').textContent = '';

  if (!username || !email || !pass || !pass2) { showErr('reg-err', '⚠ All fields required.'); return; }
  if (pass.length < 6)                        { showErr('reg-err', '⚠ Code must be 6+ characters.'); return; }
  if (pass !== pass2)                         { showErr('reg-err', '⚠ Codes do not match.'); return; }
  if (!/\S+@\S+\.\S+/.test(email))           { showErr('reg-err', '⚠ Invalid email format.'); return; }

  setLoading('registerBtn', true, 'CREATE PROFILE');
  try {
    await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password: pass })
    });
    document.getElementById('reg-ok').textContent = '✓ Account created! Taking you to login...';
    setTimeout(() => showPage('login'), 1400);
  } catch (e) {
    showErr('reg-err', '⚠ ' + e.message);
  } finally {
    setLoading('registerBtn', false, 'CREATE PROFILE');
  }
};

/* ── LOGOUT ── */
function logout() {
  setToken(null);
  setUsername(null);
  clearSearch();
  showPage('login');
}

/* ── LAUNCH APP ── */
function launchApp(username) {
  document.getElementById('topbar-user').textContent = 'Commander ' + username;
  showPage('app');
  initCalendar();
}

/* ============================================
   CALENDAR STATE
   ============================================ */
let viewYear, viewMonth;
let selectedDate  = null;
let selectedColor    = 0;
let selectedPriority = 3;   // 1=Low … 5=High (default Medium)
let editingId        = null;

let tasksCache  = [];
let eventsCache = [];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

/* ── Map backend task → calendar event ── */
function taskToEvent(task) {
  const date = task.deadline ? task.deadline.slice(0, 10) : null;
  return {
    id:       String(task.id),
    date,
    name:     task.title,
    time:     task.description || '',
    color:    task.priority ? Math.min(task.priority - 1, 4) : 0,
    priority: task.priority || 3,
    done:     task.status === 'done',
    created:  task.created_at
  };
}

async function loadEventsFromAPI() {
  try {
    tasksCache  = await api('/api/tasks');
    eventsCache = tasksCache.map(taskToEvent).filter(e => e.date !== null);
    renderTaskBoard();
  } catch (e) {
    if (e.message.toLowerCase().includes('token') || e.message.includes('401')) logout();
    tasksCache  = [];
    eventsCache = [];
  }
}

function getUserEvents() { return eventsCache; }

async function initCalendar() {
  const now = new Date();
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth();
  await loadEventsFromAPI();
  renderCalendar();
  updateStats();
  updateUpcoming();
}

function changeMonth(dir) {
  viewMonth += dir;
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
  renderCalendar();
  updateStats();
  updateUpcoming();
}

/* ============================================
   RENDER CALENDAR
   ============================================ */
function renderCalendar() {
  document.getElementById('cal-month-label').textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const grid     = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth,     0).getDate();
  const today       = new Date();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)  cells.push({ day: daysInPrev - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++)     cells.push({ day: d,             cur: true  });
  while (cells.length % 7 !== 0)            cells.push({ day: cells.length - firstDay - daysInMonth + 1, cur: false });

  cells.forEach(({ day, cur }) => {
    const cell     = document.createElement('div');
    cell.className = 'cal-cell' + (cur ? '' : ' other-month');

    const dateStr = cur
      ? `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      : null;

    if (cur) {
      const isToday =
        today.getFullYear() === viewYear &&
        today.getMonth()    === viewMonth &&
        today.getDate()     === day;

      if (isToday)                cell.classList.add('today');
      if (selectedDate === dateStr) cell.classList.add('selected');

      const dayEvents = getUserEvents().filter(e => e.date === dateStr);

      cell.innerHTML = `
        <div class="cell-num">${day}</div>
        <div class="cell-events">
          ${dayEvents.slice(0, 3).map(e =>
            `<div class="ev-chip c${e.color}${e.done ? ' ev-chip-done' : ''}">${escHtml(e.name)}</div>`
          ).join('')}
        </div>`;

      cell.onclick = () => openPanel(dateStr);
    } else {
      cell.innerHTML = `<div class="cell-num" style="opacity:.35">${day}</div>`;
    }

    grid.appendChild(cell);
  });
}

/* ============================================
   EVENT PANEL
   ============================================ */
function openPanel(dateStr) {
  selectedDate = dateStr;
  editingId    = null;
  renderCalendar();

  const [y, m, d] = dateStr.split('-');
  document.getElementById('panel-date').textContent =
    `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;

  renderEventList(dateStr);
  document.getElementById('panel-overlay').classList.add('open');
  resetForm();
  initDrum();
}

function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  selectedDate = null;
  editingId    = null;
  renderCalendar();
}

function closePanelOutside(e) {
  if (e.target === document.getElementById('panel-overlay')) closePanel();
}

function resetForm() {
  document.getElementById('ev-name').value = '';
  document.getElementById('ev-time').value = '';
  selectedColor = 0;
  document.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === 0));
  editingId = null;
  document.getElementById('add-btn').textContent            = '+ ADD';
  document.getElementById('cancel-edit-btn').style.display  = 'none';
  document.getElementById('form-heading').textContent        = 'New Event';

  // Reset priority to Medium (3)
  selectedPriority = 3;
  document.querySelectorAll('.pri-btn').forEach(b => b.classList.toggle('active', b.dataset.p === '3'));

  // Reset drum to 09:00 AM
  drumAllDay   = false;
  drumSelHour  = 8;
  drumSelMin   = 0;
  drumSelAmpm  = 0;
  document.getElementById('ev-time').value = '';
}

function renderEventList(dateStr) {
  const events    = getUserEvents().filter(e => e.date === dateStr);
  const el        = document.getElementById('event-list');
  const colorVars = ['var(--cyan)','var(--green)','var(--purple)','#f59e0b','var(--danger)'];

  if (!events.length) {
    el.innerHTML = '<div class="no-events">No events · Click add below</div>';
    return;
  }

  el.innerHTML = events.map(e => `
    <div class="ev-row${e.done ? ' ev-done' : ''}" id="ev-row-${e.id}">
      <div class="ev-row-left">
        <button class="ev-check${e.done ? ' checked' : ''}"
                onclick="toggleDone('${e.id}')"
                title="${e.done ? 'Mark incomplete' : 'Mark complete'}">
          ${e.done ? '✔' : ''}
        </button>
        <div class="ev-dot" style="background:${colorVars[e.color]}"></div>
        <div>
          <div class="ev-name">${escHtml(e.name)}</div>
          <div class="ev-time">${escHtml(e.time) || 'All day'}</div>
        </div>
      </div>
      <div class="ev-actions">
        <button class="ev-edit" onclick="startEdit('${e.id}')" title="Edit">✎</button>
        <button class="ev-del"  onclick="deleteEvent('${e.id}')" title="Delete">✕</button>
      </div>
    </div>`).join('');
}

function pickColor(el) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  selectedColor = parseInt(el.dataset.c);
}

/* ============================================
   DRUM / SCROLL TIME PICKER
   Three columns: Hour · Minute · AM/PM
   Each column scrolls; centre item = selected.
   Also syncs with the manual text input.
   ============================================ */

const DRUM_ITEM_H = 36;   // px height of each drum item

const drumHours   = ['12','01','02','03','04','05','06','07','08','09','10','11'];
const drumMinutes = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const drumAmpm    = ['AM','PM'];

let drumSelHour   = 8;   // index into drumHours   (default 09 = 8)
let drumSelMin    = 0;   // index into drumMinutes (default 00)
let drumSelAmpm   = 0;   // 0=AM, 1=PM
let drumAllDay    = false;

function buildDrumCol(trackId, items, selectedIdx, onSelect) {
  const track = document.getElementById(trackId);
  if (!track) return;
  track.innerHTML = '';

  // padding items top & bottom so selection can reach first/last
  const pad = 2;
  for (let i = 0; i < pad; i++) {
    const ph = document.createElement('div');
    ph.className = 'drum-item drum-pad';
    track.appendChild(ph);
  }

  items.forEach((label, idx) => {
    const el = document.createElement('div');
    el.className = 'drum-item' + (idx === selectedIdx ? ' drum-sel' : '');
    el.textContent = label;
    el.addEventListener('click', () => { onSelect(idx); });
    track.appendChild(el);
  });

  for (let i = 0; i < pad; i++) {
    const ph = document.createElement('div');
    ph.className = 'drum-item drum-pad';
    track.appendChild(ph);
  }

  scrollDrumTo(track, selectedIdx);
}

function scrollDrumTo(track, idx) {
  // scroll so the selected item sits in the middle window
  track.scrollTop = idx * DRUM_ITEM_H;
}

function drumHighlight(track, items, selectedIdx) {
  const all = track.querySelectorAll('.drum-item:not(.drum-pad)');
  all.forEach((el, i) => el.classList.toggle('drum-sel', i === selectedIdx));
}

function initDrum() {
  buildDrumCol('drum-hour-track',   drumHours,   drumSelHour,  selectDrumHour);
  buildDrumCol('drum-minute-track', drumMinutes, drumSelMin,   selectDrumMin);
  buildDrumCol('drum-ampm-track',   drumAmpm,    drumSelAmpm,  selectDrumAmpm);
  attachDrumScroll('drum-hour-track',   drumHours.length,   h => { drumSelHour  = h; drumSyncInput(); });
  attachDrumScroll('drum-minute-track', drumMinutes.length, m => { drumSelMin   = m; drumSyncInput(); });
  attachDrumScroll('drum-ampm-track',   drumAmpm.length,    a => { drumSelAmpm  = a; drumSyncInput(); });
}

function attachDrumScroll(trackId, count, onSnapCb) {
  const track = document.getElementById(trackId);
  if (!track) return;
  let snapTimer = null;
  track.addEventListener('scroll', () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const idx = Math.round(track.scrollTop / DRUM_ITEM_H);
      const clamped = Math.max(0, Math.min(count - 1, idx));
      track.scrollTop = clamped * DRUM_ITEM_H;   // snap
      onSnapCb(clamped);
      drumHighlight(track, [], clamped);
    }, 80);
  }, { passive: true });
}

function selectDrumHour(idx) {
  drumSelHour = idx;
  drumHighlight(document.getElementById('drum-hour-track'), drumHours, idx);
  scrollDrumTo(document.getElementById('drum-hour-track'), idx);
  drumSyncInput();
}
function selectDrumMin(idx) {
  drumSelMin = idx;
  drumHighlight(document.getElementById('drum-minute-track'), drumMinutes, idx);
  scrollDrumTo(document.getElementById('drum-minute-track'), idx);
  drumSyncInput();
}
function selectDrumAmpm(idx) {
  drumSelAmpm = idx;
  drumHighlight(document.getElementById('drum-ampm-track'), drumAmpm, idx);
  scrollDrumTo(document.getElementById('drum-ampm-track'), idx);
  drumSyncInput();
}

function drumSyncInput() {
  if (drumAllDay) return;
  const h = drumHours[drumSelHour];
  const m = drumMinutes[drumSelMin];
  const ap = drumAmpm[drumSelAmpm];
  document.getElementById('ev-time').value = `${h}:${m} ${ap}`;
}

function toggleAllDay() {
  drumAllDay = !drumAllDay;
  const btn  = document.getElementById('drum-allday-btn');
  const drum = document.querySelector('.drum-picker');
  if (drumAllDay) {
    btn.classList.add('active');
    document.getElementById('ev-time').value = 'All day';
    // dim the columns
    drum.querySelectorAll('.drum-col:not(.drum-col-allday)').forEach(c => c.style.opacity = '.3');
  } else {
    btn.classList.remove('active');
    drum.querySelectorAll('.drum-col').forEach(c => c.style.opacity = '');
    drumSyncInput();
  }
}

/* Sync drum back from text input (for edit mode) */
function drumSetFromString(val) {
  if (!val || val === 'All day') {
    drumAllDay = true;
    document.getElementById('ev-time').value = 'All day';
    const btn = document.getElementById('drum-allday-btn');
    if (btn) btn.classList.add('active');
    document.querySelector('.drum-picker')
      ?.querySelectorAll('.drum-col')
      .forEach(c => c.style.opacity = '.3');
    return;
  }

  drumAllDay = false;
  document.getElementById('drum-allday-btn')?.classList.remove('active');
  document.querySelector('.drum-picker')
    ?.querySelectorAll('.drum-col')
    .forEach(c => c.style.opacity = '');

  // Parse "HH:MM AM/PM" or "HH:MM"
  const match = val.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return;

  let hNum = parseInt(match[1]);
  const mNum = parseInt(match[2]);
  const ap = (match[3] || '').toUpperCase();

  let ampmIdx = ap === 'PM' ? 1 : 0;
  if (!ap) ampmIdx = hNum >= 12 ? 1 : 0;
  if (hNum > 12) hNum -= 12;
  if (hNum === 0) hNum = 12;

  const hStr  = String(hNum).padStart(2,'0');
  const mStr  = String(mNum).padStart(2,'0');
  const hIdx  = drumHours.indexOf(hStr);
  const mIdx  = drumMinutes.findIndex(m => m === mStr) !== -1
    ? drumMinutes.findIndex(m => m === mStr)
    : Math.round(mNum / 5);

  if (hIdx !== -1)  selectDrumHour(Math.max(0, hIdx));
  selectDrumMin(Math.max(0, Math.min(drumMinutes.length - 1, mIdx)));
  selectDrumAmpm(ampmIdx);
}

/* Call initDrum whenever the panel opens */

/* ── PRIORITY SELECTOR ── */
const PRI_LABELS = ['', 'LOW', 'MED-', 'MED', 'MED+', 'HIGH'];
const PRI_COLORS = ['', 'var(--green)', 'var(--cyan)', 'var(--purple)', '#f59e0b', 'var(--danger)'];

function pickPriority(el) {
  document.querySelectorAll('.pri-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedPriority = parseInt(el.dataset.p);
}

/* ── TOGGLE COMPLETION ── */
async function toggleDone(id) {
  try {
    await api('/api/tasks/' + id + '/toggle', { method: 'PATCH' });
    await loadEventsFromAPI();
    renderEventList(selectedDate);
    renderCalendar();
    updateStats();
    updateUpcoming();
  } catch (e) {
    alert('⚠ Could not update event: ' + e.message);
  }
}

/* ── START EDITING ── */
function startEdit(id) {
  const ev = eventsCache.find(e => e.id === id);
  if (!ev) return;

  editingId = id;
  document.getElementById('ev-name').value  = ev.name;
  document.getElementById('ev-time').value  = ev.time || '';
  selectedColor = ev.color;
  document.querySelectorAll('.color-dot').forEach((d,i) => d.classList.toggle('active', i === ev.color));

  // Restore priority buttons
  const task = tasksCache.find(t => String(t.id) === id);
  if (task && task.priority) {
    selectedPriority = task.priority;
    document.querySelectorAll('.pri-btn').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.p) === task.priority)
    );
  }

  document.getElementById('add-btn').textContent            = '✓ SAVE';
  document.getElementById('cancel-edit-btn').style.display  = 'inline-block';
  document.getElementById('form-heading').textContent        = 'Edit Event';

  document.querySelectorAll('.ev-row').forEach(r => r.classList.remove('editing'));
  const row = document.getElementById('ev-row-' + id);
  if (row) row.classList.add('editing');

  document.getElementById('ev-name').focus();
  // Sync drum to the saved time value
  drumSetFromString(ev.time || '');
}

/* ── ADD OR SAVE EVENT ── */
async function addEvent() {
  const name = document.getElementById('ev-name').value.trim();
  if (!name || !selectedDate) return;

  const timeVal  = document.getElementById('ev-time').value.trim();
  const priority = selectedPriority;
  const addBtn   = document.getElementById('add-btn');
  addBtn.disabled = true;

  try {
    if (editingId) {
      await api('/api/tasks/' + editingId, {
        method: 'PATCH',
        body: JSON.stringify({ title: name, description: timeVal, deadline: selectedDate, priority })
      });
    } else {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: name, description: timeVal, deadline: selectedDate,
          priority, duration_minutes: 60, status: 'todo'
        })
      });
    }
    await loadEventsFromAPI();
    resetForm();
    renderEventList(selectedDate);
    renderCalendar();
    updateStats();
    updateUpcoming();
  } catch (e) {
    alert('⚠ Could not save event: ' + e.message);
  } finally {
    addBtn.disabled = false;
  }
}

/* ── DELETE EVENT ── */
async function deleteEvent(id) {
  try {
    await api('/api/tasks/' + id, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await loadEventsFromAPI();
    renderEventList(selectedDate);
    renderCalendar();
    updateStats();
    updateUpcoming();
  } catch (e) {
    alert('⚠ Could not delete event: ' + e.message);
  }
}

/* ============================================
   SIDEBAR STATS
   ============================================ */
function updateStats() {
  const now    = new Date();
  const events = getUserEvents();

  const monthEvents = events.filter(e => {
    const [y, m] = e.date.split('-');
    return parseInt(y) === viewYear && parseInt(m) - 1 === viewMonth;
  });

  const next7Days = events.filter(e => {
    const diff = (new Date(e.date) - now) / 864e5;
    return diff >= 0 && diff <= 7;
  });

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  setText('stat-total', events.length);
  setText('stat-month', monthEvents.length);
  setText('stat-week',  next7Days.length);
  setText('stat-done',  events.filter(e => e.done).length);
}

function updateUpcoming() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const events = getUserEvents()
    .filter(e => new Date(e.date) >= now && !e.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const ul = document.getElementById('upcoming-list');

  if (!events.length) {
    ul.innerHTML = '<div class="no-events-side">No upcoming events</div>';
    return;
  }

  ul.innerHTML = events.map(e => {
    const [y, m, d] = e.date.split('-');
    return `
      <div class="up-item">
        <div class="up-name">${escHtml(e.name)}</div>
        <div class="up-when">${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)} · ${escHtml(e.time) || 'All day'}</div>
      </div>`;
  }).join('');
}

/* ============================================
   SEARCH  —  GET /api/tasks/search?q=...
   Debounced 280 ms. Results shown in a bar
   below the topbar. Click a result to jump
   to that date on the calendar.
   ============================================ */
let searchDebounce = null;

const searchInput  = document.getElementById('search-input');
const searchClear  = document.getElementById('search-clear');
const resultsBar   = document.getElementById('search-results-bar');
const resultsList  = document.getElementById('search-results-list');
const resultsLabel = document.getElementById('search-results-label');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'block' : 'none';
  clearTimeout(searchDebounce);
  if (!q) { hideSearchResults(); return; }
  searchDebounce = setTimeout(() => runSearch(q), 280);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') clearSearch();
});

async function runSearch(q) {
  try {
    resultsLabel.textContent = 'Searching...';
    resultsBar.style.display = 'block';
    resultsList.innerHTML    = '';

    const results = await api('/api/tasks/search?q=' + encodeURIComponent(q));

    if (!results.length) {
      resultsLabel.textContent = `No results for "${escHtml(q)}"`;
      return;
    }

    resultsLabel.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${escHtml(q)}"`;

    const colorVars = ['var(--cyan)','var(--green)','var(--purple)','#f59e0b','var(--danger)'];

    resultsList.innerHTML = results.map(t => {
      const date    = t.deadline ? t.deadline.slice(0, 10) : null;
      const color   = t.priority ? Math.min(t.priority - 1, 4) : 0;
      const isDone  = t.status === 'done';
      const dateStr = date ? (() => {
        const [y, m, d] = date.split('-');
        return `${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)}, ${y}`;
      })() : 'No date';

      return `
        <div class="sr-item${isDone ? ' sr-done' : ''}" onclick="searchJumpTo('${date}')">
          <div class="sr-dot" style="background:${colorVars[color]}"></div>
          <div class="sr-info">
            <div class="sr-name">${escHtml(t.title)}</div>
            <div class="sr-date">${dateStr}${isDone ? ' · ✔ Done' : ''}</div>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    resultsLabel.textContent = 'Search error — please try again';
    resultsList.innerHTML    = '';
  }
}

function searchJumpTo(dateStr) {
  if (!dateStr) return;
  const [y, m] = dateStr.split('-');
  viewYear  = parseInt(y);
  viewMonth = parseInt(m) - 1;
  renderCalendar();
  updateStats();
  updateUpcoming();
  openPanel(dateStr);
  clearSearch();
}

function hideSearchResults() {
  resultsBar.style.display = 'none';
  resultsList.innerHTML    = '';
}

function clearSearch() {
  searchInput.value         = '';
  searchClear.style.display = 'none';
  hideSearchResults();
}


/* ============================================
   PRIORITY TASK BOARD
   Renders all tasks sorted by priority (5→1)
   then by due date (soonest first).
   Supports filter: all | pending | done | overdue
   ============================================ */

let taskBoardFilter = 'all';

function setTaskFilter(btn) {
  document.querySelectorAll('.tb-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  taskBoardFilter = btn.dataset.f;
  renderTaskBoard();
}

function renderTaskBoard() {
  if (!tasksCache.length) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Apply filter
  let tasks = tasksCache.filter(t => {
    const deadline = t.deadline ? new Date(t.deadline.slice(0, 10)) : null;
    const isDone   = t.status === 'done';
    const isOverdue = deadline && deadline < now && !isDone;

    if (taskBoardFilter === 'pending') return !isDone;
    if (taskBoardFilter === 'done')    return isDone;
    if (taskBoardFilter === 'overdue') return isOverdue;
    return true; // 'all'
  });

  // Sort: priority desc, then due date asc (nulls last), then title asc
  tasks.sort((a, b) => {
    const pDiff = (b.priority || 0) - (a.priority || 0);
    if (pDiff !== 0) return pDiff;
    const aDate = a.deadline ? new Date(a.deadline) : null;
    const bDate = b.deadline ? new Date(b.deadline) : null;
    if (aDate && bDate) return aDate - bDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return a.title.localeCompare(b.title);
  });

  // Clear all lane-cards and counts
  for (let p = 1; p <= 5; p++) {
    const cards = document.getElementById('lane-cards-' + p);
    const count = document.getElementById('lane-count-' + p);
    if (cards) cards.innerHTML = '';
    if (count) count.textContent = '0';
  }

  // Bucket tasks into their priority lane
  const buckets = {1:[], 2:[], 3:[], 4:[], 5:[]};
  tasks.forEach(t => {
    const p = t.priority || 3;
    if (buckets[p]) buckets[p].push(t);
  });

  // Render each lane
  for (let p = 1; p <= 5; p++) {
    const cards  = document.getElementById('lane-cards-' + p);
    const count  = document.getElementById('lane-count-' + p);
    const bucket = buckets[p];

    if (!cards) continue;
    if (count) count.textContent = bucket.length;

    if (!bucket.length) {
      cards.innerHTML = '<div class="lane-empty">No tasks</div>';
      continue;
    }

    cards.innerHTML = bucket.map(t => buildTaskCard(t, now)).join('');
  }
}

function buildTaskCard(t, now) {
  const isDone    = t.status === 'done';
  const deadline  = t.deadline ? t.deadline.slice(0, 10) : null;
  const priColor  = PRI_COLORS[t.priority || 3];

  // Due date display + overdue badge
  let duePart = '';
  if (deadline) {
    const dDate    = new Date(deadline);
    const diffDays = Math.ceil((dDate - now) / 864e5);
    const [y, m, d] = deadline.split('-');
    const dateLabel = `${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)}, ${y}`;

    let dueClass = 'tc-due';
    let dueBadge = '';
    if (!isDone && diffDays < 0) {
      dueClass = 'tc-due overdue';
      dueBadge = '<span class="tc-overdue-badge">OVERDUE</span>';
    } else if (!isDone && diffDays === 0) {
      dueClass = 'tc-due today-due';
      dueBadge = '<span class="tc-today-badge">TODAY</span>';
    } else if (!isDone && diffDays <= 3) {
      dueClass = 'tc-due soon-due';
    }

    duePart = `<div class="${dueClass}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      ${dateLabel} ${dueBadge}
    </div>`;
  }

  // Time pill
  const timePart = t.description
    ? `<div class="tc-time">
         <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
           <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
         </svg>
         ${escHtml(t.description)}
       </div>`
    : '';

  return `
    <div class="task-card${isDone ? ' tc-done' : ''}" data-id="${t.id}">
      <div class="tc-left" style="border-left-color:${priColor}">
        <div class="tc-top">
          <button class="tc-check${isDone ? ' checked' : ''}"
                  onclick="toggleDone('${t.id}')"
                  title="${isDone ? 'Mark incomplete' : 'Mark complete'}">
            ${isDone ? '&#10004;' : ''}
          </button>
          <div class="tc-title">${escHtml(t.title)}</div>
        </div>
        ${timePart}
        ${duePart}
      </div>
      <div class="tc-actions">
        <button class="tc-jump" onclick="boardJumpTo('${deadline}')" title="View on calendar">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
        <button class="tc-del" onclick="deleteEvent('${t.id}')" title="Delete">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>`;
}

/* Jump to date on calendar when clicking the calendar icon on a card */
function boardJumpTo(dateStr) {
  if (!dateStr) return;
  const [y, m] = dateStr.split('-');
  viewYear  = parseInt(y);
  viewMonth = parseInt(m) - 1;
  renderCalendar();
  updateStats();
  updateUpcoming();
  openPanel(dateStr);
}

/* ============================================
   EXPORT CSV  (now includes Done column)
   ============================================ */
function exportCSV() {
  const events = getUserEvents();
  if (!events.length) { alert('No events to export!'); return; }

  const colorNames = ['Cyan','Green','Purple','Amber','Red'];
  const rows = [
    ['ID','Date','Event Name','Time','Color','Done','Created'],
    ...events.map(e => [
      e.id, e.date, e.name, e.time||'All day',
      colorNames[e.color]||'', e.done ? 'Yes' : 'No', e.created
    ])
  ];

  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `wizz_events_${getUsername()}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ============================================
   KEYBOARD SHORTCUTS
   ============================================ */
document.getElementById('l-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});
document.getElementById('ev-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addEvent();
});

// Sync manual text input back to drum
document.getElementById('ev-time').addEventListener('change', () => {
  drumSetFromString(document.getElementById('ev-time').value.trim());
});



/* ============================================
   BOOT
   ============================================ */
window.addEventListener('load', async () => {
  const token = getToken();
  if (token) {
    try {
      const user = await api('/api/me');
      setUsername(user.username);
      launchApp(user.username);
    } catch (_) {
      setToken(null);
      setUsername(null);
      showPage('login');
    }
  } else {
    showPage('login');
  }
});