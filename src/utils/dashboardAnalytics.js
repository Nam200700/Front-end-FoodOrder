/**
 * Phân tích chuỗi thời gian cho DASHBOARD (admin + owner) — tính hoàn toàn ở CLIENT
 * từ chuỗi ngày mà server đã trả sẵn (dailyGmv / dailyRevenue / report.daily), nên KHÔNG
 * cần thêm endpoint. Mọi con số vẫn là số THẬT (chỉ là gom lại theo kỳ), không bịa.
 *
 * Chuỗi đầu vào: [{ date:'yyyy-MM-dd', <valueKey>:number, orders?:number }, ...]
 *   - valueKey: tên trường tiền (vd 'gmv' cho admin, 'revenue' cho owner)
 *   - countKey: tên trường số đơn (mặc định 'orders')
 */

// yyyy-MM-dd (local) — khớp với cách BE serialize LocalDate.toString()
const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/** Parse 'yyyy-MM-dd' về Date local (00:00). Trả null nếu hỏng. */
const parseDay = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** Chuẩn hoá chuỗi → map 'yyyy-MM-dd' → {value, count}. Bỏ điểm ngày hỏng. */
function toDayMap(series, valueKey, countKey = 'orders') {
  const map = new Map();
  (series || []).forEach((r) => {
    const key = String(r.date || '').slice(0, 10);
    if (!key) return;
    const value = Number(r[valueKey] || 0);
    const count = Number(r[countKey] || 0);
    const prev = map.get(key);
    if (prev) { prev.value += value; prev.count += count; }
    else map.set(key, { value, count });
  });
  return map;
}

/** Tổng {value, count} trong [from, to] (bao gồm 2 đầu, theo ngày). */
function sumBetween(dayMap, from, to) {
  let value = 0, count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const hit = dayMap.get(iso(cur));
    if (hit) { value += hit.value; count += hit.count; }
    cur.setDate(cur.getDate() + 1);
  }
  return { value, count };
}

/** Δ% + hướng, chỉ quy ra % khi kỳ trước > 0 (tránh +100% ảo). */
function delta(cur, prev) {
  if (prev > 0) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { has: true, pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
  }
  return { has: false, pct: 0, dir: cur > 0 ? 'up' : 'flat' };
}

