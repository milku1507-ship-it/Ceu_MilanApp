import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, ArrowRight, X } from 'lucide-react';

interface MigrationModalProps {
  onMigrate: () => void;
  onSkip: () => void;
}

export default function MigrationModal({ onMigrate, onSkip }: MigrationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <CardHeader className="bg-orange-50 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto">
            <Database className="w-8 h-8 text-[#FF6B35]" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-black text-[#1A1A2E]">Migrasi Data Lokal</CardTitle>
            <CardDescription className="font-medium text-orange-800/60">
              Ditemukan data lama di perangkat ini. Ingin dipindahkan ke akun Google kamu?
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <div className="space-y-3">
            <Button 
              onClick={onMigrate}
              className="w-full h-14 rounded-2xl orange-gradient text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-100"
            >
              Ya, Pindahkan Data
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost"
              onClick={onSkip}
              className="w-full h-12 rounded-2xl text-gray-400 font-bold hover:bg-gray-50"
            >
              Tidak, Mulai Baru
            </Button>
          </div>
          <p className="text-[10px] text-center text-gray-400 font-medium leading-relaxed">
            Jika dipindahkan, semua data HPP, Stok, dan Transaksi lama akan disinkronkan ke cloud.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
