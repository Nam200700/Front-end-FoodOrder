import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  Search, MapPin, ShoppingBag, Star, Clock, Heart, Award, 
  ArrowRight, RotateCcw, Sparkles, ChevronDown, Filter, 
  Flame, ThumbsUp, SlidersHorizontal, Check, RefreshCw, X, Utensils,
  TrendingUp, ShieldCheck, Zap, Percent, Compass, ChevronRight, Tag
} from 'lucide-react';
import { formatCurrency, removeVietnameseTones, normalizeForMatch } from '../../utils/format';
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
  { id: 'drink', name: 'Trà Sữa & Cafe' },
  { id: 'ga', name: 'Gà Rán' },
  { id: 'bun', name: 'Bún & Phở' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'anvat', name: 'Ăn Vặt' },
];

export default function Home() {
  const navigate = useNavigate();
  const carts = useCartStore((state) => state.carts);
  const cartItemsCount = carts.reduce((total, cart) => total + (cart.items || []).reduce((sum, item) => sum + item.quantity, 0), 0);
  const cartTotal = carts.reduce((sum, cart) => sum + (cart.subtotal || 0), 0);
  const { user, updateProfile } = useAuthStore();
  
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavorites] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [sortByFilter, setSortByFilter] = useState('distance'); 
  const [isMapOpen, setIsMapOpen] = useState(false);

  // States quản lý số lượng hiển thị thêm ở các phần Quán Nổi Bật và Dành Riêng Cho Bạn
  const [visibleFeaturedCount, setVisibleFeaturedCount] = useState(6);
  const [visibleRecomCount, setVisibleRecomCount] = useState(4);

  // Quick filters
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyHighRating, setOnlyHighRating] = useState(false);
  const [onlyCheapShip, setOnlyCheapShip] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setPage(0);
        setHasMore(true);
        const response = await apiClient.get('/restaurants?page=0&size=6');
        const realData = response.data?.data?.content || [];
        const isLast = response.data?.data?.last || (realData.length < 6);
        setHasMore(!isLast);
        if (realData.length > 0) {
          const mapped = realData.map(mapRestaurant).filter(Boolean);
          setRestaurants(mapped);
        } else {
          setRestaurants([]);
        }
      } catch (error) {
        console.error('Lỗi khi tải danh sách quán ăn từ Backend:', error);
        setRestaurants([]); 
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurants();

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

  const loadMoreRestaurants = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await apiClient.get(`/restaurants?page=${nextPage}&size=6`);
      const realData = response.data?.data?.content || [];
      const isLast = response.data?.data?.last || (realData.length < 6);
      setHasMore(!isLast);
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

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 150) {
        if (hasMore && !loadingMore && !loading) {
          loadMoreRestaurants();
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, hasMore, loadingMore, loading]);

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
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật yêu thích:', err);
    }
  };

  // Tính khoảng cách Haversine từ vị trí User tới từng Quán ăn
  const restaurantsWithDistance = useMemo(() => {
    const customerLat = user?.lat || 10.762622;
    const customerLng = user?.lng || 106.660172;

    return restaurants.map((res) => {
      const lat = Number(res.latitude);
      const lng = Number(res.longitude);
      let dist = 1.0;
      if (!isNaN(lat) && !isNaN(lng)) {
        dist = calculateHaversineDistance(lat, lng, customerLat, customerLng);
      }
      
      const duration = Math.max(10, Math.round(dist * 5 + 5));
      const shippingFee = Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000);

      return {
        ...res,
        distance: `${dist.toFixed(1)}km`,
        distanceNum: dist,
        time: `${Math.max(10, duration - 3)}-${duration + 3} phút`,
        shipping: shippingFee <= 15000 ? 'Phí ship rẻ' : shippingFee <= 20000 ? 'Phí ship vừa' : 'Phí ship cao',
        shippingFee: shippingFee,
      };
    });
  }, [restaurants, user?.lat, user?.lng]);

  // Bộ lọc tổng hợp dành cho "Khám Phá Quán Ăn"
  const filteredRestaurants = useMemo(() => {
    return restaurantsWithDistance.filter((res) => {
      // 1. Tìm kiếm từ khóa (Khớp với tên quán, mô tả, hoặc tags)
      const nameNorm = removeVietnameseTones(res.name || '');
      const descNorm = removeVietnameseTones(res.description || '');
      const queryNorm = removeVietnameseTones(searchQuery || '');
      
      const matchesSearch = !queryNorm || 
        nameNorm.includes(queryNorm) || 
        descNorm.includes(queryNorm) ||
        (res.tags && res.tags.some(tag => removeVietnameseTones(tag).includes(queryNorm)));

      if (!matchesSearch) return false;

      // 2. Lọc danh mục (Khớp với tên danh mục chọn)
      if (activeCategory !== 'all') {
        const tagsNorm = (res.tags || []).map(t => removeVietnameseTones(t)).join(' ');
        const catsNorm = (res.categories || []).map(c => typeof c === 'string' ? removeVietnameseTones(c) : removeVietnameseTones(c.name || '')).join(' ');
        const fullText = `${nameNorm} ${descNorm} ${tagsNorm} ${catsNorm}`.toLowerCase();

        let categoryMatch = false;
        if (activeCategory === 'com') {
          categoryMatch = fullText.includes('com') || fullText.includes('rice') || fullText.includes('suon') || fullText.includes('tam');
        } else if (activeCategory === 'drink') {
          categoryMatch = fullText.includes('tra') || fullText.includes('sua') || fullText.includes('cafe') || fullText.includes('coffee') || fullText.includes('tea') || fullText.includes('drink') || fullText.includes('sinh to') || fullText.includes('nuoc');
        } else if (activeCategory === 'ga') {
          categoryMatch = fullText.includes('ga') || fullText.includes('chicken') || fullText.includes('ran') || fullText.includes('canh ga');
        } else if (activeCategory === 'bun') {
          categoryMatch = fullText.includes('bun') || fullText.includes('pho') || fullText.includes('mi') || fullText.includes('hu tieu') || fullText.includes('noodle') || fullText.includes('ramen');
        } else if (activeCategory === 'pizza') {
          categoryMatch = fullText.includes('pizza') || fullText.includes('y') || fullText.includes('pasta');
        } else if (activeCategory === 'anvat') {
          categoryMatch = fullText.includes('vat') || fullText.includes('snack') || fullText.includes('banh') || fullText.includes('che');
        } else {
          const catObj = CATEGORIES.find(c => c.id === activeCategory);
          if (catObj) {
            const catNorm = removeVietnameseTones(catObj.name).toLowerCase();
            categoryMatch = fullText.includes(catNorm);
          }
        }

        if (!categoryMatch) return false;
      }

      // 3. Lọc chỉ quán đang mở
      if (onlyOpen && res.status === false) return false;

      // 4. Lọc đánh giá cao (>= 4.5 star)
      if (onlyHighRating && (res.rating || 0) < 4.5) return false;

      // 5. Lọc phí ship rẻ (<= 15.000đ)
      if (onlyCheapShip && (res.shippingFee || 0) > 15000) return false;

      // 6. Lọc quán yêu thích
      if (onlyFavorites && !favorites.includes(res.id)) return false;

      return true;
    });
  }, [restaurantsWithDistance, searchQuery, activeCategory, onlyOpen, onlyHighRating, onlyCheapShip, onlyFavorites, favorites]);

  // SẮP XẾP DÀNH CHO SECTION "KHÁM PHÁ QUÁN ĂN"
  const nearByRestaurants = useMemo(() => {
    return [...filteredRestaurants].sort((a, b) => {
      if (sortByFilter === 'rating') {
        return b.rating - a.rating;
      }
      if (sortByFilter === 'ship') {
        return a.shippingFee - b.shippingFee;
      }
      if (sortByFilter === 'orders') {
        return (b.orderCount || 0) - (a.orderCount || 0);
      }
      // Mặc định: Gần nhất (Sắp xếp khoảng cách km từ nhỏ nhất đến lớn nhất)
      return a.distanceNum - b.distanceNum;
    });
  }, [filteredRestaurants, sortByFilter]);

  // QUÁN NỔI BẬT ĐÁNH GIÁ CAO: Lọc dựa trên rating giảm dần + reviewsCount lượt đánh giá
  const featuredRestaurants = useMemo(() => {
    const sorted = [...restaurantsWithDistance].sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
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
  }, [restaurantsWithDistance]);

  // ĐẶT LẠI QUÁN CỦ: Lọc dựa trên lịch sử order đã từng mua hàng thành công
  const orderAgainRestaurants = useMemo(() => {
    if (pastOrders.length === 0) return [];
    const orderedResIds = [...new Set(pastOrders.map(ord => ord.restaurantId?.toString()).filter(Boolean))];
    return restaurantsWithDistance.filter(res => orderedResIds.includes(res.id)).slice(0, 8);
  }, [pastOrders, restaurantsWithDistance]);

  // DÀNH RIÊNG CHO BẠN: Lọc thông minh dựa trên phân tích tần suất món ăn đã mua
  const { recommendedRestaurants, favCuisineName } = useMemo(() => {
    const allOrderedFoods = [];
    pastOrders.forEach(ord => {
      if (ord.items) {
        ord.items.forEach(item => {
          if (item.foodName) {
            allOrderedFoods.push(item.foodName);
          }
        });
      }
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
      { key: 'sua', label: 'Trà Sữa' }
    ];

    const counts = {};
    keywords.forEach(kw => { counts[kw.key] = 0; });

    allOrderedFoods.forEach(food => {
      const normFood = removeVietnameseTones(food);
      keywords.forEach(kw => {
        if (normFood.includes(kw.key)) {
          counts[kw.key]++;
        }
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
      recommended = restaurantsWithDistance.filter(res => {
        const nameNorm = removeVietnameseTones(res.name);
        const tagsNorm = res.tags.map(t => removeVietnameseTones(t));
        
        return nameNorm.includes(maxKey) || tagsNorm.some(t => t.includes(maxKey)) || 
               nameNorm.includes(favNorm) || tagsNorm.some(t => t.includes(favNorm)) ||
               (maxKey === 'com' && (nameNorm.includes('rice') || tagsNorm.some(t => t.includes('com') || t.includes('rice')))) ||
               (maxKey === 'ga' && (nameNorm.includes('chicken') || tagsNorm.some(t => t.includes('ga') || t.includes('chicken')))) ||
               (maxKey === 'bun' && (nameNorm.includes('pho') || tagsNorm.some(t => t.includes('bun') || t.includes('pho') || t.includes('soup'))));
      });
    }

    if (recommended.length === 0) {
      recommended = [...restaurantsWithDistance]
        .sort((a, b) => {
          if (b.rating !== a.rating) {
            return b.rating - a.rating;
          }
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
      favCuisineName: maxCount > 0 ? favName : 'Được đánh giá cao' 
    };
  }, [pastOrders, restaurantsWithDistance]);

  const handleConfirmLocation = async (lat, lng, addressName) => {
    try {
      updateProfile({
        address: addressName,
        lat: lat,
        lng: lng
      });
      await apiClient.put('/users/profile', {
        address: addressName,
        latitude: lat,
        longitude: lng
      });
    } catch (err) {
      console.warn('Lỗi đồng bộ địa chỉ lên server:', err);
    }
  };

  const isFilterActive = searchQuery !== '' || activeCategory !== 'all' || sortByFilter !== 'distance' || onlyOpen || onlyHighRating || onlyCheapShip || onlyFavorites;

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSortByFilter('distance');
    setOnlyOpen(false);
    setOnlyHighRating(false);
    setOnlyCheapShip(false);
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
          
          {/* Chip chọn địa chỉ giao hàng - Mở MapModal2 */}
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

      {/* ═══ SEARCH BAR & CATEGORY FILTERS ═══ */}
      <div className="space-y-3.5 mb-8">
        {/* Thanh tìm kiếm - KHÔNG CÓ THẺ HAY KHUNG BAO QUANH Ở NGOÀI */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên quán, món ăn (ví dụ: Cơm tấm, Trà sữa, Gà rán...)..."
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

        {/* Thanh danh mục ẩm thực (Horizontal chips scroll responsive) */}
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

      {/* Bố cục dashboard: Cột chính (trái) + Panel giỏ hàng (phải, desktop lg+) */}
      <div className="flex gap-6 lg:gap-8 items-start">
        {/* ═══ CỘT CHÍNH ═══ */}
        <div className="flex-1 min-w-0 space-y-8 md:space-y-10">

          {/* ════════════════════════════════════════════════════════════════════
              🔴 SECTION 1: KHÁM PHÁ QUÁN ĂN (VỊ TRÍ ƯU TIÊN TRÊN ĐẦU)
             ════════════════════════════════════════════════════════════════════ */}
          <div id="explore-restaurants-section" className="space-y-4">
            {/* Header section & counter */}
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

              {/* Tabs sắp xếp chính */}
              <FilterTabs
                tabs={[
                  { id: 'distance', label: 'Gần nhất' },
                  { id: 'rating', label: 'Đánh giá cao' },
                  { id: 'orders', label: 'Bán chạy' },
                  { id: 'ship', label: 'Phí ship rẻ' }
                ]}
                activeTab={sortByFilter}
                onTabChange={setSortByFilter}
                className="bg-slate-100 p-1 rounded-xl w-max text-xs font-bold shrink-0 self-start sm:self-auto"
              />
            </div>

            {/* Quick Filter Badges (Bộ lọc nhanh) */}
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
                onClick={() => setOnlyHighRating(!onlyHighRating)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  onlyHighRating
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Star size={13} className={onlyHighRating ? 'fill-white' : 'text-amber-500'} />
                <span>Đánh giá 4.5★+</span>
                {onlyHighRating && <Check size={12} className="ml-0.5" />}
              </button>

              <button
                onClick={() => setOnlyCheapShip(!onlyCheapShip)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  onlyCheapShip
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <TrendingUp size={13} />
                <span>Ship ≤ 15k</span>
                {onlyCheapShip && <Check size={12} className="ml-0.5" />}
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

            {/* Grid Quán Ăn */}
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
                      {/* Heart Favorite Button */}
                      <button
                        onClick={(e) => toggleFavorite(res.id, e)}
                        className="absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer"
                      >
                        <Heart size={16} className={favorites.includes(res.id) ? 'fill-rose-500 text-rose-500' : ''} />
                      </button>

                      {/* Image thumbnail container */}
                      <div>
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                          <img
                            src={res.image}
                            alt={res.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* Rating flag */}
                          <span className="absolute bottom-2.5 left-2.5 text-[10px] bg-black/75 backdrop-blur-sm text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            {res.rating} ({res.reviewsCount})
                          </span>
                          {/* Status Tag */}
                          <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm text-white ${res.status !== false ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                            {res.status !== false ? 'Mở cửa' : 'Tạm đóng'}
                          </span>
                        </div>

                        {/* Content area */}
                        <div className="p-3.5 sm:p-4">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors leading-snug">{res.name}</h3>
                          
                          {/* Time & Distance */}
                          <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock size={13} />
                              {res.time}
                            </span>
                            <span className="font-semibold text-slate-600">{res.distance}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Shipping fee & Orders count */}
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
              
              {/* Nút Tải Thêm Quán Ăn Khác */}
              {hasMore && (
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

          {/* ════════════════════════════════════════════════════════════════════
              🟠 SECTION 2: HERO CAROUSEL & QUÁN NỔI BẬT (ĐÃ BỎ NÚT XEM TẤT CẢ Ở ĐẦU)
             ════════════════════════════════════════════════════════════════════ */}
          {featuredRestaurants.length > 0 && (
            <div className="space-y-5 sm:space-y-6">
              {/* Hero Carousel Banner */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <HeroCarousel
                  items={featuredRestaurants.slice(0, 6)}
                  onSelect={(res) => navigate(`/restaurants/${res.id}`)}
                />
              </div>

              {/* Grid Quán Nổi Bật */}
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
                        className="absolute right-3 top-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm z-10 cursor-pointer"
                      >
                        <Heart size={16} className={favorites.includes(res.id) ? 'fill-rose-500 text-rose-500' : ''} />
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
                            {res.rating} ({res.reviewsCount})
                          </span>
                        </div>

                        <div className="p-3.5 sm:p-4">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                          
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {res.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className="text-[10px] sm:text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                                {tag}
                              </span>
                            ))}
                          </div>

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

                {/* Nút Xem thêm Quán Nổi Bật ở dưới cùng */}
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

          {/* ════════════════════════════════════════════════════════════════════
              🟡 SECTION 3: DÀNH RIÊNG CHO BẠN (ĐÃ BỎ NÚT XEM THÊM Ở ĐẦU)
             ════════════════════════════════════════════════════════════════════ */}
          {recommendedRestaurants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-[#FF6B35]" size={20} /> Dành Riêng Cho Bạn
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF6B35] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {favCuisineName === 'Được đánh giá cao'
                      ? 'Gợi ý hot'
                      : `Thích: ${favCuisineName}`}
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {recommendedRestaurants.slice(0, visibleRecomCount).map((res) => (
                  <Card
                    key={`recom-${res.id}`}
                    variant="elevated"
                    hoverEffect
                    onClick={() => navigate(`/restaurants/${res.id}`)}
                    className="!rounded-2xl p-3 relative border border-slate-200/80 bg-white group hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-100 relative">
                        <img src={res.image} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <span className="absolute left-2 top-2 text-[10px] bg-[#FF6B35] text-white font-bold px-1.5 py-0.5 rounded shadow-sm">
                          ★ {res.rating}
                        </span>
                      </div>
                      
                      <div className="pt-2">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate leading-snug group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                        <div className="flex items-center justify-between mt-1 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                          <span>{res.distance}</span>
                          <span>{res.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        {res.shippingFee <= 15000 ? 'Ship rẻ' : 'Ship vừa'}
                      </span>
                      <span className="text-slate-500 font-semibold">Đã bán {res.orderCount || 0}</span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Nút Xem thêm Gợi ý dành cho bạn ở dưới cùng */}
              {recommendedRestaurants.length > visibleRecomCount && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <button
                    onClick={() => setVisibleRecomCount(prev => prev + 4)}
                    className="px-5 py-2.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center gap-2"
                  >
                    Xem thêm gợi ý dành cho bạn
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              🟢 SECTION 4: ĐẶT LẠI QUÁN CỦ
             ════════════════════════════════════════════════════════════════════ */}
          {orderAgainRestaurants.length > 0 && (
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                <RotateCcw className="text-[#FF6B35]" size={18} /> Đặt Lại Quán Cũ
              </h2>
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                {orderAgainRestaurants.map((res) => (
                  <Card
                    key={`again-${res.id}`}
                    variant="elevated"
                    hoverEffect
                    onClick={() => navigate(`/restaurants/${res.id}`)}
                    className="!rounded-2xl shrink-0 w-48 sm:w-52 p-3 flex flex-col justify-between border border-slate-200/80 bg-white group hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="w-full h-20 sm:h-24 rounded-xl overflow-hidden bg-slate-100">
                        <img src={res.image} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <h3 className="font-bold text-xs text-slate-800 truncate mt-2 group-hover:text-[#FF6B35] transition-colors">{res.name}</h3>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100">
                      <span className="font-bold text-amber-500">★ {res.rating}</span>
                      <span>{res.distance}</span>
                      <span>{res.time}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ═══ ASIDE PANEL (DESKTOP LG+) ═══ */}
        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-6 space-y-4">
          {/* Panel Giỏ Hàng Quick View */}
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

          {/* Panel Thông tin & Cam kết giao hàng */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B35] mb-1.5">
              <ShieldCheck size={16} /> Giao hàng uy tín
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Món ăn được chế biến tươi nóng từ các nhà hàng uy tín, giao tận tay trong 15-30 phút.
            </p>
          </div>
        </aside>
      </div>

      {/* ─── FLOATING CART FAB (Mobile/Tablet) ───── */}
      {cartItemsCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-20 left-3 right-3 lg:hidden z-40 bg-[#FF6B35] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all font-bold text-sm cursor-pointer"
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

      {/* ─── MAP MODAL 2 ───────────────────────────────────────────────────────── */}
      <MapModal2
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={user?.lat || 10.762622}
        initialLng={user?.lng || 106.660172}
        showLabelSelector={false}
      />
    </div>
  );
}
