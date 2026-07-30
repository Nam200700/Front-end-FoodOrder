/**
 * Gom chuỗi thời gian theo NGÀY thành TUẦN/THÁNG khi dữ liệu quá dày để biểu đồ
 * "giãn ra", dễ nhìn xu hướng (chuẩn dashboard analytics: ít điểm nhưng rõ, không răng cưa).
 *
 * Mỗi phần tử đầu vào cần 1 trường ngày dạng 'yyyy-MM-dd' (hoặc parse được bởi Date).
 * Mọi trường SỐ sẽ được CỘNG DỒN trong bucket (GTV/doanh thu/đơn... đều là tổng → cộng đúng).
 */

/** Tự chọn mức gom theo số điểm ngày: ≤45 giữ ngày · ≤400 gom tuần · còn lại gom tháng. */
export function pickGranularity(count) {
  if (count <= 45) return 'day';
  if (count <= 400) return 'week';
  return 'month';
}

const GRAN_CAPTION = { day: '', week: 'Gom theo tuần cho dễ nhìn', month: 'Gom theo tháng cho dễ nhìn' };
export const granularityCaption = (g) => GRAN_CAPTION[g] || '';

/** Mốc bắt đầu bucket: tuần → thứ 2 đầu tuần; tháng → ngày 1; ngày → chính nó. */
function bucketStart(dt, gran) {
  if (gran === 'week') {
    const dow = (dt.getDay() + 6) % 7; // Mon = 0
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow);
  }
  if (gran === 'month') return new Date(dt.getFullYear(), dt.getMonth(), 1);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Gom mảng theo granularity. Trả về mảng bucket đã sort tăng dần, mỗi bucket cộng dồn
 * các trường số + gắn thêm `__start` (Date đầu bucket) để tạo nhãn.
 */
export function aggregateDaily(rows, dateKey, granularity) {
  if (!Array.isArray(rows) || rows.length === 0 || granularity === 'day') return rows;
  const map = new Map();
  const out = [];
  for (const r of rows) {
    const dt = new Date(r[dateKey]);
    if (isNaN(dt.getTime())) continue;
    const start = bucketStart(dt, granularity);
    const key = start.getTime();
    let b = map.get(key);
    if (!b) { b = { __start: start }; map.set(key, b); out.push(b); }
    for (const [k, v] of Object.entries(r)) {
      if (k === dateKey) continue;
      const num = typeof v === 'number' ? v : (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
      if (num !== null) b[k] = (b[k] || 0) + num;
    }
  }
  out.sort((a, b) => a.__start - b.__start);
  return out;
}

/**
 * Nhãn trục X cho 1 bucket: tháng → 'MM/yyyy'; ngày/tuần → 'dd/MM' (hoặc 'dd/MM/yyyy' khi withYear).
 * withYear dùng cho dashboard (yêu cầu hiện đủ ngày·tháng·năm); trang Thống kê để gọn 'dd/MM'.
 */
export function bucketLabel(row, granularity, dateKey = 'date', withYear = false) {
  const d = row.__start instanceof Date ? row.__start : new Date(row[dateKey]);
  if (isNaN(d.getTime())) return row[dateKey] || '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${mm}/${d.getFullYear()}`;
  return withYear ? `${dd}/${mm}/${d.getFullYear()}` : `${dd}/${mm}`;
}
