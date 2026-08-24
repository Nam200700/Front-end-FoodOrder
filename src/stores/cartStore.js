import { create } from 'zustand';
import apiClient from '../services/api';
import { toast } from 'react-toastify';

export const useCartStore = create((set, get) => ({
  carts: [], // Danh sách giỏ hàng: [{ cartId, restaurantId, restaurantName, latitude, longitude, items: [], subtotal }]
  loading: false,
  shippingInfos: {},
  shippingCacheKey: '',
  isCalculatingShipping: false,
  restaurantShippingCache: {},
  orderDistanceCache: {},

  fetchCart: async () => {
    try {
      set({ loading: true });
      const res = await apiClient.get('/carts/me');
      const cartsList = res.data?.data || [];
      
      const mappedCarts = cartsList.map(cart => ({
        cartId: cart.cartId,
        restaurantId: cart.restaurantId?.toString(),
        restaurantName: cart.restaurantName,
        subtotal: Number(cart.subtotal || 0),
        latitude: cart.latitude ? Number(cart.latitude) : null,
        longitude: cart.longitude ? Number(cart.longitude) : null,
        opensAt: cart.opensAt,
        closesAt: cart.closesAt,
        isOpen: cart.open,
        items: (cart.items || []).map(item => ({
          cartItemId: item.cartItemId,
          id: item.foodId,
          foodId: item.foodId,
          name: item.foodName,
          price: Number(item.price || 0),
          quantity: item.quantity,
          note: item.note || '',
          image: item.foodImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'
        }))
      }));

      set({ carts: mappedCarts });
    } catch (err) {
      console.error('Lỗi khi tải giỏ hàng:', err);
    } finally {
      set({ loading: false });
    }
  },

  // phí ship cho giỏ hàng
  fetchShippingFees: async (deliveryLat, deliveryLng) => {
    const { carts, shippingCacheKey, isCalculatingShipping } = get();

    if (carts.length === 0 || !deliveryLat || !deliveryLng) return;

    // key xác định dữ liệu hiện tại
    const cacheKey =
      `${deliveryLat}-${deliveryLng}-` +
      carts
        .map(c => c.restaurantId)
        .sort()
        .join(',');

    if (isCalculatingShipping) {
        return;
    }
    // Nếu dữ liệu không đổi thì dùng cache
    if (shippingCacheKey === cacheKey) {
      return;
    }

    set({ isCalculatingShipping: true });
    try {
      const restaurantIds = carts.map(c => c.restaurantId);
      const res = await apiClient.get("/shipping/calculate", {
        params: {
          restaurantIds,
          deliveryLat,
          deliveryLng
        }
      });
      const newShippingInfos = {};
      res.data.data.forEach(item => {
        newShippingInfos[item.restaurantId] = {
          shippingFee: item.shippingFee,
          distanceKm: item.distanceKm,
          durationMinutes: item.durationMinutes
        };
      });
      set({
        shippingInfos: newShippingInfos,
        shippingCacheKey: cacheKey
      });

    } catch (err) {
      console.error("Lỗi tính phí ship:", err);
    } finally {
      set({ isCalculatingShipping: false });
    }
  },

  fetchShippingForRestaurant: async (resId, deliveryLat, deliveryLng, force = false) => {
    if (!resId || !deliveryLat || !deliveryLng) return;

    const { restaurantShippingCache } = get();
    const cached = restaurantShippingCache[resId];
    // Chỉ dùng cache khi KHÔNG force và toạ độ không đổi
    if (!force && cached && cached.lat === deliveryLat && cached.lng === deliveryLng) return;

    try {
      const res = await apiClient.get("/shipping/calculate", {
        params: {
          restaurantIds: [resId],
          deliveryLat,
          deliveryLng
        }
      });

      const data = res.data?.data?.[0];
      if (data) {
        set(state => ({
          restaurantShippingCache: {
            ...state.restaurantShippingCache,
            [resId]: {
              shippingFee: data.shippingFee,
              distanceKm: data.distanceKm,
              durationMinutes: data.durationMinutes,
              lat: deliveryLat,
              lng: deliveryLng,
            }
          }
        }));
      }
    } catch (err) {
      console.error("Lỗi tính phí ship cho từng quán:", err);
    }
  },

  fetchDistanceToCustomer: async (orderId, restaurantId, deliveryLat, deliveryLng) => {
    const { orderDistanceCache } = get();
    if (orderDistanceCache[orderId]) return orderDistanceCache[orderId]; // đã có cache
    if (!restaurantId || !deliveryLat || !deliveryLng) return null;

    try {
      const res = await apiClient.get('/shipping/calculate', {
        params: {
          restaurantIds: [restaurantId],
          deliveryLat,
          deliveryLng
        }
      });

      const data = res.data?.data?.[0];
      if (!data) return null;

      const info = {
        shippingFee: data.shippingFee,
        distanceKm: data.distanceKm,
        durationMinutes: data.durationMinutes
      };

      set(state => ({
        orderDistanceCache: {
          ...state.orderDistanceCache,
          [orderId]: info
        }
      }));

      return info;
    } catch (err) {
      console.error('Lỗi tính khoảng cách quán - khách hàng:', err);
      return null;
    }
  },

  addItem: async (item) => {
    try {
      const originId = item.foodId || item.id;
      const foodId = Number(originId);
      
      await apiClient.post('/carts/me/items', {
        foodId: foodId,
        quantity: 1,
        note: ''
      });
      
      await get().fetchCart();
      return true;
    } catch (err) {
      console.error('Lỗi khi thêm món vào giỏ hàng:', err);
      toast.error(err.response?.data?.message || 'Không thể thêm món vào giỏ hàng!');
      return false;
    }
  },

  updateQty: async (cartItemId, targetQty) => {
    try {
      await apiClient.put(
        `/carts/me/items/${cartItemId}/quantity`,
        {
          quantity: targetQty
        }
      );

      await get().fetchCart();
      return true;
    } catch (err) {
      console.error('Lỗi khi cập nhật số lượng:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật số lượng!');
      return false;
    }
  },

  removeItem: async (cartItemId) => {
    try {
      await apiClient.delete(`/carts/me/items/${cartItemId}`);
      await get().fetchCart();
    } catch (err) {
      console.error('Lỗi khi xóa món khỏi giỏ hàng:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa món khỏi giỏ hàng!');
    }
  },

  updateNote: async (foodId, note) => {
    try {
      set((state) => ({
        carts: state.carts.map((cart) => ({
          ...cart,
          items: cart.items.map((item) =>
            item.foodId === foodId ? { ...item, note: note } : item
          ),
        })),
      }));
      
      await apiClient.put('/carts/me/items/note', {
        foodId: foodId,
        note: note
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật ghi chú:', err);
    }
  },

  clearCartOfRestaurant: async (restaurantId) => {
    try {
      await apiClient.delete(`/carts/me?restaurantId=${restaurantId}`);
      await get().fetchCart();
    } catch (err) {
      console.error('Lỗi khi xóa giỏ hàng của nhà hàng:', err);
    }
  },

  replaceCart: async (newItems, resId, resName) => {
    try {
      await apiClient.delete(`/carts/me?restaurantId=${resId}`);
      for (const item of newItems) {
        const numericId = parseInt(item.id.replace('food-', ''));
        const foodId = isNaN(numericId) ? item.id : numericId;
        await apiClient.post('/carts/me/items', {
          foodId: foodId,
          quantity: item.quantity,
          note: item.note || ''
        });
      }
      await get().fetchCart();
    } catch (err) {
      console.error('Lỗi khi reorder đơn hàng cũ:', err);
    }
  },

  clearCart: () => set({ carts: [] })
}));
