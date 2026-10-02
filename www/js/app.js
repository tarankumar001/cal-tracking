/**
 * Main Application Controller
 * Handles view switching, dashboard updates, food creation/editing,
 * 4/4/9 calorie calculation & manual overrides, logging, and modals.
 */

import { icons } from './icons.js';
import {
  calculateEstimatedCalories,
  hasCalorieDiscrepancy,
  scaleNutrients,
  calculateDayTotals,
  calculateRemaining,
  calculateMacroPercentages,
  roundTo,
  sanitizeNumber
} from './nutrition.js';
import {
  initStorage,
  getTodayDateString,
  getFoods,
  getFoodById,
  saveFood,
  updateFood,
  deleteFood,
  duplicateFood,
  getDayEntries,
  getLogDates,
  addMealEntry,
  updateMealEntry,
  deleteMealEntry,
  moveMealEntry,
  getTargets,
  saveTargets,
  getSettings,
  saveSettings,
  exportAllData,
  importAllData,
  resetToDemoData
} from './storage.js';
import { getDateSequence, getNutritionSeries, getRangeStart, averageFor, createLineChartSvg } from './analytics.js';
import { getActivityEntries, getActivitySummary, getStepGoal, saveManualSteps, saveImportedSteps, saveStepGoal } from './activity.js';
import { getHealthConnectStatus, requestHealthConnectPermission, readHealthConnectSteps } from './health-connect.js';
import { deleteWeightEntry, getWeightEntries, getWeightSummary, getWeightTrendSeries, localDateString, saveWeightEntry, toLocalDateTimeInput } from './weight.js';

/* ==================== APPLICATION STATE ==================== */
const state = {
  currentDate: getTodayDateString(),
  currentView: 'dashboard', // 'dashboard' | 'foods'
  analyticsRange: '7',
  analyticsMacro: 'protein',
  activeModal: null,
  activeTargetMeal: 'lunch', // Default meal for logging
  selectedFoodForLog: null,
  selectedEntryForEdit: null,
  isFoodCaloriesManuallyEdited: false,
  isLogMacrosCustomized: false,
  isEditMacrosCustomized: false
};

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  applySavedTheme();
  setupIcons();
  setupNavigation();
  setupDateControls();
  setupFoodCreationModal();
  setupLogModal();
  setupEntryModal();
  setupDetailsModal();
  setupSettingsModal();
  setupQuickAddModal();
  setupSearch();
  setupWeightModal();
  setupAnalytics();

  // Render initial dashboard
  renderDashboard();
  renderFoodList();

  // Register Service Worker for offline PWA support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
});

/* ==================== THEME MANAGEMENT ==================== */
function applySavedTheme() {
  const settings = getSettings();
  const theme = settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  saveSettings({ theme: newTheme });
  updateThemeButton(newTheme);
  showToast(`Switched to ${newTheme} mode`);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  }
}

/* ==================== ICONS SETUP ==================== */
function setupIcons() {
  document.getElementById('brandLogo').innerHTML = icons.flame;
  document.getElementById('openSettingsBtn').innerHTML = icons.settings;
  document.getElementById('prevDayBtn').innerHTML = icons.chevronLeft;
  document.getElementById('nextDayBtn').innerHTML = icons.chevronRight;
  document.getElementById('heroCalEatenIcon').innerHTML = icons.flame;
  document.getElementById('heroCalTargetIcon').innerHTML = icons.check;

  document.getElementById('iconMealBreakfast').innerHTML = icons.sunrise;
  document.getElementById('iconMealLunch').innerHTML = icons.sunMid;
  document.getElementById('iconMealDinner').innerHTML = icons.utensils;
  document.getElementById('iconMealSnacks').innerHTML = icons.snack;

  document.getElementById('searchIconWrap').innerHTML = icons.search;
  document.getElementById('plusIconCreateWrap').innerHTML = icons.plus;
  document.getElementById('navIconDashboard').innerHTML = icons.diary;
  document.getElementById('navIconFoods').innerHTML = icons.book;
  document.getElementById('navIconAnalytics').innerHTML = icons.chart;
  document.getElementById('navIconLearn').innerHTML = icons.info;
  document.getElementById('navIconCenterPlus').innerHTML = icons.plus;

  document.getElementById('closeFoodModalBtn').innerHTML = icons.close;
  document.getElementById('closeLogModalBtn').innerHTML = icons.close;
  document.getElementById('closeDetailsModalBtn').innerHTML = icons.close;
  document.getElementById('closeEntryModalBtn').innerHTML = icons.close;
  document.getElementById('closeSettingsModalBtn').innerHTML = icons.close;
  document.getElementById('trashIconEntryWrap').innerHTML = icons.trash;
  document.getElementById('discrepancyIconWrap').innerHTML = icons.info;
  document.getElementById('recalcIconWrap').innerHTML = icons.refresh;
}

/* ==================== VIEW SWITCHING ==================== */
function setupNavigation() {
  const navDash = document.getElementById('navDashboardBtn');
  const navFoods = document.getElementById('navFoodsBtn');
  const navAnalytics = document.getElementById('navAnalyticsBtn');
  const navLearn = document.getElementById('navLearnBtn');
  const navCenterAdd = document.getElementById('navCenterAddBtn');

  navDash.addEventListener('click', () => switchView('dashboard'));
  navFoods.addEventListener('click', () => switchView('foods'));
  navAnalytics.addEventListener('click', () => switchView('analytics'));
  navLearn.addEventListener('click', () => switchView('learn'));

  // Center "+" button opens food database or log dialog
  navCenterAdd.addEventListener('click', () => {
    switchView('foods');
    showToast('Select a food to log or tap "New Food"');
  });

  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
}

function switchView(viewName) {
  state.currentView = viewName;
  const views = {
    dashboard: 'dashboardView',
    foods: 'databaseView',
    analytics: 'analyticsView',
    learn: 'learnView'
  };
  const navigation = {
    dashboard: 'navDashboardBtn',
    foods: 'navFoodsBtn',
    analytics: 'navAnalyticsBtn',
    learn: 'navLearnBtn'
  };
  Object.values(views).forEach((id) => document.getElementById(id).classList.toggle('active', id === views[viewName]));
  Object.values(navigation).forEach((id) => document.getElementById(id).classList.toggle('active', id === navigation[viewName]));

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'foods') {
    renderFoodList();
    const searchInput = document.getElementById('foodSearchInput');
    if (searchInput) searchInput.focus();
  }
  if (viewName === 'analytics') {
    renderAnalytics();
    refreshHealthConnectSteps();
  }
}

/* ==================== DATE CONTROLS ==================== */
function setupDateControls() {
  const prevBtn = document.getElementById('prevDayBtn');
  const nextBtn = document.getElementById('nextDayBtn');
  const dateDisplayBtn = document.getElementById('currentDateDisplayBtn');
  const nativePicker = document.getElementById('nativeDatePicker');

  prevBtn.addEventListener('click', () => changeDate(-1));
  nextBtn.addEventListener('click', () => changeDate(1));

  dateDisplayBtn.addEventListener('click', () => {
    nativePicker.value = state.currentDate;
    if (typeof nativePicker.showPicker === 'function') {
      nativePicker.showPicker();
    } else {
      nativePicker.click();
    }
  });

  nativePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      state.currentDate = e.target.value;
      updateDateDisplay();
      renderDashboard();
    }
  });

  updateDateDisplay();
}

