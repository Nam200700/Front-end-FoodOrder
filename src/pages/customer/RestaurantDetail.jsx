import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Star, Clock, MapPin, Phone, Search, ShoppingBag, Heart, Share2, Plus, Minus, MessageSquare, AlertTriangle, Bike, AlertCircle, X, ZoomIn, ChevronLeft, ChevronRight, Utensils, Info, Truck, Wallet, Timer, Sparkles, TrendingUp, ThumbsUp, Award, ArrowDownUp, Camera, ChevronDown, Frown, Meh, Smile, Laugh, MessageSquareText, Store } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { getFoodImageUrl, DEFAULT_FOOD_IMAGE } from '../../utils/avatarHelper';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import { toast } from 'react-toastify';
import { mapRestaurant } from '../../utils/mappers';
import { useModalState } from '../../hooks/useModalState';
import { useFetchData } from '../../hooks/useFetchData';

// Hàng 5 sao dùng chung — tô theo điểm (làm tròn), tuỳ chọn hiệu ứng pop cho sinh động.
function StarRow({ value = 0, size = 14, animate = false, className = '' }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[...Array(5)].map((_, idx) => (
        <Star
          key={idx}
          size={size}
          strokeWidth={2}
          className={`${idx < filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'} ${animate && idx < filled ? 'animate-star-pop' : ''}`}
          style={animate && idx < filled ? { animationDelay: `${idx * 70}ms` } : undefined}
        />
      ))}
    </span>
  );
}

// Lời nhận xét ngắn theo mức điểm trung bình (thân thiện, tông khách hàng).
const ratingBlurb = (r) => {
  const n = Number(r) || 0;
  if (n >= 4.5) return 'Tuyệt vời! Quán được thực khách yêu thích và đánh giá rất cao.';
  if (n >= 4) return 'Rất tốt — phần lớn khách hài lòng với món ăn và dịch vụ.';
  if (n >= 3) return 'Khá ổn — quán đang được nhiều khách ủng hộ.';
  if (n > 0) return 'Quán đang nỗ lực cải thiện chất lượng phục vụ.';
  return 'Hãy là người đầu tiên đánh giá quán nhé!';
};

// ─── Tài nguyên dùng riêng cho TAB ĐÁNH GIÁ (khách xem) — tông cam CUSTOMER (#FF6B35) ───
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
];
const colorFor = (name) => AVATAR_COLORS[((name || '?').charCodeAt(0) || 0) % AVATAR_COLORS.length];

// Nhãn cảm xúc theo số sao — đồng bộ với trang đánh giá owner/shipper
const RATING_META = {
  1: { label: 'Tệ', pill: 'bg-red-50 text-red-600 border-red-200', face: Frown },
  2: { label: 'Không hài lòng', pill: 'bg-orange-50 text-orange-600 border-orange-200', face: Frown },
  3: { label: 'Bình thường', pill: 'bg-amber-50 text-amber-600 border-amber-200', face: Meh },
  4: { label: 'Hài lòng', pill: 'bg-lime-50 text-lime-700 border-lime-200', face: Smile },
  5: { label: 'Tuyệt vời', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', face: Laugh },
};
const metaFor = (rating) => RATING_META[Math.min(5, Math.max(1, Math.round(rating)))] || RATING_META[5];

const SORTS = [
  { id: 'recent', label: 'Mới nhất' },
  { id: 'oldest', label: 'Cũ nhất' },
  { id: 'high', label: 'Sao cao nhất' },
  { id: 'low', label: 'Sao thấp nhất' },
];
const SORT_PARAM = { recent: 'createdAt,desc', oldest: 'createdAt,asc', high: 'restaurantRating,desc', low: 'restaurantRating,asc' };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Đếm tăng dần cho điểm trung bình (0 → target)
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion() || !target) { setVal(target); return; }
    let raf; const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Chip highlight dùng chung: Khen (xanh lá) & Cần cải thiện (hổ phách)
