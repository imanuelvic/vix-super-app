import { newStuffId, type StuffCondition, type StuffItem } from './stuff';

// Isi awal daftar Stuff 📦 — SALINAN spreadsheet "My Stuff" (68 baris) supaya
// tidak perlu diketik ulang satu per satu di HP.
//
// Sengaja dipisah dari lib/stuff.ts dan HANYA di-import oleh tombol "Impor
// daftar awal": begitu daftarnya sudah terisi, berkas ini tak pernah tersentuh
// lagi. Sesudah diimpor, yang berlaku adalah data di Firestore — mengubah
// angka di sini tidak akan mengubah apa pun di app.
//
// Bentuknya tuple, bukan objek, karena 68 objek berkolom 11 memakan ±800 baris
// untuk isi yang sama.
type Baris = [
  nama: string,
  kategori: string,
  merek: string,
  tempat: string,
  beli: string, // "YYYY-MM-DD"
  harga: number,
  toko: string,
  catatan: string,
  kondisi: StuffCondition,
  garansi: string, // "" = tak ada
  dibuang: string, // "" = masih dimiliki
];

const BARIS: Baris[] = [
  ['iPhone 8', 'Electronics', 'Apple', 'Bedroom 1', '2018-01-29', 14500000, 'iBox, Central Park Mall', 'Black, 256GB', 'broken', '', '2024-11-02'],
  ['Smartband 5', 'Electronics', 'Huawei', 'Bedroom 1', '2020-01-10', 250000, 'Tokopedia', 'Black', 'dispose', '', '2022-11-13'],
  ['Keyboard', 'Electronics', '', 'Bedroom 1', '2021-07-13', 94000, 'Shopee', 'Gaming Keyboard & Mouse', 'dispose', '', '2024-12-01'],
  ['Mini Hammer', 'Tools & Hardware', 'GapuraTools', 'Living Room', '2021-09-22', 31500, 'Tokopedia', '', 'good', '', ''],
  ['Loafers', 'Clothing & Accessories', 'PaulMay', 'Living Room', '2022-07-01', 195700, 'Shopee', 'Black, 42', 'good', '', ''],
  ['Fan', 'Electronics', 'Hyperlite', 'Bedroom 1', '2022-07-05', 78800, 'Shopee', 'Blue', 'dispose', '', '2024-09-13'],
  ['Ricebucket', 'Kitchenware', '', 'Kitchen', '2022-08-05', 64000, 'Shopee', 'Lime', 'good', '', ''],
  ['Smartband 7', 'Electronics', 'Huawei', 'Bedroom 1', '2022-11-13', 500000, 'Shopee', 'Black', 'dispose', '', '2024-04-29'],
  ['Wallet', 'Office Supplies', 'DNAC', 'Bedroom 1', '2023-06-03', 125000, 'Tokopedia', 'Green', 'good', '', ''],
  ['Sandal: Flip-Flops', 'Clothing & Accessories', 'Flipper', 'Living Room', '2023-08-24', 85685, 'Shopee', 'Green Army Khakis', 'problematic', '', ''],
  ['First Aid Kit Box', 'Emergency Supplies', 'Starlead', 'Living Room', '2024-04-03', 24301, 'Shopee', '', 'good', '', ''],
  ['Shoes', 'Clothing & Accessories', 'Nike Dunk Low', 'Living Room', '2024-04-03', 208999, 'Shopee', 'Dunk Low Retro Grey, 42.5', 'good', '', ''],
  ['Hand Mixer', 'Kitchenware', '', 'Kitchen', '2024-04-15', 22500, 'Shopee', '', 'good', '', ''],
  ['Smartband 9', 'Electronics', 'Huawei', 'Bedroom 1', '2024-04-29', 500000, 'Shopee', 'Black', 'good', '', ''],
  ['Selfie Stick', 'Outdoor & Sports', 'MIXIO A66', 'Bedroom 1', '2024-04-30', 280532, 'Shopee', '', 'good', '', ''],
  ['Plant Pot Rack', 'Gardening Supplies', 'Bedola', 'Living Room', '2024-06-05', 40500, 'Shopee', 'Black', 'good', '', ''],
  ['Bookshelf', 'Furniture', 'Furnikita', 'Bedroom 1', '2024-06-15', 132000, 'Shopee', 'Black, 4 layers', 'good', '', ''],
  ['Neckband', 'Electronics', 'Lenovo XE05', 'Bedroom 1', '2024-06-28', 96000, 'Shopee', '', 'dispose', '', '2024-12-07'],
  ['Dispenser Portable', 'Kitchenware', 'Jozaka', 'Kitchen', '2024-07-05', 28000, 'Shopee', 'Green', 'good', '', ''],
  ['iPad 10', 'Electronics', 'Apple', 'Bedroom 1', '2024-08-16', 7000000, 'Tokopedia', 'Silver, 64GB', 'good', '', ''],
  ['iPad Holder', 'Office Supplies', 'Xundd', 'Bedroom 1', '2024-09-07', 117620, 'Shopee', '', 'good', '', ''],
  ['Slingbag', 'Office Supplies', 'Mivver', 'Bedroom 1', '2024-09-07', 150570, 'Shopee', '', 'good', '', ''],
  ['Sandal: Clogs', 'Clothing & Accessories', 'Limitless', 'Bedroom 1', '2024-09-11', 38868, 'Shopee', 'Elizer Grey, 41.5', 'good', '', ''],
  ['Fan', 'Electronics', 'Arashi', 'Bedroom 1', '2024-09-13', 81900, 'Shopee', 'Green', 'good', '', ''],
  ['iPad Keyboard Mouse', 'Electronics', 'Goojodoq', 'Bedroom 1', '2024-09-13', 161900, 'Shopee', 'Keyboard Mouse Set Wireless', 'good', '', ''],
  ['Sport Earphone', 'Electronics', 'QKZ AK6', 'Office', '2024-09-20', 32900, 'Shopee', 'Green', 'good', '', ''],
  ['iPad Stand Holder', 'Office Supplies', '', 'Bedroom 1', '2024-09-20', 92533, 'Shopee', '', 'good', '', ''],
  ['Belt', 'Clothing & Accessories', 'Crocodile', 'Bedroom 1', '2024-10-26', 95000, 'Shopee', 'Black, 120cm', 'dispose', '', '2025-08-24'],
  ['iPhone 15', 'Electronics', 'Apple', 'Bedroom 1', '2024-11-02', 12849000, 'iBox, Greenlake', 'Green Mint, 128GB', 'good', '', ''],
  ['Washing Machine', 'Electronics', 'Jamay', 'Balcony', '2024-11-15', 253837, 'Shopee', 'Green, 8L', 'good', '', ''],
  ['Electric Gallon Pump', 'Electronics', 'Livine', 'Dining Room', '2024-11-26', 83200, 'Shopee', 'White, 2 in 1', 'good', '', ''],
  ['Folding Bucket', 'Cleaning Supplies', 'Ledaohome', 'Balcony', '2024-11-27', 23760, 'Shopee', 'Green, 5L', 'good', '', ''],
  ['Stand Guitar', 'Appliances', 'Toko Gitar Jakarta', 'Living Room', '2024-11-27', 94500, 'Shopee', '', 'good', '', ''],
  ['Wireless Router', 'Tools & Hardware', 'TP-Link', 'Bedroom 1', '2024-12-03', 150000, 'Shopee', 'TL-WR840N', 'good', '', ''],
  ['Microphone', 'Electronics', 'Topspot', 'Bedroom 1', '2024-12-04', 55000, 'Shopee', 'Type-C Standart', 'good', '', ''],
  ['Mini Round Table', 'Furniture', '', 'Living Room', '2024-12-06', 30311, 'Shopee', '2 Pieces, White', 'good', '', ''],
  ['Wall Mirror Sticker', 'Personal Care', 'Samedream', 'Living Room', '2024-12-10', 199000, 'Shopee', '40 x 150 cm', 'good', '', ''],
  ['Coffee Table', 'Furniture', 'Damaindah', 'Living Room', '2024-12-10', 429000, 'Shopee', 'White, 120cm', 'good', '', ''],
  ['Board Game', 'Outdoor & Sports', 'Secret Hitler', 'Living Room', '2024-12-13', 249900, 'Shopee', '', 'good', '', ''],
  ['Dry Iron', 'Appliances', 'Philips', 'Dining Room', '2024-12-16', 219000, 'Shopee', 'Green, GC122', 'good', '', ''],
  ['Shacket Jacket', 'Clothing & Accessories', 'Civity', 'Bedroom 1', '2024-12-21', 106311, 'Shopee', 'Black, M', 'good', '', ''],
  ['Soap Dispenser', 'Health & Wellness', '', 'Bathroom', '2024-12-25', 26000, 'Shopee', '2 Pieces, Black', 'good', '', ''],
  ['Mini Wheel Chair', 'Furniture', 'Mofan', 'Living Room', '2024-12-26', 52500, 'Shopee', 'Green', 'good', '', ''],
  ['Waterproof Phone Case', 'Electronics', '', 'Bathroom', '2024-12-29', 24500, 'Shopee', 'Green', 'good', '', ''],
  ['Chino Pants', 'Clothing & Accessories', 'Bapin', 'Bedroom 1', '2025-01-09', 150000, 'Shopee', 'Green Army, L', 'good', '', ''],
  ['Chino Pants', 'Clothing & Accessories', 'Bapin', 'Bedroom 1', '2025-01-09', 150000, 'Shopee', 'Cream, L', 'good', '', ''],
  ['Board Game', 'Outdoor & Sports', 'Exploding Kittens', 'Living Room', '2025-01-11', 98000, 'Shopee', '', 'good', '', ''],
  ['Swimming Goggles', 'Outdoor & Sports', 'Rumah Xiaom', 'Living Room', '2025-01-16', 51000, 'Shopee', 'Minus 4', 'good', '', ''],
  ['Neckband Sport', 'Electronics', 'Lenovo Thinkplus BT10', 'Bedroom 1', '2025-02-07', 68000, 'Shopee', 'Green', 'good', '', ''],
  ['Dumbbell Set', 'Outdoor & Sports', 'Kucadi', 'Living Room', '2025-04-08', 281000, 'Shopee', '30 KG [Upgrade]', 'good', '', ''],
  ['Digital Weight Scale', 'Personal Care', 'Digipounds', 'Bedroom 1', '2025-04-09', 99000, 'Shopee', 'Black', 'good', '', ''],
  ['Roller Wheel', 'Outdoor & Sports', 'Speeds', 'Living Room', '2025-04-11', 45000, 'Shopee', 'Red', 'good', '', ''],
  ['Hand Grip', 'Outdoor & Sports', 'TrailTop', 'Living Room', '2025-04-13', 21000, 'Shopee', 'Grey', 'good', '', ''],
  ['Yoga Mat', 'Outdoor & Sports', 'Speeds', 'Living Room', '2025-04-13', 199000, 'Shopee', 'Grey, 196x115x30mm', 'good', '', ''],
  ['Sandal: Slippers', 'Clothing & Accessories', 'MR.DIY', 'Living Room', '2025-05-01', 75000, 'MR.DIY', 'Black', 'good', '', ''],
  ['Glasses', 'Clothing & Accessories', 'Owl Eyewear Indonesia', 'Bedroom 1', '2025-05-13', 3779000, 'Owl, Neo Soho', 'Brown', 'good', '', ''],
  ['Travel Backpack', 'Bags & Luggage', 'Momoda', 'Bedroom 2', '2025-06-08', 298000, 'Shopee', 'Green', 'good', '', ''],
  ['Aesthetic Floor Carpet', 'Furniture', 'Pasofol Karpet', 'Living Room', '2025-06-09', 450000, 'Shopee', 'Blue Ocean, 180x250cm', 'good', '', ''],
  ['True Wireless Stereo', 'Electronics', 'JETE', 'Living Room', '2025-06-26', 200000, 'JETE Central Park', 'CS5, DarkGrey-Green', 'good', '2027-06-26', ''],
  ['Round Plastic Basin', 'Kitchenware', 'Hygga Home', 'Dining Room', '2025-07-01', 25000, 'Shopee', 'White, Small', 'good', '', ''],
  ['Round Plastic Basin', 'Kitchenware', 'Hygga Home', 'Dining Room', '2025-07-01', 25000, 'Shopee', 'Grey, Small', 'good', '', ''],
  ['Goalkeeper Gloves', 'Outdoor & Sports', 'Zhengdong', 'Bedroom 2', '2025-07-02', 138000, 'Shopee', 'Green, 7', 'good', '', ''],
  ['Goalkeeper Gloves', 'Outdoor & Sports', 'Zhengdong', 'Bedroom 2', '2025-07-02', 138000, 'Shopee', 'Orange, 7', 'good', '', ''],
  ['Digital Kitchen Scale', 'Kitchenware', 'Indoware Online', 'Dining Room', '2025-07-05', 62000, 'Shopee', 'Black', 'good', '', ''],
  ['Storage Box', 'Bags & Luggage', 'ABC Bear', 'Bedroom 1', '2025-08-28', 176000, 'Shopee', 'Hijau, Extra Large', 'good', '', ''],
  ['Storage Box', 'Bags & Luggage', 'ABC Bear', 'Bedroom 1', '2025-08-28', 94000, 'Shopee', 'Hijau, Small', 'good', '', ''],
  ['Belt', 'Clothing & Accessories', 'Crocodile', 'Bedroom 1', '2025-09-25', 98000, 'Shopee', 'Black, 120cm', 'good', '', ''],
  ['Car Holder', 'Electronics', 'Robot', 'Car', '2025-10-06', 62500, 'Shopee', 'RT-CH035', 'good', '', ''],
];

/** Jumlah barang di daftar awal — dipakai tulisan tombol impornya. */
export const STUFF_SEED_COUNT = BARIS.length;

/** Ubah jadi daftar siap simpan. Id-nya baru tiap kali dipanggil. */
export function stuffSeed(now: Date): StuffItem[] {
  return BARIS.map(
    ([name, category, brand, location, buyDay, price, store, note, condition, warrantyDay, goneDay]) => ({
      id: newStuffId(now),
      name,
      category,
      brand,
      location,
      buyDay,
      price,
      store,
      note,
      condition,
      warrantyDay,
      goneDay,
    }),
  );
}