function changeDate(daysOffset) {
  const [y, m, d] = state.currentDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + daysOffset);

  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  state.currentDate = `${newYear}-${newMonth}-${newDay}`;

  updateDateDisplay();
  renderDashboard();
}

function updateDateDisplay() {
  const today = getTodayDateString();
  const isToday = state.currentDate === today;

  const [y, m, d] = state.currentDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const formatted = date.toLocaleDateString(undefined, options);

  const label = document.getElementById('dateDisplayLabel');
  const badge = document.getElementById('todayBadge');

  if (isToday) {
    label.textContent = formatted;
    badge.style.display = 'inline-block';
    badge.textContent = 'Today';
  } else {
    label.textContent = formatted;
    badge.style.display = 'none';
  }
}

/* ==================== DASHBOARD RENDERING ==================== */
export function renderDashboard() {
  const dayEntries = getDayEntries(state.currentDate);
  const targets = getTargets();
  const totals = calculateDayTotals(dayEntries);
  const remaining = calculateRemaining(targets, totals.dayTotal);

  // 1. Calorie Hero Card
  const remainingNumberEl = document.getElementById('calorieRemainingNumber');
  const remainingLabelEl = document.getElementById('calorieRemainingLabel');
  const statusPillEl = document.getElementById('calorieStatusPill');
  const heroEatenEl = document.getElementById('heroCaloriesEaten');
  const heroTargetEl = document.getElementById('heroCaloriesTarget');
  const ringProgressEl = document.getElementById('calorieRingProgress');

  heroEatenEl.textContent = `${totals.dayTotal.calories} kcal`;
  heroTargetEl.textContent = `${remaining.calTarget} kcal`;

  const circumference = 377; // 2 * PI * 60 approx
  if (remaining.isCalOver) {
    const overAmt = Math.abs(remaining.calRemaining);
    remainingNumberEl.textContent = overAmt;
    remainingNumberEl.style.color = 'var(--fat-color)';
    remainingLabelEl.textContent = 'Kcal Over';
    statusPillEl.textContent = `+${overAmt} kcal over`;
    statusPillEl.className = 'ring-status-pill over';
    ringProgressEl.style.stroke = 'url(#overCalGradient)';
    ringProgressEl.style.strokeDashoffset = '0';
  } else {
    remainingNumberEl.textContent = remaining.calRemaining;
    remainingNumberEl.style.color = 'var(--text-primary)';
    remainingLabelEl.textContent = 'Kcal Left';
    statusPillEl.textContent = `${remaining.calPercent}% of target`;
    statusPillEl.className = 'ring-status-pill';
    ringProgressEl.style.stroke = 'url(#calGradient)';
    const offset = circumference - (circumference * Math.min(totals.dayTotal.calories / remaining.calTarget, 1));
    ringProgressEl.style.strokeDashoffset = Math.max(0, offset);
  }

  // 2. Macros Grid
  // Protein
  document.getElementById('proteinConsumedNum').textContent = totals.dayTotal.protein;
  document.getElementById('proteinTargetNum').textContent = remaining.proTarget;
  const proRemainingPill = document.getElementById('proteinRemainingPill');
  if (remaining.isProOver) {
    proRemainingPill.textContent = `+${Math.abs(remaining.proRemaining)}g over`;
    proRemainingPill.style.color = 'var(--fat-color)';
  } else {
    proRemainingPill.textContent = `${remaining.proRemaining}g left`;
    proRemainingPill.style.color = 'var(--text-muted)';
  }
  document.getElementById('proteinProgressFill').style.width = `${Math.min(remaining.proPercent, 100)}%`;
  document.getElementById('quickProteinSummary').textContent = `${totals.dayTotal.protein} / ${remaining.proTarget}g Protein`;

  // Carbs
  document.getElementById('carbConsumedNum').textContent = totals.dayTotal.carbs;
  const carbRemainingPill = document.getElementById('carbRemainingPill');
  if (remaining.carbTarget) {
    document.getElementById('carbTargetNum').textContent = remaining.carbTarget;
    carbRemainingPill.textContent = remaining.carbRemaining >= 0 ? `${remaining.carbRemaining}g left` : `+${Math.abs(remaining.carbRemaining)}g over`;
    document.getElementById('carbProgressFill').style.width = `${Math.min(remaining.carbPercent, 100)}%`;
  } else {
    document.getElementById('carbTargetNum').textContent = '—';
    carbRemainingPill.textContent = 'tracked';
    document.getElementById('carbProgressFill').style.width = totals.dayTotal.carbs > 0 ? '70%' : '0%';
  }

  // Fat
  document.getElementById('fatConsumedNum').textContent = totals.dayTotal.fat;
  const fatRemainingPill = document.getElementById('fatRemainingPill');
  if (remaining.fatTarget) {
    document.getElementById('fatTargetNum').textContent = remaining.fatTarget;
    fatRemainingPill.textContent = remaining.fatRemaining >= 0 ? `${remaining.fatRemaining}g left` : `+${Math.abs(remaining.fatRemaining)}g over`;
    document.getElementById('fatProgressFill').style.width = `${Math.min(remaining.fatPercent, 100)}%`;
  } else {
    document.getElementById('fatTargetNum').textContent = '—';
    fatRemainingPill.textContent = 'tracked';
    document.getElementById('fatProgressFill').style.width = totals.dayTotal.fat > 0 ? '70%' : '0%';
  }

  // Fiber
  document.getElementById('fiberConsumedNum').textContent = totals.dayTotal.fiber;
  document.getElementById('fiberProgressFill').style.width = totals.dayTotal.fiber > 0 ? `${Math.min(totals.dayTotal.fiber * 3.3, 100)}%` : '0%';

  // 3. Macro Calorie Distribution Ratio Bar
  const ratios = calculateMacroPercentages(totals.dayTotal.protein, totals.dayTotal.carbs, totals.dayTotal.fat);
  document.getElementById('ratioProSeg').style.width = `${ratios.pPct}%`;
  document.getElementById('ratioCarbSeg').style.width = `${ratios.cPct}%`;
  document.getElementById('ratioFatSeg').style.width = `${ratios.fPct}%`;
  document.getElementById('legendProText').textContent = `Protein: ${ratios.pPct}%`;
  document.getElementById('legendCarbText').textContent = `Carbs: ${ratios.cPct}%`;
  document.getElementById('legendFatText').textContent = `Fat: ${ratios.fPct}%`;

  // 4. Meals Sections
  renderMealSection('breakfast', totals.meals.breakfast, totals.mealTotals.breakfast);
  renderMealSection('lunch', totals.meals.lunch, totals.mealTotals.lunch);
  renderMealSection('dinner', totals.meals.dinner, totals.mealTotals.dinner);
  renderMealSection('snacks', totals.meals.snacks, totals.mealTotals.snacks);
}

