import { toast } from 'react-toastify';
import apiClient from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useImageUpload } from './useImageUpload';

export function useAvatarUpload(onSuccess) {
  const { uploading, uploadImage } = useImageUpload({ uploadEndpoint: '/images/upload', maxSizeMB: 5 });
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleAvatarChange = async (file) => {
    if (!file) return;
    const newUrl = await uploadImage(file);
    if (!newUrl) return;

    try {
      if (onSuccess) {
        await onSuccess(newUrl);
      } else {
        await apiClient.put('/users/profile', { avatar: newUrl });
        updateProfile({ avatar: newUrl });
        toast.success('Cập nhật ảnh đại diện thành công!');
      }
      return newUrl;
    } catch (err) {
      console.error('[useAvatarUpload] Error saving avatar URL:', err);
      toast.error(err.response?.data?.message || 'Lưu ảnh đại diện thất bại.');
    }
  };

  return { uploading, handleAvatarChange };
}


