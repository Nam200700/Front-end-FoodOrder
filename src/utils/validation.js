export const PHONE_REGEX = /^0[1-9]\d{8}$/;
export const PASSWORD_MIN_LENGTH = 8;

export const validatePhone = (phone) => PHONE_REGEX.test(phone?.trim());
export const validatePassword = (pwd) => pwd?.length >= PASSWORD_MIN_LENGTH;
export const sanitizeText = (str) => str?.trim().slice(0, 500) ?? '';