function renderMealSection(mealType, entries = [], mealTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }) {
  const capMeal = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const summaryEl = document.getElementById(`summaryMeal${capMeal}`);
  const listEl = document.getElementById(`entriesMeal${capMeal}`);
  const addBtn = document.getElementById(`addMealBtn${capMeal}`);
  const quickBtn = document.getElementById(`quickMealBtn${capMeal}`);

  summaryEl.innerHTML = `<strong>${mealTotals.calories} kcal</strong> • ${roundTo(mealTotals.protein, 1)}P ${roundTo(mealTotals.carbs, 1)}C ${roundTo(mealTotals.fat, 1)}F`;

  // Add Button → go to food database
  addBtn.onclick = (e) => {
    e.stopPropagation();
    state.activeTargetMeal = mealType;
    switchView('foods');
    showToast(`Select food to add to ${capMeal}`);
  };

  // Quick Button → open Quick Add modal pre-targeted to this meal
  if (quickBtn) {
    quickBtn.onclick = (e) => {
      e.stopPropagation();
      openQuickAddModal(mealType);
    };
  }

  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.innerHTML = `
      <div class="meal-empty-state">
        No foods logged in ${capMeal} yet. Tap + to add.
      </div>
    `;
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.setAttribute('data-entry-id', entry.id);

    const qtyDisplay = entry.quantity === 1 ? entry.servingSize : `${entry.quantity} × ${entry.servingSize}`;

    card.innerHTML = `
      <div class="entry-left">
        <span class="entry-name">${escapeHtml(entry.name)}</span>
        <span class="entry-serving-label">${escapeHtml(qtyDisplay)}</span>
        <div class="entry-macro-badges">
          <span class="macro-tag pro">${entry.protein}g P</span>
          <span class="macro-tag carb">${entry.carbs}g C</span>
          <span class="macro-tag fat">${entry.fat}g F</span>
        </div>
      </div>
      <div class="entry-right">
        <div class="entry-cals">
          ${entry.calories}
          <span>kcal</span>
        </div>
        <button class="entry-action-menu-btn" title="Edit entry" aria-label="Edit entry">
          ${icons.edit}
        </button>
      </div>
    `;

    card.addEventListener('click', () => {
      openEntryModal(entry);
    });

    listEl.appendChild(card);
  });
}

/* ==================== FOOD DATABASE RENDERING ==================== */
export function renderFoodList(searchQuery = '') {
  const container = document.getElementById('foodListContainer');
  let foods = getFoods();

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    foods = foods.filter(f => f.name.toLowerCase().includes(q) || (f.servingSize && f.servingSize.toLowerCase().includes(q)));
  }

  container.innerHTML = '';

  if (foods.length === 0) {
    container.innerHTML = `
      <div class="empty-view-state">
        <div class="empty-icon-circle">${icons.search}</div>
        <div class="empty-title">No Foods Found</div>
        <div class="empty-desc">Create your own custom food with the "New Food" button above.</div>
      </div>
    `;
    return;
  }

  foods.forEach(food => {
    const hasDiscrepancy = hasCalorieDiscrepancy(food.calories, food.protein, food.carbs, food.fat);
    const card = document.createElement('div');
    card.className = 'food-card';
    card.setAttribute('data-food-id', food.id);

    card.innerHTML = `
      <div class="food-card-top">
        <div class="food-title-group">
          <div class="food-name">${escapeHtml(food.name)}</div>
          <div class="food-serving">${escapeHtml(food.servingSize)}</div>
        </div>
        <div class="food-cal-badge">
          <span class="food-cal-number">${food.calories}</span>
          <span class="food-cal-unit">kcal</span>
        </div>
      </div>

      <div class="food-card-macros">
        <span class="macro-chip pro">${food.protein}g Protein</span>
        <span class="macro-chip carb">${food.carbs}g Carbs</span>
        <span class="macro-chip fat">${food.fat}g Fat</span>
        ${food.fiber > 0 ? `<span class="macro-chip fiber">${food.fiber}g Fiber</span>` : ''}
        ${hasDiscrepancy ? `<span class="discrepancy-indicator" title="Label calories differ from 4/4/9 macro calculation">${icons.info} Label Diff</span>` : ''}
      </div>

      <div class="food-card-actions">
        <button class="quick-log-btn" data-action="log" title="Log food to today's diary">
          ${icons.plus}
          <span>Log</span>
        </button>

        <div class="secondary-actions">
          <button class="action-icon-btn" data-action="details" title="View nutrition details" aria-label="View details">
            ${icons.info}
          </button>
          <button class="action-icon-btn" data-action="edit" title="Edit food" aria-label="Edit food">
            ${icons.edit}
          </button>
          <button class="action-icon-btn" data-action="duplicate" title="Duplicate food" aria-label="Duplicate food">
            ${icons.copy}
          </button>
          <button class="action-icon-btn danger" data-action="delete" title="Delete food" aria-label="Delete food">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;

    // Action button listeners
    card.querySelector('[data-action="log"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openLogModal(food);
    });

    card.querySelector('[data-action="details"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailsModal(food);
    });

    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openFoodModal(food);
    });

    card.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const dup = duplicateFood(food.id);
      if (dup) {
        renderFoodList(document.getElementById('foodSearchInput').value);
        showToast(`Duplicated "${food.name}"`);
      }
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${food.name}" from your saved foods?`)) {
        deleteFood(food.id);
        renderFoodList(document.getElementById('foodSearchInput').value);
        showToast(`Deleted "${food.name}"`);
      }
    });

    // Clicking card opens details
    card.addEventListener('click', () => {
      openDetailsModal(food);
    });

    container.appendChild(card);
  });
}

function setupSearch() {
  const searchInput = document.getElementById('foodSearchInput');
  searchInput.addEventListener('input', (e) => {
    renderFoodList(e.target.value);
  });
}

/* ==================== CREATE & EDIT FOOD MODAL ==================== */
function setupFoodCreationModal() {
  const modal = document.getElementById('foodModal');
  const openBtn = document.getElementById('openCreateFoodBtn');
  const closeBtn = document.getElementById('closeFoodModalBtn');
  const cancelBtn = document.getElementById('cancelFoodModalBtn');
  const form = document.getElementById('foodForm');
  const recalcBtn = document.getElementById('recalculateBtn');

  const proInput = document.getElementById('foodFormProtein');
  const carbInput = document.getElementById('foodFormCarbs');
  const fatInput = document.getElementById('foodFormFat');
  const calInput = document.getElementById('foodFormCalories');

  openBtn.addEventListener('click', () => openFoodModal(null));
  closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn.addEventListener('click', () => closeModal(modal));

  // Recalculate button handler
  recalcBtn.addEventListener('click', () => {
    const p = parseFloat(proInput.value) || 0;
    const c = parseFloat(carbInput.value) || 0;
    const f = parseFloat(fatInput.value) || 0;
    const calc = calculateEstimatedCalories(p, c, f);
    calInput.value = calc;
    state.isFoodCaloriesManuallyEdited = false;
    updateCalculationUI();
    showToast(`Calories recalculated from macros: ${calc} kcal`);
  });

  // Macro input changes -> recalculate calories if not manually edited
  [proInput, carbInput, fatInput].forEach(inp => {
    inp.addEventListener('input', () => {
      updateCalculationUI();
      if (!state.isFoodCaloriesManuallyEdited) {
        const p = parseFloat(proInput.value) || 0;
        const c = parseFloat(carbInput.value) || 0;
        const f = parseFloat(fatInput.value) || 0;
        calInput.value = calculateEstimatedCalories(p, c, f);
      }
    });
  });

  // User types directly into Calories input -> mark as manually edited!
  calInput.addEventListener('input', () => {
    state.isFoodCaloriesManuallyEdited = true;
    updateCalculationUI();
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('foodFormId').value;
    const name = document.getElementById('foodFormName').value.trim();
    const servingSize = document.getElementById('foodFormServing').value.trim();
    const calories = sanitizeNumber(document.getElementById('foodFormCalories').value, 0);
    const protein = sanitizeNumber(document.getElementById('foodFormProtein').value, 0);
    const carbs = sanitizeNumber(document.getElementById('foodFormCarbs').value, 0);
    const fat = sanitizeNumber(document.getElementById('foodFormFat').value, 0);
    const fiber = sanitizeNumber(document.getElementById('foodFormFiber').value, 0);

    if (!name) {
      alert('Please enter a food name');
      return;
    }

    const foodData = { name, servingSize, calories, protein, carbs, fat, fiber };

    if (id) {
      updateFood(id, foodData);
      showToast(`Updated "${name}"`);
    } else {
      saveFood(foodData);
      showToast(`Saved "${name}"`);
    }

    closeModal(modal);
    renderFoodList(document.getElementById('foodSearchInput').value);
    renderDashboard();
  });
}

