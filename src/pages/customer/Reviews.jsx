import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../../stores/orderStore';
import {
  ArrowLeft, Star, Send, Utensils, Bike, Camera, X, MessageSquareReply,
  Sparkles, ReceiptText, Lightbulb, ShieldCheck, ImagePlus, Heart, Check, Plus,
  Frown, Meh, Smile, Laugh,
} from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { formatCurrency } from '../../utils/format';
import { toast } from 'react-toastify';

// Nhãn cảm xúc ĐẦY MÀU SẮC theo số sao + icon mặt phản ứng theo điểm
const RATING_META = {
  1: { label: 'Tệ', text: 'text-red-500', pill: 'bg-red-50 text-red-600 border-red-200', face: Frown },
  2: { label: 'Không hài lòng', text: 'text-orange-500', pill: 'bg-orange-50 text-orange-600 border-orange-200', face: Frown },
  3: { label: 'Bình thường', text: 'text-amber-500', pill: 'bg-amber-50 text-amber-600 border-amber-200', face: Meh },
  4: { label: 'Hài lòng', text: 'text-lime-600', pill: 'bg-lime-50 text-lime-700 border-lime-200', face: Smile },
  5: { label: 'Tuyệt vời', text: 'text-emerald-600', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', face: Laugh },
};

// Gợi ý tag theo số sao — bấm để thêm vào nhận xét, khỏi phải tự nghĩ
const RESTAURANT_TAGS = {
  positive: [
    'Món ăn ngon', 'Hương vị đậm đà', 'Đồ ăn còn nóng hổi', 'Phần ăn đầy đặn',
    'Nguyên liệu tươi ngon', 'Trình bày đẹp mắt', 'Đóng gói cẩn thận', 'Giá cả hợp lý',
    'Đúng như mô tả', 'Giao còn nóng', 'Sẽ đặt lại', 'Đáng đồng tiền',
  ],
  neutral: [
    'Tạm ổn', 'Vị bình thường', 'Món hơi nguội', 'Phần ăn hơi ít',
    'Đóng gói tạm ổn', 'Giá hơi cao', 'Cần cải thiện thêm', 'Đúng như mô tả',
  ],
  negative: [
    'Món bị nguội', 'Vị không ngon', 'Thiếu món', 'Giao sai món',
    'Không đúng mô tả', 'Phần ăn quá ít', 'Đồ ăn không tươi', 'Đóng gói sơ sài',
    'Vệ sinh chưa tốt', 'Giá quá cao', 'Nêm nếm chưa vừa',
  ],
};
const SHIPPER_TAGS = {
  positive: [
    'Giao hàng nhanh', 'Giao đúng giờ', 'Tài xế thân thiện', 'Vui vẻ nhiệt tình',
    'Cẩn thận với món', 'Đóng gói nguyên vẹn', 'Gọi điện lịch sự', 'Giao tận nơi', 'Chuyên nghiệp',
  ],
  neutral: [
    'Tạm ổn', 'Giao hơi chậm', 'Bình thường', 'Giao đúng nơi', 'Liên lạc được',
  ],
  negative: [
    'Giao hàng trễ', 'Thái độ chưa tốt', 'Làm rơi/hỏng món', 'Khó liên lạc',
    'Giao sai địa chỉ', 'Không gọi trước', 'Món bị xáo trộn', 'Thiếu chuyên nghiệp',
  ],
};
const bandForRating = (r) => (r >= 4 ? 'positive' : r === 3 ? 'neutral' : 'negative');

// Gộp tag đã chọn + nhận xét tự do thành 1 chuỗi để gửi lên API (không đổi contract)
const mergeComment = (tags, freeText) => {
  const parts = [];
  if (tags.size) parts.push([...tags].join(', '));
  if (freeText && freeText.trim()) parts.push(freeText.trim());
  return parts.join('. ');
};

export default function Reviews() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const addReview = useOrderStore((state) => state.addReview);

  const [loadingData, setLoadingData] = useState(true);
  const [existingReview, setExistingReview] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);

  // Quán ăn
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [restaurantHover, setRestaurantHover] = useState(0);
  const [restaurantTags, setRestaurantTags] = useState(new Set());

  // Shipper
  const [shipperRating, setShipperRating] = useState(0);
  const [shipperComment, setShipperComment] = useState('');
  const [shipperHover, setShipperHover] = useState(0);
  const [shipperTags, setShipperTags] = useState(new Set());

  const [imageUrls, setImageUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const { uploading, uploadImage } = useImageUpload({ uploadEndpoint: '/images/upload', maxSizeMB: 5 });

  useEffect(() => {
    const fetchReviewAndOrder = async () => {
      try {
        setLoadingData(true);
        const orderRes = await apiClient.get(`/orders/${orderId}`);
        setOrderInfo(orderRes.data?.data || orderRes.data);

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
    if (orderId) fetchReviewAndOrder();
  }, [orderId]);

  const toggleTag = (setter) => (tag) => setter((prev) => {
    const next = new Set(prev);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    return next;
  });
  const toggleRestaurantTag = toggleTag(setRestaurantTags);
  const toggleShipperTag = toggleTag(setShipperTags);

  // Đổi sao → xoá tag đã chọn (tránh tag lệch nhóm cảm xúc so với số sao mới)
  const pickRestaurantRating = (v) => { if (existingReview) return; setRestaurantRating(v); setRestaurantTags(new Set()); };
  const pickShipperRating = (v) => { if (existingReview) return; setShipperRating(v); setShipperTags(new Set()); };

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
      if (url) setImageUrls((prev) => [...prev, url]);
    }
    e.target.value = '';
  };

  const handleRemoveImage = (indexToRemove) => {
    if (existingReview) return;
    setImageUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (existingReview) return;
    if (restaurantRating === 0) { toast.warn('Vui lòng chọn số sao đánh giá quán ăn!'); return; }
    if (shipperRating === 0) { toast.warn('Vui lòng chọn số sao đánh giá shipper!'); return; }

    setSubmitting(true);
    try {
      const reviewData = {
        orderId: Number(orderId),
        restaurantRating: Number(restaurantRating),
        restaurantComment: mergeComment(restaurantTags, restaurantComment),
        images: imageUrls,
        shipperRating: Number(shipperRating),
        shipperComment: mergeComment(shipperTags, shipperComment),
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
        <Button variant="primary" onClick={() => navigate('/orders')}>Quay lại đơn hàng</Button>
      </div>
    );
  }

  const readOnly = Boolean(existingReview);
  const items = Array.isArray(orderInfo?.items) ? orderInfo.items : [];
  const orderDate = orderInfo?.createdAt
    ? new Date(orderInfo.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans pb-28 space-y-6">

      {/* ─── Back + Hero recap (tông cam customer) ─── */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline" size="sm" onClick={() => navigate('/orders')}
          className="!p-2.5 rounded-radius-full border-md-outline-variant/40"
        >
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg font-extrabold text-md-on-surface">
          {readOnly ? `Chi Tiết Đánh Giá #${orderId}` : `Đánh Giá Đơn Hàng #${orderId}`}
        </h1>
      </div>

      <div className="relative overflow-hidden rounded-3xl p-6 md:p-7 text-white shadow-md bg-gradient-to-br from-md-primary to-[#FF8C42]">
        <div className="pointer-events-none absolute -top-10 -right-8 w-44 h-44 rounded-full bg-white/15 blur-2xl" />
        <Sparkles className="pointer-events-none absolute top-5 right-6 text-white/40" size={20} />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
            <Star size={28} className="fill-white text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black leading-tight">
              {readOnly ? 'Cảm ơn bạn đã đánh giá!' : 'Trải nghiệm của bạn thế nào?'}
            </h2>
            <p className="text-xs md:text-sm text-white/90 font-semibold mt-1.5 leading-relaxed max-w-md">
              {readOnly
                ? 'Đánh giá của bạn giúp quán và tài xế phục vụ tốt hơn.'
                : 'Chấm sao và chọn nhanh các gợi ý bên dưới — chỉ mất chưa tới 1 phút thôi!'}
            </p>
            <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-white/90 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1">
                <Utensils size={12} /> {orderInfo?.restaurantName || 'Quán ăn'}
              </span>
              {orderDate && (
                <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1">
                  <ReceiptText size={12} /> {orderDate}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2 cột: form đánh giá + tóm tắt/mẹo ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* CỘT TRÁI: form đánh giá */}
        <div className="lg:col-span-2 space-y-6">

          {/* ĐÁNH GIÁ QUÁN ĂN */}
          <Card variant="elevated" className="p-6 space-y-5 animate-rise-in">
            <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-3">
              <div className="w-11 h-11 bg-md-primary-container/30 text-md-primary rounded-radius-xl flex items-center justify-center shrink-0">
                <Utensils size={22} />
              </div>
              <div>
                <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Chất lượng món ăn</span>
                <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Quán: {orderInfo?.restaurantName || 'Quán ăn'}</h3>
              </div>
            </div>

            <RatingStars value={restaurantRating} hover={restaurantHover} readOnly={readOnly}
              onPick={pickRestaurantRating} onHover={setRestaurantHover} />

            {!readOnly && restaurantRating > 0 && (
              <SuggestionChips
                bank={RESTAURANT_TAGS[bandForRating(restaurantRating)]}
                selected={restaurantTags}
                onToggle={toggleRestaurantTag}
              />
            )}

            <textarea
              rows={3}
              value={restaurantComment}
              disabled={readOnly}
              onChange={(e) => setRestaurantComment(e.target.value)}
              placeholder="Muốn nói thêm điều gì? Chia sẻ chi tiết trải nghiệm của bạn nhé... (không bắt buộc)"
              className={`w-full px-4 py-3 border rounded-radius-lg text-xs transition-all resize-none ${
                readOnly
                  ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default select-text'
                  : 'bg-slate-50/70 border-md-outline-variant/40 focus:outline-none focus:border-md-primary focus:bg-white'
              }`}
            />

            {/* UPLOAD & PREVIEW ẢNH */}
            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-extrabold text-md-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <ImagePlus size={13} className="text-md-primary" /> Hình ảnh thực tế
                </label>
                <span className="text-[11px] font-bold text-md-outline">{imageUrls.length}/5 ảnh</span>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative w-18 h-18 rounded-radius-lg overflow-hidden border border-md-outline-variant/40 group shadow-sm">
                    <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {!readOnly && (
                      <button type="button" onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && imageUrls.length < 5 && (
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

            {/* PHẢN HỒI TỪ QUÁN */}
            {existingReview?.merchantReply && (
              <div className="bg-md-primary-container/15 border border-md-primary/20 rounded-radius-lg p-3.5 space-y-1.5 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-md-primary">
                    <MessageSquareReply size={16} />
                    <span>Phản hồi từ Quán {orderInfo?.restaurantName || 'Quán'}</span>
                  </div>
                  {existingReview.repliedAt && (
                    <span className="text-[10px] text-slate-400">
                      {`${new Date(existingReview.repliedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}  ${new Date(existingReview.repliedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-5 whitespace-pre-wrap">{existingReview.merchantReply}</p>
              </div>
            )}
          </Card>

          {/* ĐÁNH GIÁ SHIPPER */}
          {(orderInfo?.shipperId || shipperRating > 0 || shipperComment) && (
            <Card variant="elevated" className="p-6 space-y-5 animate-rise-in" style={{ animationDelay: '80ms' }}>
              <div className="flex items-center gap-3.5 border-b border-md-outline-variant/15 pb-3">
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-radius-xl flex items-center justify-center shrink-0">
                  <Bike size={22} />
                </div>
                <div>
                  <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">Dịch vụ giao hàng</span>
                  <h3 className="font-extrabold text-base text-md-on-surface mt-0.5">Tài xế: {orderInfo?.shipperName || 'Tài xế'}</h3>
                </div>
              </div>

              <RatingStars value={shipperRating} hover={shipperHover} readOnly={readOnly}
                onPick={pickShipperRating} onHover={setShipperHover} />

              {!readOnly && shipperRating > 0 && (
                <SuggestionChips
                  bank={SHIPPER_TAGS[bandForRating(shipperRating)]}
                  selected={shipperTags}
                  onToggle={toggleShipperTag}
                />
              )}

              <textarea
                rows={3}
                value={shipperComment}
                disabled={readOnly}
                onChange={(e) => setShipperComment(e.target.value)}
                placeholder="Tài xế giao hàng thân thiện, nhanh chóng chứ? (không bắt buộc)..."
                className={`w-full px-4 py-3 border rounded-radius-lg text-xs transition-all resize-none ${
                  readOnly
                    ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-default select-text'
                    : 'bg-slate-50/70 border-md-outline-variant/40 focus:outline-none focus:border-md-primary focus:bg-white'
                }`}
              />
            </Card>
          )}

          {/* NÚT HÀNH ĐỘNG */}
          <div className="pt-1">
            {readOnly ? (
              <Button type="button" variant="primary" size="md" onClick={() => navigate('/orders')}
                className="w-full py-4 text-sm uppercase tracking-wider">
                Quay lại danh sách đơn hàng
              </Button>
            ) : (
              <Button type="button" variant="primary" size="md" loading={submitting || uploading} icon={Send}
                onClick={handleSubmit} className="w-full py-4 text-sm uppercase tracking-wider shadow-md">
                Gửi đánh giá
              </Button>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: tóm tắt đơn + mẹo (lấp khoảng trống) */}
        <aside className="space-y-5 lg:sticky lg:top-6">
          {/* Tóm tắt đơn */}
          <Card variant="elevated" className="p-5 space-y-3.5">
            <h3 className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider flex items-center gap-2">
              <ReceiptText size={16} className="text-md-primary" /> Tóm tắt đơn hàng
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-md-outline font-semibold">Mã đơn</span>
                <span className="font-extrabold text-md-on-surface">#{orderId}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-md-outline font-semibold shrink-0">Quán</span>
                <span className="font-bold text-md-on-surface text-right">{orderInfo?.restaurantName || 'Quán ăn'}</span>
              </div>
              {orderDate && (
                <div className="flex justify-between gap-2">
                  <span className="text-md-outline font-semibold">Ngày đặt</span>
                  <span className="font-bold text-md-on-surface">{orderDate}</span>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-md-outline-variant/15 pt-3 space-y-2">
                {items.slice(0, 5).map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-md-on-surface font-semibold truncate">
                      <span className="text-md-primary font-extrabold">{it.quantity || 1}×</span> {it.foodName || it.name || 'Món ăn'}
                    </span>
                  </div>
                ))}
                {items.length > 5 && (
                  <span className="text-[10px] text-md-outline font-semibold">+{items.length - 5} món khác</span>
                )}
              </div>
            )}

            {orderInfo?.totalAmount != null && (
              <div className="border-t border-md-outline-variant/15 pt-3 flex justify-between items-center">
                <span className="text-[11px] text-md-outline font-bold uppercase tracking-wide">Tổng cộng</span>
                <span className="text-sm font-black text-md-primary">{formatCurrency(Number(orderInfo.totalAmount))}</span>
              </div>
            )}
          </Card>

          {/* Mẹo đánh giá */}
          <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5">
            <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Lightbulb size={16} /> Mẹo đánh giá hữu ích
            </h3>
            <ul className="space-y-2.5">
              {[
                { icon: Star, text: 'Chấm sao rồi bấm chọn các gợi ý — nhanh mà vẫn đủ ý.' },
                { icon: Camera, text: 'Thêm ảnh món thật giúp đánh giá đáng tin hơn nhiều.' },
                { icon: ShieldCheck, text: 'Nhận xét trung thực giúp cộng đồng chọn đúng quán ngon.' },
              ].map((t, i) => {
                const TIcon = t.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <TIcon size={13} />
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800/90 leading-relaxed">{t.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Lời cảm ơn nhỏ */}
          <div className="rounded-3xl bg-md-primary-container/20 border border-md-primary/15 p-4 flex items-center gap-2.5">
            <Heart size={16} className="text-md-primary shrink-0 fill-md-primary" />
            <p className="text-[11px] font-bold text-md-primary/90 leading-relaxed">
              Mỗi đánh giá của bạn là động lực để dịch vụ ngày một tốt hơn.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Cụm chọn sao (tái dùng cho quán & shipper) — có animation nảy + mặt cảm xúc đổi màu ── */
function RatingStars({ value, hover, readOnly, onPick, onHover }) {
  const current = hover || value;
  const meta = value > 0 ? RATING_META[value] : null;
  const Face = meta?.face;
  return (
    <div className="flex flex-col items-center justify-center py-1 space-y-3">
      <div className="flex items-center gap-1.5">
        {[...Array(5)].map((_, idx) => {
          const rv = idx + 1;
          const colored = rv <= current;   // tô vàng (gồm cả hover-preview)
          const picked = rv <= value;      // đã chấm thật → chạy pop
          return (
            <button
              type="button"
              key={idx}
              disabled={readOnly}
              onClick={() => onPick(rv)}
              onMouseEnter={() => !readOnly && onHover(rv)}
              onMouseLeave={() => !readOnly && onHover(0)}
              className={`focus:outline-none transition-transform duration-150 p-1 ${
                readOnly ? 'cursor-default' : 'hover:scale-125 active:scale-90 cursor-pointer'
              }`}
            >
              {/* key={value}: đổi sao → remount → replay animation nảy; delay theo vị trí để sáng lần lượt */}
              <Star
                key={value}
                size={38}
                style={picked && !readOnly ? { animationDelay: `${idx * 55}ms` } : undefined}
                className={`transition-colors duration-200 ${
                  colored
                    ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_7px_rgba(251,191,36,0.55)]'
                    : 'text-slate-200'
                } ${picked && !readOnly ? 'animate-star-pop' : ''}`}
              />
            </button>
          );
        })}
      </div>
      {meta && (
        <div key={value} className="animate-star-pop inline-flex items-center gap-2">
          {Face && <Face size={22} className={meta.text} strokeWidth={2.4} />}
          <span className={`text-sm font-extrabold px-3.5 py-1 rounded-full border ${meta.pill}`}>
            {meta.label}
          </span>
          {value === 5 && <Sparkles size={16} className="text-amber-400 animate-twinkle" />}
        </div>
      )}
    </div>
  );
}

/* ── Chip gợi ý theo số sao ── */
function SuggestionChips({ bank, selected, onToggle }) {
  return (
    <div className="space-y-2 animate-rise-in">
      <span className="text-[10px] font-extrabold text-md-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
        <Sparkles size={12} className="text-md-primary" /> Gợi ý nhanh (bấm để thêm)
      </span>
      <div className="flex flex-wrap gap-2">
        {bank.map((tag) => {
          const on = selected.has(tag);
          return (
            <button
              type="button"
              key={tag}
              onClick={() => onToggle(tag)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1 ${
                on
                  ? 'bg-md-primary text-white border-md-primary shadow-sm'
                  : 'bg-white text-md-on-surface-variant border-md-outline-variant/50 hover:border-md-primary hover:text-md-primary'
              }`}
            >
              {on ? <Check size={12} /> : <Plus size={12} />}{tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
