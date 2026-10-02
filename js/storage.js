/**
 * Data Storage & Persistence Module
 * Manages LocalStorage for Foods, Daily Meal Logs, Targets, and Settings.
 */

import { scaleNutrients, roundTo } from './nutrition.js';

const STORAGE_KEYS = {
  FOODS: 'caltrack_foods_v1',
  LOGS: 'caltrack_logs_v1',
  TARGETS: 'caltrack_targets_v1',
  SETTINGS: 'caltrack_settings_v1'
};

// Initial Seed Data: Smoked Tandoori Chicken Bowl as required
export const INITIAL_EXAMPLE_FOOD = {
  id: 'food_seed_tandoori_bowl',
  name: 'Smoked Tandoori Chicken Bowl',
  servingSize: '1 bowl',
  calories: 570,
  protein: 16,
  carbs: 32,
  fat: 41,
  fiber: 0,
  isExample: true,
  createdAt: new Date().toISOString()
};

export const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 140,
  carbs: 220,
  fat: 65
};

export const DEFAULT_SETTINGS = {
  theme: 'dark'
};

/**
 * Format Date to YYYY-MM-DD
 */
export function getTodayDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Initialize Storage with default seed data if empty
 */
export function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.FOODS)) {
    localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify([INITIAL_EXAMPLE_FOOD]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TARGETS)) {
    localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(DEFAULT_TARGETS));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
      theme: prefersDark ? 'dark' : 'light'
    }));
  }

  // Seed today's lunch with the example food ONLY if today has no entries yet
  // (Does not modify or delete any existing entries)
  const today = getTodayDateString();
  const logs = getStoredLogs();
  if (!logs[today] || logs[today].length === 0) {
    const seedEntry = {
      id: 'entry_seed_' + Date.now(),
      foodId: INITIAL_EXAMPLE_FOOD.id,
      mealType: 'lunch',
      name: INITIAL_EXAMPLE_FOOD.name,
      servingSize: INITIAL_EXAMPLE_FOOD.servingSize,
      quantity: 1,
      calories: INITIAL_EXAMPLE_FOOD.calories,
      protein: INITIAL_EXAMPLE_FOOD.protein,
      carbs: INITIAL_EXAMPLE_FOOD.carbs,
      fat: INITIAL_EXAMPLE_FOOD.fat,
      fiber: INITIAL_EXAMPLE_FOOD.fiber,
      baseFood: {
        calories: INITIAL_EXAMPLE_FOOD.calories,
        protein: INITIAL_EXAMPLE_FOOD.protein,
        carbs: INITIAL_EXAMPLE_FOOD.carbs,
        fat: INITIAL_EXAMPLE_FOOD.fat,
        fiber: INITIAL_EXAMPLE_FOOD.fiber,
        servingSize: INITIAL_EXAMPLE_FOOD.servingSize
      },
      isCustomPortion: false,
      loggedAt: new Date().toISOString()
    };
    logs[today] = [seedEntry];
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }
}

/* ==================== FOOD DATABASE CRUD ==================== */

export function getFoods() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOODS);
    return raw ? JSON.parse(raw) : [INITIAL_EXAMPLE_FOOD];
  } catch (e) {
    console.error('Error reading foods from storage:', e);
    return [INITIAL_EXAMPLE_FOOD];
  }
}

export function getFoodById(id) {
  const foods = getFoods();
  return foods.find(f => f.id === id) || null;
}

export function saveFood(foodData) {
  const foods = getFoods();
  const newFood = {
    id: 'food_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: (foodData.name || '').trim(),
    servingSize: (foodData.servingSize || '1 serving').trim(),
    calories: Math.max(0, Math.round(parseFloat(foodData.calories) || 0)),
    protein: Math.max(0, parseFloat(foodData.protein) || 0),
    carbs: Math.max(0, parseFloat(foodData.carbs) || 0),
    fat: Math.max(0, parseFloat(foodData.fat) || 0),
    fiber: Math.max(0, parseFloat(foodData.fiber) || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  foods.unshift(newFood);
  localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(foods));
  return newFood;
}

export function updateFood(id, updates) {
  const foods = getFoods();
  const index = foods.findIndex(f => f.id === id);
  if (index === -1) return null;

  const current = foods[index];
  const updated = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    servingSize: updates.servingSize !== undefined ? updates.servingSize.trim() : current.servingSize,
    calories: updates.calories !== undefined ? Math.max(0, Math.round(parseFloat(updates.calories) || 0)) : current.calories,
    protein: updates.protein !== undefined ? Math.max(0, parseFloat(updates.protein) || 0) : current.protein,
    carbs: updates.carbs !== undefined ? Math.max(0, parseFloat(updates.carbs) || 0) : current.carbs,
    fat: updates.fat !== undefined ? Math.max(0, parseFloat(updates.fat) || 0) : current.fat,
    fiber: updates.fiber !== undefined ? Math.max(0, parseFloat(updates.fiber) || 0) : current.fiber,
    updatedAt: new Date().toISOString()
  };

  foods[index] = updated;
  localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(foods));
  return updated;
}

