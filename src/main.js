import './style.css';
import Chart from 'chart.js/auto';
import { createIcons, Plus, Trash2, Check, X } from 'lucide';

// --- State Management ---
let state = {
  tasks: JSON.parse(localStorage.getItem('tasks')) || [],
  history: JSON.parse(localStorage.getItem('history')) || {}, // { 'YYYY-MM-DD': completionRate }
  streak: parseInt(localStorage.getItem('streak')) || 0,
  lastActive: localStorage.getItem('lastActive') || null
};

const saveState = () => {
  localStorage.setItem('tasks', JSON.stringify(state.tasks));
  localStorage.setItem('history', JSON.stringify(state.history));
  localStorage.setItem('streak', state.streak.toString());
  localStorage.setItem('lastActive', state.lastActive);
};

// --- Utilities ---
const getTodayKey = () => new Date().toISOString().split('T')[0];

const updateDateDisplay = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
};

// --- Task Logic ---
const addTask = (title, priority) => {
  const newTask = {
    id: Date.now(),
    title,
    priority,
    completed: false,
    date: getTodayKey()
  };
  state.tasks.push(newTask);
  renderTasks();
  updateCharts();
  saveState();
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
        <span class="task-priority-tag priority-${task.priority}">${task.priority}</span>
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

  // Save progress for history
  const today = getTodayKey();
  state.history[today] = rate;
  
  // Update Monthly Chart (Last 7 days for demo)
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

  // Streak logic
  updateStreak();
};

const updateStreak = () => {
  const today = getTodayKey();
  if (state.lastActive !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    if (state.lastActive === yesterdayKey) {
      // Continued streak (dummy logic for demo - in reality would check if tasks were done)
    } else if (state.lastActive !== null) {
      // state.streak = 0; // Reset streak if missed a day
    }
    state.lastActive = today;
  }
  
  // For demo: if they have tasks and at least one is completed, let's say they are active
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
  addTask(title, priority);
  e.target.reset();
  document.getElementById('task-modal').classList.add('hidden');
};

// --- Global Actions for Inline HTML calls ---
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateDateDisplay();
  initCharts();
  renderTasks();
  updateCharts();
  createIcons({ icons: { Plus, Trash2, Check, X } });
});
