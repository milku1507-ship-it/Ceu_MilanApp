import React from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import HPPManager from './components/HPPManager';
import StockManager from './components/StockManager';
import TransactionManager from './components/TransactionManager';
import FinancialReport from './components/FinancialReport';
import StoreSettingsManager from './components/StoreSettingsManager';
import CategoryManager from './components/CategoryManager';
import { INITIAL_INGREDIENTS, INITIAL_PRODUCTS, SAMPLE_TRANSACTIONS } from './constants/data';
import { Ingredient, Product, Transaction, StoreSettings } from './types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Store, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db, onAuthStateChanged, doc, collection, onSnapshot, setDoc, getDoc, deleteDoc, writeBatch, serverTimestamp, User, OperationType, handleFirestoreError, sanitizeData } from './lib/firebase';
import LoginPage from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

import { SettingsProvider } from './SettingsContext';

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const [user, setUser] = React.useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [backAction, setBackAction] = React.useState<(() => void) | null>(null);
  
  // State
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [storeSettings, setStoreSettings] = React.useState<StoreSettings>({
    name: 'Ceumilan Pay',
    showLogoOnReceipt: true,
    showNameOnReceipt: true,
    showAddressOnReceipt: true,
    showLogoInHeader: true,
    showLogoInSidebar: true,
    receiptFooter: 'Terima kasih sudah berbelanja!',
    onboardingCompleted: false
  });

  // Auth Listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        setIsCloudSyncing(true);
        
        // Silent automatic migration if local data exists
        const hasLocalData = localStorage.getItem('cireng_ingredients') || 
                            localStorage.getItem('cireng_produk') || 
                            localStorage.getItem('cireng_transactions');
        
        if (hasLocalData) {
          handleMigrate(currentUser);
        }

        try {
          // setupNewUser logic
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, sanitizeData({
              nama: currentUser.displayName,
              email: currentUser.email,
              foto: currentUser.photoURL,
              createdAt: serverTimestamp()
            }));
          }
        } catch (error) {
          console.warn('Initial user setup failed (might be offline):', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  React.useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    // Sync Store Settings
    const unsubSettings = onSnapshot(doc(db, `users/${uid}/profil_toko/settings`), (snapshot) => {
      if (snapshot.exists()) {
        setStoreSettings(snapshot.data() as StoreSettings);
      }
    }, (error) => {
      console.error('Settings sync error:', error);
      // Don't throw here to avoid unhandled rejections in background listeners
    });

    // Sync Ingredients
    const unsubIngredients = onSnapshot(collection(db, `users/${uid}/stok`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Ingredient);
      setIngredients(data);
      setIsCloudSyncing(false);
    }, (error) => {
      console.error('Ingredients sync error:', error);
      setIsCloudSyncing(false);
    });

    // Sync Products
    const unsubProducts = onSnapshot(collection(db, `users/${uid}/hpp`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Product);
      setProducts(data);
    }, (error) => {
      console.error('Products sync error:', error);
    });

    // Sync Transactions
    const unsubTransactions = onSnapshot(collection(db, `users/${uid}/transaksi`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      // Sort by date descending
      const sorted = data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setTransactions(sorted);
    }, (error) => {
      console.error('Transactions sync error:', error);
    });

    return () => {
      unsubSettings();
      unsubIngredients();
      unsubProducts();
      unsubTransactions();
    };
  }, [user]);

  // Data Persistence (Local Storage for guest users)
  React.useEffect(() => {
    // Only load from localStorage if we are a guest AND the state is currently empty (initial load)
    if (isAuthReady && !user) {
      const localIng = localStorage.getItem('cireng_ingredients');
      const localProd = localStorage.getItem('cireng_produk');
      const localTx = localStorage.getItem('cireng_transactions');
      const localSettings = localStorage.getItem('cireng_store_settings');

      if (localIng && ingredients.length === 0) setIngredients(JSON.parse(localIng));
      else if (!localIng && ingredients.length === 0) setIngredients(INITIAL_INGREDIENTS);

      if (localProd && products.length === 0) setProducts(JSON.parse(localProd));
      else if (!localProd && products.length === 0) setProducts(INITIAL_PRODUCTS);

      if (localTx && transactions.length === 0) setTransactions(JSON.parse(localTx));
      else if (!localTx && transactions.length === 0) setTransactions(SAMPLE_TRANSACTIONS);

      if (localSettings) setStoreSettings(JSON.parse(localSettings));
    }
  }, [user, isAuthReady]); // Removed ingredients.length etc from deps to avoid re-triggering

  // Save to Local Storage
  React.useEffect(() => {
    if (isAuthReady) {
      // Always save settings for branding persistence
      localStorage.setItem('cireng_store_settings', JSON.stringify(storeSettings));
      
      // Only save data for guest users OR at the moment of logout
      // If user is null, it means we are either a guest or just logged out
      if (!user) {
        if (ingredients.length > 0) localStorage.setItem('cireng_ingredients', JSON.stringify(ingredients));
        if (products.length > 0) localStorage.setItem('cireng_produk', JSON.stringify(products));
        if (transactions.length > 0) localStorage.setItem('cireng_transactions', JSON.stringify(transactions));
      }
    }
  }, [ingredients, products, transactions, storeSettings, user, isAuthReady]);

  // Auto-complete onboarding if data exists in cloud
  React.useEffect(() => {
    if (user && !storeSettings.onboardingCompleted && (ingredients.length > 0 || transactions.length > 0)) {
      const markOnboardingDone = async () => {
        try {
          const newSettings = { ...storeSettings, onboardingCompleted: true };
          await setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), sanitizeData(newSettings));
          setStoreSettings(newSettings);
        } catch (e) {
          console.warn('Auto-onboarding update failed:', e);
        }
      };
      markOnboardingDone();
    }
  }, [user, ingredients.length, transactions.length, storeSettings.onboardingCompleted]);

  // Removed auto-seed logic because it interferes with users who want a clean account.
  // The showWelcome card in Dashboard already provides buttons for seeding.
  
  // Data Persistence (Write to Firestore)
  const updateStoreSettings = async (newSettings: StoreSettings) => {
    // 1. Always update local state for immediate feedback
    setStoreSettings(newSettings);
    
    // 2. Persist to appropriate storage
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), sanitizeData(newSettings));
        console.log('Settings synced successfully to Cloud');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profil_toko/settings`);
      }
    } else {
      localStorage.setItem('cireng_store_settings', JSON.stringify(newSettings));
    }
  };

  const updateIngredients = async (newIngredients: Ingredient[]) => {
    setIngredients(newIngredients);
    if (!user) return;
    
    const batch = writeBatch(db);
    try {
      newIngredients.forEach(ing => {
        batch.set(doc(db, `users/${user.uid}/stok/${ing.id}`), sanitizeData(ing));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/stok`);
    }
  };

  // Migration Logic
  const handleMigrate = async (targetUser?: User | null) => {
    const activeUser = targetUser || user;
    if (!activeUser) return;
    const uid = activeUser.uid;
    const batch = writeBatch(db);

    try {
      // Get local data
      const localIngredients = JSON.parse(localStorage.getItem('cireng_ingredients') || '[]');
      const localProducts = JSON.parse(localStorage.getItem('cireng_produk') || '[]');
      const localTransactions = JSON.parse(localStorage.getItem('cireng_transactions') || '[]');
      const localSettings = JSON.parse(localStorage.getItem('cireng_store_settings') || '{}');

      // Add to batch
      if (Object.keys(localSettings).length > 0) {
        batch.set(doc(db, `users/${uid}/profil_toko/settings`), sanitizeData(localSettings));
      }

      localIngredients.forEach((ing: Ingredient) => {
        batch.set(doc(db, `users/${uid}/stok/${ing.id}`), sanitizeData(ing));
      });

      localProducts.forEach((prod: Product) => {
        batch.set(doc(db, `users/${uid}/hpp/${prod.id}`), sanitizeData(prod));
      });

      localTransactions.forEach((tx: Transaction) => {
        batch.set(doc(db, `users/${uid}/transaksi/${tx.id}`), sanitizeData(tx));
      });

      await batch.commit();
      
      // Clear local storage
      localStorage.removeItem('cireng_ingredients');
      localStorage.removeItem('cireng_produk');
      localStorage.removeItem('cireng_transactions');
      localStorage.removeItem('cireng_store_settings');
      
      console.log('Migration completed automatically');
    } catch (error) {
      console.error('Migration error:', error);
    }
  };

  // Removed handleSkipMigration as it's no longer needed

  const seedCloudData = async () => {
    if (!user) return;
    const uid = user.uid;
    const batch = writeBatch(db);
    
    try {
      INITIAL_INGREDIENTS.forEach(ing => {
        batch.set(doc(db, `users/${uid}/stok/${ing.id}`), sanitizeData(ing));
      });
      INITIAL_PRODUCTS.forEach(p => {
        batch.set(doc(db, `users/${uid}/hpp/${p.id}`), sanitizeData(p));
      });
      SAMPLE_TRANSACTIONS.forEach(t => {
        batch.set(doc(db, `users/${uid}/transaksi/${t.id}`), sanitizeData(t));
      });
      
      // Mark onboarding as completed
      const newSettings = { 
        ...storeSettings, 
        onboardingCompleted: true,
        name: storeSettings.name || 'Ceumilan Pay'
      };
      batch.set(doc(db, `users/${uid}/profil_toko/settings`), sanitizeData(newSettings));
      
      await batch.commit();
      setStoreSettings(newSettings);
      toast.success('Data contoh berhasil dimuat ke akun Google kamu! ✓');
    } catch (error) {
      console.error('Seeding error:', error);
      toast.error('Gagal memuat data contoh.');
    }
  };

  const handleStartFresh = async () => {
    if (!user) {
      handleTabChange('hpp');
      return;
    }
    try {
      const newSettings = { ...storeSettings, onboardingCompleted: true };
      await setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), sanitizeData(newSettings));
      setStoreSettings(newSettings);
      handleTabChange('hpp');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profil_toko/settings`);
    }
  };

  // Sync logic
  const syncHppToStock = React.useCallback(async () => {
    if (!user) return;
    try {
      // Filter out empty materials. Materials in HPP are stored in products[].varian[].bahan[]
      const allMaterials = products.flatMap(p => 
        (p.varian || []).flatMap(v => (v.bahan || []))
      ).filter(m => m && m.nama && m.nama.trim());

      // Use a map to track unique materials by normalized name to prevent duplicates
      const materialMap = new Map();
      allMaterials.forEach(m => {
        const normalizedName = m.nama.toLowerCase().trim();
        if (!materialMap.has(normalizedName)) {
          materialMap.set(normalizedName, m);
        }
      });

      const uniqueMaterials = Array.from(materialMap.values());
      
      const generateId = (name: string) => {
        const cleanName = name.toLowerCase().trim();
        try {
          return 'ing_' + btoa(unescape(encodeURIComponent(cleanName))).substring(0, 12).replace(/[+/=]/g, '');
        } catch (e) {
          return 'ing_' + cleanName.replace(/[^a-z0-9]/g, '').substring(0, 12);
        }
      };

      const validMaterialIds = new Set(uniqueMaterials.map(m => generateId(m.nama)));
      const batch = writeBatch(db);
      let hasChanges = false;

      // 1. Sync/Add from HPP to Stock
      const activeIds = new Set<string>();
      for (const m of uniqueMaterials) {
        // Normalize category name for consistency
        let mKelompok = m.kelompok || 'Lainnya';
        if (mKelompok === 'Kulit') mKelompok = 'Kulit Cireng';
        if (mKelompok === 'Isian') mKelompok = 'Bahan Isian';

        // Try to find by ID first, then by name to merge existing items
        let stockId = m.ingredientId;
        if (!stockId) {
          const normalizedName = m.nama.toLowerCase().trim();
          const existingByName = ingredients.find(i => i.name.toLowerCase().trim() === normalizedName);
          stockId = existingByName ? existingByName.id : generateId(m.nama);
        }
        
        activeIds.add(stockId);
        
        const stockRef = doc(db, `users/${user.uid}/stok/${stockId}`);
        const existingIng = ingredients.find(i => i.id === stockId);
        
        if (existingIng) {
          // Check if core data has changed to avoid unnecessary updates
          const hasDataChanged = 
            existingIng.category !== mKelompok || 
            existingIng.price !== m.harga || 
            existingIng.unit !== m.satuan || 
            existingIng.name !== m.nama ||
            !existingIng.fromHpp;

          if (hasDataChanged) {
            batch.update(stockRef, sanitizeData({
              name: m.nama,
              category: mKelompok,
              price: Number(m.harga) || 0,
              unit: m.satuan || 'gram',
              fromHpp: true // Ensure it's marked as fromHpp
            }));
            hasChanges = true;
          }
        } else {
          // New ingredient discovered in HPP
          batch.set(stockRef, sanitizeData({
            id: stockId,
            name: m.nama,
            category: mKelompok,
            unit: m.satuan || 'gram',
            price: Number(m.harga) || 0,
            initialStock: 0,
            currentStock: 0,
            minStock: 0,
            fromHpp: true
          }));
          hasChanges = true;
        }
      }

      // 2. Automatic Cleanup: Removed materials from HPP should be removed from Stock if marked 'fromHpp'
      const orphanedIngredients = ingredients.filter(i => i.fromHpp && !activeIds.has(i.id));
      if (orphanedIngredients.length > 0) {
        orphanedIngredients.forEach(i => {
          batch.delete(doc(db, `users/${user.uid}/stok/${i.id}`));
        });
        hasChanges = true;
      }
      
      if (hasChanges) {
        await batch.commit();
        console.log('Sync HPP to Stock completed successfully');
      }
    } catch (error) {
      console.warn('Sync HPP to Stock failed:', error);
    }
  }, [user, products, ingredients]);

  // Trigger sync when products change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      syncHppToStock();
    }, 2000); // 2s debounce
    return () => clearTimeout(timer);
  }, [products, syncHppToStock]);

  const deleteFromStock = React.useCallback(async (materialName: string) => {
    if (!user || !materialName) return;
    
    // Find the ingredient by name in the local state first to get its actual ID
    const normalizedName = materialName.toLowerCase().trim();
    const existingIng = ingredients.find(i => i.name.toLowerCase().trim() === normalizedName);
    
    if (!existingIng) {
      console.warn(`Material "${materialName}" not found in stock for deletion`);
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/stok/${existingIng.id}`));
      // After deletion, the local state will be updated by the onSnapshot listener if the sync is 100% reactive,
      // but we can also manually filter it out for immediate UI feedback.
      setIngredients(prev => prev.filter(i => i.id !== existingIng.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/stok/${existingIng.id}`);
    }
  }, [user, ingredients]);

  const handleResetStockQty = () => {
    try {
      // Optimistic update for all users
      const resetIngredients = ingredients.map(i => ({ ...i, currentStock: 0 }));
      setIngredients(resetIngredients);
      toast.success('Semua kuantitas stok berhasil dikosongkan ✓');

      if (user) {
        const batch = writeBatch(db);
        ingredients.forEach(i => {
          batch.update(doc(db, `users/${user.uid}/stok/${i.id}`), sanitizeData({ currentStock: 0 }));
        });
        
        // Background sync
        batch.commit().catch(error => {
          console.error('Reset stock batch failed:', error);
          toast.error('Gagal sinkronisasi stok ke cloud.');
        });
      }
    } catch (error) {
      console.error('Reset stock failed:', error);
      if (user) handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stok/reset`);
      toast.error('Gagal mengosongkan stok.');
    }
  };

  const handleResetData = async () => {
    if (user) {
      try {
        const batch = writeBatch(db);
        
        // Delete all data for user
        ingredients.forEach(ing => batch.delete(doc(db, `users/${user.uid}/stok/${ing.id}`)));
        products.forEach(p => batch.delete(doc(db, `users/${user.uid}/hpp/${p.id}`)));
        transactions.forEach(t => batch.delete(doc(db, `users/${user.uid}/transaksi/${t.id}`)));
        
        // Keep settings but mark as onboarding completed to prevent re-seeding
        batch.set(doc(db, `users/${user.uid}/profil_toko/settings`), sanitizeData({
          ...storeSettings,
          onboardingCompleted: true
        }));

        await batch.commit();
        toast.success('Semua data cloud berhasil dikosongkan.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/reset`);
      }
      return;
    }
    localStorage.clear();
    setIngredients(INITIAL_INGREDIENTS);
    setProducts(INITIAL_PRODUCTS);
    setTransactions(SAMPLE_TRANSACTIONS);
    toast.success('Data berhasil di-reset ke pengaturan awal.');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setBackAction(null);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA] space-y-4">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage settings={storeSettings} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
          user={user} 
          ingredients={ingredients} 
          transactions={transactions} 
          storeSettings={storeSettings}
          setActiveTab={handleTabChange} 
          onSeedData={seedCloudData}
          onStartFresh={handleStartFresh}
        />;
      case 'hpp':
        return <HPPManager 
          user={user} 
          products={products} 
          setProducts={setProducts} 
          ingredients={ingredients} 
          setIngredients={setIngredients} 
          onSetBack={setBackAction}
          onDeleteFromStock={deleteFromStock}
        />;
      case 'stock':
        return (
          <StockManager 
            user={user} 
            ingredients={ingredients} 
            setIngredients={setIngredients} 
            transactions={transactions}
            onResetQty={handleResetStockQty} 
          />
        );
      case 'transactions':
        return <TransactionManager 
          user={user} 
          transactions={transactions} 
          setTransactions={setTransactions} 
          products={products} 
          ingredients={ingredients} 
          setIngredients={setIngredients} 
          onSuccess={() => {}} 
        />;
      case 'reports':
        return <FinancialReport transactions={transactions} products={products} />;
      case 'store-settings':
        return <StoreSettingsManager settings={storeSettings} setSettings={updateStoreSettings} onBack={() => handleTabChange('dashboard')} onManageCategories={() => handleTabChange('category-settings')} />;
      case 'category-settings':
        return <CategoryManager onBack={() => handleTabChange('store-settings')} />;
      case 'products':
      case 'notifications':
      case 'receipt-settings':
      case 'backup':
      case 'profile':
      case 'password':
        if (activeTab !== 'dashboard') {
          // These are placeholders for now
          return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center text-primary">
                <Store className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-[#1A1A2E]">Fitur Segera Hadir</h2>
              <p className="text-gray-500 max-w-xs mx-auto">Halaman <strong>{activeTab}</strong> sedang dalam pengembangan.</p>
              <Button onClick={() => handleTabChange('dashboard')} className="orange-gradient text-white rounded-2xl px-8">
                Kembali ke Dashboard
              </Button>
            </div>
          );
        }
        return <Dashboard 
          user={user} 
          ingredients={ingredients} 
          transactions={transactions} 
          storeSettings={storeSettings}
          setActiveTab={handleTabChange} 
        />;
      default:
        return <Dashboard 
          user={user} 
          ingredients={ingredients} 
          transactions={transactions} 
          storeSettings={storeSettings}
          setActiveTab={handleTabChange} 
        />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        onResetData={handleResetData}
        onBack={backAction || undefined}
        showBack={!!backAction}
        storeSettings={storeSettings}
        user={user}
      >
        <Toaster position="top-center" richColors />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
}
