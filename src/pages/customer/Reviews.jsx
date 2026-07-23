import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import { ArrowLeft, Star, Send, Utensils, Bike, Camera, X, MessageSquareReply } from 'lucide-react';
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

  const [loadingData, setLoadingData] = useState(true);
  const [existingReview, setExistingReview] = useState(null); // Lưu thông tin nếu đã đánh giá
  const [orderInfo, setOrderInfo] = useState(null); // Thông tin đơn hàng 

  // Quán ăn
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [restaurantHover, setRestaurantHover] = useState(0);

  // Shipper
  const [shipperRating, setShipperRating] = useState(0);
  const [shipperComment, setShipperComment] = useState('');
  const [shipperHover, setShipperHover] = useState(0);

  // Quản lý danh sách URL ảnh và trạng thái
  const [imageUrls, setImageUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Hook upload ảnh
  const { uploading, uploadImage } = useImageUpload({ uploadEndpoint: '/images/upload', maxSizeMB: 5 });

  useEffect(() => {
    const fetchReviewAndOrder = async () => {
      try {
        setLoadingData(true);

        // 1. Lấy thông tin đơn hàng 
        const orderRes = await apiClient.get(`/orders/${orderId}`);
        setOrderInfo(orderRes.data?.data || orderRes.data);

        // 2. kiểm tra xem đơn hàng đã được đánh giá hay chưa
        try {
          const reviewRes = await apiClient.get(`/reviews/${orderId}`);
          if (reviewRes.data?.data) {
            const rev = reviewRes.data.data;
            setExistingReview(rev);
            
            setRestaurantRating(rev.restaurantRating || 0);
            setRestaurantComment(rev.restaurantComment || '');
            setShipperRating(rev.shipperRating || 0);
            setShipperComment(rev.shipperComment || '');
            setImageUrls(rev.images || []);
          }
        } catch (reviewErr) {
          setExistingReview(null);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (orderId) {
      fetchReviewAndOrder();
    }
  }, [orderId]);

  //thêm hình ảnh
  const handleFileChange = async (e) => {
    if (existingReview) return; 
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

  //xóa hình ảnh
  const handleRemoveImage = (indexToRemove) => {
    if (existingReview) return;
    setImageUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  //gửi đánh giá
  const handleSubmit = async () => {
    if (existingReview) return;

    if (restaurantRating === 0) {
      toast.warn('Vui lòng chọn số sao đánh giá quán ăn!');
      return;
    }

    if (shipperRating === 0) {
      toast.warn('Vui lòng chọn số sao đánh giá shipper!');
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        orderId: Number(orderId),
        restaurantRating: Number(restaurantRating),
        restaurantComment: restaurantComment,
        images: imageUrls,
        shipperRating: Number(shipperRating),
        shipperComment: shipperComment
      };

      await apiClient.post('/reviews', reviewData);

      toast.success('Cảm ơn bạn đã gửi đánh giá!');
      navigate('/orders');
    } catch (err) {
      console.error('Lỗi gửi đánh giá:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng kiểm tra lại!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) return <Spinner fullScreen />;

  if (!orderInfo) {
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orders')}
            className="!p-2.5 rounded-radius-full border-md-outline-variant/40"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-lg font-extrabold text-md-on-surface">
              {existingReview ? `Chi Tiết Đánh Giá #${orderId}` : `Đánh Giá Đơn Hàng #${orderId}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ĐÁNH GIÁ QUÁN ĂN */}
        <Card variant="elevated" className="p-6 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-3">
            <div className="w-11 h-11 bg-md-primary-container/30 text-md-primary rounded-radius-xl flex items-center justify-center shrink-0">
              <Utensils size={22} />
            </div>
            <div>
              <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Chất lượng món ăn</span>
              <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Quán: {orderInfo?.restaurantName || 'Quán ăn'}</h3>
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
                    disabled={Boolean(existingReview)}
                    onClick={() => setRestaurantRating(ratingValue)}
                    onMouseEnter={() => !existingReview && setRestaurantHover(ratingValue)}
                    onMouseLeave={() => !existingReview && setRestaurantHover(0)}
                    className={`focus:outline-none transition-transform p-1 ${existingReview ? 'cursor-default' : 'active:scale-95'}`}
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
            disabled={Boolean(existingReview)}
            onChange={(e) => setRestaurantComment(e.target.value)}
            placeholder="Món ăn thế nào? Hãy chia sẻ trải nghiệm của bạn nhé..."
            className={`w-full px-4 py-3 border rounded-radius-lg text-xs transition-all resize-none ${
              existingReview 
                ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default select-text' 
                : 'bg-slate-50/70 border-md-outline-variant/40 focus:outline-none focus:border-md-primary focus:bg-white'
            }`}
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
                  {!existingReview && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              {!existingReview && imageUrls.length < 5 && (
                <label className="w-18 h-18 border-2 border-dashed border-md-outline-variant/60 hover:border-md-primary rounded-radius-lg flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-md-primary-container/10 text-md-outline hover:text-md-primary transition-all">
                  {uploading ? (
                    <span className="w-5 h-5 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Camera size={22} />
                      <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
                    </>
                  )}
                  {/* multiple: cho phép upload nhiều ảnh */}
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          {/* PHẢN HỒI TỪ QUÁN */}
          {existingReview?.merchantReply && (
            <div className="bg-slate-50 border border-slate-200 rounded-radius-lg p-3.5 space-y-1.5 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-md-primary">
                  <MessageSquareReply size={16} />
                  <span>Phản hồi từ Quán {orderInfo?.restaurantName || 'Quán'}</span>
                </div>
                {existingReview.repliedAt && (
                  <span className="text-[10px] text-slate-400">
                    {`${new Date(existingReview.repliedAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}  ${new Date(existingReview.repliedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-5 whitespace-pre-wrap">
                {existingReview.merchantReply}
              </p>
            </div>
          )}
        </Card>

        {/* ĐÁNH GIÁ SHIPPER */}
        {(orderInfo?.shipperId || shipperRating > 0 || shipperComment) && (
          <Card variant="elevated" className="p-6 space-y-5">
            <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-3">
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-radius-xl flex items-center justify-center shrink-0">
                <Bike size={22} />
              </div>
              <div>
                <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Dịch vụ giao hàng</span>
                <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Tài xế: {orderInfo?.shipperName || 'Tài xế'}</h3>
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
                      disabled={Boolean(existingReview)}
                      onClick={() => setShipperRating(ratingValue)}
                      onMouseEnter={() => !existingReview && setShipperHover(ratingValue)}
                      onMouseLeave={() => !existingReview && setShipperHover(0)}
                      className={`focus:outline-none transition-transform p-1 ${existingReview ? 'cursor-default' : 'active:scale-95'}`}
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
              rows={3}
              value={shipperComment}
              disabled={Boolean(existingReview)}
              onChange={(e) => setShipperComment(e.target.value)}
              placeholder="Tài xế giao hàng thân thiện, nhanh chóng chứ? (Không bắt buộc)..."
              className={`w-full px-4 py-3 border rounded-radius-lg text-xs transition-all resize-none ${
                existingReview 
                  ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default select-text' 
                  : 'bg-slate-50/70 border-md-outline-variant/40 focus:outline-none focus:border-md-primary focus:bg-white'
              }`}
            />
          </Card>
        )}

        <div className="pt-2">
          {existingReview ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate('/orders')}
              className="w-full py-4 text-sm uppercase tracking-wider"
            >
              Quay lại danh sách đơn hàng
            </Button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}