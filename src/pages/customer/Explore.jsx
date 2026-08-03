import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Flame, TrendingUp, Compass, Clock, Star, MapPin, Store, ArrowLeft, Utensils,
  ChevronRight, Loader2, Sparkles, PackageSearch, X, ShoppingBag,
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../services/api';
import { mapRestaurant } from '../../utils/mappers';
import { getFoodImageUrl } from '../../utils/avatarHelper';
import { calculateHaversineDistance } from '../../utils/haversine';

const FEED_SIZE = 8;

// Gắn khoảng cách thật (Haversine) vào quán đã map — dùng chung feed + kết quả tìm kiếm.
const withDistance = (mapped, userLat, userLng) => {
  const d = calculateHaversineDistance(userLat, userLng, mapped.latitude, mapped.longitude);
  return { ...mapped, distanceVal: d ?? 999, distance: d ? `${d}km` : '—', cuisineType: mapped.tags?.[0] || 'Ẩm thực' };
};

// ─── Thẻ "bài viết" quán ăn (kiểu feed GrabFood/UberEats) ───
function RestaurantPost({ res, onClick, style }) {
  const isNew = res.reviewsCount === 0;
  return (
    <article
      onClick={onClick}
      style={style}
      className="group bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-rise-in"
    >
      {/* Ảnh bìa */}
      <div className="relative h-36 sm:h-40 overflow-hidden bg-slate-100">
        <img
          src={res.image}
          alt={res.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        {/* Trạng thái mở cửa */}
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full backdrop-blur-sm ${
          res.isOpen ? 'bg-emerald-500/90 text-white' : 'bg-slate-700/80 text-white'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${res.isOpen ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
          {res.isOpen ? 'Đang mở' : 'Đã đóng'}
        </span>

        {res.featured && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full bg-amber-400/95 text-amber-950 shadow-sm">
            <Sparkles size={11} /> Nổi bật
          </span>
        )}

        {/* Chip điểm + khoảng cách nổi trên ảnh */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full bg-white/95 text-amber-600 shadow-sm">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            {isNew ? 'Mới' : res.rating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-white/95 text-slate-600 shadow-sm">
            <MapPin size={12} className="text-[#FF6B35]" /> {res.distance}
          </span>
        </div>
      </div>

      {/* Nội dung */}
      <div className="p-3.5">
        <h3 className="font-extrabold text-sm text-slate-800 truncate leading-tight group-hover:text-[#FF6B35] transition-colors">
          {res.name}
        </h3>
        <p className="text-[11px] text-slate-500 font-medium mt-1 line-clamp-2 leading-relaxed min-h-[2rem]">
          {res.description?.trim() || `${res.cuisineType} · ${res.address || 'Đang cập nhật địa chỉ'}`}
        </p>

        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            <Utensils size={12} className="text-[#1A73E8]" /> {res.cuisineType}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF6B35]">
            Xem quán <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

// Khung xương thẻ quán khi đang tải
function PostSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden animate-pulse">
      <div className="h-36 sm:h-40 bg-slate-200" />
      <div className="p-3.5 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded w-2/3" />
        <div className="h-2.5 bg-slate-100 rounded w-full" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function Explore() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const userLat = user?.latitude || user?.lat;
  const userLng = user?.longitude || user?.lng;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Feed quán (phân trang server-side)
  const [feed, setFeed] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Mục xu hướng + từ khoá hot (từ /foods/popular — dữ liệu THẬT)
  const [trendingFoods, setTrendingFoods] = useState([]);
  const [hotKeywords, setHotKeywords] = useState([]);

  // Kết quả tìm kiếm server-side
  const [searchResults, setSearchResults] = useState({ restaurants: [], foods: [] });
  const [searching, setSearching] = useState(false);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('meal_dash_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const isSearchMode = debouncedQuery.trim().length > 0;

  // ─── Nạp lần đầu: 1 trang feed + top món xu hướng (KHÔNG nạp toàn bộ menu mọi quán) ───
  const fetchFeed = useCallback(async (pageNum, append) => {
    if (append) setLoadingMore(true); else setLoadingFeed(true);
    try {
      const res = await apiClient.get('/restaurants', { params: { page: pageNum, size: FEED_SIZE } });
      const data = res.data?.data;
      const list = (data?.content || []).map((r) => withDistance(mapRestaurant(r), userLat, userLng));
      setTotalPages(data?.totalPages || 1);
      setFeed((prev) => (append ? [...prev, ...list] : list));
    } catch (err) {
      console.error('[Explore] Lỗi tải feed quán:', err);
    } finally {
      if (append) setLoadingMore(false); else setLoadingFeed(false);
    }
  }, [userLat, userLng]);

  useEffect(() => {
    setPage(0);
    fetchFeed(0, false);
  }, [fetchFeed]);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const res = await apiClient.get('/foods/popular', { params: { limit: 8 } });
        const foods = (res.data?.data || []).map((f) => ({
          id: f.id,
          name: f.foodName,
          restaurantId: f.restaurantId,
          restaurantName: f.restaurantName,
          image: getFoodImageUrl(f.imageUrl),
          price: f.price,
          orderCount: f.orderCount || 0,
        }));
        setTrendingFoods(foods.slice(0, 5));
        const names = Array.from(new Set(foods.map((f) => f.name))).filter(Boolean).slice(0, 6);
        setHotKeywords(names);
      } catch (err) {
        console.warn('[Explore] Lỗi tải món xu hướng:', err);
      }
    };
    fetchPopular();
  }, []);

  // ─── Debounce từ khoá ───
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // ─── Tìm kiếm server-side (quán + món) khi có từ khoá ───
  useEffect(() => {
    const kw = debouncedQuery.trim();
    if (!kw) { setSearchResults({ restaurants: [], foods: [] }); return; }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const [resR, resF] = await Promise.all([
          apiClient.get('/restaurants', { params: { keyword: kw, page: 0, size: 12 } }),
          apiClient.get('/foods/search', { params: { keyword: kw, limit: 20 } }),
        ]);
        if (cancelled) return;
        const restaurants = (resR.data?.data?.content || []).map((r) => withDistance(mapRestaurant(r), userLat, userLng));
        const foods = (resF.data?.data || []).map((f) => ({
          id: f.id,
          name: f.foodName,
          restaurantId: f.restaurantId,
          restaurantName: f.restaurantName,
          image: getFoodImageUrl(f.imageUrl),
          price: f.price,
        }));
        setSearchResults({ restaurants, foods });
      } catch (err) {
        console.error('[Explore] Lỗi tìm kiếm:', err);
        if (!cancelled) setSearchResults({ restaurants: [], foods: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, userLat, userLng]);

  // ─── Infinite scroll cho feed (chỉ ở chế độ mặc định) ───
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (isSearchMode || isSearchFocused) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && page + 1 < totalPages && !loadingMore && !loadingFeed) {
        const next = page + 1;
        setPage(next);
        fetchFeed(next, true);
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [isSearchMode, isSearchFocused, page, totalPages, loadingMore, loadingFeed, fetchFeed]);

  const saveSearchKeyword = (keyword) => {
    const cleanKw = (keyword || '').trim();
    if (!cleanKw) return;
    setRecentSearches((prev) => {
      const updated = [cleanKw, ...prev.filter((k) => k !== cleanKw)].slice(0, 8);
      localStorage.setItem('meal_dash_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };
  const clearRecentSearches = () => { setRecentSearches([]); localStorage.removeItem('meal_dash_recent_searches'); };

  const runSearch = (txt) => {
    setQuery(txt);
    setDebouncedQuery(txt);
    setIsSearchFocused(true);
    saveSearchKeyword(txt);
  };
  const exitSearch = () => { setQuery(''); setDebouncedQuery(''); setIsSearchFocused(false); };

  const suggestions = useMemo(() => {
    const s = [...hotKeywords, ...feed.slice(0, 4).map((r) => r.name)].filter(Boolean);
    return Array.from(new Set(s)).slice(0, 8);
  }, [hotKeywords, feed]);

  const hasSearchResults = searchResults.restaurants.length > 0 || searchResults.foods.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 relative overflow-x-hidden">
      {/* Nền mờ trang trí */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B35]/10 to-transparent rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-gradient-to-tr from-[#1A73E8]/8 to-transparent rounded-full blur-3xl opacity-40 pointer-events-none" />

      {/* Tiêu đề */}
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 mb-5 flex items-center gap-2.5 relative z-10">
        <span className="w-9 h-9 bg-gradient-to-tr from-[#FF6B35] to-[#FF8B5E] rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
          <Compass size={18} className="animate-spin-slow" />
        </span>
        Khám phá ẩm thực
      </h1>

      {/* Thanh tìm kiếm */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        {(isSearchFocused || isSearchMode) && (
          <button
            onClick={exitSearch}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft size={20} className="stroke-[2.5px]" />
          </button>
        )}
        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-full px-5 py-3.5 shadow-sm focus-within:border-[#FF6B35] focus-within:ring-4 focus-within:ring-[#FF6B35]/10 transition-all">
          {searching ? <Loader2 size={18} className="text-[#FF6B35] shrink-0 animate-spin" /> : <Search size={18} className="text-slate-400 shrink-0" />}
          <input
            type="text"
            value={query}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) runSearch(query.trim()); }}
            placeholder="Tìm quán ăn, món ăn bạn thèm..."
            className="w-full bg-transparent border-none outline-none pl-4 text-xs sm:text-sm font-semibold text-slate-700 placeholder-slate-400"
          />
          {query && (
            <button onClick={() => { setQuery(''); setDebouncedQuery(''); }} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ═══ CHẾ ĐỘ TÌM KIẾM ═══ */}
      {isSearchMode ? (
        <div className="space-y-6 relative z-10 animate-fade-in">
          {searching && !hasSearchResults ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)}
            </div>
          ) : hasSearchResults ? (
            <>
              {searchResults.restaurants.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-[11px] font-black text-[#1A73E8] uppercase tracking-widest pl-1 flex items-center gap-1.5">
                    <Store size={13} /> Quán ăn phù hợp ({searchResults.restaurants.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {searchResults.restaurants.map((res, i) => (
                      <RestaurantPost key={res.id} res={res} onClick={() => navigate(`/restaurants/${res.id}`)} style={{ animationDelay: `${i * 40}ms` }} />
                    ))}
                  </div>
                </section>
              )}

              {searchResults.foods.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-[11px] font-black text-[#FF6B35] uppercase tracking-widest pl-1 flex items-center gap-1.5">
                    <Utensils size={13} /> Món ăn phù hợp ({searchResults.foods.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.foods.map((item, i) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/restaurants/${item.restaurantId}`)}
                        className="p-2 bg-white hover:bg-slate-50 border border-slate-150 rounded-xl hover:shadow-sm transition-all cursor-pointer flex gap-3 items-center animate-rise-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <img src={item.image} alt={item.name} loading="lazy" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-100" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate leading-snug">{item.name}</h4>
                          <p className="text-[10px] text-[#1A73E8] font-bold truncate mt-1 flex items-center gap-1"><Store size={11} /> {item.restaurantName}</p>
                          <span className="text-xs font-extrabold text-[#FF6B35] mt-1 block">{formatCurrency(item.price)}</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl px-8 shadow-sm">
              <PackageSearch size={44} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-extrabold text-sm">Không tìm thấy kết quả cho "{debouncedQuery}"</p>
              <p className="text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-wider">Thử từ khoá khác như "cơm", "bún", "trà sữa"...</p>
            </div>
          )}
        </div>
      ) : isSearchFocused ? (
        /* ═══ OVERLAY KHI FOCUS Ô TÌM (chưa gõ) ═══ */
        <div className="space-y-6 relative z-10 animate-fade-in">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 pl-1"><Clock size={14} className="text-slate-400" /> Tìm gần đây</h3>
                <button onClick={clearRecentSearches} className="text-[10px] text-red-500 hover:underline font-extrabold cursor-pointer">Xóa hết</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((tag) => (
                  <button key={tag} onClick={() => runSearch(tag)} className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-700 cursor-pointer">
                    <Clock size={12} className="text-slate-400" /> {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 pl-1 mb-3"><TrendingUp size={14} className="text-[#FF6B35]" /> Gợi ý cho bạn</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((tag) => (
                <button key={tag} onClick={() => runSearch(tag)} className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-700 cursor-pointer">
                  <Sparkles size={12} className="text-[#FF6B35]" /> {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ═══ CHẾ ĐỘ MẶC ĐỊNH: hot keywords + xu hướng + feed quán ═══ */
        <div className="space-y-7 relative z-10 animate-fade-in">
          {/* Từ khoá hot */}
          {hotKeywords.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-3 flex items-center gap-1.5">
                <Flame size={14} className="text-orange-500 fill-orange-500 animate-pulse" /> Từ khoá hot hôm nay
              </h3>
              <div className="flex flex-wrap gap-2">
                {hotKeywords.map((tag) => (
                  <button key={tag} onClick={() => runSearch(tag)} className="px-4 py-2 bg-white border border-slate-200 hover:border-[#FF6B35] hover:text-[#FF6B35] rounded-full text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer text-slate-700">
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Món ăn xu hướng — lượt đặt THẬT */}
          {trendingFoods.length > 0 && (
            <section className="rounded-3xl bg-gradient-to-br from-[#1A73E8]/6 via-white to-white border border-slate-150 shadow-sm p-5 sm:p-6">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-lg bg-[#1A73E8]/10 text-[#1A73E8] flex items-center justify-center"><TrendingUp size={16} className="stroke-[2.5px]" /></span>
                Món ăn xu hướng gần bạn
                <span className="ml-auto text-[10px] font-bold text-slate-400 normal-case tracking-normal">Theo lượt đặt thật</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
                {trendingFoods.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/restaurants/${item.restaurantId}`)}
                    className="py-2.5 flex items-center gap-3.5 hover:bg-white rounded-xl px-2 transition-all cursor-pointer group border-b border-slate-100/70 last:border-0"
                  >
                    <span className={`text-lg font-black leading-none w-6 shrink-0 tabular-nums ${idx === 0 ? 'text-[#FF6B35]' : 'text-slate-300 group-hover:text-[#1A73E8]'} transition-colors`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <img src={item.image} alt={item.name} loading="lazy" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-100 shadow-sm" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-extrabold text-xs text-slate-700 leading-snug truncate group-hover:text-slate-900 transition-colors">{item.name}</span>
                      <span className="text-[10px] text-[#1A73E8] font-bold uppercase mt-0.5 truncate flex items-center gap-1"><Store size={10} /> {item.restaurantName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-600"><ShoppingBag size={11} className="text-emerald-500" /> {item.orderCount}</span>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase mt-0.5">lượt đặt</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Feed quán ngon gần bạn — phân trang / cuộn vô hạn */}
          <section>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-4 pl-1">
              <span className="w-7 h-7 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] flex items-center justify-center"><Store size={16} /></span>
              Quán ngon gần bạn
            </h3>

            {loadingFeed ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: FEED_SIZE }).map((_, i) => <PostSkeleton key={i} />)}
              </div>
            ) : feed.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200/60 rounded-2xl shadow-sm">
                <Store size={44} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-extrabold text-sm">Chưa có quán nào đang mở</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {feed.map((res, i) => (
                    <RestaurantPost key={res.id} res={res} onClick={() => navigate(`/restaurants/${res.id}`)} style={{ animationDelay: `${(i % FEED_SIZE) * 40}ms` }} />
                  ))}
                </div>

                {/* Sentinel cuộn vô hạn + trạng thái tải thêm */}
                <div ref={sentinelRef} className="h-8" />
                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs font-bold">
                    <Loader2 size={16} className="animate-spin text-[#FF6B35]" /> Đang tải thêm quán...
                  </div>
                )}
                {!loadingMore && page + 1 < totalPages && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => { const next = page + 1; setPage(next); fetchFeed(next, true); }}
                      className="px-6 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-extrabold shadow-sm hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all cursor-pointer"
                    >
                      Xem thêm quán
                    </button>
                  </div>
                )}
                {page + 1 >= totalPages && feed.length > FEED_SIZE && (
                  <p className="text-center text-[11px] text-slate-400 font-bold pt-4">Bạn đã xem hết quán rồi 🎉</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
