import L from 'leaflet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';

// Cầu nối maplibre-gl-leaflet cần maplibregl ở phạm vi global
if (typeof window !== 'undefined' && !window.maplibregl) {
  window.maplibregl = maplibregl;
}

// Maptiles key của Goong (đăng ký miễn phí tại goong.io → dán vào .env: VITE_GOONG_MAPTILES_KEY)
const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY || '';

// ─── CHỦ QUYỀN BIỂN ĐẢO VIỆT NAM ──────────────────────────────────────────────
// Bản đồ nền OpenStreetMap + dịch vụ địa chỉ Nominatim gán Hoàng Sa/Trường Sa theo cách
// gọi của Trung Quốc ("Tây Sa/Tam Sa/Trung Quốc"). Module này (1) vẽ nhãn + chấm đảo khẳng
// định của Việt Nam, và (2) GHI ĐÈ địa chỉ trả về thành tên Việt Nam khi toạ độ nằm trong
// hai quần đảo. Dùng chung cho MỌI bản đồ trong app.

// Điểm đại diện để đặt nhãn + chấm đảo
const VN_ISLANDS = [
  { lat: 16.50, lng: 112.00, name: 'Quần đảo Hoàng Sa' },
  { lat: 9.55, lng: 113.20, name: 'Quần đảo Trường Sa' },
];

// Khung toạ độ (bao) của mỗi quần đảo để nhận biết và ghi đè địa chỉ về đúng chủ quyền VN.
// Hoàng Sa: đơn vị hành chính thuộc TP. Đà Nẵng. Trường Sa: thuộc tỉnh Khánh Hòa.
const HOANG_SA_BBOX = { minLat: 15.6, maxLat: 17.3, minLng: 110.8, maxLng: 113.2, addr: 'Quần đảo Hoàng Sa, TP. Đà Nẵng, Việt Nam' };
const TRUONG_SA_BBOX = { minLat: 7.3, maxLat: 12.2, minLng: 111.3, maxLng: 115.8, addr: 'Quần đảo Trường Sa, tỉnh Khánh Hòa, Việt Nam' };

const inBox = (lat, lng, b) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;

/**
 * Nếu toạ độ nằm trong Hoàng Sa/Trường Sa → trả về địa chỉ chủ quyền Việt Nam (ghi đè kết
 * quả Nominatim vốn ghi "Trung Quốc"). Ngược lại trả về null (dùng địa chỉ gốc).
 */
export function vnSovereigntyAddress(lat, lng) {
  if (inBox(lat, lng, HOANG_SA_BBOX)) return HOANG_SA_BBOX.addr;
  if (inBox(lat, lng, TRUONG_SA_BBOX)) return TRUONG_SA_BBOX.addr;
  return null;
}

/**
 * Gắn chấm đảo + nhãn khẳng định chủ quyền Hoàng Sa & Trường Sa lên bản đồ Leaflet.
 * @param {L.Map} map
 */
export function addVietnamSovereigntyLabels(map) {
  if (!map) return;
  VN_ISLANDS.forEach(({ lat, lng, name }) => {
    // Chấm đảo (đỏ cờ) để "hiện đảo" rõ trên nền biển
    L.circleMarker([lat, lng], {
      radius: 5,
      color: '#ffffff',
      weight: 2,
      fillColor: '#DA251D',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    // Nhãn tên đảo + (Việt Nam), đặt ngay trên chấm đảo
    const icon = L.divIcon({
      className: 'vn-island-label',
      iconSize: [0, 0],
      html:
        `<div style="transform:translate(-50%,-165%);white-space:nowrap;` +
        `background:#DA251D;color:#fff;font-weight:800;font-size:11px;line-height:1.2;` +
        `padding:3px 9px;border-radius:9999px;box-shadow:0 1px 5px rgba(0,0,0,.35);` +
        `border:1px solid rgba(255,255,255,.55);font-family:'Google Sans',system-ui,sans-serif;">` +
        `${name} (Việt Nam)</div>`,
    });
    L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(map);
  });
}

/**
 * Thêm LỚP NỀN bản đồ chuẩn chủ quyền Việt Nam cho một bản đồ Leaflet.
 * - Có VITE_GOONG_MAPTILES_KEY → dùng Goong Maps (nền tiếng Việt, thể hiện đúng Hoàng Sa/Trường Sa,
 *   không có đường lưỡi bò). Goong đã ghi tên đảo sẵn nên KHÔNG cần dán nhãn đỏ.
 * - Chưa có key → fallback CARTO (miễn phí, không key) + tự dán nhãn đỏ + chấm đảo khẳng định.
 * Dùng chung cho MỌI bản đồ — thay cho việc tự gọi L.tileLayer.
 * @param {L.Map} map
 */
export function addVietnamBaseMap(map) {
  if (!map) return;
  const usingGoong = !!GOONG_MAPTILES_KEY && typeof L.maplibreGL === 'function';

  if (usingGoong) {
    // Nền Goong (vector) nhúng vào Leaflet qua maplibre-gl-leaflet
    L.maplibreGL({
      style: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}`,
    }).addTo(map);
    // Goong đã hiển thị đúng chủ quyền → không cần nhãn đỏ đè lên.
  } else {
    // Fallback miễn phí, không cần key
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    addVietnamSovereigntyLabels(map);
  }
}
