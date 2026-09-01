/**
 * Tách sessionId (sid) từ nội dung một mã QR đăng nhập.
 *
 * Mã QR do desktop tạo ra chứa URL dạng `https://.../qr/approve?sid=XXX`, nhưng cũng
 * chấp nhận trường hợp chuỗi chỉ có `sid=XXX` để phòng khi nội dung mã thay đổi.
 * Dùng chung cho cả trang QrApprove và widget RoleSwitcher nên đặt ở đây.
 */
export function extractSid(text) {
  if (!text) return null;
  try {
    return new URL(text).searchParams.get('sid');
  } catch {
    const m = String(text).match(/sid=([\w-]+)/);
    return m ? m[1] : null;
  }
}
