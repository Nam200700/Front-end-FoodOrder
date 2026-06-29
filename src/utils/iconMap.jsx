// ──────────────────────────────────────────────────────────────────────────
// iconMap.jsx
// Bản đồ ánh xạ EMOJI (UI cũ) -> ICON lucide-react, dùng chung toàn dự án để
// loại bỏ emoji mà vẫn giữ đúng ý nghĩa hiển thị.
//
// LƯU Ý: đây thuần tuý là lớp TRÌNH BÀY (presentation), KHÔNG chứa logic.
// Các component chỉ việc import map/helper ở đây rồi render <Icon /> thay cho
// ký tự emoji trước kia. Không thay đổi luồng dữ liệu hay xử lý nghiệp vụ.
// ──────────────────────────────────────────────────────────────────────────
import {
  Utensils,      // 🍽️  - món ăn nói chung / "Tất cả"
  Soup,          // 🍜  - cơm/phở/món nước
  Pizza,         // 🍕  - pizza
  Fish,          // 🍣  - sushi
  Salad,         // 🥗  - salad
  CupSoda,       // 🧋  - trà sữa / đồ uống
  MapPin,        // 📍  - vị trí / khoảng cách
  Flame,         // 🔥  - hot / bán chạy
  Star,          // ⭐  - đánh giá
  BadgeDollarSign, // 💸 - phí ship / giá
  RotateCcw,     // 🔄  - đặt lại / làm mới
  Sparkles,      // ✨  - gợi ý dành riêng
  Heart,         // ❤️  - yêu thích
} from 'lucide-react';

// Icon cho từng DANH MỤC ẩm thực ở trang Home (thay cho emoji trong CATEGORIES)
// Key trùng với `id` của từng category để tra cứu nhanh.
export const CATEGORY_ICON = {
  all: Utensils,
  com: Soup,
  pizza: Pizza,
  sushi: Fish,
  salad: Salad,
  drink: CupSoda,
};

// Lấy component icon theo id danh mục; mặc định Utensils nếu không khớp.
export function getCategoryIcon(id) {
  return CATEGORY_ICON[id] || Utensils;
}

// Map dùng chung cho các icon hay gặp (tham chiếu nhanh khi refactor emoji).
export const UI_ICON = {
  location: MapPin,
  hot: Flame,
  rating: Star,
  ship: BadgeDollarSign,
  reorder: RotateCcw,
  forYou: Sparkles,
  favorite: Heart,
  food: Utensils,
};