const startOfWeek = (d) => {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * SO SÁNH KỲ: hôm nay↔hôm qua · tuần này↔tuần trước · tháng này↔tháng trước.
 * Mỗi mục: { cur, prev, curCount, prevCount, valueDelta, countDelta }.
 */
export function periodComparison(series, valueKey, countKey = 'orders', now = new Date()) {
  const dayMap = toDayMap(series, valueKey, countKey);

  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const wkStart = startOfWeek(today);
  const lastWkStart = new Date(wkStart); lastWkStart.setDate(lastWkStart.getDate() - 7);
  const lastWkEnd = new Date(wkStart); lastWkEnd.setDate(lastWkEnd.getDate() - 1);

  const monStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const build = (curFrom, curTo, prevFrom, prevTo) => {
    const c = sumBetween(dayMap, curFrom, curTo);
    const p = sumBetween(dayMap, prevFrom, prevTo);
    return {
      cur: c.value, prev: p.value, curCount: c.count, prevCount: p.count,
      valueDelta: delta(c.value, p.value), countDelta: delta(c.count, p.count),
    };
  };

  return {
    day: build(today, today, yesterday, yesterday),
    week: build(wkStart, today, lastWkStart, lastWkEnd),
    month: build(monStart, today, lastMonStart, lastMonEnd),
  };
}

/**
 * SO SÁNH KỲ ĐANG CHỌN vs KỲ TRƯỚC TƯƠNG ĐƯƠNG cho trang Thống kê.
 *   range: '7days' | '30days' | 'thisMonth' | 'all'  ('all' → null vì không có kỳ trước)
 * Trả { cur, prev, curCount, prevCount, valueDelta, countDelta, label } hoặc null.
 */
export function rangeOverRange(series, valueKey, range, countKey = 'orders', now = new Date()) {
  if (!range || range === 'all') return null;
  const dayMap = toDayMap(series, valueKey, countKey);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let curFrom, curTo, prevFrom, prevTo, label;

  if (range === 'today') {
    curFrom = new Date(today); curTo = new Date(today);
    prevFrom = addDays(today, -1); prevTo = addDays(today, -1);
    label = 'hôm qua';
  } else if (range === '7days' || range === '30days' || range === '90days') {
    const span = range === '7days' ? 7 : range === '30days' ? 30 : 90;
    curTo = new Date(today);
    curFrom = addDays(today, -(span - 1));
    prevTo = addDays(curFrom, -1);
    prevFrom = addDays(prevTo, -(span - 1));
    label = `${span} ngày trước đó`;
  } else if (range === 'thisWeek') {
    curFrom = startOfWeek(today); curTo = new Date(today);
    const elapsed = Math.round((curTo - curFrom) / 86400000);
    prevFrom = addDays(curFrom, -7);
    prevTo = addDays(prevFrom, elapsed);
    label = 'cùng kỳ tuần trước';
  } else if (range === 'thisMonth') {
    curFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    curTo = new Date(today);
    const elapsed = today.getDate();
    prevFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    prevTo = addDays(prevFrom, elapsed - 1); // cùng số ngày đã trôi
    label = 'cùng kỳ tháng trước';
  } else if (range === 'lastMonth') {
    curFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    curTo = new Date(today.getFullYear(), today.getMonth(), 0); // ngày cuối tháng trước
    prevFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    prevTo = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    label = 'tháng trước nữa';
  } else if (range === 'thisYear') {
    curFrom = new Date(today.getFullYear(), 0, 1); curTo = new Date(today);
    const elapsed = Math.round((curTo - curFrom) / 86400000);
    prevFrom = new Date(today.getFullYear() - 1, 0, 1);
    prevTo = addDays(prevFrom, elapsed);
    label = 'cùng kỳ năm trước';
  } else {
    return null;
  }

  const cur = sumBetween(dayMap, curFrom, curTo);
  const prev = sumBetween(dayMap, prevFrom, prevTo);
  return {
    cur: cur.value, prev: prev.value, curCount: cur.count, prevCount: prev.count,
    valueDelta: delta(cur.value, prev.value), countDelta: delta(cur.count, prev.count), label,
  };
}

/**
 * DỰ BÁO CUỐI THÁNG theo tốc độ (run-rate): projected = tháng-đến-nay / ngày-đã-qua × ngày-trong-tháng.
 * So với THÁNG TRƯỚC (đủ tháng) để biết đang trên/dưới đà.
 */
export function monthEndForecast(series, valueKey, countKey = 'orders', now = new Date()) {
  const dayMap = toDayMap(series, valueKey, countKey);
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const monStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysElapsed = today.getDate(); // 1..daysInMonth

  const mtd = sumBetween(dayMap, monStart, today);

  const lastMonStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonth = sumBetween(dayMap, lastMonStart, lastMonEnd);

  const projValue = daysElapsed > 0 ? Math.round((mtd.value / daysElapsed) * daysInMonth) : 0;
  const projCount = daysElapsed > 0 ? Math.round((mtd.count / daysElapsed) * daysInMonth) : 0;

  return {
    mtdValue: mtd.value, mtdCount: mtd.count,
    projValue, projCount,
    daysElapsed, daysInMonth, daysLeft: daysInMonth - daysElapsed,
    lastMonthValue: lastMonth.value, lastMonthCount: lastMonth.count,
    // Đà so với tháng trước (dựa trên dự báo cả tháng)
    vsLastMonth: delta(projValue, lastMonth.value),
    // % hoàn thành nếu lấy tháng trước làm mốc mục tiêu
    progressPct: lastMonth.value > 0 ? Math.min(999, Math.round((mtd.value / lastMonth.value) * 100)) : null,
  };
}

/**
 * ĐƯỜNG XU HƯỚNG: hồi quy tuyến tính (least squares) trên `window` ngày gần nhất,
 * chiếu tiếp `horizon` ngày tới. Trả về:
 *   { recent: [{date,label,actual,forecast}], forecast: [...], slope }
 * Điểm cuối của `recent` được set cả actual & forecast để 2 đường NỐI liền nhau.
 */
export function forecastNextDays(series, valueKey, { window = 30, horizon = 7, countKey = 'orders', now = new Date() } = {}) {
  const dayMap = toDayMap(series, valueKey, countKey);
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  // Lấy `window` ngày gần nhất (kể cả ngày trống = 0) để chuỗi liên tục.
  const days = [];
  for (let i = window - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const hit = dayMap.get(iso(d));
    days.push({ date: iso(d), d: new Date(d), value: hit ? hit.value : 0 });
  }

  // Hồi quy tuyến tính y = a + b·x (x = chỉ số ngày 0..n-1)
  const n = days.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  days.forEach((p, i) => { sx += i; sy += p.value; sxx += i * i; sxy += i * p.value; });
  const denom = n * sxx - sx * sx;
  const b = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const a = (sy - b * sx) / n;
  const predict = (x) => Math.max(0, Math.round(a + b * x));

  const label = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const recent = days.map((p, i) => ({
    date: p.date, label: label(p.d), actual: p.value,
    forecast: i === n - 1 ? p.value : null, // nối tại điểm cuối thực tế
  }));

  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    const d = new Date(today); d.setDate(d.getDate() + h);
    forecast.push({ date: iso(d), label: label(d), actual: null, forecast: predict(n - 1 + h) });
  }

  return { data: [...recent, ...forecast], slope: b, horizon };
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const WEEKDAY_OPTIONS = [
  { value: 'ALL', label: 'Mọi thứ' },
  { value: '1', label: 'Thứ 2' }, { value: '2', label: 'Thứ 3' }, { value: '3', label: 'Thứ 4' },
  { value: '4', label: 'Thứ 5' }, { value: '5', label: 'Thứ 6' }, { value: '6', label: 'Thứ 7' },
  { value: '0', label: 'Chủ nhật' },
];

/** Danh sách năm·tháng có mặt trong chuỗi (mới → cũ) để đổ vào dropdown lọc. */
export function availablePeriods(series) {
  const years = new Set();
  const months = new Set(); // 'yyyy-MM'
  (series || []).forEach((r) => {
    const d = parseDay(r.date);
    if (!d) return;
    years.add(d.getFullYear());
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  return {
    years: [...years].sort((a, b) => b - a),
    months: [...months].sort((a, b) => b.localeCompare(a)),
  };
}

/**
 * LỌC chuỗi theo năm / tháng / thứ trong tuần.
 *   filters = { year:'ALL'|number, month:'ALL'|'yyyy-MM', weekday:'ALL'|'0'..'6' }
 */
export function filterSeries(series, { year = 'ALL', month = 'ALL', weekday = 'ALL' } = {}) {
  return (series || []).filter((r) => {
    const d = parseDay(r.date);
    if (!d) return false;
    if (month !== 'ALL') {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym !== month) return false;
    } else if (year !== 'ALL' && d.getFullYear() !== Number(year)) {
      return false;
    }
    if (weekday !== 'ALL' && d.getDay() !== Number(weekday)) return false;
    return true;
  });
}

export { WEEKDAY_LABELS };
