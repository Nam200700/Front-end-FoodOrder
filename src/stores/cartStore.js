import { create } from 'zustand';
import apiClient from '../services/api';

export const useCartStore = create((set, get) => ({
  carts: [], // Danh sách giỏ hàng: [{ cartId, restaurantId, restaurantName, latitude, longitude, items: [], subtotal }]
  loading: false,

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
        items: (cart.items || []).map(item => ({
          cartItemId: item.cartItemId,
          id: `food-${item.foodId}`,
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

  addItem: async (item, resId, resName) => {
    try {
      const originId = item.foodId || item.id;
      const foodId = typeof originId === 'string' ? parseInt(originId.replace('food-', '')) : originId;
      
      await apiClient.post('/carts/me/items', {
        foodId: foodId,
        quantity: 1,
        note: ''
      });
      
      await get().fetchCart();
      return true;
    } catch (err) {
      console.error('Lỗi khi thêm món vào giỏ hàng:', err);
      return false;
    }
  },

  updateQty: async (foodId, currentQty, targetQty) => {
    try {
      const cleanFoodId = typeof foodId === 'string' ? parseInt(foodId.replace('food-', '')) : foodId;
      const delta = targetQty - currentQty;
      if (delta === 0) return;

      if (targetQty <= 0) {
        const allItems = get().carts.flatMap(c => c.items);
        const targetItem = allItems.find(i => i.foodId === cleanFoodId);
        if (targetItem) {
          await get().removeItem(targetItem.cartItemId);
        }
        return;
      }
      
      await apiClient.post('/carts/me/items', {
        foodId: cleanFoodId,
        quantity: delta,
        note: null
      });
      
      await get().fetchCart();
    } catch (err) {
      console.error('Lỗi khi cập nhật số lượng:', err);
    }
  },

  removeItem: async (cartItemId) => {
    try {
      await apiClient.delete(`/carts/me/items/${cartItemId}`);
      await get().fetchCart();
    } catch (err) {
      console.error('Lỗi khi xóa món khỏi giỏ hàng:', err);
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
