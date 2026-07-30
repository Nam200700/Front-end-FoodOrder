/**
 * Format number to Vietnamese Dong currency format (e.g. 45000 -> 45.000đ)
 * @param {number} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || amount === '') return '0đ';
  // VND KHÔNG có đơn vị lẻ (xu) → luôn làm tròn về số nguyên đồng, tránh hiện "2.782.222,22đ".
  // Chấp nhận cả số lẫn chuỗi (BigDecimal serialize) → ép Number trước khi làm tròn.
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0đ';
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
};

/**
 * Format string or date to time string (e.g. "2026-05-28T14:16:33" -> "14:16")
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export const formatTime = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format full date and time
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const removeVietnameseTones = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export const normalizeForMatch = (str) => {
  if (!str) return '';
  return removeVietnameseTones(str)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .trim();
};
