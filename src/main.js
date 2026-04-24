import './style.css';
import Chart from 'chart.js/auto';
import { createIcons, Plus, Trash2, Check, X, Clock } from 'lucide';

// --- State Management ---
let state = {
  tasks: JSON.parse(localStorage.getItem('tasks')) || [],
  history: JSON.parse(localStorage.getItem('history')) || {},
  diary: JSON.parse(localStorage.getItem('diary')) || {}, // { 'YYYY-MM-DD': 'entry content' }
  streak: parseInt(localStorage.getItem('streak')) || 0,
  lastActive: localStorage.getItem('lastActive') || null,
  remindersEnabled: localStorage.getItem('remindersEnabled') === 'true'
};

const saveState = () => {
  localStorage.setItem('tasks', JSON.stringify(state.tasks));
  localStorage.setItem('history', JSON.stringify(state.history));
  localStorage.setItem('diary', JSON.stringify(state.diary));
  localStorage.setItem('streak', state.streak.toString());
  localStorage.setItem('lastActive', state.lastActive);
  localStorage.setItem('remindersEnabled', state.remindersEnabled.toString());
};

// --- Utilities ---
const getTodayKey = () => new Date().toISOString().split('T')[0];

const updateDateDisplay = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = new Date().toLocaleDateString('en-US', options);
  document.getElementById('current-date').textContent = dateStr;
  document.getElementById('diary-date').textContent = dateStr;
};

// --- Task & Reminder Logic ---
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    state.remindersEnabled = (permission === 'granted');
    saveState();
  }
};

const addTask = (title, priority, time) => {
  const newTask = {
    id: Date.now(),
    title,
    priority,
    time, // e.g., "14:30"
    completed: false,
    date: getTodayKey(),
    notified: false
  };
  state.tasks.push(newTask);
  renderTasks();
  updateCharts();
  saveState();
  
  if (time && !state.remindersEnabled) {
    requestNotificationPermission();
  }
};

const checkReminders = () => {
  if (!state.remindersEnabled) return;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  state.tasks.forEach(task => {
    if (task.time === currentTime && !task.notified && !task.completed) {
      new Notification('Daily Pulse Reminder', {
        body: `Time for: ${task.title}`,
        icon: '/vite.svg'
      });
      task.notified = true;
      saveState();
    }
  });
};

setInterval(checkReminders, 10000); // Check every 10 seconds

// --- Diary Logic ---
const loadDiaryEntry = () => {
  const today = getTodayKey();
  document.getElementById('diary-input').value = state.diary[today] || '';
};

const saveDiaryEntry = () => {
  const today = getTodayKey();
  const content = document.getElementById('diary-input').value;
  state.diary[today] = content;
  saveState();

  const status = document.getElementById('save-status');
  status.textContent = 'Entry Saved!';
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2000);
};

// --- View Toggling ---
const switchView = (view) => {
  const plannerView = document.getElementById('planner-view');
  const diaryView = document.getElementById('diary-view');
  const analyticsView = document.getElementById('analytics-view');
  
  const plannerBtn = document.getElementById('show-planner');
  const diaryBtn = document.getElementById('show-diary');
  const analyticsBtn = document.getElementById('show-analytics');

  [plannerView, diaryView, analyticsView].forEach(v => v.classList.add('hidden'));
  [plannerBtn, diaryBtn, analyticsBtn].forEach(b => b.classList.remove('active'));

  if (view === 'planner') {
    plannerView.classList.remove('hidden');
    plannerBtn.classList.add('active');
  } else if (view === 'diary') {
    diaryView.classList.remove('hidden');
    diaryBtn.classList.add('active');
    loadDiaryEntry();
  } else {
    analyticsView.classList.remove('hidden');
    analyticsBtn.classList.add('active');
    renderHeatmap();
    updatePulseAnalytics();
  }
};

// --- Unique Features: Heatmap & Pulse Analytics ---
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