export function deleteFood(id) {
  let foods = getFoods();
  foods = foods.filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(foods));
  return true;
}

export function duplicateFood(id) {
  const food = getFoodById(id);
  if (!food) return null;

  const duplicated = {
    ...food,
    id: 'food_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: `${food.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const foods = getFoods();
  foods.unshift(duplicated);
  localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(foods));
  return duplicated;
}

/* ==================== DAILY MEAL ENTRIES ==================== */

function getStoredLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error reading logs from storage:', e);
    return {};
  }
}

export function getDayEntries(dateStr) {
  const logs = getStoredLogs();
  return logs[dateStr] || [];
}

export function addMealEntry(dateStr, entryData) {
  const logs = getStoredLogs();
  if (!logs[dateStr]) {
    logs[dateStr] = [];
  }

  const quantity = Math.max(0.01, parseFloat(entryData.quantity) || 1);
  const baseFood = entryData.baseFood || null;

  // Determine nutrients: use explicit custom values if provided, otherwise scale baseFood
  let calories, protein, carbs, fat, fiber;

  if (entryData.calories !== undefined && entryData.calories !== '') {
    calories = Math.max(0, Math.round(parseFloat(entryData.calories) || 0));
  } else if (baseFood) {
    calories = Math.round((parseFloat(baseFood.calories) || 0) * quantity);
  } else {
    calories = 0;
  }

  if (entryData.protein !== undefined && entryData.protein !== '') {
    protein = Math.max(0, roundTo(parseFloat(entryData.protein) || 0, 1));
  } else if (baseFood) {
    protein = Math.max(0, roundTo((parseFloat(baseFood.protein) || 0) * quantity, 1));
  } else {
    protein = 0;
  }

  if (entryData.carbs !== undefined && entryData.carbs !== '') {
    carbs = Math.max(0, roundTo(parseFloat(entryData.carbs) || 0, 1));
  } else if (baseFood) {
    carbs = Math.max(0, roundTo((parseFloat(baseFood.carbs) || 0) * quantity, 1));
  } else {
    carbs = 0;
  }

  if (entryData.fat !== undefined && entryData.fat !== '') {
    fat = Math.max(0, roundTo(parseFloat(entryData.fat) || 0, 1));
  } else if (baseFood) {
    fat = Math.max(0, roundTo((parseFloat(baseFood.fat) || 0) * quantity, 1));
  } else {
    fat = 0;
  }

  if (entryData.fiber !== undefined && entryData.fiber !== '') {
    fiber = Math.max(0, roundTo(parseFloat(entryData.fiber) || 0, 1));
  } else if (baseFood) {
    fiber = Math.max(0, roundTo((parseFloat(baseFood.fiber) || 0) * quantity, 1));
  } else {
    fiber = 0;
  }

  const newEntry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    foodId: entryData.foodId || null,
    mealType: (entryData.mealType || 'snacks').toLowerCase(),
    name: (entryData.name || 'Unnamed Food').trim(),
    servingSize: (entryData.servingSize || '1 serving').trim(),
    quantity: quantity,
    calories: calories,
    protein: protein,
    carbs: carbs,
    fat: fat,
    fiber: fiber,
    baseFood: baseFood ? {
      calories: parseFloat(baseFood.calories) || 0,
      protein: parseFloat(baseFood.protein) || 0,
      carbs: parseFloat(baseFood.carbs) || 0,
      fat: parseFloat(baseFood.fat) || 0,
      fiber: parseFloat(baseFood.fiber) || 0,
      servingSize: baseFood.servingSize || '1 serving'
    } : null,
    isCustomPortion: entryData.isCustomPortion || false,
    loggedAt: new Date().toISOString()
  };

  logs[dateStr].push(newEntry);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  return newEntry;
}

