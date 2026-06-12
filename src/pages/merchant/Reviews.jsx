import React, { useState } from 'react';
import { Reply, ClipboardList } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { toast } from 'react-toastify';

export default function MerchantReviews() {
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: restaurant, loading: loadingRestaurant } = useFetchData('/merchant/restaurant');
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

  const { data: reviews, loading: loadingReviews, refetch } = useFetchData(
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

  if (!restaurantId && !loadingRestaurant) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để quản lý đánh giá.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans space-y-6 pb-24">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">Quản lý Đánh giá</h1>

      {loading && reviewsList.length === 0 ? (
        <Spinner />
      ) : reviewsList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-md-on-surface-variant">Chưa có đánh giá nào cho nhà hàng của bạn</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviewsList.map((rev) => (
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
                  <span className="font-extrabold text-md-secondary block mb-1">
                    🏪 Phản hồi từ quán:
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
