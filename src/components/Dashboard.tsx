
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertCircle, ArrowUpRight, Clock, Wallet, ArrowUp, ArrowDown, History, MoreHorizontal, LayoutGrid, Calculator } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Ingredient, Transaction, StoreSettings } from '../types';
import { User } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { formatSmartUnit } from '../lib/unitUtils';
import { formatCompactNumber, formatCurrency } from '../lib/formatUtils';

interface DashboardProps {
  user: User | null;
  ingredients: Ingredient[];
  transactions: Transaction[];
  storeSettings: StoreSettings;
  setActiveTab: (tab: string) => void;
  onSeedData?: () => Promise<void>;
  onStartFresh?: () => Promise<void>;
}

export default function Dashboard({ user, ingredients, transactions, storeSettings, setActiveTab, onSeedData, onStartFresh }: DashboardProps) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyTransactions = transactions.filter(t => {
    if (!t.tanggal) return false;
    const d = new Date(t.tanggal);
    const dateToCompare = isNaN(d.getTime()) ? (() => {
      const parts = t.tanggal.split('/');
      if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return new Date(NaN);
    })() : d;

    if (isNaN(dateToCompare.getTime())) return false;
    return dateToCompare.getMonth() === currentMonth && dateToCompare.getFullYear() === currentYear;
  });

  // SOURCE OF TRUTH: Direct summation from transaction fields as requested
  // totalRevenue: Sum of net income (gross - fees) from all Pemasukan transactions
  const totalRevenue = monthlyTransactions
    .filter(t => (t.jenis || t.type) === 'Pemasukan')
    .reduce((acc, t) => acc + (t.laba || 0), 0);

  // totalExpense: Sum of manual expenses ONLY (Not including HPP)
  const totalExpense = monthlyTransactions
    .filter(t => (t.jenis || t.type) === 'Pengeluaran')
    .reduce((acc, t) => acc + (t.total_biaya || 0), 0);

  // netProfit: totalRevenue (Net) - totalExpense (Manual)
  const netProfit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const lowStockItems = ingredients.filter(i => i.currentStock <= i.minStock);

  // 7-day sales data
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const daySales = transactions
      .filter(t => t.tanggal === dateStr && t.jenis === 'Pemasukan')
      .reduce((acc, t) => acc + (t.total_penjualan || t.nominal || 0), 0);
    return {
      name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      sales: daySales
    };
  });

  const showWelcome = ingredients.length === 0 && transactions.length === 0 && !storeSettings.onboardingCompleted;

  return (
    <div className="space-y-6 pb-8">
      {showWelcome && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-brand-50 p-8 text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto text-primary shadow-sm">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-[#1A1A2E]">Selamat Datang di Cloud!</h3>
            <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
              Akun kamu masih kosong. Mulai masukkan data atau gunakan data contoh untuk mencoba fitur.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onStartFresh || (() => setActiveTab('hpp'))} className="orange-gradient text-white font-bold rounded-2xl px-8 h-12">
              Mulai Input HPP
            </Button>
            {onSeedData && (
              <Button onClick={onSeedData} variant="outline" className="bg-white border-brand-100 text-primary font-bold rounded-2xl px-8 h-12">
                Gunakan Data Contoh
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* E-Wallet Header Card */}
      <div className="relative overflow-hidden wallet-gradient rounded-[2.5rem] p-6 text-white shadow-2xl shadow-brand-200">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Saldo Laba (Bulan Ini)</p>
                <h3 className="text-3xl font-black">{formatCurrency(netProfit, true)}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <HeaderAction icon={ArrowUp} label="Tambah" onClick={() => setActiveTab('transactions')} />
            <HeaderAction icon={Package} label="Stok" onClick={() => setActiveTab('stock')} />
            <HeaderAction icon={Calculator} label="HPP" onClick={() => setActiveTab('hpp')} />
            <HeaderAction icon={History} label="Riwayat" onClick={() => setActiveTab('transactions')} />
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/10 rounded-full blur-3xl" />
      </div>

      {/* Monthly Summary Bento */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pemasukan</span>
          </div>
          <p className="text-xl font-black text-[#1A1A2E]">{formatCurrency(totalRevenue, true)}</p>
          <p className="text-[10px] text-green-600 font-bold mt-1">+{transactions.filter(t => t.jenis === 'Pemasukan').length} Transaksi</p>
        </div>
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <ArrowDown className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pengeluaran</span>
          </div>
          <p className="text-xl font-black text-[#1A1A2E]">{formatCurrency(totalExpense, true)}</p>
          <p className="text-[10px] text-red-500 font-bold mt-1">-{transactions.filter(t => t.jenis === 'Pengeluaran').length} Transaksi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-[#1A1A2E]">Grafik Penjualan</CardTitle>
              <CardDescription>Performa 7 hari terakhir</CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full bg-brand-50 text-primary border-none font-bold">
              Mingguan
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7Days}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 'bold' }}
                  />
                  <YAxis 
                    hide
                  />
                  <Tooltip 
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 2 }}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-[#1A1A2E]">Aktivitas</CardTitle>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="w-5 h-5 text-gray-400" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactions.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center gap-4 group">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  t.jenis === 'Pemasukan' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                )}>
                  {t.jenis === 'Pemasukan' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A1A2E] truncate">{t.keterangan}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{t.kategori}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-black",
                    t.jenis === 'Pemasukan' ? "text-green-600" : "text-red-500"
                  )}>
                    {t.jenis === 'Pemasukan' ? '+' : '-'} {formatCompactNumber(t.nominal)}
                  </p>
                  <p className="text-[10px] text-gray-400">{t.tanggal}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Stock Alert Section */}
      {lowStockItems.length > 0 && (
        <div className="bg-white rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#1A1A2E]">Perhatian Stok</h3>
            <Badge className="bg-red-50 text-red-600 border-none font-bold">
              {lowStockItems.length} Item Menipis
            </Badge>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {lowStockItems.map((item) => (
              <div key={item.id} className="shrink-0 w-40 p-4 bg-brand-50 rounded-3xl border border-brand-100">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-primary mb-3 shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-[#1A1A2E] truncate">{item.name}</p>
                <p className="text-[10px] font-bold text-primary mt-1">Sisa: {formatSmartUnit(item.currentStock, item.unit)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderAction({ icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center transition-all group-hover:bg-white/30 group-active:scale-95">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon: Icon, color, isCurrency, isPercentage }: any) {
  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
    : isPercentage 
    ? `${value.toFixed(1)}%`
    : value;

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-3xl bg-white group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-xl font-black text-[#1A1A2E] mt-1 group-hover:text-primary transition-colors">{formattedValue}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
