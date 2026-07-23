import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Star, Clock, MapPin, Phone, Search, ShoppingBag, Heart, Share2, Plus, Minus, MessageSquare, AlertTriangle, Bike, AlertCircle, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import { toast } from 'react-toastify';
import { mapRestaurant } from '../../utils/mappers';
import { useModalState } from '../../hooks/useModalState';

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
  const [activeTab, setActiveTab] = useState('menu'); 
  const [activeCategory, setActiveCategory] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [addingIds, setAddingIds] = useState({}); 
  const reportModal = useModalState();
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const menuSectionsRef = useRef({});

  // State quản lý phóng to ảnh trong tab hiện tại 
  const [selectedImage, setSelectedImage] = useState(null);

  // Khai báo state phân trang 
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0); 
  const size = 10;

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

          // Lấy đánh giá
          let realReviews = [];
          let fetchedTotalPages = 0;
          try {
            const reviewsRes = await apiClient.get(`/restaurants/${id}/reviews?page=${page}&size=${size}`);
            const reviewData = reviewsRes.data?.data;
            realReviews = reviewData?.content || [];
            fetchedTotalPages = reviewData?.totalPages || 0;
            setTotalPages(fetchedTotalPages);
          } catch (reviewErr) {
            console.warn('Lỗi khi tải đánh giá nhà hàng:', reviewErr);
          }

          const totalReviews = realReviews.totalElements;
          const totalPages = realReviews.totalPages || 0;

          const totalRating = realReviews.reduce((sum, r) => sum + (r.restaurantRating || 0), 0);
          const avgRating = realReviews.length > 0 ? (totalRating / realReviews.length).toFixed(1) : '5.0';

          // Map thông tin quán ăn
          const mapped = mapRestaurant(realRes);
          const mappedRes = {
            ...mapped,
            ownerId: realRes.ownerId,
            rating: Number(avgRating),
            reviewsCount: realReviews.length,
            phone: realRes.phone,
            openTime: (realRes.opensAt && realRes.closesAt) ? `${realRes.opensAt.substring(0, 5)} - ${realRes.closesAt.substring(0, 5)}` : '--',
            reviews: realReviews.map(r => ({
              name: r.customerName,
              rating: r.restaurantRating || 5,
              comment: r.restaurantComment || '',
              date: new Date(r.createdAt).toLocaleDateString('vi-VN'),
              images: r.images 
            }))
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
              className="w-11 h-11 !p-0 border-none rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform"
            >
              <Heart size={20} className={isFavorite ? 'text-red-500 fill-red-500' : 'text-md-on-surface-variant'} />
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
                <span className="flex items-center gap-1.5 text-amber-500 bg-amber-50 px-2.5 py-1 rounded-radius-sm">
                  <Star size={16} className="fill-amber-500 text-amber-500" />
                  {restaurant.rating} ({restaurant.reviewsCount} đánh giá)
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-radius-sm text-md-on-surface-variant">
                  <Clock size={16} />
                  {durationText}
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-radius-sm text-md-on-surface-variant">
                  <MapPin size={16} /> {distance}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-6 border-t border-md-outline-variant/30 text-xs md:text-sm text-md-on-surface-variant text-left font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-extrabold text-md-on-surface shrink-0"><MapPin size={15} /> Địa chỉ:</span>
              <span className="truncate">{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-extrabold text-md-on-surface shrink-0"><Clock size={15} /> Mở cửa:</span>
              <span className="truncate">{restaurant.openTime}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-extrabold text-md-on-surface shrink-0"><Phone size={15} /> Điện thoại:</span>
              <span className="truncate">{restaurant.phone}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 font-extrabold text-md-on-surface shrink-0"><Bike size={15} /> Phí ship:</span>
              <span className="text-md-primary font-bold truncate">Từ {formatCurrency(shippingFee)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── STICKY TAB BAR (Menu | Đánh giá | Thông tin) ───────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-md-outline-variant/40 z-20 shadow-sm mt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-around">
          {[
            { id: 'menu', name: 'Thực đơn' },
            { id: 'reviews', name: `Đánh giá` },
            { id: 'info', name: 'Thông tin' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 sm:py-4.5 sm:px-8 text-sm sm:text-base font-extrabold border-b-[3px] transition-all ${
                  isActive
                    ? 'border-md-primary text-md-primary'
                    : 'border-transparent text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                {tab.name}
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
                    {sec.items.map((item) => {
                      const qty = getItemQty(item.id);
                      return (
                        <Card 
                          key={item.id}
                          variant="flat"
                          className="p-3 sm:p-4.5 flex gap-3 sm:gap-5"
                        >
                          <div className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 rounded-radius-md overflow-hidden shrink-0 shadow-sm">
                             <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
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
              <h3 className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <ShoppingBag size={15} className="text-md-primary" /> Giỏ hàng
              </h3>
              
              {cartItems.length === 0 ? (
                <p className="text-xs text-md-outline font-semibold py-2">Chưa có món nào. Hãy thêm món từ thực đơn.</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                        <div className="flex flex-col truncate pr-2">
                          <span className="text-md-on-surface truncate">{item.name}</span>
                          <span className="text-md-on-surface truncate">{item.price} x{item.quantity}</span>
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-5">
          {restaurant.reviews.length === 0 ? (
            <Card variant="flat" className="text-center py-16">
              <Star size={48} className="mx-auto text-md-outline/35 mb-3.5" />
              <p className="text-base font-extrabold text-md-on-surface-variant">Chưa có đánh giá nào</p>
              <p className="text-sm text-md-outline mt-1">Hãy đặt đơn và trở thành người đánh giá đầu tiên!</p>
            </Card>
          ) : (
            <>
              {/* Danh sách các review */}
              <div className="space-y-4">
                {restaurant.reviews.map((rev, i) => (
                  <Card key={i} variant="elevated" className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm sm:text-base text-md-on-surface">{rev.name}</span>
                      <span className="text-[10px] sm:text-xs text-md-outline font-medium">{rev.date}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(5)].map((_, idx) => (
                        <Star 
                          key={idx} 
                          size={14} 
                          className={idx < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'} 
                        />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-md-on-surface-variant leading-relaxed font-medium">
                      {rev.comment}
                    </p>

                    {/* Hiển thị danh sách hình ảnh */}
                    {rev.images && rev.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {rev.images.map((imgUrl, imgIndex) => (
                          <div 
                            key={imgIndex} 
                            className="relative group w-16 h-16 xs:w-20 xs:h-20 rounded-radius-md overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage(imgUrl);
                            }}
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Review image ${imgIndex + 1}`} 
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Thanh phân trang*/}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 pt-4 pb-6 border-t border-slate-200/60">
                  <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                    disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="text-xs font-bold text-slate-500 mx-1">
                    Trang {page + 1} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── TAB CONTENT: INFO ─────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8">
          <Card variant="elevated" className="p-5 sm:p-6.5 space-y-6">
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-md-on-surface">Giới thiệu quán</h3>
              <p className="text-xs md:text-sm text-md-on-surface-variant leading-relaxed mt-3 font-medium">
                {restaurant.description}
              </p>
            </div>
            
            <div className="pt-5 border-t border-md-outline-variant/20 space-y-3 font-medium">
              <h3 className="font-extrabold text-base md:text-lg text-md-on-surface mb-3">Thông tin dịch vụ</h3>
              <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-md-on-surface-variant">Thời gian chuẩn bị trung bình:</span>
                <span className="font-extrabold text-md-on-surface">10-15 phút</span>
              </div>
              <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-md-on-surface-variant">Khoảng cách giao hàng tối đa:</span>
                <span className="font-extrabold text-md-on-surface">7.0km</span>
              </div>
              {/* <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-md-on-surface-variant">Thanh toán hỗ trợ:</span>
                <span className="font-extrabold text-md-secondary">Tiền mặt COD</span>
              </div> */}
            </div>
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

