
import { Ingredient, Product, Transaction, HppMaterial } from '../types';

const KULIT_MATERIALS: HppMaterial[] = [
  { nama: 'Tapioka', satuan: 'gram', qty: 2500, harga: 10, kelompok: 'Kulit' },
  { nama: 'Terigu', satuan: 'gram', qty: 150, harga: 10, kelompok: 'Kulit' },
  { nama: 'Tepung Beras', satuan: 'gram', qty: 45, harga: 16, kelompok: 'Kulit' },
  { nama: 'Minyak Goreng', satuan: 'ml', qty: 320, harga: 20, kelompok: 'Kulit' },
  { nama: 'Penyedap', satuan: 'pcs', qty: 6, harga: 500, kelompok: 'Kulit' },
];

const ISIAN_MATERIALS: HppMaterial[] = [
  { nama: 'Ayam', satuan: 'gram', qty: 1000, harga: 34, kelompok: 'Isian' },
  { nama: 'Minyak Goreng', satuan: 'ml', qty: 600, harga: 20, kelompok: 'Isian' },
  { nama: 'Jahe', satuan: 'pcs', qty: 1, harga: 500, kelompok: 'Isian' },
  { nama: 'Cabe Keriting', satuan: 'gram', qty: 50, harga: 120, kelompok: 'Isian' },
  { nama: 'Cabe Jablay', satuan: 'gram', qty: 250, harga: 80, kelompok: 'Isian' },
  { nama: 'Cabe Merah Besar', satuan: 'gram', qty: 100, harga: 35, kelompok: 'Isian' },
  { nama: 'Bawang Merah', satuan: 'gram', qty: 30, harga: 100, kelompok: 'Isian' },
  { nama: 'Bawang Putih', satuan: 'gram', qty: 20, harga: 100, kelompok: 'Isian' },
  { nama: 'Gula Merah', satuan: 'gram', qty: 15, harga: 25, kelompok: 'Isian' },
  { nama: 'Gula Pasir', satuan: 'gram', qty: 43, harga: 20, kelompok: 'Isian' },
  { nama: 'Chili Oil', satuan: 'pcs', qty: 24, harga: 500, kelompok: 'Isian' },
  { nama: 'Daun Jeruk', satuan: 'paket', qty: 1, harga: 500, kelompok: 'Isian' },
  { nama: 'Sasa / MSG', satuan: 'gram', qty: 5, harga: 100, kelompok: 'Isian' },
];

const PACKING_MATERIALS: HppMaterial[] = [
  { nama: 'Kertas Thermal', satuan: 'unit', qty: 25, harga: 83, kelompok: 'Packing' },
  { nama: 'Plastik Chili Oil 6x8', satuan: 'unit', qty: 25, harga: 250, kelompok: 'Packing' },
  { nama: 'Plastik Vakum 17x25', satuan: 'unit', qty: 25, harga: 450, kelompok: 'Packing' },
  { nama: 'Stiker Label', satuan: 'unit', qty: 25, harga: 400, kelompok: 'Packing' },
  { nama: 'Bubble Wrap', satuan: 'pcs', qty: 25, harga: 650, kelompok: 'Packing' },
];

