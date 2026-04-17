
export type Ingredient = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  initialStock: number;
  currentStock: number;
  minStock: number;
  fromHpp?: boolean;
};

export type HppMaterial = {
  id?: string;
  ingredientId?: string;
  nama: string;
  satuan: string;
  qty: number;
  harga: number;
  kelompok: string;
};

export type Variant = {
  id: string;
  nama: string;
  harga_jual: number;
  qty_batch: number;
  harga_packing: number;
  bahan: HppMaterial[];
};

export type AdditionalFee = {
  nama: string;
  tipe: 'persen' | 'nominal';
  nilai: number;
};

export type Product = {
  id: string;
  nama: string;
  deskripsi?: string;
  varian: Variant[];
  biaya_lain?: AdditionalFee[];
};

export type PenjualanVarian = {
  varian_id: string;
  varian_nama: string;
  qty: number;
};

export type PenjualanDetail = {
  produk_id: string;
  produk_nama: string;
  varian: PenjualanVarian[];
};

export type Transaction = {
  id: string;
  tanggal: string;
  tanggal_akhir?: string | null;
  keterangan: string;
  kategori: string;
  jenis: 'Pemasukan' | 'Pengeluaran';
  type?: 'pemasukan' | 'pengeluaran'; // Alias for compatibility
  nominal: number;
  total_penjualan?: number;
  total_biaya?: number;
  laba?: number;
  qty_total: number;
  qty_beli: number;
  penjualan_detail?: PenjualanDetail[];
  stockSnapshot?: { ingredientId: string; stockBefore: number; delta: number }[];
  createdAt?: any;
};

export type KategoriSettings = {
  kategori_hpp: string[];
  kategori_produk: string[];
  satuan_unit: string[];
};

export type StoreSettings = {
  logo?: string;
  name: string;
  tagline?: string;
  phone?: string;
  address?: string;
  showLogoOnReceipt: boolean;
  showNameOnReceipt: boolean;
  showAddressOnReceipt: boolean;
  showLogoInHeader: boolean;
  showLogoInSidebar: boolean;
  receiptFooter?: string;
  onboardingCompleted?: boolean;
};
