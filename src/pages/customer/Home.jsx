import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { Search, MapPin, ShoppingBag, Star, Clock, Heart, Award, ArrowRight, RotateCcw, Sparkles, ChevronDown } from 'lucide-react';
import { formatCurrency, removeVietnameseTones, normalizeForMatch } from '../../utils/format';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import MapModal from '../../components/common/MapModal';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import { mapRestaurant } from '../../utils/mappers';
import FilterTabs from '../../components/common/FilterTabs';
import { getCategoryIcon } from '../../utils/iconMap';
import HeroCarousel from '../../components/customer/HeroCarousel';

const CATEGORIES = [
  { id: 'all', name: 'Tất cả', icon: '🍽️' },
  { id: 'com', name: 'Cơm Tấm', icon: '🍜' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'sushi', name: 'Sushi', icon: '🍣' },
  { id: 'salad', name: 'Salad', icon: '🥗' },
  { id: 'drink', name: 'Trà Sữa', icon: '🧋' },
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavorites] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [sortByFilter, setSortByFilter] = useState('distance'); // distance, rating, ship
  const [isMapOpen, setIsMapOpen] = useState(false);

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

  const scrollToExploreAndFilter = (filterType) => {
    setSortByFilter(filterType);
    const element = document.getElementById('explore-restaurants-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
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
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật yêu thích:', err);
    }
  };

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
        shipping: dist <= 2 ? 'Miễn phí giao hàng' : 'Phí ship rẻ',
        shippingFee: shippingFee,
      };
    });
  }, [restaurants, user?.lat, user?.lng]);

  const filteredRestaurants = useMemo(() => {
    return restaurantsWithDistance.filter((res) => {
      const nameNorm = normalizeForMatch(res.name);
      const queryNorm = normalizeForMatch(searchQuery);
      
      const matchesSearch = nameNorm.includes(queryNorm) ||
                            res.tags.some(tag => normalizeForMatch(tag).includes(queryNorm));
      
      if (activeCategory === 'all') return matchesSearch;
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      if (!cat) return matchesSearch;
      const catNameNorm = normalizeForMatch(cat.name);
      
      return matchesSearch && res.tags.some(tag => {
        const tagNorm = normalizeForMatch(tag);
        return tagNorm.includes(catNameNorm) || catNameNorm.includes(tagNorm) ||
               (cat.id === 'com' && (tagNorm.includes('com') || tagNorm.includes('rice') || tagNorm.includes('suon'))) ||
               (cat.id === 'drink' && (tagNorm.includes('sua') || tagNorm.includes('milktea') || tagNorm.includes('tra') || tagNorm.includes('cafe')));
      });
    });
  }, [restaurantsWithDistance, searchQuery, activeCategory]);

  const featuredRestaurants = useMemo(() => {
    // Sắp xếp theo rating giảm dần, sau đó theo reviewsCount (lượt đánh giá) giảm dần
    const sorted = [...filteredRestaurants].sort((a, b) => {
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
    return unique.slice(0, 8);
  }, [filteredRestaurants]);

  // ĐẶT LẠI QUÁN CŨ (ORDER AGAIN)
  const orderAgainRestaurants = useMemo(() => {
    if (pastOrders.length === 0) return [];
    
    // Lọc ra các quán đã đặt thành công và loại bỏ trùng lặp
    const orderedResIds = [...new Set(pastOrders.map(ord => ord.restaurantId?.toString()).filter(Boolean))];
    
    return restaurantsWithDistance.filter(res => orderedResIds.includes(res.id)).slice(0, 5);
  }, [pastOrders, restaurantsWithDistance]);

  // ĐỀ XUẤT THÔNG MINH DỰA TRÊN LỊCH SỬ MÓN ĂN
  const { recommendedRestaurants, favCuisineName } = useMemo(() => {
    // Thu thập tất cả tên món đã đặt để đếm tần suất từ khoá
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

    // Các từ khoá đặc trưng tương ứng với tags ẩm thực phổ biến
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

    // Tìm từ khóa ưa thích nhất
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

    // Lọc các quán có liên quan theo sở thích của user
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

    // FALLBACK: Nếu không tìm thấy quán nào theo sở thích hoặc user chưa đặt đơn nào, gợi ý các quán hot nhất (rating cao, reviewsCount nhiều)
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
      recommendedRestaurants: uniqueRecom.slice(0, 8), 
      favCuisineName: maxCount > 0 ? favName : 'Được đánh giá cao' 
    };
  }, [pastOrders, restaurantsWithDistance]);

  // SẮP XẾP DÀNH CHO LƯỚT QUÁN GẦN BẠN
  const nearByRestaurants = useMemo(() => {
    return [...filteredRestaurants].sort((a, b) => {
      if (sortByFilter === 'rating') {
        return b.rating - a.rating; // Sắp xếp rating cao lên đầu
      }
      if (sortByFilter === 'ship') {
        return a.shippingFee - b.shippingFee; // Phí ship rẻ nhất lên đầu
      }
      return a.distanceNum - b.distanceNum; // Sắp xếp khoảng cách gần lên đầu
    });
  }, [filteredRestaurants, sortByFilter]);

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

  return (
    <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full font-google-sans pb-24">
      {/* Bố cục dashboard: cột feed chính (trái) + panel đơn hàng/địa chỉ (phải, desktop lg+) */}
      <div className="flex gap-8 items-start">
        {/* ═══ CỘT CHÍNH: feed khám phá món ═══ */}
        <div className="flex-1 min-w-0">

      {/* ─── HEADER (lời chào + chip địa chỉ giao hàng) ─────────────────────────── */}
      <div className="mb-8">
        <div className="min-w-0">
          {/* Lời chào — đã bỏ emoji 🔍 */}
          <h1 className="text-2xl md:text-3xl font-extrabold text-md-on-surface tracking-tight">
            Bạn muốn ăn gì hôm nay?
          </h1>
          {/* Chip địa chỉ giao hàng: bấm mở MapModal, icon MapPin thay cho emoji 📍 */}
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="inline-flex items-center gap-2 max-w-full px-4.5 py-2 bg-gradient-to-r from-md-primary/10 to-md-secondary/5 text-md-primary rounded-radius-full text-sm font-extrabold mt-3.5 cursor-pointer border border-md-primary/15 hover:from-md-primary/20 hover:to-md-secondary/15 transition-all shadow-sm"
          >
            <MapPin size={16} className="shrink-0" />
            <span className={`truncate ${!user?.address ? "text-amber-600 animate-pulse" : ""}`}>
              {user?.address ? (user.address.length > 40 ? user.address.slice(0, 40) + '...' : user.address) : 'Vui lòng chọn địa chỉ giao hàng'}
            </span>
            <ChevronDown size={14} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* ─── SEARCH BAR (Pill Shape & Expand on focus) ─────────────────────────── */}
      <div className="mb-8 relative z-20">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm món ăn, trà sữa, quán cơm tấm..."
          icon={Search}
          className="w-full"
        />
      </div>

      {/* ─── HERO CAROUSEL: QUÁN NỔI BẬT (điểm nhấn kích thích thèm ăn) ─────────── */}
      {/* Dùng lại danh sách featuredRestaurants đã tính sẵn (data thật), bấm vào mở quán. */}
      {featuredRestaurants.length > 0 && (
        <div className="mb-10">
          <HeroCarousel
            items={featuredRestaurants.slice(0, 6)}
            onSelect={(res) => navigate(`/restaurants/${res.id}`)}
          />
        </div>
      )}

      {/* ─── CATEGORY CHIPS (Horizontal snap scroll) ───────────────────────────── */}
      <div className="mb-10 overflow-hidden">
        <h3 className="text-sm font-extrabold text-md-on-surface-variant uppercase tracking-wider mb-4">
          Danh mục ẩm thực
        </h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x py-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`snap-start shrink-0 flex items-center gap-3 px-6 py-3.5 rounded-radius-full text-base font-bold transition-all duration-200 border ${
                  isActive
                    ? 'bg-md-primary text-white border-md-primary shadow-shadow-3 scale-105'
                    : 'bg-white text-md-on-surface border-md-outline-variant/50 hover:bg-md-surface-variant/40'
                }`}
              >
                {(() => {
                  // Render icon lucide theo id danh mục (thay cho emoji cũ trong CATEGORIES)
                  const CatIcon = getCategoryIcon(cat.id);
                  return <CatIcon size={18} className="shrink-0" />;
                })()}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── CAROUSEL: ORDER AGAIN ────────────────────────────────────────────── */}
      {orderAgainRestaurants.length > 0 && (
        <div className="mb-12 overflow-hidden animate-fade-in">
          <h2 className="text-lg md:text-xl font-extrabold text-md-on-surface mb-4 flex items-center gap-2">
            <RotateCcw className="text-md-primary" size={20} /> Đặt Lại Quán Cũ
          </h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-1.5">
            {orderAgainRestaurants.map((res) => (
              <Card
                key={`again-${res.id}`}
                variant="elevated"
                hoverEffect
                onClick={() => navigate(`/restaurants/${res.id}`)}
                className="shrink-0 w-60 p-3 flex flex-col gap-2.5 shadow-sm border border-slate-100 bg-white"
              >
                <div className="w-full h-28 rounded-radius-md overflow-hidden shrink-0">
                  <img src={res.image} alt={res.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-md-on-surface truncate leading-snug">{res.name}</h3>
                  <div className="flex items-center justify-between text-[10px] text-md-on-surface-variant mt-2 font-bold">
                    <span className="flex items-center gap-0.5 text-amber-500">
                      ★ {res.rating}
                    </span>
                    <span>{res.distance}</span>
                    <span>{res.time}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── FEATURED CAROUSEL (Floating cards, 16:9 images) ────────────────────── */}
      {featuredRestaurants.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-extrabold text-md-on-surface flex items-center gap-2.5">
              <Award className="text-md-primary" size={24} />
              Quán Nổi Bật
            </h2>
            <span 
              onClick={() => scrollToExploreAndFilter('rating')}
              className="text-sm font-extrabold text-md-primary flex items-center gap-1 cursor-pointer hover:underline"
            >
              Xem thêm <ArrowRight size={16} />
            </span>
          </div>

          <div className="flex md:grid gap-6 overflow-x-auto md:overflow-visible no-scrollbar py-2.5 snap-x md:snap-none scroll-smooth md:grid-cols-2 xl:grid-cols-3">
            {featuredRestaurants.map((res) => (
              <Card
                key={res.id}
                variant="elevated"
                hoverEffect
                onClick={() => navigate(`/restaurants/${res.id}`)}
                className="relative shrink-0 w-80 md:w-full md:shrink snap-start"
              >
                {/* Favorite button */}
                <button
                  onClick={(e) => toggleFavorite(res.id, e)}
                  className="absolute right-4 top-4 bg-white/90 backdrop-blur-md p-2.5 rounded-radius-full text-md-on-surface-variant hover:text-red-500 hover:scale-110 active:scale-95 transition-all shadow-shadow-1 z-10"
                >
                  <Heart size={18} className={favorites.includes(res.id) ? 'fill-red-500 text-red-500' : ''} />
                </button>

                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={res.image}
                    alt={res.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                    {res.tags.slice(0, 2).map((tag, i) => (
                      <span key={i} className="text-[11px] bg-black/70 text-white font-extrabold px-2.5 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-5.5">
                  <h3 className="font-extrabold text-lg text-md-on-surface truncate leading-tight">{res.name}</h3>
                  
                  <div className="flex items-center gap-4.5 mt-4 text-sm text-md-on-surface-variant">
                    <span className="flex items-center gap-1 font-extrabold text-amber-500">
                      <Star size={16} className="fill-amber-500" />
                      {res.rating} ({res.reviewsCount} đánh giá)
                    </span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock size={16} />
                      {res.time}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-md-outline-variant/30 flex items-center justify-between">
                    <span className="text-xs font-extrabold bg-[#E8F5E9] text-[#2E7D32] px-3 py-1 rounded">
                      {res.shipping}
                    </span>
                    <span className="text-xs text-[#FF6B35] font-extrabold bg-[#FFE8DF] px-2.5 py-1 rounded">
                      Đã bán {res.orderCount || 0} đơn
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── CAROUSEL: RECOMMENDED FOR YOU ──────────────────────────────────────── */}
      {recommendedRestaurants.length > 0 && (
        <div className="mb-12 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl md:text-2xl font-extrabold text-md-on-surface flex items-center gap-2">
              <Sparkles className="text-md-primary" size={22} /> Dành Riêng Cho Bạn
              <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-bold text-md-primary bg-md-primary-container/20 px-3 py-1.5 rounded-full uppercase tracking-wider ml-1">
                {favCuisineName === 'Được đánh giá cao'
                  ? (<><Sparkles size={12} /> Gợi ý hot</>)
                  : (<><Heart size={12} className="fill-md-primary" /> Thích: {favCuisineName}</>)}
              </span>
            </h2>
          </div>
          <div className="flex md:grid gap-4 md:gap-6 overflow-x-auto md:overflow-visible no-scrollbar py-1.5 snap-x md:snap-none scroll-smooth md:grid-cols-2 xl:grid-cols-3">
            {recommendedRestaurants.map((res) => (
              <Card
                key={`recom-${res.id}`}
                variant="elevated"
                hoverEffect
                onClick={() => navigate(`/restaurants/${res.id}`)}
                className="shrink-0 w-68 md:w-full md:shrink p-4 relative border border-slate-100 bg-white snap-start"
              >
                {/* Rating flag */}
                <span className="absolute left-6 top-6 text-[10px] bg-md-primary text-white font-extrabold px-2 py-0.5 rounded shadow-sm z-10">
                  ★ {res.rating}
                </span>
                
                <div className="w-full h-36 rounded-radius-md overflow-hidden shrink-0">
                  <img src={res.image} alt={res.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="pt-3">
                  <h3 className="font-extrabold text-sm text-md-on-surface truncate leading-snug">{res.name}</h3>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-0.5 text-amber-500 font-extrabold">
                      ★ {res.rating}
                    </span>
                    <span>Đã bán {res.orderCount || 0} đơn</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-md-on-surface-variant font-bold">
                    <span>{res.distance}</span>
                    <span>{res.time}</span>
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {res.shippingFee === 15000 ? 'Ship rẻ' : 'Giao nhanh'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── VERTICAL LIST: NEARBY RESTAURANTS ──────────────────────────────────── */}
      <div id="explore-restaurants-section" className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-md-on-surface">Khám Phá Quán Ăn</h2>
          
          {/* Advanced Sorting Filter Tabs */}
          <FilterTabs
            tabs={[
              { id: 'distance', label: 'Gần nhất' },
              { id: 'rating', label: 'Đánh giá cao' },
              { id: 'ship', label: 'Phí ship rẻ' }
            ]}
            activeTab={sortByFilter}
            onTabChange={setSortByFilter}
            className="bg-slate-100 p-1 rounded-radius-full w-max text-xs font-bold shrink-0"
          />
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonRestaurantCard />
            <SkeletonRestaurantCard />
            <SkeletonRestaurantCard />
            <SkeletonRestaurantCard />
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
            <ShoppingBag size={56} className="mx-auto text-md-outline/40 mb-4" />
            <p className="text-base font-extrabold text-md-on-surface-variant">Không tìm thấy quán ăn phù hợp</p>
            <p className="text-sm text-md-outline mt-1.5">Vui lòng thử tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {nearByRestaurants.map((res) => (
              <Card
                key={res.id}
                variant="elevated"
                hoverEffect
                onClick={() => navigate(`/restaurants/${res.id}`)}
                className="p-4.5 flex gap-5"
              >
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-radius-lg overflow-hidden shrink-0">
                  <img src={res.image} alt={res.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-extrabold text-base sm:text-lg text-md-on-surface truncate leading-snug">
                        {res.name}
                      </h3>
                      <button
                        onClick={(e) => toggleFavorite(res.id, e)}
                        className="text-md-outline hover:text-red-500 transition-colors p-1"
                      >
                        <Heart size={18} className={favorites.includes(res.id) ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {res.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-md-on-surface-variant px-2.5 py-0.5 rounded font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs sm:text-sm text-md-on-surface-variant mt-3">
                    <span className="flex items-center gap-0.5 font-extrabold text-amber-500">
                      <Star size={15} className="fill-amber-500" />
                      {res.rating}
                    </span>
                    <span className="flex items-center gap-0.5 font-semibold">
                      <Clock size={15} />
                      {res.time}
                    </span>
                    <span className="font-semibold">{res.distance}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                    <span className="text-xs font-extrabold text-md-primary">
                      {res.shipping}
                    </span>
                    <span className="text-xs text-md-outline font-extrabold">
                      Giá TB: ~{formatCurrency(res.avgPrice)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        
        {hasMore && (
          <div className="flex justify-center mt-10">
            <button
              onClick={loadMoreRestaurants}
              disabled={loadingMore}
              className="px-8 py-3.5 bg-white border border-[#FF6B35] text-[#FF6B35] hover:bg-[#FF6B35]/5 disabled:border-slate-350 disabled:text-slate-400 font-extrabold text-sm rounded-radius-full shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></span>
                  Đang tải thêm...
                </>
              ) : (
                'Tải thêm quán ăn'
              )}
            </button>
          </div>
        )}
      </div>
        </div>
        {/* ═══ PANEL PHẢI: địa chỉ giao + tóm tắt giỏ hàng (chỉ desktop lg+) ═══ */}
        {/* Toàn bộ dữ liệu lấy từ user & cartStore đã có — KHÔNG thêm logic mới. */}
        <aside className="hidden lg:block w-80 shrink-0 sticky top-6 space-y-4">
          {/* Thẻ địa chỉ giao hàng (bấm "Đổi" mở MapModal sẵn có) */}
          <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={15} className="text-md-primary" /> Giao tới
              </h3>
              <button onClick={() => setIsMapOpen(true)} className="text-[11px] font-extrabold text-md-primary hover:underline">Đổi</button>
            </div>
            <p className="text-xs text-md-on-surface-variant font-semibold leading-relaxed">
              {user?.address || 'Chưa chọn địa chỉ giao hàng'}
            </p>
          </div>

          {/* Thẻ tóm tắt giỏ hàng (carts từ cartStore) */}
          <div className="bg-white rounded-radius-xl p-5 border border-md-outline-variant/20 shadow-sm">
            <h3 className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <ShoppingBag size={15} className="text-md-primary" /> Giỏ hàng của bạn
            </h3>
            {cartItemsCount === 0 ? (
              <p className="text-xs text-md-outline font-semibold py-2">Chưa có món nào trong giỏ.</p>
            ) : (
              <>
                {/* Hiển thị GỌN theo từng quán (tên + số món + tổng tiền quán) để panel
                    không bị kéo dài khi giỏ có quá nhiều món. Có scroll nếu nhiều quán. */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto no-scrollbar">
                  {carts.map((cart) => {
                    const itemCount = (cart.items || []).reduce((s, it) => s + it.quantity, 0);
                    return (
                      <div key={cart.restaurantId} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-md-on-surface truncate">{cart.restaurantName}</p>
                          <p className="text-[11px] text-md-on-surface-variant font-semibold">{itemCount} món</p>
                        </div>
                        <span className="text-xs font-extrabold text-md-on-surface shrink-0">{formatCurrency(cart.subtotal || 0)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                  <span className="text-xs font-bold text-md-on-surface-variant">Tổng ({cartItemsCount} món)</span>
                  <span className="text-base font-extrabold text-md-primary">{formatCurrency(cartTotal)}</span>
                </div>
                <button onClick={() => navigate('/cart')} className="w-full mt-3 bg-md-primary text-white font-extrabold py-2.5 rounded-radius-full text-sm hover:bg-opacity-95 transition-all">
                  Tới giỏ hàng
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ─── FLOATING CART FAB (chỉ mobile/tablet; desktop đã có panel phải) ───── */}
      {cartItemsCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-24 left-6 md:left-auto md:right-80 z-40 lg:hidden bg-md-primary text-white pl-5 pr-6 py-3.5 rounded-radius-full shadow-shadow-5 flex items-center gap-3.5 hover:scale-105 active:scale-95 transition-all font-extrabold text-base"
        >
          <div className="relative">
            <ShoppingBag size={22} />
            <span className="absolute -top-1.5 -right-2.5 bg-md-error text-white text-[10px] font-extrabold h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border border-md-primary shadow-md">
              {cartItemsCount}
            </span>
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] text-white/85 font-bold">Giỏ hàng của bạn</span>
            <span className="mt-1">{formatCurrency(cartTotal)}</span>
          </div>
        </button>
      )}

      {/* ─── MAP MODAL ───────────────────────────────────────────────────────── */}
      <MapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={user?.lat || 10.762622}
        initialLng={user?.lng || 106.660172}
      />

    </div>
  );
}
