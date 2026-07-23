import React, { useState } from 'react';
import { Reply, ClipboardList, Star, Store, Send, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { toast } from 'react-toastify';
import Card from '../../components/common/Card'; 
import Button from '../../components/common/Button'; 

export default function MerchantReviews() {
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starFilter, setStarFilter] = useState('all');

  // State quản lý phóng to ảnh trong tab hiện tại 
  const [selectedImage, setSelectedImage] = useState(null);

  // Khai báo state phân trang 
  const [page, setPage] = useState(0);
  const size = 10; 

  const { data: restaurant, loading: loadingRestaurant, error: errorRestaurant, refetch: refetchRestaurant } = useFetchData('/merchant/restaurant');
  const restaurantId = restaurant?.restaurantId || restaurant?.id;

  const [pageData, setPageData] = useState({ content: [], totalPages: 0, totalElements: 0 });

  const mapReviews = (data) => {
    setPageData(data || { content: [], totalPages: 0, totalElements: 0 });
    
    const realData = data?.content || [];
    return realData.map(rev => ({
      id: rev.reviewId.toString(),
      author: rev.customerName || 'Khách hàng',
      rating: rev.restaurantRating || 5,
      date: new Date(rev.createdAt).toLocaleDateString('vi-VN') + ' ' + new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      comment: rev.restaurantComment || '',
      reply: rev.merchantReply,
      images: rev.images || []
    }));
  };

  const { data: reviews, loading: loadingReviews, error: errorReviews, refetch } = useFetchData(
    restaurantId ? `/restaurants/${restaurantId}/reviews?page=${page}&size=${size}` : null,
    {
      mapFn: mapReviews,
      deps: [restaurantId, page],
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
      toast.error('Không thể gửi phản hồi! Vui lòng kiểm tra lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingRestaurant || loadingReviews || submitting;
  const reviewsList = reviews || [];

  const totalReviews = pageData.totalElements;
  const totalPages = pageData.totalPages || 0;
  
  const avgRating = totalReviews ? reviewsList.reduce((s, r) => s + (r.rating || 0), 0) / reviewsList.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviewsList.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, pct: reviewsList.length ? (count / reviewsList.length) * 100 : 0 };
  });

  const filteredReviews = starFilter === 'all'
    ? reviewsList
    : reviewsList.filter((r) => Math.round(r.rating) === Number(starFilter));

  if (errorRestaurant) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Lỗi tải dữ liệu</h2>
        <p className="text-sm text-md-on-surface-variant mt-2">Không thể tải thông tin nhà hàng. Vui lòng thử lại.</p>
        <Button onClick={() => refetchRestaurant()} variant="secondary" size="md" className="mt-4">
          Thử lại
        </Button>
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
        <Button onClick={() => refetch()} variant="secondary" size="md" className="mt-4">
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 w-full font-google-sans space-y-6 pb-24">
      {/* Tiêu đề trang */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            Quản Lý Đánh Giá
          </h1>
        </div>
      </div>

      {/* Thẻ tổng quan điểm số */}
      {reviewsList.length > 0 && (
        <Card variant="elevated" className="p-6 bg-gradient-to-br from-white via-white to-amber-50/20 border-slate-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center">
          <div className="flex flex-col items-center justify-center shrink-0 sm:border-r sm:border-slate-100 sm:pr-8 text-center">
            <span className="text-5xl font-black text-slate-800 tracking-tight leading-none">{avgRating.toFixed(1)}</span>
            <div className="mt-2">
              <StarRating rating={Math.round(avgRating)} size={14} />
            </div>
            <span className="text-xs text-slate-400 font-semibold mt-2 bg-slate-100/80 px-2.5 py-0.5 rounded-full">
              {totalReviews} đánh giá tổng số
            </span>
          </div>
          <div className="flex-1 w-full space-y-2">
            {ratingDist.map(({ star, count, pct }) => {
              const isActive = starFilter === String(star);
              return (
                <button
                  key={star}
                  onClick={() => setStarFilter(isActive ? 'all' : String(star))}
                  className={`w-full flex items-center gap-3 text-xs font-bold rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                    isActive ? 'bg-amber-100/60 text-amber-900 ring-1 ring-amber-300' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                  title={`Lọc đánh giá ${star} sao`}
                >
                  <span className="flex items-center gap-1 w-8 shrink-0">
                    {star} <Star size={12} className="fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-400 w-8 text-right shrink-0 font-medium">{count}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Danh sách nút lọc sao nhanh */}
      {reviewsList.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center pt-1">
          <Button
            onClick={() => setStarFilter('all')}
            variant={starFilter === 'all' ? 'secondary' : 'outline'}
            size="sm"
            className={starFilter === 'all' ? 'shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
          >
            Tất cả ({totalReviews})
          </Button>
          {ratingDist.map(({ star, count }) => {
            const isActive = starFilter === String(star);
            return (
              <Button
                key={star}
                onClick={() => setStarFilter(String(star))}
                variant={isActive ? 'secondary' : 'outline'}
                size="sm"
                className={`inline-flex items-center gap-1.5 ${isActive ? 'shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {star} <Star size={12} className={isActive ? 'fill-white text-white' : 'fill-amber-400 text-amber-400'} />
                <span className={isActive ? 'text-white/90' : 'text-slate-400'}>({count})</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Trạng thái danh sách đánh giá */}
      {loading && reviewsList.length === 0 ? (
        <Spinner />
      ) : reviewsList.length === 0 ? (
        <Card variant="elevated" className="text-center py-16 border-slate-100">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-slate-600">Chưa có đánh giá nào cho nhà hàng của bạn</p>
        </Card>
      ) : filteredReviews.length === 0 ? (
        <Card variant="elevated" className="text-center py-16 border-slate-100">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-slate-600">Không có đánh giá {starFilter} sao nào</p>
          <Button onClick={() => setStarFilter('all')} variant="text" size="sm" className="mt-3 text-amber-600">
            Xem tất cả đánh giá
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {filteredReviews.map((rev) => (
              <Card 
                key={rev.id} 
                variant="elevated" 
                className="p-5 min-h-[380px] flex flex-col justify-between border-slate-200/60 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="space-y-3 shrink-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs shrink-0 shadow-inner">
                        {rev.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 leading-tight">{rev.author}</h3>
                        <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">{rev.date}</span>
                      </div>
                    </div>
                    <StarRating rating={rev.rating} size={13} />
                  </div>
                </div>

                <div className="flex-1 my-3.5 pr-1.5 flex flex-col justify-between max-h-[260px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-3">
                    <textarea
                      readOnly
                      value={rev.comment}
                      className="w-full text-xs font-medium text-slate-700 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 focus:outline-none resize-none custom-scrollbar"
                      rows={2}
                    />

                    {rev.images && rev.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rev.images.map((imgUrl, index) => (
                          <div 
                            key={index} 
                            onClick={() => setSelectedImage(imgUrl)}
                            className="relative group block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-amber-500 transition-all cursor-pointer shadow-sm"
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Review img ${index + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {rev.reply && (
                    <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100/60 text-xs font-medium space-y-1.5 mt-3">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Store size={14} className="text-amber-600" /> Phản hồi từ quán:
                      </span>
                      <textarea
                        readOnly
                        value={rev.reply}
                        className="w-full bg-transparent text-slate-700 leading-relaxed pl-1 focus:outline-none resize-none custom-scrollbar border-0 p-0"
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                <div className="shrink-0 pt-3 border-t border-slate-100 mt-auto">
                  {!rev.reply && (
                    <>
                      {activeReplyId === rev.id ? (
                        <div className="w-full flex flex-col gap-2.5 animate-fadeIn">
                          <textarea
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Viết phản hồi để gửi đến khách hàng..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none custom-scrollbar"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => setActiveReplyId(null)}
                              variant="outline"
                              size="sm"
                              className="bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200"
                              icon={X}
                            >
                              Hủy
                            </Button>
                            <Button
                              onClick={() => handleSendReply(rev.id)}
                              variant="secondary"
                              size="sm"
                              icon={Send}
                              className="bg-amber-600 text-white"
                            >
                              Gửi
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Button
                            onClick={() => {
                              setActiveReplyId(rev.id);
                              setReplyText('');
                            }}
                            variant="text"
                            size="sm"
                            icon={Reply}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50/50 font-semibold"
                          >
                            Phản hồi khách hàng
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-xs font-bold text-slate-500 mr-1">
                Trang {page + 1} / {totalPages}
              </span>

              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white bg-white/20 hover:bg-white/40 p-2 rounded-full transition-colors cursor-pointer"
              title="Đóng"
            >
              <X size={20} />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged review" 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}