function openFoodModal(food = null) {
  const modal = document.getElementById('foodModal');
  const title = document.getElementById('foodModalTitle');
  const form = document.getElementById('foodForm');
  form.reset();

  if (food) {
    title.textContent = 'Edit Food';
    document.getElementById('foodFormId').value = food.id;
    document.getElementById('foodFormName').value = food.name;
    document.getElementById('foodFormServing').value = food.servingSize;
    document.getElementById('foodFormProtein').value = food.protein;
    document.getElementById('foodFormCarbs').value = food.carbs;
    document.getElementById('foodFormFat').value = food.fat;
    document.getElementById('foodFormFiber').value = food.fiber || 0;
    document.getElementById('foodFormCalories').value = food.calories;

    // Check if food has manual override
    const calc = calculateEstimatedCalories(food.protein, food.carbs, food.fat);
    state.isFoodCaloriesManuallyEdited = (food.calories !== calc);
  } else {
    title.textContent = 'Create Custom Food';
    document.getElementById('foodFormId').value = '';
    document.getElementById('foodFormServing').value = '1 serving';
    state.isFoodCaloriesManuallyEdited = false;
  }

  updateCalculationUI();
  openModal(modal);
  document.getElementById('foodFormName').focus();
}

function updateCalculationUI() {
  const proInput = document.getElementById('foodFormProtein');
  const carbInput = document.getElementById('foodFormCarbs');
  const fatInput = document.getElementById('foodFormFat');
  const calInput = document.getElementById('foodFormCalories');
  const previewEl = document.getElementById('calcCaloriesPreview');
  const noticeEl = document.getElementById('calcStatusNotice');

  const p = parseFloat(proInput.value) || 0;
  const c = parseFloat(carbInput.value) || 0;
  const f = parseFloat(fatInput.value) || 0;
  const calc = calculateEstimatedCalories(p, c, f);
  const currentSaved = parseFloat(calInput.value) || 0;

  previewEl.textContent = `${calc} kcal`;

  if (state.isFoodCaloriesManuallyEdited) {
    if (Math.round(currentSaved) !== calc) {
      noticeEl.innerHTML = `<span class="calc-badge-diff">⚠️ Manual calories saved: ${Math.round(currentSaved)} kcal (Label override). Tap Recalculate to sync.</span>`;
    } else {
      noticeEl.innerHTML = `<span class="calc-badge-sync">✓ Calories match 4/4/9 macro calculation</span>`;
    }
  } else {
    noticeEl.innerHTML = `<span class="calc-badge-sync">✓ Auto-calculating from macros: (P×4 + C×4 + F×9)</span>`;
  }
}

/* ==================== LOG FOOD MODAL ==================== */
function setupLogModal() {
  const modal = document.getElementById('logModal');
  const closeBtn = document.getElementById('closeLogModalBtn');
  const cancelBtn = document.getElementById('cancelLogModalBtn');
  const confirmBtn = document.getElementById('confirmLogBtn');
  const qtyInput = document.getElementById('logQuantityInput');
  const minusBtn = document.getElementById('logQuantityMinusBtn');
  const plusBtn = document.getElementById('logQuantityPlusBtn');
  const chipBtns = modal.querySelectorAll('.chip-btn');
  const mealBtns = modal.querySelectorAll('#logMealSelector .meal-tab-btn');

  // Macro editor inputs
  const calInput = document.getElementById('logCaloriesInput');
  const proInput = document.getElementById('logProteinInput');
  const carbInput = document.getElementById('logCarbsInput');
  const fatInput = document.getElementById('logFatInput');
  const resetBtn = document.getElementById('logResetToStandardBtn');
  const customBadge = document.getElementById('logCustomBadge');

  closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn.addEventListener('click', () => closeModal(modal));

  // Meal selection tabs
  mealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mealBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTargetMeal = btn.dataset.meal;
      updateConfirmLogButtonText();
    });
  });

  // Quantity stepper — auto-recalculate unless macros are customized
  const onQtyChange = () => {
    if (!state.isLogMacrosCustomized) {
      updateScaledPreview();
    }
    updateActiveChip(parseFloat(qtyInput.value) || 1);
  };

  minusBtn.addEventListener('click', () => {
    let q = parseFloat(qtyInput.value) || 1;
    q = Math.max(0.25, roundTo(q - 0.25, 2));
    qtyInput.value = q;
    onQtyChange();
  });

  plusBtn.addEventListener('click', () => {
    let q = parseFloat(qtyInput.value) || 1;
    q = roundTo(q + 0.25, 2);
    qtyInput.value = q;
    onQtyChange();
  });

  qtyInput.addEventListener('input', onQtyChange);

  chipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = parseFloat(chip.dataset.qty);
      qtyInput.value = q;
      chipBtns.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (!state.isLogMacrosCustomized) {
        updateScaledPreview();
      }
    });
  });

  // When user manually edits a macro field → mark as customized
  [calInput, proInput, carbInput, fatInput].forEach(input => {
    input.addEventListener('input', () => {
      state.isLogMacrosCustomized = true;
      customBadge.style.display = 'inline-flex';
      // Update confirm button with manually entered calories
      const manualCal = parseInt(calInput.value) || 0;
      updateConfirmLogButtonText(manualCal);
    });
  });

  // Reset macros back to scaled food values
  resetBtn.addEventListener('click', () => {
    state.isLogMacrosCustomized = false;
    customBadge.style.display = 'none';
    updateScaledPreview();
  });

  // Confirm logging — reads from editable inputs
  confirmBtn.addEventListener('click', () => {
    if (!state.selectedFoodForLog) return;

    const food = state.selectedFoodForLog;
    const quantity = Math.max(0.05, parseFloat(qtyInput.value) || 1);
    const mealType = state.activeTargetMeal || 'lunch';
    const isCustom = state.isLogMacrosCustomized;

    addMealEntry(state.currentDate, {
      foodId: food.id,
      mealType: mealType,
      name: food.name,
      servingSize: food.servingSize,
      quantity: quantity,
      calories: isCustom ? parseInt(calInput.value) || 0 : undefined,
      protein: isCustom ? parseFloat(proInput.value) || 0 : undefined,
      carbs: isCustom ? parseFloat(carbInput.value) || 0 : undefined,
      fat: isCustom ? parseFloat(fatInput.value) || 0 : undefined,
      isCustomPortion: isCustom,
      baseFood: {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        servingSize: food.servingSize
      }
    });

    closeModal(modal);
    renderDashboard();
    switchView('dashboard');
    showToast(`Logged ${isCustom ? '(custom portion of) ' : ''}"${food.name}" to ${mealType.toUpperCase()}`);
  });
}

