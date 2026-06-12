import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Clock } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';

export default function Favorites() {
  const navigate = useNavigate();

  const mapFavorites = (data) => {
    const realData = data || [];
    return realData.map(res => ({
      id: res.restaurantId.toString(),
      name: res.restaurantName,
      image: res.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
      tags: [res.cuisineType || 'Ẩm thực'],
      rating: 4.8,
      time: '15-25 phút',
      distance: '1.2km',
      shipping: 'Miễn phí >99k',
      avgPrice: 45000,
    }));
  };

  const { data: favorites, loading, error, refetch } = useFetchData('/favorites', {
    mapFn: mapFavorites,
  });

  const handleRemoveFavorite = async (resId, e) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/favorites/${resId}`);
      refetch();
    } catch (err) {
      console.error('Lỗi khi xóa khỏi yêu thích:', err);
    }
  };

  const list = favorites || [];

  return (
    <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24">
      <h1 className="text-xl md:text-2xl font-bold text-md-on-surface mb-6 flex items-center gap-2">
        <Heart className="text-red-500 fill-red-500" size={24} />
        Quán ăn yêu thích
      </h1>

      {error ? (
        <ErrorState
          title="Không thể tải danh sách yêu thích"
          message={error.response?.data?.message || error.message || "Đã xảy ra sự cố kết nối máy chủ."}
          onRetry={refetch}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4">
          <SkeletonRestaurantCard />
          <SkeletonRestaurantCard />
          <SkeletonRestaurantCard />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="Chưa có quán ăn yêu thích nào"
          message="Hãy nhấn thả tim các quán ăn bạn yêu thích ở trang chủ hoặc chi tiết quán nhé!"
          icon={Heart}
          actionText="Khám phá ngay 🍽️"
          onAction={() => navigate('/explore')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {list.map((res) => (
            <div
              key={res.id}
              onClick={() => navigate(`/restaurants/${res.id}`)}
              className="bg-white rounded-radius-xl p-4.5 border border-md-outline-variant/20 shadow-sm hover:shadow-shadow-2 hover:scale-[1.01] transition-all cursor-pointer flex gap-5 card-float"
            >
              <img src={res.image} alt={res.name} className="w-22 h-22 rounded-radius-lg object-cover shrink-0 border border-slate-50" />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-md-on-surface truncate">{res.name}</h3>
                    <button 
                      onClick={(e) => handleRemoveFavorite(res.id, e)}
                      className="text-red-500 hover:scale-110 active:scale-95 transition-all p-1"
                    >
                      <Heart size={16} className="fill-red-500" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {res.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-md-on-surface-variant px-2.5 py-0.5 rounded font-extrabold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-3 text-xs text-md-on-surface-variant font-semibold">
                    <span className="flex items-center gap-0.5 text-amber-500 font-extrabold">★ {res.rating}</span>
                    <span className="flex items-center gap-0.5"><Clock size={12} /> {res.time}</span>
                    <span>📍 {res.distance}</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-md-primary bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded">
                    {res.shipping}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}