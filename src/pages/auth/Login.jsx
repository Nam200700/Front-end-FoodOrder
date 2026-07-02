import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Lock, Phone, ChevronRight, User, Store, Bike, Shield, KeyRound, Mail, MessageSquare, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { validatePassword } from '../../utils/validation';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  // Login State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // toggle xem mật khẩu ở ô đăng nhập
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot Password State
  const [mode, setMode] = useState('login'); // 'login' or 'forgot-password'
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS'); // 'SMS' or 'EMAIL'
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Countdown timer for resending OTP (Spam protection)
  useEffect(() => {
    let timer = null;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) return;

    setErrorMsg('');
    setLoading(true);
    const res = await login(phone, password);
    setLoading(false);
    
    if (res.success) {
      toast.success('Đăng nhập thành công! Đang chuyển hướng...', { autoClose: 1000 });
      setTimeout(() => {
        const currentRole = useAuthStore.getState().role;
        if (currentRole === 'MERCHANT' || currentRole === 'OWNER') navigate('/merchant');
        else if (currentRole === 'SHIPPER') navigate('/shipper');
        else if (currentRole === 'ADMIN') navigate('/admin');
        else navigate('/');
      }, 800);
    } else if (res.needVerify) {
      // Tài khoản chưa xác thực OTP -> chuyển sang trang nhập OTP (kèm email từ backend),
      // đánh dấu fromLogin để trang OTP tự gửi lại mã mới.
      toast.info('Tài khoản chưa xác thực OTP. Đang chuyển tới trang xác thực...', { autoClose: 1500 });
      navigate('/register/otp', { state: { email: res.email, phone, fromLogin: true } });
    } else {
      setErrorMsg(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
      toast.error(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
    }
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    if (!phoneOrEmail) {
      toast.warn('Vui lòng nhập số điện thoại hoặc email!');
      return;
    }

    setForgotLoading(true);
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/forgot-password/send-otp', {
        phoneOrEmail,
        method: otpMethod
      });
      setOtpSent(true);
      setCountdown(60); // Khóa 60s chống spam
      toast.success(response.data?.message || 'Mã OTP khôi phục mật khẩu đã được gửi!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại!';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpCode || !newPassword) {
      toast.warn('Vui lòng nhập đầy đủ mã OTP và mật khẩu mới!');
      return;
    }
    // Kiểm tra độ mạnh mật khẩu cho nhất quán với luồng Đăng ký (tối thiểu 8 ký tự).
    if (!validatePassword(newPassword)) {
      toast.warn('Mật khẩu mới phải chứa ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setForgotLoading(true);
    setErrorMsg('');
    try {
      const response = await apiClient.post('/auth/forgot-password/reset', {
        phoneOrEmail,
        otpCode,
        newPassword
      });
      toast.success(response.data?.message || 'Đặt lại mật khẩu thành công!');
      
      // Chuyển về chế độ Login và nạp sẵn thông tin vừa đổi
      setMode('login');
      setPhone(phoneOrEmail);
      setPassword('');
      setOtpSent(false);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra lại!';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMode('login');
    setErrorMsg('');
    setOtpSent(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4 sm:p-6 font-google-sans relative overflow-hidden">
      
      {/* Mesh Orbs Decor */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B35]/20 to-[#FF6B35]/5 rounded-full blur-3xl opacity-60 animate-pulse-slow"></div>
      <div className="absolute -bottom-48 -right-48 w-[28rem] h-[28rem] bg-gradient-to-tr from-[#1A73E8]/15 to-[#1A73E8]/5 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-slate-100/30 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
 
      {/* Card container */}
      <div className="w-full max-w-lg p-2.5 bg-slate-100/70 border border-slate-200/50 rounded-[2.25rem] shadow-shadow-2 relative overflow-hidden animate-slide-up z-10">
        
        {/* Core Inner Container */}
        <div className="bg-white rounded-[calc(2.25rem-0.625rem)] p-8 sm:p-10 relative overflow-hidden shadow-sm border border-slate-100/50 flex flex-col">
          
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"></div>
 
          {/* Header */}
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#FF6B35] to-[#1A73E8] rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-shadow-3 mb-4.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
              MD
            </div>
            
            <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-sm border border-slate-200/40">
              Hệ thống MealDash
            </span>
 
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-4.5 tracking-tight text-center">
              {mode === 'login' ? 'Chào mừng trở lại!' : 'Khôi phục mật khẩu'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-450 mt-2 text-center font-semibold max-w-xs leading-relaxed">
              {mode === 'login' ? (
                <>Đặt đồ ăn online siêu tốc với triết lý <span className="text-[#FF6B35] font-extrabold">Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span></>
              ) : (
                'Nhập số điện thoại hoặc email đã đăng ký để nhận mã OTP xác thực (hiệu lực trong 5 phút)'
              )}
            </p>
          </div>

          {/* Error message banner */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-650 rounded-radius-md text-[11px] font-bold mb-4 flex items-start gap-2 leading-relaxed shrink-0">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-extrabold block mb-0.5 text-red-700">Lỗi xử lý:</span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* ─── VIEW MODE: LOGIN ─────────────────────────────────────────────────── */}
          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5.5 relative z-10">
              
              {/* SĐT */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350"
                  />
                </div>
              </div>
 
              {/* Mật khẩu */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350"
                  />
                  {/* Nút xem/ẩn mật khẩu */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF6B35] transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
 
              {/* Option Bar */}
              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35]/20 w-4 h-4" 
                  />
                  Ghi nhớ tài khoản
                </label>
                <button 
                  type="button" 
                  onClick={() => { setMode('forgot-password'); setErrorMsg(''); }} 
                  className="text-[#FF6B35] hover:underline bg-transparent border-none cursor-pointer font-bold"
                >
                  Quên mật khẩu?
                </button>
              </div>
 
              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF6B35]/95 hover:from-[#ff7947] hover:to-[#FF6B35] text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-shadow-2 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
              >
                <span className="uppercase tracking-wider text-xs">
                  {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
                </span>
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
                  <ChevronRight size={18} className="stroke-[2.5px]" />
                </div>
              </button>
 
            </form>
          ) : (
            
            // ─── VIEW MODE: FORGOT PASSWORD ──────────────────────────────────────────
            <div className="space-y-6 relative z-10">
              
              {/* Form 1: Nhập email/phone và gửi OTP */}
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                    Số điện thoại hoặc Email
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      disabled={otpSent}
                      value={phoneOrEmail}
                      onChange={(e) => setPhoneOrEmail(e.target.value)}
                      placeholder="Nhập SĐT (09...) hoặc Email..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350 disabled:bg-slate-100 disabled:text-slate-450"
                    />
                  </div>
                </div>

                {/* Chọn phương thức gửi OTP */}
                {!otpSent && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Phương thức nhận mã OTP
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'SMS', label: 'Gửi qua SMS', icon: MessageSquare },
                        { id: 'EMAIL', label: 'Gửi qua Email', icon: Mail }
                      ].map((m) => {
                        const Icon = m.icon;
                        const isSelected = otpMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setOtpMethod(m.id)}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-radius-lg border font-bold text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <Icon size={14} />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Nút gửi OTP */}
                {!otpSent && (
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-gradient-to-r from-[#1A73E8] to-[#1A73E8]/95 hover:from-blue-600 hover:to-[#1A73E8] text-white font-extrabold py-3 px-4 rounded-full text-xs uppercase tracking-wider shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {forgotLoading ? 'Đang gửi...' : 'Gửi mã OTP xác thực'}
                  </button>
                )}
              </form>

              {/* Form 2: Nhập OTP và Reset mật khẩu */}
              {otpSent && (
                <form onSubmit={handleResetPassword} className="space-y-4 pt-4 border-t border-slate-100 animate-fade-in">
                  
                  <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-radius-lg text-[11px] font-bold leading-normal flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <div>
                      Mã OTP đã được gửi đến {phoneOrEmail} qua {otpMethod === 'SMS' ? 'tin nhắn SMS' : 'Email'}. 
                      Vui lòng kiểm tra mã xác thực.
                    </div>
                  </div>

                  {/* Mã OTP */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pl-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Nhập mã OTP (6 số)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {countdown > 0 ? (
                          `Gửi lại sau ${countdown}s`
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendForgotOtp}
                            className="text-[#1A73E8] hover:underline font-bold bg-transparent border-none cursor-pointer"
                          >
                            Gửi lại mã OTP
                          </button>
                        )}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Nhập 6 chữ số..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350 text-center tracking-[0.5em] font-mono text-base"
                    />
                  </div>

                  {/* Mật khẩu mới */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350"
                      />
                    </div>
                  </div>

                  {/* Nhập lại mật khẩu mới */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-350"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF6B35]/95 hover:from-[#ff7947] hover:to-[#FF6B35] text-white font-extrabold py-3.5 px-4 rounded-full text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {forgotLoading ? 'Đang thực hiện...' : 'Xác nhận & Đặt lại mật khẩu'}
                  </button>
                </form>
              )}

              {/* Nút quay lại login */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline bg-transparent border-none cursor-pointer"
                >
                  ← Quay lại Đăng nhập
                </button>
              </div>

            </div>
          )}

          {/* Footer Navigation */}
          {mode === 'login' && (
            <div className="mt-8 text-center text-xs text-slate-500 relative z-10 font-semibold">
              Bạn chưa có tài khoản?{' '}
              <button 
                onClick={() => navigate('/register')} 
                className="text-[#FF6B35] font-extrabold hover:underline cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </div>
          )}

        </div>
      </div>
      <ToastContainer />
    </div>
  );
}