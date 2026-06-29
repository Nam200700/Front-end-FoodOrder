import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flame, TrendingUp, Compass, Clock, Star, MapPin, Store, ArrowLeft, Utensils } from 'lucide-react';
import { formatCurrency, removeVietnameseTones } from '../../utils/format';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../services/api';
import { mapRestaurant } from '../../utils/mappers';
import { calculateHaversineDistance } from '../../utils/haversine';

export default function Explore() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  
  // Tọa độ người dùng thực tế
  const userLat = user?.latitude || user?.lat;
  const userLng = user?.longitude || user?.lng;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState('DELIVERY');
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('meal_dash_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  // States lưu dữ liệu thật nạp từ Backend
  const [restaurants, setRestaurants] = useState([]);
  const [allFoods, setAllFoods] = useState([]);
  const [hotKeywords, setHotKeywords] = useState([]);
  const [trendingFoods, setTrendingFoods] = useState([]);

  // Tải danh sách quán ăn & món ăn thật từ Backend
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Tải toàn bộ danh sách quán ăn đang mở cửa
        const resResponse = await apiClient.get('/restaurants');
        const resList = resResponse.data?.data?.content || resResponse.data?.data || [];

        // Ánh xạ dữ liệu quán ăn bằng mapRestaurant dùng chung
        const mappedRestaurants = resList.map(res => {
          const mapped = mapRestaurant(res);
          const distanceValue = calculateHaversineDistance(userLat, userLng, mapped.latitude, mapped.longitude);
          const distanceStr = distanceValue ? `${distanceValue}km` : '0.8km';
          return {
            ...mapped,
            distance: distanceStr,
            distanceVal: distanceValue || 999,
            cuisineType: mapped.tags[0] || 'Ẩm thực'
          };
        });
        setRestaurants(mappedRestaurants);

        // 2. Tải song song thực đơn của từng quán ăn
        const foodPromises = resList.map(async (res) => {
          try {
            const resId = res.restaurantId || res.id;
            const menuRes = await apiClient.get(`/restaurants/${resId}/foods`);
            const foodList = menuRes.data?.data || [];
            
            // Tính khoảng cách Haversine thực tế từ Khách hàng tới Quán ăn này
            const resLat = res.latitude || res.lat;
            const resLng = res.longitude || res.lng;
            const distanceValue = calculateHaversineDistance(userLat, userLng, resLat, resLng);
            const distanceStr = distanceValue ? `${distanceValue}km` : '0.8km';

            // Ánh xạ từng món ăn (Lấy đúng trường foodName từ Backend)
            return foodList.map(food => ({
              id: food.id || food.foodId,
              name: food.foodName || food.name, 
              price: food.price,
              description: food.description,
              image: food.imageUrl || food.image || res.imageUrl || res.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80",
              restaurantId: resId,
              restaurantName: res.restaurantName || res.name,
              rating: res.rating || res.ratingScore || 5.0,
              distance: distanceStr,
              distanceVal: distanceValue || 999,
              orderCount: food.orderCount || 0
            }));
          } catch (err) {
            console.warn(`Lỗi khi nạp menu cho quán ${res.restaurantName || res.name}:`, err);
            return [];
          }
        });

        const allFoodsNested = await Promise.all(foodPromises);
        // Lọc bỏ triệt để các món ăn không hợp lệ hoặc thiếu tên
        const allFoodsFlattened = allFoodsNested.flat().filter(f => f && f.name && f.name.trim() !== '');

        setAllFoods(allFoodsFlattened);

        // 3. Xây dựng "Từ khóa hot hôm nay" thật từ dữ liệu
        if (allFoodsFlattened.length > 0) {
          const uniqueNames = Array.from(new Set(allFoodsFlattened.map(f => f.name))).filter(Boolean);
          const selectedTags = uniqueNames.slice(0, 6);
          setHotKeywords(selectedTags);
        } else {
          setHotKeywords(['Cơm tấm', 'Trà sữa', 'Pizza', 'Salad', 'Bún bò', 'Bánh mì']);
        }

        // 4. Xây dựng "Món ăn xu hướng gần bạn" thật từ dữ liệu (sắp xếp theo orderCount thật giảm dần)
        if (allFoodsFlattened.length > 0) {
          const sortedByOrders = [...allFoodsFlattened].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
          const slicedTrends = sortedByOrders.slice(0, 3);
          
          const mockTrends = slicedTrends.map((food, index) => {
            const ranks = ['01', '02', '03'];
            const orderCount = food.orderCount || 0;
            const changes = [
              `+24%`,
              `+18%`,
              `+12%`
            ];
            return {
              rank: ranks[index] || `0${index + 1}`,
              name: food.name,
              order: `${orderCount} lượt đặt`,
              change: changes[index],
              restaurantId: food.restaurantId,
              food: food
            };
          });
          setTrendingFoods(mockTrends);
        }

      } catch (err) {
        console.error('[Explore]: Không tải được dữ liệu thực tế.', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [userLat, userLng]);

  // Bộ lọc tìm kiếm thông minh phía client-side cho cả Món ăn và Quán ăn
  const searchResults = useMemo(() => {
    if (!query.trim()) return { foods: [], restaurants: [] };
    const queryNorm = removeVietnameseTones(query);
    
    const filteredFoods = allFoods.filter(food => {
      const foodNameNorm = removeVietnameseTones(food.name);
      const resNameNorm = removeVietnameseTones(food.restaurantName);
      const descNorm = removeVietnameseTones(food.description);
      return foodNameNorm.includes(queryNorm) || resNameNorm.includes(queryNorm) || descNorm.includes(queryNorm);
    });

    const filteredRestaurants = restaurants.filter(res => {
      const resNameNorm = removeVietnameseTones(res.name);
      const cuisineNorm = removeVietnameseTones(res.cuisineType);
      return resNameNorm.includes(queryNorm) || cuisineNorm.includes(queryNorm);
    });

    return { foods: filteredFoods, restaurants: filteredRestaurants };
  }, [query, allFoods, restaurants]);

  const searchSuggestions = useMemo(() => {
    const suggestions = [];
    if (restaurants.length > 0) {
      restaurants.slice(0, 3).forEach(res => {
        if (res.name) suggestions.push(res.name);
      });
    }
    if (allFoods.length > 0) {
      const foodNames = Array.from(new Set(allFoods.map(f => f.name)));
      foodNames.slice(0, 4).forEach(name => {
        if (name && !suggestions.includes(name)) {
          suggestions.push(name);
        }
      });
    }
    if (suggestions.length === 0) {
      return ['Cơm tấm', 'Trà sữa', 'Bún riêu', 'Mì Quảng', 'Gà rán'];
    }
    return suggestions;
  }, [restaurants, allFoods]);

  const saveSearchKeyword = (keyword) => {
    if (!keyword || !keyword.trim()) return;
    const cleanKw = keyword.trim();
    setRecentSearches(prev => {
      const updated = [cleanKw, ...prev.filter(k => k !== cleanKw)].slice(0, 8);
      localStorage.setItem('meal_dash_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('meal_dash_recent_searches');
  };

  const handleSearch = (txt) => {
    if (!txt || txt.trim() === '') return;
    setQuery(txt);
    setSearching(true);
    setIsSearchFocused(true);
    saveSearchKeyword(txt);
  };

  const hasResults = searchResults.foods.length > 0 || searchResults.restaurants.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 relative overflow-x-hidden">
      
      {/* ─── PREMIUM BACKGROUND MESH GLOWS ────────────────────────────────────── */}
      <div className="absolute -top-48 -left-48 w-96 h-96 bg-gradient-to-tr from-[#FF6B35]/10 to-[#FF6B35]/2 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-48 -right-48 w-[28rem] h-[28rem] bg-gradient-to-tr from-[#1A73E8]/8 to-[#1A73E8]/2 rounded-full blur-3xl opacity-40 pointer-events-none"></div>

      {/* ─── TITLE & COMPASS ICON ─────────────────────────────────────────────── */}
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-2.5 relative z-10">
        <div className="w-9 h-9 bg-gradient-to-tr from-[#FF6B35] to-[#FF6B35]/85 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
          <Compass size={18} className="animate-spin-slow" />
        </div>
        Khám phá ẩm thực
      </h1>

      {/* ─── SEARCH INPUT (Pill Shape & Focus Highlight) ────────────────────── */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        {isSearchFocused && (
          <button 
            onClick={() => {
              setQuery('');
              setSearching(false);
              setIsSearchFocused(false);
            }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft size={20} className="stroke-[2.5px]" />
          </button>
        )}
        
        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-full px-5 py-3.5 shadow-sm focus-within:border-[#FF6B35] focus-within:ring-4 focus-within:ring-[#FF6B35]/8 transition-all">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearching(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(query);
              }
            }}
            placeholder="Bạn có muốn ăn gì không?"
            className="w-full bg-transparent border-none outline-none pl-4 text-xs sm:text-sm font-semibold text-slate-700 placeholder-slate-350"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); setSearching(false); }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* ─── LOADING STATE ────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 relative z-10">
          <div className="w-10 h-10 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải dữ liệu thật...</p>
        </div>
      )}

      {/* ─── MAIN PORT ────────────────────────────────────────────────────────── */}
      {!loading && (
        <>
          {searching ? (
            /* ─── SEARCH RESULTS STATE ─── */
            <div className="space-y-6 relative z-10 animate-fade-in">
              
              {hasResults ? (
                <div className="space-y-6">
                  
                  {/* ─── MATCHING RESTAURANTS (QUÁN ĂN PHÙ HỢP) ─────────────────────── */}
                  {searchResults.restaurants.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-extrabold text-[#1A73E8] uppercase tracking-widest pl-1">
                        Quán ăn phù hợp ({searchResults.restaurants.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {searchResults.restaurants.map((res) => (
                          <div
                            key={res.id}
                            onClick={() => navigate(`/restaurants/${res.id}`)}
                            className="p-3 bg-white border border-slate-150 rounded-radius-xl hover:shadow-shadow-1 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer flex gap-3.5 items-center"
                          >
                            <img 
                              src={res.image} 
                              alt={res.name} 
                              loading="lazy"
                              className="w-14 h-14 rounded-radius-lg object-cover shrink-0 border border-slate-100 shadow-sm"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate leading-tight flex items-center gap-1">
                                {res.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 truncate flex items-center gap-1">
                                <Utensils size={11} /> {res.cuisineType}
                              </p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-450 font-bold uppercase mt-2.5">
                                <span className="flex items-center gap-0.5 text-amber-500">★ {res.rating}</span>
                                <span className="flex items-center gap-0.5 text-slate-450"><MapPin size={12} /> {res.distance}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── MATCHING FOODS (MÓN ĂN PHÙ HỢP) ───────────────────────────── */}
                  {searchResults.foods.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-extrabold text-[#FF6B35] uppercase tracking-widest pl-1">
                        Món ăn phù hợp ({searchResults.foods.length})
                      </h3>
                      <div className="space-y-3.5">
                        {searchResults.foods.map((item) => (
                          <div 
                            key={item.id}
                            onClick={() => navigate(`/restaurants/${item.restaurantId}`)}
                            className="p-1 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-radius-xl hover:shadow-shadow-1 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer flex gap-4"
                          >
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              loading="lazy"
                              className="w-18 h-18 sm:w-20 sm:h-20 rounded-radius-lg object-cover shrink-0 border border-slate-100 shadow-sm" 
                            />
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1.5 pr-3">
                              <div>
                                <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate leading-snug">{item.name}</h4>
                                <p className="text-[10px] text-[#1A73E8] font-extrabold truncate mt-1 flex items-center gap-1">
                                  <Store size={12} /> {item.restaurantName}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-2.5">
                                <span className="text-xs font-extrabold text-[#FF6B35]">{formatCurrency(item.price)}</span>
                                <div className="flex items-center gap-2.5 text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                                  <span className="flex items-center gap-0.5 text-amber-500 font-extrabold">★ {item.rating}</span>
                                  <span className="flex items-center gap-0.5 text-slate-400"><MapPin size={12} /> {item.distance}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-16 bg-white border border-slate-200/50 rounded-radius-xl p-8 shadow-sm">
                  <p className="text-slate-450 font-extrabold text-xs sm:text-sm">
                     Không tìm thấy món ăn hay quán ăn nào khớp với từ khóa "{query}"
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                    Thử tìm từ khóa khác như "cơm", "bún", "trà sữa"...
                  </p>
                </div>
              )}
            </div>
          ) : isSearchFocused ? (
            /* ─── SEARCH OVERLAY VIEW STATE (Ảnh 3) ─── */
            <div className="space-y-6 relative z-10 animate-fade-in">
              
              {/* Đã tìm kiếm gần đây */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 pl-1">
                      Đã tìm kiếm gần đây
                    </h3>
                    <button 
                      onClick={clearRecentSearches}
                      className="text-[10px] text-red-500 hover:underline font-extrabold cursor-pointer"
                    >
                      Xóa hết
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleSearch(tag)}
                        className="px-3.5 py-1.5 bg-[#f4f7f6] hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-750 cursor-pointer"
                      >
                        <Clock size={12} className="text-slate-400" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gợi ý tìm kiếm */}
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 pl-1 mb-3">
                  Gợi ý tìm kiếm
                </h3>
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-3.5 py-1.5 bg-[#f4f7f6] hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-750 cursor-pointer"
                    >
                      <TrendingUp size={12} className="text-orange-500" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Được đề xuất */}
              {restaurants.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 pl-1 mb-3.5 flex items-center gap-1.5">
                    Được đề xuất
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {restaurants.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => navigate(`/restaurants/${res.id}`)}
                        className="flex flex-col cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 group"
                      >
                        <img
                          src={res.image}
                          alt={res.name}
                          loading="lazy"
                          className="w-full aspect-square object-cover rounded-[1.25rem] border border-slate-100 shadow-sm group-hover:shadow-md transition-all"
                        />
                        <h4 className="font-extrabold text-slate-800 text-[10px] sm:text-xs mt-2 line-clamp-2 leading-tight group-hover:text-md-primary transition-colors">
                          {res.name}
                        </h4>
                        <p className="text-[8px] sm:text-[9px] text-slate-450 font-bold uppercase mt-1">
                          QC · {res.distance} · ★ {res.rating}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* ─── DEFAULT VIEW STATE ─── */
            <div className="space-y-8 relative z-10 animate-fade-in">
              
              {/* Quick Suggestion Tags */}
              {hotKeywords.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 mb-3.5 flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-500 fill-orange-500 animate-pulse" />
                    Từ khóa hot hôm nay
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {hotKeywords.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleSearch(tag)}
                        className="px-4 py-2 bg-white border border-slate-250/70 hover:border-[#FF6B35] hover:text-[#FF6B35] rounded-full text-xs font-bold transition-all shadow-sm hover:scale-102 active:scale-98 cursor-pointer text-slate-650"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Food List (Double-Bezel Layout) */}
              {trendingFoods.length > 0 && (
                <div className="p-2 bg-slate-100/70 border border-slate-200/50 rounded-[2.25rem] shadow-shadow-2 relative overflow-hidden">
                  
                  {/* Inner Container */}
                  <div className="bg-white rounded-[calc(2.25rem-0.625rem)] p-6 border border-slate-100/50">
                    
                    <h3 className="text-xs font-extrabold text-slate-800 border-b border-slate-100 pb-4.5 mb-2 flex items-center gap-1.5">
                      <TrendingUp size={16} className="text-[#1A73E8] stroke-[2.5px]" />
                      Món ăn xu hướng gần bạn
                    </h3>
                    
                    {/* Bảng xếp hạng: 1 cột ở màn nhỏ, 2 cột ở desktop (lg+) cho đỡ trống */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
                      {trendingFoods.map((item) => (
                        <div
                          key={item.rank}
                          onClick={() => navigate(`/restaurants/${item.restaurantId}`)}
                          className="py-4.5 flex items-center justify-between text-xs hover:bg-slate-50/50 rounded-radius-lg px-2 transition-all cursor-pointer group border-b border-slate-50"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="font-display-medium text-slate-200 text-base leading-none font-extrabold group-hover:text-[#1A73E8] transition-colors">
                              {item.rank}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-slate-700 leading-snug truncate group-hover:text-slate-900 transition-colors">
                                {item.name}
                              </span>
                              <span className="text-[9px] text-[#1A73E8] font-extrabold uppercase mt-1 truncate flex items-center gap-1">
                                <Store size={11} /> {item.food?.restaurantName}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0 ml-4">
                            <span className="font-extrabold text-slate-650 block text-[11px]">
                              {item.order}
                            </span>
                            <span className="text-[9px] text-emerald-600 font-extrabold block mt-1 tracking-wide">
                              {item.change}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}

    </div>
  );
}