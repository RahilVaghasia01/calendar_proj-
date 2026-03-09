/* ============================================
   WIZZ · Space Calendar — JavaScript
   app.js  (Frontend-only edition — no backend needed)
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
   LOCAL STORAGE HELPERS
   Users & events are stored in localStorage
   ============================================ */
function getUsers()         { return JSON.parse(localStorage.getItem('wizz_users')  || '[]'); }
function saveUsers(u)       { localStorage.setItem('wizz_users',  JSON.stringify(u)); }
function getEvents()        { return JSON.parse(localStorage.getItem('wizz_events') || '[]'); }
function saveEvents(e)      { localStorage.setItem('wizz_events', JSON.stringify(e)); }
function getSession()       { return sessionStorage.getItem('wizz_user') || null; }
function setSession(u)      { sessionStorage.setItem('wizz_user', u); }
function clearSession()     { sessionStorage.removeItem('wizz_user'); }
function genId()            { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

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

/* ============================================
   AUTH — LOGIN
   ============================================ */
document.getElementById('loginBtn').onclick = () => {
  const ident = document.getElementById('l-ident').value.trim().toLowerCase();
  const pass  = document.getElementById('l-pass').value;
  const err   = document.getElementById('login-err');
  err.textContent = '';

  if (!ident || !pass) { err.textContent = '⚠ All fields required.'; return; }

  const users = getUsers();
  const user  = users.find(u => (u.username.toLowerCase() === ident || u.email.toLowerCase() === ident) && u.password === pass);

  if (!user) { err.textContent = '⚠ Invalid credentials. Check username/email and access code.'; return; }

  setSession(user.username);
  launchApp(user.username);
};

/* ============================================
   AUTH — REGISTER
   ============================================ */
document.getElementById('registerBtn').onclick = () => {
  const username = document.getElementById('r-user').value.trim();
  const email    = document.getElementById('r-email').value.trim().toLowerCase();
  const pass     = document.getElementById('r-pass').value;
  const pass2    = document.getElementById('r-pass2').value;
  const err      = document.getElementById('reg-err');
  const ok       = document.getElementById('reg-ok');
  err.textContent = ''; ok.textContent = '';

  if (!username || !email || !pass || !pass2) { err.textContent = '⚠ All fields required.'; return; }
  if (pass.length < 6)                        { err.textContent = '⚠ Code must be 6+ characters.'; return; }
  if (pass !== pass2)                         { err.textContent = '⚠ Codes do not match.'; return; }
  if (!/\S+@\S+\.\S+/.test(email))           { err.textContent = '⚠ Invalid email format.'; return; }

  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    err.textContent = '⚠ Username already taken.'; return;
  }
  if (users.find(u => u.email === email)) {
    err.textContent = '⚠ Email already registered.'; return;
  }

  users.push({ username, email, password: pass, created: new Date().toISOString() });
  saveUsers(users);

  ok.textContent = '✓ Account created! Taking you to login...';
  setTimeout(() => showPage('login'), 1400);
};