function openLogModal(food, preselectedMeal = null) {
  state.selectedFoodForLog = food;
  state.isLogMacrosCustomized = false;
  const modal = document.getElementById('logModal');

  document.getElementById('logFoodId').value = food.id;
  document.getElementById('logFoodNameDisplay').textContent = food.name;
  document.getElementById('logFoodServingDisplay').textContent = `Base: ${food.servingSize} • ${food.calories} kcal (${food.protein}P / ${food.carbs}C / ${food.fat}F)`;

  // Hide custom badge on open
  const customBadge = document.getElementById('logCustomBadge');
  if (customBadge) customBadge.style.display = 'none';

  // Meal selector
  if (preselectedMeal) {
    state.activeTargetMeal = preselectedMeal;
  }
  const mealBtns = modal.querySelectorAll('#logMealSelector .meal-tab-btn');
  mealBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.meal === state.activeTargetMeal);
  });

  // Reset quantity to 1.0 and fill macro inputs from base food
  const qtyInput = document.getElementById('logQuantityInput');
  qtyInput.value = '1.0';
  updateActiveChip(1.0);
  updateScaledPreview();
  updateConfirmLogButtonText();

  openModal(modal);
}

function updateActiveChip(qty) {
  const chips = document.querySelectorAll('#logModal .chip-btn');
  chips.forEach(chip => {
    chip.classList.toggle('active', parseFloat(chip.dataset.qty) === qty);
  });
}

function updateScaledPreview() {
  if (!state.selectedFoodForLog) return;
  const food = state.selectedFoodForLog;
  const qty = Math.max(0.01, parseFloat(document.getElementById('logQuantityInput').value) || 1);
  const scaled = scaleNutrients(food, qty);

  // Populate editable macro input fields
  const calIn = document.getElementById('logCaloriesInput');
  const proIn = document.getElementById('logProteinInput');
  const carbIn = document.getElementById('logCarbsInput');
  const fatIn = document.getElementById('logFatInput');

  if (calIn) calIn.value = scaled.calories;
  if (proIn) proIn.value = scaled.protein;
  if (carbIn) carbIn.value = scaled.carbs;
  if (fatIn) fatIn.value = scaled.fat;

  updateConfirmLogButtonText(scaled.calories);
}

function updateConfirmLogButtonText(calories = null) {
  const meal = state.activeTargetMeal ? state.activeTargetMeal.charAt(0).toUpperCase() + state.activeTargetMeal.slice(1) : 'Diary';
  const text = calories !== null ? `Log to ${meal} • ${calories} kcal` : `Log to ${meal}`;
  document.getElementById('confirmLogText').textContent = text;
}

/* ==================== FOOD DETAILS MODAL (Req #11 & #12) ==================== */
function setupDetailsModal() {
  const modal = document.getElementById('detailsModal');
  const closeBtn = document.getElementById('closeDetailsModalBtn');
  const logBtn = document.getElementById('detailsLogBtn');
  const editBtn = document.getElementById('detailsEditBtn');
  const dupBtn = document.getElementById('detailsDuplicateBtn');

  closeBtn.addEventListener('click', () => closeModal(modal));

  logBtn.addEventListener('click', () => {
    const foodId = document.getElementById('detailsFoodId').value;
    const food = getFoodById(foodId);
    if (food) {
      closeModal(modal);
      openLogModal(food);
    }
  });

  editBtn.addEventListener('click', () => {
    const foodId = document.getElementById('detailsFoodId').value;
    const food = getFoodById(foodId);
    if (food) {
      closeModal(modal);
      openFoodModal(food);
    }
  });

  dupBtn.addEventListener('click', () => {
    const foodId = document.getElementById('detailsFoodId').value;
    const dup = duplicateFood(foodId);
    if (dup) {
      closeModal(modal);
      renderFoodList(document.getElementById('foodSearchInput').value);
      showToast(`Duplicated food`);
    }
  });
}

function openDetailsModal(food) {
  const modal = document.getElementById('detailsModal');
  document.getElementById('detailsFoodId').value = food.id;
  document.getElementById('detailsFoodName').textContent = food.name;
  document.getElementById('detailsFoodServing').textContent = `Serving Size: ${food.servingSize}`;
  document.getElementById('detailsFoodCalories').textContent = food.calories;

  document.getElementById('detailsFoodProtein').textContent = food.protein;
  document.getElementById('detailsFoodCarbs').textContent = food.carbs;
  document.getElementById('detailsFoodFat').textContent = food.fat;
  document.getElementById('detailsFoodFiber').textContent = food.fiber || 0;

  // Macro Energy Ratios
  const ratios = calculateMacroPercentages(food.protein, food.carbs, food.fat);
  document.getElementById('detailsRatioProSeg').style.width = `${ratios.pPct}%`;
  document.getElementById('detailsRatioCarbSeg').style.width = `${ratios.cPct}%`;
  document.getElementById('detailsRatioFatSeg').style.width = `${ratios.fPct}%`;
  document.getElementById('detailsRatioPill').textContent = `${ratios.pPct}% P • ${ratios.cPct}% C • ${ratios.fPct}% F`;

  // REQUIREMENT 11 & 12: CALORIE DISCREPANCY COMPARISON
  // Only show this comparison when saved calories differ from calculated value!
  const calcCalories = calculateEstimatedCalories(food.protein, food.carbs, food.fat);
  const discrepancyCard = document.getElementById('detailsDiscrepancyCard');

  if (Math.round(food.calories) !== calcCalories) {
    discrepancyCard.style.display = 'flex';
    document.getElementById('detailsCalculatedCalLine').textContent = `Calculated from macros: ${calcCalories} kcal`;
    document.getElementById('detailsSavedCalLine').textContent = `Saved calories: ${food.calories} kcal`;
  } else {
    discrepancyCard.style.display = 'none';
  }

  openModal(modal);
}

