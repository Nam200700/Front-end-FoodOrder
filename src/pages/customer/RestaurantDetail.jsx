import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Star, Clock, MapPin, Phone, Search, ShoppingBag, Heart, Share2, Plus, Minus, MessageSquare, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import apiClient from '../../services/api';
import { calculateHaversineDistance } from '../../utils/haversine';
import { toast } from 'react-toastify';
import { mapRestaurant } from '../../utils/mappers';
import { useModalState } from '../../hooks/useModalState';

const groupMenu = (foods) => {
  if (!foods || foods.length === 0) return [];
  
  const categories = [...new Set(foods.map(f => f.category || 'Món chính'))];
  return categories.map(cat => ({
    category: cat,
    items: foods.filter(f => (f.category || 'Món chính') === cat).map(f => ({
      id: f.id,
      name: f.foodName,
      price: Number(f.price),
      desc: f.description || 'Hương vị thơm ngon đậm đà, được chế biến từ các nguyên liệu tươi mới sạch sẽ.',
      image: f.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
    }))
  }));
};

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const carts = useCartStore((state) => state.carts);
  const addItem = useCartStore((state) => state.addItem);
  const updateQty = useCartStore((state) => state.updateQty);
  
  const currentCart = carts.find(c => c.restaurantId === id) || { items: [], subtotal: 0 };
  const cartItems = currentCart.items;
  
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const { user } = useAuthStore();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState('menu'); // menu, reviews, info
  const [activeCategory, setActiveCategory] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [addingIds, setAddingIds] = useState({}); // Tracking loading animation per item
  const reportModal = useModalState();
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const menuSectionsRef = useRef({});

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        const resDetailResponse = await apiClient.get(`/restaurants/${id}`);
        const realRes = resDetailResponse.data?.data;
        
        const menuResponse = await apiClient.get(`/restaurants/${id}/foods`);
        const realFoods = menuResponse.data?.data || [];
        
        if (realRes) {
          let realReviews = [];
          try {
            const reviewsRes = await apiClient.get(`/restaurants/${id}/reviews`);
            realReviews = reviewsRes.data?.data?.content || [];
          } catch (reviewErr) {
            console.warn('Lỗi khi tải đánh giá nhà hàng từ Backend:', reviewErr);
          }

          const totalRating = realReviews.reduce((sum, r) => sum + (r.restaurantRating || 0), 0);
          const avgRating = realReviews.length > 0 ? (totalRating / realReviews.length).toFixed(1) : '5.0';

          // TÍNH KHOẢNG CÁCH VÀ THỜI GIAN THẬT BẰNG HAVERSINE
          const customerLat = user?.lat || 10.762622;
          const customerLng = user?.lng || 106.660172;
          const resLat = Number(realRes.latitude);
          const resLng = Number(realRes.longitude);
          
          let dist = 1.0;
          if (!isNaN(resLat) && !isNaN(resLng)) {
            dist = calculateHaversineDistance(resLat, resLng, customerLat, customerLng);
          }
          
          const duration = Math.max(10, Math.round(dist * 5 + 5));
          const shippingFee = Math.max(15000, 15000 + Math.ceil(Math.max(0, dist - 2)) * 5000);

          const mapped = mapRestaurant(realRes);
          const mappedRes = {
            ...mapped,
            ownerId: realRes.ownerId || realRes.userId || realRes.restaurantId, // Đảm bảo luôn có Owner ID để Chat
            rating: Number(avgRating),
            reviewsCount: realReviews.length,
            time: `${Math.max(10, duration - 3)}-${duration + 3} phút`,
            distance: `${dist.toFixed(1)}km`,
            phone: realRes.phone || '0901234567',
            openTime: '08:00 – 22:00',
            shippingFee: shippingFee,
            reviews: realReviews.map(r => ({
              name: r.customerName || 'Khách hàng',
              rating: r.restaurantRating || 5,
              comment: r.restaurantComment || '',
              date: new Date(r.createdAt).toLocaleDateString('vi-VN')
            }))
          };
          
          const mappedMenu = groupMenu(realFoods);
          setRestaurant(mappedRes);
          setMenu(mappedMenu);
          if (mappedMenu.length > 0) {
            setActiveCategory(mappedMenu[0].category);
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

  const handleAddToCart = (item) => {
    if (!restaurant) return;
    setAddingIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      addItem(item, restaurant.id, restaurant.name);
      setAddingIds((prev) => ({ ...prev, [item.id]: false }));
    }, 400);
  };

  const handleChatWithMerchant = async () => {
    if (!restaurant) return;
    // Sử dụng restaurant.ownerId động từ backend DB thay vì restaurant.id
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
  const scrollToCategory = (catName) => {
    setActiveCategory(catName);
    const element = menuSectionsRef.current[catName];
    if (element) {
      const offset = 140; // Sticky header offset
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
        reportedUserId: restaurant.ownerId,
        reported_user_id: restaurant.ownerId,
        reason: reportReason.trim()
      });
      toast.success('Báo cáo vi phạm đã được gửi lên hệ thống. Cảm ơn phản hồi của bạn!');
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
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
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
      
      {/* ─── HERO PARALLAX BANNER (320px) ───────────────────────────────────────── */}
      <div className="relative h-76 md:h-84 overflow-hidden w-full bg-slate-900 z-0">
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-75 scale-105"
          style={{ 
            backgroundImage: `url(${restaurant.image})`,
            transform: `translateY(${scrollY * 0.4}px)` // Parallax
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/20" />
        
        {/* Nav Controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <button 
            onClick={() => navigate('/')}
            className="w-11 h-11 rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex gap-3">
            <button 
              onClick={handleToggleFavorite}
              className="w-11 h-11 rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform"
            >
              <Heart size={20} className={isFavorite ? 'text-red-500 fill-red-500' : 'text-md-on-surface-variant'} />
            </button>
            <button className="w-11 h-11 rounded-radius-full bg-white/95 backdrop-blur-md flex items-center justify-center text-md-on-surface shadow-shadow-2 hover:scale-105 transition-transform">
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── FLOATING INFO CARD (translateY -40px, glass-effect) ────────────────── */}
      <div className="px-6 max-w-5xl mx-auto -mt-14 relative z-10">
        <Card variant="glass" className="p-6.5 md:p-8 shadow-shadow-3 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-md-on-surface tracking-tight leading-snug">
                {restaurant.name}
              </h1>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4.5 text-xs md:text-sm font-bold text-md-on-surface-variant">
                <span className="flex items-center gap-1.5 text-amber-500 bg-amber-50 px-3 py-1 rounded-radius-sm">
                  <Star size={16} className="fill-amber-500 text-amber-500" />
                  {restaurant.rating} ({restaurant.reviewsCount} đánh giá)
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-radius-sm text-md-on-surface-variant">
                  <Clock size={16} />
                  {restaurant.time}
                </span>
                <span className="bg-slate-100 px-3 py-1 rounded-radius-sm text-md-on-surface-variant">
                  📍 {restaurant.distance}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 self-center sm:self-start w-full sm:w-auto shrink-0">
              <Button 
                variant="text"
                onClick={handleChatWithMerchant}
                icon={MessageSquare}
                className="bg-md-primary/10 hover:bg-md-primary/20 text-md-primary font-bold w-full sm:w-auto"
              >
                Chat với quán
              </Button>
              <button
                type="button"
                onClick={() => reportModal.open()}
                className="border border-red-200 hover:border-red-300 text-red-500 hover:bg-red-50 font-bold flex items-center justify-center gap-1.5 py-3.5 px-5 rounded-radius-full text-sm transition-all active:scale-95 cursor-pointer w-full sm:w-auto shrink-0"
              >
                <AlertTriangle size={16} />
                Báo cáo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-6 border-t border-md-outline-variant/30 text-xs md:text-sm text-md-on-surface-variant text-left font-medium">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-md-on-surface shrink-0">📍 Địa chỉ:</span>
              <span className="truncate">{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-md-on-surface shrink-0">⏰ Mở cửa:</span>
              <span>{restaurant.openTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-md-on-surface shrink-0">☎️ Điện thoại:</span>
              <span>{restaurant.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-md-on-surface shrink-0">💸 Phí ship:</span>
              <span className="text-md-primary font-bold">Từ {formatCurrency(restaurant.shippingFee)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── STICKY TAB BAR (Menu | Đánh giá | Thông tin) ───────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-md-outline-variant/40 z-20 shadow-sm mt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-around">
          {[
            { id: 'menu', name: 'Thực đơn' },
            { id: 'reviews', name: `Đánh giá (${restaurant.reviews.length})` },
            { id: 'info', name: 'Thông tin' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4.5 px-8 text-base font-extrabold border-b-[3px] transition-all ${
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
        <div className="max-w-5xl mx-auto px-6 mt-8 flex flex-col md:flex-row gap-8">
          
          {/* Category Anchor Sidebar (Sticky, on larger screens) */}
          <aside className="w-full md:w-52 shrink-0 md:sticky md:top-24 h-max self-start py-2.5">
            <h4 className="text-[11px] font-extrabold text-md-on-surface-variant tracking-wider uppercase mb-4 px-2 hidden md:block">
              Danh mục món
            </h4>
            <div className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar py-1">
              {menu.map((sec) => {
                const isActive = activeCategory === sec.category;
                return (
                  <button
                    key={sec.category}
                    onClick={() => scrollToCategory(sec.category)}
                    className={`shrink-0 text-left px-4 py-3 rounded-radius-lg text-sm font-bold transition-all w-max md:w-full border ${
                      isActive
                        ? 'bg-md-primary/10 text-md-primary border-md-primary/20 font-extrabold shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-md-on-surface-variant border-md-outline-variant/30 md:border-transparent'
                    }`}
                  >
                    {sec.category}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Menu Items List */}
          <div className="flex-1 space-y-10">
            {menu.map((sec) => (
              <div 
                key={sec.category} 
                ref={(el) => (menuSectionsRef.current[sec.category] = el)}
                className="scroll-mt-36"
              >
                <h3 className="text-base font-extrabold text-md-on-surface border-b border-md-outline-variant/35 pb-3 mb-6 uppercase tracking-wider">
                  {sec.category}
                </h3>
                
                <div className="space-y-5">
                  {sec.items.map((item) => {
                    const qty = getItemQty(item.id);
                    const isAdding = addingIds[item.id];
                    return (
                      <Card 
                        key={item.id}
                        variant="flat"
                        hoverEffect
                        className="p-4.5 flex gap-5 relative"
                      >
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-radius-md overflow-hidden shrink-0 shadow-sm">
                           <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 flex flex-col justify-between min-w-0 pr-12">
                          <div>
                            <h4 className="font-extrabold text-base md:text-lg text-md-on-surface truncate leading-snug">
                              {item.name}
                            </h4>
                            <p className="text-xs md:text-sm text-md-on-surface-variant leading-relaxed line-clamp-2 mt-2 font-medium">
                              {item.desc}
                            </p>
                          </div>
                          <span className="font-extrabold text-base md:text-lg text-md-primary mt-3">
                            {formatCurrency(item.price)}
                          </span>
                        </div>

                        {/* ADD / COUNTER BUTTON (Morph State Machine) */}
                        <div className="absolute right-4.5 bottom-4.5">
                          {qty > 0 ? (
                            <div className="flex items-center bg-md-primary text-white rounded-radius-full py-1.5 px-3.5 gap-3.5 shadow-shadow-2">
                              <button 
                                onClick={() => updateQty(item.id, qty, qty - 1)}
                                className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform"
                              >
                                <Minus size={16} className="stroke-[3px]" />
                              </button>
                              <span className="text-sm font-extrabold min-w-5 text-center">{qty}</span>
                              <button 
                                onClick={() => updateQty(item.id, qty, qty + 1)}
                                className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform"
                              >
                                <Plus size={16} className="stroke-[3px]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item)}
                              disabled={isAdding}
                              className="w-10 h-10 rounded-radius-full border border-md-primary/30 text-md-primary bg-white flex items-center justify-center shadow-md hover:bg-md-primary hover:text-white transition-all duration-200 active:scale-90 cursor-pointer shrink-0"
                            >
                              {isAdding ? (
                                <span className="w-5 h-5 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <Plus size={20} className="stroke-[2.5px]" />
                              )}
                            </button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ─── TAB CONTENT: REVIEWS ──────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="max-w-3xl mx-auto px-6 mt-8 space-y-5">
          {restaurant.reviews.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
              <Star size={48} className="mx-auto text-md-outline/35 mb-3.5" />
              <p className="text-base font-extrabold text-md-on-surface-variant">Chưa có đánh giá nào</p>
              <p className="text-sm text-md-outline mt-1">Hãy đặt đơn và trở thành người đánh giá đầu tiên!</p>
            </div>
          ) : (
            restaurant.reviews.map((rev, i) => (
              <div key={i} className="bg-white rounded-radius-lg p-5 border border-md-outline-variant/20 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base text-md-on-surface">{rev.name}</span>
                  <span className="text-xs text-md-outline font-medium">{rev.date}</span>
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
                <p className="text-sm text-md-on-surface-variant leading-relaxed font-medium">
                  {rev.comment}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── TAB CONTENT: INFO ─────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="max-w-3xl mx-auto px-6 mt-8 bg-white rounded-radius-xl p-6.5 border border-md-outline-variant/20 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-base md:text-lg text-md-on-surface">Giới thiệu quán</h3>
            <p className="text-xs md:text-sm text-md-on-surface-variant leading-relaxed mt-3 font-medium">
              Chúng tôi mang đến hương vị thơm ngon đặc sắc chuẩn thương hiệu hàng đầu, cam kết tẩm ướp và chế biến chuẩn quy trình vệ sinh an toàn thực phẩm. Sườn và các món ăn đặc trưng luôn nóng hổi khi đến tay khách hàng!
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
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="text-md-on-surface-variant">Thanh toán hỗ trợ:</span>
              <span className="font-extrabold text-md-secondary">Tiền mặt COD</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING CART BOTTOM BAR (Shows when there is item in cart) ────────── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-md-outline-variant/30 flex justify-center z-35 shadow-shadow-4">
          <div className="w-full max-w-5xl flex items-center justify-between bg-md-primary text-white px-6 py-4.5 rounded-radius-full shadow-shadow-4 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer" onClick={() => navigate('/cart')}>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <ShoppingBag size={24} />
                <span className="absolute -top-1.5 -right-2 bg-md-error text-white text-[10px] font-extrabold h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center border border-md-primary shadow-md">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] text-white/85 font-bold">Giỏ hàng chứa món</span>
                <span className="text-base font-extrabold mt-1">{restaurant.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-lg font-extrabold">
                {formatCurrency(currentCart.subtotal || 0)}
              </span>
              <span className="text-sm font-extrabold bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors">
                Xem giỏ hàng →
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL BÁO CÁO VI PHẠM ────────────────────────────────────────────── */}
      <Modal
        isOpen={reportModal.isOpen}
        onClose={() => reportModal.close()}
        title="Báo cáo vi phạm quán ăn"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 text-red-700 rounded-radius-md text-xs font-bold border border-red-100 flex items-start gap-2">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span>
              Báo cáo của bạn sẽ được gửi trực tiếp tới Quản trị viên hệ thống để kiểm tra và xử lý. Vui lòng cung cấp thông tin trung thực!
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Chọn lý do vi phạm mẫu:
            </label>
            <div className="grid grid-cols-1 gap-2">
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
                  className="text-left px-3.5 py-2.5 rounded-radius-md border border-slate-200 hover:border-md-primary/40 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-md-on-surface uppercase tracking-wider block">
              Chi tiết nội dung vi phạm:
            </label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Vui lòng mô tả chi tiết hành vi vi phạm tại đây (tối thiểu 10 ký tự)..."
              rows={4}
              className="w-full p-3.5 border border-slate-200 rounded-radius-md focus:outline-none focus:border-md-primary focus:ring-4 focus:ring-md-primary/10 text-sm font-semibold text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => reportModal.close()} disabled={submittingReport}>
              Hủy
            </Button>
            <Button
              variant="secondary"
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason.trim()}
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}