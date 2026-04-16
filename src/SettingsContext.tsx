import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, doc, onSnapshot, setDoc, OperationType, handleFirestoreError } from './lib/firebase';
import { KategoriSettings } from './types';

interface SettingsContextType {
  settings: KategoriSettings | null;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const DEFAULT_KATEGORI: KategoriSettings = {
  kategori_hpp: ["Kulit Cireng", "Bahan Isian", "Packing", "Overhead"],
  kategori_produk: ["Makanan", "Snack", "Minuman"],
  satuan_unit: ["Gram", "Pcs", "Box", "Liter", "Kg", "Lembar"]
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<KategoriSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const ref = doc(db, `users/${user.uid}/settings/kategori`);
        const unsubSnapshot = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as KategoriSettings);
          } else {
            // Initialize with defaults if not exists
            setDoc(ref, DEFAULT_KATEGORI).catch(err => 
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/settings/kategori`)
            );
            setSettings(DEFAULT_KATEGORI);
          }
          setIsLoading(false);
        }, (error) => {
          console.error('Settings sync error:', error);
          setIsLoading(false);
        });
        return () => unsubSnapshot();
      } else {
        setSettings(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
