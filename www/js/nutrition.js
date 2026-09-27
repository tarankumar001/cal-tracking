/**
 * Nutrition Utility Module
 * Handles calorie estimation (4/4/9 rule), scaling for servings,
 * totals aggregation, remaining target calculations, and input sanitization.
 */

export const MACRO_CALORIE_FACTORS = {
  protein: 4,
  carbs: 4,
  fat: 9
};

/**
 * Calculate estimated calories based on the 4/4/9 rule:
 * Calories = (Protein × 4) + (Carbohydrates × 4) + (Fat × 9)
 * @param {number} protein - Protein in grams
 * @param {number} carbs - Carbohydrates in grams
 * @param {number} fat - Fat in grams
 * @returns {number} Estimated calories (rounded to nearest integer)
 */
export function calculateEstimatedCalories(protein = 0, carbs = 0, fat = 0) {
  const p = Math.max(0, parseFloat(protein) || 0);
  const c = Math.max(0, parseFloat(carbs) || 0);
  const f = Math.max(0, parseFloat(fat) || 0);
  
  return Math.round(
    (p * MACRO_CALORIE_FACTORS.protein) +
    (c * MACRO_CALORIE_FACTORS.carbs) +
    (f * MACRO_CALORIE_FACTORS.fat)
  );
}

/**
 * Check if the saved calories differ from the 4/4/9 macro-calculated calories.
 * @param {number} savedCalories 
 * @param {number} protein 
 * @param {number} carbs 
 * @param {number} fat 
 * @returns {boolean}
 */
export function hasCalorieDiscrepancy(savedCalories, protein, carbs, fat) {
  const calculated = calculateEstimatedCalories(protein, carbs, fat);
  const saved = Math.round(parseFloat(savedCalories) || 0);
  return saved !== calculated;
}

/**
 * Scale food nutrients by a given quantity/serving multiplier.
 * @param {Object} food - { calories, protein, carbs, fat, fiber }
 * @param {number} quantity - Multiplier (e.g. 0.5, 1, 1.5, 2)
 * @returns {Object} Scaled nutrients
 */
export function scaleNutrients(food, quantity = 1) {
  const q = Math.max(0, parseFloat(quantity) || 0);
  const calories = Math.round((parseFloat(food.calories) || 0) * q);
  const protein = roundTo( (parseFloat(food.protein) || 0) * q, 1);
  const carbs = roundTo( (parseFloat(food.carbs) || 0) * q, 1);
  const fat = roundTo( (parseFloat(food.fat) || 0) * q, 1);
  const fiber = roundTo( (parseFloat(food.fiber) || 0) * q, 1);

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    quantity: q
  };
}

/**
 * Sum a list of meal entries.
 * @param {Array<Object>} entries
 * @returns {Object} Total { calories, protein, carbs, fat, fiber }
 */
