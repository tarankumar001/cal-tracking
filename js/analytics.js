import { calculateDayTotals } from './nutrition.js';

export function getDateSequence(startDate, endDate) {
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates = [];
  while (cursor <= end) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function getRangeStart(range, today, firstDate = today) {
  if (range === 'all') return firstDate;
  const days = Number(range);
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - Math.max(0, days - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getNutritionSeries(dates, getDayEntries, getTargets) {
  const target = Number(getTargets().calories) || 0;
  return dates.map((date) => {
    const entries = getDayEntries(date);
    const { dayTotal } = calculateDayTotals(entries);
    return { date, ...dayTotal, target, tracked: entries.length > 0 };
  });
}

export function averageFor(series, key) {
  if (!series.length) return null;
  return series.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / series.length;
}

export function formatChartDate(date, range = '30') {
  const parsed = new Date(`${date}T00:00:00`);
  const options = range === '7'
    ? { weekday: 'short' }
    : { month: 'short', day: 'numeric' };
  return parsed.toLocaleDateString(undefined, options);
}

export function createLineChartSvg(series, lines, range = '30', height = 190) {
  const stride = Math.max(1, Math.ceil(series.length / 90));
  const plottedSeries = series.length > 90
    ? series.filter((_, index) => index % stride === 0 || index === series.length - 1)
    : series;
  const width = Math.max(320, plottedSeries.length * 34);
  const left = 38;
  const right = width - 12;
  const top = 14;
  const bottom = height - 30;
  const values = plottedSeries.flatMap((point) => lines.map((line) => point[line.key])).filter(Number.isFinite);
  if (!values.length) return '<div class="chart-empty">Log some data to see a trend.</div>';

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max((maxValue - minValue) * 0.16, maxValue === 0 ? 1 : Math.abs(maxValue) * 0.04);
  const min = Math.max(0, minValue - padding);
  const max = maxValue + padding || 1;
  const x = (index) => left + (plottedSeries.length === 1 ? 0 : (index / (plottedSeries.length - 1)) * (right - left));
  const y = (value) => bottom - ((value - min) / (max - min || 1)) * (bottom - top);
  const grid = [0, 1, 2, 3].map((step) => {
    const position = top + ((bottom - top) * step) / 3;
    const labelValue = max - ((max - min) * step) / 3;
    return `<line class="chart-grid-line" x1="${left}" y1="${position}" x2="${right}" y2="${position}"/><text class="chart-axis-label" x="${left - 6}" y="${position + 3}" text-anchor="end">${Math.round(labelValue)}</text>`;
  }).join('');
  const paths = lines.map((line) => {
    let activePath = [];
    const segments = [];
    plottedSeries.forEach((point, index) => {
      const value = point[line.key];
      if (!Number.isFinite(value)) {
        if (activePath.length) segments.push(activePath);
        activePath = [];
      } else {
        activePath.push(`${x(index)},${y(value)}`);
      }
    });
    if (activePath.length) segments.push(activePath);
    const pathMarkup = segments.map((points) => `<polyline class="chart-line ${line.className}" points="${points.join(' ')}"/>`).join('');
    const dots = plottedSeries.map((point, index) => Number.isFinite(point[line.key])
      ? `<circle class="chart-dot ${line.className}" cx="${x(index)}" cy="${y(point[line.key])}" r="2.7"><title>${point.date}: ${point[line.key]} ${line.unit || ''}</title></circle>`
      : '').join('');
    return pathMarkup + dots;
  }).join('');
  const labelStride = Math.max(1, Math.ceil(plottedSeries.length / 6));
  const labels = plottedSeries.map((point, index) => index % labelStride === 0 || index === plottedSeries.length - 1
    ? `<text class="chart-date-label" x="${x(index)}" y="${height - 6}" text-anchor="middle">${formatChartDate(point.date, range)}</text>`
    : '').join('');

  return `<svg class="trend-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${lines.map((line) => line.label).join(' and ')} over time" preserveAspectRatio="none">${grid}${paths}${labels}</svg>`;
}