let pulseChart;
const initPulseChart = () => {
  const canvas = document.getElementById('pulseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  pulseChart = new Chart(ctx, {
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
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: { color: '#94a3b8' },
          ticks: { display: false }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
};

const updatePulseAnalytics = () => {
  const historyValues = Object.values(state.history);
  const diaryValues = Object.values(state.diary);
  
  const avgCompletion = historyValues.length ? Math.round(historyValues.reduce((a, b) => a + b, 0) / historyValues.length) : 0;
  
  let activeDays = 0;
  for(let i=0; i<30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if(state.history[d.toISOString().split('T')[0]]) activeDays++;
  }
  const consistency = Math.round((activeDays / 30) * 100);
  const reflectionScore = Math.min(100, Math.round((diaryValues.length / (historyValues.length || 1)) * 100));

  const compEl = document.getElementById('pulse-completion');
  const consEl = document.getElementById('pulse-consistency');
  const reflEl = document.getElementById('pulse-reflections');
  
  if (compEl) compEl.textContent = `${avgCompletion}%`;
  if (consEl) consEl.textContent = `${consistency}%`;
  if (reflEl) reflEl.textContent = `${reflectionScore}%`;

  if (pulseChart) {
    pulseChart.data.datasets[0].data = [
      avgCompletion,
      consistency,
      reflectionScore,
      Math.min(100, state.streak * 10),
      75
    ];
    pulseChart.update();
  }

  const last30DaysTasks = state.tasks.filter(t => t.completed).length; 
  const totalTasksEl = document.getElementById('monthly-total-tasks');
  const avgRateEl = document.getElementById('monthly-avg-rate');
  const bestStreakEl = document.getElementById('monthly-best-streak');

  if (totalTasksEl) totalTasksEl.textContent = last30DaysTasks;
  if (avgRateEl) avgRateEl.textContent = `${consistency}%`;
  if (bestStreakEl) bestStreakEl.textContent = state.streak;
};

const toggleTask = (id) => {
  state.tasks = state.tasks.map(task => 
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  renderTasks();
  updateCharts();
  saveState();
};

const deleteTask = (id) => {
  state.tasks = state.tasks.filter(task => task.id !== id);
  renderTasks();
  updateCharts();
  saveState();
};

// --- UI Rendering ---
const renderTasks = () => {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';

  if (state.tasks.length === 0) {
    taskList.innerHTML = '<div class="stat-card glass" style="text-align:center; padding: 3rem; color: var(--text-secondary)">No tasks for today. Start fresh!</div>';
    return;
  }

  state.tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="window.toggleTask(${task.id})">
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

  createIcons({ icons: { Plus, Trash2, Check, X } });
};

// --- Charting Logic ---
let dailyChart, monthlyChart;

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
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false
    }
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
      scales: {
        y: { beginAtZero: true, max: 100, display: false },
        x: { display: false }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
};

const updateCharts = () => {
  const completed = state.tasks.filter(t => t.completed).length;
  const total = state.tasks.length;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Update Daily Chart
  dailyChart.data.datasets[0].data = [completed, total === 0 ? 1 : total - completed];
  dailyChart.update();

  document.getElementById('daily-status').textContent = total === 0 ? 'No tasks yet' : `${rate}% Completed`;

  const today = getTodayKey();
  state.history[today] = rate;
  
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

  updateStreak();
};

const updateStreak = () => {
  const today = getTodayKey();
  if (state.lastActive !== today) {
    state.lastActive = today;
  }
  
  if (state.tasks.some(t => t.completed) && state.streak === 0) {
    state.streak = 1;
  }
  
  document.getElementById('streak-count').textContent = state.streak;
};

// --- Event Listeners ---
document.getElementById('add-task-btn').onclick = () => {
  document.getElementById('task-modal').classList.remove('hidden');
};

document.getElementById('cancel-task').onclick = () => {
  document.getElementById('task-modal').classList.add('hidden');
};

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

// --- Global Actions ---
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateDateDisplay();
  initCharts();
  initPulseChart();
  renderTasks();
  updateCharts();
  createIcons();
});
