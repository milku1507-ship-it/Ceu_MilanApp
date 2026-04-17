import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown, PieChart as PieIcon, BarChart as BarIcon, Calendar, FileText, Package } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction, Product, Variant, HppMaterial } from '../types';
import { CATEGORIES_LIST } from '../constants/data';
import { cn } from '@/lib/utils';
import { formatCompactNumber, formatCurrency } from '../lib/formatUtils';

interface FinancialReportProps {
  transactions: Transaction[];
  products: Product[];
}

export default function FinancialReport({ transactions, products }: FinancialReportProps) {
  const [period, setPeriod] = React.useState('Bulan Ini');

  const filteredTransactions = transactions.filter(t => {
    if (!t.tanggal) return false;
    const d = new Date(t.tanggal);
    const dateToCompare = isNaN(d.getTime()) ? (() => {
      const parts = t.tanggal.split('/');
      if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return new Date(NaN);
    })() : d;

    if (isNaN(dateToCompare.getTime())) return false;
    
    const now = new Date();
    if (period === 'Bulan Ini') return dateToCompare.getMonth() === now.getMonth() && dateToCompare.getFullYear() === now.getFullYear();
    if (period === 'Tahun Ini') return dateToCompare.getFullYear() === now.getFullYear();
    return true;
  });

  const totalGrossIncome = filteredTransactions
    .reduce((acc, t) => acc + (t.total_penjualan ?? (t.jenis === 'Pemasukan' ? t.nominal : 0)), 0);
  
  const totalTransactionFees = filteredTransactions
    .reduce((acc, t) => acc + (t.total_biaya ?? 0), 0);

  const totalOtherExpense = filteredTransactions
    .filter(t => t.jenis === 'Pengeluaran')
    .reduce((acc, t) => acc + t.nominal, 0);

  const totalIncome = totalGrossIncome;
  const totalExpense = totalOtherExpense + totalTransactionFees;

  // Use stored laba directly as the definitive net profit
  const netProfit = filteredTransactions.reduce((acc, t) => acc + (t.laba ?? 0), 0);
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Category breakdown for Pie Chart
  const categoryData = filteredTransactions.reduce((acc: any[], t) => {
    const isPenjualan = t.kategori === 'Penjualan' && t.jenis === 'Pemasukan';
    const value = t.total_penjualan ?? t.nominal;
    const catName = t.kategori;

    const existing = acc.find(item => item.name === catName);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({ name: catName, value: value, jenis: t.jenis });
    }
    
    // Add transaction fees to expense if any (from source of truth)
    const fees = t.total_biaya ?? 0;
    if (fees > 0) {
      const feeCat = acc.find(item => item.name === 'Biaya Transaksi');
      if (feeCat) {
        feeCat.value += fees;
      } else {
        acc.push({ name: 'Biaya Transaksi', value: fees, jenis: 'Pengeluaran' });
      }
    }

    return acc;
  }, []);

  const expenseCategories = categoryData.filter(c => c.jenis === 'Pengeluaran');

  // Grouped expenses for the table
  const rawExpenseData = CATEGORIES_LIST
    .filter(c => c.type === 'Pengeluaran' || c.name === 'Lainnya')
    .map(cat => {
      const txs = filteredTransactions.filter(t => t.kategori === cat.name && t.jenis === 'Pengeluaran');
      const total = txs.reduce((acc, t) => acc + t.nominal, 0);
      return {
        name: cat.name,
        total,
        count: txs.length
      };
    })
    .filter(item => item.total > 0 || item.count > 0);

  // Add Biaya Transaksi to the table if present
  if (totalTransactionFees > 0) {
    rawExpenseData.push({
      name: 'Biaya Transaksi',
      total: totalTransactionFees,
      count: filteredTransactions.filter(t => t.total_biaya && t.total_biaya > 0).length
    });
  }

  const expenseTableData = rawExpenseData.sort((a, b) => b.total - a.total);

  const COLORS = ['#E53935', '#4ADE80', '#60A5FA', '#F472B6', '#A78BFA', '#FBBF24', '#94A3B8'];

  const exportCSV = () => {
    const headers = ['Tanggal', 'Keterangan', 'Kategori', 'Jenis', 'Nominal'];
    const rows = filteredTransactions.map(t => [t.tanggal, t.keterangan, t.kategori, t.jenis, t.nominal]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Laporan_Keuangan_${period.replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateHppPcs = (bahan: HppMaterial[], qtyBatch: number, packingCost: number = 0) => {
    if (qtyBatch === 0) return 0;
    return (bahan.reduce((acc, b) => acc + (b.qty * b.harga), 0) + packingCost) / qtyBatch;
  };

  const getQtyTerjual = (variantId: string) => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.penjualan_detail) {
        t.penjualan_detail.forEach(pd => {
          pd.varian.forEach(v => {
            if (v.varian_id === variantId) {
              acc += v.qty;
            }
          });
        });
      }
      return acc;
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Laporan Keuangan</h2>
          <p className="text-gray-500 font-medium">Analisis mendalam performa bisnis.</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] rounded-2xl border-none shadow-sm bg-white font-bold">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="Bulan Ini">Bulan Ini</SelectItem>
              <SelectItem value="Tahun Ini">Tahun Ini</SelectItem>
              <SelectItem value="Semua Waktu">Semua Waktu</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={exportCSV}
            variant="outline" 
            className="rounded-2xl border-none shadow-sm bg-white font-bold gap-2 text-gray-600 hover:text-primary"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-green-100 text-green-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <Badge className="bg-green-50 text-green-700 border-none font-black">Income</Badge>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Pemasukan</p>
          <h3 className="text-2xl font-black text-[#1A1A2E] mt-1">{formatCurrency(totalIncome, true)}</h3>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-red-100 text-red-500">
              <TrendingDown className="w-6 h-6" />
            </div>
            <Badge className="bg-red-50 text-red-600 border-none font-black">Expense</Badge>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Pengeluaran</p>
          <h3 className="text-2xl font-black text-[#1A1A2E] mt-1">{formatCurrency(totalExpense, true)}</h3>
        </Card>

        <Card className={cn(
          "border-none shadow-xl rounded-[2rem] p-6 text-white",
          netProfit >= 0 ? "wallet-gradient shadow-blue-100" : "bg-red-500 shadow-red-100"
        )}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-white/20 text-white">
              <FileText className="w-6 h-6" />
            </div>
            <Badge className="bg-white/20 text-white border-none font-black">Profit</Badge>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Laba Bersih ({period})</p>
          <h3 className="text-2xl font-black mt-1">{formatCurrency(netProfit, true)}</h3>
          <p className="text-[10px] font-bold mt-2">Margin Keuntungan: {margin.toFixed(1)}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-primary" />
                Alokasi Pengeluaran
              </CardTitle>
              <CardDescription>Distribusi biaya operasional</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Detail Pengeluaran
              </CardTitle>
              <CardDescription>Rekap biaya per kategori</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <div>Kategori</div>
                  <div className="text-center">Transaksi</div>
                  <div className="text-right">Total</div>
                </div>
                {expenseTableData.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-3 items-center p-4 bg-gray-50 rounded-2xl">
                    <div className="font-bold text-[#1A1A2E] text-sm">{item.name}</div>
                    <div className="text-center text-xs font-bold text-gray-500">{item.count}x</div>
                    <div className="text-right font-black text-red-500 text-sm">{formatCurrency(item.total, true)}</div>
                  </div>
                ))}
                {expenseTableData.length === 0 && (
                  <p className="text-center py-8 text-gray-400 font-bold">Belum ada pengeluaran</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Variant Performance Table Grouped by Product */}
        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarIcon className="w-5 h-5 text-blue-500" />
              Performa Varian
            </CardTitle>
            <CardDescription>Profitabilitas per produk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {products.map((p, pIdx) => (
              <div key={`${p.id}-${pIdx}`} className="space-y-3">
                <p className="text-xs font-black text-[#1A1A2E] flex items-center gap-2 px-1">
                  <Package className="w-3 h-3 text-primary" />
                  {p.nama.toUpperCase()}
                </p>
                <div className="space-y-2">
                  {p.varian.map((v, vIdx) => {
                    const hppPcs = calculateHppPcs(v.bahan, v.qty_batch, v.harga_packing);
                    const profit = v.harga_jual - hppPcs;
                    const margin = v.harga_jual > 0 ? (profit / v.harga_jual) * 100 : 0;
                    const qtyTerjual = getQtyTerjual(v.id);
                    const estPendapatan = qtyTerjual * v.harga_jual;
                    
                    return (
                      <div key={`${v.id}-${vIdx}`} className="p-4 bg-gray-50 rounded-2xl group hover:bg-brand-50 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-[#1A1A2E]">{v.nama}</span>
                          <Badge className="bg-blue-100 text-blue-600 border-none font-black text-[10px]">
                            {margin.toFixed(1)}% Margin
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold text-gray-400">
                          <div>HPP: <span className="text-gray-600">{formatCurrency(Math.round(hppPcs), true)}</span></div>
                          <div>Jual: <span className="text-gray-600">{formatCurrency(v.harga_jual, true)}</span></div>
                          <div>Terjual: <span className="text-primary">{qtyTerjual} pcs</span></div>
                          <div className="text-right">Est: <span className="text-green-600">{formatCurrency(estPendapatan, true)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
