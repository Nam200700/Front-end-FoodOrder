import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { ArrowLeft, Star, Send, Utensils, Bike, Camera, X } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { useImageUpload } from '../../hooks/useImageUpload';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { toast } from 'react-toastify';

const getRatingLabel = (rating) => {
  switch (rating) {
    case 1:
      return 'Tệ';
    case 2:
      return 'Không hài lòng';
    case 3:
      return 'Bình thường';
    case 4:
      return 'Hài lòng';
    case 5:
      return 'Tuyệt vời';
    default:
      return '';
  }
};

export default function Reviews() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const addReview = useOrderStore((state) => state.addReview);

  // quán ăn
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [restaurantHover, setRestaurantHover] = useState(0);

  // shipper
  const [shipperRating, setShipperRating] = useState(0);
  const [shipperComment, setShipperComment] = useState('');
  const [shipperHover, setShipperHover] = useState(0);

  // Quản lý danh sách URL ảnh và trạng thái
  const [imageUrls, setImageUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Hook upload ảnh
  const { uploading, uploadImage } = useImageUpload({ uploadEndpoint: '/images/upload', maxSizeMB: 5 });

  const { data: order, loading, error } = useFetchData(`/orders/${orderId}`, {
    deps: [orderId],
  });

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
    e.target.value = '';
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const reviewData = {
        orderId: Number(orderId),
        restaurantRating: Number(restaurantRating),
        restaurantComment: restaurantComment,
        images: imageUrls,
      };

      if (order?.shipperId) {
        reviewData.shipperRating = Number(shipperRating);
        reviewData.shipperComment = shipperComment;
      }

      await apiClient.post('/reviews', reviewData);

      const localReviewData = {
        restaurant_rating: restaurantRating,
        restaurant_comment: restaurantComment,
        images: imageUrls,
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
        <h2 className="text-xl font-bold text-md-on-surface mb-3">Không tìm thấy thông tin đơn hàng</h2>
        <Button variant="primary" onClick={() => navigate('/orders')}>
          Quay lại đơn hàng
        </Button>
      </div>
    );
  }

  const currentRestaurantRating = restaurantHover || restaurantRating;
  const currentShipperRating = shipperHover || shipperRating;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-xl mx-auto w-full font-google-sans pb-28">
      {/* Header điều hướng */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/orders')}
          className="!p-2.5 rounded-radius-full border-md-outline-variant/40"
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-lg font-extrabold text-md-on-surface">Đánh Giá Đơn Hàng #{orderId}</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* ĐÁNH GIÁ QUÁN ĂN */}
        <Card variant="elevated" className="p-6 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-4">
            <div className="w-11 h-11 bg-md-primary-container/30 text-md-primary rounded-radius-xl flex items-center justify-center shrink-0">
              <Utensils size={22} />
            </div>
            <div>
              <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Chất lượng món ăn</span>
              <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Quán: {order?.restaurantName || 'Quán ăn'}</h3>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-1 space-y-2">
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, idx) => {
                const ratingValue = idx + 1;
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setRestaurantRating(ratingValue)}
                    onMouseEnter={() => setRestaurantHover(ratingValue)}
                    onMouseLeave={() => setRestaurantHover(0)}
                    className="focus:outline-none active:scale-95 transition-transform p-1"
                  >
                    <Star
                      size={32}
                      className={`transition-colors duration-200 ${
                        ratingValue <= currentRestaurantRating ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-slate-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {restaurantRating > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in">
                {getRatingLabel(restaurantRating)}
              </span>
            )}
          </div>

          <textarea
            rows={3}
            value={restaurantComment}
            onChange={(e) => setRestaurantComment(e.target.value)}
            placeholder="Món ăn thế nào? Hãy chia sẻ trải nghiệm của bạn nhé..."
            className="w-full px-4 py-3 bg-slate-50/70 border border-md-outline-variant/40 rounded-radius-lg text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all resize-none"
          />

          {/* UPLOAD & PREVIEW ẢNH */}
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-extrabold text-md-on-surface-variant uppercase tracking-wider">
                Hình ảnh thực tế
              </label>
              <span className="text-[11px] font-bold text-md-outline">{imageUrls.length}/5 ảnh</span>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative w-18 h-18 rounded-radius-lg overflow-hidden border border-md-outline-variant/40 group shadow-sm">
                  <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {imageUrls.length < 5 && (
                <label className="w-18 h-18 border-2 border-dashed border-md-outline-variant/60 hover:border-md-primary rounded-radius-lg flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-md-primary-container/10 text-md-outline hover:text-md-primary transition-all">
                  {uploading ? (
                    <span className="w-5 h-5 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Camera size={22} />
                      <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        </Card>

        {/* ĐÁNH GIÁ SHIPPER */}
        {order?.shipperId && (
          <Card variant="elevated" className="p-6 space-y-5">
            <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-2">
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-radius-xl flex items-center justify-center shrink-0">
                <Bike size={22} />
              </div>
              <div>
                <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Dịch vụ giao hàng</span>
                <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Tài xế: {order?.shipperName || 'Tài xế'}</h3>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-1 space-y-2">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, idx) => {
                  const ratingValue = idx + 1;
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setShipperRating(ratingValue)}
                      onMouseEnter={() => setShipperHover(ratingValue)}
                      onMouseLeave={() => setShipperHover(0)}
                      className="focus:outline-none active:scale-95 transition-transform p-1"
                    >
                      <Star
                        size={32}
                        className={`transition-colors duration-200 ${
                          ratingValue <= currentShipperRating ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              {shipperRating > 0 && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in">
                  {getRatingLabel(shipperRating)}
                </span>
              )}
            </div>

            <textarea
              rows={2}
              value={shipperComment}
              onChange={(e) => setShipperComment(e.target.value)}
              placeholder="Tài xế giao hàng thân thiện, nhanh chóng chứ? (Không bắt buộc)..."
              className="w-full px-4 py-3 bg-slate-50/70 border border-md-outline-variant/40 rounded-radius-lg text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all resize-none"
            />
          </Card>
        )}

        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={submitting || uploading}
            icon={Send}
            onClick={handleSubmit}
            className="w-full py-4 text-sm uppercase tracking-wider shadow-md"
          >
            Gửi đánh giá 
          </Button>
        </div>
      </div>
    </div>
  );
}