import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Minus, Search, Filter, Package, AlertTriangle, TrendingUp, MoreVertical, Wallet, Coins, AlertCircle, Layers, Trash2, Edit, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Ingredient, Transaction } from '../types';
import { User } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { auth, db, doc, setDoc, deleteDoc, OperationType, handleFirestoreError, sanitizeData } from '../lib/firebase';
import { useSettings } from '../SettingsContext';
import { formatSmartUnit } from '../lib/unitUtils';
import { formatCurrency } from '../lib/formatUtils';

interface StockManagerProps {
  user: User | null;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  transactions: Transaction[];
  onResetQty?: () => Promise<void> | void;
}

export default function StockManager({ user, ingredients, setIngredients, transactions, onResetQty }: StockManagerProps) {
  const { settings } = useSettings();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState('Semua');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [editingIngredient, setEditingIngredient] = React.useState<Ingredient | null>(null);
  const [deletingIngredientId, setDeletingIngredientId] = React.useState<string | null>(null);
  const [historyIngredient, setHistoryIngredient] = React.useState<Ingredient | null>(null);

  const categories = ['Semua', ...(settings?.kategori_hpp || [])];

  const filteredIngredients = ingredients.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'Semua' || i.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalStockValue = ingredients.reduce((acc, i) => acc + (i.currentStock * (i.price || 0)), 0);
  const lowStockCount = ingredients.filter(i => i.currentStock <= i.minStock).length;

  const updateStock = async (id: string, amount: number) => {
    const ingredient = ingredients.find(i => i.id === id);
    if (!ingredient) return;

    const newStock = ingredient.currentStock + amount;
    
    if (newStock <= ingredient.minStock && ingredient.currentStock > ingredient.minStock) {
      toast.warning(`Stok ${ingredient.name} menipis!`, {
        description: `Sisa stok: ${formatSmartUnit(newStock, ingredient.unit)}`,
        icon: <AlertCircle className="w-4 h-4 text-primary" />
      });
    }

    const updatedIngredient = { ...ingredient, currentStock: newStock };

    // Optimistic update
    setIngredients(prev => prev.map(i => i.id === id ? updatedIngredient : i));

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/stok/${id}`), sanitizeData(updatedIngredient));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stok/${id}`);
      }
    }
  };

  const handleEditIngredient = async () => {
    if (!editingIngredient) return;
    
    setIsSaving(true);
    if (user) {
      try {
        // Optimistic update
        setIngredients(prev => prev.map(i => i.id === editingIngredient.id ? editingIngredient : i));
        
        await setDoc(doc(db, `users/${user.uid}/stok/${editingIngredient.id}`), sanitizeData(editingIngredient));
        setIsEditDialogOpen(false);
        setEditingIngredient(null);
        toast.success(`Bahan ${editingIngredient.name} berhasil diperbarui ✓`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stok/${editingIngredient.id}`);
        // Rollback if needed (though onSnapshot will eventually fix it)
      } finally {
        setIsSaving(false);
      }
    } else {
      setIngredients(prev => prev.map(i => i.id === editingIngredient.id ? editingIngredient : i));
      setIsEditDialogOpen(false);
      setEditingIngredient(null);
      toast.success(`Bahan ${editingIngredient.name} berhasil diperbarui ✓`);
      setIsSaving(false);
    }
  };

  const handleDeleteIngredient = async () => {
    if (!deletingIngredientId) return;
    
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/stok/${deletingIngredientId}`));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/stok/${deletingIngredientId}`);
      }
    } else {
      setIngredients(prev => prev.filter(i => i.id !== deletingIngredientId));
    }

    setIsDeleteDialogOpen(false);
    setDeletingIngredientId(null);
    toast.success("Bahan berhasil dihapus");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Manajemen Stok</h2>
          <p className="text-gray-500 font-medium">Pantau ketersediaan bahan baku.</p>
        </div>
        <div className="flex gap-3">
          {onResetQty && (
            <Button 
              onClick={() => setIsResetDialogOpen(true)}
              variant="outline"
              className="border-brand-100 text-primary font-bold rounded-2xl gap-2 h-12 px-4 bg-white hover:bg-brand-50"
            >
              <Trash2 className="w-4 h-4" />
              Kosongkan Qty
            </Button>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Kosongkan Stok?</DialogTitle>
            <DialogDescription className="font-medium">
              Semua kuantitas stok akan diatur menjadi 0. Data nama bahan dan kategori tetap aman.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={isSaving} className="rounded-xl font-bold flex-1">
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setIsResetDialogOpen(false);
                if (onResetQty) onResetQty();
              }} 
              className="rounded-xl font-bold flex-1"
            >
              Ya, Kosongkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="p-3 rounded-2xl bg-blue-100 text-blue-600 shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase truncate">Nominal Stok</p>
            <p className="text-sm sm:text-xl font-black text-[#1A1A2E] truncate">Rp {totalStockValue.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="p-3 rounded-2xl bg-brand-100 text-primary shrink-0">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase truncate">Total Item</p>
            <p className="text-sm sm:text-xl font-black text-[#1A1A2E] truncate">{ingredients.length}</p>
          </div>
        </Card>
        <Card className={cn(
          "border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 min-w-0 transition-all",
          lowStockCount > 0 ? "bg-red-50 ring-1 ring-red-200" : ""
        )}>
          <div className={cn(
            "p-3 rounded-2xl shrink-0",
            lowStockCount > 0 ? "bg-red-500 text-white animate-pulse" : "bg-red-100 text-red-500"
          )}>
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase truncate">Stok Menipis</p>
            <p className={cn(
              "text-sm sm:text-xl font-black truncate",
              lowStockCount > 0 ? "text-red-600" : "text-red-500"
            )}>{lowStockCount}</p>
          </div>
        </Card>
        <Card className="border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="p-3 rounded-2xl bg-green-100 text-green-600 shrink-0">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase truncate">Kategori</p>
            <p className="text-sm sm:text-xl font-black text-green-600 truncate">{categories.length - 1}</p>
          </div>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Edit Bahan</DialogTitle>
            <DialogDescription className="font-medium">
              Perbarui informasi bahan baku.
            </DialogDescription>
          </DialogHeader>
          {editingIngredient && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-name" className="sm:text-right font-bold">Nama</Label>
                <Input
                  id="edit-name"
                  value={editingIngredient.name}
                  onChange={(e) => setEditingIngredient({...editingIngredient, name: e.target.value})}
                  className="sm:col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-category" className="sm:text-right font-bold">Kelompok</Label>
                <select
                  id="edit-category"
                  value={editingIngredient.category}
                  onChange={(e) => setEditingIngredient({...editingIngredient, category: e.target.value})}
                  className="sm:col-span-3 h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  {settings?.kategori_hpp.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {!settings?.kategori_hpp.includes(editingIngredient.category) && (
                    <option value={editingIngredient.category}>{editingIngredient.category}</option>
                  )}
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-unit" className="sm:text-right font-bold">Satuan</Label>
                <Input
                  id="edit-unit"
                  value={editingIngredient.unit}
                  onChange={(e) => setEditingIngredient({...editingIngredient, unit: e.target.value})}
                  className="sm:col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-price" className="sm:text-right font-bold">Harga/Satuan</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={editingIngredient.price}
                  onChange={(e) => setEditingIngredient({...editingIngredient, price: parseFloat(e.target.value) || 0})}
                  className="sm:col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-stock" className="sm:text-right font-bold">Stok Saat Ini</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  value={editingIngredient.currentStock}
                  onChange={(e) => setEditingIngredient({...editingIngredient, currentStock: parseFloat(e.target.value) || 0})}
                  className="sm:col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="edit-minStock" className="sm:text-right font-bold">Min. Stok</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  value={editingIngredient.minStock}
                  onChange={(e) => setEditingIngredient({...editingIngredient, minStock: parseFloat(e.target.value) || 0})}
                  className="sm:col-span-3 rounded-xl"
                />
              </div>

              {/* Riwayat Stok Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-black text-[#1A1A2E]">Riwayat Stok Masuk & Keluar</h3>
                </div>
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-2">
                    {transactions
                      .filter(tx => tx.stockSnapshot?.some(s => s.ingredientId === editingIngredient.id))
                      .slice(0, 20)
                      .map(tx => {
                        const snapshot = tx.stockSnapshot?.find(s => s.ingredientId === editingIngredient.id);
                        const isStockIn = snapshot && snapshot.delta > 0;
                        
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl",
                                isStockIn ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                              )}>
                                {isStockIn ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-xs font-black text-[#1A1A2E]">{tx.keterangan || tx.kategori}</p>
                                <p className="text-[10px] font-medium text-gray-400">{new Date(tx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-xs font-black",
                                isStockIn ? "text-green-600" : "text-red-600"
                              )}>
                                {isStockIn ? '+' : ''}{formatSmartUnit(snapshot?.delta || 0, editingIngredient.unit)}
                              </p>
                              <p className="text-[10px] font-medium text-gray-400">Sisa: {formatSmartUnit((snapshot?.stockBefore || 0) + (snapshot?.delta || 0), editingIngredient.unit)}</p>
                            </div>
                          </div>
                        );
                      })}
                    {transactions.filter(tx => tx.stockSnapshot?.some(s => s.ingredientId === editingIngredient.id)).length === 0 && (
                      <div className="text-center py-8">
                        <History className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400 font-medium">Belum ada riwayat stok.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleEditIngredient} disabled={isSaving} className="orange-gradient text-white font-bold rounded-2xl w-full h-12">
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Cari bahan baku..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-14 rounded-3xl border-none shadow-sm bg-white font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar scroll-smooth">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={filterCategory === cat ? 'default' : 'outline'}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "rounded-2xl font-bold h-14 px-6 transition-all shrink-0",
                filterCategory === cat ? "orange-gradient text-white border-none" : "bg-white border-none shadow-sm text-gray-500"
              )}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIngredients.map((item) => (
          <StockCard 
            key={item.id} 
            item={item} 
            onUpdate={(amt) => updateStock(item.id, amt)}
            onEdit={() => {
              setEditingIngredient(item);
              setIsEditDialogOpen(true);
            }}
            onDelete={() => {
              setDeletingIngredientId(item.id);
              setIsDeleteDialogOpen(true);
            }}
            onViewHistory={() => {
              setHistoryIngredient(item);
              setIsHistoryDialogOpen(true);
            }}
          />
        ))}
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Riwayat Stok: {historyIngredient?.name}
            </DialogTitle>
            <DialogDescription className="font-medium">
              Detail masuk dan keluar stok berdasarkan transaksi.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-6 pb-6">
              <div className="space-y-3 mt-4">
                {transactions
                  .filter(t => t.stockSnapshot?.some(s => s.ingredientId === historyIngredient?.id))
                  .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
                  .map(t => {
                    const snapshot = t.stockSnapshot?.find(s => s.ingredientId === historyIngredient?.id);
                    if (!snapshot) return null;
                    const isOut = snapshot.delta < 0;
                    
                    return (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            isOut ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                          )}>
                            {isOut ? <ArrowUpRight className="w-5 h-5 rotate-90" /> : <ArrowDownLeft className="w-5 h-5 rotate-90" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#1A1A2E]">{t.keterangan}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-black",
                            isOut ? "text-red-600" : "text-green-600"
                          )}>
                            {isOut ? '' : '+'}{formatSmartUnit(snapshot.delta, historyIngredient?.unit || '')}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Stok Akhir: {formatSmartUnit(snapshot.stockBefore + snapshot.delta, historyIngredient?.unit || '')}</p>
                        </div>
                      </div>
                    );
                  })}
                {transactions.filter(t => t.stockSnapshot?.some(s => s.ingredientId === historyIngredient?.id)).length === 0 && (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-400">Belum ada riwayat transaksi untuk bahan ini.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Hapus Bahan?</DialogTitle>
            <DialogDescription className="font-medium">
              Tindakan ini tidak dapat dibatalkan. Data stok untuk bahan ini akan dihapus secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl font-bold flex-1">
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteIngredient} className="rounded-xl font-bold flex-1">
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StockCard: React.FC<{ 
  item: Ingredient, 
  onUpdate: (amt: number) => void,
  onEdit: () => void,
  onDelete: () => void,
  onViewHistory: () => void
}> = ({ item, onUpdate, onEdit, onDelete, onViewHistory }) => {
  const isLow = item.currentStock <= item.minStock;
  const isOut = item.currentStock <= 0;
  
  const progressValue = Math.min(100, (item.currentStock / (item.minStock * 3 || 1)) * 100);

  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-gray-50 border-none text-[10px] font-bold text-gray-400 uppercase">
                {item.category}
              </Badge>
              {item.fromHpp && (
                <Badge className="bg-blue-50 text-blue-600 border-none text-[10px] font-bold">
                  📊 HPP
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-black text-[#1A1A2E] group-hover:text-primary transition-colors">{item.name}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn(
              "font-black text-[10px] border-none",
              isOut ? "bg-red-100 text-red-600" : isLow ? "bg-brand-100 text-primary" : "bg-green-100 text-green-600"
            )}>
              {isOut ? "HABIS" : isLow ? "BELI" : "AMAN"}
            </Badge>
            <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-primary hover:bg-brand-50" onClick={onViewHistory}>
                <History className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={onEdit}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Stok Saat Ini</p>
              <p className="text-2xl font-black text-[#1A1A2E]">
                {formatSmartUnit(item.currentStock, item.unit)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Nilai Stok</p>
              <p className="text-sm font-black text-primary">{formatCurrency(item.currentStock * (item.price || 0), true)}</p>
            </div>
          </div>

          <Progress 
            value={progressValue} 
            className="h-2 bg-gray-100"
            indicatorClassName={cn(
              isOut ? "bg-red-500" : isLow ? "bg-primary" : "bg-green-500"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
