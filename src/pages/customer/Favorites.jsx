import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shuffle, Sparkles, Plus, Utensils, ArrowRight } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';

export default function Favorites() {
  const navigate = useNavigate();

  // Ánh xạ dữ liệu yêu thích từ Backend sang model hiển thị.
  // CHỈ giữ field THẬT mà API /favorites trả về (tên, ảnh, loại món). Trước đây có
  // gắn rating/time/distance/shipping/avgPrice cứng giống hệt nhau cho mọi quán
  // (dữ liệu giả) → đã bỏ để không hiển thị thông tin sai.
  const mapFavorites = (data) => {
    const realData = data || [];
    return realData.map(res => ({
      id: res.restaurantId.toString(),
      name: res.restaurantName,
      image: res.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
      tags: [res.cuisineType || 'Ẩm thực'],
    }));
  };

  const { data: favorites, loading, error, refetch } = useFetchData('/favorites', {
    mapFn: mapFavorites,
  });

  // Gỡ một quán khỏi danh sách yêu thích (GIỮ NGUYÊN logic cũ).
  const handleRemoveFavorite = async (resId, e) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/favorites/${resId}`);
      refetch();
    } catch (err) {
      console.error('Lỗi khi xóa khỏi yêu thích:', err);
    }
  };

  const list = favorites || [];

  // "Thèm gì hôm nay?" → mở ngẫu nhiên một quán trong bộ sưu tập (cú hích đặt món
  // khi đang phân vân). Thuần trình bày, không gọi API.
  const handleRandomPick = () => {
    if (list.length === 0) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    navigate(`/restaurants/${pick.id}`);
  };

  return (
    <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full font-google-sans pb-24">
      {/* ─── HERO BANNER "Bộ sưu tập ẩm thực" (gradient cam, đồng bộ thẻ thành viên) ──
          Trang trí đầu trang: tiêu đề + mô tả + số quán + nút chọn ngẫu nhiên.
          Hoạ tiết trái tim mờ ở góc tạo điểm nhấn, tránh đơn điệu. */}
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-md-primary to-[#FF8C42] text-white p-6 md:p-8 mb-8 shadow-shadow-2">
        {/* Hoạ tiết line-art mờ ở góc phải */}
        <Heart className="absolute -right-6 -bottom-6 text-white/10 fill-white/10" size={150} strokeWidth={1} />
        <Sparkles className="absolute right-24 top-4 text-white/15" size={28} />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
              <Heart size={11} className="fill-white" /> {list.length} quán đã lưu
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight">
              Bộ sưu tập ẩm thực
            </h1>
            <p className="text-sm text-white/85 font-semibold mt-1.5 max-w-md leading-relaxed">
              Những quán bạn đã thả tim — chạm để đặt lại món yêu thích bất cứ lúc nào.
            </p>
          </div>

          {/* Nút gợi ý ngẫu nhiên (chỉ hiện khi có quán) */}
          {list.length > 0 && (
            <button
              onClick={handleRandomPick}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-radius-full text-sm font-extrabold bg-white text-md-primary shadow-shadow-2 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Shuffle size={16} />
              Thèm gì hôm nay?
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Không thể tải danh sách yêu thích"
          message={error.response?.data?.message || error.message || "Đã xảy ra sự cố kết nối máy chủ."}
          onRetry={refetch}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <SkeletonRestaurantCard />
          <SkeletonRestaurantCard />
          <SkeletonRestaurantCard />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="Chưa có quán ăn yêu thích nào"
          message="Hãy nhấn thả tim các quán ăn bạn yêu thích ở trang chủ hoặc chi tiết quán nhé!"
          icon={Heart}
          actionText="Khám phá ngay"
          onAction={() => navigate('/explore')}
        />
      ) : (
        // Lưới gallery: card DỌC (ảnh trên, nội dung dưới), 2–3 cột theo màn.
        // Thêm 1 card "Khám phá thêm" ở cuối để lấp khoảng trống & dẫn sang Explore.
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.map((res) => (
            <div
              key={res.id}
              onClick={() => navigate(`/restaurants/${res.id}`)}
              className="bg-white rounded-radius-xl border border-md-outline-variant/20 shadow-sm hover:shadow-shadow-2 transition-all cursor-pointer overflow-hidden card-float group"
            >
              {/* Ảnh quán + nút bỏ yêu thích + tag nổi + lớp gradient cho dễ đọc */}
              <div className="relative h-44 w-full overflow-hidden">
                <img src={res.image} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {/* Lớp phủ gradient nhẹ đáy ảnh tăng chiều sâu */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <button
                  onClick={(e) => handleRemoveFavorite(res.id, e)}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-red-500 hover:scale-110 active:scale-95 transition-all shadow-sm"
                  title="Bỏ khỏi yêu thích"
                >
                  <Heart size={15} className="fill-red-500" />
                </button>
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  {res.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] bg-black/65 text-white px-2 py-0.5 rounded font-extrabold backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Nội dung card — chỉ thông tin THẬT: tên quán + loại món + nút Xem */}
              <div className="p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-md-on-surface truncate group-hover:text-md-primary transition-colors">{res.name}</h3>
                  <p className="text-xs text-md-on-surface-variant font-semibold mt-1 flex items-center gap-1 truncate">
                    <Utensils size={12} className="shrink-0" /> {res.tags[0]}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-extrabold text-md-primary group-hover:translate-x-0.5 transition-transform">
                  Xem <ArrowRight size={14} />
                </span>
              </div>
            </div>
          ))}

          {/* Card "Khám phá thêm" — viền nét đứt, dẫn sang trang Explore.
              Vừa trang trí vừa gợi ý người dùng thêm quán mới vào bộ sưu tập. */}
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="rounded-radius-xl border-2 border-dashed border-md-primary/30 bg-md-primary/5 hover:bg-md-primary/10 hover:border-md-primary/50 transition-all flex flex-col items-center justify-center gap-3 p-6 min-h-[260px] cursor-pointer group"
          >
            <span className="p-4 bg-white rounded-radius-full shadow-sm text-md-primary group-hover:scale-110 transition-transform">
              <Plus size={26} />
            </span>
            <span className="text-sm font-extrabold text-md-primary">Khám phá thêm quán</span>
            <span className="text-xs text-md-on-surface-variant font-semibold text-center max-w-[180px]">
              Thả tim quán mới để thêm vào bộ sưu tập của bạn
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
