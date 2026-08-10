import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Search, MapPin, ShoppingBag, Star, Clock, Heart, Award,
  RotateCcw, Sparkles, ChevronDown, SlidersHorizontal, Check, RefreshCw, X, Utensils,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, removeVietnameseTones } from '../../utils/format';
import Card from '../../components/common/Card';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import MapModal2 from '../../components/common/Map';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import { mapRestaurant } from '../../utils/mappers';
import FilterTabs from '../../components/common/FilterTabs';
import { getCategoryIcon } from '../../utils/iconMap';
import HeroCarousel from '../../components/customer/HeroCarousel';

const CATEGORIES = [
  { id: 'all', name: 'Tất cả' },
  { id: 'com', name: 'Cơm Tấm' },
  { id: 'drink', name: 'Trà Sữa' },
  { id: 'ga', name: 'Gà Rán' },
  { id: 'pho', name: 'Phở' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'hutieu', name: 'Hủ tiếu' },
  { id: 'bun', name: 'Bún' },
];

const PAGE_SIZE = 6;
const DEFAULT_LAT = 10.762622;
const DEFAULT_LNG = 106.660172;

function getCategoryName(categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.name : null;
}

// Gắn thêm khoảng cách / thời gian giao hàng / phí ship ước tính vào 1 danh sách quán ăn thô từ API
function attachDistance(list, customerLat, customerLng) {
  return list.map((res) => {
    const lat = Number(res.latitude);
    const lng = Number(res.longitude);
    const dist = !isNaN(lat) && !isNaN(lng)
      ? calculateHaversineDistance(lat, lng, customerLat, customerLng)
      : 1.0;

    const duration = Math.max(10, Math.round(dist * 5 + 5));
    const shippingFee = Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000);

    return {
      ...res,
      distance: `${dist.toFixed(1)}km`,
      distanceNum: dist,
      time: `${Math.max(10, duration - 3)}-${duration + 3} phút`,
      shipping: shippingFee <= 15000 ? 'Phí ship rẻ' : shippingFee <= 20000 ? 'Phí ship vừa' : 'Phí ship cao',
      shippingFee,
    };
  });
}