/* ==================== EDIT LOGGED ENTRY MODAL ==================== */
function setupEntryModal() {
  const modal = document.getElementById('entryModal');
  const closeBtn = document.getElementById('closeEntryModalBtn');
  const cancelBtn = document.getElementById('cancelEntryModalBtn');
  const saveBtn = document.getElementById('saveEntryUpdatesBtn');
  const deleteBtn = document.getElementById('deleteEntryBtn');
  const qtyInput = document.getElementById('editEntryQuantityInput');
  const minusBtn = document.getElementById('editEntryMinusBtn');
  const plusBtn = document.getElementById('editEntryPlusBtn');
  const mealBtns = modal.querySelectorAll('#editMealSelector .meal-tab-btn');

  // Macro editor elements
  const calInput = document.getElementById('editEntryCaloriesInput');
  const proInput = document.getElementById('editEntryProteinInput');
  const carbInput = document.getElementById('editEntryCarbsInput');
  const fatInput = document.getElementById('editEntryFatInput');
  const resetBtn = document.getElementById('editResetToScaleBtn');
  const recalcBtn = document.getElementById('editCalcCalFromMacrosBtn');
  const customBadge = document.getElementById('editCustomBadge');

  closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn.addEventListener('click', () => closeModal(modal));

  mealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mealBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const onQtyChange = () => {
    if (!state.isEditMacrosCustomized) {
      updateEditEntryPreview();
    }
  };

  minusBtn.addEventListener('click', () => {
    let q = parseFloat(qtyInput.value) || 1;
    q = Math.max(0.25, roundTo(q - 0.25, 2));
    qtyInput.value = q;
    onQtyChange();
  });

  plusBtn.addEventListener('click', () => {
    let q = parseFloat(qtyInput.value) || 1;
    q = roundTo(q + 0.25, 2);
    qtyInput.value = q;
    onQtyChange();
  });

  qtyInput.addEventListener('input', onQtyChange);

  // Mark customized when user directly edits macros
  [calInput, proInput, carbInput, fatInput].forEach(input => {
    if (input) input.addEventListener('input', () => {
      state.isEditMacrosCustomized = true;
      if (customBadge) customBadge.style.display = 'inline-flex';
    });
  });

  // Reset to servings-scaled values
  if (resetBtn) resetBtn.addEventListener('click', () => {
    state.isEditMacrosCustomized = false;
    if (customBadge) customBadge.style.display = 'none';
    updateEditEntryPreview();
  });

  // Recalculate calories from macros using 4/4/9 rule
  if (recalcBtn) recalcBtn.addEventListener('click', () => {
    const pro = parseFloat(proInput.value) || 0;
    const carb = parseFloat(carbInput.value) || 0;
    const fat = parseFloat(fatInput.value) || 0;
    const computed = Math.round(pro * 4 + carb * 4 + fat * 9);
    calInput.value = computed;
    state.isEditMacrosCustomized = true;
    if (customBadge) customBadge.style.display = 'inline-flex';
  });

  saveBtn.addEventListener('click', () => {
    const entryId = document.getElementById('editEntryId').value;
    const dateStr = document.getElementById('editEntryDate').value;
    const activeMealBtn = modal.querySelector('#editMealSelector .meal-tab-btn.active');
    const targetMeal = activeMealBtn ? activeMealBtn.dataset.meal : 'lunch';
    const newQty = Math.max(0.05, parseFloat(qtyInput.value) || 1);
    const isCustom = state.isEditMacrosCustomized;

    updateMealEntry(dateStr, entryId, {
      quantity: newQty,
      mealType: targetMeal,
      calories: isCustom ? parseInt(calInput.value) || 0 : undefined,
      protein: isCustom ? parseFloat(proInput.value) || 0 : undefined,
      carbs: isCustom ? parseFloat(carbInput.value) || 0 : undefined,
      fat: isCustom ? parseFloat(fatInput.value) || 0 : undefined,
      isCustomPortion: isCustom
    });

    closeModal(modal);
    renderDashboard();
    showToast(`Updated entry in ${targetMeal.toUpperCase()}`);
  });

  deleteBtn.addEventListener('click', () => {
    const entryId = document.getElementById('editEntryId').value;
    const dateStr = document.getElementById('editEntryDate').value;

    if (confirm('Remove this food item from your diary?')) {
      deleteMealEntry(dateStr, entryId);
      closeModal(modal);
      renderDashboard();
      showToast('Removed food from diary');
    }
  });
}

function openEntryModal(entry) {
  state.selectedEntryForEdit = entry;
  state.isEditMacrosCustomized = entry.isCustomPortion || false;
  const modal = document.getElementById('entryModal');

  document.getElementById('editEntryId').value = entry.id;
  document.getElementById('editEntryDate').value = state.currentDate;
  document.getElementById('editEntryName').textContent = entry.name;
  document.getElementById('editEntryServing').textContent =
    entry.baseFood
      ? `Base: ${entry.baseFood.servingSize || entry.servingSize} • ${entry.baseFood.calories} kcal / serving`
      : `Serving: ${entry.servingSize}`;

  // Show customized badge if entry has custom macros
  const customBadge = document.getElementById('editCustomBadge');
  if (customBadge) customBadge.style.display = state.isEditMacrosCustomized ? 'inline-flex' : 'none';

  // Meal selector
  const mealBtns = modal.querySelectorAll('#editMealSelector .meal-tab-btn');
  mealBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.meal === entry.mealType);
  });

  document.getElementById('editEntryQuantityInput').value = entry.quantity;
  updateEditEntryPreview();
  openModal(modal);
}

function updateEditEntryPreview() {
  if (!state.selectedEntryForEdit) return;
  const entry = state.selectedEntryForEdit;
  const qty = Math.max(0.01, parseFloat(document.getElementById('editEntryQuantityInput').value) || 1);

  // Compute scaled values from baseFood if available, else ratio from current
  let cal, pro, carb, fat;
  if (entry.baseFood) {
    cal = Math.round((parseFloat(entry.baseFood.calories) || 0) * qty);
    pro = roundTo((parseFloat(entry.baseFood.protein) || 0) * qty, 1);
    carb = roundTo((parseFloat(entry.baseFood.carbs) || 0) * qty, 1);
    fat = roundTo((parseFloat(entry.baseFood.fat) || 0) * qty, 1);
  } else {
    const ratio = qty / entry.quantity;
    cal = Math.round(entry.calories * ratio);
    pro = roundTo(entry.protein * ratio, 1);
    carb = roundTo(entry.carbs * ratio, 1);
    fat = roundTo(entry.fat * ratio, 1);
  }

  // Only update fields if not customized by user
  if (!state.isEditMacrosCustomized) {
    const calIn = document.getElementById('editEntryCaloriesInput');
    const proIn = document.getElementById('editEntryProteinInput');
    const carbIn = document.getElementById('editEntryCarbsInput');
    const fatIn = document.getElementById('editEntryFatInput');
    if (calIn) calIn.value = cal;
    if (proIn) proIn.value = pro;
    if (carbIn) carbIn.value = carb;
    if (fatIn) fatIn.value = fat;
  }
}

/* ==================== QUICK ADD MODAL ==================== */
function setupQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  if (!modal) return;

  const closeBtn = document.getElementById('closeQuickAddModalBtn');
  const cancelBtn = document.getElementById('cancelQuickAddBtn');
  const form = document.getElementById('quickAddForm');
  const mealBtns = modal.querySelectorAll('#quickMealSelector .meal-tab-btn');
  const calInput = document.getElementById('quickCaloriesInput');
  const proInput = document.getElementById('quickProteinInput');
  const carbInput = document.getElementById('quickCarbsInput');
  const fatInput = document.getElementById('quickFatInput');
  const autoCalcBtn = document.getElementById('quickAutoCalcCalBtn');

  closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn.addEventListener('click', () => closeModal(modal));

  // Meal tab selection
  mealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mealBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ⚡ Calculate calories from macros (4/4/9 rule)
  if (autoCalcBtn) {
    autoCalcBtn.addEventListener('click', () => {
      const pro = parseFloat(proInput.value) || 0;
      const carb = parseFloat(carbInput.value) || 0;
      const fat = parseFloat(fatInput.value) || 0;
      const computed = Math.round(pro * 4 + carb * 4 + fat * 9);
      calInput.value = computed;
    });
  }

  // Form submit — log the custom quick-add entry
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeMealBtn = modal.querySelector('#quickMealSelector .meal-tab-btn.active');
    const mealType = activeMealBtn ? activeMealBtn.dataset.meal : 'lunch';
    const name = document.getElementById('quickFoodName').value.trim() || 'Quick Meal';
    const calories = parseInt(calInput.value) || 0;
    const protein = parseFloat(proInput.value) || 0;
    const carbs = parseFloat(carbInput.value) || 0;
    const fat = parseFloat(fatInput.value) || 0;

    addMealEntry(state.currentDate, {
      mealType,
      name,
      servingSize: 'custom',
      quantity: 1,
      calories,
      protein,
      carbs,
      fat,
      fiber: 0,
      isCustomPortion: true
    });

    closeModal(modal);
    renderDashboard();
    switchView('dashboard');
    showToast(`⚡ Logged "${name}" to ${mealType.toUpperCase()}`);
  });
}

