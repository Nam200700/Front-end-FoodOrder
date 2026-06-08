import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../services/api';

/**
 * Hook đa dụng dùng để upload hình ảnh lên server.
 * Trả về trạng thái uploading và hàm uploadImage.
 *
 * @param {Object} options
 * @param {string} options.uploadEndpoint - Endpoint để gửi request upload (mặc định: '/images/upload')
 * @param {number} options.maxSizeMB - Kích thước tối đa của file ảnh tính bằng MB (mặc định: 5)
 * @returns {{
 *   uploading: boolean,
 *   uploadImage: (file: File) => Promise<string|null>
 * }}
 */
export function useImageUpload({ uploadEndpoint = '/images/upload', maxSizeMB = 5 } = {}) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file) => {
    if (!file) return null;

    // Kiểm tra định dạng file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận file ảnh JPEG, PNG, WebP, HEIC.');
      return null;
    }

    // Kiểm tra kích thước file
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ảnh không được vượt quá ${maxSizeMB}MB.`);
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await apiClient.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Trả về url từ response data
      const url = res.data?.data?.url || res.data?.url || res.data?.data || null;
      if (!url) {
        throw new Error('Không nhận được URL ảnh từ server.');
      }
      return url;
    } catch (err) {
      console.error('[useImageUpload] Upload error:', err);
      toast.error(err.response?.data?.message || 'Tải ảnh lên thất bại.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, uploadImage };
}