export function updateMealEntry(dateStr, entryId, updates) {
  const logs = getStoredLogs();
  const entries = logs[dateStr] || [];
  const index = entries.findIndex(e => e.id === entryId);
  if (index === -1) return null;

  const current = entries[index];
  let newQuantity = current.quantity;
  if (updates.quantity !== undefined) {
    newQuantity = Math.max(0.01, parseFloat(updates.quantity) || 1);
  }

  let calories = current.calories;
  let protein = current.protein;
  let carbs = current.carbs;
  let fat = current.fat;
  let fiber = current.fiber;

  // If quantity changed and no explicit macro overrides were given, scale proportionately
  if (updates.quantity !== undefined && newQuantity !== current.quantity && updates.calories === undefined) {
    if (current.baseFood) {
      calories = Math.round((parseFloat(current.baseFood.calories) || 0) * newQuantity);
      protein = roundTo((parseFloat(current.baseFood.protein) || 0) * newQuantity, 1);
      carbs = roundTo((parseFloat(current.baseFood.carbs) || 0) * newQuantity, 1);
      fat = roundTo((parseFloat(current.baseFood.fat) || 0) * newQuantity, 1);
      fiber = roundTo((parseFloat(current.baseFood.fiber) || 0) * newQuantity, 1);
    } else {
      const ratio = newQuantity / current.quantity;
      calories = Math.round(current.calories * ratio);
      protein = roundTo(current.protein * ratio, 1);
      carbs = roundTo(current.carbs * ratio, 1);
      fat = roundTo(current.fat * ratio, 1);
      fiber = roundTo((current.fiber || 0) * ratio, 1);
    }
  }

  // Explicit macro overrides:
  if (updates.calories !== undefined) {
    calories = Math.max(0, Math.round(parseFloat(updates.calories) || 0));
  }
  if (updates.protein !== undefined) {
    protein = Math.max(0, roundTo(parseFloat(updates.protein) || 0, 1));
  }
  if (updates.carbs !== undefined) {
    carbs = Math.max(0, roundTo(parseFloat(updates.carbs) || 0, 1));
  }
  if (updates.fat !== undefined) {
    fat = Math.max(0, roundTo(parseFloat(updates.fat) || 0, 1));
  }
  if (updates.fiber !== undefined) {
    fiber = Math.max(0, roundTo(parseFloat(updates.fiber) || 0, 1));
  }

  const updatedEntry = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    servingSize: updates.servingSize !== undefined ? updates.servingSize.trim() : current.servingSize,
    quantity: newQuantity,
    mealType: updates.mealType ? updates.mealType.toLowerCase() : current.mealType,
    calories: calories,
    protein: protein,
    carbs: carbs,
    fat: fat,
    fiber: fiber,
    isCustomPortion: updates.isCustomPortion !== undefined ? updates.isCustomPortion : current.isCustomPortion
  };

  entries[index] = updatedEntry;
  logs[dateStr] = entries;
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  return updatedEntry;
}

export function deleteMealEntry(dateStr, entryId) {
  const logs = getStoredLogs();
  if (!logs[dateStr]) return false;

  logs[dateStr] = logs[dateStr].filter(e => e.id !== entryId);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  return true;
}

export function moveMealEntry(dateStr, entryId, targetMeal) {
  return updateMealEntry(dateStr, entryId, { mealType: targetMeal });
}

/* ==================== TARGETS & SETTINGS ==================== */

export function getTargets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TARGETS);
    return raw ? JSON.parse(raw) : DEFAULT_TARGETS;
  } catch (e) {
    return DEFAULT_TARGETS;
  }
}

export function saveTargets(targets) {
  const sanitized = {
    calories: Math.max(0, Math.round(parseFloat(targets.calories) || DEFAULT_TARGETS.calories)),
    protein: Math.max(0, Math.round(parseFloat(targets.protein) || DEFAULT_TARGETS.protein)),
    carbs: targets.carbs !== undefined && targets.carbs !== '' ? Math.max(0, Math.round(parseFloat(targets.carbs))) : null,
    fat: targets.fat !== undefined && targets.fat !== '' ? Math.max(0, Math.round(parseFloat(targets.fat))) : null
  };
  localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(sanitized));
  return sanitized;
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  const current = getSettings();
  const merged = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
  return merged;
}

/* ==================== BACKUP & RESTORE ==================== */

export function exportAllData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    foods: getFoods(),
    logs: getStoredLogs(),
    targets: getTargets(),
    settings: getSettings()
  };
}

export function importAllData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup data format');
  if (data.foods && Array.isArray(data.foods)) {
    localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(data.foods));
  }
  if (data.logs && typeof data.logs === 'object') {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs));
  }
  if (data.targets) {
    localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(data.targets));
  }
  if (data.settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
  }
  return true;
}

export function resetToDemoData() {
  localStorage.removeItem(STORAGE_KEYS.FOODS);
  localStorage.removeItem(STORAGE_KEYS.LOGS);
  localStorage.removeItem(STORAGE_KEYS.TARGETS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  initStorage();
  return true;
}
