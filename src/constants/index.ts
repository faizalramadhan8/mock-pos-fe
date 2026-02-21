import type { User, Category, Product, Order, StockMovement, StockBatch, Supplier, Role, PageId, UnitOfMeasure, PaymentTerms } from "@/types";

export const ROLE_PERMISSIONS: Record<Role, PageId[]> = {
  superadmin: ["dashboard", "pos", "inventory", "orders", "settings"],
  admin: ["dashboard", "pos", "inventory", "orders", "settings"],
  cashier: ["dashboard", "pos", "inventory", "orders", "settings"],
  staff: ["dashboard", "inventory", "orders", "settings"],
  user: ["dashboard", "orders", "settings"],
};

export const INVENTORY_WRITE_ROLES: Role[] = ["superadmin", "admin", "staff"];

export const UNIT_OPTIONS: UnitOfMeasure[] = ["kg","gr","ltr","ml","pcs","pack","btl","can","bar","blk","tray","sachet"];

export const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = ["COD","NET30","NET60","NET90"];

export const INDONESIAN_BANKS = [
  "Bank Central Asia (BCA)",
  "Bank Rakyat Indonesia (BRI)",
  "Bank Mandiri",
  "Bank Negara Indonesia (BNI)",
  "Bank Syariah Indonesia (BSI)",
  "Bank CIMB Niaga",
  "Bank Danamon",
  "Bank Permata",
  "Bank OCBC NISP",
  "Bank Panin",
  "Bank Mega",
  "Bank Bukopin",
  "Bank Sinarmas",
  "Bank BTPN",
  "Bank Jago",
  "Bank DBS Indonesia",
  "Bank UOB Indonesia",
  "Bank Maybank Indonesia",
  "Bank HSBC Indonesia",
  "Bank Commonwealth",
  "Bank Muamalat",
  "Bank BJB",
  "Bank DKI",
  "Bank Jatim",
  "Bank Jateng",
  "Bank DIY",
  "Bank Sumut",
  "Bank Nagari",
  "Bank Riau Kepri",
  "Bank Kalbar",
  "Bank Kaltimtara",
  "Bank Sulselbar",
  "Bank NTT",
  "Bank Bali/BPD Bali",
  "Sea Bank",
  "Bank Neo Commerce",
  "Allo Bank",
  "Bank Sahabat Sampoerna",
  "Blu by BCA Digital",
  "Line Bank",
  "Superbank",
];

export const CATEGORIES: Category[] = [
  { id: "c1", name: "Flour & Starch", nameId: "Tepung & Pati", icon: "flour", color: "#C4884A" },
  { id: "c2", name: "Sugar", nameId: "Gula", icon: "sugar", color: "#D4627A" },
  { id: "c3", name: "Dairy & Eggs", nameId: "Susu & Telur", icon: "dairy", color: "#5B8DEF" },
  { id: "c4", name: "Chocolate", nameId: "Cokelat", icon: "choco", color: "#7D5A44" },
  { id: "c5", name: "Leavening", nameId: "Pengembang", icon: "leaven", color: "#8B6FC0" },
  { id: "c6", name: "Nuts & Fruits", nameId: "Kacang & Buah", icon: "nuts", color: "#6F9A4D" },
  { id: "c7", name: "Fats & Oils", nameId: "Lemak & Minyak", icon: "fats", color: "#E89B48" },
  { id: "c8", name: "Flavors", nameId: "Perasa & Ekstrak", icon: "flavor", color: "#2BA5B5" },
];

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Rina Wijaya", email: "rina@bakeshop.id", password: "admin", role: "superadmin", initials: "RW" },
  { id: "u2", name: "Andi Pratama", email: "andi@bakeshop.id", password: "admin", role: "admin", initials: "AP" },
  { id: "u3", name: "Siti Nurhaliza", email: "siti@bakeshop.id", password: "admin", role: "cashier", initials: "SN" },
  { id: "u5", name: "Dewi Lestari", email: "dewi@bakeshop.id", password: "admin", role: "staff", initials: "DL" },
  { id: "u4", name: "Budi Santoso", email: "budi@bakeshop.id", password: "admin", role: "user", initials: "BS" },
];

