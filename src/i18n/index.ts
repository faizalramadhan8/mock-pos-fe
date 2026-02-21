export const translations = {
  en: {
    appName: "BakeShop",
    // Auth
    signIn: "Sign In", email: "Email address", password: "Password",
    invalidCred: "Wrong email or password", quickAccess: "Quick demo login",
    // Nav
    dashboard: "Home", pos: "Cashier", inventory: "Stock", orders: "Orders", settings: "Settings",
    // General
    search: "Search ingredients...", all: "All", individual: "Pcs", box: "Box",
    save: "Save", cancel: "Cancel", confirm: "Confirm", close: "Close", clear: "Clear",
    // POS
    cart: "Cart", emptyCart: "Nothing here yet", emptyCartHint: "Browse and add items to your order",
    customer: "Customer name (optional)", subtotal: "Subtotal", total: "Total",
    payNow: "Pay now", cash: "Cash", card: "Card", transfer: "Transfer",
    checkout: "Complete Order", totalAmount: "Order Total", cashReceived: "Cash received",
    change: "Change", walkIn: "Walk-in",
    low: "Low", soldOut: "Sold out", each: "each", inStock: "in stock", left: "left",
    addPcs: "+ Pcs", addBox: "Box",
    // Dashboard
    welcome: "Good morning", todayOverview: "Today's overview",
    revenue: "Revenue", ordersCount: "Orders", productsCount: "Products", lowAlerts: "Low Stock",
    recentOrders: "Latest transactions", lowStockItems: "Running low",
    // Inventory
    stockIn: "Stock In", stockOut: "Stock Out", totalIn: "Received", totalOut: "Dispatched",
    netChange: "Net Flow", movementLog: "Movement log", noMovements: "No records yet",
    selectProduct: "Choose product", quantity: "Quantity", unitType: "Unit type",
    note: "Reason / notes", record: "Record", price: "Unit price (Rp)", boxEquals: "1 box",
    // Add Product & Category
    addProduct: "Add Product", productName: "Product name (EN)", productNameId: "Product name (ID)",
    sku: "SKU", purchasePrice: "Purchase Price", sellingPrice: "Selling Price", boxPrice: "Box Price",
    qtyPerBox: "Qty per Box", unitLabel: "Unit", minStockLabel: "Min Stock",
    addCategory: "Add Category", categoryName: "Category name (EN)", categoryNameId: "Category name (ID)",
    categoryColor: "Color",
    // Image
    uploadImage: "Upload Image", chooseImage: "Choose Image", imageUploaded: "Image uploaded",
    // FIFO
    expiryDate: "Expiry date", expires: "Exp", expired: "Expired",
    // Orders
    allOrders: "All", completed: "Completed", pending: "Pending",
    // Settings
    theme: "Appearance", language: "Language", light: "Light", dark: "Dark",
    storeInfo: "Store details", storeName: "Store name", storeAddress: "Address", storePhone: "Phone",
    taxSettings: "Tax (PPN)", ppnRate: "PPN Rate (%)", ppn: "PPN",
    signOut: "Sign out",
    // Roles
    roles: { superadmin: "Super Admin", admin: "Owner", cashier: "Cashier", staff: "Staff", user: "User" },
    // Categories
    cats: { c1: "Flour & Starch", c2: "Sugar", c3: "Dairy & Eggs", c4: "Chocolate", c5: "Leavening", c6: "Nuts & Fruits", c7: "Fats & Oils", c8: "Flavors" },
    // Toast / feedback
    noResults: "No products found",
    orderSuccess: "Order completed!",
    stockRecorded: "Stock recorded",
    productAdded: "Product added",
    categoryAdded: "Category added",
    cartCleared: "Cart cleared",
    settingsSaved: "Settings saved",
    printReceipt: "Print Receipt",
    printLabel: "Print Label",
    receipt: "Receipt",
    thankyou: "Thank you!",
    loadMore: "Show more",
    insufficientStock: "Not enough stock",
    today: "Today",
    yesterday: "Yesterday",
    // Inventory tabs
    invOverview: "Overview", invStockIn: "Stock In", invStockOut: "Stock Out",
    invExpiry: "Expiry", invHistory: "History", invSuppliers: "Suppliers",
    // Overview
    product: "Product", currentStock: "Current Stock", status: "Status", actions: "Actions",
    lowStock: "Low Stock", outOfStock: "Out of Stock", normalStock: "Normal",
    showInPOS: "Show in POS", hideFromPOS: "Hide from POS",
    productShown: "Product visible in POS", productHidden: "Product hidden from POS",
    active: "Active", inactive: "Inactive",
    // Expiry
    expiryAlerts: "Expiry Alerts", expiringIn: "Expiring in",
    days: "days", alreadyExpired: "Already expired", noExpiryAlerts: "No expiry alerts",
    batchNumber: "Batch No.",
    // Barcode scanner
    scannerReady: "Scanner ready", productScanned: "Product scanned", skuNotFound: "SKU not found",
    // RBAC
    readOnly: "Read only",
    // User registration
    registerStaff: "Register Staff", fullName: "Full name", nik: "NIK (National ID)",
    msisdn: "Phone number", dateOfBirth: "Date of birth", selectRole: "Select role",
    defaultPassword: "Default password", userRegistered: "User registered successfully",
    emailExists: "Email already registered", staffList: "Staff List",
    noStaff: "No staff registered yet", registered: "Registered",
    // Supplier
    supplier: "Supplier", suppliers: "Suppliers", addSupplier: "Add Supplier",
    editSupplier: "Edit Supplier", supplierName: "Supplier name",
    supplierPhone: "Phone", supplierEmail: "Email", supplierAddress: "Address",
    noSuppliers: "No suppliers yet", supplierAdded: "Supplier added",
    supplierUpdated: "Supplier updated", supplierDeleted: "Supplier deleted",
    selectSupplier: "Select supplier", deleteSupplier: "Delete",
    // Payment tracking
    paymentTerms: "Payment Terms", dueDate: "Due Date",
    paymentStatus: "Payment Status", paid: "Paid", unpaid: "Unpaid",
    markAsPaid: "Mark as Paid", unpaidInvoices: "Unpaid Invoices",
    overdue: "Overdue", noUnpaid: "No unpaid invoices",
    cod: "COD", net30: "Net 30 Days", net60: "Net 60 Days", net90: "Net 90 Days",
    // Product detail modal
    productDetail: "Product Detail", pricingInfo: "Pricing", perUnit: "per unit", perBox: "per box",
    profitMargin: "Margin", stockInfo: "Stock", batchInfo: "Batches",
    noBatches: "No batch data", recentMovements: "Recent Movements",
    noRecentMovements: "No movements recorded", moreBatches: "more batches",
    // Order & Supplier detail modals
    orderDetail: "Order Detail", supplierDetail: "Supplier Detail",
    orderItems: "Items", contactInfo: "Contact", stockInHistory: "Stock In History",
    noStockInHistory: "No stock-in records", createdDate: "Registered",
  },
  id: {
    appName: "BakeShop",
    signIn: "Masuk", email: "Alamat email", password: "Kata sandi",
    invalidCred: "Email atau sandi salah", quickAccess: "Login cepat (demo)",
    dashboard: "Beranda", pos: "Kasir", inventory: "Stok", orders: "Pesanan", settings: "Pengaturan",
    search: "Cari bahan...", all: "Semua", individual: "Satuan", box: "Dus",
    save: "Simpan", cancel: "Batal", confirm: "Konfirmasi", close: "Tutup", clear: "Hapus",
    cart: "Keranjang", emptyCart: "Belum ada isi", emptyCartHint: "Pilih bahan untuk ditambahkan",
    customer: "Nama pelanggan (opsional)", subtotal: "Subtotal", total: "Total",
    payNow: "Bayar", cash: "Tunai", card: "Kartu", transfer: "Transfer",
    checkout: "Selesaikan Pesanan", totalAmount: "Total Bayar", cashReceived: "Uang diterima",
    change: "Kembalian", walkIn: "Umum",
    low: "Sedikit", soldOut: "Habis", each: "satuan", inStock: "stok", left: "sisa",
    addPcs: "+ Satuan", addBox: "Dus",
    welcome: "Selamat pagi", todayOverview: "Ringkasan hari ini",
    revenue: "Pendapatan", ordersCount: "Pesanan", productsCount: "Produk", lowAlerts: "Stok Rendah",
    recentOrders: "Transaksi terakhir", lowStockItems: "Stok menipis",
    stockIn: "Masuk", stockOut: "Keluar", totalIn: "Diterima", totalOut: "Dikeluarkan",
    netChange: "Arus Bersih", movementLog: "Riwayat stok", noMovements: "Belum ada catatan",
    selectProduct: "Pilih produk", quantity: "Jumlah", unitType: "Tipe unit",
    note: "Alasan / catatan", record: "Catat", price: "Harga satuan (Rp)", boxEquals: "1 dus",
    addProduct: "Tambah Produk", productName: "Nama produk (EN)", productNameId: "Nama produk (ID)",
    sku: "SKU", purchasePrice: "Harga Beli", sellingPrice: "Harga Jual", boxPrice: "Harga Dus",
    qtyPerBox: "Isi per Dus", unitLabel: "Satuan", minStockLabel: "Stok Minimum",
    addCategory: "Tambah Kategori", categoryName: "Nama kategori (EN)", categoryNameId: "Nama kategori (ID)",
    categoryColor: "Warna",
    // Image
    uploadImage: "Upload Gambar", chooseImage: "Pilih Gambar", imageUploaded: "Gambar diunggah",
    expiryDate: "Tanggal kedaluwarsa", expires: "Exp", expired: "Kedaluwarsa",
    allOrders: "Semua", completed: "Selesai", pending: "Tertunda",
    theme: "Tampilan", language: "Bahasa", light: "Terang", dark: "Gelap",
    storeInfo: "Detail toko", storeName: "Nama toko", storeAddress: "Alamat", storePhone: "Telepon",
    taxSettings: "Pajak (PPN)", ppnRate: "Tarif PPN (%)", ppn: "PPN",
    signOut: "Keluar",
    roles: { superadmin: "Super Admin", admin: "Pemilik", cashier: "Kasir", staff: "Staf", user: "Pengguna" },
    cats: { c1: "Tepung & Pati", c2: "Gula", c3: "Susu & Telur", c4: "Cokelat", c5: "Pengembang", c6: "Kacang & Buah", c7: "Lemak & Minyak", c8: "Perasa" },
    // Toast / feedback
    noResults: "Produk tidak ditemukan",
    orderSuccess: "Pesanan selesai!",
    stockRecorded: "Stok tercatat",
    productAdded: "Produk ditambahkan",
    categoryAdded: "Kategori ditambahkan",
    cartCleared: "Keranjang dikosongkan",
    settingsSaved: "Pengaturan disimpan",
    printReceipt: "Cetak Struk",
    printLabel: "Cetak Label",
    receipt: "Struk",
    thankyou: "Terima kasih!",
    loadMore: "Tampilkan lagi",
    insufficientStock: "Stok tidak cukup",
    today: "Hari ini",
    yesterday: "Kemarin",
    // Inventory tabs
    invOverview: "Ringkasan", invStockIn: "Masuk", invStockOut: "Keluar",
    invExpiry: "Kedaluwarsa", invHistory: "Riwayat", invSuppliers: "Pemasok",
    // Overview
    product: "Produk", currentStock: "Stok Saat Ini", status: "Status", actions: "Aksi",
    lowStock: "Stok Rendah", outOfStock: "Stok Habis", normalStock: "Normal",
    showInPOS: "Tampilkan di POS", hideFromPOS: "Sembunyikan dari POS",
    productShown: "Produk terlihat di POS", productHidden: "Produk tersembunyi dari POS",
    active: "Aktif", inactive: "Nonaktif",
    // Expiry
    expiryAlerts: "Peringatan Kedaluwarsa", expiringIn: "Kedaluwarsa dalam",
    days: "hari", alreadyExpired: "Sudah kedaluwarsa", noExpiryAlerts: "Tidak ada peringatan",
    batchNumber: "No. Batch",
    // Barcode scanner
    scannerReady: "Scanner siap", productScanned: "Produk dipindai", skuNotFound: "SKU tidak ditemukan",
    // RBAC
    readOnly: "Hanya baca",
    // User registration
    registerStaff: "Daftar Staf", fullName: "Nama lengkap", nik: "NIK (KTP)",
    msisdn: "Nomor telepon", dateOfBirth: "Tanggal lahir", selectRole: "Pilih peran",
    defaultPassword: "Password default", userRegistered: "Pengguna berhasil didaftarkan",
    emailExists: "Email sudah terdaftar", staffList: "Daftar Staf",
    noStaff: "Belum ada staf terdaftar", registered: "Terdaftar",
    // Supplier
    supplier: "Pemasok", suppliers: "Pemasok", addSupplier: "Tambah Pemasok",
    editSupplier: "Edit Pemasok", supplierName: "Nama pemasok",
    supplierPhone: "Telepon", supplierEmail: "Email", supplierAddress: "Alamat",
    noSuppliers: "Belum ada pemasok", supplierAdded: "Pemasok ditambahkan",
    supplierUpdated: "Pemasok diperbarui", supplierDeleted: "Pemasok dihapus",
    selectSupplier: "Pilih pemasok", deleteSupplier: "Hapus",
    // Payment tracking
    paymentTerms: "Termin Pembayaran", dueDate: "Jatuh Tempo",
    paymentStatus: "Status Pembayaran", paid: "Lunas", unpaid: "Belum Lunas",
    markAsPaid: "Tandai Lunas", unpaidInvoices: "Tagihan Belum Lunas",
    overdue: "Lewat Jatuh Tempo", noUnpaid: "Tidak ada tagihan",
    cod: "COD", net30: "Net 30 Hari", net60: "Net 60 Hari", net90: "Net 90 Hari",
    // Product detail modal
    productDetail: "Detail Produk", pricingInfo: "Harga", perUnit: "per satuan", perBox: "per dus",
    profitMargin: "Margin", stockInfo: "Stok", batchInfo: "Batch",
    noBatches: "Tidak ada data batch", recentMovements: "Pergerakan Terakhir",
    noRecentMovements: "Belum ada pergerakan", moreBatches: "batch lainnya",
    // Order & Supplier detail modals
    orderDetail: "Detail Pesanan", supplierDetail: "Detail Pemasok",
    orderItems: "Item", contactInfo: "Kontak", stockInHistory: "Riwayat Stok Masuk",
    noStockInHistory: "Belum ada catatan masuk", createdDate: "Terdaftar",
  },
} as const;

export interface Translations {
  [key: string]: string | Record<string, string>;
}
