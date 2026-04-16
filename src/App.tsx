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

  // Auto-seed data if user just logged in and has no data (requested by user)
  React.useEffect(() => {
    // Only attempt if we are sure we are logged in, auth is ready, and cloud sync (initial fetch) is done
    if (user && isAuthReady && !isCloudSyncing) {
      // If after syncing, both ingredients and transactions are still empty, and onboarding not done
      if (ingredients.length === 0 && transactions.length === 0 && !storeSettings.onboardingCompleted) {
        console.log('Account is empty, seeding sample data...');
        seedCloudData();
      }
    }
  }, [user, isAuthReady, isCloudSyncing, ingredients.length, transactions.length, storeSettings.onboardingCompleted]);

  // Data Persistence (Write to Firestore)
  const updateStoreSettings = async (newSettings: StoreSettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), sanitizeData(newSettings));
      setStoreSettings(newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profil_toko/settings`);
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
      const allMaterials = products.flatMap(p => p.varian.flatMap(v => v.bahan || []));
      const uniqueMaterials = Array.from(new Map(allMaterials.map(m => [m.nama.toLowerCase().trim(), m])).values()) as any[];
      
      // Safer ID generation for non-ASCII characters
      const generateId = (name: string) => {
        const cleanName = name.toLowerCase().trim();
        try {
          // Use a simple hash or safe base64
          return 'ing_' + btoa(unescape(encodeURIComponent(cleanName))).substring(0, 12).replace(/[+/=]/g, '');
        } catch (e) {
          // Fallback if btoa fails
          return 'ing_' + cleanName.replace(/[^a-z0-9]/g, '').substring(0, 12);
        }
      };

      const validMaterialIds = new Set(uniqueMaterials.map(m => generateId(m.nama)));

      const batch = writeBatch(db);
      let hasChanges = false;

      // 1. Sync/Add from HPP to Stock
      for (const m of uniqueMaterials) {
        if (!m.nama || !m.nama.trim()) continue;
        
        const stockId = generateId(m.nama);
        const stockRef = doc(db, `users/${user.uid}/stok/${stockId}`);
        
        const existingIng = ingredients.find(i => i.id === stockId);
        
        if (existingIng) {
          if (existingIng.category !== m.kelompok || existingIng.price !== m.harga || existingIng.unit !== m.satuan || existingIng.name !== m.nama) {
            batch.update(stockRef, sanitizeData({
              name: m.nama || '',
              category: m.kelompok || 'Lainnya',
              price: Number(m.harga) || 0,
              unit: m.satuan || 'gram'
            }));
            hasChanges = true;
          }
        } else {
          batch.set(stockRef, {
            id: stockId,
            name: m.nama || '',
            category: m.kelompok || 'Lainnya',
            unit: m.satuan || 'gram',
            price: Number(m.harga) || 0,
            initialStock: 0,
            currentStock: 0,
            minStock: 0,
            fromHpp: true
          });
          hasChanges = true;
        }
      }

      // 2. Automatic Cleanup
      const orphanedIngredients = ingredients.filter(i => i.fromHpp && !validMaterialIds.has(i.id));
      if (orphanedIngredients.length > 0) {
        orphanedIngredients.forEach(i => {
          batch.delete(doc(db, `users/${user.uid}/stok/${i.id}`));
        });
        hasChanges = true;
      }
      
      if (hasChanges) {
        console.log('Syncing HPP to Stock...');
        await batch.commit();
        console.log('Sync HPP to Stock completed');
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
    const cleanName = materialName.toLowerCase().trim();
    let stockId = '';
    try {
      stockId = 'ing_' + btoa(unescape(encodeURIComponent(cleanName))).substring(0, 12).replace(/[+/=]/g, '');
    } catch (e) {
      stockId = 'ing_' + cleanName.replace(/[^a-z0-9]/g, '').substring(0, 12);
    }
    try {
      await deleteDoc(doc(db, `users/${user.uid}/stok/${stockId}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/stok/${stockId}`);
    }
  }, [user]);

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
          onSuccess={() => handleTabChange('dashboard')}
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
