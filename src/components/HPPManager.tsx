import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, Save, Plus, Edit2, Trash2, ChevronRight, ArrowLeft, 
  Package, Info, TrendingUp, DollarSign, MoreVertical, Copy
} from 'lucide-react';
import { Product, Variant, HppMaterial, Ingredient } from '../types';
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

import { auth, db, doc, setDoc, deleteDoc, OperationType, handleFirestoreError } from '../lib/firebase';

interface HPPManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  onSetBack: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

type ViewState = 'products' | 'variants' | 'detail';

export default function HPPManager({ products, setProducts, ingredients, setIngredients, onSetBack }: HPPManagerProps) {
  const user = auth.currentUser;
  const [view, setView] = React.useState<ViewState>('products');
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  
  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = React.useState<Variant | null>(null);
  
  // Detail HPP State
  const [activeHppVariant, setActiveHppVariant] = React.useState<Variant | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = React.useState(false);
  const [editingMaterial, setEditingMaterial] = React.useState<{ material: HppMaterial, index: number } | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedVariant = selectedProduct?.varian.find(v => v.id === selectedVariantId);

  // Navigation handlers
  const handleViewVariants = (productId: string) => {
    setSelectedProductId(productId);
    setView('variants');
  };

  const handleViewDetail = (variantId: string) => {
    setSelectedVariantId(variantId);
    const variant = selectedProduct?.varian.find(v => v.id === variantId);
    if (variant) {
      setActiveHppVariant(JSON.parse(JSON.stringify(variant)));
      setView('detail');
    }
  };

  const handleBack = React.useCallback(() => {
    if (view === 'detail') setView('variants');
    else if (view === 'variants') setView('products');
  }, [view]);

  React.useEffect(() => {
    if (view !== 'products' && onSetBack) {
      onSetBack(() => handleBack);
    } else if (onSetBack) {
      onSetBack(null);
    }
    return () => {
      if (onSetBack) onSetBack(null);
    };
  }, [view, handleBack, onSetBack]);

  // Product CRUD
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const nama = formData.get('nama') as string;
    const deskripsi = formData.get('deskripsi') as string;

    if (editingProduct) {
      const updatedProduct = { ...editingProduct, nama, deskripsi };
      if (user) {
        try {
          await setDoc(doc(db, `users/${user.uid}/hpp/${editingProduct.id}`), updatedProduct);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/hpp/${editingProduct.id}`);
        }
      } else {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));
      }
      toast.success('Produk diperbarui');
    } else {
      const id = 'prod_' + Math.random().toString(36).substr(2, 9);
      const newProduct: Product = {
        id,
        nama,
        deskripsi,
        varian: []
      };
      if (user) {
        try {
          await setDoc(doc(db, `users/${user.uid}/hpp/${id}`), newProduct);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/hpp/${id}`);
        }
      } else {
        setProducts(prev => [...prev, newProduct]);
      }
      toast.success('Produk ditambahkan');
    }
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product && product.varian.length > 0) {
      toast.error('Gagal menghapus', { description: 'Hapus semua varian terlebih dahulu.' });
      return;
    }
    
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/hpp/${productId}`));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/hpp/${productId}`);
      }
    } else {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
    toast.success('Produk dihapus');
  };

  const handleDuplicateProduct = async (product: Product) => {
    const id = 'prod_' + Math.random().toString(36).substr(2, 9);
    const newProduct: Product = {
      ...JSON.parse(JSON.stringify(product)),
      id,
      nama: `${product.nama} (Copy)`,
      varian: product.varian.map(v => ({
        ...JSON.parse(JSON.stringify(v)),
        id: 'var_' + Math.random().toString(36).substr(2, 9)
      }))
    };
    
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/hpp/${id}`), newProduct);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/hpp/${id}`);
      }
    } else {
      setProducts(prev => [...prev, newProduct]);
    }
    toast.success(`Produk '${product.nama}' diduplikasi`);
  };

  // Variant CRUD
  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const nama = formData.get('nama') as string;
    const harga_jual = parseInt(formData.get('harga_jual') as string) || 0;
    const qty_batch = parseInt(formData.get('qty_batch') as string) || 145;
    const harga_packing = parseInt(formData.get('harga_packing') as string) || 12000;

    if (!selectedProductId) return;

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    let updatedVarian;
    if (editingVariant) {
      updatedVarian = product.varian.map(v => v.id === editingVariant.id ? { ...v, nama, harga_jual, qty_batch, harga_packing } : v);
    } else {
      const newVariant: Variant = {
        id: 'var_' + Math.random().toString(36).substr(2, 9),
        nama,
        harga_jual,
        qty_batch,
        harga_packing,
        bahan: []
      };
      updatedVarian = [...product.varian, newVariant];
    }

    const updatedProduct = { ...product, varian: updatedVarian };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/hpp/${selectedProductId}`), updatedProduct);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/hpp/${selectedProductId}`);
      }
    } else {
      setProducts(prev => prev.map(p => p.id === selectedProductId ? updatedProduct : p));
    }

    toast.success(editingVariant ? 'Varian diperbarui' : 'Varian ditambahkan');
    setIsVariantModalOpen(false);
    setEditingVariant(null);
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const updatedProduct = { ...product, varian: product.varian.filter(v => v.id !== variantId) };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/hpp/${selectedProductId}`), updatedProduct);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/hpp/${selectedProductId}`);
      }
    } else {
      setProducts(prev => prev.map(p => p.id === selectedProductId ? updatedProduct : p));
    }
    toast.success('Varian dihapus');
  };

  const handleDuplicateVariant = async (variant: Variant) => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newVariant: Variant = {
      ...JSON.parse(JSON.stringify(variant)),
      id: 'var_' + Math.random().toString(36).substr(2, 9),
      nama: `${variant.nama} (Copy)`
    };
    
    const updatedProduct = { ...product, varian: [...product.varian, newVariant] };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/hpp/${selectedProductId}`), updatedProduct);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/hpp/${selectedProductId}`);
      }
    } else {
      setProducts(prev => prev.map(p => p.id === selectedProductId ? updatedProduct : p));
    }
    toast.success(`Varian '${variant.nama}' diduplikasi`);
  };

  // HPP Detail Handlers
  const handleMaterialChange = (index: number, field: keyof HppMaterial, value: any) => {
    if (!activeHppVariant) return;
    const newBahan = [...activeHppVariant.bahan];
    newBahan[index] = { ...newBahan[index], [field]: value };
    setActiveHppVariant({ ...activeHppVariant, bahan: newBahan });
  };

  const handleAddMaterial = () => {
    if (!activeHppVariant) return;
    const newMaterial: HppMaterial = {
      id: 'mat_' + Math.random().toString(36).substr(2, 9),
      nama: '',
      satuan: 'gram',
      qty: 0,
      harga: 0,
      kelompok: 'Lainnya'
    };
    setActiveHppVariant({ ...activeHppVariant, bahan: [...activeHppVariant.bahan, newMaterial] });
  };

  const handleRemoveMaterial = (index: number) => {
    if (!activeHppVariant) return;
    const material = activeHppVariant.bahan[index];
    
    const newBahan = activeHppVariant.bahan.filter((_, i) => i !== index);
    setActiveHppVariant({ ...activeHppVariant, bahan: newBahan });
    toast.success(`Bahan "${material.nama}" berhasil dihapus`);
  };

  const handleRemoveCategory = (catName: string) => {
    if (!activeHppVariant) return;
    
    const newBahan = activeHppVariant.bahan.filter(m => {
      let mCat = m.kelompok;
      if (mCat === 'Kulit') mCat = 'Kulit Cireng';
      if (mCat === 'Isian') mCat = 'Bahan Isian';
      return mCat !== catName;
    });
    setActiveHppVariant({ ...activeHppVariant, bahan: newBahan });
    toast.success(`Kelompok ${catName} berhasil dihapus`);
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial || !activeHppVariant) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const nama = formData.get('nama') as string;
    const kelompok = formData.get('kelompok') as string;
    const qty = parseFloat(formData.get('qty') as string) || 0;
    const harga = parseFloat(formData.get('harga') as string) || 0;
    const satuan = formData.get('satuan') as string;

    const newBahan = [...activeHppVariant.bahan];
    newBahan[editingMaterial.index] = { 
      ...newBahan[editingMaterial.index], 
      nama, 
      kelompok, 
      qty, 
      harga,
      satuan
    };
    
    setActiveHppVariant({ ...activeHppVariant, bahan: newBahan });
    setIsMaterialModalOpen(false);
    setEditingMaterial(null);
    toast.success('Bahan diperbarui');
  };
  const handleSaveHpp = async () => {
    if (!activeHppVariant || !selectedProductId) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const updatedProduct = {
      ...product,
      varian: product.varian.map(v => v.id === activeHppVariant.id ? activeHppVariant : v)
    };

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/hpp/${selectedProductId}`), updatedProduct);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/hpp/${selectedProductId}`);
      }
    } else {
      setProducts(prev => prev.map(p => p.id === selectedProductId ? updatedProduct : p));
    }
    toast.success('Data HPP berhasil disimpan dan disinkronkan ke Stok');
  };

  const calculateHpp = (bahan: HppMaterial[], packingCost: number = 0) => {
    return bahan.reduce((acc, b) => acc + (b.qty * b.harga), 0) + packingCost;
  };

  // Render Helpers
  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">
      <button onClick={() => setView('products')} className="hover:text-[#FF6B35] transition-colors">HPP</button>
      {view !== 'products' && (
        <>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => setView('variants')} className="hover:text-[#FF6B35] transition-colors">{selectedProduct?.nama}</button>
        </>
      )}
      {view === 'detail' && (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#1A1A2E]">{activeHppVariant?.nama}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Manajemen HPP</h2>
          <p className="text-gray-500 font-medium">Kelola produk, varian, dan kalkulasi modal.</p>
        </div>
        {view === 'products' && (
          <Button 
            onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
            className="orange-gradient text-white font-bold rounded-2xl shadow-lg shadow-orange-100 gap-2 h-12 px-6"
          >
            <Plus className="w-4 h-4" />
            Produk Baru
          </Button>
        )}
        {view === 'variants' && (
          <Button 
            onClick={() => { setEditingVariant(null); setIsVariantModalOpen(true); }}
            className="orange-gradient text-white font-bold rounded-2xl shadow-lg shadow-orange-100 gap-2 h-12 px-6"
          >
            <Plus className="w-4 h-4" />
            Varian Baru
          </Button>
        )}
        {view === 'detail' && (
          <Button 
            onClick={handleSaveHpp}
            className="orange-gradient text-white font-bold rounded-2xl shadow-lg shadow-orange-100 gap-2 h-12 px-6"
          >
            <Save className="w-4 h-4" />
            Simpan HPP
          </Button>
        )}
      </div>

      {renderBreadcrumbs()}

      {/* VIEW: PRODUCTS */}
      {view === 'products' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <Card key={p.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-2xl bg-orange-50 text-[#FF6B35]">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={() => handleDuplicateProduct(p)} title="Duplikasi">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteProduct(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="text-xl font-black text-[#1A1A2E] mb-1">{p.nama}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.deskripsi || 'Tidak ada deskripsi'}</p>
                <div className="flex items-center justify-between">
                  <Badge className="bg-orange-100 text-[#FF6B35] border-none font-bold">
                    {p.varian.length} Varian
                  </Badge>
                  <Button 
                    variant="ghost" 
                    className="text-[#FF6B35] font-bold hover:bg-orange-50 rounded-xl gap-1"
                    onClick={() => handleViewVariants(p.id)}
                  >
                    Lihat Varian
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* VIEW: VARIANTS */}
      {view === 'variants' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {selectedProduct?.varian.map(v => {
              const hppBatch = calculateHpp(v.bahan);
              const hppPcs = hppBatch / v.qty_batch;
              const margin = v.harga_jual > 0 ? ((v.harga_jual - hppPcs) / v.harga_jual) * 100 : 0;
              
              return (
                <Card key={v.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-[#FF6B35]">
                        <Calculator className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#1A1A2E]">{v.nama}</h3>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs font-bold text-gray-400">HPP: <span className="text-orange-500">{v.bahan.length > 0 ? `Rp ${Math.round(hppPcs).toLocaleString()}` : '—'}</span></span>
                          <span className="text-xs font-bold text-gray-400">Jual: <span className="text-green-600">Rp {v.harga_jual.toLocaleString()}</span></span>
                          {v.bahan.length > 0 && (
                            <Badge className="bg-green-100 text-green-700 text-[10px] border-none font-bold">
                              Margin {margin.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        className="bg-[#FF6B35] hover:bg-[#E55A25] text-white font-bold rounded-xl gap-2"
                        onClick={() => handleViewDetail(v.id)}
                      >
                        Hitung HPP
                      </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-gray-100 text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={() => handleDuplicateVariant(v)} title="Duplikasi">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-gray-100 text-gray-400 hover:text-blue-500 hover:bg-blue-50" onClick={() => { setEditingVariant(v); setIsVariantModalOpen(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteVariant(v.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: DETAIL HPP */}
      {view === 'detail' && activeHppVariant && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-bold">Komposisi Bahan Baku</CardTitle>
                  <CardDescription>{selectedProduct?.nama} › {activeHppVariant.nama}</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl border-orange-100 text-[#FF6B35] font-bold gap-1" onClick={handleAddMaterial}>
                  <Plus className="w-4 h-4" />
                  Tambah Bahan
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                  {['Kulit Cireng', 'Bahan Isian', 'Packing', 'Overhead', 'Lainnya'].map(cat => {
                    const catMaterials = activeHppVariant.bahan
                      .map((m, originalIdx) => ({ ...m, originalIdx }))
                      .filter(m => {
                        let mCat = m.kelompok;
                        if (mCat === 'Kulit') mCat = 'Kulit Cireng';
                        if (mCat === 'Isian') mCat = 'Bahan Isian';
                        return mCat === cat;
                      });
                    
                    if (catMaterials.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center gap-3 px-2 py-1">
                          <div className="h-[2px] flex-1 bg-orange-100/50"></div>
                          <Badge variant="outline" className="bg-orange-50 border-orange-200 text-[#FF6B35] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">
                            {cat}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleRemoveCategory(cat)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                          <div className="h-[2px] flex-1 bg-orange-100/50"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {catMaterials.map((m) => (
                            <div key={m.originalIdx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm group hover:border-orange-200 transition-all">
                              <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-black text-[#1A1A2E] truncate pr-2">{m.nama}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-orange-50 text-[#FF6B35] border-none text-[9px] font-bold uppercase">
                                      {m.kelompok}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-gray-400">
                                      {m.qty} {m.satuan}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-black text-[#FF6B35]">
                                    Rp {(m.qty * m.harga).toLocaleString()}
                                  </p>
                                  <div className="flex gap-1 mt-2 justify-end">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                                      onClick={() => {
                                        setEditingMaterial({ material: m, index: m.originalIdx });
                                        setIsMaterialModalOpen(true);
                                      }}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                                      onClick={() => handleRemoveMaterial(m.originalIdx)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {activeHppVariant.bahan.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                      <Calculator className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 font-bold">Belum ada bahan baku.</p>
                      <Button variant="link" className="text-[#FF6B35] font-bold" onClick={handleAddMaterial}>
                        Tambah bahan sekarang
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <div className="bg-[#FF6B35] p-6 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total HPP per Batch</p>
                  <h3 className="text-3xl font-black mt-1">Rp {calculateHpp(activeHppVariant.bahan, activeHppVariant.harga_packing).toLocaleString()}</h3>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-none font-bold">
                      {activeHppVariant.qty_batch} pcs / batch
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-500">HPP per Pcs</span>
                    <span className="text-lg font-black text-[#1A1A2E]">
                      Rp {Math.round(calculateHpp(activeHppVariant.bahan, activeHppVariant.harga_packing) / activeHppVariant.qty_batch).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-500">Harga Jual</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">Rp</span>
                      <Input 
                        type="number"
                        value={activeHppVariant.harga_jual}
                        onChange={(e) => setActiveHppVariant({...activeHppVariant, harga_jual: parseInt(e.target.value) || 0})}
                        className="w-24 h-8 font-black text-right rounded-lg border-gray-200"
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-dashed border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-gray-500">Laba per Pcs</span>
                      <span className="text-lg font-black text-green-600">
                        Rp {Math.round(activeHppVariant.harga_jual - (calculateHpp(activeHppVariant.bahan, activeHppVariant.harga_packing) / activeHppVariant.qty_batch)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500">Margin Laba</span>
                      <Badge className="bg-green-100 text-green-700 border-none font-black">
                        {(activeHppVariant.harga_jual > 0 ? ((activeHppVariant.harga_jual - (calculateHpp(activeHppVariant.bahan, activeHppVariant.harga_packing) / activeHppVariant.qty_batch)) / activeHppVariant.harga_jual) * 100 : 0).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveHpp}
                    className="w-full mt-4 orange-gradient text-white font-bold h-12 rounded-2xl shadow-lg shadow-orange-200 gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Data HPP
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-3xl bg-blue-50">
                <CardContent className="p-6 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-800">Tips Optimasi</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed mt-1">
                      Gunakan bahan baku berkualitas dengan harga grosir untuk menekan HPP. Pastikan margin minimal 30-40% untuk keberlanjuan usaha.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent key={editingProduct?.id || 'new-product'} className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            <DialogDescription>Masukkan informasi produk utama di sini.</DialogDescription>
          </DialogHeader>
          <form key={editingProduct?.id || 'new-product'} onSubmit={handleSaveProduct} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama" className="font-bold">Nama Produk</Label>
              <Input id="nama" name="nama" defaultValue={editingProduct?.nama || ''} placeholder="Contoh: Cireng Isi" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deskripsi" className="font-bold">Deskripsi (Opsional)</Label>
              <Input id="deskripsi" name="deskripsi" defaultValue={editingProduct?.deskripsi || ''} placeholder="Contoh: Cireng goreng dengan berbagai isian" className="rounded-xl" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsProductModalOpen(false)} className="rounded-xl font-bold">Batal</Button>
              <Button type="submit" className="bg-[#FF6B35] hover:bg-[#E55A25] text-white rounded-xl font-bold">Simpan Produk</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVariantModalOpen} onOpenChange={setIsVariantModalOpen}>
        <DialogContent key={editingVariant?.id || 'new-variant'} className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingVariant ? 'Edit Varian' : 'Tambah Varian Baru'}</DialogTitle>
            <DialogDescription>Masukkan detail varian untuk produk {selectedProduct?.nama}.</DialogDescription>
          </DialogHeader>
          <form key={editingVariant?.id || 'new-variant'} onSubmit={handleSaveVariant} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama" className="font-bold">Nama Varian</Label>
              <Input id="nama" name="nama" defaultValue={editingVariant?.nama || ''} placeholder="Contoh: Ayam Ori" required className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="harga_jual" className="font-bold">Harga Jual / pcs</Label>
                <Input id="harga_jual" name="harga_jual" type="number" defaultValue={editingVariant?.harga_jual || 0} placeholder="1100" required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty_batch" className="font-bold">Qty Batch</Label>
                <Input id="qty_batch" name="qty_batch" type="number" defaultValue={editingVariant?.qty_batch || 145} required className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="harga_packing" className="font-bold">Harga Packing / pack</Label>
              <Input id="harga_packing" name="harga_packing" type="number" defaultValue={editingVariant?.harga_packing || 12000} required className="rounded-xl" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsVariantModalOpen(false)} className="rounded-xl font-bold">Batal</Button>
              <Button type="submit" className="bg-[#FF6B35] hover:bg-[#E55A25] text-white rounded-xl font-bold">Simpan Varian</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
        <DialogContent className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Edit Bahan Baku</DialogTitle>
            <DialogDescription>Sesuaikan rincian bahan untuk perhitungan HPP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveMaterial} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mat-nama" className="font-bold">Nama Bahan</Label>
              <Input id="mat-nama" name="nama" defaultValue={editingMaterial?.material.nama || ''} placeholder="Contoh: Tepung Tapioka" required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-kelompok" className="font-bold">Kelompok</Label>
              <select 
                id="mat-kelompok" 
                name="kelompok" 
                defaultValue={editingMaterial?.material.kelompok || 'Lainnya'}
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] font-medium"
              >
                <option value="Kulit Cireng">Kulit Cireng</option>
                <option value="Bahan Isian">Bahan Isian</option>
                <option value="Packing">Packing</option>
                <option value="Overhead">Overhead</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mat-qty" className="font-bold">Takaran</Label>
                <Input id="mat-qty" name="qty" type="number" step="0.01" defaultValue={editingMaterial?.material.qty || 0} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mat-satuan" className="font-bold">Satuan</Label>
                <Input id="mat-satuan" name="satuan" defaultValue={editingMaterial?.material.satuan || 'gram'} required className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-harga" className="font-bold">Harga per Satuan (Rp)</Label>
              <Input id="mat-harga" name="harga" type="number" step="0.01" defaultValue={editingMaterial?.material.harga || 0} required className="rounded-xl" />
            </div>
            <DialogFooter className="pt-4 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsMaterialModalOpen(false)} className="rounded-xl font-bold flex-1">Batal</Button>
              <Button type="submit" className="bg-[#FF6B35] hover:bg-[#E55A25] text-white rounded-xl font-bold flex-1">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
