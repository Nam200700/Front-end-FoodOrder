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
// Tự chèn dấu "-" và "." để khách CHỈ cần gõ chữ & số (dấu hiện live, KHÔNG nhảy).
// DỰNG biển số theo từng ô & BỎ ký tự dư → không thể tạo ra chuỗi sai cấu trúc dù gõ loạn:
//   • Mã tỉnh: đúng 2 số (số thứ 3 bị bỏ)
//   • Seri: 1–2 chữ (chữ thứ 3 bị bỏ)
//   • Xe máy (MOTORBIKE): thêm 1 số seri trước dấu "-"  → 59H1-234.56
//   • Ô tô   (CAR):       không số seri                 → 51F-123.45
//   • Số đăng ký: tối đa 5 số, chèn "." sau 3 số đầu (chuẩn hiển thị biển VN)
export const formatLicensePlate = (v, vehicleType = 'MOTORBIKE') => {
  const s = normalizeLicensePlate(v);
  let prov = '', letters = '', serial = '', num = '';
  for (const ch of s) {
    const isDigit = ch >= '0' && ch <= '9';
    // 1) Mã tỉnh: cần đủ 2 số, trước đó chỉ nhận số (chữ đứng trước bị bỏ)
    if (prov.length < 2) { if (isDigit) prov += ch; continue; }
    // 2) Seri chữ: nhận 1–2 chữ (chữ dư bị bỏ)
    if (!isDigit) { if (letters.length < 2) letters += ch; continue; }
    // ch là số & mã tỉnh đã đủ:
    if (letters.length === 0) continue;                 // chưa có chữ seri → bỏ số lạc
    if (vehicleType === 'MOTORBIKE' && serial.length < 1) { serial += ch; continue; } // 3) số seri xe máy
    if (num.length < 5) num += ch;                      // 4) số đăng ký (dư bị bỏ)
  }
  const head = prov + letters + serial;
  const numPart = num.length >= 4 ? `${num.slice(0, 3)}.${num.slice(3)}` : num;
  return (letters && num) ? `${head}-${numPart}` : head;
};