const OVERHEAD_MATERIALS: HppMaterial[] = [
  { nama: 'Gas', satuan: 'unit', qty: 100, harga: 10, kelompok: 'Overhead' },
  { nama: 'Kertas Nasi', satuan: 'unit', qty: 256, harga: 2, kelompok: 'Overhead' },
  { nama: 'Sabun Cuci Piring', satuan: 'unit', qty: 50, harga: 20, kelompok: 'Overhead' },
  { nama: 'Listrik', satuan: 'unit', qty: 12, harga: 10, kelompok: 'Overhead' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod_1",
    nama: "Cireng Isi",
    deskripsi: "Cireng goreng dengan berbagai isian",
    varian: [
      {
        id: "var_1",
        nama: "Ayam Ori",
        harga_jual: 1100,
        qty_batch: 25,
        harga_packing: 0,
        bahan: [
          ...KULIT_MATERIALS,
          ...ISIAN_MATERIALS,
          ...PACKING_MATERIALS,
          ...OVERHEAD_MATERIALS,
        ]
      },
      {
        id: "var_2",
        nama: "Ayam Pedas",
        harga_jual: 1100,
        qty_batch: 25,
        harga_packing: 0,
        bahan: [
          ...KULIT_MATERIALS,
          ...ISIAN_MATERIALS,
          ...PACKING_MATERIALS,
          ...OVERHEAD_MATERIALS,
        ]
      },
      {
        id: "var_3",
        nama: "Keju",
        harga_jual: 1200,
        qty_batch: 25,
        harga_packing: 0,
        bahan: [
          ...KULIT_MATERIALS,
          { nama: 'Isian Keju', satuan: 'gram', qty: 500, harga: 40, kelompok: 'Isian' },
          { nama: 'Keju Kraft', satuan: 'gram', qty: 100, harga: 80, kelompok: 'Isian' },
          ...PACKING_MATERIALS,
          ...OVERHEAD_MATERIALS,
        ]
      },
      {
        id: "var_4",
        nama: "Jando",
        harga_jual: 1200,
        qty_batch: 25,
        harga_packing: 0,
        bahan: [
          ...KULIT_MATERIALS,
          { nama: 'Isian Jando', satuan: 'gram', qty: 750, harga: 50, kelompok: 'Isian' },
          ...PACKING_MATERIALS,
          ...OVERHEAD_MATERIALS,
        ]
      },
      {
        id: "var_5",
        nama: "Bakso",
        harga_jual: 1000,
        qty_batch: 25,
        harga_packing: 0,
        bahan: [
          ...KULIT_MATERIALS,
          { nama: 'Isian Bakso', satuan: 'gram', qty: 750, harga: 22, kelompok: 'Isian' },
          ...PACKING_MATERIALS,
          ...OVERHEAD_MATERIALS,
        ]
      }
    ]
  },
  {
    id: "prod_2",
    nama: "Cireng 10 pcs",
    deskripsi: "Paket hemat 10 pcs cireng isi",
    varian: [
      {
        id: "var_6",
        nama: "Mix",
        harga_jual: 11000,
        qty_batch: 145,
        harga_packing: 12000,
        bahan: []
      }
    ]
  }
];

