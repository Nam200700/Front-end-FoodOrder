// Các hình ảnh SVG mặc định dạng Data URI an toàn (không chứa script, không gọi external)

export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 11.75c-2.89 0-5.46-1.48-6.96-3.75.04-2.3 4.64-3.55 6.96-3.55 2.3 0 6.91 1.25 6.96 3.55-1.5 2.27-4.07 3.75-6.96 3.75z'/></svg>";

export const DEFAULT_FOOD_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm8-3h-3v14h-2V2c3 0 5 2.24 5 4z'/></svg>";

export const DEFAULT_BANNER_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300' fill='none'><rect width='800' height='300' fill='%23e2e8f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-weight='bold' font-size='24' fill='%2394a3b8'>MealDash Restaurant Banner</text></svg>";

/**
 * Trả về đường dẫn avatar hợp lệ. Nếu avatar rỗng/null, dùng placeholder SVG vector.
 * @param {string} avatar 
 * @returns {string}
 */
export const getAvatarUrl = (avatar) => {
  if (avatar && avatar.trim() !== '' && !avatar.includes('photo-1535713875002')) {
    return avatar;
  }
  return DEFAULT_AVATAR;
};

/**
 * Trả về đường dẫn ảnh món ăn hợp lệ. Nếu rỗng/null, dùng placeholder SVG vector.
 * @param {string} image 
 * @returns {string}
 */
export const getFoodImageUrl = (image) => {
  if (image && image.trim() !== '' && !image.includes('photo-1546069901')) {
    return image;
  }
  return DEFAULT_FOOD_IMAGE;
};

/**
 * Trả về đường dẫn ảnh banner nhà hàng hợp lệ. Nếu rỗng/null, dùng placeholder SVG vector.
 * @param {string} image 
 * @returns {string}
 */
export const getRestaurantBannerUrl = (image) => {
  if (image && image.trim() !== '' && !image.includes('photo-1546069901')) {
    return image;
  }
  return DEFAULT_BANNER_IMAGE;
};
