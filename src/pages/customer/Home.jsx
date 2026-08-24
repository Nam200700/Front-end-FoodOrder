import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Search, MapPin, ShoppingBag, Star, Clock, Heart, Award,
  RotateCcw, Sparkles, ChevronDown, SlidersHorizontal, Check, RefreshCw, X, Utensils,
  LogIn, ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
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


const FILTER_THRESHOLDS = {
  distance: 10,     // km — chỉ hiện quán trong bán kính 10km
  rating: 4.0,       // sao — chỉ hiện quán có đánh giá từ 4.0 trở lên (và phải có review)
  orders: 10,         // đơn — "bán chạy" phải có từ 10 đơn hoàn tất trở lên
  ship: 20000,         // đồng — "phí ship rẻ" phải từ 20.000đ trở xuống
};

const PAGE_SIZE = 6;
const ORDER_AGAIN_SIZE = 6;
const RECOMMENDED_SIZE = 6;
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

  const [currentCoords, setCurrentCoords] = useState({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG
  });

  // Nếu user đã đăng nhập thì lấy từ user.lat/lng, nếu chưa thì lấy từ currentCoords (GPS)
  const customerLat = user?.lat || currentCoords.lat;
  const customerLng = user?.lng || currentCoords.lng;

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
  const [sortByFilter, setSortByFilter] = useState('distance');
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [visibleFeaturedCount, setVisibleFeaturedCount] = useState(6);

  const [visibleExploreCount, setVisibleExploreCount] = useState(PAGE_SIZE);

  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // ═══ ĐẶT LẠI QUÁN CŨ — gọi thẳng /restaurants/order-again ═══
  const [orderAgainList, setOrderAgainList] = useState([]);
  const [orderAgainLoading, setOrderAgainLoading] = useState(true);
  const [orderAgainPage, setOrderAgainPage] = useState(0);
  const [orderAgainHasMore, setOrderAgainHasMore] = useState(false);
  const [orderAgainLoadingMore, setOrderAgainLoadingMore] = useState(false);

  // Debounce ô tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setVisibleExploreCount(PAGE_SIZE);
  }, [debouncedSearch, activeCategory, sortByFilter, onlyOpen, onlyFavorites]);

  useEffect(() => {
    // Nếu chưa đăng nhập (!user), tự động lấy GPS để làm tâm quét quán ăn
    if (!user && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Cập nhật tọa độ thực tế vào state -> tự động kích hoạt tính toán lại khoảng cách
          setCurrentCoords({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn('Người dùng từ chối GPS hoặc lỗi định vị:', error);
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    }
  }, [user]);

  useEffect(() => {
    let ignore = false;

    const usingApiFilter = debouncedSearch.trim() !== '' || activeCategory !== 'all';

    if (!usingApiFilter) {
      if (poolLoading) {
        setLoading(true);
      } else {
        setRestaurants(suggestionPool);
        setPage(Math.max(0, Math.ceil(suggestionPool.length / PAGE_SIZE) - 1));
        setHasMore(suggestionPool.length >= 30);
        setLoading(false);
      }
      return () => { ignore = true; };
    }

    // Lấy danh sách quán ăn (có lọc theo keyword/danh mục).
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
  // section "Nổi bật" và cho "Khám phá" khi không lọc gì.
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

  // Lấy danh sách quán yêu thích
  useEffect(() => {
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
  }, [user?.userId]);

  // ═══ ĐẶT LẠI QUÁN CŨ: 
  useEffect(() => {
    if (!user) {
      setOrderAgainList([]);
      setOrderAgainLoading(false);
      setOrderAgainHasMore(false);
      return;
    }

    let ignore = false;
    (async () => {
      try {
        setOrderAgainLoading(true);
        const response = await apiClient.get(`/restaurants/order-again?page=0&size=${ORDER_AGAIN_SIZE}`);
        if (ignore) return;
        const content = response.data?.data?.content || [];
        setOrderAgainList(content.map(mapRestaurant).filter(Boolean));
        setOrderAgainHasMore(content.length >= ORDER_AGAIN_SIZE);
        setOrderAgainPage(0);
      } catch (err) {
        if (ignore) return;
        console.warn('Lỗi khi tải Đặt lại quán cũ:', err);
        setOrderAgainList([]);
      } finally {
        if (!ignore) setOrderAgainLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, [user?.userId]);

  const loadMoreOrderAgain = async () => {
    if (orderAgainLoadingMore || !orderAgainHasMore) return;
    try {
      setOrderAgainLoadingMore(true);
      const nextPage = orderAgainPage + 1;
      const response = await apiClient.get(`/restaurants/order-again?page=${nextPage}&size=${ORDER_AGAIN_SIZE}`);
      const content = response.data?.data?.content || [];
      setOrderAgainHasMore(content.length >= ORDER_AGAIN_SIZE);

      if (content.length > 0) {
        const mapped = content.map(mapRestaurant).filter(Boolean);
        setOrderAgainList(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const uniqueNew = mapped.filter(r => !existingIds.has(r.id));
          return [...prev, ...uniqueNew];
        });
        setOrderAgainPage(nextPage);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thêm quán cũ:', err);
    } finally {
      setOrderAgainLoadingMore(false);
    }
  };

  // Tải thêm quán ăn từ API cho "Khám Phá Quán Ăn" (giữ nguyên keyword/category hiện tại)
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

  // "Xem thêm quán ăn khác": trước tiên mở rộng thêm 6 quán từ dữ liệu ĐÃ TẢI (pool/restaurants);
  // chỉ khi số cần hiện vượt quá số đã tải và còn hasMore mới gọi thêm API. Nhờ đó mục Khám phá
  // luôn tăng đúng 6 quán mỗi lần bấm, thay vì hiện hết toàn bộ pool ngay từ đầu.
  const handleExploreShowMore = async () => {
    const nextVisible = visibleExploreCount + PAGE_SIZE;
    if (nextVisible > nearByRestaurantsRef.current.length && hasMore) {
      await loadMoreRestaurants();
    }
    setVisibleExploreCount(nextVisible);
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

  // Khoảng cách cho "Đặt lại quán cũ" / "Dành riêng cho bạn" (dữ liệu lấy thẳng từ BE)
  const orderAgainWithDistance = useMemo(
    () => attachDistance(orderAgainList, customerLat, customerLng),
    [orderAgainList, customerLat, customerLng]
  );

  const filteredRestaurants = useMemo(() => {
    return restaurantsWithDistance.filter((res) => {
      if (onlyOpen && res.isOpen === false) return false;
      if (onlyFavorites && !favorites.includes(res.id)) return false;
      return true;
    });
  }, [restaurantsWithDistance, onlyOpen, onlyFavorites, favorites]);

  const nearByRestaurants = useMemo(() => {
    const thresholdFiltered = filteredRestaurants.filter((res) => {
      switch (sortByFilter) {
        case 'distance':
          return res.distanceNum <= FILTER_THRESHOLDS.distance;
        case 'rating':
          return res.reviewsCount > 0 && res.rating >= FILTER_THRESHOLDS.rating;
        case 'orders':
          return (res.orderCount || 0) >= FILTER_THRESHOLDS.orders;
        case 'ship':
          return res.shippingFee <= FILTER_THRESHOLDS.ship;
        default:
          return true;
      }
    });

    return [...thresholdFiltered].sort((a, b) => {
      if (sortByFilter === 'rating') return b.rating - a.rating;
      if (sortByFilter === 'ship') return a.shippingFee - b.shippingFee;
      if (sortByFilter === 'orders') return (b.orderCount || 0) - (a.orderCount || 0);
      return a.distanceNum - b.distanceNum;
    });
  }, [filteredRestaurants, sortByFilter]);

  const nearByRestaurantsRef = React.useRef(nearByRestaurants);
  nearByRestaurantsRef.current = nearByRestaurants;

  const visibleNearByRestaurants = useMemo(
    () => nearByRestaurants.slice(0, visibleExploreCount),
    [nearByRestaurants, visibleExploreCount]
  );

  // QUÁN NỔI BẬT: top rating/review trong pool — hợp lý vì đây là gợi ý chung, không cá nhân hoá.
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

      {/* ═══ SEARCH BAR & CATEGORY FILTERS (search & category đều gọi API, search khớp cả tên quán lẫn tên món) ═══ */}
      <div className="space-y-3.5 mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên quán hoặc tên món ăn"
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

      <div className="w-full">
        <div className="min-w-0 space-y-8 md:space-y-10">

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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                  <SkeletonRestaurantCard />
                </div>
              ) : nearByRestaurants.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <ShoppingBag size={44} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Không tìm thấy quán ăn phù hợp</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {filteredRestaurants.length > 0
                      ? 'Không có quán nào đạt ngưỡng của bộ lọc hiện tại. Vui lòng thử tab sắp xếp khác.'
                      : 'Vui lòng chọn danh mục khác hoặc xóa điều kiện lọc'}
                  </p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {visibleNearByRestaurants.map((res) => (
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

              {!loading && nearByRestaurants.length > 0 && (visibleExploreCount < nearByRestaurants.length || hasMore) && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <button
                    onClick={handleExploreShowMore}
                    disabled={loadingMore}
                    className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 disabled:border-slate-300 disabled:text-slate-400 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                        Đang tải thêm...
                      </>
                    ) : (
                      `Xem thêm quán ăn khác`
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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

              {!user && (
                <div className="bg-white rounded-2xl border border-dashed border-orange-200 p-6 sm:p-8 text-center">
                  <Sparkles className="mx-auto text-[#FF6B35] mb-2" size={28} />
                  <p className="text-sm font-bold text-slate-700">Đăng nhập để xem gợi ý dành riêng cho bạn</p>
                  <p className="text-xs text-slate-500 mt-1">Lưu quán yêu thích và đặt lại các quán đã từng đặt chỉ trong 1 chạm.</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-orange-600 transition-all cursor-pointer"
                  >
                    <LogIn size={14} />
                    Đăng nhập ngay
                  </button>
                </div>
              )}

              {/* ════════ ĐẶT LẠI QUÁN CŨ (gọi thẳng /restaurants/order-again) ════════ */}
              {user && (orderAgainLoading || orderAgainWithDistance.length > 0) && (
                <div>
                  <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                    <RotateCcw className="text-[#FF6B35]" size={18} /> Đặt Lại Quán Cũ
                  </h2>

                  {orderAgainLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                      <SkeletonRestaurantCard />
                      <SkeletonRestaurantCard />
                      <SkeletonRestaurantCard />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {orderAgainWithDistance.map((res) => (
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

                      {orderAgainHasMore && (
                        <div className="flex justify-center mt-6 sm:mt-8">
                          <button
                            onClick={loadMoreOrderAgain}
                            disabled={orderAgainLoadingMore}
                            className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 disabled:border-slate-300 disabled:text-slate-400 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                          >
                            {orderAgainLoadingMore ? (
                              <>
                                <span className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                                Đang tải thêm...
                              </>
                            ) : (
                              'Xem thêm quán cũ'
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

        </div>
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

      {/* ═══ GIỎ HÀNG NỔI (DESKTOP LG+) — thay cột phải cũ, lưới quán dùng trọn chiều ngang ═══ */}
      {cartItemsCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-4 bg-white border border-slate-200 rounded-2xl shadow-xl pl-4 pr-3 py-3 hover:shadow-2xl hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="relative shrink-0">
            <span className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B35] flex items-center justify-center">
              <ShoppingBag size={20} />
            </span>
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-extrabold h-5 min-w-5 px-1 rounded-full flex items-center justify-center border-2 border-white">
              {cartItemsCount}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-none mb-1.5">Giỏ hàng · {cartItemsCount} món</p>
            <p className="text-base font-black text-[#FF6B35] leading-none">{formatCurrency(cartTotal)}</p>
          </div>
          <span className="ml-1 inline-flex items-center gap-1 bg-[#FF6B35] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl group-hover:bg-orange-600 transition-colors">
            Tới giỏ <ArrowRight size={14} />
          </span>
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