function openQuickAddModal(preselectedMeal = 'lunch') {
  const modal = document.getElementById('quickAddModal');
  if (!modal) return;

  // Reset form
  document.getElementById('quickAddForm').reset();

  // Set meal tabs
  const mealBtns = modal.querySelectorAll('#quickMealSelector .meal-tab-btn');
  mealBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.meal === preselectedMeal);
  });

  openModal(modal);
}

function setupWeightModal() {
  const modal = document.getElementById('weightModal');
  document.getElementById('logWeightBtn').addEventListener('click', () => openWeightModal());
  document.getElementById('closeWeightModalBtn').addEventListener('click', () => closeModal(modal));
  document.getElementById('cancelWeightModalBtn').addEventListener('click', () => closeModal(modal));
  document.getElementById('weightForm').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      saveWeightEntry({
        id: document.getElementById('weightEntryId').value || undefined,
        weight: document.getElementById('weightInput').value,
        dateTime: document.getElementById('weightDateTimeInput').value,
        note: document.getElementById('weightNoteInput').value
      });
      closeModal(modal);
      renderAnalytics();
      showToast('Weight saved');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('deleteWeightBtn').addEventListener('click', () => {
    const id = document.getElementById('weightEntryId').value;
    if (!id || !confirm('Delete this weight measurement?')) return;
    deleteWeightEntry(id);
    closeModal(modal);
    renderAnalytics();
    showToast('Weight measurement deleted');
  });
}

function openWeightModal(entry = null) {
  document.getElementById('weightModalTitle').textContent = entry ? 'Edit weight' : 'Log weight';
  document.getElementById('weightEntryId').value = entry?.id || '';
  document.getElementById('weightInput').value = entry?.weight ?? '';
  document.getElementById('weightDateTimeInput').value = entry ? toLocalDateTimeInput(entry.timestamp) : toLocalDateTimeInput(new Date());
  document.getElementById('weightNoteInput').value = entry?.note || '';
  document.getElementById('deleteWeightBtn').hidden = !entry;
  openModal(document.getElementById('weightModal'));
}

