import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Calendar, ShoppingBag, CreditCard, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Transaction, Product, PenjualanDetail, Variant, Ingredient, AdditionalFee } from '../types';
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

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { auth, db, doc, setDoc, deleteDoc, writeBatch, OperationType, handleFirestoreError, serverTimestamp, increment, sanitizeData } from '../lib/firebase';
import { User } from 'firebase/auth';
import { useSettings } from '../SettingsContext';
import { formatSmartUnit } from '../lib/unitUtils';
import { formatCompactNumber, formatCurrency } from '../lib/formatUtils';

import * as XLSX from 'xlsx';

interface TransactionManagerProps {
  user: User | null;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: Product[];
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { name: 'Penjualan', type: 'Pemasukan', fixed: true },
  { name: 'Bahan Baku', type: 'Pengeluaran', fixed: true },
  { name: 'Packing', type: 'Pengeluaran', fixed: true },
  { name: 'Gaji', type: 'Pengeluaran', fixed: true },
  { name: 'Operasional', type: 'Pengeluaran', fixed: true },
  { name: 'Tabungan', type: 'Pengeluaran', fixed: true },
  { name: 'Biaya Iklan', type: 'Pengeluaran', fixed: true },
  { name: 'Saldo sisa', type: 'Pemasukan', fixed: true },
  { name: 'Lainnya', type: 'Pengeluaran', fixed: false },
];

