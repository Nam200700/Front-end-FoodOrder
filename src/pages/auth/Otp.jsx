import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';

export default function Otp() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  
  const { email, role, name, phone } = location.state || { 
    email: 'khachhang@gmail.com', 
    role: 'CUSTOMER', 
    name: 'Nguyễn Văn A', 
    phone: '0901234567' 
  };

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
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
    const pasteData = e.clipboardData.getData('text').trim();
    if (pasteData.length === 6 && !isNaN(pasteData)) {
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
    if (otpString.length < 6) return;

    setLoading(true);
    try {
      const result = await apiClient.post('/auth/verify-otp', { email, otp: otpString });
      const { token, refreshToken, user } = result.data.data;

      // Đăng nhập bằng token và user thực từ API
      useAuthStore.getState().setAuth({ token, refreshToken, user });

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
      toast.error(err.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn.');
      setOtp(['', '', '', '', '', '']);
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
    if (timer > 0) return;
    if (resendCount >= MAX_RESEND) {
      toast.error('Bạn đã vượt quá số lần yêu cầu gửi lại OTP cho phép (tối đa 3 lần).');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/resend-otp', { email });
      setResendCount(c => c + 1);
      setOtp(['', '', '', '', '', '']);
      setTimer(59);
      inputRefs.current[0]?.focus();
      toast.success('Mã OTP mới đã được gửi tới email của bạn.');
    } catch (err) {
      console.error('[Otp]: Resend failed', err);
      toast.error(err.response?.data?.message || 'Gửi lại OTP thất bại. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-md-surface-1 flex items-center justify-center p-4 font-google-sans">
      <div className="w-full max-w-md bg-white rounded-radius-xl p-8 border border-md-outline-variant/30 shadow-shadow-4 relative overflow-hidden">
        
        <button 
          onClick={() => navigate('/register')}
          className="absolute left-6 top-6 p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-12 h-12 bg-md-primary/10 text-md-primary rounded-radius-full flex items-center justify-center mb-4">
            <ShieldCheck size={26} />
          </div>
          <h2 className="text-xl font-bold text-md-on-surface">Xác thực OTP</h2>
          <p className="text-sm text-md-on-surface-variant text-center mt-2 px-4 leading-relaxed">
            Mã OTP gồm 6 chữ số đã được gửi đến email: <br/>
            <span className="font-bold text-md-on-surface">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between gap-2 max-w-xs mx-auto" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={digit}
                ref={(el) => (inputRefs.current[index] = el)}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-xl font-bold bg-md-surface-variant/20 border-2 border-md-outline-variant rounded-radius-lg focus:outline-none focus:border-md-primary focus:ring-4 focus:ring-md-primary/10 transition-all text-md-on-surface"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 6}
            className="w-full bg-md-primary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Xác Nhận & Kích Hoạt'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-md-on-surface-variant">
          Chưa nhận được mã?{' '}
          {timer > 0 ? (
            <span className="font-bold text-md-on-surface">Gửi lại sau {timer}s</span>
          ) : (
            <button 
              onClick={handleResend}
              className="text-md-primary font-bold hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw size={12} className="animate-spin-slow" />
              Gửi lại ngay
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
