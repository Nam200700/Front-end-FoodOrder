export const PHONE_REGEX = /^0[1-9]\d{8}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

export const validatePhone = (phone) => PHONE_REGEX.test(phone?.trim());
export const validatePassword = (pwd) => pwd?.length >= PASSWORD_MIN_LENGTH;
// Họ tên: tối thiểu 2 ký tự sau khi bỏ khoảng trắng thừa
export const validateName = (name) => (name?.trim().length ?? 0) >= 2;
// Email: kiểm tra định dạng cơ bản có phần trước @, tên miền và đuôi
export const validateEmail = (email) => EMAIL_REGEX.test(email?.trim());
// CCCD/CMND Việt Nam: CMND 9 số hoặc CCCD 12 số
export const validateIdCard = (idCard) => /^(\d{9}|\d{12})$/.test(idCard?.trim());
export const sanitizeText = (str) => str?.trim().slice(0, 500) ?? '';
