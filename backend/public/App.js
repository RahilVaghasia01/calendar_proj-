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
    expandRoutineIntoCache();   // add recurring routine events on top
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
  showReminderPopup();
}

function changeMonth(dir) {
  viewMonth += dir;
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
  expandRoutineIntoCache();   // re-expand for the new month range
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
function pickPriority(el) {
  document.querySelectorAll('.pri-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedPriority = parseInt(el.dataset.p);
}

/* ── TOGGLE COMPLETION ── */
async function toggleDone(id) {
  if (String(id).startsWith('rt-')) {
    alert('Recurring routine events cannot be marked done. You can delete the routine step from "My Daily Routine".');
    return;
  }
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
  if (String(id).startsWith('rt-')) {
    // This is a routine event — offer to delete the routine step instead
    const step = getRoutineSteps().find(s => 'rt-' + s.id === String(id).slice(0, 3 + s.id.length + 1).replace(/-\d{4}-\d{2}-\d{2}$/, ''));
    alert('This is a recurring routine event. Edit or delete it from the "My Daily Routine" panel.');
    return;
  }
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



/* ── BOARD MODAL open / close ── */
function openBoardModal() {
  renderTaskBoard();   // always refresh when opening
  document.getElementById('board-overlay').classList.add('open');
}

function closeBoardModal() {
  document.getElementById('board-overlay').classList.remove('open');
}

function closeBoardOutside(e) {
  if (e.target === document.getElementById('board-overlay')) closeBoardModal();
}

/* ============================================
   PRIORITY TASK BOARD
   Renders all tasks sorted by priority (5→1)
   then by due date (soonest first).
   Supports filter: all | pending | done | overdue
   ============================================ */

let taskBoardFilter = 'all';

const PRI_LABELS = ['', 'LOW', 'MED-', 'MED', 'MED+', 'HIGH'];
const PRI_COLORS = ['', 'var(--green)', 'var(--cyan)', 'var(--purple)', '#f59e0b', 'var(--danger)'];

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
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span style="white-space:nowrap">${dateLabel}</span>${dueBadge ? ' ' + dueBadge : ''}
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
          <div class="tc-title" title="${escHtml(t.title)}">${escHtml(t.title)}</div>
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
   LOGIN REMINDER POPUP
   Shows once on login if any tasks are
   overdue or due today. User can close it.
   ============================================ */

function showReminderPopup() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Collect overdue and due-today tasks (skip completed ones)
  const overdue = [];
  const dueToday = [];

  eventsCache.forEach(e => {
    if (e.done || !e.date) return;
    const due  = new Date(e.date);
    const diff = Math.ceil((due - now) / 864e5);
    if (diff < 0)        overdue.push({ ...e, diff });
    else if (diff === 0) dueToday.push({ ...e, diff });
  });

  // Sort by priority (highest first)
  const byPri = (a, b) => (b.priority || 3) - (a.priority || 3);
  overdue.sort(byPri);
  dueToday.sort(byPri);

  const all = [...overdue, ...dueToday];

  // Nothing to remind about — don't show popup
  if (!all.length) return;

  // Update subtitle text
  const subtitle = document.getElementById('reminder-subtitle');
  const od = overdue.length, td = dueToday.length;
  let msg = '';
  if (od && td) msg = `${od} overdue and ${td} due today`;
  else if (od)  msg = `${od} overdue task${od > 1 ? 's' : ''} need attention`;
  else          msg = `${td} task${td > 1 ? 's' : ''} due today`;
  subtitle.textContent = msg;

  // Build the task list
  const PRI_LABELS = ['','LOW','MED-','MED','MED+','HIGH'];
  const PRI_COLORS = ['','var(--green)','var(--cyan)','var(--purple)','#f59e0b','var(--danger)'];

  const list = document.getElementById('reminder-list');
  list.innerHTML = all.map(e => {
    const [y, m, d] = e.date.split('-');
    const dateLabel  = `${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)}, ${y}`;
    const isOverdue  = new Date(e.date) < now;
    const priColor   = PRI_COLORS[e.priority || 3];
    const priLabel   = PRI_LABELS[e.priority || 3];

    return `
      <div class="reminder-item${isOverdue ? ' r-overdue' : ' r-today'}"
           onclick="reminderJump('${e.date}')">
        <div class="reminder-item-left">
          <div class="r-dot" style="background:${priColor}"></div>
          <div>
            <div class="r-name">${escHtml(e.name)}</div>
            <div class="r-meta">
              ${isOverdue ? '<span class="r-badge-overdue">OVERDUE</span>' : '<span class="r-badge-today">TODAY</span>'}
              ${dateLabel}
              ${e.time ? ' · ' + escHtml(e.time) : ''}
              <span style="color:${priColor}"> · ${priLabel}</span>
            </div>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="r-arrow">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>`;
  }).join('');

  // Show the popup
  document.getElementById('reminder-overlay').classList.add('open');
}

function closeReminder() {
  document.getElementById('reminder-overlay').classList.remove('open');
}

function reminderJump(dateStr) {
  closeReminder();
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
   MY DAILY ROUTINE
   Routine steps are saved in localStorage.
   When the calendar renders, recurring events
   are expanded onto the correct dates and
   merged into eventsCache so they show on
   the calendar grid just like regular events.
   ============================================ */

/* ── localStorage helpers ── */
function getRoutineSteps() {
  return JSON.parse(localStorage.getItem('wizz_routine') || '[]');
}
function saveRoutineSteps(steps) {
  localStorage.setItem('wizz_routine', JSON.stringify(steps));
}

/* ── Routine state ── */
let routineColor    = 0;
let routineEditId   = null;   // null = adding new

/* ── Open / close modal ── */
function openRoutineModal() {
  renderRoutineList();
  // default start date to today
  const today = new Date().toISOString().slice(0,10);
  if (!document.getElementById('rt-start').value) {
    document.getElementById('rt-start').value = today;
  }
  document.getElementById('routine-overlay').classList.add('open');
}
function closeRoutineModal() {
  document.getElementById('routine-overlay').classList.remove('open');
  cancelRoutineEdit();
}
function closeRoutineOutside(e) {
  if (e.target === document.getElementById('routine-overlay')) closeRoutineModal();
}

/* ── Colour picker for routine ── */
function pickRoutineColor(el) {
  document.querySelectorAll('#routine-overlay .color-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  routineColor = parseInt(el.dataset.rc);
}

/* ── Save / edit a routine step ── */
function saveRoutineStep() {
  const name   = document.getElementById('rt-name').value.trim();
  const time   = document.getElementById('rt-time').value.trim();
  const start  = document.getElementById('rt-start').value;
  const repeat = document.querySelector('input[name="rt-repeat"]:checked').value;

  if (!name) { alert('Please enter an activity name.'); return; }
  if (!start){ alert('Please pick a start date.');      return; }

  const steps = getRoutineSteps();

  if (routineEditId !== null) {
    // update existing
    const idx = steps.findIndex(s => s.id === routineEditId);
    if (idx !== -1) {
      steps[idx] = { ...steps[idx], name, time, start, repeat, color: routineColor };
    }
    routineEditId = null;
  } else {
    // create new
    steps.push({
      id:     Date.now().toString(36),
      name, time, start, repeat, color: routineColor
    });
  }

  saveRoutineSteps(steps);

  // reset form
  document.getElementById('rt-name').value  = '';
  document.getElementById('rt-time').value  = '';
  document.querySelector('input[name="rt-repeat"][value="daily"]').checked = true;
  routineColor = 0;
  document.querySelectorAll('#routine-overlay .color-dot').forEach((d,i) => d.classList.toggle('active', i===0));
  document.getElementById('rt-save-btn').textContent      = '+ ADD STEP';
  document.getElementById('rt-cancel-btn').style.display  = 'none';
  document.getElementById('routine-form-title').textContent = 'Add Routine Step';

  renderRoutineList();

  // refresh calendar so new recurring events show immediately
  expandRoutineIntoCache();
  renderCalendar();
  updateStats();
  updateUpcoming();
}

function cancelRoutineEdit() {
  routineEditId = null;
  document.getElementById('rt-name').value  = '';
  document.getElementById('rt-time').value  = '';
  document.querySelector('input[name="rt-repeat"][value="daily"]').checked = true;
  routineColor = 0;
  document.querySelectorAll('#routine-overlay .color-dot').forEach((d,i) => d.classList.toggle('active', i===0));
  document.getElementById('rt-save-btn').textContent      = '+ ADD STEP';
  document.getElementById('rt-cancel-btn').style.display  = 'none';
  document.getElementById('routine-form-title').textContent = 'Add Routine Step';
}

/* ── Edit a step ── */
function editRoutineStep(id) {
  const steps = getRoutineSteps();
  const step  = steps.find(s => s.id === id);
  if (!step) return;

  routineEditId = id;
  document.getElementById('rt-name').value  = step.name;
  document.getElementById('rt-time').value  = step.time || '';
  document.getElementById('rt-start').value = step.start || '';
  document.querySelector('input[name="rt-repeat"][value="' + step.repeat + '"]').checked = true;
  routineColor = step.color || 0;
  document.querySelectorAll('#routine-overlay .color-dot').forEach((d,i) => d.classList.toggle('active', i === routineColor));

  document.getElementById('rt-save-btn').textContent      = '✓ SAVE STEP';
  document.getElementById('rt-cancel-btn').style.display  = 'inline-block';
  document.getElementById('routine-form-title').textContent = 'Edit Routine Step';
  document.getElementById('rt-name').focus();
}

/* ── Delete a step ── */
function deleteRoutineStep(id) {
  const steps = getRoutineSteps().filter(s => s.id !== id);
  saveRoutineSteps(steps);
  renderRoutineList();
  expandRoutineIntoCache();
  renderCalendar();
  updateStats();
  updateUpcoming();
}

/* ── Render the list of saved steps inside the modal ── */
function renderRoutineList() {
  const steps  = getRoutineSteps();
  const list   = document.getElementById('routine-steps-list');
  const counter = document.getElementById('routine-steps-count');
  const colorVars = ['var(--cyan)','var(--green)','var(--purple)','#f59e0b','var(--danger)'];
  const repeatLabels = { daily: 'Every day', weekly: 'Every week', yearly: 'Every year' };

  counter.textContent = steps.length + ' step' + (steps.length !== 1 ? 's' : '');

  if (!steps.length) {
    list.innerHTML = '<div class="routine-empty">No routine steps yet. Add one above!</div>';
    return;
  }

  // Sort by time of day
  const sorted = [...steps].sort((a,b) => (a.time||'').localeCompare(b.time||''));

  list.innerHTML = sorted.map(s => `
    <div class="routine-step-row">
      <div class="routine-step-dot" style="background:${colorVars[s.color||0]}"></div>
      <div class="routine-step-info">
        <div class="routine-step-name">${escHtml(s.name)}</div>
        <div class="routine-step-meta">
          ${s.time ? s.time + ' · ' : ''}
          ${repeatLabels[s.repeat] || s.repeat}
          · from ${s.start}
        </div>
      </div>
      <div class="routine-step-actions">
        <button class="routine-edit-btn"   onclick="editRoutineStep('${s.id}')">✎</button>
        <button class="routine-delete-btn" onclick="deleteRoutineStep('${s.id}')">✕</button>
      </div>
    </div>`).join('');
}

/* ── Core logic: expand routine steps into eventsCache ──
   Called after loading API tasks and after any routine change.
   We generate "virtual" event objects for the visible calendar
   month +/- a few months so they appear on the grid.
   These virtual events have ids prefixed with "rt-" so they
   are never accidentally sent to the backend.
─────────────────────────────────────────────────────────── */
function expandRoutineIntoCache() {
  const steps = getRoutineSteps();
  if (!steps.length) return;

  // Generate dates for 3 months around the current view
  const from = new Date(viewYear, viewMonth - 1, 1);
  const to   = new Date(viewYear, viewMonth + 2, 0);  // last day of month+1

  // Remove any previously expanded routine events from cache
  eventsCache = eventsCache.filter(e => !e.isRoutine);

  const colorVars = [0,1,2,3,4];

  steps.forEach(step => {
    const startDate = new Date(step.start);
    if (isNaN(startDate)) return;

    // Walk every day in range and check if this step falls on it
    const cursor = new Date(from);
    while (cursor <= to) {
      const cursorStr = cursor.toISOString().slice(0,10);
      let matches = false;

      if (step.repeat === 'daily') {
        matches = cursor >= startDate;
      } else if (step.repeat === 'weekly') {
        // same weekday as the start date
        matches = cursor >= startDate && cursor.getDay() === startDate.getDay();
      } else if (step.repeat === 'yearly') {
        // same month+day as the start date, any year from start onwards
        matches = cursor >= startDate &&
                  cursor.getMonth()  === startDate.getMonth() &&
                  cursor.getDate()   === startDate.getDate();
      }

      if (matches) {
        eventsCache.push({
          id:        'rt-' + step.id + '-' + cursorStr,
          date:      cursorStr,
          name:      step.name,
          time:      step.time || '',
          color:     step.color || 0,
          priority:  3,
          done:      false,
          isRoutine: true,   // flag so we never try to POST this to the API
          routineId: step.id
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  });
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