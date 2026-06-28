import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { ArrowLeft, Star, Send, Utensils } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';

export default function Reviews() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const addReview = useOrderStore((state) => state.addReview);

  const [restaurantRating, setRestaurantRating] = useState(5);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [restaurantHover, setRestaurantHover] = useState(0);

  const [shipperRating, setShipperRating] = useState(5);
  const [shipperComment, setShipperComment] = useState('');
  const [shipperHover, setShipperHover] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  const { data: order, loading, error, refetch } = useFetchData(`/orders/${orderId}`, {
    deps: [orderId],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const reviewData = {
        orderId: Number(orderId),
        restaurantRating: Number(restaurantRating),
        restaurantComment: restaurantComment
      };

      // Only include shipper rating/comment if order has a shipper
      if (order?.shipperId) {
        reviewData.shipperRating = Number(shipperRating);
        reviewData.shipperComment = shipperComment;
      }

      await apiClient.post('/reviews', reviewData);

      // Đồng bộ hóa với Store Front-end cục bộ
      const localReviewData = {
        restaurant_rating: restaurantRating,
        restaurant_comment: restaurantComment
      };

      if (order?.shipperId) {
        localReviewData.shipper_rating = shipperRating;
        localReviewData.shipper_comment = shipperComment;
      }

      addReview(orderId, localReviewData);

      toast.success('Cảm ơn bạn đã gửi đánh giá! Ý kiến của bạn giúp chúng tôi nâng cao chất lượng dịch vụ.');
      navigate('/orders');
    } catch (err) {
      console.error('Lỗi gửi đánh giá:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng kiểm tra lại!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen />;
  }

  if (error) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Lỗi tải dữ liệu</h2>
        <p className="text-sm text-md-on-surface-variant mt-2">Không thể tải thông tin đơn hàng. Vui lòng thử lại.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 bg-md-primary text-white px-5 py-2.5 rounded-full font-bold text-sm"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Không tìm thấy đơn hàng</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-4 bg-md-primary text-white px-5 py-2.5 rounded-full font-bold text-sm"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-xl mx-auto w-full font-google-sans pb-24">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate('/orders')}
          className="p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-md-on-surface">Đánh giá đơn hàng #{orderId}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ĐÁNH GIÁ QUÁN */}
        <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-md-primary-container/20 text-md-primary rounded-radius-lg flex items-center justify-center">
              <Utensils size={20} />
            </div>
            <div>
              <span className="text-[10px] text-md-outline font-bold uppercase block">ĐÁNH GIÁ</span>
              <h3 className="font-bold text-sm text-md-on-surface mt-0.5">{order?.restaurantName || 'Quán ăn'}</h3>
            </div>
          </div>

          {/* Interactive Star Rating */}
          <div className="flex items-center gap-2 justify-center py-2">
            {[...Array(5)].map((_, idx) => {
              const ratingValue = idx + 1;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setRestaurantRating(ratingValue)}
                  onMouseEnter={() => setRestaurantHover(ratingValue)}
                  onMouseLeave={() => setRestaurantHover(0)}
                  className="focus:outline-none hover:scale-120 active:scale-95 transition-transform"
                  aria-label={`Rate ${ratingValue} stars`}
                  aria-pressed={ratingValue <= restaurantRating}
                >
                  <Star
                    size={28}
                    className={`transition-colors duration-150 ${
                      ratingValue <= (restaurantHover || restaurantRating)
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <textarea
            rows={3}
            value={restaurantComment}
            onChange={(e) => setRestaurantComment(e.target.value)}
            placeholder="Món ăn sườn có chín mềm không? Cơm dẻo không? Hãy chia sẻ trải nghiệm nhé..."
            className="w-full px-4 py-3 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary resize-none"
          />
        </div>

        {/* ĐÁNH GIÁ SHIPPER */}
        {order?.shipperId && (
          <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80" 
                alt="Shipper"
                className="w-10 h-10 rounded-radius-full object-cover border border-md-outline-variant"
              />
              <div>
                <span className="text-[10px] text-md-outline font-bold uppercase block">ĐÁNH GIÁ</span>
                <h3 className="font-bold text-sm text-md-on-surface mt-0.5">Tài xế: {order?.shipperName || 'Tài xế'}</h3>
              </div>
            </div>

            {/* Interactive Star Rating */}
            <div className="flex items-center gap-2 justify-center py-2">
              {[...Array(5)].map((_, idx) => {
                const ratingValue = idx + 1;
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setShipperRating(ratingValue)}
                    onMouseEnter={() => setShipperHover(ratingValue)}
                    onMouseLeave={() => setShipperHover(0)}
                    className="focus:outline-none hover:scale-120 active:scale-95 transition-transform"
                    aria-label={`Rate ${ratingValue} stars`}
                    aria-pressed={ratingValue <= shipperRating}
                  >
                    <Star
                      size={28}
                      className={`transition-colors duration-150 ${
                        ratingValue <= (shipperHover || shipperRating)
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <textarea
              rows={2}
              value={shipperComment}
              onChange={(e) => setShipperComment(e.target.value)}
              placeholder="Tài xế giao hàng nhanh không? Thái độ thân thiện không? (Không bắt buộc)..."
              className="w-full px-4 py-3 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary resize-none"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
        >
          {submitting ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              Gửi đánh giá
              <Send size={14} />
            </>
          )}
        </button>

      </form>

    </div>
  );
}
