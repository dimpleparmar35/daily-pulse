import './style.css';
import Chart from 'chart.js/auto';
import { createIcons, Plus, Trash2, Check, X, Clock, Calendar, BarChart2, BookOpen } from 'lucide';

const API_URL = 'http://localhost:5000/api';

// --- State Management ---
let state = {
  tasks: [],
  history: {},
  diary: {},
  streak: parseInt(localStorage.getItem('streak')) || 0,
  lastActive: localStorage.getItem('lastActive') || null,
  remindersEnabled: localStorage.getItem('remindersEnabled') === 'true'
};

const saveMetaState = () => {
  localStorage.setItem('streak', state.streak.toString());
  localStorage.setItem('lastActive', state.lastActive);
  localStorage.setItem('remindersEnabled', state.remindersEnabled.toString());
};

// --- Utilities ---
const getTodayKey = () => new Date().toISOString().split('T')[0];

const updateDateDisplay = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = new Date().toLocaleDateString('en-US', options);
  const curDateEl = document.getElementById('current-date');
  const diaryDateEl = document.getElementById('diary-date');
  if (curDateEl) curDateEl.textContent = dateStr;
  if (diaryDateEl) diaryDateEl.textContent = dateStr;
};

// --- API Sync ---
const fetchTasks = async (date = getTodayKey()) => {
  try {
    const res = await fetch(`${API_URL}/tasks/${date}`);
    state.tasks = await res.json();
    renderTasks();
    renderTimeline();
    updateCharts();
  } catch (e) { console.error('Fetch tasks failed', e); }
};

const fetchHistory = async () => {
  try {
    const res = await fetch(`${API_URL}/history`);
    state.history = await res.json();
    if (document.getElementById('analytics-view') && !document.getElementById('analytics-view').classList.contains('hidden')) {
      renderHeatmap();
      updatePulseAnalytics();
    }
  } catch (e) { console.error('Fetch history failed', e); }
};

// --- Task & Reminder Logic ---
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    state.remindersEnabled = (permission === 'granted');
    saveMetaState();
  }
};

const addTask = async (title, priority, time) => {
  const date = getTodayKey();
  try {
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, time, date })
    });
    fetchTasks();
    if (time && !state.remindersEnabled) requestNotificationPermission();
  } catch (e) { console.error('Add task failed', e); }
};

const toggleTask = async (id, completed) => {
  try {
    await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed })
    });
    fetchTasks();
  } catch (e) { console.error('Toggle task failed', e); }
};

const deleteTask = async (id) => {
  try {
    await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  } catch (e) { console.error('Delete task failed', e); }
};

// --- Diary Logic ---
const loadDiaryEntry = async () => {
  const today = getTodayKey();
  try {
    const res = await fetch(`${API_URL}/diary/${today}`);
    const data = await res.json();
    document.getElementById('diary-input').value = data.content || '';
  } catch (e) { console.error('Load diary failed', e); }
};

const saveDiaryEntry = async () => {
  const today = getTodayKey();
  const content = document.getElementById('diary-input').value;
  try {
    await fetch(`${API_URL}/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, date: today })
    });
    const status = document.getElementById('save-status');
    status.textContent = 'Entry Saved!';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 2000);
  } catch (e) { console.error('Save diary failed', e); }
};

// --- Structured Reference: Timeline View ---
const renderTimeline = () => {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Sort tasks by time
  const timedTasks = state.tasks
    .filter(t => t.time)
    .sort((a, b) => a.time.localeCompare(b.time));
    
  if (timedTasks.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Set times for tasks to see your timeline.</p>';
    return;
  }

  timedTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <div class="time">${task.time}</div>
      <div class="dot ${task.completed ? 'completed' : ''}"></div>
      <div class="content glass">
        <div class="title">${task.title}</div>
        <span class="tag priority-${task.priority}">${task.priority}</span>
      </div>
    `;
    container.appendChild(item);
  });
};

// --- View Toggling ---
const switchView = (view) => {
  const views = ['planner-view', 'diary-view', 'analytics-view'];
  const buttons = ['show-planner', 'show-diary', 'show-analytics'];
  
  views.forEach(v => document.getElementById(v).classList.add('hidden'));
  buttons.forEach(b => document.getElementById(b).classList.remove('active'));

  const activeView = document.getElementById(`${view}-view`);
  const activeBtn = document.getElementById(`show-${view}`);
  
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) activeBtn.classList.add('active');

  if (view === 'diary') loadDiaryEntry();
  if (view === 'analytics') {
    fetchHistory();
  }
};

