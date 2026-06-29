import React, { useState } from 'react';
import { Reply, ClipboardList, Star, Store } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { toast } from 'react-toastify';

export default function MerchantReviews() {
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Bộ lọc theo số sao: 'all' hoặc '5'..'1' (chỉ lọc hiển thị, không gọi API).
  const [starFilter, setStarFilter] = useState('all');

  const { data: restaurant, loading: loadingRestaurant, error: errorRestaurant, refetch: refetchRestaurant } = useFetchData('/merchant/restaurant');
  const restaurantId = restaurant?.restaurantId || restaurant?.id;

  const mapReviews = (data) => {
    const realData = data?.content || [];
    return realData.map(rev => ({
      id: rev.reviewId.toString(),
      author: rev.customerName || 'Khách hàng',
      rating: rev.restaurantRating || 5,
      date: new Date(rev.createdAt).toLocaleDateString('vi-VN') + ' ' + new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      comment: rev.restaurantComment || '',
      reply: rev.merchantReply
    }));
  };

  const { data: reviews, loading: loadingReviews, error: errorReviews, refetch } = useFetchData(
    restaurantId ? `/restaurants/${restaurantId}/reviews` : null,
    {
      mapFn: mapReviews,
      deps: [restaurantId],
    }
  );

  const handleSendReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/merchant/reviews/${reviewId}/reply`, { reply: replyText });
      toast.success('Đã gửi phản hồi đánh giá thành công!');
      setReplyText('');
      setActiveReplyId(null);
      refetch();
    } catch (err) {
      console.error('Lỗi phản hồi:', err);
      toast.error('Không thể gửi phản hồi lúc này!');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingRestaurant || loadingReviews || submitting;
  const reviewsList = reviews || [];

  // Tổng quan đánh giá (THUẦN hiển thị, không gọi API): điểm trung bình + phân bố
  // sao 5→1 tính từ danh sách review đã có.
  const totalReviews = reviewsList.length;
  const avgRating = totalReviews ? reviewsList.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews : 0;
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviewsList.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, pct: totalReviews ? (count / totalReviews) * 100 : 0 };
  });

  // Danh sách review sau khi áp bộ lọc sao.
  const filteredReviews = starFilter === 'all'
    ? reviewsList
    : reviewsList.filter((r) => Math.round(r.rating) === Number(starFilter));

  if (errorRestaurant) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Lỗi tải dữ liệu</h2>
        <p className="text-sm text-md-on-surface-variant mt-2">Không thể tải thông tin nhà hàng. Vui lòng thử lại.</p>
        <button
          onClick={() => refetchRestaurant()}
          className="mt-4 bg-md-secondary text-white px-5 py-2.5 rounded-full font-bold text-sm"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!restaurantId && !loadingRestaurant) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để quản lý đánh giá.</p>
      </div>
    );
  }

  if (errorReviews) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Lỗi tải đánh giá</h2>
        <p className="text-sm text-md-on-surface-variant mt-2">Không thể tải danh sách đánh giá. Vui lòng thử lại.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 bg-md-secondary text-white px-5 py-2.5 rounded-full font-bold text-sm"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full font-google-sans space-y-6 pb-24">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Star size={22} className="text-amber-400 fill-amber-400" />
        Quản lý Đánh giá
      </h1>

      {/* ─── TỔNG QUAN: điểm trung bình + phân bố sao (chỉ hiện khi có đánh giá) ─── */}
      {reviewsList.length > 0 && (
        <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm flex flex-col sm:flex-row gap-5 sm:gap-6 items-center">
          {/* Điểm trung bình */}
          <div className="flex flex-col items-center justify-center shrink-0 sm:border-r sm:border-slate-100 sm:pr-6">
            <span className="text-4xl font-black text-slate-800 leading-none">{avgRating.toFixed(1)}</span>
            <div className="mt-1.5">
              <StarRating rating={Math.round(avgRating)} size={14} />
            </div>
            <span className="text-[10px] text-slate-400 font-bold mt-1.5">{totalReviews} đánh giá</span>
          </div>
          {/* Phân bố sao 5→1 — mỗi hàng BẤM ĐƯỢC để lọc theo mức sao tương ứng */}
          <div className="flex-1 w-full space-y-1.5">
            {ratingDist.map(({ star, count, pct }) => {
              const isActive = starFilter === String(star);
              return (
                <button
                  key={star}
                  onClick={() => setStarFilter(isActive ? 'all' : String(star))}
                  className={`w-full flex items-center gap-2 text-[11px] font-bold rounded-radius-md px-1.5 py-0.5 transition-all ${
                    isActive ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-slate-50'
                  }`}
                  title={`Lọc đánh giá ${star} sao`}
                >
                  <span className="flex items-center gap-0.5 text-slate-500 w-7 shrink-0">
                    {star}<Star size={10} className="fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-400 w-6 text-right shrink-0">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── CHIP LỌC THEO SỐ SAO (Tất cả + 5★→1★) ──────────────────────────────── */}
      {reviewsList.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setStarFilter('all')}
            className={`px-3.5 py-1.5 rounded-radius-full text-xs font-bold transition-all cursor-pointer border ${
              starFilter === 'all'
                ? 'bg-md-secondary text-white border-md-secondary shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả ({totalReviews})
          </button>
          {ratingDist.map(({ star, count }) => {
            const isActive = starFilter === String(star);
            return (
              <button
                key={star}
                onClick={() => setStarFilter(String(star))}
                className={`px-3 py-1.5 rounded-radius-full text-xs font-bold transition-all cursor-pointer border inline-flex items-center gap-1 ${
                  isActive
                    ? 'bg-md-secondary text-white border-md-secondary shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {star}<Star size={11} className={isActive ? 'fill-white text-white' : 'fill-amber-400 text-amber-400'} />
                <span className={isActive ? 'text-white/80' : 'text-slate-400'}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && reviewsList.length === 0 ? (
        <Spinner />
      ) : reviewsList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-md-on-surface-variant">Chưa có đánh giá nào cho nhà hàng của bạn</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        // Có đánh giá nhưng không khớp bộ lọc sao đang chọn
        <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-md-on-surface-variant">Không có đánh giá {starFilter} sao nào</p>
          <button onClick={() => setStarFilter('all')} className="mt-3 text-xs font-extrabold text-md-secondary hover:underline">
            Xem tất cả đánh giá
          </button>
        </div>
      ) : (
        // Lưới 2 cột trên màn rộng (lg) cho đỡ trống; items-start để card cao tự nhiên.
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {filteredReviews.map((rev) => (
            <div key={rev.id} className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800">{rev.author}</h3>
                  <span className="text-[10px] text-slate-400 mt-1 block font-bold">{rev.date}</span>
                </div>
                <StarRating rating={rev.rating} size={13} />
              </div>

              <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-slate-50/50 p-3.5 rounded-radius-lg border border-slate-100/50">
                {rev.comment}
              </p>

              {/* Replied block */}
              {rev.reply ? (
                <div className="bg-md-secondary-container/10 p-3.5 rounded-radius-lg border border-md-secondary/10 ml-4 text-xs font-semibold">
                  <span className="font-extrabold text-md-secondary flex items-center gap-1 mb-1">
                    <Store size={12} /> Phản hồi từ quán:
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {rev.reply}
                  </p>
                </div>
              ) : (
                <div className="flex justify-end pt-1">
                  {activeReplyId === rev.id ? (
                    <div className="w-full flex gap-2 ml-4">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Nhập phản hồi cho khách..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-radius-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-md-secondary"
                      />
                      <button
                        onClick={() => handleSendReply(rev.id)}
                        className="px-4 py-2 bg-md-secondary text-white font-bold text-xs rounded-radius-lg flex items-center gap-1 shadow-sm"
                      >
                        Gửi
                      </button>
                      <button
                        onClick={() => setActiveReplyId(null)}
                        className="px-3 py-2 bg-slate-100 text-slate-500 text-xs rounded-radius-lg"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveReplyId(rev.id);
                        setReplyText('');
                      }}
                      className="text-xs font-bold text-md-secondary hover:underline flex items-center gap-1"
                    >
                      <Reply size={13} className="rotate-180" />
                      Phản hồi khách hàng
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
