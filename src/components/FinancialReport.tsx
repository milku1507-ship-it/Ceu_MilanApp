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

  // SOURCE OF TRUTH: Direct summation from transaction fields as requested
  // totalIncome: Sum of net income (gross - fees) from all Pemasukan transactions
  const totalIncome = filteredTransactions
    .filter(t => (t.jenis || t.type)?.toLowerCase() === 'pemasukan')
    .reduce((acc, t) => acc + (t.laba || 0), 0);

  // totalExpense: Sum of manual expenses ONLY (Not including HPP)
  const totalExpense = filteredTransactions
    .filter(t => (t.jenis || t.type)?.toLowerCase() === 'pengeluaran')
    .reduce((acc, t) => acc + (t.total_biaya || 0), 0);

  // netProfit: totalIncome (Net) - totalExpense (Manual)
  const netProfit = totalIncome - totalExpense;
  
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Category breakdown for Pie Chart
  const categoryData = filteredTransactions.reduce((acc: any[], t) => {
    // For income categories (Pemasukan) - We show Gross to see where money comes from
    const isPemasukan = (t.jenis || t.type)?.toLowerCase() === 'pemasukan';
    const isPengeluaran = (t.jenis || t.type)?.toLowerCase() === 'pengeluaran';

    if (isPemasukan && t.total_penjualan > 0) {
      const existing = acc.find(item => item.name === t.kategori);
      if (existing) {
        existing.value += t.total_penjualan;
      } else {
        acc.push({ name: t.kategori, value: t.total_penjualan, jenis: 'Pemasukan' });
      }
    }

    // For expense categories
    if (isPengeluaran && t.total_biaya > 0) {
      const existing = acc.find(item => item.name === t.kategori);
      if (existing) {
        existing.value += t.total_biaya;
      } else {
        acc.push({ name: t.kategori, value: t.total_biaya, jenis: 'Pengeluaran' });
      }
    }

    return acc;
  }, []);

  const expenseCategories = categoryData.filter(c => c.jenis === 'Pengeluaran');

  // Grouped expenses for the table
  const expenseTableData = filteredTransactions
    .filter(t => (t.jenis || t.type)?.toLowerCase() === 'pengeluaran' && t.total_biaya > 0)
    .reduce((acc: { name: string; total: number; count: number }[], t) => {
      const catName = t.kategori;
      const existing = acc.find(item => item.name === catName);
      if (existing) {
        existing.total += t.total_biaya;
        existing.count += 1;
      } else {
        acc.push({ name: catName, total: t.total_biaya, count: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.total - a.total);

  const COLORS = ['#E53935', '#4ADE80', '#60A5FA', '#F472B6', '#A78BFA', '#FBBF24', '#94A3B8'];

  const calculateHppPcs = (bahan: HppMaterial[], qtyBatch: number, packingCost: number = 0) => {
    // bahan.qty is total per BATCH
    const totalMaterials = bahan.reduce((acc, b) => acc + (Number(b.qty || 0) * (b.harga || 0)), 0);
    const qBatch = Math.max(1, Number(qtyBatch) || 1);
    return (totalMaterials + (Number(packingCost) || 0)) / qBatch;
  };

  // NEW: Grouped performance from transactions (NET)
  const productPerformance = React.useMemo(() => {
    const stats: Record<string, {
      productName: string;
      totalQty: number;
      totalGross: number;
      totalNet: number;
      totalHPP: number;
      variants: Record<string, {
        variantName: string;
        totalQty: number;
        totalGross: number;
        totalNet: number;
        totalHPP: number;
      }>
    }> = {};

    filteredTransactions
      .filter(t => (t.jenis || t.type)?.toLowerCase() === 'pemasukan' && t.kategori === 'Penjualan' && t.penjualan_detail)
      .forEach(t => {
        // 1. Calculate transaction gross value to apportion fees fairly
        let txGrossTotal = 0;
        t.penjualan_detail?.forEach(pd => {
          pd.varian.forEach(v => {
            let itemPrice = (v as any).harga; // Cast to any because of transition period
            if (itemPrice === undefined) {
              const product = products.find(p => p.id === pd.produk_id);
              const variant = product?.varian.find(varnt => varnt.id === v.varian_id);
              itemPrice = variant?.harga_jual || 0;
            }
            txGrossTotal += (Number(v.qty) * Number(itemPrice));
          });
        });

        // 2. Aggregate stats
        t.penjualan_detail?.forEach(pd => {
          if (!stats[pd.produk_id]) {
            stats[pd.produk_id] = { 
              productName: pd.produk_nama || 'Unknown', 
              totalQty: 0, totalGross: 0, totalNet: 0, totalHPP: 0,
              variants: {} 
            };
          }

          pd.varian.forEach(v => {
            if (!stats[pd.produk_id].variants[v.varian_id]) {
              stats[pd.produk_id].variants[v.varian_id] = {
                variantName: v.varian_nama || 'Unknown',
                totalQty: 0, totalGross: 0, totalNet: 0, totalHPP: 0
              };
            }

            // Fallbacks for legacy/current transaction data
            let itemPrice = (v as any).harga;
            let itemHpp = (v as any).hpp;
            
            if (itemPrice === undefined || itemHpp === undefined) {
              const product = products.find(p => p.id === pd.produk_id);
              const variant = product?.varian.find(varnt => varnt.id === v.varian_id);
              if (itemPrice === undefined) itemPrice = variant?.harga_jual || 0;
              if (itemHpp === undefined && variant) {
                itemHpp = calculateHppPcs(variant.bahan, variant.qty_batch, variant.harga_packing);
              }
            }

            const itemGross = Number(v.qty) * (Number(itemPrice) || 0);
            const feeShare = txGrossTotal > 0 ? (itemGross / txGrossTotal) * (t.total_biaya || 0) : 0;
            const itemNet = itemGross - feeShare;
            const itemTotalHPP = Number(v.qty) * (Number(itemHpp) || 0);

            // Update Variant Stats
            const vStats = stats[pd.produk_id].variants[v.varian_id];
            vStats.totalQty += v.qty;
            vStats.totalGross += itemGross;
            vStats.totalNet += itemNet;
            vStats.totalHPP += itemTotalHPP;

            // Update Product Stats
            const pStats = stats[pd.produk_id];
            pStats.totalQty += v.qty;
            pStats.totalGross += itemGross;
            pStats.totalNet += itemNet;
            pStats.totalHPP += itemTotalHPP;
          });
        });
      });

    return Object.values(stats);
  }, [filteredTransactions, products]);

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

  // DEPRECATED Helpers
  // const calculateHppPcs = ...
  // const getQtyTerjual = ...

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

        {/* Product Performance Section */}
        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarIcon className="w-5 h-5 text-blue-500" />
              Performa Produk
            </CardTitle>
            <CardDescription>Profitabilitas berdasarkan transaksi (NET)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {productPerformance.length === 0 && (
              <p className="text-center py-8 text-gray-400 font-bold">Belum ada data penjualan</p>
            )}
            
            {productPerformance.map((p, pIdx) => {
              const pProfit = p.totalNet - p.totalHPP;
              const pMargin = p.totalNet > 0 ? (pProfit / p.totalNet) * 100 : 0;

              return (
                <div key={`${pIdx}`} className="space-y-3">
                  <div className="bg-brand-50/50 rounded-3xl p-4 border border-brand-100/50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-[#1A1A2E] flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        {p.productName.toUpperCase()}
                      </p>
                      <Badge className={cn(
                        "border-none font-black text-[10px]",
                        pMargin >= 0 ? "bg-primary text-white" : "bg-red-500 text-white"
                      )}>
                        {pMargin.toFixed(1)}% Total Margin
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-bold">
                      <div>
                        <span className="text-gray-400 block mb-1">TOTAL TERJUAL</span>
                        <span className="text-primary text-sm font-black">{p.totalQty} pcs</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">NET PENDAPATAN</span>
                        <span className="text-[#1A1A2E] text-sm font-black">{formatCurrency(p.totalNet, true)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">TOTAL HPP</span>
                        <span className="text-gray-600 text-sm font-black">{formatCurrency(p.totalHPP, true)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block mb-1">TOTAL LABA</span>
                        <span className={cn("text-sm font-black", pProfit >= 0 ? "text-green-600" : "text-red-500")}>
                          {formatCurrency(pProfit, true)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pl-4 border-l-2 border-brand-100 ml-2">
                    {(Object.values(p.variants) as any[]).map((v, vIdx) => {
                      const vProfit = v.totalNet - v.totalHPP;
                      const vMargin = v.totalNet > 0 ? (vProfit / v.totalNet) * 100 : 0;
                      
                      return (
                        <div key={`${vIdx}`} className="p-4 bg-gray-50 rounded-2xl group hover:bg-brand-50 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-[#1A1A2E]">{v.variantName}</span>
                            <Badge className={cn(
                              "border-none font-black text-[10px]",
                              vMargin >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                            )}>
                              {vMargin.toFixed(1)}% Margin
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-[10px] font-bold text-gray-400">
                            <div>
                              NET Pendapatan:
                              <p className="text-[#1A1A2E] text-xs font-black">{formatCurrency(v.totalNet, true)}</p>
                            </div>
                            <div>
                              Total HPP:
                              <p className="text-gray-600 text-xs font-black">{formatCurrency(v.totalHPP, true)}</p>
                            </div>
                            <div>
                              Laba:
                              <p className={cn("text-xs font-black", vProfit >= 0 ? "text-green-600" : "text-red-500")}>
                                {formatCurrency(vProfit, true)}
                              </p>
                            </div>
                            <div>
                              Terjual:
                              <p className="text-primary text-xs font-black">{v.totalQty} pcs</p>
                            </div>
                            <div className="hidden lg:block text-right">
                              Est Harga Net:
                              <p className="text-gray-500 text-xs font-black">{formatCurrency(Math.round(v.totalNet / v.totalQty), false)}/pcs</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
