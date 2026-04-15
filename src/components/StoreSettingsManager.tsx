import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StoreSettings } from '../types';
import { toast } from 'sonner';
import { Store, Upload, X, Save, ArrowLeft, Settings2 } from 'lucide-react';

import { auth, db, doc, setDoc, OperationType, handleFirestoreError } from '../lib/firebase';

interface StoreSettingsManagerProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  onBack: () => void;
  onManageCategories: () => void;
}

export default function StoreSettingsManager({ settings, setSettings, onBack, onManageCategories }: StoreSettingsManagerProps) {
  const user = auth.currentUser;
  const [localSettings, setLocalSettings] = React.useState<StoreSettings>(settings);
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Optimistic update
    setSettings(localSettings);
    
    if (user) {
      // Background sync
      setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), localSettings)
        .then(() => {
          console.log('Settings synced successfully');
        })
        .catch(error => {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/profil_toko/settings`);
          toast.error('Gagal sinkronisasi pengaturan ke cloud.');
        });
      
      toast.success('Pengaturan toko berhasil disimpan ✓');
      setIsSaving(false);
      onBack();
    } else {
      localStorage.setItem('cireng_store_settings', JSON.stringify(localSettings));
      toast.success('Pengaturan toko berhasil disimpan ✓');
      setIsSaving(false);
      onBack();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Profil & Pengaturan Toko</h2>
          <p className="text-gray-500 font-medium">Kelola identitas dan tampilan toko Anda.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* A. IDENTITAS TOKO */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Store className="w-5 h-5 text-[#FF6B35]" />
              Identitas Toko
            </CardTitle>
            <CardDescription>Informasi dasar toko Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
              <div className="relative w-24 h-24 rounded-3xl bg-white shadow-sm flex items-center justify-center overflow-hidden border border-gray-100">
                {localSettings.logo ? (
                  <img 
                    src={localSettings.logo} 
                    alt="Logo Preview" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-2" 
                  />
                ) : (
                  <Store className="w-10 h-10 text-gray-300" />
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                >
                  <Upload className="w-6 h-6" />
                </button>
              </div>
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl font-bold">
                  Upload Logo
                </Button>
                <p className="text-[10px] text-gray-400 mt-2">Format: JPG, PNG, SVG (Max 2MB)</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
              />
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Nama Toko</Label>
                <Input 
                  value={localSettings.name} 
                  onChange={e => setLocalSettings(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Masukkan nama toko"
                  className="rounded-2xl h-12 border-gray-100 focus:ring-[#FF6B35]"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Slogan/Tagline (Opsional)</Label>
                <Input 
                  value={localSettings.tagline || ''} 
                  onChange={e => setLocalSettings(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Contoh: Jajanan Enak Setiap Hari"
                  className="rounded-2xl h-12 border-gray-100 focus:ring-[#FF6B35]"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Nomor Telepon/WhatsApp</Label>
                <Input 
                  value={localSettings.phone || ''} 
                  onChange={e => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contoh: 08123456789"
                  className="rounded-2xl h-12 border-gray-100 focus:ring-[#FF6B35]"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Alamat Toko</Label>
                <textarea 
                  value={localSettings.address || ''} 
                  onChange={e => setLocalSettings(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Masukkan alamat lengkap toko"
                  className="w-full min-h-[100px] p-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-[#FF6B35] focus:outline-none text-sm font-medium"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B. TAMPILAN LOGO */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#FF6B35]" />
              Tampilan Logo
            </CardTitle>
            <CardDescription>Atur di mana logo akan ditampilkan</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-700">Logo di Header (Mobile/Desktop)</Label>
                  <p className="text-xs text-gray-500">Tampilkan logo pada bagian atas aplikasi</p>
                </div>
                <Switch 
                  checked={localSettings.showLogoInHeader} 
                  onCheckedChange={checked => setLocalSettings(prev => ({ ...prev, showLogoInHeader: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-700">Logo di Sidebar (Tablet/Desktop)</Label>
                  <p className="text-xs text-gray-500">Tampilkan logo pada menu samping</p>
                </div>
                <Switch 
                  checked={localSettings.showLogoInSidebar} 
                  onCheckedChange={checked => setLocalSettings(prev => ({ ...prev, showLogoInSidebar: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* C. PENGATURAN STRUK */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Save className="w-5 h-5 text-[#FF6B35]" />
              Pengaturan Struk
            </CardTitle>
            <CardDescription>Atur tampilan struk belanja</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-700">Logo di Struk</Label>
                  <p className="text-xs text-gray-500">Tampilkan logo toko pada struk</p>
                </div>
                <Switch 
                  checked={localSettings.showLogoOnReceipt} 
                  onCheckedChange={checked => setLocalSettings(prev => ({ ...prev, showLogoOnReceipt: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-700">Nama Toko di Struk</Label>
                  <p className="text-xs text-gray-500">Tampilkan nama toko pada struk</p>
                </div>
                <Switch 
                  checked={localSettings.showNameOnReceipt} 
                  onCheckedChange={checked => setLocalSettings(prev => ({ ...prev, showNameOnReceipt: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-700">Alamat di Struk</Label>
                  <p className="text-xs text-gray-500">Tampilkan alamat toko pada struk</p>
                </div>
                <Switch 
                  checked={localSettings.showAddressOnReceipt} 
                  onCheckedChange={checked => setLocalSettings(prev => ({ ...prev, showAddressOnReceipt: checked }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Pesan Footer Struk</Label>
                <Input 
                  value={localSettings.receiptFooter || ''} 
                  onChange={e => setLocalSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                  placeholder="Contoh: Terima kasih sudah berbelanja!"
                  className="rounded-2xl h-12 border-gray-100 focus:ring-[#FF6B35]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* D. KELOLA KATEGORI */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[#FF6B35]" />
              Kustomisasi Kategori
            </CardTitle>
            <CardDescription>Atur kategori HPP, Produk, dan Satuan Unit</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Button 
              onClick={onManageCategories}
              variant="outline"
              className="w-full h-14 rounded-2xl font-bold border-orange-100 text-[#FF6B35] hover:bg-orange-50 flex items-center justify-between px-6"
            >
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5" />
                <span>Kelola Kategori & Label</span>
              </div>
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </Button>
          </CardContent>
        </Card>

        {/* E. Tombol Aksi */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="flex-1 h-14 rounded-2xl font-bold text-gray-600 border-gray-200"
          >
            Batal
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-14 rounded-2xl font-bold orange-gradient text-white shadow-lg shadow-orange-200"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
