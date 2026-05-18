// ─── STATE ───
const D = {
  tasks: [], students: [], attendance: {}, marks: {}, exams: [],
  lessons: [], events: [], checklists: {}, notes: [], quicknote: ''
};
let editEventId = null, editNoteId = null, editStuId = null;
let quickNoteTimer = null;

// ─── API ───
const API = '/api';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map(d => d.msg || String(d)).join(', ')
      : (detail || res.statusText || 'Request failed');
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadAll() {
  const data = await api('GET', '/bootstrap');
  Object.assign(D, data);
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── DATES ───
function fmtDate(d) { const x = new Date(d); if (isNaN(x)) return d; return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr(d) { return new Date(d).toLocaleString('default', { month: 'short' }).toUpperCase(); }
function dayNum(d) { return new Date(d).getDate(); }

// ─── NAV ───
let curPage = 'dashboard';
const pageTitles = { dashboard: 'Dashboard', tasks: 'Tasks', notes: 'Notes', students: 'Students', attendance: 'Attendance', marks: 'Marks', lessons: 'Lesson Planner', events: 'Events', checklist: 'Event Checklists' };
const topbarBtns = { tasks: '+ Task', students: '+ Student', events: '+ Event' };

function nav(page, el) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelectorAll('.nav-btn').forEach(b => { if (b.textContent.toLowerCase().includes(page)) b.classList.add('active'); });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('pg-title').textContent = pageTitles[page] || page;
  curPage = page;
  const tBtn = document.getElementById('topbar-btn');
  if (topbarBtns[page]) { tBtn.style.display = 'inline-flex'; tBtn.textContent = topbarBtns[page]; }
  else tBtn.style.display = 'none';
  renderPage(page);
}

function topbarAction() {
  if (curPage === 'tasks') openTaskModal();
  else if (curPage === 'students') openStuModal();
  else if (curPage === 'events') openEventModal();
}

function renderPage(p) {
  if (p === 'dashboard') renderDashboard();
  else if (p === 'tasks') renderTasks();
  else if (p === 'students') renderStudents();
  else if (p === 'attendance') renderAttendance();
  else if (p === 'marks') renderMarks();
  else if (p === 'lessons') renderLessons();
  else if (p === 'events') renderEvents();
  else if (p === 'checklist') renderChecklistPage();
  else if (p === 'notes') renderNotes();
}

// ─── MODAL HELPERS ───
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ─── TASKS ───
function openTaskModal() { document.getElementById('t-text').value = ''; document.getElementById('t-due').value = todayStr(); openModal('modal-task'); }

async function addTask() {
  const text = document.getElementById('t-text').value.trim();
  if (!text) return;
  const task = await api('POST', '/tasks', {
    text, type: document.getElementById('t-type').value,
    priority: document.getElementById('t-prio').value,
    due: document.getElementById('t-due').value,
    time: document.getElementById('t-time').value,
    done: false, created: todayStr()
  });
  D.tasks.push(task);
  closeModal('modal-task'); renderTasks(); updateCounts(); renderDashboard();
}

async function toggleTask(id) {
  const res = await api('PATCH', '/tasks/' + id);
  const t = D.tasks.find(x => x.id === id);
  if (t) t.done = res.done;
  renderTasks(); updateCounts(); renderDashboard();
}

async function deleteTask(id) {
  await api('DELETE', '/tasks/' + id);
  D.tasks = D.tasks.filter(x => x.id !== id);
  renderTasks(); updateCounts(); renderDashboard();
}

function renderTasks() {
  const ft = document.getElementById('task-filter-type')?.value || '';
  const fs = document.getElementById('task-filter-status')?.value || '';
  let list = D.tasks.filter(t => (ft === '' || t.type === ft) && (fs === '' || (fs === 'done' ? t.done : !t.done)));
  list.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const po = { High: 0, Medium: 1, Low: 2 };
    return po[a.priority] - po[b.priority];
  });
  const el = document.getElementById('task-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">✅</div>No tasks found</div>'; return; }
  el.innerHTML = list.map(t => `
    <div class="task-item">
      <div class="prio prio-${t.priority.toLowerCase()}"></div>
      <div class="task-cb ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id})">${t.done ? '✓' : ''}</div>
      <div class="task-body">
        <div class="task-text ${t.done ? 'done' : ''}">${esc(t.text)}</div>
        <div class="task-meta">
          <span class="badge badge-${t.type === 'Teaching' ? 'teal' : t.type === 'Event' ? 'coral' : 'purple'}">${esc(t.type)}</span>
          ${t.due ? `<span>Due: ${fmtDate(t.due)}${t.time ? ' ' + esc(t.time) : ''}</span>` : ''}
        </div>
      </div>
      <button class="task-del" onclick="deleteTask(${t.id})">🗑</button>
    </div>`).join('');
}

