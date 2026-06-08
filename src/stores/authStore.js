import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../services/api';

const mapUserFromApi = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.fullName || user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
    address: user.address || '',
    lat: user.latitude || user.lat || null,
    lng: user.longitude || user.lng || null,
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
  };
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      role: null,
      isLoggedIn: false,
      hasHydrated: false, // Cờ kiểm tra xem Zustand đã rehydrate dữ liệu xong chưa

      setHasHydrated: (state) => set({ hasHydrated: state }),

      setAuth: ({ token, refreshToken, user }) => set({
        token,
        refreshToken,
        user: mapUserFromApi(user),
        role: user ? user.role : null,
        isLoggedIn: !!token,
      }),

      login: async (phone, password) => {
        try {
          const response = await apiClient.post('/auth/login', { phone, password });
          const { token, refreshToken, user } = response.data.data;
          
          get().setAuth({ token, refreshToken, user });
          return { success: true };
        } catch (error) {
          console.error('[Auth Store]: Login error', error.response?.data || error);
          // BUG-SEC-05: Trả về generic error message để tránh User Enumeration
          const errMsg = 'Thông tin đăng nhập không đúng. Vui lòng thử lại!';
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
          
          if (token) {
            get().setAuth({ token, refreshToken, user });
          }
          
          return { success: true, pendingApproval: user ? (user.registerStatus === 'PENDING' || !user.status) : false };
        } catch (error) {
          console.error('[Auth Store]: Register error', error.response?.data || error);
          const resData = error.response?.data;
          if (resData?.errorCode === 'VALIDATION_FAILED' && resData?.data) {
            return { success: false, validationErrors: resData.data, error: resData.message };
          }
          return { success: false, error: 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin!' };
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
    }),
    {
      name: 'auth-storage',
      // BUG-SEC-02: Cấu hình Hybrid Storage chia tách localStorage & sessionStorage
      storage: {
        getItem: (name) => {
          try {
            const localStr = localStorage.getItem(name);
            const sessionStr = sessionStorage.getItem(name);
            const localData = localStr ? JSON.parse(localStr) : null;
            const sessionData = sessionStr ? JSON.parse(sessionStr) : null;
            return {
              state: {
                ...(localData ? localData.state : {}),
                ...(sessionData ? sessionData.state : {}),
              },
              version: localData?.version || sessionData?.version || 0,
            };
          } catch (e) {
            console.error('[Auth Store]: Storage rehydrate error', e);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const { user, role, isLoggedIn } = value.state;
            const { token, refreshToken } = value.state;
            
            // Persist display info and role to localStorage
            localStorage.setItem(
              name,
              JSON.stringify({
                state: { user, role, isLoggedIn },
                version: value.version,
              })
            );
            
            // Persist security tokens to sessionStorage (survives F5, cleared when closing tab)
            sessionStorage.setItem(
              name,
              JSON.stringify({
                state: { token, refreshToken },
                version: value.version,
              })
            );
          } catch (e) {
            console.error('[Auth Store]: Storage save error', e);
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
          sessionStorage.removeItem(name);
        },
      },
      // Cập nhật cờ hydration sau khi Zustand khôi phục dữ liệu từ storage thành công
      onRehydrateStorage: () => {
        return (state, error) => {
          if (!error && state) {
            state.setHasHydrated(true);
          }
        };
      },
    }
  )
);