export default function Home() {
  const navigate = useNavigate();
  const carts = useCartStore((state) => state.carts);
  const cartItemsCount = carts.reduce((total, cart) => total + (cart.items || []).reduce((sum, item) => sum + item.quantity, 0), 0);
  const cartTotal = carts.reduce((sum, cart) => sum + (cart.subtotal || 0), 0);
  const { user, updateProfile } = useAuthStore();

  const customerLat = user?.lat || DEFAULT_LAT;
  const customerLng = user?.lng || DEFAULT_LNG;

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [suggestionPool, setSuggestionPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [favorites, setFavorites] = useState([]);
  const [burstFavId, setBurstFavId] = useState(null);
  const [pastOrders, setPastOrders] = useState([]);
  const [sortByFilter, setSortByFilter] = useState('distance');
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [visibleFeaturedCount, setVisibleFeaturedCount] = useState(6);
  const [visibleRecomCount, setVisibleRecomCount] = useState(6);
  const [visibleOrderAgainCount, setVisibleOrderAgainCount] = useState(6);

  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Debounce ô tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let ignore = false;

    // Chỉ khi TÌM KIẾM/CHỌN DANH MỤC mới cần gọi API riêng (list có lọc + phân trang).
    // Khi KHÔNG lọc, dùng luôn "pool" (đã tải 1 lần bên dưới) làm nguồn cho danh sách
    // "Khám phá" → bỏ được 1 lần gọi /restaurants trùng lặp khi vào trang chủ.
    const usingApiFilter = debouncedSearch.trim() !== '' || activeCategory !== 'all';

    if (!usingApiFilter) {
      if (poolLoading) {
        setLoading(true);
      } else {
        setRestaurants(suggestionPool);
        // page khớp với số lượng đã có sẵn để "Xem thêm" (nếu có) gọi tiếp đúng trang API.
        setPage(Math.max(0, Math.ceil(suggestionPool.length / PAGE_SIZE) - 1));
        setHasMore(suggestionPool.length >= 30);
        setLoading(false);
      }
      return () => { ignore = true; };
    }

    //lấy danh sách quán ăn (có lọc theo keyword/danh mục)
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setPage(0);
        setHasMore(true);

        const params = new URLSearchParams({ page: '0', size: String(PAGE_SIZE) });
        if (debouncedSearch.trim()) params.set('keyword', debouncedSearch.trim());
        const categoryName = activeCategory !== 'all' ? getCategoryName(activeCategory) : null;
        if (categoryName) params.set('keyword', categoryName);

        const response = await apiClient.get(`/restaurants?${params.toString()}`);
        if (ignore) return;

        const realData = response.data?.data?.content || [];
        setHasMore(realData.length >= PAGE_SIZE);
        setRestaurants(realData.map(mapRestaurant).filter(Boolean));
      } catch (error) {
        if (ignore) return;
        console.error('Lỗi khi tải danh sách quán ăn từ Backend:', error);
        setRestaurants([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchRestaurants();
    return () => { ignore = true; };
  }, [debouncedSearch, activeCategory, suggestionPool, poolLoading]);

  // Lấy 1 lần (khi mount) một tập dữ liệu quán ăn rộng hơn, KHÔNG theo filter, làm nguồn cho
  // các section gợi ý bên dưới (Nổi bật / Dành riêng cho bạn / Đặt lại quán cũ).
  useEffect(() => {
    let ignore = false;

    const fetchPool = async () => {
      try {
        setPoolLoading(true);
        const response = await apiClient.get('/restaurants?page=0&size=30');
        if (ignore) return;
        const realData = response.data?.data?.content || [];
        setSuggestionPool(realData.map(mapRestaurant).filter(Boolean));
      } catch (error) {
        if (ignore) return;
        console.warn('Lỗi khi tải dữ liệu gợi ý quán ăn:', error);
        setSuggestionPool([]);
      } finally {
        if (!ignore) setPoolLoading(false);
      }
    };

    fetchPool();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    //lấy danh sách quán yêu thích
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites([]);
        return;
      }
      try {
        const response = await apiClient.get('/favorites');
        const favs = response.data?.data || [];
        setFavorites(favs.map(f => f.restaurantId.toString()));
      } catch (err) {
        console.warn('Lỗi khi tải yêu thích:', err);
        setFavorites([]);
      }
    };
    fetchFavorites();

    //lấy danh sách orders
    const fetchPastOrders = async () => {
      if (!user) {
        setPastOrders([]);
        return;
      }
      try {
        const response = await apiClient.get('/orders');
        const orders = response.data?.data?.content || [];
        setPastOrders(orders);
      } catch (err) {
        console.warn('Lỗi khi tải lịch sử đơn hàng ở trang chủ:', err);
        setPastOrders([]);
      }
    };
    fetchPastOrders();
  }, [user?.userId]);

  // Tải thêm quán ăn cho "Khám Phá Quán Ăn" khi bấm nút Xem thêm (giữ nguyên keyword/category hiện tại)
  const loadMoreRestaurants = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;

      const params = new URLSearchParams({ page: String(nextPage), size: String(PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set('keyword', debouncedSearch.trim());
      const categoryName = activeCategory !== 'all' ? getCategoryName(activeCategory) : null;
      if (categoryName) params.set('keyword', categoryName);

      const response = await apiClient.get(`/restaurants?${params.toString()}`);
      const realData = response.data?.data?.content || [];
      setHasMore(realData.length >= PAGE_SIZE);

      if (realData.length > 0) {
        const mapped = realData.map(mapRestaurant).filter(Boolean);
        setRestaurants(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const uniqueNew = mapped.filter(r => !existingIds.has(r.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thêm quán ăn:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFavorite = async (resId, e) => {
    e.stopPropagation();
    const isFav = favorites.includes(resId);
    try {
      if (isFav) {
        await apiClient.delete(`/favorites/${resId}`);
        setFavorites(prev => prev.filter(id => id !== resId));
      } else {
        await apiClient.post(`/favorites/${resId}`);
        setFavorites(prev => [...prev, resId]);
        setBurstFavId(resId);
        setTimeout(() => setBurstFavId(v => (v === resId ? null : v)), 650);
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật yêu thích:', err);
    }
  };

  // Khoảng cách cho danh sách "Khám phá" (đã lọc theo keyword/category ở BE)
  const restaurantsWithDistance = useMemo(
    () => attachDistance(restaurants, customerLat, customerLng),
    [restaurants, customerLat, customerLng]
  );

  // Khoảng cách cho pool gợi ý (độc lập với filter)
  const poolWithDistance = useMemo(
    () => attachDistance(suggestionPool, customerLat, customerLng),
    [suggestionPool, customerLat, customerLng]
  );

  // Chỉ còn áp dụng 2 quick-filter còn thực sự hoạt động: đang mở cửa & đã lưu yêu thích.
  // Lưu ý: sửa lỗi cũ — "Đang mở cửa" trước đây so sánh nhầm với res.status (cờ khoá tài khoản
  // quán do admin quản lý) thay vì res.isOpen (trạng thái mở cửa theo giờ, cũng là giá trị đang
  // hiển thị trên badge của card) khiến bộ lọc và badge hiển thị không khớp nhau.
  const filteredRestaurants = useMemo(() => {
    return restaurantsWithDistance.filter((res) => {
      if (onlyOpen && res.isOpen === false) return false;
      if (onlyFavorites && !favorites.includes(res.id)) return false;
      return true;
    });
  }, [restaurantsWithDistance, onlyOpen, onlyFavorites, favorites]);

  const nearByRestaurants = useMemo(() => {
    return [...filteredRestaurants].sort((a, b) => {
      if (sortByFilter === 'rating') return b.rating - a.rating;
      if (sortByFilter === 'ship') return a.shippingFee - b.shippingFee;
      if (sortByFilter === 'orders') return (b.orderCount || 0) - (a.orderCount || 0);
      return a.distanceNum - b.distanceNum;
    });
  }, [filteredRestaurants, sortByFilter]);

  // QUÁN NỔI BẬT:
  const featuredRestaurants = useMemo(() => {
    const sorted = [...poolWithDistance].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewsCount - a.reviewsCount;
    });
    const unique = [];
    const seen = new Set();
    sorted.forEach(res => {
      if (!seen.has(res.id)) {
        seen.add(res.id);
        unique.push(res);
      }
    });
    return unique;
  }, [poolWithDistance]);

  // ĐẶT LẠI QUÁN CŨ: 
  const orderAgainRestaurants = useMemo(() => {
    if (pastOrders.length === 0) return [];
    const orderedResIds = [...new Set(pastOrders.map(ord => {
      const id = ord.restaurantId || ord.restaurant?.restaurantId;
      return id ? id.toString() : null;
    }).filter(Boolean))];

    return poolWithDistance.filter(res => orderedResIds.includes(res.id));
  }, [pastOrders, poolWithDistance]);

  // DÀNH RIÊNG CHO BẠN: 
  const { recommendedRestaurants, favCuisineName } = useMemo(() => {
    const allOrderedFoods = [];
    pastOrders.forEach(ord => {
      const itemsList = ord.items || ord.orderItems || [];
      itemsList.forEach(item => {
        const name = item.foodName || item.name;
        if (name) allOrderedFoods.push(name);
      });
    });

    const keywords = [
      { key: 'com', label: 'Cơm Tấm' },
      { key: 'bun', label: 'Bún Riêu/Bún Bò' },
      { key: 'mi', label: 'Mì Quảng/Mì Ý' },
      { key: 'pizza', label: 'Pizza' },
      { key: 'sushi', label: 'Sushi' },
      { key: 'salad', label: 'Salad' },
      { key: 'ga', label: 'Gà Rán' },
      { key: 'suon', label: 'Cơm Sườn' },
      { key: 'tra', label: 'Trà Sữa' },
      { key: 'sua', label: 'Trà Sữa' },
    ];

    const counts = {};
    keywords.forEach(kw => { counts[kw.key] = 0; });

    allOrderedFoods.forEach(food => {
      const normFood = removeVietnameseTones(food);
      keywords.forEach(kw => {
        if (normFood.includes(kw.key)) counts[kw.key]++;
      });
    });

    let maxKey = 'com';
    let maxCount = 0;
    Object.keys(counts).forEach(key => {
      if (counts[key] > maxCount) {
        maxCount = counts[key];
        maxKey = key;
      }
    });

    const favKw = keywords.find(k => k.key === maxKey);
    const favName = favKw ? favKw.label : 'Cơm Tấm';
    const favNorm = removeVietnameseTones(favName);

    let recommended = [];
    if (maxCount > 0) {
      recommended = poolWithDistance.filter(res => {
        const nameNorm = removeVietnameseTones(res.name || '');
        const tagsNorm = (res.tags || []).map(t => removeVietnameseTones(t));

        return nameNorm.includes(maxKey) || tagsNorm.some(t => t.includes(maxKey)) ||
               nameNorm.includes(favNorm) || tagsNorm.some(t => t.includes(favNorm)) ||
               (maxKey === 'com' && (nameNorm.includes('rice') || tagsNorm.some(t => t.includes('com') || t.includes('rice')))) ||
               (maxKey === 'ga' && (nameNorm.includes('chicken') || tagsNorm.some(t => t.includes('ga') || t.includes('chicken')))) ||
               (maxKey === 'bun' && (nameNorm.includes('pho') || tagsNorm.some(t => t.includes('bun') || t.includes('pho') || t.includes('soup'))));
      });
    }

    if (recommended.length === 0) {
      recommended = [...poolWithDistance].sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewsCount - a.reviewsCount;
      });
    }

    const uniqueRecom = [];
    const seen = new Set();
    recommended.forEach(res => {
      if (!seen.has(res.id)) {
        seen.add(res.id);
        uniqueRecom.push(res);
      }
    });

    return {
      recommendedRestaurants: uniqueRecom,
      favCuisineName: maxCount > 0 ? favName : 'Được đánh giá cao',
    };
  }, [pastOrders, poolWithDistance]);

  const handleConfirmLocation = async (lat, lng, addressName) => {
    try {
      updateProfile({ address: addressName, lat, lng });
      await apiClient.put('/users/profile', {
        address: addressName,
        latitude: lat,
        longitude: lng,
      });
    } catch (err) {
      console.warn('Lỗi đồng bộ địa chỉ lên server:', err);
    }
  };

  const isFilterActive = searchQuery !== '' || activeCategory !== 'all' || sortByFilter !== 'distance' || onlyOpen || onlyFavorites;

  const isSearchingOrFiltering = searchQuery !== '' || activeCategory !== 'all' || onlyOpen || onlyFavorites;

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSortByFilter('distance');
    setOnlyOpen(false);
    setOnlyFavorites(false);
  };

  return (
    <div className="flex-1 p-3 sm:p-5 md:p-8 max-w-7xl mx-auto w-full font-google-sans pb-24 bg-[#FAFAFA]">
      {/* ═══ TOP HERO BANNER & GREETING ═══ */}
      <div className="mb-5 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-rose-500/10 border border-orange-500/15 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span>Bạn muốn ăn gì hôm nay?</span>
              <Sparkles className="text-[#FF6B35] animate-pulse" size={22} />
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
              Khám phá hàng trăm quán ăn chất lượng giao hàng tận nơi nhanh chóng
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-[#FF6B35] rounded-xl text-xs md:text-sm font-bold border border-orange-200 shadow-sm hover:border-[#FF6B35] hover:shadow transition-all shrink-0 cursor-pointer self-start md:self-auto"
          >
            <MapPin size={16} className="shrink-0 text-[#FF6B35]" />
            <span className={`truncate max-w-[180px] sm:max-w-[240px] md:max-w-[280px] ${!user?.address ? "text-amber-600 font-bold animate-pulse" : "text-slate-700"}`}>
              {user?.address ? (user.address.length > 30 ? user.address.slice(0, 30) + '...' : user.address) : 'Chọn địa chỉ giao hàng'}
            </span>
            <ChevronDown size={14} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ═══ SEARCH BAR & CATEGORY FILTERS (search & category đều gọi API) ═══ */}
      <div className="space-y-3.5 mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên quán"
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 focus:border-[#FF6B35] rounded-xl text-xs sm:text-sm outline-none shadow-sm transition-all text-slate-800 placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 touch-pan-x">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const CatIcon = getCategoryIcon(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-sm scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CatIcon size={15} className={isActive ? 'text-white' : 'text-[#FF6B35]'} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6 lg:gap-8 items-start">
        <div className="flex-1 min-w-0 space-y-8 md:space-y-10">

          {/* ════════ SECTION 1: KHÁM PHÁ QUÁN ĂN ════════ */}
          <div id="explore-restaurants-section" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 rounded-xl text-[#FF6B35]">
                  <Utensils size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    Khám Phá Quán Ăn
                    <span className="text-xs font-bold bg-orange-50 text-[#FF6B35] px-2 py-0.5 rounded-full border border-orange-200">
                      {nearByRestaurants.length} quán
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Danh sách quán ăn sẵn sàng phục vụ bạn</p>
                </div>
              </div>

              <FilterTabs
                tabs={[
                  { id: 'distance', label: 'Gần nhất' },
                  { id: 'rating', label: 'Đánh giá cao' },
                  { id: 'orders', label: 'Bán chạy' },
                  { id: 'ship', label: 'Phí ship rẻ' },
                ]}
                activeTab={sortByFilter}
                onTabChange={setSortByFilter}
                className="bg-slate-100 p-1 rounded-xl w-max text-xs font-bold shrink-0 self-start sm:self-auto"
              />
            </div>

            {/* Quick Filter Badges — chỉ giữ 2 bộ lọc thật sự có tác dụng */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 pb-1">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <SlidersHorizontal size={13} /> Bộ lọc:
              </span>

              <button
                onClick={() => setOnlyOpen(!onlyOpen)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  onlyOpen
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Clock size={13} />
                <span>Đang mở cửa</span>
                {onlyOpen && <Check size={12} className="ml-0.5" />}
              </button>

              <button
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  onlyFavorites
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Heart size={13} className={onlyFavorites ? 'fill-white' : 'text-rose-500'} />
                <span>Quán đã lưu</span>
                {onlyFavorites && <Check size={12} className="ml-0.5" />}
              </button>

              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 transition-colors ml-auto cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
            </div>

            <div className="mt-2">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <ShoppingBag size={44} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Không tìm thấy quán ăn phù hợp</p>
                  <p className="text-xs text-slate-500 mt-1">Vui lòng chọn danh mục khác hoặc xóa điều kiện lọc</p>
                  {isFilterActive && (
                    <button
                      onClick={resetFilters}
                      className="mt-3 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-orange-600 transition-all cursor-pointer"
                    >
                      Đặt lại tất cả bộ lọc
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {nearByRestaurants.map((res) => (
                    <Card
                      key={`explore-${res.id}`}
                      variant="elevated"
                      hoverEffect
                      onClick={() => navigate(`/restaurants/${res.id}`)}
                      className="!rounded-2xl relative border border-slate-200/80 bg-white overflow-hidden group shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <button
                        onClick={(e) => toggleFavorite(res.id, e)}
                        title={favorites.includes(res.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                        className="group/fav absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer active:scale-90"
                      >
                        {burstFavId === res.id && (
                          <span className="absolute inset-0 rounded-full bg-rose-400/50 animate-heart-burst pointer-events-none" />
                        )}
                        <Heart
                          size={16}
                          className={`relative transition-transform ${
                            favorites.includes(res.id)
                              ? 'fill-rose-500 text-rose-500 ' + (burstFavId === res.id ? 'animate-heart-pop' : 'animate-heart-beat')
                              : 'group-hover/fav:scale-110'
                          }`}
                        />
                      </button>

                      <div>
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                          <img
                            src={res.image}
                            alt={res.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <span className="absolute bottom-2.5 left-2.5 text-[10px] bg-black/75 backdrop-blur-sm text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            {res.reviewsCount > 0 ? `${res.rating} (${res.reviewsCount})` : 'Mới'}
                          </span>
                          <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm text-white ${res.isOpen !== false ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            {res.isOpen !== false ? 'Đang mở cửa' : 'Đã đóng cửa'}
                          </span>
                        </div>

                        <div className="p-3.5 sm:p-4">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors leading-snug">{res.name}</h3>
                          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock size={13} />
                              {res.time}
                            </span>
                            <span className="font-semibold text-slate-600">{res.distance}</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded ${
                            res.shippingFee <= 15000
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {res.shipping}
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-[#FF6B35] font-bold bg-orange-50 px-2 py-0.5 rounded">
                            Đã bán {res.orderCount || 0}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {hasMore && !loading && filteredRestaurants.length > 0 && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <button
                    onClick={loadMoreRestaurants}
                    disabled={loadingMore}
                    className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 disabled:border-slate-300 disabled:text-slate-400 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                        Đang tải thêm...
                      </>
                    ) : (
                      'Xem thêm quán ăn khác'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ════════ SECTION 2, 3, 4: chỉ hiện khi người dùng KHÔNG đang tìm/lọc cụ thể,
              để tránh cảm giác "biến mất" khó hiểu khi các section này trước đây bị lọc
              theo cùng điều kiện với danh sách Khám phá ════════ */}
          {!isSearchingOrFiltering && (
            <>
              {featuredRestaurants.length > 0 && (
                <div className="space-y-5 sm:space-y-6">
                  <div className="rounded-2xl overflow-hidden shadow-sm">
                    <HeroCarousel
                      items={featuredRestaurants.slice(0, 6)}
                      onSelect={(res) => navigate(`/restaurants/${res.id}`)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                        <Award className="text-[#FF6B35]" size={20} />
                        Quán Nổi Bật Đánh Giá Cao
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                      {featuredRestaurants.slice(0, visibleFeaturedCount).map((res) => (
                        <Card
                          key={`feat-${res.id}`}
                          variant="elevated"
                          hoverEffect
                          onClick={() => navigate(`/restaurants/${res.id}`)}
                          className="!rounded-2xl relative border border-slate-200/80 bg-white overflow-hidden group shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <button
                            onClick={(e) => toggleFavorite(res.id, e)}
                            title={favorites.includes(res.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                            className="group/fav absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer active:scale-90"
                          >
                            {burstFavId === res.id && (
                              <span className="absolute inset-0 rounded-full bg-rose-400/50 animate-heart-burst pointer-events-none" />
                            )}
                            <Heart
                              size={16}
                              className={`relative transition-transform ${
                                favorites.includes(res.id)
                                  ? 'fill-rose-500 text-rose-500 ' + (burstFavId === res.id ? 'animate-heart-pop' : 'animate-heart-beat')
                                  : 'group-hover/fav:scale-110'
                              }`}
                            />
                          </button>

                          <div>
                            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                              <img
                                src={res.image}
                                alt={res.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <span className="absolute bottom-2.5 left-2.5 text-[10px] bg-black/75 backdrop-blur-sm text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                {res.reviewsCount > 0 ? `${res.rating} (${res.reviewsCount})` : 'Mới'}
                              </span>
                              <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm text-white ${res.isOpen !== false ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                {res.isOpen !== false ? 'Đang mở cửa' : 'Đã đóng cửa'}
                              </span>
                            </div>

                            <div className="p-3.5 sm:p-4">
                              <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                                <span className="flex items-center gap-1">
                                  <Clock size={13} />
                                  {res.time}
                                </span>
                                <span>{res.distance}</span>
                              </div>
                            </div>
                          </div>

                          <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {res.shipping}
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-[#FF6B35] font-bold bg-orange-50 px-2 py-0.5 rounded">
                                Đã bán {res.orderCount || 0}
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {featuredRestaurants.length > visibleFeaturedCount && (
                      <div className="flex justify-center mt-6 sm:mt-8">
                        <button
                          onClick={() => setVisibleFeaturedCount(prev => prev + 6)}
                          className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                        >
                          Xem thêm quán nổi bật
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {orderAgainRestaurants.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                    <RotateCcw className="text-[#FF6B35]" size={18} /> Đặt Lại Quán Cũ
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {orderAgainRestaurants.slice(0, visibleOrderAgainCount).map((res) => (
                      <Card
                        key={`again-${res.id}`}
                        variant="elevated"
                        hoverEffect
                        onClick={() => navigate(`/restaurants/${res.id}`)}
                        className="!rounded-2xl relative border border-slate-200/80 bg-white overflow-hidden group shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <button
                          onClick={(e) => toggleFavorite(res.id, e)}
                          title={favorites.includes(res.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                          className="group/fav absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer active:scale-90"
                        >
                          {burstFavId === res.id && (
                            <span className="absolute inset-0 rounded-full bg-rose-400/50 animate-heart-burst pointer-events-none" />
                          )}
                          <Heart
                            size={16}
                            className={`relative transition-transform ${
                              favorites.includes(res.id)
                                ? 'fill-rose-500 text-rose-500 ' + (burstFavId === res.id ? 'animate-heart-pop' : 'animate-heart-beat')
                                : 'group-hover/fav:scale-110'
                            }`}
                          />
                        </button>

                        <div>
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                            <img
                              src={res.image}
                              alt={res.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <span className="absolute bottom-2.5 left-2.5 text-[10px] bg-black/75 backdrop-blur-sm text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                              {res.reviewsCount > 0 ? `${res.rating} (${res.reviewsCount})` : 'Mới'}
                            </span>
                            <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm text-white ${res.isOpen !== false ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                              {res.isOpen !== false ? 'Đang mở cửa' : 'Đã đóng cửa'}
                            </span>
                          </div>

                          <div className="p-3.5 sm:p-4">
                            <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock size={13} />
                                {res.time}
                              </span>
                              <span>{res.distance}</span>
                            </div>
                          </div>
                        </div>

                        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {res.shipping}
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-[#FF6B35] font-bold bg-orange-50 px-2 py-0.5 rounded">
                              Đã bán {res.orderCount || 0}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {orderAgainRestaurants.length > visibleOrderAgainCount && (
                    <div className="flex justify-center mt-6 sm:mt-8">
                      <button
                        onClick={() => setVisibleOrderAgainCount(prev => prev + 6)}
                        className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                      >
                        Xem thêm quán cũ
                      </button>
                    </div>
                  )}
                </div>
              )}

              {recommendedRestaurants.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                      <Sparkles className="text-[#FF6B35]" size={20} /> Dành Riêng Cho Bạn
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF6B35] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {favCuisineName === 'Được đánh giá cao' ? 'Gợi ý hot' : `Thích: ${favCuisineName}`}
                      </span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {recommendedRestaurants.slice(0, visibleRecomCount).map((res) => (
                      <Card
                        key={`recom-${res.id}`}
                        variant="elevated"
                        hoverEffect
                        onClick={() => navigate(`/restaurants/${res.id}`)}
                        className="!rounded-2xl relative border border-slate-200/80 bg-white overflow-hidden group shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <button
                          onClick={(e) => toggleFavorite(res.id, e)}
                          title={favorites.includes(res.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                          className="group/fav absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer active:scale-90"
                        >
                          {burstFavId === res.id && (
                            <span className="absolute inset-0 rounded-full bg-rose-400/50 animate-heart-burst pointer-events-none" />
                          )}
                          <Heart
                            size={16}
                            className={`relative transition-transform ${
                              favorites.includes(res.id)
                                ? 'fill-rose-500 text-rose-500 ' + (burstFavId === res.id ? 'animate-heart-pop' : 'animate-heart-beat')
                                : 'group-hover/fav:scale-110'
                            }`}
                          />
                        </button>

                        <div>
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                            <img
                              src={res.image}
                              alt={res.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <span className="absolute bottom-2.5 left-2.5 text-[10px] bg-black/75 backdrop-blur-sm text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                              {res.reviewsCount > 0 ? `${res.rating} (${res.reviewsCount})` : 'Mới'}
                            </span>
                            <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm text-white ${res.isOpen !== false ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                              {res.isOpen !== false ? 'Đang mở cửa' : 'Đã đóng cửa'}
                            </span>
                          </div>

                          <div className="p-3.5 sm:p-4">
                            <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock size={13} />
                                {res.time}
                              </span>
                              <span>{res.distance}</span>
                            </div>
                          </div>
                        </div>

                        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {res.shipping}
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-[#FF6B35] font-bold bg-orange-50 px-2 py-0.5 rounded">
                              Đã bán {res.orderCount || 0}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {recommendedRestaurants.length > visibleRecomCount && (
                    <div className="flex justify-center mt-6 sm:mt-8">
                      <button
                        onClick={() => setVisibleRecomCount(prev => prev + 6)}
                        className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                      >
                        Xem thêm gợi ý dành cho bạn
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* ═══ ASIDE PANEL (DESKTOP LG+) ═══ */}
        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-6 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <ShoppingBag size={16} className="text-[#FF6B35]" /> Giỏ hàng của bạn
            </h3>
            {cartItemsCount === 0 ? (
              <div className="py-6 text-center">
                <ShoppingBag size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Chưa có món nào trong giỏ.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                  {carts.map((cart) => {
                    const itemCount = (cart.items || []).reduce((s, it) => s + it.quantity, 0);
                    return (
                      <div key={cart.restaurantId} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{cart.restaurantName}</p>
                          <p className="text-[11px] text-slate-500 font-semibold">{itemCount} món</p>
                        </div>
                        <span className="text-xs font-black text-[#FF6B35] shrink-0">{formatCurrency(cart.subtotal || 0)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                  <span className="text-xs font-bold text-slate-500">Tổng ({cartItemsCount} món)</span>
                  <span className="text-base font-black text-[#FF6B35]">{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={() => navigate('/cart')}
                  className="w-full mt-3 bg-[#FF6B35] text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-sm hover:bg-orange-600 active:scale-98 transition-all cursor-pointer"
                >
                  Tới giỏ hàng
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {cartItemsCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-24 left-3 right-3 lg:hidden z-40 bg-[#FF6B35] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all font-bold text-sm cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag size={20} />
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-extrabold h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border border-white">
                {cartItemsCount}
              </span>
            </div>
            <span className="text-xs text-white/90">Xem giỏ hàng</span>
          </div>
          <span className="font-extrabold text-sm sm:text-base">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      <MapModal2
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={user?.lat || DEFAULT_LAT}
        initialLng={user?.lng || DEFAULT_LNG}
        showLabelSelector={false}
      />
    </div>
  );
}