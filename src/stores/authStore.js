import { create } from 'zustand';
import apiClient from '../services/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  role: null,
  isLoggedIn: false,

  login: async (phone, password) => {
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const { token, refreshToken, user } = response.data.data;
      
      set({
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || '',
          address: user.address || '',
          lat: user.latitude || null,
          lng: user.longitude || null,
          registerStatus: user.registerStatus || null,
          rejectedReason: user.rejectedReason || null,
          // Partner specific fields
          restaurantName: user.restaurantName || '',
          restaurantAddress: user.restaurantAddress || '',
          restaurantLatitude: user.restaurantLatitude || null,
          restaurantLongitude: user.restaurantLongitude || null,
          restaurantPhone: user.restaurantPhone || '',
          restaurantDescription: user.restaurantDescription || '',
          restaurantImageUrl: user.restaurantImageUrl || '',
          idCard: user.idCard || '',
          vehicleType: user.vehicleType || 'MOTORBIKE',
          licensePlate: user.licensePlate || '',
        },
        token,
        refreshToken,
        role: user.role, // CUSTOMER, OWNER, SHIPPER, ADMIN
        isLoggedIn: true,
      });
      return { success: true };
    } catch (error) {
      console.error('[Auth Store]: Login error', error);
      const errMsg = error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra số điện thoại và mật khẩu!';
      return { success: false, error: errMsg };
    }
  },

  register: async (fullName, phone, email, password, role, additionalData = {}) => {
    try {
      const response = await apiClient.post('/auth/register', {
        fullName,
        phone,
        email,
        password,
        role,
        ...additionalData
      });
      const { token, refreshToken, user } = response.data.data;
      
      // Cho phép đăng nhập tự động ngay sau khi đăng ký để hiển thị màn hình chờ duyệt / gửi lại hồ sơ đối tác
      set({
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || '',
          address: user.address || '',
          lat: user.latitude || null,
          lng: user.longitude || null,
          registerStatus: user.registerStatus || null,
          rejectedReason: user.rejectedReason || null,
          // Partner specific fields
          restaurantName: user.restaurantName || '',
          restaurantAddress: user.restaurantAddress || '',
          restaurantLatitude: user.restaurantLatitude || null,
          restaurantLongitude: user.restaurantLongitude || null,
          restaurantPhone: user.restaurantPhone || '',
          restaurantDescription: user.restaurantDescription || '',
          restaurantImageUrl: user.restaurantImageUrl || '',
          idCard: user.idCard || '',
          vehicleType: user.vehicleType || 'MOTORBIKE',
          licensePlate: user.licensePlate || '',
        },
        token,
        refreshToken,
        role: user.role,
        isLoggedIn: true,
      });
      
      return { success: true, pendingApproval: !user.status };
    } catch (error) {
      console.error('[Auth Store]: Register error', error);
      const resData = error.response?.data;
      if (resData?.errorCode === 'VALIDATION_FAILED' && resData?.data) {
        return { success: false, validationErrors: resData.data, error: resData.message };
      }
      const errMsg = resData?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin!';
      return { success: false, error: errMsg, errorCode: resData?.errorCode };
    }
  },

  ownerReRegister: async (restaurantName, restaurantAddress, restaurantLatitude, restaurantLongitude, restaurantPhone, restaurantDescription, restaurantImageUrl) => {
    try {
      const response = await apiClient.post('/users/owner/re-register', {
        restaurantName,
        restaurantAddress,
        restaurantLatitude,
        restaurantLongitude,
        restaurantPhone,
        restaurantDescription,
        restaurantImageUrl
      });
      const user = response.data.data;
      set((state) => ({
        user: state.user ? {
          ...state.user,
          registerStatus: user.registerStatus,
          rejectedReason: user.rejectedReason,
          address: user.address || state.user.address,
          restaurantName: user.restaurantName || restaurantName,
          restaurantAddress: user.restaurantAddress || restaurantAddress,
          restaurantLatitude: user.restaurantLatitude || restaurantLatitude,
          restaurantLongitude: user.restaurantLongitude || restaurantLongitude,
          restaurantPhone: user.restaurantPhone || restaurantPhone,
          restaurantDescription: user.restaurantDescription || restaurantDescription,
          restaurantImageUrl: user.restaurantImageUrl || restaurantImageUrl,
        } : null
      }));
      return { success: true };
    } catch (error) {
      console.error('[Auth Store]: Owner re-register error', error);
      const errMsg = error.response?.data?.message || 'Gửi lại hồ sơ đối tác thất bại!';
      return { success: false, error: errMsg };
    }
  },

  shipperReRegister: async (idCard, vehicleType, licensePlate) => {
    try {
      const response = await apiClient.post('/users/shipper/re-register', {
        idCard,
        vehicleType,
        licensePlate
      });
      const user = response.data.data;
      set((state) => ({
        user: state.user ? {
          ...state.user,
          registerStatus: user.registerStatus,
          rejectedReason: user.rejectedReason,
          idCard: user.idCard || idCard,
          vehicleType: user.vehicleType || vehicleType,
          licensePlate: user.licensePlate || licensePlate,
        } : null
      }));
      return { success: true };
    } catch (error) {
      console.error('[Auth Store]: Shipper re-register error', error);
      const errMsg = error.response?.data?.message || 'Gửi lại hồ sơ đối tác thất bại!';
      return { success: false, error: errMsg };
    }
  },

  logout: () => set({
    user: null,
    token: null,
    refreshToken: null,
    role: null,
    isLoggedIn: false,
  }),

  updateProfile: (updatedFields) => set((state) => ({
    user: state.user ? { ...state.user, ...updatedFields } : null
  })),

  setRole: (role) => set({ role }), // Để RoleSwitcher hoạt động
}));