// ─── STUDENTS ───
function stuFormData() {
  return {
    name: document.getElementById('s-name').value.trim(),
    roll: document.getElementById('s-roll').value,
    cls: document.getElementById('s-class').value.trim(),
    section: document.getElementById('s-sec').value.trim(),
    contact: document.getElementById('s-contact').value.trim()
  };
}

function openStuModal(id) {
  editStuId = id || null;
  const s = id ? D.students.find(x => x.id === id) : null;
  document.getElementById('stu-modal-title').innerHTML = (s ? 'Edit student' : 'Add student') + ' <button class="modal-close" onclick="closeModal(\'modal-student\')">✕</button>';
  document.getElementById('stu-save-btn').textContent = s ? 'Save changes' : 'Add student';
  document.getElementById('s-name').value = s?.name || '';
  document.getElementById('s-roll').value = s?.roll || '';
  document.getElementById('s-class').value = s?.cls || '';
  document.getElementById('s-sec').value = s?.section || '';
  document.getElementById('s-contact').value = s?.contact || '';
  openModal('modal-student');
}

async function saveStudent() {
  const data = stuFormData();
  if (!data.name) return;
  try {
    if (editStuId) {
      const s = await api('PUT', '/students/' + editStuId, data);
      const idx = D.students.findIndex(x => x.id === editStuId);
      if (idx >= 0) D.students[idx] = s;
    } else {
      const s = await api('POST', '/students', data);
      D.students.push(s);
    }
    closeModal('modal-student');
    renderStudents(); updateCounts(); renderDashboard();
    populateClassDropdowns();
  } catch (e) { alert(e.message); }
}

async function deleteStudent(id) {
  if (!confirm('Remove this student?')) return;
  await api('DELETE', '/students/' + id);
  D.students = D.students.filter(x => x.id !== id);
  renderStudents(); updateCounts(); renderDashboard();
  populateClassDropdowns();
}

function getAvg(id) {
  const sid = String(id);
  const entries = [];
  D.exams.forEach(ex => {
    const m = D.marks[ex.id]?.[sid] ?? D.marks[ex.id]?.[id];
    if (m !== undefined && m !== '') entries.push({ got: parseFloat(m), max: ex.max });
  });
  if (!entries.length) return null;
  return Math.round(entries.reduce((a, e) => a + e.got / e.max * 100, 0) / entries.length);
}

