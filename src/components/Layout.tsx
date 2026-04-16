
import React from 'react';
import { LayoutDashboard, Calculator, Package, ReceiptText, PieChart, Menu, X, Trash2, ArrowLeft, History, Plus, Store, Bell, Printer, Save, User, Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StoreSettings } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { auth, signOut, User as FirebaseUser } from '../lib/firebase';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  category?: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'hpp', label: 'HPP', icon: Calculator },
  { id: 'stock', label: 'Stok', icon: Package },
  { id: 'transactions', label: 'History', icon: History },
  { id: 'reports', label: 'Laporan', icon: PieChart },
];

const MENU_GROUPS = [
  {
    title: 'PROFIL TOKO',
    items: [
      { id: 'store-settings', label: 'Profil & Pengaturan Toko', icon: Store },
    ]
  },
  {
    title: 'KELOLA',
    items: [
      { id: 'products', label: 'Manajemen Produk', icon: Package },
      { id: 'hpp', label: 'Manajemen HPP', icon: Calculator },
      { id: 'reports', label: 'Laporan Keuangan', icon: PieChart },
      { id: 'transactions', label: 'Riwayat Transaksi', icon: History },
    ]
  },
  {
    title: 'PENGATURAN',
    items: [
      { id: 'notifications', label: 'Notifikasi', icon: Bell },
      { id: 'receipt-settings', label: 'Pengaturan Struk/Invoice', icon: Printer },
      { id: 'backup', label: 'Backup & Restore Data', icon: Save },
    ]
  },
  {
    title: 'AKUN',
    items: [
      { id: 'profile', label: 'Profil Akun', icon: User },
      { id: 'password', label: 'Ubah Password', icon: Lock },
      { id: 'logout', label: 'Keluar (Logout)', icon: LogOut, variant: 'danger' },
    ]
  }
];

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetData: () => void;
  onBack?: () => void;
  showBack?: boolean;
  storeSettings: StoreSettings;
  user: FirebaseUser;
}

export default function Layout({ children, activeTab, setActiveTab, onResetData, onBack, showBack, storeSettings, user }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Kamu berhasil keluar');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Gagal keluar.');
    }
  };

  const handleGlobalBack = () => {
    if (onBack) {
      onBack();
    } else if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  };

  const isNotDashboard = activeTab !== 'dashboard';
  const displayBack = showBack || isNotDashboard;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#1A1A2E] overflow-x-hidden w-full">
      {/* Sidebar Desktop (Minimal) */}
      <aside className="hidden md:flex flex-col w-20 bg-white border-r border-gray-100 shadow-sm fixed h-full z-50">
        <div className="p-4 flex justify-center">
          {storeSettings.logo && storeSettings.showLogoInSidebar ? (
            <img 
              src={storeSettings.logo} 
              alt={storeSettings.name} 
              referrerPolicy="no-referrer"
              className="w-12 h-12 object-contain rounded-xl max-h-[60px]" 
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl orange-gradient flex items-center justify-center text-white font-black shadow-lg shadow-brand-200">
              {storeSettings.name.charAt(0)}
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-4 mt-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all",
                activeTab === item.id ? "bg-brand-50 text-primary" : "text-gray-400 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[8px] font-bold uppercase">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-20 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 flex items-center sticky top-0 z-50 h-16 w-full">
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              {displayBack && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-gray-50 text-gray-600"
                  onClick={handleGlobalBack}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center"
              >
                {displayBack ? (
                  <h1 className="text-lg font-black text-[#1A1A2E]">
                    {NAV_ITEMS.find(i => i.id === activeTab)?.label || "HPP"}
                  </h1>
                ) : (
                  <div className="flex items-center gap-3">
                    {storeSettings.logo && storeSettings.showLogoInHeader && (
                      <img 
                        src={storeSettings.logo} 
                        alt={storeSettings.name} 
                        referrerPolicy="no-referrer"
                        className="h-8 md:h-10 lg:h-12 object-contain max-h-[40px] md:max-h-[50px] lg:max-h-[60px]" 
                      />
                    )}
                    <h1 className="text-lg font-black text-[#1A1A2E]">{storeSettings.name}</h1>
                  </div>
                )}
              </motion.div>
            </div>
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || ''} 
                  className="w-8 h-8 rounded-full border border-gray-100 hidden sm:block"
                  referrerPolicy="no-referrer"
                />
              )}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Hamburger Menu Sidebar (Drawer) */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[280px] bg-white z-[101] shadow-2xl flex flex-col"
              >
                <div className="p-6 flex items-center justify-between border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt="" 
                        className="w-10 h-10 rounded-full border border-gray-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full orange-gradient flex items-center justify-center text-white font-black">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-[#1A1A2E] truncate max-w-[140px]">{user.displayName}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[140px]">{user.email}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                  {MENU_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{group.title}</h3>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'logout') {
                                handleLogout();
                              } else {
                                setActiveTab(item.id);
                                setIsMenuOpen(false);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm",
                              activeTab === item.id 
                                ? "bg-brand-50 text-primary" 
                                : item.variant === 'danger'
                                  ? "text-red-500 hover:bg-red-50"
                                  : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 border-t border-gray-50">
                  <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-tighter">
                    Ceumilan Pay v1.0.0
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 p-4 md:p-8 pb-32 md:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>

        {/* Bottom Tab Bar Mobile (E-Wallet Style) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-[80px] flex items-center justify-around px-2 z-50 pb-safe">
          {NAV_ITEMS.filter(i => i.id !== 'hpp').slice(0, 2).map((item) => (
            <TabButton key={item.id} item={item} activeTab={activeTab} setActiveTab={setActiveTab} />
          ))}
          
          {/* Center Action Button */}
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveTab('transactions')}
              className="w-16 h-16 rounded-full orange-gradient flex items-center justify-center text-white shadow-xl shadow-brand-200 border-4 border-white active:scale-90 transition-transform"
            >
              <Plus className="w-8 h-8" />
            </button>
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary uppercase">Bayar</span>
          </div>

          {NAV_ITEMS.filter(i => i.id !== 'hpp').slice(2, 4).map((item) => (
            <TabButton key={item.id} item={item} activeTab={activeTab} setActiveTab={setActiveTab} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function TabButton({ item, activeTab, setActiveTab }: any) {
  return (
    <button
      onClick={() => setActiveTab(item.id)}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative",
        activeTab === item.id ? "text-primary" : "text-gray-400"
      )}
    >
      <item.icon className={cn("w-6 h-6", activeTab === item.id ? "stroke-[2.5px]" : "stroke-[2px]")} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
      {activeTab === item.id && (
        <motion.div 
          layoutId="activeTab"
          className="absolute top-0 w-12 h-1 bg-primary rounded-b-full"
        />
      )}
    </button>
  );
}
