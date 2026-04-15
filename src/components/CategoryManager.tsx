import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Check, X, Settings2, Package, Layers, Ruler, ArrowLeft } from 'lucide-react';
import { useSettings, DEFAULT_KATEGORI } from '../SettingsContext';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, OperationType, handleFirestoreError } from '../lib/firebase';
import { toast } from 'sonner';

interface CategoryManagerProps {
  onBack: () => void;
}

export default function CategoryManager({ onBack }: CategoryManagerProps) {
  const { settings } = useSettings();
  const [editingItem, setEditingItem] = useState<{ field: string, value: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!settings) return null;

  const handleAddItem = async (field: string) => {
    if (!newItemValue.trim()) return;
    if (settings[field as keyof typeof settings].includes(newItemValue.trim())) {
      toast.error('Nama sudah ada!');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    try {
      const ref = doc(db, `users/${user.uid}/settings/kategori`);
      await updateDoc(ref, {
        [field]: arrayUnion(newItemValue.trim())
      });
      setNewItemValue('');
      toast.success('Berhasil ditambahkan ✓');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/settings/kategori`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (field: string, value: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Validation: check if used in HPP or Stock
      if (field === 'kategori_hpp') {
        const hppQuery = query(collection(db, `users/${user.uid}/hpp`), where('kategori', '==', value));
        const snapshot = await getDocs(hppQuery);
        if (!snapshot.empty) {
          toast.error('Kategori masih digunakan di HPP!');
          return;
        }
        
        const stokQuery = query(collection(db, `users/${user.uid}/stok`), where('category', '==', value));
        const stokSnapshot = await getDocs(stokQuery);
        if (!stokSnapshot.empty) {
          toast.error('Kategori masih digunakan di Stok!');
          return;
        }
      }

      const ref = doc(db, `users/${user.uid}/settings/kategori`);
      await updateDoc(ref, {
        [field]: arrayRemove(value)
      });
      toast.success('Berhasil dihapus');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/settings/kategori`);
    }
  };

  const handleUpdateItem = async (field: string, oldValue: string) => {
    if (!editValue.trim() || editValue === oldValue) {
      setEditingItem(null);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    try {
      const ref = doc(db, `users/${user.uid}/settings/kategori`);
      // Firestore doesn't have a direct "update item in array"
      // So we remove old and add new
      await updateDoc(ref, { [field]: arrayRemove(oldValue) });
      await updateDoc(ref, { [field]: arrayUnion(editValue.trim()) });
      
      setEditingItem(null);
      toast.success('Berhasil diperbarui ✓');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/settings/kategori`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = (title: string, field: string, icon: React.ReactNode) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-50 rounded-lg text-[#FF6B35] shrink-0">
            {icon}
          </div>
          <h3 className="font-black text-gray-800 text-sm md:text-base">{title}</h3>
        </div>
      </div>

      <div className="flex gap-2">
        <Input 
          placeholder={`Tambah ${title.toLowerCase()}...`} 
          value={newItemValue}
          onChange={(e) => setNewItemValue(e.target.value)}
          className="rounded-xl"
          onKeyDown={(e) => e.key === 'Enter' && handleAddItem(field)}
        />
        <Button onClick={() => handleAddItem(field)} disabled={isSaving} className="bg-[#FF6B35] hover:bg-[#E55A25] text-white rounded-xl">
          {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {settings[field as keyof typeof settings].map((item) => (
          <div key={item} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
            {editingItem?.field === field && editingItem?.value === item ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <Input 
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-8 rounded-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateItem(field, item)}
                />
                <Button size="icon" variant="ghost" disabled={isSaving} className="h-8 w-8 text-green-500" onClick={() => handleUpdateItem(field, item)}>
                  {isSaving ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingItem(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="font-bold text-gray-700">{item}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500" onClick={() => {
                    setEditingItem({ field, value: item });
                    setEditValue(item);
                  }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDeleteItem(field, item)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-[#F8FAFC]">
      <CardHeader className="bg-white border-b border-gray-100 p-5 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-1 h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2.5 bg-orange-50 rounded-xl text-[#FF6B35] shrink-0">
              <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
          <div>
            <CardTitle className="text-lg md:text-2xl font-black text-[#1A1A2E]">Kelola Kategori & Label</CardTitle>
            <CardDescription className="font-bold text-gray-400 text-[10px] md:text-sm">Kustomisasi label untuk HPP, Produk, dan Satuan.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-8">
        <Tabs defaultValue="hpp" className="space-y-6 md:space-y-8">
          <TabsList className="bg-white p-1 rounded-xl md:rounded-2xl border border-gray-100 w-full flex h-11 md:h-14">
            <TabsTrigger value="hpp" className="rounded-lg md:rounded-xl font-black text-[10px] md:text-sm flex-1 data-active:bg-orange-50 data-active:text-[#FF6B35]">HPP</TabsTrigger>
            <TabsTrigger value="produk" className="rounded-lg md:rounded-xl font-black text-[10px] md:text-sm flex-1 data-active:bg-orange-50 data-active:text-[#FF6B35]">Produk</TabsTrigger>
            <TabsTrigger value="unit" className="rounded-lg md:rounded-xl font-black text-[10px] md:text-sm flex-1 data-active:bg-orange-50 data-active:text-[#FF6B35]">Satuan</TabsTrigger>
          </TabsList>

          <TabsContent value="hpp">
            {renderSection('Kategori HPP', 'kategori_hpp', <Layers className="w-5 h-5" />)}
          </TabsContent>
          <TabsContent value="produk">
            {renderSection('Kategori Produk', 'kategori_produk', <Package className="w-5 h-5" />)}
          </TabsContent>
          <TabsContent value="unit">
            {renderSection('Satuan Unit', 'satuan_unit', <Ruler className="w-5 h-5" />)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
