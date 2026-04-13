import React from 'react';
import { Button } from '@/components/ui/button';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Berhasil masuk!');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Gagal masuk dengan Google. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA] p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl orange-gradient flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-orange-200">
              C
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-[#1A1A2E]">Ceumilan Pay</h1>
            <p className="text-gray-500 font-medium">Manajemen HPP & Stok Cireng Jadi Lebih Mudah</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 space-y-6">
          <Button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-14 rounded-2xl orange-gradient text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-orange-100 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Masuk dengan Google
              </>
            )}
          </Button>
          
          <p className="text-xs text-gray-400 font-medium">
            Data kamu tersimpan aman dan bisa diakses di perangkat manapun
          </p>
        </div>
      </div>
    </div>
  );
}
