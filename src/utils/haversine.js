/**
 * Tính khoảng cách đường chim bay giữa hai toạ độ GPS bằng thuật toán Haversine.
 * Hoàn toàn miễn phí và chính xác cho khoảng cách địa lý ngắn/trung bình.
 * 
 * @param {number} lat1 Vĩ độ điểm 1
 * @param {number} lon1 Kinh độ điểm 1
 * @param {number} lat2 Vĩ độ điểm 2
 * @param {number} lon2 Kinh độ điểm 2
 * @returns {number} Khoảng cách tính bằng Kilomet (km), đã làm tròn 1 chữ số thập phân
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const toRadians = (degree) => (degree * Math.PI) / 180;
  
  const R = 6371; // Bán kính Trái Đất tính bằng km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Number(distance.toFixed(1)); // Trả về dạng số làm tròn 1 chữ số thập phân
}
