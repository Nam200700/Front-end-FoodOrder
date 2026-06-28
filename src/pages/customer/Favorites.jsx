import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Clock, MapPin, Star, Shuffle, Utensils } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import { SkeletonRestaurantCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';

export default function Favorites() {
  const navigate = useNavigate();

  // Ánh xạ dữ liệu yêu thích từ Backend sang model hiển thị (GIỮ NGUYÊN logic cũ).
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

  // Gỡ một quán khỏi danh sách yêu thích (GIỮ NGUYÊN logic cũ).
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

  // ── CONCEPT "Bộ sưu tập ẩm thực" (thuần trình bày) ──────────────────────────
  // State lọc theo loại món; mặc định 'all'. Chỉ lọc hiển thị, không gọi API.
  const [activeTag, setActiveTag] = useState('all');

  // Danh sách loại món (chip lọc) suy ra từ tags của các quán đã yêu thích.
  const cuisineTags = useMemo(() => {
    const set = new Set();
    list.forEach((res) => (res.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set);
  }, [list]);

  // Danh sách quán sau khi áp bộ lọc loại món.
  const filteredList = useMemo(() => {
    if (activeTag === 'all') return list;
    return list.filter((res) => (res.tags || []).includes(activeTag));
  }, [list, activeTag]);

  // "Thèm gì hôm nay?" → mở ngẫu nhiên một quán trong danh sách đang hiển thị.
  const handleRandomPick = () => {
    if (filteredList.length === 0) return;
    const pick = filteredList[Math.floor(Math.random() * filteredList.length)];
    navigate(`/restaurants/${pick.id}`);
  };

  return (
    <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24">
      {/* ─── Tiêu đề "Bộ sưu tập ẩm thực" + tổng số quán ────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-md-on-surface flex items-center gap-2">
          <Heart className="text-red-500 fill-red-500" size={24} />
          Bộ sưu tập ẩm thực
        </h1>
        {list.length > 0 && (
          <span className="text-xs font-extrabold text-md-on-surface-variant bg-slate-100 px-3 py-1 rounded-full">
            {list.length} quán
          </span>
        )}
      </div>

      {/* ─── Thanh công cụ: chip lọc loại món + nút chọn ngẫu nhiên ──────────────── */}
      {list.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
            {/* Chip "Tất cả" + từng loại món */}
            {['all', ...cuisineTags].map((tag) => {
              const isActive = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-extrabold border transition-all ${
                    isActive
                      ? 'bg-md-primary text-white border-md-primary shadow-sm'
                      : 'bg-white text-md-on-surface-variant border-md-outline-variant/40 hover:bg-md-surface-variant/40'
                  }`}
                >
                  {tag === 'all' ? 'Tất cả' : tag}
                </button>
              );
            })}
          </div>

          {/* Nút gợi ý ngẫu nhiên - cú hích đặt món khi đang phân vân */}
          <button
            onClick={handleRandomPick}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold bg-md-primary-container/40 text-md-primary border border-md-primary/20 hover:bg-md-primary-container/70 transition-all"
          >
            <Shuffle size={15} />
            Thèm gì hôm nay?
          </button>
        </div>
      )}

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
          actionText="Khám phá ngay"
          onAction={() => navigate('/explore')}
        />
      ) : filteredList.length === 0 ? (
        // Trường hợp lọc theo loại món nhưng không có quán nào khớp.
        <div className="text-center py-16 bg-white rounded-radius-xl border border-md-outline-variant/30">
          <Utensils size={48} className="mx-auto text-md-outline/40 mb-3" />
          <p className="text-sm font-extrabold text-md-on-surface-variant">Không có quán "{activeTag}" trong bộ sưu tập</p>
          <button onClick={() => setActiveTag('all')} className="mt-3 text-xs font-extrabold text-md-primary hover:underline">
            Xem tất cả
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map((res) => (
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
                      title="Bỏ khỏi yêu thích"
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
                    {/* ★ rating */}
                    <span className="flex items-center gap-0.5 text-amber-500 font-extrabold">
                      <Star size={12} className="fill-amber-500" /> {res.rating}
                    </span>
                    <span className="flex items-center gap-0.5"><Clock size={12} /> {res.time}</span>
                    {/* Khoảng cách: icon MapPin thay cho emoji 📍 */}
                    <span className="flex items-center gap-0.5"><MapPin size={12} /> {res.distance}</span>
                  </div>
                  <span className="text-[11px] font-extrabold bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded">
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