export const CATEGORIES_LIST = [
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

export const INITIAL_INGREDIENTS: Ingredient[] = [
  // BAHAN KULIT
  { id: '1', name: 'Tapioka', category: 'Kulit Cireng', unit: 'gram', price: 10, initialStock: 5000, currentStock: 5000, minStock: 1000 },
  { id: '2', name: 'Terigu', category: 'Kulit Cireng', unit: 'gram', price: 10, initialStock: 1000, currentStock: 1000, minStock: 500 },
  { id: '3', name: 'Tepung Beras', category: 'Kulit Cireng', unit: 'gram', price: 16, initialStock: 500, currentStock: 500, minStock: 200 },
  { id: '4', name: 'Minyak Goreng', category: 'Kulit Cireng', unit: 'ml', price: 20, initialStock: 2000, currentStock: 2000, minStock: 500 },
  { id: '5', name: 'Penyedap', category: 'Kulit Cireng', unit: 'pcs', price: 500, initialStock: 50, currentStock: 50, minStock: 10 },
  
  // BAHAN ISIAN
  { id: '11', name: 'Ayam', category: 'Bahan Isian', unit: 'gram', price: 34, initialStock: 5000, currentStock: 5000, minStock: 1000 },
  { id: '12', name: 'Jahe', category: 'Bahan Isian', unit: 'pcs', price: 500, initialStock: 10, currentStock: 10, minStock: 2 },
  { id: '13', name: 'Cabe Keriting', category: 'Bahan Isian', unit: 'gram', price: 120, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '14', name: 'Cabe Jablay', category: 'Bahan Isian', unit: 'gram', price: 80, initialStock: 1000, currentStock: 1000, minStock: 200 },
  { id: '15', name: 'Cabe Merah Besar', category: 'Bahan Isian', unit: 'gram', price: 35, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '16', name: 'Bawang Merah', category: 'Bahan Isian', unit: 'gram', price: 100, initialStock: 1000, currentStock: 1000, minStock: 200 },
  { id: '17', name: 'Bawang Putih', category: 'Bahan Isian', unit: 'gram', price: 100, initialStock: 1000, currentStock: 1000, minStock: 200 },
  { id: '18', name: 'Gula Merah', category: 'Bahan Isian', unit: 'gram', price: 25, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '19', name: 'Gula Pasir', category: 'Bahan Isian', unit: 'gram', price: 20, initialStock: 1000, currentStock: 1000, minStock: 200 },
  { id: '23', name: 'Chili Oil', category: 'Bahan Isian', unit: 'pcs', price: 500, initialStock: 100, currentStock: 100, minStock: 20 },
  { id: '24', name: 'Daun Jeruk', category: 'Bahan Isian', unit: 'paket', price: 500, initialStock: 20, currentStock: 20, minStock: 5 },
  { id: '25', name: 'Sasa / MSG', category: 'Bahan Isian', unit: 'gram', price: 100, initialStock: 200, currentStock: 200, minStock: 50 },
  
  // PACKING
  { id: '20', name: 'Kertas Thermal', category: 'Packing', unit: 'unit', price: 83, initialStock: 100, currentStock: 100, minStock: 20 },
  { id: '21', name: 'Plastik Chili Oil 6x8', category: 'Packing', unit: 'unit', price: 250, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '22', name: 'Plastik Vakum 17x25', category: 'Packing', unit: 'unit', price: 450, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '26', name: 'Stiker Label', category: 'Packing', unit: 'unit', price: 400, initialStock: 500, currentStock: 500, minStock: 100 },
  { id: '27', name: 'Bubble Wrap', category: 'Packing', unit: 'pcs', price: 650, initialStock: 100, currentStock: 100, minStock: 20 },

  // OVERHEAD
  { id: '28', name: 'Gas', category: 'Overhead', unit: 'pcs', price: 10, initialStock: 1000, currentStock: 1000, minStock: 100 },
  { id: '29', name: 'Kertas Nasi', category: 'Overhead', unit: 'unit', price: 2, initialStock: 1000, currentStock: 1000, minStock: 100 },
  { id: '30', name: 'Sabun Cuci Piring', category: 'Overhead', unit: 'unit', price: 20, initialStock: 500, currentStock: 500, minStock: 50 },
  { id: '31', name: 'Listrik', category: 'Overhead', unit: 'unit', price: 10, initialStock: 1000, currentStock: 1000, minStock: 100 },
];

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  { 
    id: 't1', 
    tanggal: '2026-03-19', 
    keterangan: 'Penarikan Shopee', 
    kategori: 'Penjualan', 
    jenis: 'Pemasukan', 
    nominal: 409688, 
    qty_total: 350,
    qty_beli: 0,
    penjualan_detail: [
      {
        produk_id: "prod_1",
        produk_nama: "Cireng Isi",
        varian: [
          { varian_id: "var_1", varian_nama: "Ayam Ori", qty: 150 },
          { varian_id: "var_2", varian_nama: "Ayam Pedas", qty: 100 },
          { varian_id: "var_3", varian_nama: "Keju", qty: 100 }
        ]
      }
    ]
  },
  { id: 't2', tanggal: '2026-03-23', keterangan: 'Tapioka', kategori: 'Bahan Baku', jenis: 'Pengeluaran', nominal: 100000, qty_total: 0, qty_beli: 2.5 },
  { id: 't3', tanggal: '2026-03-23', keterangan: 'Penarikan Shopee', kategori: 'Penjualan', jenis: 'Pemasukan', nominal: 573244, qty_total: 450, qty_beli: 0 },
  { id: 't4', tanggal: '2026-03-02', keterangan: 'Thai tea', kategori: 'Operasional', jenis: 'Pengeluaran', nominal: 31000, qty_total: 0, qty_beli: 0 },
  { id: 't5', tanggal: '2026-03-03', keterangan: 'Penarikan Shopee', kategori: 'Saldo sisa', jenis: 'Pemasukan', nominal: 215557, qty_total: 180, qty_beli: 0 },
  { id: 't6', tanggal: '2026-03-08', keterangan: 'Penjualan Cireng All Varian', kategori: 'Penjualan', jenis: 'Pemasukan', nominal: 150000, qty_total: 120, qty_beli: 0 },
];
