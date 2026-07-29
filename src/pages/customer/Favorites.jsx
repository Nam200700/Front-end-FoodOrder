import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shuffle, Sparkles, Plus, Utensils, ArrowRight, Store, Star, MapPin, Clock, Compass } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';

export default function Favorites() {
  const navigate = useNavigate();

  // Ánh xạ dữ liệu yêu thích từ Backend sang model hiển thị.
  // CHỈ giữ field THẬT mà API /favorites (RestaurantResponse) trả về: tên, ảnh, điểm đánh giá,
  // số lượt đánh giá, địa chỉ, giờ mở/đóng cửa. Trước đây từng gắn nhãn "loại ẩm thực" nhưng
  // backend KHÔNG có field cuisine → luôn mặc định "Ẩm thực" (số liệu rỗng) nên đã bỏ hẳn.
  const mapFavorites = (data) => {
    const realData = data || [];
    return realData.map(res => ({
      id: res.restaurantId.toString(),
      name: res.restaurantName,
      image: res.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
      rating: typeof res.rating === 'number' ? res.rating : 0,
      reviewsCount: res.reviewsCount ?? 0,
      address: res.address || '',
      opensAt: res.opensAt || null,   // "HH:mm:ss"
      closesAt: res.closesAt || null,
    }));
  };

  // "HH:mm:ss" → "HH:mm" (bỏ giây cho gọn)
  const fmtTime = (t) => (t ? String(t).slice(0, 5) : null);

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
  // Số liệu THẬT suy ra từ danh sách: số quán + điểm đánh giá trung bình (chỉ tính quán ĐÃ có đánh giá)
  const ratedList = list.filter((r) => r.rating > 0);
  const avgRating = ratedList.length
    ? ratedList.reduce((sum, r) => sum + r.rating, 0) / ratedList.length
    : 0;

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
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-md-primary to-[#FF8C42] text-white p-6 md:p-8 mb-8 shadow-shadow-2 animate-rise-in">
        {/* Hoạ tiết line-art mờ ở góc phải + đốm lấp lánh + dao nĩa trôi nhẹ + vệt sáng quét */}
        <Heart className="absolute -right-6 -bottom-6 text-white/10 fill-white/10 animate-float-slow" size={150} strokeWidth={1} />
        <Utensils className="absolute right-40 -bottom-3 text-white/10" size={64} strokeWidth={1.2} />
        <Sparkles className="absolute right-24 top-4 text-white/25 animate-twinkle" size={28} />
        <Sparkles className="absolute right-10 bottom-8 text-white/15 animate-twinkle" size={16} style={{ animationDelay: '800ms' }} />
        <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                <Heart size={11} className="fill-white" /> {list.length} quán đã lưu
              </span>
              {avgRating > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  <Star size={11} className="fill-white" /> {avgRating.toFixed(1)} điểm trung bình
                </span>
              )}
            </div>
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
        <>
          {/* ─── DẢI THỐNG KÊ THẬT (số quán + số loại ẩm thực) — suy ra từ dữ liệu, không bịa ── */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { icon: Store, value: list.length, label: 'Quán đã lưu' },
              { icon: Star, value: avgRating > 0 ? avgRating.toFixed(1) : '—', label: avgRating > 0 ? `Điểm TB · ${ratedList.length} quán` : 'Chưa có đánh giá' },
            ].map((s, i) => (
              <div
                key={s.label}
                style={{ animationDelay: `${i * 80}ms` }}
                className="relative overflow-hidden flex items-center gap-3.5 bg-white rounded-radius-xl border border-md-outline-variant/20 shadow-sm p-4 animate-rise-in"
              >
                <div className="shrink-0 w-11 h-11 rounded-radius-lg bg-md-primary-container/40 text-md-primary flex items-center justify-center">
                  <s.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-extrabold text-md-on-surface leading-none tabular-nums">{s.value}</p>
                  <p className="text-xs font-semibold text-md-on-surface-variant mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Nhãn khu vực bộ sưu tập */}
          <div className="flex items-center gap-2 mb-4">
            <Heart size={16} className="text-md-primary fill-md-primary" />
            <h2 className="text-sm font-extrabold text-md-on-surface uppercase tracking-wide">Quán trong bộ sưu tập</h2>
            <span className="text-xs font-bold text-md-on-surface-variant">· {list.length}</span>
          </div>

          {/* Lưới gallery card EDITORIAL: tên nổi trên ảnh + chip loại món + thanh hành động dưới.
              Thêm 1 card "Khám phá thêm" ở cuối để lấp khoảng trống & dẫn sang Explore. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {list.map((res, i) => (
              <div
                key={res.id}
                onClick={() => navigate(`/restaurants/${res.id}`)}
                style={{ animationDelay: `${i * 70}ms` }}
                className="bg-white rounded-radius-xl border border-md-outline-variant/20 shadow-sm hover:shadow-shadow-2 transition-all cursor-pointer overflow-hidden card-float group animate-rise-in flex flex-col"
              >
                {/* Ảnh quán cao hơn + tên quán ĐẶT TRÊN ẢNH cho cảm giác editorial */}
                <div className="relative h-52 w-full overflow-hidden">
                  <img src={res.image} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  {/* Gradient đậm dần xuống đáy để chữ trắng nổi rõ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                  {/* Badge điểm đánh giá THẬT (chỉ hiện khi quán đã có đánh giá) */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {res.rating > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-white/95 backdrop-blur-sm text-amber-600 px-2 py-1 rounded-full font-extrabold shadow-sm">
                        <Star size={11} className="fill-amber-500 text-amber-500" /> {res.rating.toFixed(1)}
                        <span className="text-slate-400 font-bold">· {res.reviewsCount}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-white/85 backdrop-blur-sm text-slate-500 px-2 py-1 rounded-full font-bold shadow-sm">
                        Chưa có đánh giá
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleRemoveFavorite(res.id, e)}
                    className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-red-500 hover:scale-110 active:scale-95 transition-all shadow-sm"
                    title="Bỏ khỏi yêu thích"
                  >
                    <Heart size={15} className="fill-red-500" />
                  </button>

                  {/* Tên quán trên ảnh */}
                  <h3 className="absolute bottom-3 left-4 right-4 font-extrabold text-lg text-white leading-tight drop-shadow-md line-clamp-2">
                    {res.name}
                  </h3>
                </div>

                {/* Nội dung THẬT: địa chỉ + giờ mở cửa + nút Xem quán */}
                <div className="p-3.5 flex flex-col gap-2.5 mt-auto">
                  {res.address && (
                    <p className="text-xs font-semibold text-md-on-surface-variant flex items-start gap-1.5 leading-snug line-clamp-1">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-md-primary" /> {res.address}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {fmtTime(res.opensAt) && fmtTime(res.closesAt) ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-md-on-surface-variant">
                        <Clock size={12} className="text-md-primary" /> {fmtTime(res.opensAt)}–{fmtTime(res.closesAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-md-on-surface-variant">
                        <Heart size={12} className="fill-red-500 text-red-500" /> Đã lưu
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-md-primary px-3.5 py-2 rounded-radius-full shadow-sm group-hover:gap-2.5 transition-all">
                      Xem quán <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Card "Khám phá thêm" — viền nét đứt, dẫn sang trang Explore. */}
            <button
              type="button"
              onClick={() => navigate('/explore')}
              style={{ animationDelay: `${list.length * 70}ms` }}
              className="rounded-radius-xl border-2 border-dashed border-md-primary/30 bg-md-primary/5 hover:bg-md-primary/10 hover:border-md-primary/50 transition-all flex flex-col items-center justify-center gap-3 p-6 min-h-[300px] cursor-pointer group animate-rise-in"
            >
              <span className="p-4 bg-white rounded-radius-full shadow-sm text-md-primary group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300">
                <Plus size={26} />
              </span>
              <span className="text-sm font-extrabold text-md-primary">Khám phá thêm quán</span>
              <span className="text-xs text-md-on-surface-variant font-semibold text-center max-w-[180px]">
                Thả tim quán mới để thêm vào bộ sưu tập của bạn
              </span>
            </button>
          </div>

          {/* ─── BANNER CTA CUỐI TRANG (lấp khoảng trống, dẫn tiếp hành trình khám phá) ── */}
          <div className="mt-8 relative overflow-hidden rounded-radius-xl border border-md-primary/20 bg-md-primary-container/20 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-rise-in">
            <Compass className="absolute -right-4 -bottom-5 text-md-primary/10" size={110} strokeWidth={1.2} />
            <div className="relative min-w-0">
              <h3 className="text-base font-extrabold text-md-on-surface flex items-center gap-2">
                <Sparkles size={16} className="text-md-primary" /> Khám phá thêm hương vị mới
              </h3>
              <p className="text-sm font-semibold text-md-on-surface-variant mt-1 leading-relaxed">
                Còn rất nhiều quán ngon đang chờ bạn thả tim và thêm vào bộ sưu tập.
              </p>
            </div>
            <button
              onClick={() => navigate('/explore')}
              className="relative shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-radius-full text-sm font-extrabold bg-md-primary text-white shadow-shadow-2 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Compass size={16} /> Khám phá ngay
            </button>
          </div>
        </>
      )}

    </div>
  );
}
