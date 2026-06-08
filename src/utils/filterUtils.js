/**
 * Lọc danh sách các phần tử (Orders/Stats) theo khoảng thời gian được chọn.
 *
 * @param {Array} items - Danh sách các đối tượng cần lọc (mỗi đối tượng cần có trường thời gian)
 * @param {'7days'|'30days'|'thisMonth'|'all'} range - Khoảng thời gian lọc
 * @param {string} dateField - Tên trường ngày giờ trong đối tượng (mặc định: 'createdAt')
 * @returns {Array} Danh sách sau khi lọc
 */
export const filterByDateRange = (items, range, dateField = 'createdAt') => {
  if (!items || items.length === 0) return [];
  if (range === 'all' || !range) return items;

  const now = new Date();

  return items.filter((item) => {
    const timeValue = item[dateField];
    if (!timeValue) return false;

    const orderDate = new Date(timeValue);

    if (range === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return orderDate >= sevenDaysAgo;
    }

    if (range === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return orderDate >= thirtyDaysAgo;
    }

    if (range === 'thisMonth') {
      return (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });
};
