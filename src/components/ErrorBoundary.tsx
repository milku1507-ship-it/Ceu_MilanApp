import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Terjadi kesalahan yang tidak terduga.";
      
      try {
        // Try to parse Firestore JSON error
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
          errorMessage = "Akses ditolak. Kamu tidak memiliki izin untuk melakukan operasi ini.";
        }
      } catch (e) {
        // Not a JSON error or other error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-sm text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#1A1A2E]">Waduh, Ada Masalah!</h2>
              <p className="text-gray-500 font-medium">{errorMessage}</p>
            </div>
            <Button 
              onClick={() => window.location.reload()}
              className="w-full h-12 rounded-2xl orange-gradient text-white font-bold flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