export default function TransactionManager({ user, transactions, setTransactions, products, ingredients, setIngredients, onSuccess }: TransactionManagerProps) {
  const { settings } = useSettings();
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const processingTxRef = React.useRef<Set<string>>(new Set());
  const isUpdatingRef = React.useRef(false); // Execution lock
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('Semua');
  
  const [isMaterialPopoverOpen, setIsMaterialPopoverOpen] = React.useState(false);

  // Dynamic Categories from Settings
  const dynamicCategories = React.useMemo(() => {
    const base = [
      { name: 'Penjualan', type: 'Pemasukan' as const, fixed: true },
      { name: 'Saldo sisa', type: 'Pemasukan' as const, fixed: true },
    ];
    
    // Add categories from settings (HPP groups like Bahan Baku, Packing, Overhead, etc.)
    const hppGroups = settings?.kategori_hpp || [];
    const formattedGroups = hppGroups.map(group => ({
      name: group,
      type: 'Pengeluaran' as const,
      fixed: false
    }));

    const otherFinancial = [
      { name: 'Gaji', type: 'Pengeluaran' as const, fixed: true },
      { name: 'Operasional', type: 'Pengeluaran' as const, fixed: true },
      { name: 'Tabungan', type: 'Pengeluaran' as const, fixed: true },
      { name: 'Biaya Iklan', type: 'Pengeluaran' as const, fixed: true },
      { name: 'Lainnya', type: 'Pengeluaran' as const, fixed: false },
    ];

    // Combine and unique by name to prevent duplicates
    const combined = [...base, ...formattedGroups, ...otherFinancial];
    const uniqueMap = new Map();
    combined.forEach(c => {
      if (!uniqueMap.has(c.name)) uniqueMap.set(c.name, c);
    });
    return Array.from(uniqueMap.values());
  }, [settings]);

  const [txToDelete, setTxToDelete] = React.useState<Transaction | null>(null);
  const [bulkToDelete, setBulkToDelete] = React.useState<string[] | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);
  
  const [newTx, setNewTx] = React.useState<Partial<Transaction>>({
    tanggal: new Date().toISOString().split('T')[0],
    tanggal_akhir: null,
    jenis: 'Pemasukan',
    kategori: 'Penjualan',
    nominal: 0,
    keterangan: '',
    qty_total: 0,
    qty_beli: 0,
    penjualan_detail: []
  });

  const [selectedTxIds, setSelectedTxIds] = React.useState<string[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>('');
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRange, setIsRange] = React.useState(false);

  // Derive selected product IDs from penjualan_detail to prevent double counting and state sync issues
  const selectedProductIds = React.useMemo(() => {
    return newTx.penjualan_detail?.map(pd => pd.produk_id) || [];
  }, [newTx.penjualan_detail]);

  // Helper to process and save a single transaction (used by manual form and import)
  const processAndSaveTransaction = async (txData: any) => {
    if (!user) return;
    
    // Identify affected ingredients and calculate snapshot
    const snapshot: { ingredientId: string; stockBefore: number; delta: number }[] = [];
    const stockUpdates: { id: string; delta: number }[] = [];
    const ingredientIdMap = new Map(ingredients.map(i => [i.id, i]));
    let totalHpp = 0;

    if (txData.jenis === 'Pengeluaran') {
      const matId = txData.materialId || selectedMaterialId;
      if (matId) {
        const material = ingredientIdMap.get(matId);
        if (material) {
          const delta = Number(txData.qty_beli || 0) || 0;
          snapshot.push({ ingredientId: material.id, stockBefore: material.currentStock || 0, delta });
          stockUpdates.push({ id: material.id, delta });
        }
      }
    } else if (txData.jenis === 'Pemasukan' && txData.kategori === 'Penjualan' && txData.penjualan_detail) {
      txData.penjualan_detail.forEach((pd: any) => {
        const product = products.find(p => p.id === pd.produk_id);
        if (product) {
          pd.varian.forEach((pv: any) => {
            if (pv.qty > 0) {
              const variant = product.varian.find(v => v.id === pv.varian_id);
              if (variant) {
                const batchSize = Number(variant.qty_batch) || 1;
                totalHpp += ((variant.harga_packing || 0) / batchSize) * pv.qty;
                if (variant.bahan) {
                  variant.bahan.forEach(bahan => {
                    let ingredient = bahan.ingredientId ? ingredientIdMap.get(bahan.ingredientId) : null;
                    if (!ingredient && bahan.nama) {
                      const normalizedName = bahan.nama.toLowerCase().trim();
                      ingredient = ingredients.find(i => i.name.toLowerCase().trim() === normalizedName);
                    }
                    if (ingredient) {
                      let usageRaw = Number(bahan.qty) || 0;
                      const iUnit = ingredient.unit.toLowerCase().trim();
                      const bUnit = (bahan.satuan || '').toLowerCase().trim();
                      if ((bUnit === 'gram' || bUnit === 'gr' || bUnit === 'g') && 
                          (iUnit === 'kg' || iUnit === 'kilogram')) {
                        usageRaw = usageRaw / 1000;
                      } else if ((bUnit === 'ml' || bUnit === 'mili') && 
                                 (iUnit === 'liter' || iUnit === 'lt' || iUnit === 'l')) {
                        usageRaw = usageRaw / 1000;
                      }
                      const usagePerPcs = usageRaw / batchSize;
                      const totalUsage = usagePerPcs * pv.qty;
                      totalHpp += totalUsage * (ingredient.price || 0);
                      const delta = -totalUsage;
                      const existingSnapshot = snapshot.find(s => s.ingredientId === ingredient!.id);
                      if (existingSnapshot) existingSnapshot.delta += delta;
                      else snapshot.push({ ingredientId: ingredient!.id, stockBefore: ingredient!.currentStock || 0, delta });
                      const existingUpdate = stockUpdates.find(u => u.id === ingredient!.id);
                      if (existingUpdate) existingUpdate.delta += delta;
                      else stockUpdates.push({ id: ingredient!.id, delta });
                    }
                  });
                }
              }
            }
          });
        }
      });
    }

    const txId = Math.random().toString(36).substr(2, 9);
    const isPemasukan = (txData.jenis || 'Pengeluaran') === 'Pemasukan';
    const isPenjualan = isPemasukan && txData.kategori === 'Penjualan';
    const currentNominal = Number(txData.nominal) || 0;
    const currentTotalPenjualan = isPemasukan ? (txData.total_penjualan ?? currentNominal) : 0;
    const saleFees = isPenjualan ? (txData.total_biaya ?? 0) : 0;
    const manualExpense = !isPemasukan ? currentNominal : 0;
    const currentTotalBiaya = isPemasukan ? saleFees : manualExpense;
    const currentLaba = isPemasukan ? (currentTotalPenjualan - currentTotalBiaya) : -currentTotalBiaya;

    const txToSave: any = {
      id: txId,
      userId: user.uid,
      tanggal: txData.tanggal || new Date().toISOString().split('T')[0],
      tanggal_akhir: txData.tanggal_akhir || null,
      keterangan: txData.keterangan || '',
      kategori: txData.kategori || 'Lainnya',
      jenis: txData.jenis || 'Pengeluaran',
      type: (txData.jenis || 'Pengeluaran').toLowerCase(),
      nominal: currentNominal,
      total_penjualan: currentTotalPenjualan,
      total_biaya: currentTotalBiaya,
      laba: currentLaba,
      totalHpp: totalHpp,
      qty_total: txData.qty_total || 0,
      qty_beli: txData.qty_beli || 0,
      createdAt: serverTimestamp(),
      stockSnapshot: snapshot.length > 0 ? snapshot : null
    };

    if (txData.kategori === 'Penjualan' && txData.penjualan_detail) {
      txToSave.penjualan_detail = txData.penjualan_detail.map((pd: any) => {
        const product = products.find(p => p.id === pd.produk_id);
        return {
          ...pd,
          varian: pd.varian.map((pv: any) => {
            const variant = product?.varian.find(v => v.id === pv.varian_id);
            let itemHpp = 0;
            if (variant) {
              const batchSize = Number(variant.qty_batch) || 1;
              const packingPcs = (variant.harga_packing || 0) / batchSize;
              const materialsPcs = variant.bahan?.reduce((acc, b) => {
                let ing = b.ingredientId ? ingredientIdMap.get(b.ingredientId) : null;
                if (!ing && b.nama) ing = ingredients.find(i => i.name.toLowerCase().trim() === b.nama!.toLowerCase().trim());
                if (ing) {
                  let usage = Number(b.qty) || 0;
                  const iUnit = ing.unit.toLowerCase().trim();
                  const bUnit = (b.satuan || '').toLowerCase().trim();
                  if ((bUnit === 'gram' || bUnit === 'gr' || bUnit === 'g') && 
                      (iUnit === 'kg' || iUnit === 'kilogram')) {
                    usage = usage / 1000;
                  } else if ((bUnit === 'ml' || bUnit === 'mili') && 
                             (iUnit === 'liter' || iUnit === 'lt' || iUnit === 'l')) {
                    usage = usage / 1000;
                  }
                  return acc + (usage / batchSize) * (ing.price || 0);
                }
                return acc;
              }, 0) || 0;
              itemHpp = packingPcs + materialsPcs;
            }
            return { ...pv, harga_jual: variant?.harga_jual || 0, hpp_pcs: itemHpp };
          })
        };
      });
    }

    // Optimistic Update
    if (stockUpdates.length > 0) {
      setIngredients(prev => prev.map(ing => {
        const update = stockUpdates.find(u => u.id === ing.id);
        return update ? { ...ing, currentStock: (ing.currentStock || 0) + update.delta } : ing;
      }));
    }
    setTransactions(prev => [txToSave, ...prev]);

    const batch = writeBatch(db);
    batch.set(doc(db, `users/${user.uid}/transaksi/${txId}`), sanitizeData(txToSave));
    stockUpdates.forEach(update => {
      batch.update(doc(db, `users/${user.uid}/stok/${update.id}`), {
        currentStock: increment(update.delta)
      });
    });

    await batch.commit();
    return txToSave;
  };

  const handleShopeeImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Normalisasi SKU: trim + UPPERCASE + hapus spasi
    const normalizeSKU = (val: any): string => {
      return String(val ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
    };

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

        if (rawRows.length === 0) {
          toast.error("File Excel kosong.");
          return;
        }

        // Keywords UPPERCASE — urutan = prioritas tertinggi ke terendah
        const skuPriorityGroups  = [["NOMORREFERENSISKU"], ["SKUINDUK"], ["SELLERSKU"], ["SKU"]];
        const variantKeywords    = ["NAMAVARIASI", "NAMAVARIAN", "VARIASI", "VARIANT", "VARIATION"];
        const qtyKeywords        = ["JUMLAH", "QUANTITY", "QTY"];
        const payKeywords        = ["PEMBAYARANPEMBELI", "DIBAYARPEMBELI", "BUYERPAYMENT", "TOTALPEMBAYARAN"];
        const orderIdKeywords    = ["NO.PESANAN", "NOPESANAN", "NOMORPESANAN", "ORDERID", "ORDERNUMBER", "NOINVOICE", "NOFAKTUR"];
        const dateKeywords       = ["WAKTUPESANANDIBUAT", "TANGGALPEMBAYARAN", "TANGGAL", "ORDERCREATEDDATE", "DATE"];

        // Cari baris header — scan 30 baris pertama untuk kolom SKU & Jumlah
        const allSkuKeywords = skuPriorityGroups.flat();
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
          const rowNorm = rawRows[i].map((c: any) => normalizeSKU(c));
          const hasSkuCol = rowNorm.some((h: string) => h !== '' && allSkuKeywords.some(k => h === k || h.includes(k)));
          const hasQtyCol = rowNorm.some((h: string) => h !== '' && qtyKeywords.some(k => h === k));
          if (hasSkuCol && hasQtyCol) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error("Format Shopee tidak dikenali. Kolom 'Nomor Referensi SKU' atau 'Jumlah' tidak ditemukan.");
          return;
        }

        const headerRow = rawRows[headerRowIndex] as any[];
        const normalizedHeaders = headerRow.map((h: any) => normalizeSKU(h));

        // Cari kolom berdasarkan prioritas: exact match lebih dulu, lalu substring
        const findColIdx = (keywords: string[]): number => {
          let idx = normalizedHeaders.findIndex((h: string) => h !== '' && keywords.includes(h));
          if (idx !== -1) return idx;
          return normalizedHeaders.findIndex((h: string) => h !== '' && keywords.some(k => h.includes(k)));
        };

        // SKU: cari "Nomor Referensi SKU" dulu, baru "SKU Induk", dst.
        const findSkuColIdx = (): number => {
          for (const group of skuPriorityGroups) {
            const idx = findColIdx(group);
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const sIdx    = findSkuColIdx();
        const vIdx    = findColIdx(variantKeywords);
        const qIdx    = findColIdx(qtyKeywords);
        const payIdx  = findColIdx(payKeywords);
        const oidIdx  = findColIdx(orderIdKeywords);
        const dateIdx = findColIdx(dateKeywords);

        if (sIdx === -1 || qIdx === -1) {
          toast.error(`Kolom wajib tidak ditemukan. Header terdeteksi: ${headerRow.slice(0, 10).join(', ')}`);
          return;
        }

        const dataRows = rawRows.slice(headerRowIndex + 1);
        const today = new Date().toISOString().split('T')[0];

        console.log(`[SHOPEE IMPORT] Header row index: ${headerRowIndex}`);
        console.log(`[SHOPEE IMPORT] Kolom SKU: index ${sIdx} → "${headerRow[sIdx]}"`);
        console.log(`[SHOPEE IMPORT] Kolom Qty: index ${qIdx} → "${headerRow[qIdx]}"`);
        console.log(`[SHOPEE IMPORT] Kolom Payment: index ${payIdx} → "${payIdx !== -1 ? headerRow[payIdx] : 'N/A'}"`);
        console.log(`[SHOPEE IMPORT] Kolom Order ID: index ${oidIdx} → "${oidIdx !== -1 ? headerRow[oidIdx] : 'N/A'}"`);
        console.log(`[SHOPEE IMPORT] Total data rows: ${dataRows.length}`);

        // Map SKU database (UPPERCASE)
        const dbProducts = products.map(p => ({ ...p, normSku: normalizeSKU(p.sku) }));
        const dbSkuSet = new Set(dbProducts.filter(p => p.normSku !== '').map(p => p.normSku));

        const missingSku: string[] = [];

        // Helper: parse tanggal dari string Excel
        const parseDate = (val: any): string => {
          if (!val) return today;
          const s = String(val).trim();
          // Format DD/MM/YYYY HH:MM atau DD/MM/YYYY
          const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
          // Format YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          return today;
        };

        // Grouping per Order ID
        // key = orderId, value = { tanggal, totalPayment, items[] }
        type OrderItem = {
          produk_id: string; produk_nama: string;
          varian_id: string; varian_nama: string;
          qty: number; payment: number;
        };
        type OrderGroup = { orderId: string; tanggal: string; totalPayment: number; items: OrderItem[] };
        const orderMap = new Map<string, OrderGroup>();
        let rowSeq = 0; // fallback jika tidak ada Order ID

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i] as any[];

          // Lewati baris kosong
          if (!row || row.every((cell: any) => cell === '' || cell == null)) continue;

          const rawSku = String(row[sIdx] ?? '').trim();
          const normXlsSku = normalizeSKU(rawSku);

          console.log(`[SHOPEE IMPORT] Baris ${i + 1} — SKU: "${normXlsSku}", Match: ${dbSkuSet.has(normXlsSku)}`);

          if (normXlsSku === '') { continue; }

          if (!dbSkuSet.has(normXlsSku)) {
            if (!missingSku.includes(rawSku)) missingSku.push(rawSku);
            continue;
          }

          const qty      = Number(String(row[qIdx]   ?? '0').replace(/[^0-9.]/g, '')) || 0;
          const payment  = payIdx !== -1 ? (Number(String(row[payIdx] ?? '0').replace(/[^0-9.]/g, '')) || 0) : 0;
          const rawVarian = vIdx !== -1 ? String(row[vIdx] ?? '').trim() : '';
          const rawDate  = dateIdx !== -1 ? row[dateIdx] : '';
          const tanggal  = parseDate(rawDate);

          // Order ID: gunakan nilai dari kolom, atau buat fallback unik per baris pertama
          const rawOrderId = oidIdx !== -1 ? String(row[oidIdx] ?? '').trim() : '';
          rowSeq++;
          const orderId = rawOrderId !== '' ? rawOrderId : `AUTO-${rowSeq}`;

          const product = dbProducts.find(p => p.normSku === normXlsSku)!;

          // Cari varian: exact → partial → varian pertama
          let variant = product.varian.find(v => normalizeSKU(v.nama) === normalizeSKU(rawVarian));
          if (!variant && rawVarian) {
            variant = product.varian.find(v =>
              v.nama.toUpperCase().includes(rawVarian.toUpperCase()) ||
              rawVarian.toUpperCase().includes(v.nama.toUpperCase())
            );
          }
          if (!variant && product.varian.length > 0) {
            variant = product.varian[0];
            console.log(`[SHOPEE IMPORT] Varian "${rawVarian}" → fallback: "${variant.nama}"`);
          }
          if (!variant) {
            if (!missingSku.includes(rawSku)) missingSku.push(rawSku);
            continue;
          }

          // Masukkan ke group pesanan
          if (!orderMap.has(orderId)) {
            orderMap.set(orderId, { orderId, tanggal, totalPayment: 0, items: [] });
          }
          const order = orderMap.get(orderId)!;
          order.totalPayment += payment;

          // Jika varian yang sama sudah ada di pesanan ini, tambahkan qty-nya
          const existingItem = order.items.find(
            it => it.produk_id === product.id && it.varian_id === variant!.id
          );
          if (existingItem) {
            existingItem.qty += qty;
            existingItem.payment += payment;
          } else {
            order.items.push({
              produk_id: product.id,
              produk_nama: product.nama,
              varian_id: variant.id,
              varian_nama: variant.nama,
              qty,
              payment
            });
          }
        }

        console.log(`[SHOPEE IMPORT] Total row Excel: ${dataRows.length}`);
        console.log(`[SHOPEE IMPORT] Total pesanan valid: ${orderMap.size}`);
        console.log(`[SHOPEE IMPORT] SKU tidak ditemukan: ${missingSku.length}`, missingSku);

        if (orderMap.size === 0) {
          const skuInDb = [...dbSkuSet].slice(0, 8).join(', ');
          toast.error(
            `0 item cocok. SKU di Excel: ${missingSku.slice(0, 5).join(', ')}. SKU di DB: ${skuInDb || 'Belum ada SKU terdaftar'}`,
            { duration: 10000 }
          );
          return;
        }

        // Buat 1 transaksi per pesanan (Order ID)
        const transactionsToCreate = [...orderMap.values()].map(order => {
          // Ringkasan keterangan: "Shopee #ID: ProdukA (Var1 x10), ProdukB (Var2 x5)"
          const shortId = order.orderId.length > 12 ? order.orderId.slice(-8) : order.orderId;
          const itemSummary = order.items
            .map(it => `${it.produk_nama} (${it.varian_nama} x${it.qty})`)
            .join(', ');
          const keterangan = `Shopee #${shortId}: ${itemSummary}`;

          const totalQty = order.items.reduce((s, it) => s + it.qty, 0);

          // Susun penjualan_detail: gabungkan item per produk
          const produkMap = new Map<string, { produk_id: string; produk_nama: string; varian: { varian_id: string; varian_nama: string; qty: number }[] }>();
          for (const it of order.items) {
            if (!produkMap.has(it.produk_id)) {
              produkMap.set(it.produk_id, { produk_id: it.produk_id, produk_nama: it.produk_nama, varian: [] });
            }
            produkMap.get(it.produk_id)!.varian.push({ varian_id: it.varian_id, varian_nama: it.varian_nama, qty: it.qty });
          }

          return {
            jenis: 'Pemasukan',
            kategori: 'Penjualan',
            tanggal: order.tanggal,
            keterangan,
            nominal: order.totalPayment,
            total_penjualan: order.totalPayment,
            penjualan_detail: [...produkMap.values()],
            qty_total: totalQty
          };
        });

        setIsSaving(true);
        for (const tx of transactionsToCreate) {
          try {
            await processAndSaveTransaction(tx);
          } catch (err) {
            console.error("Gagal save tx:", err);
          }
        }
        setIsSaving(false);

        toast.success(`Import Selesai!`, {
          description: `${transactionsToCreate.length} pesanan berhasil diimport. ${missingSku.length} SKU tidak cocok.`
        });

        if (e.target) e.target.value = '';

      } catch (err) {
        console.error("[IMPORT FATAL] error:", err);
        toast.error("Gagal membaca file Shopee. Pastikan format Excel asli.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredTransactions = transactions
    .filter(t => {
      const matchesSearch = t.keterangan.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'Semua' || t.jenis === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const totalIncome = transactions
    .filter(t => t.jenis === 'Pemasukan')
    .reduce((acc, t) => acc + t.nominal, 0);
  
  const totalExpense = transactions
    .filter(t => t.jenis === 'Pengeluaran')
    .reduce((acc, t) => acc + t.nominal, 0);

  const balance = totalIncome - totalExpense;

  // Handle category change and auto-type
  const handleCategoryChange = (catName: string) => {
    const cat = dynamicCategories.find(c => c.name === catName);
    if (cat) {
      setNewTx(prev => ({
        ...prev,
        kategori: catName,
        jenis: cat.type as 'Pemasukan' | 'Pengeluaran',
        // Reset fields when category changes
        qty_beli: 0,
        nominal: catName === 'Penjualan' ? prev.nominal : 0,
        penjualan_detail: catName === 'Penjualan' ? prev.penjualan_detail : []
      }));
      setSelectedMaterialId('');
    }
  };

  // Auto-nominal for Bahan Baku and Packing
  React.useEffect(() => {
    const isHppCategory = settings?.kategori_hpp.includes(newTx.kategori || '');
    if (isHppCategory && selectedMaterialId) {
      const material = ingredients.find(i => i.id === selectedMaterialId);
      if (material) {
        setNewTx(prev => ({
          ...prev,
          nominal: (prev.qty_beli || 0) * material.price,
          keterangan: `${prev.kategori}: ${material.name} (${formatSmartUnit(prev.qty_beli || 0, material.unit)})`
        }));
      }
    }
  }, [selectedMaterialId, newTx.qty_beli, newTx.kategori, ingredients, settings]);

  // Calculate total qty and estimated revenue from penjualan_detail
  React.useEffect(() => {
    if (newTx.kategori === 'Penjualan' && newTx.penjualan_detail) {
      let totalQty = 0;
      let subtotal = 0;
      
      const involvedProductIds = new Set<string>();

      // Use a Map to aggregate totals per variant to prevent any potential double counting from state drift
      const qtyByVariantId = new Map<string, number>();
      
      newTx.penjualan_detail.forEach(pd => {
        involvedProductIds.add(pd.produk_id);
        pd.varian.forEach(v => {
          const current = qtyByVariantId.get(v.varian_id) || 0;
          qtyByVariantId.set(v.varian_id, current + v.qty);
        });
      });

      // Calculate totals from the aggregated map
      qtyByVariantId.forEach((qty, variantId) => {
        totalQty += qty;
        // Find variant in products
        let found = false;
        for (const p of products) {
          const variant = p.varian.find(v => v.id === variantId);
          if (variant) {
            subtotal += qty * variant.harga_jual;
            found = true;
            break; // Stop after finding the variant to prevent any potential double counting from schema errors
          }
        }
      });

      // Calculate Fees (once per unique fee name across all involved products)
      const feesByName = new Map<string, AdditionalFee>();
      involvedProductIds.forEach(pid => {
        const product = products.find(p => p.id === pid);
        if (product && product.biaya_lain) {
          product.biaya_lain.forEach(fee => {
            if (!feesByName.has(fee.nama)) {
              feesByName.set(fee.nama, fee);
            }
          });
        }
      });

      let totalFees = 0;
      feesByName.forEach(fee => {
        if (fee.tipe === 'persen') {
          totalFees += subtotal * (fee.nilai / 100);
        } else {
          totalFees += fee.nilai;
        }
      });

      setNewTx(prev => ({ 
        ...prev, 
        qty_total: totalQty, 
        nominal: subtotal - totalFees,
        total_penjualan: subtotal,
        total_biaya: totalFees
      }));
    }
  }, [newTx.penjualan_detail, newTx.kategori, products]);

  const toggleProduct = (productId: string) => {
    setNewTx(prev => {
      const isSelected = prev.penjualan_detail?.some(pd => pd.produk_id === productId);
      if (isSelected) {
        return {
          ...prev,
          penjualan_detail: prev.penjualan_detail?.filter(pd => pd.produk_id !== productId)
        };
      } else {
        const product = products.find(p => p.id === productId);
        if (!product) return prev;
        
        // Prevent duplicate entries by checking if it already exists
        if (prev.penjualan_detail?.some(pd => pd.produk_id === productId)) return prev;

        const newDetail: PenjualanDetail = {
          produk_id: product.id,
          produk_nama: product.nama,
          varian: product.varian.map(v => ({ varian_id: v.id, varian_nama: v.nama, qty: 0 }))
        };
        return {
          ...prev,
          penjualan_detail: [...(prev.penjualan_detail || []), newDetail]
        };
      }
    });
  };

  const handleVariantQtyChange = (productId: string, variantId: string, qty: number) => {
    setNewTx(prev => ({
      ...prev,
      penjualan_detail: prev.penjualan_detail?.map(pd => {
        if (pd.produk_id === productId) {
          return {
            ...pd,
            varian: pd.varian.map(v => v.varian_id === variantId ? { ...v, qty } : v)
          };
        }
        return pd;
      })
    }));
  };

  const handleAddTransaction = async () => {
    if (isSaving) return;
    if (!newTx.keterangan || (!newTx.nominal && newTx.kategori !== 'Penjualan')) {
      toast.error('Mohon isi keterangan dan nominal!');
      return;
    }

    if (isUpdatingRef.current) {
      console.warn("[TransactionManager] Double Execution Blocked!");
      return; 
    }

    console.log("[TransactionManager] Starting handleAddTransaction manual save...");
    isUpdatingRef.current = true;
    setIsSaving(true);
    
    try {
      await processAndSaveTransaction(newTx);
      toast.success('Transaksi disimpan ✓');
      
      // Reset State & UI
      setNewTx({
        tanggal: new Date().toISOString().split('T')[0],
        tanggal_akhir: null,
        nominal: 0,
        keterangan: '',
        kategori: 'Lainnya',
        jenis: 'Pengeluaran',
        qty_beli: 1,
        qty_total: 0,
        penjualan_detail: []
      });
      setSelectedMaterialId('');
      setSelectedTxIds([]);
      setIsRange(false);
      if (onSuccess) onSuccess();

      // Refocus to date input
      setTimeout(() => {
        dateInputRef.current?.focus();
      }, 100);

    } catch (error) {
      console.error("[TransactionManager] Error in handleAddTransaction:", error);
      toast.error('Gagal menyimpan transaksi');
    } finally {
      setIsSaving(false);
      isUpdatingRef.current = false;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    const tx = transactions.find(t => t.id === id);
    if (tx && tx.stockSnapshot && tx.stockSnapshot.length > 0) {
      setTxToDelete(tx);
      setIsDeleteConfirmOpen(true);
    } else {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/transaksi/${id}`));
        setTransactions(prev => prev.filter(t => t.id !== id));
        setSelectedTxIds(prev => prev.filter(selectedId => selectedId !== id));
        toast.success('Transaksi dihapus');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/${id}`);
        toast.error('Gagal menghapus transaksi. Coba lagi.');
      }
    }
  };

  const confirmDelete = async (rollback: boolean) => {
    if (!txToDelete || !user) return;
    setIsDeleting(true);
    setIsDeleteConfirmOpen(false);
    const txId = txToDelete.id;
    const txSnapshot = txToDelete;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${user.uid}/transaksi/${txId}`));

      if (rollback && txSnapshot.stockSnapshot) {
        txSnapshot.stockSnapshot.forEach(snap => {
          batch.update(doc(db, `users/${user.uid}/stok/${snap.ingredientId}`), {
            currentStock: snap.stockBefore
          });
        });
      }

      await batch.commit();

      setTransactions(prev => prev.filter(t => t.id !== txId));
      setSelectedTxIds(prev => prev.filter(id => id !== txId));

      if (rollback && txSnapshot.stockSnapshot) {
        setIngredients(prev => prev.map(ing => {
          const snap = txSnapshot.stockSnapshot?.find(s => s.ingredientId === ing.id);
          if (snap) return { ...ing, currentStock: snap.stockBefore };
          return ing;
        }));
        toast.success('Transaksi & Stok dipulihkan ✓');
      } else {
        toast.success('Transaksi dihapus ✓');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/${txId}`);
      toast.error('Gagal menghapus transaksi. Data tidak berubah.');
    } finally {
      setIsDeleting(false);
      setTxToDelete(null);
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.length === filteredTransactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.length === 0 || !user) return;

    const selectedTxs = transactions.filter(t => selectedTxIds.includes(t.id));
    const hasSnapshot = selectedTxs.some(t => t.stockSnapshot && t.stockSnapshot.length > 0);

    if (hasSnapshot) {
      setBulkToDelete(selectedTxIds);
      setIsBulkDeleteConfirmOpen(true);
    } else {
      const idsToDelete = [...selectedTxIds];
      const toastId = toast.loading(`Menghapus ${idsToDelete.length} transaksi...`);
      try {
        const batch = writeBatch(db);
        idsToDelete.forEach(id => {
          batch.delete(doc(db, `users/${user.uid}/transaksi/${id}`));
        });
        await batch.commit();
        setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
        setSelectedTxIds([]);
        toast.success(`${idsToDelete.length} transaksi berhasil dihapus`, { id: toastId });
      } catch (error) {
        toast.dismiss(toastId);
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/bulk`);
        toast.error('Gagal menghapus transaksi. Data tidak berubah.');
      }
    }
  };

  const confirmBulkDelete = async (rollback: boolean) => {
    if (!bulkToDelete || !user) return;
    setIsDeleting(true);
    const idsToDelete = [...bulkToDelete];
    const toastId = toast.loading(rollback ? 'Mengembalikan stok massal...' : 'Menghapus transaksi massal...');

    try {
      const selectedTxs = transactions.filter(t => idsToDelete.includes(t.id));
      const batch = writeBatch(db);

      idsToDelete.forEach(id => {
        batch.delete(doc(db, `users/${user.uid}/transaksi/${id}`));
      });

      if (rollback) {
        ingredients.forEach(ing => {
          const totalDelta = selectedTxs.reduce((acc, t) => {
            const snapshot = t.stockSnapshot?.find(s => s.ingredientId === ing.id);
            return acc + (snapshot?.delta || 0);
          }, 0);
          if (totalDelta !== 0) {
            batch.update(doc(db, `users/${user.uid}/stok/${ing.id}`), {
              currentStock: increment(-totalDelta)
            });
          }
        });
      }

      await batch.commit();

      setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
      setSelectedTxIds([]);

      if (rollback) {
        setIngredients(prev => prev.map(ing => {
          const totalDelta = selectedTxs.reduce((acc, t) => {
            const snapshot = t.stockSnapshot?.find(s => s.ingredientId === ing.id);
            return acc + (snapshot?.delta || 0);
          }, 0);
          if (totalDelta !== 0) return { ...ing, currentStock: ing.currentStock - totalDelta };
          return ing;
        }));
        toast.success(`${idsToDelete.length} transaksi dihapus dan stok berhasil dikembalikan ✓`, { id: toastId });
      } else {
        toast.success(`${idsToDelete.length} transaksi dihapus ✓`, { id: toastId });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transaksi/bulk`);
      toast.error('Gagal menghapus transaksi massal. Data tidak berubah.', { id: toastId });
    } finally {
      setIsBulkDeleteConfirmOpen(false);
      setBulkToDelete(null);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1A1A2E]">Transaksi</h2>
          <p className="text-gray-500 font-medium">Catat pemasukan & pengeluaran.</p>
        </div>
      </div>

      {/* Wallet Balance Summary */}
      <div className="wallet-gradient rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 text-white shadow-2xl shadow-red-200 border-b-4 border-red-800/10 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-colors" />
        <div className="flex items-center gap-4 w-full md:w-auto relative z-10">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl glass-card flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Saldo</p>
            <h3 className="text-2xl md:text-4xl font-black truncate">{formatCurrency(balance, true)}</h3>
          </div>
        </div>
        <div className="flex gap-3 md:gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
            <p className="text-[9px] font-bold uppercase opacity-70 mb-1">Pemasukan</p>
            <p className="text-base md:text-xl font-black text-green-300">{formatCurrency(totalIncome, true)}</p>
          </div>
          <div className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
            <p className="text-[9px] font-bold uppercase opacity-70 mb-1">Pengeluaran</p>
            <p className="text-base md:text-xl font-black text-red-300">{formatCurrency(totalExpense, true)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Form */}
        <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Catat Transaksi</CardTitle>
            <CardDescription>Input data keuangan baru</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-gray-400 uppercase">Tanggal</Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="range-toggle"
                    checked={isRange}
                    onChange={(e) => {
                      setIsRange(e.target.checked);
                      if (e.target.checked && !newTx.tanggal_akhir) {
                        setNewTx(prev => ({ ...prev, tanggal_akhir: prev.tanggal }));
                      }
                    }}
                    className="w-3 h-3 rounded border-gray-200 text-primary focus:ring-primary"
                  />
                  <label htmlFor="range-toggle" className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">Rentang</label>
                </div>
              </div>
              <div className={cn("grid gap-2", isRange ? "grid-cols-2" : "grid-cols-1")}>
                <Input 
                  ref={dateInputRef}
                  type="date" 
                  value={newTx.tanggal}
                  onChange={(e) => setNewTx({...newTx, tanggal: e.target.value})}
                  className="rounded-xl border-gray-100"
                />
                {isRange && (
                  <Input 
                    type="date" 
                    value={newTx.tanggal_akhir || newTx.tanggal}
                    onChange={(e) => setNewTx({...newTx, tanggal_akhir: e.target.value})}
                    className="rounded-xl border-gray-100"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Kategori</Label>
                <Select 
                  value={newTx.kategori} 
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="rounded-xl border-gray-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {dynamicCategories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase">Jenis</Label>
                <Select 
                  value={newTx.jenis} 
                  onValueChange={(val: any) => setNewTx({...newTx, jenis: val})}
                  disabled={dynamicCategories.find(c => c.name === newTx.kategori)?.fixed}
                >
                  <SelectTrigger className="rounded-xl border-gray-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="Pengeluaran">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newTx.kategori === 'Penjualan' && (
              <div className="space-y-4 pt-2 border-t border-dashed border-gray-100">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Langkah 1: Pilih Produk</Label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      id="shopee-import" 
                      onChange={handleShopeeImport}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById('shopee-import')?.click()}
                      className="text-[10px] h-7 font-black text-primary hover:bg-brand-50 gap-1.5 px-2 rounded-lg border border-primary/20"
                    >
                      <ShoppingBag className="w-3 h-3 text-primary" />
                      Import Shopee (XLS)
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {products.map(p => (
                    <Button
                      key={p.id}
                      variant={selectedProductIds.includes(p.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleProduct(p.id)}
                      className={cn(
                        "rounded-xl font-bold transition-all",
                        selectedProductIds.includes(p.id) ? "bg-primary text-white border-none" : "border-gray-100 text-gray-500"
                      )}
                    >
                      {p.nama}
                    </Button>
                  ))}
                </div>

                {selectedProductIds.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <Label className="text-xs font-bold text-gray-400 uppercase">Langkah 2: Isi Qty per Varian</Label>
                    {selectedProductIds.map(pid => {
                      const product = products.find(p => p.id === pid);
                      const detail = newTx.penjualan_detail?.find(pd => pd.produk_id === pid);
                      if (!product) return null;
                      return (
                        <div key={pid} className="space-y-2 p-3 bg-gray-50 rounded-2xl">
                          <p className="text-xs font-black text-[#1A1A2E] flex items-center gap-2">
                            <Package className="w-3 h-3 text-primary" />
                            {product.nama}
                          </p>
                          <div className="space-y-2">
                            {product.varian.map(v => (
                              <div key={v.id} className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-gray-500">{v.nama}</span>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={detail?.varian.find(vv => vv.varian_id === v.id)?.qty || ''}
                                    onChange={(e) => handleVariantQtyChange(pid, v.id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8 rounded-lg border-gray-200 text-right font-bold text-xs"
                                  />
                                  <span className="text-[10px] font-bold text-gray-400">pcs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {settings?.kategori_hpp.includes(newTx.kategori || '') && (
              <div className="space-y-4 pt-2 border-t border-dashed border-gray-100">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Pilih Bahan Baku / Packing</Label>
                  <Popover open={isMaterialPopoverOpen} onOpenChange={setIsMaterialPopoverOpen}>
                    <PopoverTrigger 
                      render={
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isMaterialPopoverOpen}
                          className="w-full justify-between rounded-xl border-gray-100 font-bold h-10 px-3 overflow-hidden"
                        />
                      }
                    >
                      {selectedMaterialId
                        ? ingredients.find((i) => i.id === selectedMaterialId)?.name
                        : "Cari bahan..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl shadow-2xl border-none z-50" align="start" sideOffset={5}>
                      <Command className="rounded-xl">
                        <CommandInput placeholder="Ketik nama bahan..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Bahan tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {ingredients
                              .filter(i => {
                                // Dynamic filtering based on category
                                const txCat = newTx.kategori || '';
                                const ingCat = i.category || '';
                                if (txCat === 'Packing') return ingCat === 'Packing';
                                if (txCat === 'Bahan Baku') return ingCat === 'Kulit Cireng' || ingCat === 'Bahan Isian';
                                return ingCat.toLowerCase().trim() === txCat.toLowerCase().trim();
                              })
                              .map((i) => (
                                <CommandItem
                                  key={i.id}
                                  value={i.name}
                                  onSelect={() => {
                                    setSelectedMaterialId(i.id);
                                    // Auto-fill logic
                                    setNewTx(prev => ({
                                      ...prev,
                                      keterangan: `Beli ${i.name}`,
                                      nominal: (prev.qty_beli || 1) * i.price,
                                      qty_beli: prev.qty_beli || 1
                                    }));
                                    setIsMaterialPopoverOpen(false);
                                  }}
                                  className="font-medium"
                                >
                                  {i.name}
                                  <Badge variant="outline" className="ml-2 text-[8px] border-none bg-brand-50 text-primary">
                                    {i.unit}
                                  </Badge>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase">Jumlah Beli</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={newTx.qty_beli || ''}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const material = ingredients.find(m => m.id === selectedMaterialId);
                        setNewTx(prev => ({
                          ...prev,
                          qty_beli: qty,
                          nominal: material ? qty * material.price : prev.nominal
                        }));
                      }}
                      className="rounded-xl border-gray-100"
                    />
                    <span className="text-xs font-bold text-gray-400">
                      {ingredients.find(i => i.id === selectedMaterialId)?.unit || ''}
                    </span>
                  </div>
                  {selectedMaterialId && (
                    <p className="text-[10px] font-bold text-gray-400 mt-1">
                      Konversi: {formatSmartUnit(newTx.qty_beli || 0, ingredients.find(i => i.id === selectedMaterialId)?.unit || '')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {newTx.kategori === 'Saldo sisa' && (
              <div className="space-y-2 pt-2 border-t border-dashed border-gray-100">
                <Label className="text-xs font-bold text-gray-400 uppercase">Qty (Opsional)</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={newTx.qty_beli || ''}
                  onChange={(e) => setNewTx({...newTx, qty_beli: Number(e.target.value)})}
                  className="rounded-xl border-gray-100"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase">Keterangan</Label>
              <Input 
                placeholder="Contoh: Penjualan 50 pcs" 
                value={newTx.keterangan}
                onChange={(e) => setNewTx({...newTx, keterangan: e.target.value})}
                className="rounded-xl border-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase">Nominal (Rp)</Label>
              <Input 
                type="number" 
                placeholder="0" 
                value={newTx.nominal || ''}
                onChange={(e) => setNewTx({...newTx, nominal: Number(e.target.value)})}
                className="rounded-xl border-gray-100 font-black text-lg"
              />
              <p className="text-[10px] text-gray-400 italic">
                {newTx.kategori === 'Penjualan' || settings?.kategori_hpp.includes(newTx.kategori || '')
                  ? '*Nominal terhitung otomatis, namun tetap bisa Anda ubah manual' 
                  : '*Masukkan nominal transaksi'}
              </p>
            </div>

            <Button 
              onClick={handleAddTransaction}
              disabled={isSaving}
              className="w-full orange-gradient text-white font-bold h-14 rounded-2xl shadow-lg shadow-brand-200 mt-4 active:scale-95 transition-all hover:shadow-xl"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
            </Button>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-gray-200 text-primary focus:ring-primary"
                checked={filteredTransactions.length > 0 && selectedTxIds.length === filteredTransactions.length}
                onChange={toggleSelectAll}
              />
              <div>
                <CardTitle className="text-lg font-bold">Riwayat Transaksi</CardTitle>
                <CardDescription>Daftar aktivitas keuangan</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedTxIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  className="rounded-xl font-bold gap-2 animate-in fade-in slide-in-from-right-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selectedTxIds.length})
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-xl border-gray-100">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Cari transaksi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-gray-100"
              />
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
              {filteredTransactions.map((t) => (
                <div 
                  key={t.id} 
                  className={cn(
                    "group flex flex-col p-4 rounded-2xl transition-all border-2",
                    selectedTxIds.includes(t.id) 
                      ? "bg-brand-50 border-brand-200 shadow-sm" 
                      : "bg-gray-50 border-transparent hover:bg-brand-50/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-1">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded-lg border-gray-200 text-primary focus:ring-primary cursor-pointer"
                          checked={selectedTxIds.includes(t.id)}
                          onChange={() => toggleSelectTx(t.id)}
                        />
                      </div>
                      <div className={cn(
                        "p-2.5 rounded-2xl shrink-0 transition-transform group-hover:scale-110 duration-300",
                        t.jenis === 'Pemasukan' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                      )}>
                        {t.jenis === 'Pemasukan' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#1A1A2E] text-sm md:text-base leading-tight mb-1">{t.keterangan}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-black border-none bg-white text-gray-400 uppercase px-2 py-0.5">
                            {t.kategori}
                          </Badge>
                          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t.tanggal_akhir ? `${t.tanggal} - ${t.tanggal_akhir}` : t.tanggal}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <p className={cn(
                        "font-black text-base md:text-lg leading-none",
                        t.jenis === 'Pemasukan' ? "text-green-600" : "text-red-500"
                      )}>
                        {t.jenis === 'Pemasukan' ? '+' : '-'} Rp{formatCompactNumber(t.nominal)}
                      </p>
                      {t.qty_total > 0 && <p className="text-[10px] font-bold text-gray-400 mt-1">{t.qty_total} pcs terjual</p>}
                      {t.qty_beli > 0 && (
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          Ref: {(() => {
                            const snapshot = t.stockSnapshot?.[0];
                            const ingredient = snapshot ? ingredients.find(i => i.id === snapshot.ingredientId) : ingredients.find(i => i.name === t.keterangan.replace('Beli ', ''));
                            return formatSmartUnit(t.qty_beli, ingredient?.unit || 'gram');
                          })()}
                        </p>
                      )}
                      <div className="mt-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteTransaction(t.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {t.penjualan_detail && t.penjualan_detail.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                      {Array.from(new Map(t.penjualan_detail.map(pd => [pd.produk_id, pd])).values()).map((pd, pdIdx) => (
                        <div key={`${pd.produk_id}-${pdIdx}`} className="text-[10px] text-gray-500 bg-white/50 p-1.5 rounded-lg border border-gray-100/50 flex items-start gap-1.5">
                          <Package className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-black text-[#1A1A2E]">{pd.produk_nama}: </span>
                            <span className="font-medium">
                              {pd.varian.filter(v => v.qty > 0).map(v => `${v.varian_nama} (${v.qty})`).join(', ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold">Tidak ada transaksi ditemukan</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Konfirmasi Penghapusan</DialogTitle>
            <DialogDescription className="font-medium">
              Apakah stok bahan baku ingin dikembalikan ke kondisi sebelum transaksi ini terjadi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => confirmDelete(false)}
              disabled={isDeleting}
              className="rounded-2xl font-bold h-12 flex-1"
            >
              Tidak, Biarkan Stok
            </Button>
            <Button 
              onClick={() => confirmDelete(true)}
              disabled={isDeleting}
              className="orange-gradient text-white font-bold rounded-2xl h-12 flex-1 shadow-lg shadow-brand-200"
            >
              {isDeleting ? 'Memproses...' : 'Ya, Kembalikan Stok'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Hapus Massal ({bulkToDelete?.length})</DialogTitle>
            <DialogDescription className="font-medium">
              Apakah stok bahan baku ingin dikembalikan ke kondisi sebelum transaksi-transaksi ini terjadi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => confirmBulkDelete(false)}
              disabled={isDeleting}
              className="rounded-2xl font-bold h-12 flex-1"
            >
              Tidak, Biarkan Stok
            </Button>
            <Button 
              onClick={() => confirmBulkDelete(true)}
              disabled={isDeleting}
              className="orange-gradient text-white font-bold rounded-2xl h-12 flex-1 shadow-lg shadow-brand-200"
            >
              {isDeleting ? 'Memproses...' : 'Ya, Kembalikan Stok'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