export function sumEntries(entries = []) {
  return entries.reduce(
    (acc, item) => {
      acc.calories += Math.round(parseFloat(item.calories) || 0);
      acc.protein += parseFloat(item.protein) || 0;
      acc.carbs += parseFloat(item.carbs) || 0;
      acc.fat += parseFloat(item.fat) || 0;
      acc.fiber += parseFloat(item.fiber) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

/**
 * Calculate totals for a full day grouped by meal.
 * @param {Array<Object>} dayEntries - All entries logged for the day
 * @returns {Object} Totals for day and broken down by meal
 */
export function calculateDayTotals(dayEntries = []) {
  const meals = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  };

  dayEntries.forEach(entry => {
    const meal = (entry.mealType || 'snacks').toLowerCase();
    if (meals[meal]) {
      meals[meal].push(entry);
    } else {
      meals.snacks.push(entry);
    }
  });

  const mealTotals = {
    breakfast: sumEntries(meals.breakfast),
    lunch: sumEntries(meals.lunch),
    dinner: sumEntries(meals.dinner),
    snacks: sumEntries(meals.snacks)
  };

  const dayTotal = sumEntries(dayEntries);
  // Round decimals cleanly
  dayTotal.protein = roundTo(dayTotal.protein, 1);
  dayTotal.carbs = roundTo(dayTotal.carbs, 1);
  dayTotal.fat = roundTo(dayTotal.fat, 1);
  dayTotal.fiber = roundTo(dayTotal.fiber, 1);

  return {
    dayTotal,
    mealTotals,
    meals
  };
}

/**
 * Calculate remaining calories and macros given targets and consumed values.
 * @param {Object} targets - { calories, protein, carbs, fat }
 * @param {Object} consumed - { calories, protein, carbs, fat }
 * @returns {Object} { remainingCalories, remainingProtein, remainingCarbs, remainingFat, caloriePercent, proteinPercent }
 */
export function calculateRemaining(targets, consumed) {
  const calTarget = parseFloat(targets.calories) || 0;
  const proTarget = parseFloat(targets.protein) || 0;
  const carbTarget = parseFloat(targets.carbs) || 0;
  const fatTarget = parseFloat(targets.fat) || 0;

  const calConsumed = Math.round(parseFloat(consumed.calories) || 0);
  const proConsumed = roundTo(parseFloat(consumed.protein) || 0, 1);
  const carbConsumed = roundTo(parseFloat(consumed.carbs) || 0, 1);
  const fatConsumed = roundTo(parseFloat(consumed.fat) || 0, 1);

  const calRemaining = calTarget - calConsumed;
  const proRemaining = roundTo(proTarget - proConsumed, 1);
  const carbRemaining = carbTarget ? roundTo(carbTarget - carbConsumed, 1) : null;
  const fatRemaining = fatTarget ? roundTo(fatTarget - fatConsumed, 1) : null;

  const calPercent = calTarget > 0 ? Math.min(Math.round((calConsumed / calTarget) * 100), 200) : 0;
  const proPercent = proTarget > 0 ? Math.min(Math.round((proConsumed / proTarget) * 100), 200) : 0;
  const carbPercent = carbTarget > 0 ? Math.min(Math.round((carbConsumed / carbTarget) * 100), 200) : 0;
  const fatPercent = fatTarget > 0 ? Math.min(Math.round((fatConsumed / fatTarget) * 100), 200) : 0;

  return {
    calTarget,
    proTarget,
    carbTarget,
    fatTarget,
    calConsumed,
    proConsumed,
    carbConsumed,
    fatConsumed,
    calRemaining,
    proRemaining,
    carbRemaining,
    fatRemaining,
    calPercent,
    proPercent,
    carbPercent,
    fatPercent,
    isCalOver: calRemaining < 0,
    isProOver: proRemaining < 0
  };
}

/**
 * Calculate macro calorie percentages (Protein, Carbs, Fat contribution)
 * @param {number} protein 
 * @param {number} carbs 
 * @param {number} fat 
 * @returns {Object} { pPct, cPct, fPct }
 */
export function calculateMacroPercentages(protein, carbs, fat) {
  const pCal = (parseFloat(protein) || 0) * 4;
  const cCal = (parseFloat(carbs) || 0) * 4;
  const fCal = (parseFloat(fat) || 0) * 9;
  const totalCal = pCal + cCal + fCal;

  if (totalCal <= 0) {
    return { pPct: 0, cPct: 0, fPct: 0 };
  }

  return {
    pPct: Math.round((pCal / totalCal) * 100),
    cPct: Math.round((cCal / totalCal) * 100),
    fPct: Math.round((fCal / totalCal) * 100)
  };
}

/**
 * Round a number to specified decimal places
 * @param {number} num 
 * @param {number} decimals 
 * @returns {number}
 */
export function roundTo(num, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Sanitize numeric input (ensure >= 0)
 * @param {*} val 
 * @param {number} fallback 
 * @returns {number}
 */
export function sanitizeNumber(val, fallback = 0) {
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return fallback;
  return num;
}
