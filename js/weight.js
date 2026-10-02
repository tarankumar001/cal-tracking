const STORAGE_KEY = 'caltrack_weight_v1';

function readEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error('Error reading weight history:', error);
    return [];
  }
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalDateTimeInput(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getWeightEntries() {
  return readEntries().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function saveWeightEntry({ id, weight, dateTime, note = '' }) {
  const numericWeight = Number(weight);
  const timestampDate = new Date(dateTime);
  if (!Number.isFinite(numericWeight) || numericWeight <= 0 || Number.isNaN(timestampDate.getTime())) {
    throw new Error('Enter a valid weight and date.');
  }

  const entries = readEntries();
  const entry = {
    id: id || `weight_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    weight: Math.round(numericWeight * 10) / 10,
    date: localDateString(timestampDate),
    timestamp: timestampDate.toISOString(),
    note: String(note).trim()
  };
  const existingIndex = entries.findIndex((item) => item.id === entry.id);
  if (existingIndex === -1) entries.push(entry);
  else entries[existingIndex] = entry;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entry;
}

export function deleteWeightEntry(id) {
  const entries = readEntries();
  const nextEntries = entries.filter((entry) => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
  return nextEntries.length !== entries.length;
}

export function getDailyWeightSeries(entries = getWeightEntries()) {
  const daily = new Map();
  entries.forEach((entry) => {
    if (!entry.date || !Number.isFinite(Number(entry.weight))) return;
    const values = daily.get(entry.date) || [];
    values.push(Number(entry.weight));
    daily.set(entry.date, values);
  });

  return [...daily.entries()]
    .map(([date, values]) => ({
      date,
      weight: values.reduce((sum, value) => sum + value, 0) / values.length,
      measurements: values.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getWeightSummary(entries = getWeightEntries(), today = localDateString()) {
  const latest = entries[0] || null;
  const previous = entries[1] || null;
  const todayEntry = entries.find((entry) => entry.date === today) || null;
  const sevenDaysAgo = new Date(`${today}T00:00:00`);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = localDateString(sevenDaysAgo);
  const recentDays = getDailyWeightSeries(entries).filter((entry) => entry.date >= startDate && entry.date <= today);
  const average = recentDays.length
    ? recentDays.reduce((sum, entry) => sum + entry.weight, 0) / recentDays.length
    : null;

  return {
    latest,
    today: todayEntry,
    previous,
    change: latest && previous ? latest.weight - previous.weight : null,
    average7Day: average
  };
}

export function getWeightTrendSeries(entries = getWeightEntries()) {
  const daily = getDailyWeightSeries(entries);
  let startIndex = 0;
  let total = 0;
  return daily.map((point, index) => {
    total += point.weight;
    const start = new Date(`${point.date}T00:00:00`);
    start.setDate(start.getDate() - 6);
    const startDate = localDateString(start);
    while (daily[startIndex].date < startDate) {
      total -= daily[startIndex].weight;
      startIndex += 1;
    }
    return { ...point, average7Day: total / (index - startIndex + 1) };
  });
}