function renderStudents() {
  const q = (document.getElementById('stu-search')?.value || '').toLowerCase();
  const list = D.students.filter(s => s.name.toLowerCase().includes(q));
  const tbody = document.getElementById('stu-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">👨‍🎓</div>No students yet. Add one!</div></td></tr>'; return; }
  tbody.innerHTML = list.map((s, i) => {
    const avg = getAvg(s.id);
    const gc = avg === null ? '' : avg >= 70 ? 'green' : avg >= 50 ? 'amber' : 'coral';
    return `<tr>
      <td>${i + 1}</td><td><strong>${esc(s.name)}</strong>${s.roll ? ` <span style="color:var(--text3);font-size:0.75rem">#${esc(s.roll)}</span>` : ''}</td>
      <td>${esc(s.cls) || '—'}</td><td>${esc(s.section) || '—'}</td><td>${esc(s.contact) || '—'}</td>
      <td>${avg !== null ? `<span class="badge badge-${gc}">${avg}%</span>` : '—'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openStuModal(${s.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteStudent(${s.id})">Remove</button>
      </td>
    </tr>`;
  }).join('');
}

// ─── ATTENDANCE ───
function renderAttendance() {
  const date = document.getElementById('att-date')?.value || todayStr();
  const cls = document.getElementById('att-class')?.value || '';
  const list = D.students.filter(s => !cls || s.cls === cls);
  if (!D.attendance[date]) D.attendance[date] = {};
  const tbody = document.getElementById('att-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty">No students. Add students first.</div></td></tr>'; updateAttCounts(date); return; }
  tbody.innerHTML = list.map((s, i) => {
    const st = D.attendance[date][s.id] || D.attendance[date][String(s.id)] || 'P';
    return `<tr>
      <td>${i + 1}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.cls) || '—'}</td>
      <td><div class="att-status">
        <button class="att-btn P ${st === 'P' ? 'active' : ''}" onclick="setAtt(${s.id},'P','${date}',this)">P</button>
        <button class="att-btn A ${st === 'A' ? 'active' : ''}" onclick="setAtt(${s.id},'A','${date}',this)">A</button>
        <button class="att-btn L ${st === 'L' ? 'active' : ''}" onclick="setAtt(${s.id},'L','${date}',this)">L</button>
      </div></td>
    </tr>`;
  }).join('');
  updateAttCounts(date);
}

async function setAtt(sid, status, date, btn) {
  if (!D.attendance[date]) D.attendance[date] = {};
  D.attendance[date][sid] = status;
  D.attendance[date][String(sid)] = status;
  await api('PUT', '/attendance', { date, student_id: sid, status });
  btn.closest('.att-status').querySelectorAll('.att-btn').forEach(b => {
    b.classList.remove('active');
    if (b.textContent === status) b.classList.add('active');
  });
  updateAttCounts(date);
}

function updateAttCounts(date) {
  if (!D.attendance[date]) {
    document.getElementById('att-p-cnt').textContent = 'P: 0';
    document.getElementById('att-a-cnt').textContent = 'A: 0';
    document.getElementById('att-l-cnt').textContent = 'L: 0';
    return;
  }
  const vals = Object.values(D.attendance[date]);
  document.getElementById('att-p-cnt').textContent = 'P: ' + vals.filter(v => v === 'P').length;
  document.getElementById('att-a-cnt').textContent = 'A: ' + vals.filter(v => v === 'A').length;
  document.getElementById('att-l-cnt').textContent = 'L: ' + vals.filter(v => v === 'L').length;
}

// ─── MARKS ───
function openExamModal() { ['ex-name', 'ex-subject', 'ex-date', 'ex-max'].forEach(id => document.getElementById(id).value = ''); openModal('modal-exam'); }

async function addExam() {
  const name = document.getElementById('ex-name').value.trim();
  if (!name) return;
  const ex = await api('POST', '/exams', {
    name, subject: document.getElementById('ex-subject').value,
    date: document.getElementById('ex-date').value,
    max: parseFloat(document.getElementById('ex-max').value) || 100
  });
  D.exams.push(ex);
  closeModal('modal-exam');
  populateExamSelect();
  document.getElementById('marks-exam').value = ex.id;
  renderMarks();
}

function getGrade(pct) { return pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F'; }
function getGradeColor(pct) { return pct >= 70 ? 'green' : pct >= 50 ? 'amber' : 'coral'; }

function renderMarks() {
  const examId = document.getElementById('marks-exam')?.value;
  const cls = document.getElementById('marks-class')?.value || '';
  const ex = D.exams.find(e => String(e.id) === String(examId));
  const tbody = document.getElementById('marks-tbody');
  if (!tbody) return;
  const list = D.students.filter(s => !cls || s.cls === cls);
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty">No students found.</div></td></tr>'; return; }
  if (!ex) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty">Select or create an exam above.</div></td></tr>'; return; }
  if (!D.marks[examId]) D.marks[examId] = {};
  tbody.innerHTML = list.map((s, i) => {
    const m = D.marks[examId][s.id] ?? D.marks[examId][String(s.id)] ?? '';
    const pct = m !== '' ? Math.round(parseFloat(m) / ex.max * 100) : null;
    const grade = pct !== null ? getGrade(pct) : '—';
    const gc = pct !== null ? getGradeColor(pct) : '';
    return `<tr>
      <td>${i + 1}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.cls) || '—'}</td>
      <td><input class="mark-input" type="number" min="0" max="${ex.max}" value="${m}" id="mark-${s.id}" placeholder="—"></td>
      <td>${ex.max}</td>
      <td>${pct !== null ? pct + '%' : '—'}</td>
      <td>${pct !== null ? `<span class="mark-grade badge badge-${gc}">${grade}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

async function saveMarks() {
  const examId = document.getElementById('marks-exam')?.value;
  if (!examId) return;
  const marks = {};
  D.students.forEach(s => {
    const inp = document.getElementById('mark-' + s.id);
    if (inp) marks[String(s.id)] = inp.value;
  });
  await api('PUT', '/marks', { exam_id: parseInt(examId, 10), marks });
  D.marks[examId] = marks;
  renderMarks(); renderStudents(); renderDashboard();
  const btn = document.querySelector('[onclick="saveMarks()"]');
  btn.textContent = '✓ Saved!';
  setTimeout(() => btn.textContent = '💾 Save marks', 1500);
}

// ─── LESSONS ───
function openLessonModal() { openModal('modal-lesson'); }

async function addLesson() {
  const subj = document.getElementById('l-subject').value.trim();
  if (!subj) return;
  const l = await api('POST', '/lessons', {
    day: document.getElementById('l-day').value,
    time: document.getElementById('l-time').value,
    subject: subj,
    cls: document.getElementById('l-class').value,
    topic: document.getElementById('l-topic').value,
    status: 'Pending'
  });
  D.lessons.push(l);
  closeModal('modal-lesson');
  renderLessons();
}

async function toggleLessonStatus(id) {
  const res = await api('PATCH', '/lessons/' + id);
  const l = D.lessons.find(x => x.id === id);
  if (l) l.status = res.status;
  renderLessons();
}

async function deleteLesson(id) {
  await api('DELETE', '/lessons/' + id);
  D.lessons = D.lessons.filter(x => x.id !== id);
  renderLessons();
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function renderLessons() {
  const tbody = document.getElementById('lessons-tbody');
  if (!tbody) return;
  const sorted = [...D.lessons].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  if (!sorted.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">📚</div>No lessons yet.</div></td></tr>'; return; }
  const sc = { Pending: 'badge-amber', Completed: 'badge-green', Postponed: 'badge-coral' };
  tbody.innerHTML = sorted.map(l => `<tr>
    <td>${esc(l.day)}</td><td>${esc(l.time) || '—'}</td><td><strong>${esc(l.subject)}</strong></td><td>${esc(l.cls) || '—'}</td><td>${esc(l.topic) || '—'}</td>
    <td><span class="badge ${sc[l.status] || 'badge-amber'}" style="cursor:pointer" onclick="toggleLessonStatus(${l.id})" title="Click to change">${esc(l.status)}</span></td>
    <td><button class="btn btn-ghost btn-sm" onclick="deleteLesson(${l.id})">Remove</button></td>
  </tr>`).join('');
}

// ─── EVENTS ───
function openEventModal(id) {
  editEventId = id || null;
  const ev = id ? D.events.find(e => e.id === id) : null;
  document.getElementById('ev-modal-title').innerHTML = (ev ? 'Edit event' : 'New event') + ' <button class="modal-close" onclick="closeModal(\'modal-event\')">✕</button>';
  document.getElementById('ev-name').value = ev?.name || '';
  document.getElementById('ev-date').value = ev?.date || todayStr();
  document.getElementById('ev-time').value = ev?.time || '';
  document.getElementById('ev-venue').value = ev?.venue || '';
  document.getElementById('ev-status').value = ev?.status || 'Planning';
  document.getElementById('ev-notes').value = ev?.notes || '';
  openModal('modal-event');
}

async function saveEvent() {
  const name = document.getElementById('ev-name').value.trim();
  if (!name) return;
  const payload = {
    name, date: document.getElementById('ev-date').value,
    time: document.getElementById('ev-time').value,
    venue: document.getElementById('ev-venue').value,
    status: document.getElementById('ev-status').value,
    notes: document.getElementById('ev-notes').value
  };
  if (editEventId) {
    await api('PUT', '/events/' + editEventId, payload);
    const idx = D.events.findIndex(e => e.id === editEventId);
    if (idx >= 0) D.events[idx] = { id: editEventId, ...payload };
  } else {
    const ev = await api('POST', '/events', payload);
    D.events.push(ev);
  }
  closeModal('modal-event');
  renderEvents(); updateCounts(); renderDashboard();
  populateEventSelects();
}

async function deleteEvent(id) {
  await api('DELETE', '/events/' + id);
  D.events = D.events.filter(x => x.id !== id);
  delete D.checklists[id];
  renderEvents(); updateCounts(); renderDashboard();
  populateEventSelects();
}

function renderEvents() {
  const fil = document.getElementById('ev-filter')?.value || '';
  const list = [...D.events].filter(e => !fil || e.status === fil).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const el = document.getElementById('events-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🎉</div>No events yet. Add one!</div>'; return; }
  const sc = { Planning: 'badge-blue', 'In Progress': 'badge-amber', Done: 'badge-green' };
  el.innerHTML = list.map(ev => `
    <div class="ev-card">
      <div class="ev-date"><div style="font-size:9px;color:var(--text3)">${ev.date ? monthStr(ev.date) : ''}</div><span>${ev.date ? dayNum(ev.date) : '?'}</span></div>
      <div class="ev-body">
        <div class="ev-title">${esc(ev.name)}</div>
        <div class="ev-meta">${ev.venue ? esc(ev.venue) + ' · ' : ''}${esc(ev.time) || ''}</div>
        ${ev.notes ? `<div style="font-size:0.76rem;color:var(--text3);margin-top:4px">${esc(ev.notes)}</div>` : ''}
      </div>
      <div class="ev-actions">
        <span class="badge ${sc[ev.status] || 'badge-blue'}">${esc(ev.status)}</span>
        <button class="btn btn-ghost btn-sm" onclick="openEventModal(${ev.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteEvent(${ev.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ─── CHECKLISTS ───
function renderChecklistPage() {
  const sel = document.getElementById('cl-event-sel');
  if (!sel) return;
  const evId = sel.value;
  if (!evId) { document.getElementById('cl-list').innerHTML = '<div class="empty">Select an event above to manage its checklist.</div>'; return; }
  if (!D.checklists[evId]) D.checklists[evId] = [];
  const list = D.checklists[evId];
  document.getElementById('cl-list').innerHTML = list.length ? list.map(item => `
    <div class="task-item">
      <div class="task-cb ${item.done ? 'checked' : ''}" onclick="toggleCheckItem('${evId}',${item.id})">${item.done ? '✓' : ''}</div>
      <div class="task-body"><div class="task-text ${item.done ? 'done' : ''}">${esc(item.text)}</div></div>
      <button class="task-del" onclick="deleteCheckItem('${evId}',${item.id})">🗑</button>
    </div>`).join('') : '<div class="empty">No checklist items. Click "+ Add item" to start.</div>';
}

async function addCheckItem() {
  const evId = document.getElementById('cl-event-sel')?.value;
  if (!evId) { alert('Select an event first.'); return; }
  const text = prompt('Checklist item:');
  if (!text || !text.trim()) return;
  const item = await api('POST', '/checklists/' + evId + '/items', { text: text.trim(), done: false });
  if (!D.checklists[evId]) D.checklists[evId] = [];
  D.checklists[evId].push(item);
  renderChecklistPage();
}

async function toggleCheckItem(evId, itemId) {
  const res = await api('PATCH', '/checklists/' + evId + '/items/' + itemId);
  const item = D.checklists[evId]?.find(x => x.id === itemId);
  if (item) item.done = res.done;
  renderChecklistPage();
}

async function deleteCheckItem(evId, itemId) {
  await api('DELETE', '/checklists/' + evId + '/items/' + itemId);
  if (D.checklists[evId]) D.checklists[evId] = D.checklists[evId].filter(x => x.id !== itemId);
  renderChecklistPage();
}

// ─── NOTES ───
function openNoteModal() {
  editNoteId = null;
  document.getElementById('note-editor').style.display = 'block';
  document.getElementById('notes-grid').style.display = 'none';
  document.getElementById('note-edit-title').value = '';
  document.getElementById('note-edit-body').value = '';
}

function openNoteEditor(id) {
  editNoteId = id;
  const n = D.notes.find(x => x.id === id);
  if (!n) return;
  document.getElementById('note-edit-title').value = n.title;
  document.getElementById('note-edit-body').value = n.body;
  document.getElementById('note-edit-cat').value = n.category || 'Personal';
  document.getElementById('note-editor').style.display = 'block';
  document.getElementById('notes-grid').style.display = 'none';
}

function closeNoteEditor() {
  document.getElementById('note-editor').style.display = 'none';
  document.getElementById('notes-grid').style.display = 'grid';
  renderNotes();
}

async function saveCurrentNote() {
  const title = document.getElementById('note-edit-title').value.trim() || 'Untitled';
  const body = document.getElementById('note-edit-body').value;
  const category = document.getElementById('note-edit-cat').value;
  const now = new Date().toLocaleString();
  if (editNoteId) {
    await api('PUT', '/notes/' + editNoteId, { title, body, category, created: '', updated: now });
    const n = D.notes.find(x => x.id === editNoteId);
    if (n) { n.title = title; n.body = body; n.category = category; n.updated = now; }
  } else {
    const n = await api('POST', '/notes', { title, body, category, created: now, updated: now });
    D.notes.push(n);
  }
  closeNoteEditor();
}

async function deleteNote(id, e) {
  e.stopPropagation();
  await api('DELETE', '/notes/' + id);
  D.notes = D.notes.filter(x => x.id !== id);
  renderNotes();
}

function renderNotes() {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;
  if (!D.notes.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📝</div>No notes yet. Click "+ New note" to start.</div>'; return; }
  const cc = { Teaching: 'badge-teal', Event: 'badge-coral', Personal: 'badge-purple' };
  grid.innerHTML = D.notes.map(n => `
    <div class="note-card" onclick="openNoteEditor(${n.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div class="note-card-title">${esc(n.title)}</div>
        <button class="task-del" onclick="deleteNote(${n.id},event)">🗑</button>
      </div>
      ${n.category ? `<span class="badge ${cc[n.category] || 'badge-purple'}" style="margin-bottom:6px;display:inline-block">${esc(n.category)}</span>` : ''}
      <div class="note-card-preview">${esc(n.body) || '(empty)'}</div>
      <div class="note-card-meta">${esc(n.updated || n.created || '')}</div>
    </div>`).join('');
}

// ─── QUICK NOTE ───
function onQuickNoteInput(val) {
  D.quicknote = val;
  clearTimeout(quickNoteTimer);
  quickNoteTimer = setTimeout(() => api('PUT', '/settings/quicknote', { value: val }).catch(() => {}), 500);
}

// ─── DASHBOARD ───
function renderDashboard() {
  const pending = D.tasks.filter(t => !t.done);
  document.getElementById('d-tasks').textContent = pending.length;
  document.getElementById('d-students').textContent = D.students.length;
  const today = todayStr();
  const upcomingEvs = D.events.filter(e => e.date >= today && e.status !== 'Done');
  document.getElementById('d-events').textContent = upcomingEvs.length;
  const attToday = D.attendance[today] ? Object.values(D.attendance[today]) : [];
  const p = attToday.filter(v => v === 'P').length;
  const tot = D.students.length;
  document.getElementById('d-att').textContent = tot ? p + '/' + tot : '—';

  const dtEl = document.getElementById('dash-tasks');
  const todayTasks = D.tasks.filter(t => t.due === today || (!t.due && !t.done)).slice(0, 6);
  dtEl.innerHTML = todayTasks.length ? todayTasks.map(t => `
    <div class="task-item">
      <div class="prio prio-${t.priority.toLowerCase()}"></div>
      <div class="task-cb ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id});renderDashboard()">${t.done ? '✓' : ''}</div>
      <div class="task-body"><div class="task-text ${t.done ? 'done' : ''}">${esc(t.text)}</div>
      <div class="task-meta"><span class="badge badge-${t.type === 'Teaching' ? 'teal' : t.type === 'Event' ? 'coral' : 'purple'}">${esc(t.type)}</span></div></div>
    </div>`).join('') : '<div class="empty" style="padding:1.5rem">No tasks for today 🎉</div>';

  const deEl = document.getElementById('dash-events');
  const ev3 = upcomingEvs.slice(0, 4);
  const sc = { Planning: 'badge-blue', 'In Progress': 'badge-amber', Done: 'badge-green' };
  deEl.innerHTML = ev3.length ? ev3.map(e => `
    <div class="ev-card" style="padding:0.75rem 1rem;margin-bottom:8px">
      <div class="ev-date" style="min-width:40px;height:40px"><div style="font-size:9px">${e.date ? monthStr(e.date) : ''}</div><span style="font-size:1.1rem">${e.date ? dayNum(e.date) : '?'}</span></div>
      <div class="ev-body"><div class="ev-title" style="font-size:0.84rem">${esc(e.name)}</div><div class="ev-meta">${esc(e.venue) || ''}</div></div>
      <span class="badge ${sc[e.status] || 'badge-blue'}" style="font-size:0.65rem">${esc(e.status)}</span>
    </div>`).join('') : '<div class="empty" style="padding:1.5rem">No upcoming events</div>';

  const tsEl = document.getElementById('dash-top-students');
  const ranked = D.students.map(s => ({ ...s, avg: getAvg(s.id) })).filter(s => s.avg !== null).sort((a, b) => b.avg - a.avg).slice(0, 5);
  tsEl.innerHTML = ranked.length ? ranked.map((s, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="width:22px;height:22px;border-radius:50%;background:${['var(--amber)', 'var(--text3)', 'rgba(205,127,50,0.6)'][i] || 'var(--surface2)'};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--bg)">${i + 1}</div>
      <div style="flex:1;font-size:0.84rem">${esc(s.name)}</div>
      <span class="badge badge-${getGradeColor(s.avg)}">${s.avg}%</span>
    </div>`).join('') : '<div class="empty" style="padding:1.5rem">No marks recorded yet</div>';
}

// ─── COUNTS & SELECTS ───
function updateCounts() {
  document.getElementById('cnt-tasks').textContent = D.tasks.filter(t => !t.done).length;
  document.getElementById('cnt-events').textContent = D.events.filter(e => e.date >= todayStr() && e.status !== 'Done').length;
}

function populateClassDropdowns() {
  const classes = [...new Set(D.students.map(s => s.cls).filter(Boolean))].sort();
  ['att-class', 'marks-class'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">All classes</option>' + classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

function populateEventSelects() {
  const sel = document.getElementById('cl-event-sel');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select event…</option>' + D.events.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

function populateExamSelect() {
  const sel = document.getElementById('marks-exam');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select exam…</option>' + D.exams.map(e => `<option value="${e.id}">${esc(e.name)} — ${esc(e.subject)}</option>`).join('');
  if (cur) sel.value = cur;
}

// ─── INIT ───
async function init() {
  try {
    await loadAll();
  } catch (e) {
    document.querySelector('.content').innerHTML = `<div class="empty" style="padding:3rem"><div class="empty-icon">⚠️</div><p>Could not connect to server.</p><p style="margin-top:8px;color:var(--text3)">Run: <code>uvicorn main:app --reload</code></p><p style="color:var(--coral);margin-top:8px">${esc(e.message)}</p></div>`;
    return;
  }
  const now = new Date();
  const ds = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('sb-date').textContent = ds;
  document.getElementById('top-date').textContent = ds;
  document.getElementById('att-date').value = todayStr();
  const qn = document.getElementById('quick-note');
  if (qn) {
    qn.value = D.quicknote || '';
    qn.oninput = function () { onQuickNoteInput(this.value); };
  }
  populateClassDropdowns();
  populateEventSelects();
  populateExamSelect();
  updateCounts();
  renderDashboard();
}

init();
