/**
 * RoleScenes — minh hoạ SVG NHIỀU BỘ PHẬN, chuyển động "từng khung hình" (step-end/steps)
 * cho 3 vai trò của MealDash. Dùng chung ở thẻ chọn vai trò (Register bước 1) và sơ đồ
 * "Nền tảng 3 trong 1". Tất cả nét dùng `currentColor` → tự ăn theo màu role (trắng khi
 * chưa chọn, màu role khi chọn). Mọi animation đã có guard `prefers-reduced-motion` ở index.css.
 *
 * @param {number} size  cạnh vuông (px)
 * @param {boolean} play  bật animation (thường chỉ bật khi đang chọn/nổi bật để đỡ rối)
 */

const spin = { transformBox: 'fill-box', transformOrigin: 'center' };

// ─── KHÁCH HÀNG: người vẫy chào + tô món bốc khói ("đặt món, món đang tới") ───
export function CustomerScene({ size = 26, play = true, className = '', style }) {
  const A = play ? 'animate-fr-wave' : '';
  const S = play ? 'animate-fr-steam' : '';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {/* Đầu + thân + chân (tĩnh) */}
      <circle cx="12" cy="7.5" r="3" />
      <path d="M12 10.8 V19 M12 19 L9 26 M12 19 L15 26" />
      {/* Tay phải buông xuống */}
      <path d="M12 13.5 L8.5 17.5" strokeWidth="1.9" />
      {/* Tay trái GIƠ VẪY CHÀO — xoay quanh vai (khung hình) */}
      <g className={A} style={{ transformBox: 'fill-box', transformOrigin: 'left bottom' }}>
        <path d="M12 13.2 L16.8 9" strokeWidth="1.9" />
      </g>
      {/* Tô món */}
      <path d="M19.5 23 Q24 28.5 28.5 23" fill="rgba(255,255,255,0.16)" />
      <path d="M18.8 23 H29.2" />
      {/* Khói bốc lên theo nấc — 2 sợi lệch pha */}
      <g className={S} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
        <path d="M22.5 21.5 q1.4 -1.6 0 -3.2" strokeWidth="1.5" />
      </g>
      <g className={S} style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: '0.7s' }}>
        <path d="M25.5 21.5 q1.4 -1.6 0 -3.2" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// ─── QUÁN ĂN: cửa hàng có mái hiên phập phồng + khói bếp + biển OPEN nhấp nháy ───
export function OwnerScene({ size = 26, play = true, className = '', style }) {
  const AW = play ? 'animate-fr-awning' : '';
  const S = play ? 'animate-fr-steam' : '';
  const BL = play ? 'animate-fr-blink' : '';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {/* Khói bếp bay lên từ ống khói (sau mái) — 2 sợi lệch pha */}
      <g className={S} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
        <path d="M21 9 q1.4 -1.8 0 -3.6" strokeWidth="1.5" />
      </g>
      <g className={S} style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: '0.7s' }}>
        <path d="M23.6 9 q1.4 -1.8 0 -3.6" strokeWidth="1.5" />
      </g>
      {/* Thân quán + cửa */}
      <path d="M7 14 V26 H25 V14" />
      <path d="M14 26 V20 H18 V26" />
      {/* Mái hiên phập phồng — co giãn từ đỉnh (khung hình) */}
      <g className={AW} style={{ transformBox: 'fill-box', transformOrigin: 'top' }}>
        <path d="M5.5 14 L7.5 10.5 H24.5 L26.5 14 Z" fill="rgba(255,255,255,0.16)" />
        <path d="M11 10.7 L10 14 M16 10.5 L16 14 M21 10.7 L22 14" strokeWidth="1.3" />
      </g>
      {/* Biển OPEN nhấp nháy */}
      <circle cx="10.5" cy="17.5" r="1.3" className={BL} fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── TÀI XẾ: đạp xe tại chỗ — bánh & bàn đạp quay theo nấc, thân nhún, có hộp giao hàng ───
export function ShipperScene({ size = 26, play = true, className = '', style }) {
  const P = play ? 'animate-fr-pedal' : '';
  const B = play ? 'animate-fr-bob' : '';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {/* Hộp giao hàng sau yên */}
      <rect x="3.5" y="12.5" width="6" height="5.5" rx="1" fill="rgba(255,255,255,0.16)" />
      {/* Khung xe */}
      <path d="M9 24 L16 24 L13 16 Z M16 24 L23 15 M13 16 L23 15 M21 15 H24" strokeWidth="1.8" />
      {/* Người đạp — nhún theo nhịp (khung hình) */}
      <g className={B} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
        <path d="M13 16 L18 9 M18 9 L23 15" strokeWidth="1.7" />
        <circle cx="19.5" cy="6.5" r="2.6" />
      </g>
      {/* Bàn đạp quay 6 nấc */}
      <g className={P} style={spin}>
        <path d="M14.4 24 H17.6 M16 22.4 V25.6" strokeWidth="1.5" />
      </g>
      {/* Bánh sau: vành tĩnh + nan hoa quay */}
      <circle cx="9" cy="24" r="4.6" />
      <g className={P} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path d="M9 19.4 V28.6 M4.4 24 H13.6 M5.7 20.7 L12.3 27.3 M12.3 20.7 L5.7 27.3" strokeWidth="1.1" />
      </g>
      {/* Bánh trước */}
      <circle cx="23" cy="24" r="4.6" />
      <g className={P} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path d="M23 19.4 V28.6 M18.4 24 H27.6 M19.7 20.7 L26.3 27.3 M26.3 20.7 L19.7 27.3" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

// Tra cứu theo id vai trò để dùng linh hoạt.
export const ROLE_SCENE = {
  CUSTOMER: CustomerScene,
  OWNER: OwnerScene,
  SHIPPER: ShipperScene,
};
