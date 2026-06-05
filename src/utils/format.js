/**
 * Format number to Vietnamese Dong currency format (e.g. 45000 -> 45.000đ)
 * @param {number} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '0đ';
  return amount.toLocaleString('vi-VN') + 'đ';
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
