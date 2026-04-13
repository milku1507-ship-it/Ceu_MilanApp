import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Minus, Search, Filter, Package, AlertTriangle, TrendingUp, MoreVertical, Wallet, Coins, AlertCircle, Layers, Trash2, Edit } from 'lucide-react';
import { Ingredient } from '../types';
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

import { auth, db, doc, setDoc, deleteDoc, OperationType, handleFirestoreError } from '../lib/firebase';

interface StockManagerProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  onSync?: () => void;
}

export default function StockManager({ ingredients, setIngredients, onSync }: StockManagerProps) {
  const user = auth.currentUser;
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState('Semua');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [editingIngredient, setEditingIngredient] = React.useState<Ingredient | null>(null);
  const [deletingIngredientId, setDeletingIngredientId] = React.useState<string | null>(null);
  const [newIngredient, setNewIngredient] = React.useState<Partial<Ingredient>>({
    name: '',
    category: 'Bahan Baku',
    unit: 'gram',
    price: 0,
    currentStock: 0,
    minStock: 0
  });

  const categories = ['Semua', ...new Set(ingredients.map(i => i.category))];

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

    const newStock = Math.max(0, ingredient.currentStock + amount);
    
    if (newStock <= ingredient.minStock && ingredient.currentStock > ingredient.minStock) {
      toast.warning(`Stok ${ingredient.name} menipis!`, {
        description: `Sisa stok: ${newStock} ${ingredient.unit}`,
        icon: <AlertCircle className="w-4 h-4 text-orange-500" />
      });
    }

    const updatedIngredient = { ...ingredient, currentStock: newStock };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/stok/${id}`), updatedIngredient);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stok/${id}`);
      }
    } else {
      setIngredients(prev => prev.map(i => i.id === id ? updatedIngredient : i));
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.name || !newIngredient.unit) {
      toast.error("Nama dan Satuan wajib diisi");
      return;
    }

    const id = 'ing_' + Math.random().toString(36).substr(2, 9);
    const ingredient: Ingredient = {
      id,
      name: newIngredient.name || '',
      category: newIngredient.category || 'Lainnya',
      unit: newIngredient.unit || '',
      price: Number(newIngredient.price) || 0,
      initialStock: Number(newIngredient.currentStock) || 0,
      currentStock: Number(newIngredient.currentStock) || 0,
      minStock: Number(newIngredient.minStock) || 0,
    };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/stok/${id}`), ingredient);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/stok/${id}`);
      }
    } else {
      setIngredients(prev => [...prev, ingredient]);
    }

    setIsAddDialogOpen(false);
    setNewIngredient({
      name: '',
      category: 'Bahan Baku',
      unit: 'gram',
      price: 0,
      currentStock: 0,
      minStock: 0
    });
    toast.success(`Bahan ${ingredient.name} berhasil ditambahkan`);
  };

  const handleEditIngredient = async () => {
    if (!editingIngredient) return;
    
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/stok/${editingIngredient.id}`), editingIngredient);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stok/${editingIngredient.id}`);
      }
    } else {
      setIngredients(prev => prev.map(i => i.id === editingIngredient.id ? editingIngredient : i));
    }

    setIsEditDialogOpen(false);
    setEditingIngredient(null);
    toast.success(`Bahan ${editingIngredient.name} berhasil diperbarui`);
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
          {onSync && (
            <Button 
              onClick={() => {
                if(confirm('Hapus semua bahan Stok yang tidak ada di HPP?')) {
                  onSync();
                }
              }}
              variant="outline"
              className="border-orange-100 text-[#FF6B35] font-bold rounded-2xl gap-2 h-12 px-4 bg-white hover:bg-orange-50"
            >
              <Trash2 className="w-4 h-4" />
              Bersihkan Stok
            </Button>
          )}
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={
              <Button className="orange-gradient text-white font-bold rounded-2xl shadow-lg shadow-orange-100 gap-2 h-12 px-6">
                <Plus className="w-4 h-4" />
                Tambah
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Tambah Bahan Baru</DialogTitle>
                <DialogDescription className="font-medium">
                  Masukkan detail bahan baku baru untuk dipantau stoknya.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right font-bold">Nama</Label>
                  <Input
                    id="name"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({...newIngredient, name: e.target.value})}
                    className="col-span-3 rounded-xl"
                    placeholder="Contoh: Tepung Tapioka"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right font-bold">Kelompok</Label>
                  <select
                    id="category"
                    value={newIngredient.category}
                    onChange={(e) => setNewIngredient({...newIngredient, category: e.target.value})}
                    className="col-span-3 h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] font-medium"
                  >
                    <option value="Kulit Cireng">Kulit Cireng</option>
                    <option value="Bahan Isian">Bahan Isian</option>
                    <option value="Packing">Packing</option>
                    <option value="Overhead">Overhead</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="unit" className="text-right font-bold">Satuan</Label>
                  <Input
                    id="unit"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({...newIngredient, unit: e.target.value})}
                    className="col-span-3 rounded-xl"
                    placeholder="gram, pcs, unit, dll."
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right font-bold">Harga/Satuan</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newIngredient.price}
                    onChange={(e) => setNewIngredient({...newIngredient, price: parseFloat(e.target.value) || 0})}
                    className="col-span-3 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stock" className="text-right font-bold">Stok Awal</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={newIngredient.currentStock}
                    onChange={(e) => setNewIngredient({...newIngredient, currentStock: parseFloat(e.target.value) || 0})}
                    className="col-span-3 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="minStock" className="text-right font-bold">Min. Stok</Label>
                  <Input
                    id="minStock"
                    type="number"
                    value={newIngredient.minStock}
                    onChange={(e) => setNewIngredient({...newIngredient, minStock: parseFloat(e.target.value) || 0})}
                    className="col-span-3 rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddIngredient} className="orange-gradient text-white font-bold rounded-2xl w-full h-12">
                  Simpan Bahan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
          <div className="p-3 rounded-2xl bg-orange-100 text-[#FF6B35] shrink-0">
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
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Edit Bahan</DialogTitle>
            <DialogDescription className="font-medium">
              Perbarui informasi bahan baku.
            </DialogDescription>
          </DialogHeader>
          {editingIngredient && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right font-bold">Nama</Label>
                <Input
                  id="edit-name"
                  value={editingIngredient.name}
                  onChange={(e) => setEditingIngredient({...editingIngredient, name: e.target.value})}
                  className="col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category" className="text-right font-bold">Kelompok</Label>
                <select
                  id="edit-category"
                  value={editingIngredient.category}
                  onChange={(e) => setEditingIngredient({...editingIngredient, category: e.target.value})}
                  className="col-span-3 h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] font-medium"
                >
                  <option value="Kulit Cireng">Kulit Cireng</option>
                  <option value="Bahan Isian">Bahan Isian</option>
                  <option value="Packing">Packing</option>
                  <option value="Overhead">Overhead</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-unit" className="text-right font-bold">Satuan</Label>
                <Input
                  id="edit-unit"
                  value={editingIngredient.unit}
                  onChange={(e) => setEditingIngredient({...editingIngredient, unit: e.target.value})}
                  className="col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-price" className="text-right font-bold">Harga/Satuan</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={editingIngredient.price}
                  onChange={(e) => setEditingIngredient({...editingIngredient, price: parseFloat(e.target.value) || 0})}
                  className="col-span-3 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-minStock" className="text-right font-bold">Min. Stok</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  value={editingIngredient.minStock}
                  onChange={(e) => setEditingIngredient({...editingIngredient, minStock: parseFloat(e.target.value) || 0})}
                  className="col-span-3 rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleEditIngredient} className="orange-gradient text-white font-bold rounded-2xl w-full h-12">
              Simpan Perubahan
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
          />
        ))}
      </div>

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
  onDelete: () => void
}> = ({ item, onUpdate, onEdit, onDelete }) => {
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
            <h3 className="text-lg font-black text-[#1A1A2E] group-hover:text-[#FF6B35] transition-colors">{item.name}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn(
              "font-black text-[10px] border-none",
              isOut ? "bg-red-100 text-red-600" : isLow ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
            )}>
              {isOut ? "HABIS" : isLow ? "BELI" : "AMAN"}
            </Badge>
            <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                {item.currentStock} <span className="text-sm text-gray-400 font-bold">{item.unit}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Nilai Stok</p>
              <p className="text-sm font-black text-orange-500">Rp {(item.currentStock * (item.price || 0)).toLocaleString()}</p>
            </div>
          </div>

          <Progress 
            value={progressValue} 
            className="h-2 bg-gray-100"
            indicatorClassName={cn(
              isOut ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-green-500"
            )}
          />

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onUpdate(-1)}
              className="flex-1 h-10 rounded-xl border-gray-100 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onUpdate(1)}
              className="flex-1 h-10 rounded-xl border-gray-100 hover:bg-green-50 hover:text-green-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
