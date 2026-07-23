import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { ArrowLeft, Star, Send, Utensils, Camera, X } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { useImageUpload } from '../../hooks/useImageUpload';
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

  // Quản lý danh sách URL ảnh đã upload thành công và trạng thái preview
  const [imageUrls, setImageUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Sử dụng hook upload ảnh có sẵn
  const { uploading, uploadImage } = useImageUpload({ uploadEndpoint: '/images/upload', maxSizeMB: 5 });

  const { data: order, loading, error, refetch } = useFetchData(`/orders/${orderId}`, {
    deps: [orderId],
  });

  // Xử lý khi chọn file ảnh từ máy
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (imageUrls.length + files.length > 5) {
      toast.warn('Bạn chỉ được tải lên tối đa 5 hình ảnh.');
      return;
    }

    for (const file of files) {
      const url = await uploadImage(file);
      if (url) {
        setImageUrls((prev) => [...prev, url]);
      }
    }
    // Reset input file
    e.target.value = '';
  };

  // Xóa ảnh khỏi danh sách preview
  const handleRemoveImage = (indexToRemove) => {
    setImageUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const reviewData = {
        orderId: Number(orderId),
        restaurantRating: Number(restaurantRating),
        restaurantComment: restaurantComment,
        images: imageUrls 
      };

      if (order?.shipperId) {
        reviewData.shipperRating = Number(shipperRating);
        reviewData.shipperComment = shipperComment;
      }

      await apiClient.post('/reviews', reviewData);

      // Đồng bộ store cục bộ
      const localReviewData = {
        restaurant_rating: restaurantRating,
        restaurant_comment: restaurantComment,
        images: imageUrls
      };

      if (order?.shipperId) {
        localReviewData.shipper_rating = shipperRating;
        localReviewData.shipper_comment = shipperComment;
      }

      addReview(orderId, localReviewData);

      toast.success('Cảm ơn bạn đã gửi đánh giá và hình ảnh!');
      navigate('/orders');
    } catch (err) {
      console.error('Lỗi gửi đánh giá:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng kiểm tra lại!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (error || !order) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <h2 className="text-xl font-bold text-md-on-surface">Không tìm thấy thông tin đơn hàng</h2>
        <button onClick={() => navigate('/orders')} className="mt-4 bg-md-primary text-white px-5 py-2.5 rounded-full font-bold text-sm">
          Quay lại đơn hàng
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-xl mx-auto w-full font-google-sans pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/orders')} className="p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-md-on-surface">Đánh Giá Đơn Hàng #{orderId}</h1>
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
                >
                  <Star
                    size={28}
                    className={`transition-colors duration-150 ${
                      ratingValue <= (restaurantHover || restaurantRating) ? 'fill-amber-500 text-amber-500' : 'text-slate-200'
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
            placeholder="Món ăn thế nào? Hãy chia sẻ trải nghiệm nhé..."
            className="w-full px-4 py-3 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary resize-none"
          />

          {/* UPLOAD VÀ PREVIEW HÌNH ẢNH */}
          <div className="space-y-2 pt-2">
            <label className="block text-[11px] font-bold text-md-on-surface-variant uppercase tracking-wider">
              Hình ảnh thực tế 
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-radius-lg overflow-hidden border border-md-outline-variant group">
                  <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {imageUrls.length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-md-outline-variant hover:border-md-primary rounded-radius-lg flex flex-col items-center justify-center cursor-pointer bg-slate-50 text-md-outline hover:text-md-primary transition-all">
                  {uploading ? (
                    <span className="w-5 h-5 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Camera size={20} />
                      <span className="text-[9px] font-bold mt-1">Thêm ảnh</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* ĐÁNH GIÁ SHIPPER */}
        {order?.shipperId && (
          <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] text-md-outline font-bold uppercase block">ĐÁNH GIÁ</span>
                <h3 className="font-bold text-sm text-md-on-surface mt-0.5">Tài xế: {order?.shipperName || 'Tài xế'}</h3>
              </div>
            </div>

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
                  >
                    <Star
                      size={28}
                      className={`transition-colors duration-150 ${
                        ratingValue <= (shipperHover || shipperRating) ? 'fill-amber-500 text-amber-500' : 'text-slate-200'
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
              placeholder="Tài xế giao hàng nhanh không? (Không bắt buộc)..."
              className="w-full px-4 py-3 bg-slate-50 border border-md-outline-variant rounded-radius-lg text-xs focus:outline-none focus:border-md-primary resize-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="w-full bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
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