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

// ── BIỂN SỐ XE VIỆT NAM ─────────────────────────────────────────────────────
// Cấu trúc: mã tỉnh (2 số) + seri (1–2 chữ) + số đăng ký (4–6 số). Dấu "-" và "." KHÔNG bắt buộc.
// Chấp nhận: 59H1-234.56 (xe máy), 51F-12345 / 30A-123.45 (ô tô), 29-B1 12345…
export const LICENSE_PLATE_REGEX = /^\d{2}[A-Z]{1,2}\d{4,6}$/;
// Bỏ mọi ký tự không phải chữ/số rồi viết hoa → dạng "gốc" để kiểm tra & so khớp
export const normalizeLicensePlate = (v) => (v || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
export const validateLicensePlate = (v) => LICENSE_PLATE_REGEX.test(normalizeLicensePlate(v));
// Tự chèn dấu "-" theo cấu trúc để khách CHỈ cần gõ chữ & số (dấu hiện live, KHÔNG nhảy).
// Vị trí dấu được xác định theo loại xe → cố định, không phụ thuộc số ký tự đã gõ:
//   • Xe máy (MOTORBIKE): tỉnh + chữ + 1 số seri  "-"  số đăng ký   (59H1-23456)
//   • Ô tô   (CAR):       tỉnh + chữ               "-"  số đăng ký   (51F-12345)
export const formatLicensePlate = (v, vehicleType = 'MOTORBIKE') => {
  const s = normalizeLicensePlate(v).slice(0, 9); // 2 tỉnh + tối đa 2 chữ + (1 seri) + 5 số
  const m = s.match(/^(\d{0,2})([A-Z]{0,2})(\d{0,6})$/);
  if (!m) return s;
  const [, prov, letters, digits] = m;
  let serial = '', tail = digits;
  if (vehicleType === 'MOTORBIKE' && digits.length > 0) {
    serial = digits.slice(0, 1); // xe máy: số seri đứng ngay sau chữ, trước dấu "-"
    tail = digits.slice(1);
  }
  const head = prov + letters + serial;
  // Chỉ chèn "-" khi đã có phần chữ (seri) và bắt đầu nhập số đăng ký
  return (letters && tail) ? `${head}-${tail}` : head;
};