// --- UI Rendering ---
const renderTasks = () => {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  taskList.innerHTML = '';

  if (state.tasks.length === 0) {
    taskList.innerHTML = '<div class="stat-card glass" style="text-align:center; padding: 3rem; color: var(--text-secondary)">No tasks for today. Start fresh!</div>';
    return;
  }

  state.tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="window.toggleTask(${task.id}, ${task.completed})">
        ${task.completed ? '<i data-lucide="check"></i>' : ''}
      </div>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
          <span class="task-priority-tag priority-${task.priority}">${task.priority}</span>
          ${task.time ? `<span style="color: var(--text-secondary); font-size: 0.8rem;"><i data-lucide="clock" style="width: 12px; height: 12px; margin-right: 4px;"></i>${task.time}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn delete" onclick="window.deleteTask(${task.id})">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    taskList.appendChild(item);
  });
  createIcons();
};

// --- Analytics Logic ---
const renderHeatmap = () => {
  const container = document.getElementById('heatmap-container');
  if (!container) return;
  container.innerHTML = '';
  
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const rate = state.history[key] || 0;
    
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    if (rate > 0) {
      const level = Math.ceil(rate / 25);
      cell.classList.add(`cell-level-${level}`);
    }
    cell.title = `${key}: ${rate}% completed`;
    container.appendChild(cell);
  }
};

let pulseChart, dailyChart, monthlyChart;

const initCharts = () => {
  const dailyCtx = document.getElementById('dailyChart').getContext('2d');
  dailyChart = new Chart(dailyCtx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Remaining'],
      datasets: [{
        data: [0, 1],
        backgroundColor: ['#6366f1', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 0,
        cutout: '80%'
      }]
    },
    options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
  });

  const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
  monthlyChart = new Chart(monthlyCtx, {
    type: 'line',
    data: {
      labels: Array.from({length: 7}, (_, i) => i + 1),
      datasets: [{
        label: 'Completion Rate',
        data: [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#a855f7',
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(168, 85, 247, 0.1)'
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100, display: false }, x: { display: false } },
      responsive: true,
      maintainAspectRatio: false
    }
  });

  const pulseCanvas = document.getElementById('pulseChart');
  if (pulseCanvas) {
    pulseChart = new Chart(pulseCanvas.getContext('2d'), {
      type: 'radar',
      data: {
        labels: ['Completion', 'Consistency', 'Reflection', 'Streak', 'Priority'],
        datasets: [{
          label: 'Your Pulse',
          data: [0, 0, 0, 0, 0],
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: '#6366f1',
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
        }]
      },
      options: {
        scales: { r: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 255, 255, 0.1)' }, angleLines: { color: 'rgba(255, 255, 255, 0.1)' }, pointLabels: { color: '#94a3b8' }, ticks: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });
  }
};

const updateCharts = async () => {
  const completed = state.tasks.filter(t => t.completed).length;
  const total = state.tasks.length;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

  dailyChart.data.datasets[0].data = [completed, total === 0 ? 1 : total - completed];
  dailyChart.update();

  const statusEl = document.getElementById('daily-status');
  if (statusEl) statusEl.textContent = total === 0 ? 'No tasks yet' : `${rate}% Completed`;

  const today = getTodayKey();
  if (rate > 0 || total > 0) {
    await fetch(`${API_URL}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, rate })
    });
  }
  
  const last7Days = [];
  const labels = [];
  for(let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    last7Days.push(state.history[key] || 0);
    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
  }

  monthlyChart.data.labels = labels;
  monthlyChart.data.datasets[0].data = last7Days;
  monthlyChart.update();
};

const updatePulseAnalytics = () => {
  const historyValues = Object.values(state.history);
  const avgCompletion = historyValues.length ? Math.round(historyValues.reduce((a, b) => a + b, 0) / historyValues.length) : 0;
  
  let activeDays = 0;
  for(let i=0; i<30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if(state.history[d.toISOString().split('T')[0]]) activeDays++;
  }
  const consistency = Math.round((activeDays / 30) * 100);
  const reflectionScore = Math.min(100, Math.round((Object.keys(state.diary).length / (historyValues.length || 1)) * 100));

  const compEl = document.getElementById('pulse-completion');
  const consEl = document.getElementById('pulse-consistency');
  const reflEl = document.getElementById('pulse-reflections');
  
  if (compEl) compEl.textContent = `${avgCompletion}%`;
  if (consEl) consEl.textContent = `${consistency}%`;
  if (reflEl) reflEl.textContent = `${reflectionScore}%`;

  if (pulseChart) {
    pulseChart.data.datasets[0].data = [avgCompletion, consistency, reflectionScore, Math.min(100, state.streak * 10), 75];
    pulseChart.update();
  }

  const last30TasksEl = document.getElementById('monthly-total-tasks');
  if (last30TasksEl) last30TasksEl.textContent = state.tasks.filter(t => t.completed).length;
};

// --- Event Listeners ---
document.getElementById('add-task-btn').onclick = () => document.getElementById('task-modal').classList.remove('hidden');
document.getElementById('cancel-task').onclick = () => document.getElementById('task-modal').classList.add('hidden');

document.getElementById('task-form').onsubmit = (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const priority = document.getElementById('task-priority').value;
  const time = document.getElementById('task-time').value;
  addTask(title, priority, time);
  e.target.reset();
  document.getElementById('task-modal').classList.add('hidden');
};

document.getElementById('show-planner').onclick = () => switchView('planner');
document.getElementById('show-diary').onclick = () => switchView('diary');
document.getElementById('show-analytics').onclick = () => switchView('analytics');
document.getElementById('save-diary-btn').onclick = saveDiaryEntry;

window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  updateDateDisplay();
  initCharts();
  await fetchTasks();
  await fetchHistory();
  createIcons();
});