function setupAnalytics() {
  document.querySelectorAll('[data-analytics-range]').forEach((button) => {
    button.addEventListener('click', () => {
      state.analyticsRange = button.dataset.analyticsRange;
      document.querySelectorAll('[data-analytics-range]').forEach((item) => item.classList.toggle('active', item === button));
      renderAnalytics();
    });
  });
  document.querySelectorAll('[data-analytics-macro]').forEach((button) => {
    button.addEventListener('click', () => {
      state.analyticsMacro = button.dataset.analyticsMacro;
      document.querySelectorAll('[data-analytics-macro]').forEach((item) => item.classList.toggle('active', item === button));
      renderAnalytics();
    });
  });

  document.getElementById('manualStepsDate').value = getTodayDateString();
  document.getElementById('stepGoalInput').value = getStepGoal();
  document.getElementById('stepGoalForm').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      saveStepGoal(document.getElementById('stepGoalInput').value);
      renderAnalytics();
      showToast('Step goal saved');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('manualStepsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      saveManualSteps(document.getElementById('manualStepsDate').value, document.getElementById('manualStepsValue').value);
      document.getElementById('manualStepsValue').value = '';
      renderAnalytics();
      showToast('Manual steps saved');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('healthConnectBtn').addEventListener('click', connectHealthConnect);
}

function getAnalyticsDates(today) {
  const dates = [
    ...getWeightEntries().map((entry) => entry.date),
    ...getActivityEntries().map((entry) => entry.date),
    ...getLogDates()
  ].filter(Boolean).sort();
  return getDateSequence(getRangeStart(state.analyticsRange, today, dates[0] || today), today);
}

function renderAnalytics() {
  const today = getTodayDateString();
  const dates = getAnalyticsDates(today);
  const weights = getWeightEntries();
  const summary = getWeightSummary(weights, today);
  const formatWeight = (value) => Number.isFinite(value) ? `${value.toFixed(1)} kg` : '—';
  document.getElementById('latestWeightValue').textContent = formatWeight(summary.latest ? Number(summary.latest.weight) : NaN);
  document.getElementById('todayWeightValue').textContent = summary.today ? formatWeight(Number(summary.today.weight)) : 'No entry';
  document.getElementById('previousWeightValue').textContent = summary.previous ? formatWeight(Number(summary.previous.weight)) : '—';
  document.getElementById('weightAverageValue').textContent = formatWeight(summary.average7Day);
  document.getElementById('weightChangeValue').textContent = summary.change === null
    ? '—'
    : `${summary.change > 0 ? '+' : ''}${summary.change.toFixed(1)} kg`;

  const weightTrend = getWeightTrendSeries(weights).filter((point) => point.date >= dates[0] && point.date <= today);
  document.getElementById('weightChart').innerHTML = createLineChartSvg(weightTrend, [
    { key: 'weight', label: 'Daily average', className: 'weight-raw', unit: 'kg' },
    { key: 'average7Day', label: '7-day average', className: 'weight-average', unit: 'kg' }
  ], state.analyticsRange);
  document.getElementById('weightHistoryCount').textContent = `${weights.length} measurement${weights.length === 1 ? '' : 's'}`;
  renderWeightHistory(weights);

  const nutrition = getNutritionSeries(dates, getDayEntries, getTargets);
  const recentDates = getDateSequence(getRangeStart('7', today), today);
  const recentNutrition = getNutritionSeries(recentDates, getDayEntries, getTargets).filter((item) => item.tracked);
  const calorieAverage = averageFor(recentNutrition, 'calories');
  const calorieTarget = Number(getTargets().calories) || 0;
  document.getElementById('averageCaloriesValue').textContent = calorieAverage === null ? '—' : `${Math.round(calorieAverage).toLocaleString()} kcal`;
  document.getElementById('calorieTargetDifference').textContent = calorieAverage === null
    ? '—'
    : `${Math.round(calorieAverage - calorieTarget) > 0 ? '+' : ''}${Math.round(calorieAverage - calorieTarget)} kcal`;
  document.getElementById('calorieAverageCaption').textContent = `${recentNutrition.length} of the last 7 days have food entries. Average uses logged days only.`;
  const calorieChart = nutrition.map((item) => ({ ...item, calories: item.tracked ? item.calories : null }));
  document.getElementById('calorieChart').innerHTML = createLineChartSvg(calorieChart, [
    { key: 'calories', label: 'Consumed', className: 'calorie-line', unit: 'kcal' },
    { key: 'target', label: 'Target', className: 'target-line', unit: 'kcal' }
  ], state.analyticsRange);

  const macro = state.analyticsMacro;
  const macroTarget = getTargets()[macro];
  const hasMacroTarget = macroTarget !== null && macroTarget !== undefined && Number.isFinite(Number(macroTarget));
  const macroSeries = nutrition.map((item) => ({
    ...item,
    [macro]: item.tracked ? item[macro] : null,
    macroTarget: hasMacroTarget ? Number(macroTarget) : null
  }));
  const macroTitle = { protein: 'Protein', carbs: 'Carbohydrates', fat: 'Fat', fiber: 'Fiber' }[macro];
  const macroLines = [{ key: macro, label: macroTitle, className: 'macro-line', unit: 'g' }];
  if (hasMacroTarget) macroLines.push({ key: 'macroTarget', label: `${macroTitle} target`, className: 'target-line', unit: 'g' });
  document.getElementById('macroChart').innerHTML = createLineChartSvg(macroSeries, macroLines, state.analyticsRange);

  document.getElementById('stepGoalInput').value = getStepGoal();
  renderActivityAnalytics(dates, today);
}

function renderWeightHistory(entries) {
  const list = document.getElementById('weightHistoryList');
  if (!entries.length) {
    list.innerHTML = '<p class="empty-history">No measurements yet.</p>';
    return;
  }
  list.innerHTML = entries.map((entry) => `
    <div class="weight-history-row">
      <div><strong>${Number(entry.weight).toFixed(1)} kg</strong><span>${new Date(entry.timestamp).toLocaleString()}</span>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}</div>
      <div class="weight-history-actions">
        <button type="button" class="action-icon-btn" data-edit-weight="${escapeHtml(entry.id)}" title="Edit weight" aria-label="Edit weight">${icons.edit}</button>
        <button type="button" class="action-icon-btn danger" data-delete-weight="${escapeHtml(entry.id)}" title="Delete weight" aria-label="Delete weight">${icons.trash}</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('[data-edit-weight]').forEach((button) => {
    button.addEventListener('click', () => openWeightModal(entries.find((entry) => entry.id === button.dataset.editWeight)));
  });
  list.querySelectorAll('[data-delete-weight]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!confirm('Delete this weight measurement?')) return;
      deleteWeightEntry(button.dataset.deleteWeight);
      renderAnalytics();
      showToast('Weight measurement deleted');
    });
  });
}

function renderActivityAnalytics(dates, today) {
  const summary = getActivitySummary(today);
  const stepsToday = summary.today?.steps;
  document.getElementById('stepsTodayValue').textContent = Number.isFinite(stepsToday) ? stepsToday.toLocaleString() : 'No data';
  document.getElementById('stepGoalValue').textContent = summary.goal.toLocaleString();
  document.getElementById('weeklyStepsValue').textContent = summary.weeklyAverage === null
    ? 'No data'
    : `${summary.weeklyAverage.toLocaleString()} / tracked day`;
  const sourceLabel = summary.today?.hasImported
    ? summary.today.source.replace(/health-connect/g, 'Health Connect')
    : summary.today ? 'Manual entry' : 'no entry';
  document.getElementById('stepSourceStatus').textContent = `Today's source: ${sourceLabel}`;
  const byDate = new Map(getActivityEntries().map((entry) => [entry.date, entry.steps]));
  const series = dates.map((date) => ({
    date,
    steps: byDate.has(date) ? byDate.get(date) : null,
    stepGoal: summary.goal
  }));
  document.getElementById('stepsChart').innerHTML = series.some((point) => Number.isFinite(point.steps))
    ? createLineChartSvg(series, [
      { key: 'steps', label: 'Steps', className: 'activity-line', unit: 'steps' },
      { key: 'stepGoal', label: 'Goal', className: 'target-line', unit: 'steps' }
    ], state.analyticsRange)
    : '<div class="chart-empty">No step data in this date range.</div>';
}

async function refreshHealthConnectSteps() {
  const statusElement = document.getElementById('healthConnectStatus');
  const button = document.getElementById('healthConnectBtn');
  const status = await getHealthConnectStatus();
  button.textContent = status.connected ? 'Sync steps' : 'Connect';
  if (!status.available || !status.connected) {
    statusElement.textContent = status.message;
    return;
  }

  statusElement.textContent = 'Connected to Health Connect. Updating the last 30 days...';
  try {
    const today = getTodayDateString();
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - 29);
    const records = await readHealthConnectSteps(localDateString(start), today);
    saveImportedSteps(records);
    statusElement.textContent = `Connected to Health Connect. Synced ${records.length} days just now.`;
    renderAnalytics();
  } catch (error) {
    statusElement.textContent = 'Connected, but steps could not be synced. Check Health Connect permissions.';
  }
}

async function connectHealthConnect() {
  const status = await getHealthConnectStatus();
  if (!status.available) {
    document.getElementById('healthConnectStatus').textContent = status.message;
    return;
  }
  if (!status.connected) {
    try {
      const result = await requestHealthConnectPermission();
      if (!result.connected) {
        document.getElementById('healthConnectStatus').textContent = 'Step access was not granted.';
        return;
      }
    } catch (error) {
      document.getElementById('healthConnectStatus').textContent = error.message;
      return;
    }
  }
  await refreshHealthConnectSteps();
}

/* ==================== SETTINGS & TARGETS MODAL ==================== */
function setupSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('openSettingsBtn');
  const closeBtn = document.getElementById('closeSettingsModalBtn');
  const cancelBtn = document.getElementById('cancelSettingsBtn');
  const form = document.getElementById('settingsForm');
  const darkBtn = document.getElementById('themeDarkOptionBtn');
  const lightBtn = document.getElementById('themeLightOptionBtn');
  const exportBtn = document.getElementById('exportDataBtn');
  const importBtn = document.getElementById('importDataBtn');
  const fileInput = document.getElementById('importFileInput');
  const resetBtn = document.getElementById('resetDemoBtn');

  openBtn.addEventListener('click', () => {
    const targets = getTargets();
    document.getElementById('settingCalories').value = targets.calories;
    document.getElementById('settingProtein').value = targets.protein;
    document.getElementById('settingCarbs').value = targets.carbs || '';
    document.getElementById('settingFat').value = targets.fat || '';
    openModal(modal);
  });

  closeBtn.addEventListener('click', () => closeModal(modal));
  cancelBtn.addEventListener('click', () => closeModal(modal));

  darkBtn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    saveSettings({ theme: 'dark' });
    updateThemeButton('dark');
    showToast('Dark theme activated');
  });

  lightBtn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    saveSettings({ theme: 'light' });
    updateThemeButton('light');
    showToast('Light theme activated');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cals = sanitizeNumber(document.getElementById('settingCalories').value, 2000);
    const pro = sanitizeNumber(document.getElementById('settingProtein').value, 140);
    const carbVal = document.getElementById('settingCarbs').value;
    const fatVal = document.getElementById('settingFat').value;

    const carbs = carbVal !== '' ? sanitizeNumber(carbVal, 0) : null;
    const fat = fatVal !== '' ? sanitizeNumber(fatVal, 0) : null;

    saveTargets({ calories: cals, protein: pro, carbs, fat });
    closeModal(modal);
    renderDashboard();
    showToast('Daily targets saved successfully!');
  });

  // Export
  exportBtn.addEventListener('click', () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caltrack-backup-${getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded');
  });

  // Import
  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        importAllData(parsed);
        applySavedTheme();
        renderDashboard();
        renderFoodList();
        closeModal(modal);
        showToast('Data imported successfully!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // Reset demo
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all foods and logs back to the default demo data?')) {
      resetToDemoData();
      applySavedTheme();
      renderDashboard();
      renderFoodList();
      closeModal(modal);
      showToast('Reset to example food & default settings');
    }
  });
}

/* ==================== MODAL HELPERS ==================== */
function openModal(modalEl) {
  if (state.activeModal) {
    state.activeModal.classList.remove('open');
  }
  state.activeModal = modalEl;
  modalEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
  modalEl.classList.remove('open');
  state.activeModal = null;
  document.body.style.overflow = '';
}

// Close when tapping backdrop
document.querySelectorAll('.modal-backdrop').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
});

/* ==================== TOAST NOTIFICATIONS ==================== */
let toastTimeout = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  if (toastTimeout) clearTimeout(toastTimeout);

  iconEl.innerHTML = icons.check;
  msgEl.textContent = message;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/* ==================== UTILITY ==================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
