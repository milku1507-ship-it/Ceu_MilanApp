import React from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import HPPManager from './components/HPPManager';
import StockManager from './components/StockManager';
import TransactionManager from './components/TransactionManager';
import FinancialReport from './components/FinancialReport';
import StoreSettingsManager from './components/StoreSettingsManager';
import { INITIAL_INGREDIENTS, INITIAL_PRODUCTS, SAMPLE_TRANSACTIONS } from './constants/data';
import { Ingredient, Product, Transaction, StoreSettings } from './types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Store, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db, onAuthStateChanged, doc, collection, onSnapshot, setDoc, writeBatch, User, OperationType, handleFirestoreError } from './lib/firebase';
import LoginPage from './components/LoginPage';
import MigrationModal from './components/MigrationModal';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [showMigration, setShowMigration] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [backAction, setBackAction] = React.useState<(() => void) | null>(null);
  
  // State
  const [ingredients, setIngredients] = React.useState<Ingredient[]>(INITIAL_INGREDIENTS);
  const [products, setProducts] = React.useState<Product[]>(INITIAL_PRODUCTS);
  const [transactions, setTransactions] = React.useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [storeSettings, setStoreSettings] = React.useState<StoreSettings>({
    name: 'Ceumilan Pay',
    showLogoOnReceipt: true,
    showNameOnReceipt: true,
    showAddressOnReceipt: true,
    showLogoInHeader: true,
    showLogoInSidebar: true,
    receiptFooter: 'Terima kasih sudah berbelanja!'
  });

  // Auth Listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Check if local data exists for migration
        const hasLocalData = localStorage.getItem('cireng_ingredients') || 
                            localStorage.getItem('cireng_produk') || 
                            localStorage.getItem('cireng_transactions');
        
        if (hasLocalData) {
          setShowMigration(true);
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
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/profil_toko/settings`));

    // Sync Ingredients
    const unsubIngredients = onSnapshot(collection(db, `users/${uid}/stok`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Ingredient);
      if (data.length > 0) setIngredients(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/stok`));

    // Sync Products
    const unsubProducts = onSnapshot(collection(db, `users/${uid}/hpp`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Product);
      if (data.length > 0) setProducts(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/hpp`));

    // Sync Transactions
    const unsubTransactions = onSnapshot(collection(db, `users/${uid}/transaksi`), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      // Sort by date descending
      const sorted = data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      if (data.length > 0) setTransactions(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/transaksi`));

    return () => {
      unsubSettings();
      unsubIngredients();
      unsubProducts();
      unsubTransactions();
    };
  }, [user]);

  // Data Persistence (Write to Firestore)
  const updateStoreSettings = async (newSettings: StoreSettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/profil_toko/settings`), newSettings);
      setStoreSettings(newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profil_toko/settings`);
    }
  };

  const updateIngredients = async (newIngredients: Ingredient[]) => {
    if (!user) {
      setIngredients(newIngredients);
      return;
    }
    // For simplicity in this turn, we'll let the onSnapshot handle the state update
    // but we need to write the changes to Firestore. 
    // Usually you'd use a more granular update, but here we'll batch or set individual docs.
  };

  // Migration Logic
  const handleMigrate = async () => {
    if (!user) return;
    const uid = user.uid;
    const batch = writeBatch(db);

    try {
      // Get local data
      const localIngredients = JSON.parse(localStorage.getItem('cireng_ingredients') || '[]');
      const localProducts = JSON.parse(localStorage.getItem('cireng_produk') || '[]');
      const localTransactions = JSON.parse(localStorage.getItem('cireng_transactions') || '[]');
      const localSettings = JSON.parse(localStorage.getItem('cireng_store_settings') || '{}');

      // Add to batch
      if (Object.keys(localSettings).length > 0) {
        batch.set(doc(db, `users/${uid}/profil_toko/settings`), localSettings);
      }

      localIngredients.forEach((ing: Ingredient) => {
        batch.set(doc(db, `users/${uid}/stok/${ing.id}`), ing);
      });

      localProducts.forEach((prod: Product) => {
        batch.set(doc(db, `users/${uid}/hpp/${prod.id}`), prod);
      });

      localTransactions.forEach((tx: Transaction) => {
        batch.set(doc(db, `users/${uid}/transaksi/${tx.id}`), tx);
      });

      await batch.commit();
      
      // Clear local storage
      localStorage.removeItem('cireng_ingredients');
      localStorage.removeItem('cireng_produk');
      localStorage.removeItem('cireng_transactions');
      localStorage.removeItem('cireng_store_settings');
      
      setShowMigration(false);
      toast.success('Data berhasil dipindahkan ke akun Google kamu!');
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Gagal memindahkan data.');
    }
  };

  const handleSkipMigration = () => {
    localStorage.removeItem('cireng_ingredients');
    localStorage.removeItem('cireng_produk');
    localStorage.removeItem('cireng_transactions');
    localStorage.removeItem('cireng_store_settings');
    setShowMigration(false);
    toast.info('Memulai dengan data baru.');
  };

  // Sync logic
  const syncHppToStock = React.useCallback(async (isManualCleanup = false) => {
    // 1. Collect all unique materials from HPP
    const hppMaterialsMap = new Map<string, {
      id?: string;
      nama: string;
      satuan: string;
      harga: number;
      kelompok: string;
    }>();

    products.forEach(product => {
      product.varian.forEach(variant => {
        variant.bahan.forEach(bahan => {
          const nameLower = bahan.nama.toLowerCase().trim();
          if (nameLower === '') return;

          if (!hppMaterialsMap.has(nameLower)) {
            // Normalize category
            let category = bahan.kelompok || 'Lainnya';
            if (category === 'Kulit') category = 'Kulit Cireng';
            if (category === 'Isian') category = 'Bahan Isian';
            if (category === 'Operasional') category = 'Overhead';
            
            hppMaterialsMap.set(nameLower, { ...bahan, kelompok: category });
          }
        });
      });
    });

    // 2. Process all existing ingredients
    const matchedHppNames = new Set<string>();
    let orphanedCount = 0;
    const batch = user ? writeBatch(db) : null;
    let hasChanges = false;
    
    const processedIngredients = ingredients.map(ing => {
      const nameLower = ing.name.toLowerCase().trim();
      const hppData = hppMaterialsMap.get(nameLower);

      if (hppData) {
        // Match found in HPP: Update and mark as fromHpp
        matchedHppNames.add(nameLower);
        const updatedIng = {
          ...ing,
          name: hppData.nama,
          price: hppData.harga,
          category: hppData.kelompok,
          unit: hppData.satuan,
          fromHpp: true
        };
        
        if (JSON.stringify(updatedIng) !== JSON.stringify(ing)) {
          hasChanges = true;
          if (batch && user) batch.set(doc(db, `users/${user.uid}/stok/${ing.id}`), updatedIng);
        }
        return updatedIng;
      } else {
        // No match in HPP
        if (ing.fromHpp) {
          if (isManualCleanup) {
            hasChanges = true;
            if (batch && user) batch.delete(doc(db, `users/${user.uid}/stok/${ing.id}`));
            return null;
          }
          orphanedCount++;
          return ing;
        }
        // Manual item: Keep as is
        return ing;
      }
    }).filter((ing): ing is Ingredient => ing !== null);

    // 3. Add new ingredients from HPP
    const finalIngredients = [...processedIngredients];
    
    hppMaterialsMap.forEach((hppData, nameLower) => {
      if (!matchedHppNames.has(nameLower)) {
        const newIng: Ingredient = {
          id: hppData.id || 'ing_' + Math.random().toString(36).substr(2, 9),
          name: hppData.nama,
          unit: hppData.satuan,
          price: hppData.harga,
          initialStock: 0,
          currentStock: 0,
          minStock: 0,
          category: hppData.kelompok,
          fromHpp: true
        };
        finalIngredients.push(newIng);
        hasChanges = true;
        if (batch && user) batch.set(doc(db, `users/${user.uid}/stok/${newIng.id}`), newIng);
      }
    });

    if (hasChanges) {
      if (batch && user) {
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/stok/sync`);
        }
      } else if (!user) {
        setIngredients(finalIngredients);
      }
    }

    if (!isManualCleanup && orphanedCount > 0 && activeTab === 'stock') {
      toast.warning(`${orphanedCount} bahan di Stok tidak terdaftar di HPP.`, {
        description: "Gunakan tombol 'Bersihkan Stok' untuk menghapus bahan yang tidak sinkron.",
        duration: 5000
      });
    }
  }, [products, ingredients, user, activeTab]);

  React.useEffect(() => {
    syncHppToStock();
  }, [products]); // Only sync when products change

  const handleResetData = async () => {
    if (user) {
      try {
        const batch = writeBatch(db);
        
        // Delete all data for user
        // Note: Firestore doesn't support bulk delete of a collection without knowing IDs
        // We use the current state to identify IDs
        ingredients.forEach(ing => batch.delete(doc(db, `users/${user.uid}/stok/${ing.id}`)));
        products.forEach(p => batch.delete(doc(db, `users/${user.uid}/hpp/${p.id}`)));
        transactions.forEach(t => batch.delete(doc(db, `users/${user.uid}/transaksi/${t.id}`)));
        batch.delete(doc(db, `users/${user.uid}/profil_toko/settings`));

        await batch.commit();
        toast.success('Semua data cloud berhasil dihapus.');
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-[#FF6B35] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard ingredients={ingredients} transactions={transactions} setActiveTab={handleTabChange} />;
      case 'hpp':
        return <HPPManager products={products} setProducts={setProducts} ingredients={ingredients} setIngredients={setIngredients} onSetBack={setBackAction} />;
      case 'stock':
        return <StockManager ingredients={ingredients} setIngredients={setIngredients} onSync={() => syncHppToStock(true)} />;
      case 'transactions':
        return <TransactionManager transactions={transactions} setTransactions={setTransactions} products={products} ingredients={ingredients} setIngredients={setIngredients} />;
      case 'reports':
        return <FinancialReport transactions={transactions} products={products} />;
      case 'store-settings':
        return <StoreSettingsManager settings={storeSettings} setSettings={updateStoreSettings} onBack={() => handleTabChange('dashboard')} />;
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
              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-[#FF6B35]">
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
        return <Dashboard ingredients={ingredients} transactions={transactions} setActiveTab={handleTabChange} />;
      default:
        return <Dashboard ingredients={ingredients} transactions={transactions} setActiveTab={handleTabChange} />;
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
        {showMigration && (
          <MigrationModal onMigrate={handleMigrate} onSkip={handleSkipMigration} />
        )}
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
