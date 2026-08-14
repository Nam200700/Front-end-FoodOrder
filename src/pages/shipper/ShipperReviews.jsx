import React, { useState, useEffect, useMemo } from 'react';
import { Star, X, ChevronLeft, ChevronRight, ZoomIn, ThumbsUp, Sparkles, TrendingUp, ArrowDownUp, Camera, Award, MessageSquareText, ChevronDown, Frown, Meh, Smile, Laugh, AlertTriangle } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import Spinner from '../../components/common/Spinner';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

// Màu avatar theo chữ cái đầu (đa dạng cho sinh động, không dùng 1 màu duy nhất)
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
];
const colorFor = (name) => AVATAR_COLORS[((name || '?').charCodeAt(0) || 0) % AVATAR_COLORS.length];

// Nhãn cảm xúc theo số sao — ĐỒNG BỘ với trang đánh giá của customer (Reviews.jsx): mặt phản ứng + pill màu.
const RATING_META = {
  1: { label: 'Tệ', pill: 'bg-red-50 text-red-600 border-red-200', face: Frown },
  2: { label: 'Không hài lòng', pill: 'bg-orange-50 text-orange-600 border-orange-200', face: Frown },
  3: { label: 'Bình thường', pill: 'bg-amber-50 text-amber-600 border-amber-200', face: Meh },
  4: { label: 'Hài lòng', pill: 'bg-lime-50 text-lime-700 border-lime-200', face: Smile },
  5: { label: 'Tuyệt vời', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', face: Laugh },
};
const metaFor = (rating) => RATING_META[Math.min(5, Math.max(1, Math.round(rating)))] || RATING_META[5];

// Việc phân loại KHEN / CẦN CẢI THIỆN nay gộp ở SERVER (ReviewService.shipperReviewSummary)
// → summary trả sẵn compliments/complaints, FE không phải tải hết đánh giá để tự tính.

// Card đám chip highlight dùng chung cho cả Khen (xanh) lẫn Cần cải thiện (hổ phách).
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
      <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
        <HeadIcon size={15} className={good ? 'text-md-tertiary' : 'text-amber-500'} /> {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((c, i) => {
          const strong = c.count >= Math.max(2, max * 0.6);
          const ChipIcon = good ? ThumbsUp : AlertTriangle;
          const strongCls = good
            ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9] shadow-sm'
            : 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm';
          const badgeCls = good
            ? (strong ? 'bg-md-tertiary text-white' : 'bg-slate-100 text-slate-500')
            : (strong ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500');
          return (
            <span
              key={c.text}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border animate-rise-in transition-transform hover:scale-105 ${
                strong ? strongCls : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              <ChipIcon size={12} className={strong ? (good ? 'text-md-tertiary' : 'text-amber-500') : 'text-slate-400'} />
              {c.text}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeCls}`}>{c.count}</span>
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// Hàng 5 sao: sao đạt được "pop" lần lượt khi hiện, phóng nhẹ khi hover card.
function StarRow({ rating, size = 15 }) {
  const r = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          style={{ animationDelay: `${s * 70}ms` }}
          className={`transition-transform duration-300 group-hover:scale-110 ${
            s <= r ? 'fill-amber-400 text-amber-400 animate-star-pop' : 'text-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Đếm tăng dần cho điểm trung bình (0 → target). Tôn trọng prefers-reduced-motion.
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion() || !target) { setVal(target); return; }
    let raf; const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const SORTS = [
  { id: 'recent', label: 'Mới nhất' },
  { id: 'oldest', label: 'Cũ nhất' },
  { id: 'high', label: 'Sao cao nhất' },
  { id: 'low', label: 'Sao thấp nhất' },
];

// Map id sắp xếp FE → tham số Spring Sort (server-side).
const SORT_PARAM = { recent: 'createdAt,desc', oldest: 'createdAt,asc', high: 'shipperRating,desc', low: 'shipperRating,asc' };

export default function ShipperReviews() {
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [imageOnly, setImageOnly] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [page, setPage] = useState(0);
  const size = 8; // mỗi trang — KHÔNG tải hết một lượt

  const mapRev = (rev) => ({
    id: rev.reviewId.toString(),
    author: rev.customerName || 'Khách hàng',
    rating: rev.shipperRating || 5,
    date: new Date(rev.createdAt).toLocaleDateString('vi-VN') + ' ' + new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    comment: rev.shipperComment || '',
    images: rev.images || [],
  });

  // ─── TÓM TẮT: gộp TOÀN BỘ ở server (điểm TB, phân bố sao, % hài lòng, 30 ngày, lời khen/phàn nàn) ───
  const { data: summary, loading: loadingSummary, error: errorSummary, refetch: refetchSummary } =
    useFetchData('/shipper/reviews/summary', { mapFn: (d) => d });

  // ─── DANH SÁCH: phân trang THẬT ở server + lọc sao/ảnh + sắp xếp (payload nhỏ, không nghẽn) ───
  const listUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size), sort: SORT_PARAM[sortBy] || SORT_PARAM.recent });
    if (starFilter !== 'all') p.append('star', starFilter);
    if (imageOnly) p.append('imageOnly', 'true');
    return `/shipper/reviews?${p.toString()}`;
  }, [page, sortBy, starFilter, imageOnly]);
  const { data: listData, loading: loadingList, error: errorList, refetch: refetchList } =
    useFetchData(listUrl, {
      mapFn: (d) => ({
        items: (d?.content || []).map(mapRev),
        totalPages: Math.max(1, d?.totalPages || 1),
        totalElements: d?.totalElements ?? 0,
      }),
    });

  const errorReviews = errorSummary || errorList;
  const refetch = () => { refetchSummary(); refetchList(); };

  // ─── Số liệu tổng quan lấy từ summary (không tự tính client trên 1000 dòng) ───
  const s = summary || {};
  const totalReviews = s.total || 0;
  const avgRating = Number(s.avg || 0);
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
  const filteredReviews = list.items;
  const totalPages = list.totalPages;
  const safePage = Math.min(page, totalPages - 1);

  const loading = loadingSummary || loadingList;

  // các setter đổi bộ lọc/sắp xếp đều về trang đầu
  const changeFilter = (v) => { setStarFilter(v); setPage(0); };
  const changeSort = (v) => { setSortBy(v); setPage(0); };
  const toggleImageOnly = () => { setImageOnly((v) => !v); setPage(0); };
  const hasActiveControls = starFilter !== 'all' || imageOnly || sortBy !== 'recent';

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

  if (loading && !summary && !listData) {
    return (
      <div className="flex-1 p-6 md:p-8 max-w-3xl mx-auto w-full font-google-sans"><Spinner /></div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans space-y-6 pb-24">

      {/* ─── HERO XANH SHIPPER: điểm TB đếm tăng dần + sao + chỉ số hài lòng ─── */}
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-[#2E7D32] to-md-tertiary text-white p-6 md:p-7 shadow-shadow-2 animate-rise-in">
        <Star className="absolute -right-6 -bottom-7 text-white/10 fill-white/10" size={150} strokeWidth={1} />
        <Sparkles className="absolute right-24 top-6 text-white/25 animate-twinkle" size={20} />
        <Sparkles className="absolute right-10 bottom-8 text-white/15 animate-twinkle" size={13} style={{ animationDelay: '700ms' }} />
        <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
          {/* Điểm trung bình lớn */}
          <div className="flex flex-col items-center sm:items-start shrink-0 sm:border-r sm:border-white/20 sm:pr-7">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              <Star size={11} className="fill-white" /> Đánh giá của tôi
            </span>
            <div className="flex items-end gap-2">
              <span className="text-5xl md:text-6xl font-black leading-none tracking-tight tabular-nums">
                {totalReviews ? animatedAvg.toFixed(1) : '—'}
              </span>
              <span className="text-white/70 text-sm font-bold mb-1.5">/ 5</span>
            </div>
            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={17}
                  className={`${s <= Math.round(avgRating) ? 'fill-amber-300 text-amber-300' : 'text-white/30'} ${s <= Math.round(avgRating) ? 'animate-star-pop' : ''}`}
                  style={{ animationDelay: `${s * 90}ms` }}
                />
              ))}
            </div>
            <span className="text-[12px] text-white/85 font-semibold mt-2">
              {totalReviews} lượt đánh giá từ khách hàng
            </span>
          </div>

          {/* Chỉ số hài lòng + 30 ngày gần đây */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="rounded-radius-lg bg-white/12 backdrop-blur-sm px-3.5 py-3 border border-white/15">
              <div className="flex items-center gap-1.5 text-white/85 text-[10px] font-bold uppercase tracking-wide">
                <ThumbsUp size={13} /> Hài lòng
              </div>
              <p className="text-2xl font-black mt-1 leading-none">{satisfaction}<span className="text-base font-bold">%</span></p>
              <p className="text-[10px] text-white/70 font-semibold mt-1">{positiveCount}/{totalReviews} đạt 4–5★</p>
            </div>
            <div className="rounded-radius-lg bg-white/12 backdrop-blur-sm px-3.5 py-3 border border-white/15">
              <div className="flex items-center gap-1.5 text-white/85 text-[10px] font-bold uppercase tracking-wide">
                <TrendingUp size={13} /> 30 ngày qua
              </div>
              <p className="text-2xl font-black mt-1 leading-none flex items-center gap-1">
                {recentCount ? recentAvg.toFixed(1) : '—'}
                {recentCount > 0 && <Star size={15} className="fill-amber-300 text-amber-300" />}
              </p>
              <p className="text-[10px] text-white/70 font-semibold mt-1">{recentCount} đánh giá gần đây</p>
            </div>
          </div>
        </div>
      </div>

      {totalReviews === 0 ? (
        <Card variant="elevated" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col text-center py-16">
          <Star size={48} className="mx-auto text-slate-300 mb-3.5" />
          <p className="text-sm font-bold text-slate-600">Bạn chưa có đánh giá nào</p>
          <p className="text-xs text-slate-400 mt-1.5">Hoàn thành các chuyến giao để nhận đánh giá từ khách hàng nhé!</p>
        </Card>
      ) : (
        <>
          {/* ─── HÀNG TỔNG QUAN: Phân bố sao | (Khen + Cần cải thiện xếp dọc) ─── */}
          <div className={`grid gap-6 items-start ${hasHighlights ? 'lg:grid-cols-2' : ''}`}>
            {/* ─── PHÂN BỐ SAO (bấm để lọc) ─── */}
            <Card variant="elevated" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 h-full">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-3.5">
                <Award size={15} className="text-amber-500" /> Phân bố đánh giá
              </h2>
              <div className="space-y-2">
                {ratingDist.map(({ star, count, pct }) => {
                  const isActive = starFilter === String(star);
                  return (
                    <button
                      key={star}
                      onClick={() => changeFilter(isActive ? 'all' : String(star))}
                      className={`w-full flex items-center gap-3 text-xs font-bold rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                        isActive ? 'bg-amber-100/60 text-amber-900 ring-1 ring-amber-300' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                      title={`Lọc đánh giá ${star} sao`}
                    >
                      <span className="flex items-center gap-1 w-8 shrink-0">
                        {star} <Star size={12} className="fill-amber-400 text-amber-400" />
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-slate-400 w-8 text-right shrink-0 font-medium">{count}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* ─── CỘT PHẢI: Lời khen (xanh) + Điểm cần cải thiện (hổ phách) ─── */}
            {hasHighlights && (
              <div className="space-y-6">
                {compliments.length > 0 && (
                  <HighlightCard title="Lời khen phổ biến từ khách" items={compliments} tone="good" />
                )}
                {complaints.length > 0 && (
                  <HighlightCard title="Điểm cần cải thiện" items={complaints} tone="bad" />
                )}
              </div>
            )}
          </div>

          {/* ─── NÚT LỌC SAO NHANH ─── */}
          <div className="flex gap-2 flex-wrap items-center pt-1">
            <Button
              onClick={() => changeFilter('all')}
              variant={starFilter === 'all' ? 'secondary' : 'outline'}
              size="sm"
              className={starFilter === 'all' ? '!bg-emerald-600 !border-emerald-600 !text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
            >
              Tất cả ({totalReviews})
            </Button>
            {ratingDist.map(({ star, count }) => {
              const isActive = starFilter === String(star);
              return (
                <Button
                  key={star}
                  onClick={() => changeFilter(String(star))}
                  variant={isActive ? 'secondary' : 'outline'}
                  size="sm"
                  className={`inline-flex items-center gap-1.5 ${isActive ? '!bg-emerald-600 !border-emerald-600 !text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
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

          {/* ─── THANH SẮP XẾP + LỌC ẢNH + ĐẾM KẾT QUẢ ─── */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sắp xếp */}
            <div className="relative">
              <ArrowDownUp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-xs font-bold rounded-radius-lg bg-white border border-slate-200 text-slate-600 hover:border-md-tertiary/50 focus:border-md-tertiary focus:ring-2 focus:ring-md-tertiary/20 outline-none cursor-pointer transition-all"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Lọc chỉ review có ảnh */}
            <button
              onClick={toggleImageOnly}
              disabled={withImageCount === 0}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-radius-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                imageOnly
                  ? 'bg-md-tertiary text-white border-md-tertiary shadow-sm shadow-md-tertiary/25'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-md-tertiary/50'
              }`}
            >
              <Camera size={14} /> Có ảnh ({withImageCount})
            </button>

            <p className="ml-auto text-xs font-semibold text-slate-500">
              <span className="font-extrabold text-md-tertiary">{list.totalElements}</span> đánh giá
            </p>
          </div>

          {/* ─── DANH SÁCH ĐÁNH GIÁ ─── */}
          {filteredReviews.length === 0 ? (
            <Card variant="elevated" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col text-center py-16">
              <MessageSquareText size={44} className="mx-auto text-slate-300 mb-3.5 animate-float" />
              <p className="text-sm font-bold text-slate-600">Không có đánh giá nào khớp bộ lọc</p>
              <p className="text-xs text-slate-400 mt-1.5">Thử đổi mức sao, tắt lọc ảnh hoặc chọn cách sắp xếp khác.</p>
              {hasActiveControls && (
                <Button onClick={() => { setStarFilter('all'); setImageOnly(false); setSortBy('recent'); setPage(0); }} variant="text" size="sm" className="mt-3 text-emerald-600">
                  Xoá bộ lọc
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {filteredReviews.map((rev, idx) => (
                  <Card
                    key={rev.id}
                    variant="elevated"
                    style={{ animationDelay: `${idx * 55}ms` }}
                    className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 animate-rise-in"
                  >
                    {/* Header: avatar màu + tên + ngày + số sao */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 shadow-inner ${colorFor(rev.author)}`}>
                          {rev.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-800 leading-tight truncate">{rev.author}</h3>
                          <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">{rev.date}</span>
                        </div>
                      </div>
                      {/* Cảm xúc theo sao (đồng bộ customer) + hàng sao có animation */}
                      {(() => {
                        const meta = metaFor(rev.rating);
                        const Face = meta.face;
                        return (
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.pill}`}>
                              <Face size={12} className="animate-star-pop group-hover:animate-bob" /> {meta.label}
                            </span>
                            <StarRow rating={rev.rating} />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Nội dung nhận xét */}
                    <div className="mt-3.5">
                      {rev.comment ? (
                        <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          {rev.comment}
                        </p>
                      ) : (
                        <p className="text-xs italic text-slate-400 px-1">Khách không để lại nhận xét.</p>
                      )}

                      {/* {rev.images && rev.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {rev.images.map((imgUrl, index) => (
                            <div
                              key={index}
                              onClick={() => setSelectedImage(imgUrl)}
                              className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-400 transition-all cursor-pointer shadow-sm"
                            >
                              <img
                                src={imgUrl}
                                alt={`Ảnh đánh giá ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ZoomIn size={16} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )} */}
                    </div>
                  </Card>
                ))}
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

                  <span className="text-xs font-bold text-slate-500 mr-1">
                    Trang {safePage + 1} / {totalPages}
                  </span>

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
        </>
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
