import React, { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary caught an error]:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center p-4 bg-slate-50 font-google-sans">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-650 text-2xl mb-2">
            ⚠️
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Đã xảy ra lỗi không mong muốn</h2>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
            Ứng dụng gặp sự cố kỹ thuật ngoài ý muốn. Vui lòng làm mới lại trang để tiếp tục sử dụng.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 bg-md-primary text-white text-xs font-bold uppercase tracking-wider rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1px] transition-all cursor-pointer"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
