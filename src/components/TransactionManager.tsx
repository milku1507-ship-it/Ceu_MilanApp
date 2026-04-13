import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Calendar, ShoppingBag, CreditCard, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Transaction, Product, PenjualanDetail, Variant, Ingredient } from '../types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { auth, db, doc, setDoc, deleteDoc, writeBatch, OperationType, handleFirestoreError } from '../lib/firebase';
import { User } from 'firebase/auth';

interface TransactionManagerProps {
  user: User | null;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: Product[];
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
}

const CATEGORIES = [
  { name: 'Penjualan', type: 'Pemasukan', fixed: true },
  { name: 'Bahan Baku', type: 'Pengeluaran', fixed: true },
  { name: 'Packing', type: 'Pengeluaran', fixed: true },
  { name: 'Gaji', type: 'Pengeluaran', fixed: true },
  { name: 'Operasional', type: 'Pengeluaran', fixed: true },
  { name: 'Tabungan', type: 'Pengeluaran', fixed: true },
  { name: 'Biaya Iklan', type: 'Pengeluaran', fixed: true },
  { name: 'Saldo sisa', type: 'Pemasukan', fixed: true },
  { name: 'Lainnya', type: 'Pengeluaran', fixed: false },
];

export default function TransactionManager({ user, transactions, setTransactions, products, ingredients, setIngredients }: TransactionManagerProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('Semua');
  
  const [txToDelete, setTxToDelete] = React.useState<Transaction | null>(null);
  const [bulkToDelete, setBulkToDelete] = React.useState<string[] | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);
  
  const [newTx, setNewTx] = React.useState<Partial<Transaction>>({
    tanggal: new Date().toISOString().split('T')[0],
    jenis: 'Pemasukan',
    kategori: 'Penjualan',
    nominal: 0,
    keterangan: '',
    qty_total: 0,
    qty_beli: 0,
    penjualan_detail: []
  });

  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>('');

  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);

  const [selectedTxIds, setSelectedTxIds] = React.useState<string[]>([]);

  const filteredTransactions = transactions
    .filter(t => {
      const matchesSearch = t.keterangan.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'Semua' || t.jenis === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const totalIncome = transactions
    .filter(t => t.jenis === 'Pemasukan')
    .reduce((acc, t) => acc + t.nominal, 0);
  
  const totalExpense = transactions
    .filter(t => t.jenis === 'Pengeluaran')
    .reduce((acc, t) => acc + t.nominal, 0);

  const balance = totalIncome - totalExpense;

  // Handle category change and auto-type
  const handleCategoryChange = (catName: string) => {
    const cat = CATEGORIES.find(c => c.name === catName);
    if (cat) {
      setNewTx(prev => ({
        ...prev,
        kategori: catName,
        jenis: cat.type as 'Pemasukan' | 'Pengeluaran',
        // Reset fields when category changes
        qty_beli: 0,
        nominal: catName === 'Penjualan' ? prev.nominal : 0,
        penjualan_detail: catName === 'Penjualan' ? prev.penjualan_detail : []
      }));
      setSelectedMaterialId('');
    }
  };

  // Auto-nominal for Bahan Baku and Packing
  React.useEffect(() => {
    if ((newTx.kategori === 'Bahan Baku' || newTx.kategori === 'Packing') && selectedMaterialId) {
      const material = ingredients.find(i => i.id === selectedMaterialId);
      if (material) {
        setNewTx(prev => ({
          ...prev,
          nominal: (prev.qty_beli || 0) * material.price,
          keterangan: `${prev.kategori}: ${material.name} (${prev.qty_beli} ${material.unit})`
        }));
      }
    }
  }, [selectedMaterialId, newTx.qty_beli, newTx.kategori, ingredients]);

  // Calculate total qty and estimated revenue from penjualan_detail
  React.useEffect(() => {
    if (newTx.kategori === 'Penjualan' && newTx.penjualan_detail) {
      let totalQty = 0;
      let totalNominal = 0;
      newTx.penjualan_detail.forEach(pd => {
        pd.varian.forEach(v => {
          totalQty += v.qty;
          const product = products.find(p => p.id === pd.produk_id);
          const variant = product?.varian.find(varItem => varItem.id === v.varian_id);
          if (variant) {
            totalNominal += v.qty * variant.harga_jual;
          }
        });
      });
      setNewTx(prev => ({ ...prev, qty_total: totalQty, nominal: totalNominal }));
    }
  }, [newTx.penjualan_detail, newTx.kategori, products]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        const next = prev.filter(id => id !== productId);
        setNewTx(tx => ({
          ...tx,
          penjualan_detail: tx.penjualan_detail?.filter(pd => pd.produk_id !== productId)
        }));
        return next;
      } else {
        const product = products.find(p => p.id === productId);
        if (product) {
          const newDetail: PenjualanDetail = {
            produk_id: product.id,
            produk_nama: product.nama,
            varian: product.varian.map(v => ({ varian_id: v.id, varian_nama: v.nama, qty: 0 }))
          };
          setNewTx(tx => ({
            ...tx,
            penjualan_detail: [...(tx.penjualan_detail || []), newDetail]
          }));
        }
        return [...prev, productId];
      }
    });
  };

  const handleVariantQtyChange = (productId: string, variantId: string, qty: number) => {
    setNewTx(prev => ({
      ...prev,
      penjualan_detail: prev.penjualan_detail?.map(pd => {
        if (pd.produk_id === productId) {
          return {
            ...pd,
            varian: pd.varian.map(v => v.varian_id === variantId ? { ...v, qty } : v)
          };
        }
        return pd;
      })
    }));
  };

  const handleAddTransaction = async () => {
    if (!newTx.keterangan || !newTx.nominal) {
      toast.error('Mohon isi keterangan dan nominal!');
      return;
    }

    // Identify affected ingredients and calculate snapshot
    const snapshot: { ingredientId: string; stockBefore: number; delta: number }[] = [];
    const stockUpdates: { id: string; delta: number }[] = [];

    if (newTx.kategori === 'Bahan Baku' || newTx.kategori === 'Packing') {
      if (selectedMaterialId) {
        const material = ingredients.find(i => i.id === selectedMaterialId);
        if (material) {
          const delta = newTx.qty_beli || 0;
          snapshot.push({ ingredientId: material.id, stockBefore: material.currentStock, delta });
          stockUpdates.push({ id: material.id, delta });
        }
      }
    } else if (newTx.kategori === 'Penjualan' && newTx.penjualan_detail) {
      newTx.penjualan_detail.forEach(pd => {
        const product = products.find(p => p.id === pd.produk_id);
        if (product) {
          pd.varian.forEach(pv => {
            if (pv.qty > 0) {
              const variant = product.varian.find(v => v.id === pv.varian_id);
              if (variant) {
                variant.bahan.forEach(bahan => {
                  const ingredient = ingredients.find(i => i.name.toLowerCase() === bahan.nama.toLowerCase());
                  if (ingredient) {
                    const totalUsage = bahan.qty * pv.qty;
                    const delta = -totalUsage;
                    
                    const existingSnapshot = snapshot.find(s => s.ingredientId === ingredient.id);
                    if (existingSnapshot) {
                      existingSnapshot.delta += delta;
                    } else {
                      snapshot.push({ ingredientId: ingredient.id, stockBefore: ingredient.currentStock, delta });
                    }
                    
                    const existingUpdate = stockUpdates.find(u => u.id === ingredient.id);
                    if (existingUpdate) {
                      existingUpdate.delta += delta;
                    } else {
                      stockUpdates.push({ id: ingredient.id, delta });
                    }
                  }
                });
              }
            }
          });
        }
      });
    }

    const txId = Math.random().toString(36).substr(2, 9);
    const tx: Transaction = {
      id: txId,
      tanggal: newTx.tanggal!,
      keterangan: newTx.keterangan!,
      kategori: newTx.kategori!,
      jenis: newTx.jenis as 'Pemasukan' | 'Pengeluaran',
      nominal: Number(newTx.nominal),
      qty_total: newTx.qty_total || 0,
      qty_beli: newTx.qty_beli || 0,
      penjualan_detail: newTx.kategori === 'Penjualan' ? newTx.penjualan_detail : undefined,
      stockSnapshot: snapshot.length > 0 ? snapshot : undefined
    };

    if (user) {
      try {
        const batch = writeBatch(db);
        
        // Add transaction
        batch.set(doc(db, `users/${user.uid}/transaksi/${txId}`), tx);
        
        // Update ingredients
        stockUpdates.forEach(update => {
          const ing = ingredients.find(i => i.id === update.id);
          if (ing) {
            batch.set(doc(db, `users/${user.uid}/stok/${ing.id}`), {
              ...ing,
              currentStock: ing.currentStock + update.delta
            });
          }
        });

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/transaksi/${txId}`);
      }
    } else {
      // Update ingredients state locally
      if (stockUpdates.length > 0) {
        setIngredients(prev => prev.map(ing => {
          const update = stockUpdates.find(u => u.id === ing.id);
          if (update) {
            return { ...ing, currentStock: ing.currentStock + update.delta };
          }
          return ing;
        }));
      }
      setTransactions(prev => [tx, ...prev]);
    }

    toast.success('Transaksi berhasil dicatat!');
    setNewTx({
      tanggal: new Date().toISOString().split('T')[0],
      jenis: 'Pemasukan',
      kategori: 'Penjualan',
      nominal: 0,
      keterangan: '',
      qty_total: 0,
      qty_beli: 0,
      penjualan_detail: []
    });
    setSelectedProductIds([]);
  };

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx && tx.stockSnapshot && tx.stockSnapshot.length > 0) {
      setTxToDelete(tx);
      setIsDeleteConfirmOpen(true);
    } else {
      if (user) {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/transaksi/${id}`));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/${id}`);
        }
      } else {
        setTransactions(prev => prev.filter(t => t.id !== id));
      }
      setSelectedTxIds(prev => prev.filter(selectedId => selectedId !== id));
      toast.success('Transaksi dihapus');
    }
  };

  const confirmDelete = async (rollback: boolean) => {
    if (!txToDelete) return;

    if (user) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/transaksi/${txToDelete.id}`));
        
        if (rollback && txToDelete.stockSnapshot) {
          txToDelete.stockSnapshot.forEach(snapshot => {
            const ing = ingredients.find(i => i.id === snapshot.ingredientId);
            if (ing) {
              batch.set(doc(db, `users/${user.uid}/stok/${ing.id}`), {
                ...ing,
                currentStock: ing.currentStock - snapshot.delta
              });
            }
          });
        }
        
        await batch.commit();
        toast.success(rollback ? 'Transaksi dihapus dan stok berhasil dikembalikan' : 'Transaksi dihapus, stok tidak berubah');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/${txToDelete.id}`);
      }
    } else {
      if (rollback && txToDelete.stockSnapshot) {
        setIngredients(prev => prev.map(ing => {
          const snapshot = txToDelete.stockSnapshot?.find(s => s.ingredientId === ing.id);
          if (snapshot) {
            return { ...ing, currentStock: ing.currentStock - snapshot.delta };
          }
          return ing;
        }));
        toast.success('Transaksi dihapus dan stok berhasil dikembalikan');
      } else {
        toast.success('Transaksi dihapus, stok tidak berubah');
      }
      setTransactions(prev => prev.filter(t => t.id !== txToDelete.id));
    }

    setSelectedTxIds(prev => prev.filter(id => id !== txToDelete.id));
    setIsDeleteConfirmOpen(false);
    setTxToDelete(null);
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.length === filteredTransactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTxIds.length === 0) return;
    
    const selectedTxs = transactions.filter(t => selectedTxIds.includes(t.id));
    const hasSnapshot = selectedTxs.some(t => t.stockSnapshot && t.stockSnapshot.length > 0);

    if (hasSnapshot) {
      setBulkToDelete(selectedTxIds);
      setIsBulkDeleteConfirmOpen(true);
    } else {
      if (user) {
        const batch = writeBatch(db);
        selectedTxIds.forEach(id => {
          batch.delete(doc(db, `users/${user.uid}/transaksi/${id}`));
        });
        batch.commit().then(() => {
          setSelectedTxIds([]);
          toast.success(`${selectedTxIds.length} transaksi berhasil dihapus`);
        }).catch(error => {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/bulk`);
        });
      } else {
        setTransactions(prev => prev.filter(t => !selectedTxIds.includes(t.id)));
        setSelectedTxIds([]);
        toast.success(`${selectedTxIds.length} transaksi berhasil dihapus`);
      }
    }
  };

  const confirmBulkDelete = async (rollback: boolean) => {
    if (!bulkToDelete) return;

    if (user) {
      try {
        const batch = writeBatch(db);
        bulkToDelete.forEach(id => {
          batch.delete(doc(db, `users/${user.uid}/transaksi/${id}`));
        });

        if (rollback) {
          const selectedTxs = transactions
            .filter(t => bulkToDelete.includes(t.id));

          ingredients.forEach(ing => {
            const totalDelta = selectedTxs.reduce((acc, t) => {
              const snapshot = t.stockSnapshot?.find(s => s.ingredientId === ing.id);
              return acc + (snapshot?.delta || 0);
            }, 0);

            if (totalDelta !== 0) {
              batch.set(doc(db, `users/${user.uid}/stok/${ing.id}`), {
                ...ing,
                currentStock: ing.currentStock - totalDelta
              });
            }
          });
        }

        await batch.commit();
        toast.success(rollback ? `${bulkToDelete.length} transaksi dihapus dan stok berhasil dikembalikan` : `${bulkToDelete.length} transaksi dihapus, stok tidak berubah`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/bulk`);
      }
    } else {
      if (rollback) {
        const selectedTxs = transactions
          .filter(t => bulkToDelete.includes(t.id));

        setIngredients(prev => prev.map(ing => {
          const totalDelta = selectedTxs.reduce((acc, t) => {
            const snapshot = t.stockSnapshot?.find(s => s.ingredientId === ing.id);
            return acc + (snapshot?.delta || 0);
          }, 0);

          if (totalDelta !== 0) {
            return { ...ing, currentStock: ing.currentStock - totalDelta };
          }
          return ing;
        }));
        toast.success(`${bulkToDelete.length} transaksi dihapus dan stok berhasil dikembalikan`);
      } else {
        toast.success(`${bulkToDelete.length} transaksi dihapus, stok tidak berubah`);
      }
      setTransactions(prev => prev.filter(t => !bulkToDelete.includes(t.id)));
    }

    setSelectedTxIds([]);
    setIsBulkDeleteConfirmOpen(false);
    setBulkToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Transaksi</h2>
          <p className="text-gray-500 font-medium">Catat pemasukan & pengeluaran.</p>
        </div>
      </div>

      {/* Wallet Balance Summary */}
      <div className="wallet-gradient rounded-[2.5rem] p-6 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Saldo</p>
            <h3 className="text-3xl font-black">Rp {balance.toLocaleString()}</h3>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
            <p className="text-[9px] font-bold uppercase opacity-70 mb-1">Pemasukan</p>
            <p className="text-lg font-black text-green-300">Rp {totalIncome.toLocaleString()}</p>
          </div>
          <div className="flex-1 md:flex-none px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
            <p className="text-[9px] font-bold uppercase opacity-70 mb-1">Pengeluaran</p>
            <p className="text-lg font-black text-red-300">Rp {totalExpense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Form */}
        <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Catat Transaksi</CardTitle>
            <CardDescription>Input data keuangan baru</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase">Tanggal</Label>
              <Input 
                type="date" 
                value={newTx.tanggal}
                onChange={(e) => setNewTx({...newTx, tanggal: e.target.value})}
                className="rounded-xl border-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Kategori</Label>
                <Select 
                  value={newTx.kategori} 
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="rounded-xl border-gray-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Jenis</Label>
                <Select 
                  value={newTx.jenis} 
                  onValueChange={(val: any) => setNewTx({...newTx, jenis: val})}
                  disabled={CATEGORIES.find(c => c.name === newTx.kategori)?.fixed}
                >
                  <SelectTrigger className="rounded-xl border-gray-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="Pengeluaran">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newTx.kategori === 'Penjualan' && (
              <div className="space-y-4 pt-2 border-t border-dashed border-gray-100">
                <Label className="text-xs font-bold text-gray-400 uppercase">Langkah 1: Pilih Produk</Label>
                <div className="flex flex-wrap gap-2">
                  {products.map(p => (
                    <Button
                      key={p.id}
                      variant={selectedProductIds.includes(p.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleProduct(p.id)}
                      className={cn(
                        "rounded-xl font-bold transition-all",
                        selectedProductIds.includes(p.id) ? "bg-[#FF6B35] text-white border-none" : "border-gray-100 text-gray-500"
                      )}
                    >
                      {p.nama}
                    </Button>
                  ))}
                </div>

                {selectedProductIds.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <Label className="text-xs font-bold text-gray-400 uppercase">Langkah 2: Isi Qty per Varian</Label>
                    {selectedProductIds.map(pid => {
                      const product = products.find(p => p.id === pid);
                      const detail = newTx.penjualan_detail?.find(pd => pd.produk_id === pid);
                      if (!product) return null;
                      return (
                        <div key={pid} className="space-y-2 p-3 bg-gray-50 rounded-2xl">
                          <p className="text-xs font-black text-[#1A1A2E] flex items-center gap-2">
                            <Package className="w-3 h-3 text-[#FF6B35]" />
                            {product.nama}
                          </p>
                          <div className="space-y-2">
                            {product.varian.map(v => (
                              <div key={v.id} className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-gray-500">{v.nama}</span>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={detail?.varian.find(vv => vv.varian_id === v.id)?.qty || ''}
                                    onChange={(e) => handleVariantQtyChange(pid, v.id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8 rounded-lg border-gray-200 text-right font-bold text-xs"
                                  />
                                  <span className="text-[10px] font-bold text-gray-400">pcs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {(newTx.kategori === 'Bahan Baku' || newTx.kategori === 'Packing') && (
              <div className="space-y-4 pt-2 border-t border-dashed border-gray-100">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Pilih Bahan</Label>
                  <Select 
                    value={selectedMaterialId} 
                    onValueChange={setSelectedMaterialId}
                  >
                    <SelectTrigger className="rounded-xl border-gray-100 font-bold">
                      <SelectValue placeholder="Pilih bahan..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ingredients
                        .filter(i => {
                          if (newTx.kategori === 'Packing') return i.category === 'Packing';
                          if (newTx.kategori === 'Bahan Baku') return i.category === 'Kulit Cireng' || i.category === 'Bahan Isian';
                          return true;
                        })
                        .map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Jumlah Beli</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={newTx.qty_beli || ''}
                      onChange={(e) => setNewTx({...newTx, qty_beli: Number(e.target.value)})}
                      className="rounded-xl border-gray-100"
                    />
                    <span className="text-xs font-bold text-gray-400">
                      {ingredients.find(i => i.id === selectedMaterialId)?.unit || ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {newTx.kategori === 'Saldo sisa' && (
              <div className="space-y-2 pt-2 border-t border-dashed border-gray-100">
                <Label className="text-xs font-bold text-gray-400 uppercase">Qty (Opsional)</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={newTx.qty_beli || ''}
                  onChange={(e) => setNewTx({...newTx, qty_beli: Number(e.target.value)})}
                  className="rounded-xl border-gray-100"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase">Keterangan</Label>
              <Input 
                placeholder="Contoh: Penjualan 50 pcs" 
                value={newTx.keterangan}
                onChange={(e) => setNewTx({...newTx, keterangan: e.target.value})}
                className="rounded-xl border-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase">Nominal (Rp)</Label>
              <Input 
                type="number" 
                placeholder="0" 
                value={newTx.nominal || ''}
                onChange={(e) => setNewTx({...newTx, nominal: Number(e.target.value)})}
                className="rounded-xl border-gray-100 font-black text-lg"
                readOnly={newTx.kategori === 'Penjualan'}
              />
              {newTx.kategori === 'Penjualan' && <p className="text-[10px] text-gray-400 italic">*Nominal terhitung otomatis dari qty varian</p>}
            </div>

            <Button 
              onClick={handleAddTransaction}
              className="w-full orange-gradient text-white font-bold h-14 rounded-2xl shadow-lg shadow-orange-100 mt-4 active:scale-95 transition-transform"
            >
              Simpan Transaksi
            </Button>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-gray-200 text-[#FF6B35] focus:ring-[#FF6B35]"
                checked={filteredTransactions.length > 0 && selectedTxIds.length === filteredTransactions.length}
                onChange={toggleSelectAll}
              />
              <div>
                <CardTitle className="text-lg font-bold">Riwayat Transaksi</CardTitle>
                <CardDescription>Daftar aktivitas keuangan</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedTxIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  className="rounded-xl font-bold gap-2 animate-in fade-in slide-in-from-right-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selectedTxIds.length})
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-xl border-gray-100">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Cari transaksi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-gray-100"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredTransactions.map((t) => (
                <div 
                  key={t.id} 
                  className={cn(
                    "group flex flex-col p-4 rounded-2xl transition-all border-2",
                    selectedTxIds.includes(t.id) 
                      ? "bg-orange-50 border-orange-200 shadow-sm" 
                      : "bg-gray-50 border-transparent hover:bg-orange-50/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-gray-200 text-[#FF6B35] focus:ring-[#FF6B35]"
                        checked={selectedTxIds.includes(t.id)}
                        onChange={() => toggleSelectTx(t.id)}
                      />
                      <div className={cn(
                        "p-3 rounded-xl",
                        t.jenis === 'Pemasukan' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                      )}>
                        {t.jenis === 'Pemasukan' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A2E]">{t.keterangan}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] font-bold border-none bg-white text-gray-400 uppercase">
                            {t.kategori}
                          </Badge>
                          <span className="text-[10px] text-gray-400 font-bold">{t.tanggal}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "font-black text-lg",
                          t.jenis === 'Pemasukan' ? "text-green-600" : "text-red-500"
                        )}>
                          {t.jenis === 'Pemasukan' ? '+' : '-'} Rp {t.nominal.toLocaleString()}
                        </p>
                        {t.qty_total > 0 && <p className="text-[10px] font-bold text-gray-400">{t.qty_total} pcs terjual</p>}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteTransaction(t.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {t.penjualan_detail && t.penjualan_detail.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {t.penjualan_detail.map((pd, pdIdx) => (
                        <div key={`${pd.produk_id}-${pdIdx}`} className="text-[10px] text-gray-500">
                          <span className="font-bold text-[#FF6B35]">{pd.produk_nama}: </span>
                          {pd.varian.filter(v => v.qty > 0).map(v => `${v.varian_nama} (${v.qty})`).join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold">Tidak ada transaksi ditemukan</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Konfirmasi Penghapusan</DialogTitle>
            <DialogDescription className="font-medium">
              Apakah stok bahan baku ingin dikembalikan ke kondisi sebelum transaksi ini terjadi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => confirmDelete(false)}
              className="rounded-2xl font-bold h-12 flex-1"
            >
              Tidak, Biarkan Stok
            </Button>
            <Button 
              onClick={() => confirmDelete(true)}
              className="orange-gradient text-white font-bold rounded-2xl h-12 flex-1"
            >
              Ya, Kembalikan Stok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Hapus Massal ({bulkToDelete?.length})</DialogTitle>
            <DialogDescription className="font-medium">
              Apakah stok bahan baku ingin dikembalikan ke kondisi sebelum transaksi-transaksi ini terjadi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => confirmBulkDelete(false)}
              className="rounded-2xl font-bold h-12 flex-1"
            >
              Tidak, Biarkan Stok
            </Button>
            <Button 
              onClick={() => confirmBulkDelete(true)}
              className="orange-gradient text-white font-bold rounded-2xl h-12 flex-1"
            >
              Ya, Kembalikan Stok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
