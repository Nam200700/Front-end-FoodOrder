import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { ShieldCheck, ArrowLeft, RefreshCw, Mail, Lock, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';

// Màu nhấn theo vai trò — đồng bộ với trang Đăng ký / Đăng nhập
const ROLE_THEME = { CUSTOMER: '#FF6B35', OWNER: '#1A73E8', SHIPPER: '#34A853' };
const ROLE_LABEL = { CUSTOMER: 'Khách hàng', OWNER: 'Quán ăn', SHIPPER: 'Tài xế' };

export default function Otp() {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, role, fromLogin } = location.state || {
    email: 'khachhang@gmail.com',
    role: 'CUSTOMER',
  };

  const accent = ROLE_THEME[role] || ROLE_THEME.CUSTOMER;
  const roleLabel = ROLE_LABEL[role] || 'Người dùng';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  /* Đến từ Login (tài khoản đăng ký trước đó chưa verify): KHÔNG tự gửi OTP để tránh
   bị lợi dụng login lặp không để dội bom email. Thay vào đó cho nút "Gửi lại" bấm được ngay
   (timer=0) để user chủ động lấy mã mới (mã lúc đăng ký thường đã hết hạn 5 phút).
   Đăng ký mới thì register() đã tự gửi OTP khi giữ đếm ngược 59s như cũ.
  */
  const [timer, setTimer] = useState(fromLogin ? 0 : 59);
  const [loading, setLoading] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [shake, setShake] = useState(false);
  // Lỗi hiển thị NGAY DƯỚI ô nhập: người dùng đang nhìn vào ô OTP nên dễ thấy hơn
  // toast ở góc màn hình (nhất là trên điện thoại). Nội dung lấy từ BE nên hiện đúng
  // "Mã OTP không chính xác!" / "Mã OTP đã hết hạn!" / "Tài khoản tạm khóa đến ...".
  const [error, setError] = useState('');
  // Số giây còn bị tạm khóa do nhập sai quá nhiều lần. BE trả về trong
  // data.retryAfterSeconds (kèm header Retry-After) -> FE đếm ngược thời gian thực,
  // user thấy chính xác còn bao lâu mà không phải tải lại trang.
  const [lockLeft, setLockLeft] = useState(0);
  const inputRefs = useRef([]);

  const locked = lockLeft > 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      setLockLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 125 -> "02:05"
  const formatCountdown = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleChange = (index, value) => {
    if (isNaN(value) || locked) return;
    setError('');           // gõ lại số mới -> xoá lỗi cũ
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Tự động focus ô tiếp theo
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Nhấn Backspace để quay lại ô trước
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    if (locked) return;
    const pasteData = e.clipboardData.getData('text').trim();
    if (pasteData.length === 6 && !isNaN(pasteData)) {
      setError('');
      const newOtp = pasteData.split('');
      setOtp(newOtp);
      inputRefs.current[5].focus();
    }
  };

  const [resendCount, setResendCount] = useState(0);
  const MAX_RESEND = 3;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6 || locked) return;

    setLoading(true);
    setError('');
    try {
      const result = await apiClient.post('/auth/verify-otp', { email, otp: otpString });
      const { token, user } = result.data.data;

      // Đăng nhập bằng access token thực từ API (refresh token đã nằm trong cookie HttpOnly)
      useAuthStore.getState().setAuth({ token, user });

      toast.success('Xác thực tài khoản thành công!');

      // Chuyển trang dựa trên role
      if (user.role === 'OWNER' || user.role === 'MERCHANT') {
        navigate('/merchant');
      } else if (user.role === 'SHIPPER') {
        navigate('/shipper');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('[Otp]: Verification failed', err);
      const msg = err.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn.';
      // Bị tạm khóa: chuyển sang khối đếm ngược, không hiện thêm dòng lỗi thường.
      const retryAfter = err.response?.data?.data?.retryAfterSeconds;
      if (retryAfter > 0) {
        setLockLeft(retryAfter);
        setError('');
      } else {
        setError(msg);
      }
      toast.error(msg);
      setOtp(['', '', '', '', '', '']);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Tự động submit khi gõ đủ 6 số
  useEffect(() => {
    if (otp.join('').length === 6) {
      handleSubmit();
    }
  }, [otp]);

  const handleResend = async () => {
    if (timer > 0 || locked) return;
    if (resendCount >= MAX_RESEND) {
      const msg = 'Bạn đã vượt quá số lần yêu cầu gửi lại OTP cho phép (tối đa 3 lần).';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/resend-otp', { email });
      setResendCount(c => c + 1);
      setOtp(['', '', '', '', '', '']);
      setTimer(59);
      inputRefs.current[0]?.focus();
      toast.success('Mã OTP mới đã được gửi tới email của bạn.');
    } catch (err) {
      console.error('[Otp]: Resend failed', err);
      const msg = err.response?.data?.message || 'Gửi lại OTP thất bại. Vui lòng thử lại sau.';
      const retryAfter = err.response?.data?.data?.retryAfterSeconds;
      if (retryAfter > 0) {
        setLockLeft(retryAfter);
        setError('');
      } else {
        setError(msg);
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filledCount = otp.filter(Boolean).length;
  const complete = filledCount === 6;
  const attemptsLeft = MAX_RESEND - resendCount;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-google-sans relative overflow-hidden bg-md-surface-1">
      {/* ─── Nền trang trí: blob gradient theo màu vai trò + brand ─── */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-50 animate-pulse-slow"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }} />
      <div className="pointer-events-none absolute -bottom-48 -right-40 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }} />
      <div className="pointer-events-none absolute top-1/3 right-10 w-2 h-2 rounded-full animate-twinkle" style={{ backgroundColor: accent }} />
      <div className="pointer-events-none absolute bottom-24 left-16 w-1.5 h-1.5 rounded-full animate-twinkle" style={{ backgroundColor: accent, animationDelay: '0.8s' }} />

      <div className="w-full max-w-md bg-white rounded-3xl border border-md-outline-variant/30 shadow-shadow-4 relative overflow-hidden animate-rise-in">
        {/* Dải màu vai trò chạy trên đỉnh card */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

        <div className="p-8">
          <button
            onClick={() => navigate('/register')}
            className="absolute left-5 top-6 p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Badge vai trò */}
          <div className="flex justify-center mb-5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full animate-rise-in"
              style={{ color: accent, backgroundColor: `${accent}12`, border: `1px solid ${accent}2e`, animationDelay: '60ms' }}>
              Kích hoạt tài khoản {roleLabel}
            </span>
          </div>

          {/* Icon khiên có halo + float */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <span className="absolute inset-0 rounded-full animate-halo pointer-events-none" style={{ border: `2px solid ${accent}` }} />
              <div className="w-16 h-16 rounded-full flex items-center justify-center animate-float shadow-lg"
                style={{ backgroundColor: `${accent}14`, color: accent, boxShadow: `0 10px 30px ${accent}33` }}>
                <ShieldCheck size={30} strokeWidth={2.2} />
              </div>
            </div>
            <h2 className="text-2xl font-black text-md-on-surface tracking-tight animate-rise-in" style={{ animationDelay: '90ms' }}>Xác thực OTP</h2>
            <p className="text-sm text-md-on-surface-variant text-center mt-2 leading-relaxed animate-rise-in" style={{ animationDelay: '120ms' }}>
              Mã gồm 6 chữ số đã được gửi tới email của bạn
            </p>
            {/* Chip email */}
            <div className="mt-3 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full pl-3 pr-3.5 py-1.5 max-w-full animate-rise-in" style={{ animationDelay: '150ms' }}>
              <Mail size={13} style={{ color: accent }} className="shrink-0" />
              <span className="text-xs font-bold text-md-on-surface truncate">{email}</span>
            </div>

            {fromLogin && (
              <p className="text-xs mt-4 px-3 py-2 rounded-radius-md text-center font-semibold leading-relaxed animate-rise-in"
                style={{ color: accent, backgroundColor: `${accent}0d`, border: `1px solid ${accent}26`, animationDelay: '180ms' }}>
                Tài khoản chưa xác thực. Mã trước có thể đã hết hạn — bấm <span className="font-extrabold">"Gửi lại ngay"</span> để nhận mã mới.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 6 ô OTP — trạng thái điền/đang focus tô theo màu vai trò, rung khi sai */}
            <div className={`flex justify-center gap-2.5 ${shake ? 'animate-shake' : ''}`} onPaste={handlePaste}>
              {otp.map((digit, index) => {
                const isFilled = digit !== '';
                const isFocus = focusIdx === index;
                const active = isFilled || isFocus;
                const bad = !!error || locked;   // tô đỏ khi sai mã hoặc đang bị khóa
                return (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    ref={(el) => (inputRefs.current[index] = el)}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onFocus={() => setFocusIdx(index)}
                    onBlur={() => setFocusIdx(-1)}
                    disabled={locked}
                    aria-invalid={!!error || locked}
                    className="w-12 h-14 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all duration-200 text-md-on-surface disabled:cursor-not-allowed"
                    style={{
                      borderColor: bad ? '#EA4335' : (active ? accent : '#e2e8f0'),
                      backgroundColor: bad ? '#EA43350d' : (isFilled ? `${accent}0f` : '#f8fafc'),
                      boxShadow: isFocus ? `0 0 0 4px ${bad ? '#EA43351f' : `${accent}1f`}` : 'none',
                      transform: isFocus ? 'translateY(-2px)' : 'none',
                      opacity: locked ? 0.6 : 1,
                    }}
                  />
                );
              })}
            </div>

            {/* Đang bị tạm khóa: đếm ngược thời gian thực, thay cho dòng lỗi thường */}
            {locked && (
              <div
                role="alert"
                aria-live="polite"
                className="px-3.5 py-3 rounded-radius-md border animate-rise-in"
                style={{ backgroundColor: '#EA43350d', borderColor: '#EA433540' }}
              >
                <div className="flex items-start gap-2" style={{ color: '#C5221F' }}>
                  <AlertCircle size={15} className="shrink-0 mt-px" />
                  <span className="text-xs font-bold leading-relaxed">
                    Bạn đã nhập sai quá nhiều lần. Vui lòng chờ hết thời gian bên dưới.
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <Clock size={14} style={{ color: '#C5221F' }} />
                  <span
                    className="text-2xl font-black tabular-nums tracking-wider"
                    style={{ color: '#C5221F' }}
                  >
                    {formatCountdown(lockLeft)}
                  </span>
                </div>
              </div>
            )}

            {/* Thông báo lỗi ngay dưới ô nhập — role="alert" để trình đọc màn hình đọc lên */}
            {!locked && error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 px-3.5 py-2.5 rounded-radius-md border animate-rise-in"
                style={{ color: '#C5221F', backgroundColor: '#EA43350d', borderColor: '#EA433540' }}
              >
                <AlertCircle size={15} className="shrink-0 mt-px" />
                <span className="text-xs font-bold leading-relaxed">{error}</span>
              </div>
            )}

            {/* Chỉ báo tiến trình nhập (6 chấm) */}
            <div className="flex justify-center gap-1.5">
              {otp.map((d, i) => (
                <span key={i} className="h-1 rounded-full transition-all duration-300"
                  style={{ width: d ? 18 : 10, backgroundColor: d ? accent : '#e2e8f0' }} />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !complete || locked}
              className="w-full text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              {locked ? (
                <>
                  <Clock size={16} /> Tạm khóa {formatCountdown(lockLeft)}
                </>
              ) : loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Xác nhận & Kích hoạt
                </>
              )}
            </button>
          </form>

          {/* Gửi lại mã */}
          <div className="mt-6 text-center text-xs text-md-on-surface-variant">
            Chưa nhận được mã?{' '}
            {timer > 0 ? (
              <span className="font-bold text-md-on-surface inline-flex items-center gap-1">
                <Clock size={12} /> Gửi lại sau {timer}s
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={loading || attemptsLeft <= 0 || locked}
                className="font-bold hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline cursor-pointer"
                style={{ color: accent }}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : 'animate-spin-slow'} />
                Gửi lại ngay
              </button>
            )}
            {resendCount > 0 && attemptsLeft > 0 && (
              <span className="block mt-1 text-[10px] text-md-on-surface-variant/70">Còn {attemptsLeft} lượt gửi lại</span>
            )}
          </div>

          {/* Ghi chú bảo mật */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-[10px] text-md-on-surface-variant/80 leading-relaxed">
            <Lock size={12} className="shrink-0 mt-0.5 text-slate-400" />
            <span>Tuyệt đối <b className="text-md-on-surface">không chia sẻ</b> mã OTP cho bất kỳ ai. Đội ngũ hệ thống sẽ không bao giờ hỏi mã của bạn.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