/* ── LOGOUT ── */
function logout() {
  clearSession();
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
let selectedColor = 0;
let editingId     = null;   // null = adding new, string = editing existing

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function getUserEvents() {
  const user = getSession();
  return getEvents().filter(e => e.owner === user);
}

function initCalendar() {
  const now = new Date();
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth();
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
  const cachedEvents = getUserEvents();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)   cells.push({ day: daysInPrev - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++)      cells.push({ day: d,             cur: true  });
  while (cells.length % 7 !== 0)             cells.push({ day: cells.length - firstDay - daysInMonth + 1, cur: false });

  cells.forEach(({ day, cur }) => {
    const cell = document.createElement('div');
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

      const dayEvents = cachedEvents.filter(e => e.date === dateStr);

      cell.innerHTML = `
        <div class="cell-num">${day}</div>
        <div class="cell-events">
          ${dayEvents.slice(0, 3).map(e => `<div class="ev-chip c${e.color}">${e.name}</div>`).join('')}
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
  document.getElementById('add-btn').textContent   = '+ ADD';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('form-heading').textContent = 'New Event';
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
    <div class="ev-row" id="ev-row-${e.id}">
      <div class="ev-row-left">
        <div class="ev-dot" style="background:${colorVars[e.color]}"></div>
        <div>
          <div class="ev-name">${e.name}</div>
          <div class="ev-time">${e.time || 'All day'}</div>
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

/* ── START EDITING AN EVENT ── */
function startEdit(id) {
  const allEvents = getEvents();
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;

  editingId = id;
  document.getElementById('ev-name').value  = ev.name;
  document.getElementById('ev-time').value  = ev.time || '';
  selectedColor = ev.color;
  document.querySelectorAll('.color-dot').forEach((d,i) => d.classList.toggle('active', i === ev.color));

  document.getElementById('add-btn').textContent            = '✓ SAVE';
  document.getElementById('cancel-edit-btn').style.display  = 'inline-block';
  document.getElementById('form-heading').textContent        = 'Edit Event';

  // Highlight the row being edited
  document.querySelectorAll('.ev-row').forEach(r => r.classList.remove('editing'));
  const row = document.getElementById('ev-row-' + id);
  if (row) row.classList.add('editing');

  document.getElementById('ev-name').focus();
}

/* ── ADD OR SAVE EVENT ── */
function addEvent() {
  const name = document.getElementById('ev-name').value.trim();
  if (!name || !selectedDate) return;

  const user      = getSession();
  const allEvents = getEvents();

  if (editingId) {
    // UPDATE existing
    const idx = allEvents.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      allEvents[idx].name  = name;
      allEvents[idx].time  = document.getElementById('ev-time').value.trim();
      allEvents[idx].color = selectedColor;
    }
    saveEvents(allEvents);
    resetForm();
    renderEventList(selectedDate);
    renderCalendar();
    updateStats();
    updateUpcoming();
  } else {
    // CREATE new
    const newEvent = {
      id:      genId(),
      owner:   user,
      date:    selectedDate,
      name,
      time:    document.getElementById('ev-time').value.trim(),
      color:   selectedColor,
      created: new Date().toISOString()
    };
    allEvents.push(newEvent);
    saveEvents(allEvents);
    resetForm();
    renderEventList(selectedDate);
    renderCalendar();
    updateStats();
    updateUpcoming();
  }
}

/* ── DELETE EVENT ── */
function deleteEvent(id) {
  const allEvents = getEvents().filter(e => e.id !== id);
  saveEvents(allEvents);
  if (editingId === id) resetForm();
  renderEventList(selectedDate);
  renderCalendar();
  updateStats();
  updateUpcoming();
}

/* ============================================
   SIDEBAR STATS
   ============================================ */
function updateStats() {
  const now        = new Date();
  const cachedEvents = getUserEvents();

  const monthEvents = cachedEvents.filter(e => {
    const [y, m] = e.date.split('-');
    return parseInt(y) === viewYear && parseInt(m) - 1 === viewMonth;
  });

  const next7Days = cachedEvents.filter(e => {
    const diff = (new Date(e.date) - now) / 864e5;
    return diff >= 0 && diff <= 7;
  });

  document.getElementById('stat-total').textContent = cachedEvents.length;
  document.getElementById('stat-month').textContent = monthEvents.length;
  document.getElementById('stat-week').textContent  = next7Days.length;
}

function updateUpcoming() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const events = getUserEvents()
    .filter(e => new Date(e.date) >= now)
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
        <div class="up-name">${e.name}</div>
        <div class="up-when">${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)} · ${e.time || 'All day'}</div>
      </div>`;
  }).join('');
}

/* ============================================
   EXPORT CSV
   ============================================ */
function exportCSV() {
  const cachedEvents = getUserEvents();
  if (!cachedEvents.length) { alert('No events to export!'); return; }

  const colorNames = ['Cyan','Green','Purple','Amber','Red'];
  const rows = [
    ['ID','Date','Event Name','Time','Color','Created'],
    ...cachedEvents.map(e => [e.id, e.date, e.name, e.time||'All day', colorNames[e.color]||'', e.created])
  ];

  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `wizz_events_${getSession()}_${new Date().toISOString().slice(0,10)}.csv`;
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

/* ============================================
   BOOT
   ============================================ */
window.addEventListener('load', () => {
  const session = getSession();
  if (session) launchApp(session);
  else         showPage('login');
});