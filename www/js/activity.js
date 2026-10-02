const STORAGE_KEY = 'caltrack_activity_v1';
const DEFAULT_GOAL = 10000;

function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      version: 1,
      goal: Number.isFinite(Number(stored.goal)) && Number(stored.goal) > 0 ? Number(stored.goal) : DEFAULT_GOAL,
      manual: Array.isArray(stored.manual) ? stored.manual : [],
      imported: Array.isArray(stored.imported) ? stored.imported : []
    };
  } catch (error) {
    console.error('Error reading activity history:', error);
    return { version: 1, goal: DEFAULT_GOAL, manual: [], imported: [] };
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getStepGoal() {
  return readState().goal;
}

export function saveStepGoal(goal) {
  const state = readState();
  const value = Math.round(Number(goal));
  if (!Number.isFinite(value) || value < 1) throw new Error('Enter a valid step goal.');
  state.goal = value;
  writeState(state);
  return value;
}

export function saveManualSteps(date, steps) {
  const state = readState();
  const value = Math.round(Number(steps));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || value < 0) {
    throw new Error('Enter a valid date and step count.');
  }
  state.manual = state.manual.filter((entry) => entry.date !== date);
  state.manual.push({ date, steps: value, source: 'manual', updatedAt: new Date().toISOString() });
  writeState(state);
  return value;
}

export function saveImportedSteps(records) {
  const state = readState();
  records.forEach((record) => {
    const steps = Math.round(Number(record.steps));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Number.isFinite(steps) || steps < 0) return;
    const source = String(record.source || 'health-connect');
    state.imported = state.imported.filter((item) => item.date !== record.date || item.source !== source);
    state.imported.push({
      date: record.date,
      steps,
      source,
      syncedAt: record.syncedAt || new Date().toISOString()
    });
  });
  writeState(state);
  return state.imported;
}

export function getActivityEntries() {
  const state = readState();
  const dates = new Set([...state.manual, ...state.imported].map((entry) => entry.date));
  return [...dates].sort().map((date) => {
    const imported = state.imported.filter((entry) => entry.date === date);
    const manual = state.manual.find((entry) => entry.date === date) || null;
    const steps = imported.length
      ? imported.reduce((sum, entry) => sum + entry.steps, 0)
      : manual?.steps ?? null;
    return {
      date,
      steps,
      source: imported.length ? imported.map((entry) => entry.source).join(', ') : manual ? 'manual' : null,
      hasImported: imported.length > 0,
      manual
    };
  });
}

export function getActivitySummary(today) {
  const entries = getActivityEntries();
  const available = entries.filter((entry) => entry.steps !== null);
  const weekStart = new Date(`${today}T00:00:00`);
  weekStart.setDate(weekStart.getDate() - 6);
  const startDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  const week = available.filter((entry) => entry.date >= startDate && entry.date <= today);
  const todayEntry = entries.find((entry) => entry.date === today) || null;
  return {
    today: todayEntry,
    weeklyAverage: week.length ? Math.round(week.reduce((sum, entry) => sum + entry.steps, 0) / week.length) : null,
    trackedDays: week.length,
    goal: getStepGoal()
  };
}