export const MOCK_SUPPLIERS: Supplier[] = [
  { id:"sup1", name:"PT Bogasari", phone:"+62 21-5555-0001", email:"order@bogasari.co.id", address:"Jl. Raya Cilincing, Jakarta Utara", createdAt:"2025-01-01T00:00:00" },
  { id:"sup2", name:"Sugar Co Indonesia", phone:"+62 31-5555-0002", email:"sales@sugarco.id", address:"Jl. Industri No. 45, Surabaya", createdAt:"2025-01-15T00:00:00" },
  { id:"sup3", name:"Dairy Fresh", phone:"+62 22-5555-0003", email:"info@dairyfresh.id", address:"Jl. Pasar Baru No. 12, Bandung", createdAt:"2025-02-01T00:00:00" },
];

export const MOCK_PRODUCTS: Product[] = [
  { id:"p1",sku:"FLR-001",name:"All-Purpose Flour",nameId:"Tepung Serbaguna",category:"c1",purchasePrice:10000,sellingPrice:15000,qtyPerBox:12,stock:240,unit:"kg",image:"/products/flour.png",minStock:50,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p2",sku:"FLR-002",name:"Bread Flour",nameId:"Tepung Roti",category:"c1",purchasePrice:13000,sellingPrice:20000,qtyPerBox:12,stock:180,unit:"kg",image:"/products/bread-flour.png",minStock:30,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p3",sku:"FLR-003",name:"Cake Flour",nameId:"Tepung Kue",category:"c1",purchasePrice:16000,sellingPrice:25000,qtyPerBox:12,stock:120,unit:"kg",image:"/products/cake-flour.png",minStock:30,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p4",sku:"FLR-004",name:"Cornstarch",nameId:"Tepung Maizena",category:"c1",purchasePrice:12000,sellingPrice:18000,qtyPerBox:12,stock:96,unit:"kg",image:"/products/cornstarch.png",minStock:20,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p5",sku:"SUG-001",name:"Granulated Sugar",nameId:"Gula Pasir",category:"c2",purchasePrice:9000,sellingPrice:14000,qtyPerBox:12,stock:300,unit:"kg",image:"/products/sugar.png",minStock:60,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p6",sku:"SUG-002",name:"Brown Sugar",nameId:"Gula Merah",category:"c2",purchasePrice:12000,sellingPrice:18000,qtyPerBox:12,stock:150,unit:"kg",image:"/products/brown-sugar.png",minStock:30,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p7",sku:"SUG-003",name:"Powdered Sugar",nameId:"Gula Halus",category:"c2",purchasePrice:13000,sellingPrice:20000,qtyPerBox:12,stock:8,unit:"kg",image:"/products/powdered-sugar.png",minStock:20,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p8",sku:"SUG-004",name:"Raw Honey",nameId:"Madu Murni",category:"c2",purchasePrice:36000,sellingPrice:55000,qtyPerBox:12,stock:60,unit:"btl",image:"/products/honey.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p9",sku:"DRY-001",name:"Farm Eggs (30)",nameId:"Telur Ayam (30)",category:"c3",purchasePrice:30000,sellingPrice:45000,qtyPerBox:10,stock:80,unit:"tray",image:"/products/eggs.png",minStock:20,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p10",sku:"DRY-002",name:"Unsalted Butter",nameId:"Mentega Tawar",category:"c3",purchasePrice:23000,sellingPrice:35000,qtyPerBox:12,stock:144,unit:"blk",image:"/products/butter.png",minStock:30,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p11",sku:"DRY-003",name:"Heavy Cream",nameId:"Krim Kental",category:"c3",purchasePrice:20000,sellingPrice:30000,qtyPerBox:12,stock:72,unit:"ltr",image:"/products/cream.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p12",sku:"DRY-004",name:"Cream Cheese",nameId:"Keju Krim",category:"c3",purchasePrice:18000,sellingPrice:28000,qtyPerBox:12,stock:5,unit:"blk",image:"/products/cream-cheese.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p13",sku:"CHO-001",name:"Dark Chocolate 70%",nameId:"Cokelat Hitam 70%",category:"c4",purchasePrice:26000,sellingPrice:40000,qtyPerBox:12,stock:96,unit:"bar",image:"/products/dark-choco.png",minStock:20,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p14",sku:"CHO-002",name:"Cocoa Powder",nameId:"Bubuk Kakao",category:"c4",purchasePrice:23000,sellingPrice:35000,qtyPerBox:12,stock:72,unit:"pcs",image:"/products/cocoa.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p15",sku:"CHO-003",name:"White Chocolate",nameId:"Cokelat Putih",category:"c4",purchasePrice:29000,sellingPrice:45000,qtyPerBox:12,stock:48,unit:"bar",image:"/products/white-choco.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p16",sku:"LEV-001",name:"Baking Powder",nameId:"Baking Powder",category:"c5",purchasePrice:10000,sellingPrice:15000,qtyPerBox:12,stock:120,unit:"can",image:"/products/baking-powder.png",minStock:25,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p17",sku:"LEV-002",name:"Baking Soda",nameId:"Soda Kue",category:"c5",purchasePrice:6500,sellingPrice:10000,qtyPerBox:12,stock:0,unit:"pack",image:"/products/baking-soda.png",minStock:30,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p18",sku:"LEV-003",name:"Active Dry Yeast",nameId:"Ragi Kering",category:"c5",purchasePrice:14000,sellingPrice:22000,qtyPerBox:12,stock:84,unit:"pack",image:"/products/yeast.png",minStock:20,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p19",sku:"NUT-001",name:"Almond Slices",nameId:"Irisan Almond",category:"c6",purchasePrice:33000,sellingPrice:50000,qtyPerBox:12,stock:60,unit:"pack",image:"/products/almonds.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p20",sku:"NUT-002",name:"Walnut Pieces",nameId:"Kacang Walnut",category:"c6",purchasePrice:36000,sellingPrice:55000,qtyPerBox:12,stock:18,unit:"pack",image:"/products/walnuts.png",minStock:12,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p21",sku:"NUT-003",name:"Raisins",nameId:"Kismis",category:"c6",purchasePrice:16000,sellingPrice:25000,qtyPerBox:12,stock:72,unit:"pack",image:"/products/raisins.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p22",sku:"FAT-001",name:"Vegetable Oil",nameId:"Minyak Sayur",category:"c7",purchasePrice:20000,sellingPrice:30000,qtyPerBox:12,stock:60,unit:"ltr",image:"/products/oil.png",minStock:15,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p23",sku:"FLV-001",name:"Vanilla Extract",nameId:"Ekstrak Vanila",category:"c8",purchasePrice:39000,sellingPrice:60000,qtyPerBox:12,stock:48,unit:"btl",image:"/products/vanilla.png",minStock:12,isActive:true,createdAt:"2025-12-01T00:00:00" },
  { id:"p24",sku:"FLV-002",name:"Lemon Zest",nameId:"Serbuk Lemon",category:"c8",purchasePrice:25000,sellingPrice:38000,qtyPerBox:12,stock:8,unit:"pack",image:"/products/lemon.png",minStock:10,isActive:true,createdAt:"2025-12-01T00:00:00" },
];

export const MOCK_ORDERS: Order[] = [
  { id:"ORD-001",items:[{productId:"p1",name:"All-Purpose Flour",quantity:5,unitType:"individual",unitPrice:15000},{productId:"p5",name:"Granulated Sugar",quantity:2,unitType:"box",unitPrice:168000}],subtotal:411000,ppnRate:0,ppn:0,total:411000,payment:"cash",status:"completed",customer:"Walk-in",createdAt:"2025-02-19T08:15:00",createdBy:"u3" },
  { id:"ORD-002",items:[{productId:"p10",name:"Unsalted Butter",quantity:3,unitType:"individual",unitPrice:35000},{productId:"p14",name:"Cocoa Powder",quantity:1,unitType:"individual",unitPrice:35000}],subtotal:140000,ppnRate:0,ppn:0,total:140000,payment:"card",status:"completed",customer:"Toko Jaya",createdAt:"2025-02-19T09:30:00",createdBy:"u3" },
  { id:"ORD-003",items:[{productId:"p13",name:"Dark Chocolate 70%",quantity:2,unitType:"box",unitPrice:480000}],subtotal:960000,ppnRate:0,ppn:0,total:960000,payment:"transfer",status:"completed",customer:"Cake House",createdAt:"2025-02-19T10:45:00",createdBy:"u2" },
  { id:"ORD-004",items:[{productId:"p23",name:"Vanilla Extract",quantity:4,unitType:"individual",unitPrice:60000},{productId:"p3",name:"Cake Flour",quantity:1,unitType:"box",unitPrice:300000}],subtotal:540000,ppnRate:0,ppn:0,total:540000,payment:"cash",status:"pending",customer:"Walk-in",createdAt:"2025-02-19T11:20:00",createdBy:"u3" },
];

export const MOCK_MOVEMENTS: StockMovement[] = [
  { id:"m1",productId:"p1",type:"in",quantity:120,unitType:"individual",unitPrice:10000,note:"PT Bogasari delivery",createdAt:"2025-02-18T08:00:00",createdBy:"u2",supplierId:"sup1",paymentTerms:"NET30",dueDate:"2025-03-20T08:00:00",paymentStatus:"paid" },
  { id:"m2",productId:"p5",type:"in",quantity:60,unitType:"individual",unitPrice:9000,note:"Sugar Co shipment",createdAt:"2025-02-18T09:00:00",createdBy:"u2",supplierId:"sup2",paymentTerms:"COD",dueDate:"2025-02-18T09:00:00",paymentStatus:"paid" },
  { id:"m3",productId:"p13",type:"out",quantity:5,unitType:"individual",unitPrice:40000,note:"Damaged \u2014 returned",createdAt:"2025-02-18T14:00:00",createdBy:"u2" },
  { id:"m4",productId:"p10",type:"in",quantity:48,unitType:"individual",unitPrice:23000,note:"Weekly butter restock",createdAt:"2025-02-17T10:00:00",createdBy:"u1",supplierId:"sup3",paymentTerms:"NET60",dueDate:"2025-04-18T10:00:00",paymentStatus:"unpaid" },
];

export const MOCK_BATCHES: StockBatch[] = [
  { id:"b1",productId:"p1",quantity:120,expiryDate:"2026-06-01",receivedAt:"2026-01-10T10:00:00",note:"Initial stock",batchNumber:"B-20260110-001" },
  { id:"b2",productId:"p1",quantity:120,expiryDate:"2026-09-15",receivedAt:"2026-02-18T08:00:00",note:"PT Bogasari delivery",batchNumber:"B-20260218-001" },
  { id:"b3",productId:"p5",quantity:240,expiryDate:"2026-08-20",receivedAt:"2026-01-05T09:00:00",note:"Initial stock",batchNumber:"B-20260105-001" },
  { id:"b4",productId:"p5",quantity:60,expiryDate:"2026-07-30",receivedAt:"2026-02-18T09:00:00",note:"Sugar Co shipment",batchNumber:"B-20260218-002" },
  { id:"b5",productId:"p10",quantity:96,expiryDate:"2026-03-20",receivedAt:"2026-01-15T08:00:00",note:"Initial stock",batchNumber:"B-20260115-001" },
  { id:"b6",productId:"p10",quantity:48,expiryDate:"2026-04-10",receivedAt:"2026-02-17T10:00:00",note:"Weekly butter restock",batchNumber:"B-20260217-001" },
  { id:"b7",productId:"p13",quantity:91,expiryDate:"2026-11-15",receivedAt:"2026-01-20T08:00:00",note:"Initial stock",batchNumber:"B-20260120-001" },
  { id:"b8",productId:"p9",quantity:80,expiryDate:"2026-03-05",receivedAt:"2026-02-01T08:00:00",note:"Farm delivery",batchNumber:"B-20260201-001" },
  { id:"b9",productId:"p12",quantity:5,expiryDate:"2026-03-15",receivedAt:"2026-01-10T08:00:00",note:"Cream cheese delivery",batchNumber:"B-20260110-002" },
  { id:"b10",productId:"p24",quantity:8,expiryDate:"2026-04-01",receivedAt:"2026-02-01T08:00:00",note:"Lemon zest restock",batchNumber:"B-20260201-002" },
  { id:"b11",productId:"p11",quantity:20,expiryDate:"2026-03-01",receivedAt:"2026-01-20T08:00:00",note:"Cream delivery",batchNumber:"B-20260120-002" },
];