function HighlightCard({ title, items, tone }) {
  const good = tone === 'good';
  const HeadIcon = good ? ThumbsUp : AlertTriangle;
  const max = items[0]?.count || 1;
  return (
    <Card
      variant="elevated"
      className={`rounded-xl border shadow-sm p-4 md:p-5 h-full animate-rise-in ${
        good ? 'bg-gradient-to-br from-emerald-50/70 to-white border-emerald-100' : 'bg-gradient-to-br from-amber-50/70 to-white border-amber-100'
      }`}
    >
      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
        <HeadIcon size={15} className={good ? 'text-emerald-600' : 'text-amber-500'} /> {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((c, i) => {
          const strong = c.count >= Math.max(2, max * 0.6);
          const ChipIcon = good ? ThumbsUp : AlertTriangle;
          const strongCls = good ? 'bg-[#E8F5E9] text-emerald-700 border-[#C8E6C9] shadow-sm' : 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm';
          const badgeCls = good ? (strong ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500') : (strong ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500');
          return (
            <span
              key={c.text}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border animate-rise-in transition-transform hover:scale-105 ${strong ? strongCls : 'bg-white text-slate-600 border-slate-200'}`}
            >
              <ChipIcon size={12} className={strong ? (good ? 'text-emerald-600' : 'text-amber-500') : 'text-slate-400'} />
              {c.text}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeCls}`}>{c.count}</span>
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * TAB ĐÁNH GIÁ (khách xem quán) — cùng cấu trúc trang owner/shipper nhưng KHÁC BIỆT vì là KHÁCH:
 * đọc-only (không phản hồi), tông cam CUSTOMER, tiêu đề hướng "cảm nhận của thực khách".
 * Dùng summary + list LỌC/SORT phân trang server-side (endpoint công khai mới).
 */
function ReviewsTab({ restaurantId, globalRating, globalCount, restaurantName, onImageClick }) {
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [imageOnly, setImageOnly] = useState(false);
  const [page, setPage] = useState(0);
  const size = 8;

  // Đổi quán → reset bộ lọc
  useEffect(() => { setStarFilter('all'); setSortBy('recent'); setImageOnly(false); setPage(0); }, [restaurantId]);

  const { data: summary } = useFetchData(`/restaurants/${restaurantId}/reviews/summary`, { mapFn: (d) => d, deps: [restaurantId] });

  const listUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size), sort: SORT_PARAM[sortBy] || SORT_PARAM.recent });
    if (starFilter !== 'all') p.append('star', starFilter);
    if (imageOnly) p.append('imageOnly', 'true');
    return `/restaurants/${restaurantId}/reviews?${p.toString()}`;
  }, [restaurantId, page, sortBy, starFilter, imageOnly]);

  const { data: listData, loading: loadingList } = useFetchData(listUrl, {
    mapFn: (d) => ({
      items: (d?.content || []).map((r) => ({
        id: (r.reviewId ?? Math.random()).toString(),
        author: r.customerName || 'Khách hàng',
        rating: r.restaurantRating || 5,
        date: new Date(r.createdAt).toLocaleDateString('vi-VN'),
        comment: r.restaurantComment || '',
        reply: r.merchantReply,
        images: r.images || [],
      })),
      totalPages: Math.max(1, d?.totalPages || 1),
      totalElements: d?.totalElements ?? 0,
    }),
    deps: [restaurantId],
  });

  const s = summary || {};
  // Ưu tiên số toàn cục từ BE (đã hiển thị ở header) để đồng nhất; fallback từ summary
  const totalReviews = Number(globalCount ?? s.total ?? 0);
  const avgRating = Number(globalRating ?? s.avg ?? 0);
  const ratingDist = (s.distribution && s.distribution.length
    ? s.distribution
    : [5, 4, 3, 2, 1].map((star) => ({ star, count: 0 }))
  ).map((x) => ({ star: x.star, count: x.count || 0, pct: totalReviews ? ((x.count || 0) / totalReviews) * 100 : 0 }));

  const positiveCount = s.positiveCount || 0;
  const satisfaction = totalReviews ? Math.round((positiveCount / totalReviews) * 100) : 0;
  const recentCount = s.recentCount || 0;
  const recentAvg = Number(s.recentAvg || 0);
  const withImageCount = s.withImageCount || 0;
  const compliments = s.compliments || [];
  const complaints = s.complaints || [];
  const hasHighlights = compliments.length > 0 || complaints.length > 0;

  const animatedAvg = useCountUp(Number(avgRating.toFixed(1)));

  const list = listData || { items: [], totalPages: 1, totalElements: 0 };
  const reviews = list.items;
  const totalPages = list.totalPages;
  const safePage = Math.min(page, totalPages - 1);

  const changeFilter = (v) => { setStarFilter(v); setPage(0); };
  const changeSort = (v) => { setSortBy(v); setPage(0); };
  const toggleImageOnly = () => { setImageOnly((v) => !v); setPage(0); };
  const hasActiveControls = starFilter !== 'all' || imageOnly || sortBy !== 'recent';

  if (totalReviews === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        <Card variant="flat" className="text-center py-16">
          <Star size={48} className="mx-auto text-md-outline/35 mb-3.5" />
          <p className="text-base font-extrabold text-md-on-surface-variant">Chưa có đánh giá nào</p>
          <p className="text-sm text-md-outline mt-1">Hãy đặt đơn và trở thành người đánh giá đầu tiên!</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 space-y-6">

      {/* ─── HERO CAM CUSTOMER: điểm TB đếm tăng + sao + hài lòng + 30 ngày ─── */}
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-[#E85A2A] to-[#FF6B35] text-white p-6 md:p-7 shadow-shadow-2 animate-rise-in">
        <Star className="absolute -right-6 -bottom-7 text-white/10 fill-white/10" size={150} strokeWidth={1} />
        <Sparkles className="absolute right-24 top-6 text-white/25 animate-twinkle" size={20} />
        <Sparkles className="absolute right-10 bottom-8 text-white/15 animate-twinkle" size={13} style={{ animationDelay: '700ms' }} />
        <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
          <div className="flex flex-col items-center sm:items-start shrink-0 sm:border-r sm:border-white/20 sm:pr-7">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              <Store size={11} className="fill-white" /> Cảm nhận của thực khách
            </span>
            <div className="flex items-end gap-2">
              <span className="text-5xl md:text-6xl font-black leading-none tracking-tight tabular-nums">{animatedAvg.toFixed(1)}</span>
              <span className="text-white/70 text-sm font-bold mb-1.5">/ 5</span>
            </div>
            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((st) => (
                <Star key={st} size={17} className={`${st <= Math.round(avgRating) ? 'fill-amber-300 text-amber-300 animate-star-pop' : 'text-white/30'}`} style={{ animationDelay: `${st * 90}ms` }} />
              ))}
            </div>
            <span className="text-[12px] text-white/85 font-semibold mt-2">{totalReviews} lượt đánh giá từ khách hàng</span>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="rounded-radius-lg bg-white/12 backdrop-blur-sm px-3.5 py-3 border border-white/15">
              <div className="flex items-center gap-1.5 text-white/85 text-[10px] font-bold uppercase tracking-wide"><ThumbsUp size={13} /> Hài lòng</div>
              <p className="text-2xl font-black mt-1 leading-none">{satisfaction}<span className="text-base font-bold">%</span></p>
              <p className="text-[10px] text-white/70 font-semibold mt-1">{positiveCount}/{totalReviews} đạt 4–5★</p>
            </div>
            <div className="rounded-radius-lg bg-white/12 backdrop-blur-sm px-3.5 py-3 border border-white/15">
              <div className="flex items-center gap-1.5 text-white/85 text-[10px] font-bold uppercase tracking-wide"><TrendingUp size={13} /> 30 ngày qua</div>
              <p className="text-2xl font-black mt-1 leading-none flex items-center gap-1">
                {recentCount ? recentAvg.toFixed(1) : '—'}
                {recentCount > 0 && <Star size={15} className="fill-amber-300 text-amber-300" />}
              </p>
              <p className="text-[10px] text-white/70 font-semibold mt-1">{recentCount} đánh giá gần đây</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PHÂN BỐ SAO | KHEN + CẦN CẢI THIỆN ─── */}
      <div className={`grid gap-6 items-start ${hasHighlights ? 'lg:grid-cols-2' : ''}`}>
        <Card variant="elevated" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 h-full">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
            <Award size={15} className="text-amber-500" /> Phân bố đánh giá
          </h3>
          <div className="space-y-2">
            {ratingDist.map(({ star, count, pct }) => {
              const isActive = starFilter === String(star);
              return (
                <button
                  key={star}
                  onClick={() => changeFilter(isActive ? 'all' : String(star))}
                  className={`w-full flex items-center gap-3 text-xs font-bold rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                    isActive ? 'bg-md-primary/10 text-md-primary ring-1 ring-md-primary/40' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                  title={`Lọc đánh giá ${star} sao`}
                >
                  <span className="flex items-center gap-1 w-8 shrink-0">{star} <Star size={12} className="fill-amber-400 text-amber-400" /></span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-400 w-8 text-right shrink-0 font-medium">{count}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {hasHighlights && (
          <div className="space-y-6">
            {compliments.length > 0 && <HighlightCard title="Khách khen nhiều nhất" items={compliments} tone="good" />}
            {complaints.length > 0 && <HighlightCard title="Điểm khách hay góp ý" items={complaints} tone="bad" />}
          </div>
        )}
      </div>

      {/* ─── LỌC SAO NHANH ─── */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          onClick={() => changeFilter('all')}
          variant={starFilter === 'all' ? 'primary' : 'outline'}
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
              onClick={() => changeFilter(String(star))}
              variant={isActive ? 'primary' : 'outline'}
              size="sm"
              className={`inline-flex items-center gap-1.5 ${isActive ? 'shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              <span className="inline-flex items-center gap-1 leading-none">
                <span>{star}</span>
                <Star size={12} className={isActive ? 'fill-white text-white shrink-0' : 'fill-amber-400 text-amber-400 shrink-0'} />
              </span>
              <span className={isActive ? 'text-white/90' : 'text-slate-400'}>({count})</span>
            </Button>
          );
        })}
      </div>

      {/* ─── SẮP XẾP + LỌC ẢNH + ĐẾM KẾT QUẢ ─── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <ArrowDownUp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => changeSort(e.target.value)}
            className="appearance-none pl-8 pr-8 py-2 text-xs font-bold rounded-radius-lg bg-white border border-slate-200 text-slate-600 hover:border-md-primary/50 focus:border-md-primary focus:ring-2 focus:ring-md-primary/20 outline-none cursor-pointer transition-all"
          >
            {SORTS.map((so) => <option key={so.id} value={so.id}>{so.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={toggleImageOnly}
          disabled={withImageCount === 0}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-radius-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            imageOnly ? 'bg-md-primary text-white border-md-primary shadow-sm shadow-md-primary/25' : 'bg-white text-slate-600 border-slate-200 hover:border-md-primary/50'
          }`}
        >
          <Camera size={14} /> Có ảnh ({withImageCount})
        </button>

        <p className="ml-auto text-xs font-semibold text-slate-500">
          <span className="font-extrabold text-md-primary">{list.totalElements}</span> đánh giá
        </p>
      </div>

      {/* ─── DANH SÁCH ĐÁNH GIÁ (đọc-only) ─── */}
      {reviews.length === 0 ? (
        <Card variant="elevated" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col text-center py-16">
          <MessageSquareText size={44} className="mx-auto text-slate-300 mb-3.5 animate-float" />
          <p className="text-sm font-bold text-slate-600">Không có đánh giá nào khớp bộ lọc</p>
          <p className="text-xs text-slate-400 mt-1.5">Thử đổi mức sao, tắt lọc ảnh hoặc chọn cách sắp xếp khác.</p>
          {hasActiveControls && (
            <Button onClick={() => { setStarFilter('all'); setImageOnly(false); setSortBy('recent'); setPage(0); }} variant="text" size="sm" className="mt-3 text-md-primary">Xoá bộ lọc</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {reviews.map((rev, idx) => {
              const meta = metaFor(rev.rating);
              const Face = meta.face;
              return (
                <Card
                  key={rev.id}
                  variant="elevated"
                  style={{ animationDelay: `${idx * 55}ms` }}
                  className={`group bg-white rounded-2xl border shadow-sm p-4 md:p-5 flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 animate-rise-in ${loadingList ? 'opacity-60' : ''} border-slate-100`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 shadow-inner ${colorFor(rev.author)}`}>
                        {rev.author.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 leading-tight truncate">{rev.author}</h4>
                        <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">{rev.date}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.pill}`}>
                        <Face size={12} className="animate-star-pop group-hover:animate-bob" /> {meta.label}
                      </span>
                      <StarRow value={rev.rating} size={14} />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    {rev.comment ? (
                      <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">{rev.comment}</p>
                    ) : (
                      <p className="text-xs italic text-slate-400 px-1">Khách không để lại nhận xét.</p>
                    )}

                    {rev.images && rev.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {rev.images.map((imgUrl, index) => (
                          <div
                            key={index}
                            onClick={() => onImageClick(imgUrl)}
                            className="relative group/img w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-md-primary transition-all cursor-pointer shadow-sm"
                          >
                            <img src={imgUrl} alt={`Ảnh đánh giá ${index + 1}`} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"><ZoomIn size={16} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phản hồi từ quán (nếu có) — khách được xem, không sửa */}
                  {rev.reply && (
                    <div className="bg-md-primary/5 p-3.5 rounded-xl border border-md-primary/15 mt-3.5">
                      <span className="font-bold text-md-primary flex items-center gap-1.5 text-xs mb-1">
                        <Store size={14} /> Phản hồi từ quán
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed">{rev.reply}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
              <button
                onClick={() => setPage(Math.max(safePage - 1, 0))}
                disabled={safePage === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-500 mr-1">Trang {safePage + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(safePage + 1, totalPages - 1))}
                disabled={safePage >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { carts, addItem, updateQty, removeItem, restaurantShippingCache, fetchShippingForRestaurant } = useCartStore();
  const currentCart = carts.find(c => c.restaurantId === id) || { items: [], subtotal: 0 };
  const cartItems = currentCart.items;
  
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const { user } = useAuthStore();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favBurst, setFavBurst] = useState(false); // 1 nhịp animation khi vừa thả tim
  const [activeTab, setActiveTab] = useState('menu'); 
  const [activeCategory, setActiveCategory] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [addingIds, setAddingIds] = useState({}); 
  const reportModal = useModalState();
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const menuSectionsRef = useRef({});

  // State quản lý phóng to ảnh trong tab hiện tại (dùng chung cho lightbox ảnh đánh giá)
  const [selectedImage, setSelectedImage] = useState(null);

  // Lấy và tính toán phí ship, khoảng cách, thời gian
  const cachedShipping = restaurantShippingCache[id];
  const shippingFee = cachedShipping?.shippingFee || 0;
  const distance = cachedShipping ? `${cachedShipping.distanceKm.toFixed(1)}km` : '--';
  const durationMinutes = cachedShipping ? Math.round(cachedShipping.durationMinutes) : 0;
  const minDuration = Math.max(10, durationMinutes - 3);
  const maxDuration = Math.max(minDuration + 5, durationMinutes + 3);
  const durationText = cachedShipping ? `${minDuration}-${maxDuration} phút` : '--';

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        // Lấy thông tin nhà hàng, danh mục và món ăn
        const [resDetailResponse, categoryResponse, menuResponse] = await Promise.all([
          apiClient.get(`/restaurants/${id}`),
          apiClient.get(`/restaurants/${id}/categories`),
          apiClient.get(`/restaurants/${id}/foods`)
        ]);

        const realRes = resDetailResponse.data?.data;
        const realCategories = categoryResponse.data?.data || [];
        const realFoods = menuResponse.data?.data || [];

        if (realRes) {
          const cached = restaurantShippingCache[id];
          if (!cached) {
            const customerLat = user?.lat || 10.762622;
            const customerLng = user?.lng || 106.660172;
            fetchShippingForRestaurant(id, customerLat, customerLng);
          }

          // SỐ SAO & TỔNG ĐÁNH GIÁ lấy TOÀN CỤC từ BE (mapRestaurant → realRes.rating/reviewsCount).
          // Danh sách đánh giá do tab Đánh giá (ReviewsTab) tự nạp có lọc/sắp xếp/phân trang server-side.
          const mapped = mapRestaurant(realRes);
          const mappedRes = {
            ...mapped,
            ownerId: realRes.ownerId,
            phone: realRes.phone,
            openTime: (realRes.opensAt && realRes.closesAt) ? `${realRes.opensAt.substring(0, 5)} - ${realRes.closesAt.substring(0, 5)}` : '--',
          };

          // Map menu
          const mappedMenu = realCategories.map(cat => ({
            id: cat.categoryId,
            categoryName: cat.categoryName,
            items: realFoods
              .filter(food => food.categoryId === cat.categoryId)
              .map(food => ({
                id: food.id,
                name: food.foodName,
                price: Number(food.price),
                desc: food.description,
                image: food.imageUrl,
              }))
          })).filter(cat => cat.items.length > 0);

          setRestaurant(mappedRes);
          setMenu(mappedMenu);
          if (mappedMenu.length > 0) {
            setActiveCategory(mappedMenu[0].id);
          }
        } else {
          setErrorMsg('Không tìm thấy thông tin chi tiết nhà hàng này trong Database.');
        }
      } catch (error) {
        console.error('Lỗi khi tải chi tiết quán từ Backend:', error);
        setErrorMsg('Không thể kết nối với máy chủ Backend để tải thông tin nhà hàng.');
      } finally {
        setLoading(false);
      }
    };

    const fetchFavoriteStatus = async () => {
      try {
        const response = await apiClient.get('/favorites');
        const favs = response.data?.data || [];
        setIsFavorite(favs.some(f => f.restaurantId.toString() === id.toString()));
      } catch (err) {
        console.warn('Lỗi khi kiểm tra yêu thích:', err);
      }
    };

    fetchDetails();
    fetchFavoriteStatus();
  }, [id, user?.lat, user?.lng]);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  //thêm vào giỏ hàng
  const handleAddToCart = (item) => {
    if (!restaurant) return;
    addItem(item);
  };

  //chat 
  const handleChatWithMerchant = async () => {
    if (!restaurant) return;
    const convId = await startNewConversation(restaurant.ownerId, restaurant.restaurantName, restaurant.image, 'MERCHANT');
    if (convId) {
      navigate(`/chat/${convId}`);
    }
  };

  const getItemQty = (foodId) => {
    const found = cartItems.find((i) => Number(i.foodId) === Number(foodId));
    return found ? found.quantity : 0;
  };

  // Scroll to menu category section
  const scrollToCategory = (catId) => {
    setActiveCategory(catId);
    const element = document.getElementById(`category-${catId}`);
    if (element) {
      const offset = 140; 
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Thêm hoặc bỏ nhà hàng khỏi danh sách yêu thích.
  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await apiClient.delete(`/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await apiClient.post(`/favorites/${id}`);
        setIsFavorite(true);
        setFavBurst(true);
        setTimeout(() => setFavBurst(false), 650); // 1 nhịp bung vòng lan toả
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật yêu thích:', err);
    }
  };

  //Báo cáo vi phạm
  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      toast.warn('Vui lòng nhập lý do báo cáo vi phạm!');
      return;
    }
    if (reportReason.trim().length < 10) {
      toast.warn('Nội dung báo cáo phải chi tiết tối thiểu 10 ký tự!');
      return;
    }
    
    setSubmittingReport(true);
    try {
      await apiClient.post('/reports', {
        targetType: 'RESTAURANT',
        targetId: Number(id),
        reason: reportReason.trim()
      });
      toast.success('Báo cáo vi phạm đã được gửi thành công!');
      reportModal.close();
      setReportReason('');
    } catch (err) {
      console.error('Lỗi gửi báo cáo vi phạm:', err);
      toast.error('Không thể gửi báo cáo vi phạm. Vui lòng thử lại sau!');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen />;
  }

  if (errorMsg || !restaurant) {
    return (
      <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Star size={28} />
        </div>
        <h2 className="text-xl font-bold text-md-on-surface">Không tìm thấy quán ăn</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">{errorMsg || 'Quán ăn không tồn tại hoặc đã bị xóa.'}</p>
        <Button onClick={() => navigate('/')} size="md" className="mt-6">
          Quay lại trang chủ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 font-google-sans bg-md-surface pb-24 relative">
      
      <div className="relative h-56 xs:h-64 sm:h-76 md:h-84 overflow-hidden w-full bg-slate-900 z-0">
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-75 scale-105"
          style={{ 
            backgroundImage: `url(${restaurant.image})`,
            transform: `translateY(${scrollY * 0.4}px)` 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/20" />
        
        {/* Nav Controls */}
        <div className="absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 flex items-center justify-between z-10">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="w-11 h-11 !p-0 border-none rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform"
          >
            <ArrowLeft size={22} />
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFavorite}
              className="group relative w-11 h-11 !p-0 border-none rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 active:scale-95 transition-transform"
              title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              {/* Vòng đỏ lan toả khi vừa thả tim */}
              {favBurst && (
                <span className="absolute inset-0 rounded-radius-full bg-red-400/50 animate-heart-burst pointer-events-none" />
              )}
              <Heart
                key={isFavorite ? 'fav' : 'unfav'}
                size={20}
                className={`relative transition-colors duration-200 ${
                  isFavorite
                    ? 'text-red-500 fill-red-500 ' + (favBurst ? 'animate-heart-pop' : 'animate-heart-beat')
                    : 'text-md-on-surface-variant group-hover:text-red-400 group-hover:scale-110'
                }`}
              />
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="w-11 h-11 !p-0 border-none rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform"
            >
              <Share2 size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── thông tin quán ăn ────────────────── */}
      <div className="px-4 sm:px-6 max-w-5xl mx-auto -mt-14 relative z-10">
        <Card variant="glass" className="p-4 sm:p-6 md:p-8 shadow-shadow-3 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl xs:text-2xl md:text-3xl font-extrabold text-md-on-surface tracking-tight leading-snug">
                {restaurant.name}
              </h1>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 mt-3 xs:mt-4.5 text-xs md:text-sm font-bold text-md-on-surface-variant">
                <span className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-radius-md shadow-sm">
                  <span className="font-black text-amber-500 text-sm md:text-base leading-none">{restaurant.rating}</span>
                  <StarRow value={restaurant.rating} size={13} />
                  <span className="text-amber-600/70 font-semibold">({restaurant.reviewsCount} đánh giá)</span>
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-radius-sm text-md-on-surface-variant transition-colors hover:bg-slate-200/70">
                  <Clock size={16} className="text-md-primary" />
                  {durationText}
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-radius-sm text-md-on-surface-variant transition-colors hover:bg-slate-200/70">
                  <MapPin size={16} className="text-md-primary" /> {distance}
                </span>
              </div>
            </div>

            <div className="flex flex-row gap-3 self-center sm:self-start w-full sm:w-auto shrink-0">
              <Button 
                variant="outline"
                onClick={handleChatWithMerchant}
                icon={MessageSquare}
                className="bg-md-primary/10 hover:bg-md-primary/20 text-md-primary font-bold flex-1 sm:w-auto px-3 whitespace-nowrap"
              >
                Chat với quán
              </Button>
              <Button
                variant="outline"
                onClick={() => reportModal.open()}
                icon={AlertTriangle}
                className="border-red-200 hover:border-red-300 text-red-500 hover:bg-red-50 font-bold flex-1 sm:w-auto shrink-0 px-3 whitespace-nowrap"
              >
                Báo cáo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 pt-6 border-t border-md-outline-variant/30 text-left">
            {[
              { icon: MapPin, color: 'text-rose-600 bg-rose-50', label: 'Địa chỉ', value: restaurant.address },
              { icon: Clock, color: 'text-blue-600 bg-blue-50', label: 'Mở cửa', value: restaurant.openTime },
              { icon: Phone, color: 'text-violet-600 bg-violet-50', label: 'Điện thoại', value: restaurant.phone },
              { icon: Bike, color: 'text-emerald-600 bg-emerald-50', label: 'Phí ship', value: `Từ ${formatCurrency(shippingFee)}`, accent: true },
            ].map((row, idx) => {
              const RowIcon = row.icon;
              return (
                <div key={idx} className="flex items-center gap-2.5 min-w-0 rounded-radius-md bg-slate-50/70 hover:bg-slate-100/70 transition-colors px-2.5 py-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${row.color}`}><RowIcon size={15} /></span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-black text-md-outline uppercase tracking-wide leading-none">{row.label}</span>
                    <span className={`block text-xs md:text-sm font-bold truncate mt-0.5 ${row.accent ? 'text-md-primary' : 'text-md-on-surface'}`}>{row.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ─── STICKY TAB BAR (Menu | Đánh giá | Thông tin) ───────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-md-outline-variant/40 z-20 shadow-sm mt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-around">
          {[
            { id: 'menu', name: 'Thực đơn', icon: Utensils, badge: menu.reduce((s, c) => s + c.items.length, 0) },
            { id: 'reviews', name: 'Đánh giá', icon: Star, badge: restaurant.reviewsCount },
            { id: 'info', name: 'Thông tin', icon: Info, badge: null }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group py-3 px-3 sm:py-4.5 sm:px-8 text-sm sm:text-base font-extrabold border-b-[3px] transition-all flex items-center gap-2 ${
                  isActive
                    ? 'border-md-primary text-md-primary'
                    : 'border-transparent text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <TabIcon size={17} className={`transition-transform ${isActive ? 'scale-110 -rotate-6' : 'group-hover:scale-110'} ${isActive && tab.id === 'reviews' ? 'fill-md-primary' : ''}`} />
                {tab.name}
                {tab.badge > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                    isActive ? 'bg-md-primary text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB CONTENT: MENU ─────────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 flex flex-col md:flex-row gap-8" id="menu-content-start">
          {/* danh mục */}
          <aside className="w-full md:w-52 shrink-0 md:sticky md:top-24 z-10 py-1 md:py-2.5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-md-outline-variant/30">
              <h3 className="text-xs font-black text-md-on-surface uppercase tracking-[0.2em]">
                Danh mục
              </h3>
            </div>
            
            <div className="flex md:flex-col flex-row gap-2 overflow-x-auto md:overflow-visible no-scrollbar pb-3 md:pb-0 border-b md:border-none border-md-outline-variant/10">
              {menu.map((sec) => {
                const isActive = activeCategory === sec.id;
                return (
                  <button
                    key={sec.id} 
                    onClick={() => scrollToCategory(sec.id)}
                    className={`shrink-0 md:shrink md:w-full text-left transition-all duration-300 ease-in-out font-google-sans cursor-pointer 
                      ${isActive 
                        ? 'bg-md-primary text-white shadow-md shadow-md-primary/25 border-md-primary font-bold md:translate-x-2' 
                        : 'bg-white hover:bg-slate-50 border border-slate-200 md:border-transparent text-md-on-surface-variant hover:text-md-on-surface md:hover:translate-x-2'
                      } 
                      px-4 py-2 md:py-3 rounded-full md:rounded-xl text-xs md:text-sm flex items-center justify-between gap-2`}
                  >
                    <span className="truncate">{sec.categoryName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sec.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* danh sách món ăn */}
          <div className="flex-1 space-y-10">
            {menu
              .filter((sec) => sec.id === activeCategory)
              .map((sec) => (
                <div 
                  key={sec.id} 
                  id={`category-${sec.id}`}
                  ref={(el) => (menuSectionsRef.current[sec.id] = el)}
                  className="scroll-mt-28 sm:scroll-mt-36"
                >
                  <h3 className="text-sm sm:text-base font-extrabold text-md-on-surface border-b border-md-outline-variant/35 pb-3 mb-6 uppercase tracking-wider flex items-center justify-between">
                    <span>{sec.categoryName}</span>
                    <span className="text-xs text-md-on-surface-variant font-medium normal-case">
                      Có {sec.items.length} món
                    </span>
                  </h3>
                  
                  <div className="space-y-4 sm:space-y-5">
                    {sec.items.map((item, itemIdx) => {
                      const qty = getItemQty(item.id);
                      return (
                        <Card
                          key={item.id}
                          variant="flat"
                          className={`group p-3 sm:p-4.5 flex gap-3 sm:gap-5 animate-rise-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${qty > 0 ? 'ring-1 ring-md-primary/30 bg-orange-50/30' : ''}`}
                          style={{ animationDelay: `${itemIdx * 55}ms` }}
                        >
                          <div className="relative w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 rounded-radius-md overflow-hidden shrink-0 shadow-sm">
                             <img
                               src={getFoodImageUrl(item.image)}
                               alt={item.name}
                               onError={(e) => { e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                               className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                             />
                             {qty > 0 && (
                               <span className="absolute top-1 left-1 bg-md-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-scale-up">×{qty}</span>
                             )}
                          </div>

                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <h4 className="font-extrabold text-sm xs:text-base md:text-lg text-md-on-surface truncate leading-snug">
                                {item.name}
                              </h4>
                              <p className="text-[11px] xs:text-xs md:text-sm text-md-on-surface-variant leading-relaxed line-clamp-2 mt-1 xs:mt-2 font-medium">
                                {item.desc}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2.5 xs:mt-3">
                              <span className="font-extrabold text-sm xs:text-base md:text-lg text-md-primary">
                                {formatCurrency(item.price)}
                              </span>

                              {/* thêm món vào giỏ hàng */}
                              <div className="shrink-0">
                                {qty > 0 ? (
                                  <div className="flex items-center bg-md-primary text-white rounded-radius-full py-1 px-2.5 xs:py-1.5 xs:px-3.5 gap-2 xs:gap-3.5 shadow-shadow-2">
                                    <button 
                                      onClick={() => updateQty(item.id, qty, qty - 1)}
                                      className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform"
                                    >
                                      <Minus size={14} className="stroke-[3px] xs:size-[16px]" />
                                    </button>
                                    <span className="text-xs xs:text-sm font-extrabold min-w-4 xs:min-w-5 text-center">{qty}</span>
                                    <button 
                                      onClick={() => updateQty(item.id, qty, qty + 1)}
                                      className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform"
                                    >
                                      <Plus size={14} className="stroke-[3px] xs:size-[16px]" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddToCart(item)}
                                    className="w-8 h-8 xs:w-10 xs:h-10 !p-0 rounded-radius-full border border-md-primary/30 text-md-primary hover:bg-md-primary hover:text-white transition-all duration-200 shrink-0"
                                  >
                                    <Plus size={18} className="stroke-[2.5px] xs:size-[20px]" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {/* giỏ hàng */}
          <aside className="hidden xl:block w-80 shrink-0 sticky top-24 self-start">
            <Card variant="elevated" className="p-5">
              <h3 className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider flex items-center justify-between gap-1.5 mb-3">
                <span className="flex items-center gap-1.5"><ShoppingBag size={15} className="text-md-primary" /> Giỏ hàng</span>
                {cartItems.length > 0 && (
                  <span className="text-[10px] font-black text-white bg-md-primary px-2 py-0.5 rounded-full">{cartItems.reduce((s, i) => s + i.quantity, 0)} món</span>
                )}
              </h3>

              {cartItems.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center py-4 gap-2.5 rounded-radius-lg bg-gradient-to-b from-orange-50/70 to-transparent border border-dashed border-orange-200">
                    <span className="w-14 h-14 rounded-radius-full bg-white text-md-primary flex items-center justify-center shadow-sm animate-float">
                      <ShoppingBag size={24} />
                    </span>
                    <p className="text-xs text-md-on-surface-variant font-bold px-4">Giỏ hàng trống<br /><span className="font-medium text-md-outline">Chọn món từ thực đơn để bắt đầu</span></p>
                  </div>

                  {/* Thông tin giao hàng thực tế — lấp khoảng trống bằng dữ liệu hữu ích */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-black text-md-outline uppercase tracking-wider px-1">Giao đến khu vực bạn</span>
                    {[
                      { icon: Timer, color: 'text-orange-600 bg-orange-50', label: 'Thời gian dự kiến', value: durationText },
                      { icon: MapPin, color: 'text-rose-600 bg-rose-50', label: 'Khoảng cách', value: distance },
                      { icon: Bike, color: 'text-emerald-600 bg-emerald-50', label: 'Phí giao hàng', value: `Từ ${formatCurrency(shippingFee)}` },
                      { icon: Wallet, color: 'text-violet-600 bg-violet-50', label: 'Thanh toán', value: 'Khi nhận hàng (COD)' },
                    ].map((row, idx) => {
                      const RowIcon = row.icon;
                      return (
                        <div key={idx} className="flex items-center gap-2.5 rounded-radius-md bg-slate-50/80 px-2.5 py-2">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${row.color}`}><RowIcon size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] text-md-outline font-bold leading-none">{row.label}</span>
                            <span className="block text-xs font-extrabold text-md-on-surface truncate mt-0.5">{row.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs gap-3 animate-rise-in">
                        <div className="flex flex-col truncate pr-2">
                          <span className="text-md-on-surface font-semibold truncate">{item.name}</span>
                          <span className="text-md-outline truncate">{formatCurrency(item.price)} × {item.quantity}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-md-on-surface">
                            {formatCurrency((item.price || 0) * item.quantity)}
                          </span>
                          <button 
                            onClick={() => removeItem(item.cartItemId)} 
                            className="p-1.5 rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all duration-200 cursor-pointer"
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                    <span className="text-xs font-bold text-md-on-surface-variant">Tạm tính</span>
                    <span className="text-base font-extrabold text-md-primary">{formatCurrency(currentCart?.subtotal || 0)}</span>
                  </div>

                  <Button 
                    onClick={() => navigate('/cart', { state: { targetRestaurantId: restaurant.id } })} 
                    className="w-full mt-4"
                  >
                    Xem giỏ hàng &amp; đặt
                  </Button>
                </>
              )}
            </Card>
          </aside>

        </div>
      )}

      {/* ─── TAB CONTENT: REVIEWS ──────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <ReviewsTab
          restaurantId={id}
          globalRating={restaurant.rating}
          globalCount={restaurant.reviewsCount}
          restaurantName={restaurant.name}
          onImageClick={setSelectedImage}
        />
      )}

      {/* ─── TAB CONTENT: INFO ─────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-5">
          {/* Giới thiệu quán */}
          <Card variant="elevated" className="p-5 sm:p-6.5 animate-rise-in">
            <h3 className="font-extrabold text-base md:text-lg text-md-on-surface flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center shadow-sm"><Info size={16} /></span>
              Giới thiệu quán
            </h3>
            <p className="text-xs md:text-sm text-md-on-surface-variant leading-relaxed mt-3.5 font-medium">
              {restaurant.description || 'Quán chưa cập nhật giới thiệu.'}
            </p>
          </Card>

          {/* Thông tin dịch vụ — thẻ icon */}
          <div>
            <h3 className="font-extrabold text-sm text-md-on-surface uppercase tracking-wider mb-3 px-1">Thông tin dịch vụ</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Timer, color: 'text-orange-600 bg-orange-50', label: 'Chuẩn bị TB', value: '10-15 phút' },
                { icon: Bike, color: 'text-emerald-600 bg-emerald-50', label: 'Giao tối đa', value: '7.0 km' },
                { icon: Truck, color: 'text-blue-600 bg-blue-50', label: 'Phí ship từ', value: formatCurrency(shippingFee) },
                { icon: Wallet, color: 'text-purple-600 bg-purple-50', label: 'Thanh toán', value: 'COD' },
              ].map((it, idx) => {
                const ItIcon = it.icon;
                return (
                  <Card key={idx} variant="flat" className="p-3.5 flex flex-col items-center text-center gap-2 animate-rise-in hover:-translate-y-0.5 hover:shadow-md transition-all" style={{ animationDelay: `${idx * 60}ms` }}>
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${it.color}`}><ItIcon size={19} /></span>
                    <span className="text-[10px] text-md-outline font-bold uppercase tracking-wide">{it.label}</span>
                    <span className="text-xs sm:text-sm font-extrabold text-md-on-surface leading-tight">{it.value}</span>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Liên hệ & địa chỉ */}
          <Card variant="elevated" className="p-5 sm:p-6.5 space-y-3.5 animate-rise-in">
            <h3 className="font-extrabold text-sm text-md-on-surface uppercase tracking-wider">Liên hệ &amp; địa chỉ</h3>
            {[
              { icon: MapPin, label: 'Địa chỉ', value: restaurant.address },
              { icon: Clock, label: 'Giờ mở cửa', value: restaurant.openTime },
              { icon: Phone, label: 'Điện thoại', value: restaurant.phone },
            ].map((row, idx) => {
              const RowIcon = row.icon;
              return (
                <div key={idx} className="flex items-start gap-3 text-xs md:text-sm">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-md-primary flex items-center justify-center shrink-0"><RowIcon size={15} /></span>
                  <div className="min-w-0">
                    <span className="text-[10px] text-md-outline font-bold uppercase tracking-wide block">{row.label}</span>
                    <span className="font-semibold text-md-on-surface break-words">{row.value}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* ─── FLOATING CART BOTTOM BAR (Shows when there is item in cart) ────────── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-3 xs:p-5 bg-white/80 backdrop-blur-md border-t border-md-outline-variant/30 flex justify-center z-50 shadow-shadow-4 xl:hidden">
          <div className="w-full max-w-5xl flex items-center justify-between bg-md-primary text-white px-4 py-3 xs:px-6 xs:py-4.5 rounded-radius-full shadow-shadow-4 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer" onClick={() => navigate('/cart', { state: { targetRestaurantId: restaurant.id } })}>
            <div className="flex items-center gap-3 xs:gap-4 min-w-0">
              <div className="relative shrink-0">
                <ShoppingBag size={20} className="xs:size-[24px]" />
                <span className="absolute -top-1.5 -right-2 bg-md-error text-white text-[9px] xs:text-[10px] font-extrabold h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border border-md-primary shadow-md">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 xs:gap-3 shrink-0">
              <span className="text-sm xs:text-lg font-extrabold">
                {formatCurrency(currentCart.subtotal || 0)}
              </span>
              <span className="text-[10px] xs:text-sm font-extrabold bg-white/20 hover:bg-white/30 px-2.5 py-1 xs:px-4 xs:py-1.5 rounded-full transition-colors">
                Xem giỏ hàng và đặt
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL BÁO CÁO VI PHẠM ────────────────────────────────────────────── */}
      <Modal
        isOpen={reportModal.isOpen}
        onClose={() => reportModal.close()}
        title="Báo Cáo Vi Phạm"
        size="sm"
        className="[&_h2]:!text-slate-900 [&_h2]:!text-base [&_h2]:md:!text-lg [&_h2]:!font-bold [&_button]:disabled:opacity-50"
      >
        <div className="space-y-4 text-slate-700 !-mt-3">

          {/* Thông báo */}
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-100 flex items-start gap-2">
            <AlertCircle
              className="shrink-0 mt-0.5 text-amber-600"
              size={15}
            />
            <span>
              Báo cáo vi phạm sẽ được gửi tới Quản trị viên hệ thống để kiểm tra và xử lý.
            </span>
          </div>

          {/* Lý do mẫu */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Chọn lý do nhanh:
            </span>

            <div className="grid grid-cols-1 gap-1.5">
              {[
                'Quán ăn có thông tin giả mạo / địa chỉ ảo',
                'Thực đơn chứa món ăn không hợp vệ sinh / có dị vật',
                'Thái độ phục vụ của quán rất tệ',
                'Giá cả thực tế khác xa giá hiển thị trên app',
              ].map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={`text-left px-3.5 py-2 border rounded-lg text-xs font-semibold transition-all ${
                    reportReason === reason
                      ? 'border-orange-500 bg-orange-50/50 text-orange-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Nhập tự do */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Hoặc nhập lý do cụ thể:
            </span>

            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Nhập nội dung chi tiết..."
              rows={3}
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-slate-50/50 text-slate-800 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason.trim()}
              className="!px-5 !py-2 !text-xs !font-bold !bg-orange-500 !text-white !rounded-lg hover:!bg-orange-600 disabled:!bg-slate-300 mb-0"
            >
              {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </div>
      </Modal>

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

