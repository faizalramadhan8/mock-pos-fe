import type { User, Category, Product, Order, StockMovement, StockBatch, Role, PageId } from "@/types";

export const ROLE_PERMISSIONS: Record<Role, PageId[]> = {
  superadmin: ["dashboard", "pos", "inventory", "orders", "settings"],
  admin: ["dashboard", "pos", "inventory", "orders", "settings"],
  cashier: ["dashboard", "pos", "inventory", "orders"],
  staff: ["dashboard", "inventory", "orders", "settings"],
  user: ["dashboard", "orders", "settings"],
};

export const INVENTORY_WRITE_ROLES: Role[] = ["superadmin", "admin", "staff"];

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

export const MOCK_PRODUCTS: Product[] = [
  { id:"p1",sku:"FLR-001",name:"All-Purpose Flour",nameId:"Tepung Serbaguna",category:"c1",priceIndividual:15000,priceBox:150000,qtyPerBox:12,stock:240,unit:"kg",image:"/products/flour.png",minStock:50,isActive:true },
  { id:"p2",sku:"FLR-002",name:"Bread Flour",nameId:"Tepung Roti",category:"c1",priceIndividual:20000,priceBox:200000,qtyPerBox:12,stock:180,unit:"kg",image:"/products/bread-flour.png",minStock:30,isActive:true },
  { id:"p3",sku:"FLR-003",name:"Cake Flour",nameId:"Tepung Kue",category:"c1",priceIndividual:25000,priceBox:250000,qtyPerBox:12,stock:120,unit:"kg",image:"/products/cake-flour.png",minStock:30,isActive:true },
  { id:"p4",sku:"FLR-004",name:"Cornstarch",nameId:"Tepung Maizena",category:"c1",priceIndividual:18000,priceBox:180000,qtyPerBox:12,stock:96,unit:"kg",image:"/products/cornstarch.png",minStock:20,isActive:true },
  { id:"p5",sku:"SUG-001",name:"Granulated Sugar",nameId:"Gula Pasir",category:"c2",priceIndividual:14000,priceBox:140000,qtyPerBox:12,stock:300,unit:"kg",image:"/products/sugar.png",minStock:60,isActive:true },
  { id:"p6",sku:"SUG-002",name:"Brown Sugar",nameId:"Gula Merah",category:"c2",priceIndividual:18000,priceBox:180000,qtyPerBox:12,stock:150,unit:"kg",image:"/products/brown-sugar.png",minStock:30,isActive:true },
  { id:"p7",sku:"SUG-003",name:"Powdered Sugar",nameId:"Gula Halus",category:"c2",priceIndividual:20000,priceBox:200000,qtyPerBox:12,stock:8,unit:"kg",image:"/products/powdered-sugar.png",minStock:20,isActive:true },
  { id:"p8",sku:"SUG-004",name:"Raw Honey",nameId:"Madu Murni",category:"c2",priceIndividual:55000,priceBox:550000,qtyPerBox:12,stock:60,unit:"btl",image:"/products/honey.png",minStock:15,isActive:true },
  { id:"p9",sku:"DRY-001",name:"Farm Eggs (30)",nameId:"Telur Ayam (30)",category:"c3",priceIndividual:45000,priceBox:420000,qtyPerBox:10,stock:80,unit:"tray",image:"/products/eggs.png",minStock:20,isActive:true },
  { id:"p10",sku:"DRY-002",name:"Unsalted Butter",nameId:"Mentega Tawar",category:"c3",priceIndividual:35000,priceBox:380000,qtyPerBox:12,stock:144,unit:"blk",image:"/products/butter.png",minStock:30,isActive:true },
  { id:"p11",sku:"DRY-003",name:"Heavy Cream",nameId:"Krim Kental",category:"c3",priceIndividual:30000,priceBox:300000,qtyPerBox:12,stock:72,unit:"ltr",image:"/products/cream.png",minStock:15,isActive:true },
  { id:"p12",sku:"DRY-004",name:"Cream Cheese",nameId:"Keju Krim",category:"c3",priceIndividual:28000,priceBox:280000,qtyPerBox:12,stock:5,unit:"blk",image:"/products/cream-cheese.png",minStock:15,isActive:true },
  { id:"p13",sku:"CHO-001",name:"Dark Chocolate 70%",nameId:"Cokelat Hitam 70%",category:"c4",priceIndividual:40000,priceBox:420000,qtyPerBox:12,stock:96,unit:"bar",image:"/products/dark-choco.png",minStock:20,isActive:true },
  { id:"p14",sku:"CHO-002",name:"Cocoa Powder",nameId:"Bubuk Kakao",category:"c4",priceIndividual:35000,priceBox:360000,qtyPerBox:12,stock:72,unit:"pck",image:"/products/cocoa.png",minStock:15,isActive:true },
  { id:"p15",sku:"CHO-003",name:"White Chocolate",nameId:"Cokelat Putih",category:"c4",priceIndividual:45000,priceBox:460000,qtyPerBox:12,stock:48,unit:"bar",image:"/products/white-choco.png",minStock:15,isActive:true },
  { id:"p16",sku:"LEV-001",name:"Baking Powder",nameId:"Baking Powder",category:"c5",priceIndividual:15000,priceBox:140000,qtyPerBox:12,stock:120,unit:"can",image:"/products/baking-powder.png",minStock:25,isActive:true },
  { id:"p17",sku:"LEV-002",name:"Baking Soda",nameId:"Soda Kue",category:"c5",priceIndividual:10000,priceBox:100000,qtyPerBox:12,stock:0,unit:"pck",image:"/products/baking-soda.png",minStock:30,isActive:true },
  { id:"p18",sku:"LEV-003",name:"Active Dry Yeast",nameId:"Ragi Kering",category:"c5",priceIndividual:22000,priceBox:220000,qtyPerBox:12,stock:84,unit:"pck",image:"/products/yeast.png",minStock:20,isActive:true },
  { id:"p19",sku:"NUT-001",name:"Almond Slices",nameId:"Irisan Almond",category:"c6",priceIndividual:50000,priceBox:520000,qtyPerBox:12,stock:60,unit:"pck",image:"/products/almonds.png",minStock:15,isActive:true },
  { id:"p20",sku:"NUT-002",name:"Walnut Pieces",nameId:"Kacang Walnut",category:"c6",priceIndividual:55000,priceBox:560000,qtyPerBox:12,stock:18,unit:"pck",image:"/products/walnuts.png",minStock:12,isActive:true },
  { id:"p21",sku:"NUT-003",name:"Raisins",nameId:"Kismis",category:"c6",priceIndividual:25000,priceBox:250000,qtyPerBox:12,stock:72,unit:"pck",image:"/products/raisins.png",minStock:15,isActive:true },
  { id:"p22",sku:"FAT-001",name:"Vegetable Oil",nameId:"Minyak Sayur",category:"c7",priceIndividual:30000,priceBox:300000,qtyPerBox:12,stock:60,unit:"ltr",image:"/products/oil.png",minStock:15,isActive:true },
  { id:"p23",sku:"FLV-001",name:"Vanilla Extract",nameId:"Ekstrak Vanila",category:"c8",priceIndividual:60000,priceBox:620000,qtyPerBox:12,stock:48,unit:"btl",image:"/products/vanilla.png",minStock:12,isActive:true },
  { id:"p24",sku:"FLV-002",name:"Lemon Zest",nameId:"Serbuk Lemon",category:"c8",priceIndividual:38000,priceBox:380000,qtyPerBox:12,stock:8,unit:"pck",image:"/products/lemon.png",minStock:10,isActive:true },
];

export const MOCK_ORDERS: Order[] = [
  { id:"ORD-001",items:[{productId:"p1",name:"All-Purpose Flour",quantity:5,unitType:"individual",unitPrice:15000},{productId:"p5",name:"Granulated Sugar",quantity:2,unitType:"box",unitPrice:140000}],subtotal:355000,ppnRate:0,ppn:0,total:355000,payment:"cash",status:"completed",customer:"Walk-in",createdAt:"2025-02-19T08:15:00",createdBy:"u3" },
  { id:"ORD-002",items:[{productId:"p10",name:"Unsalted Butter",quantity:3,unitType:"individual",unitPrice:35000},{productId:"p14",name:"Cocoa Powder",quantity:1,unitType:"individual",unitPrice:35000}],subtotal:140000,ppnRate:0,ppn:0,total:140000,payment:"card",status:"completed",customer:"Toko Jaya",createdAt:"2025-02-19T09:30:00",createdBy:"u3" },
  { id:"ORD-003",items:[{productId:"p13",name:"Dark Chocolate 70%",quantity:2,unitType:"box",unitPrice:420000}],subtotal:840000,ppnRate:0,ppn:0,total:840000,payment:"transfer",status:"completed",customer:"Cake House",createdAt:"2025-02-19T10:45:00",createdBy:"u2" },
  { id:"ORD-004",items:[{productId:"p23",name:"Vanilla Extract",quantity:4,unitType:"individual",unitPrice:60000},{productId:"p3",name:"Cake Flour",quantity:1,unitType:"box",unitPrice:250000}],subtotal:490000,ppnRate:0,ppn:0,total:490000,payment:"cash",status:"pending",customer:"Walk-in",createdAt:"2025-02-19T11:20:00",createdBy:"u3" },
];

export const MOCK_MOVEMENTS: StockMovement[] = [
  { id:"m1",productId:"p1",type:"in",quantity:120,unitType:"individual",unitPrice:15000,note:"PT Bogasari delivery",createdAt:"2025-02-18T08:00:00",createdBy:"u2" },
  { id:"m2",productId:"p5",type:"in",quantity:60,unitType:"individual",unitPrice:14000,note:"Sugar Co shipment",createdAt:"2025-02-18T09:00:00",createdBy:"u2" },
  { id:"m3",productId:"p13",type:"out",quantity:5,unitType:"individual",unitPrice:40000,note:"Damaged — returned",createdAt:"2025-02-18T14:00:00",createdBy:"u2" },
  { id:"m4",productId:"p10",type:"in",quantity:48,unitType:"individual",unitPrice:35000,note:"Weekly butter restock",createdAt:"2025-02-17T10:00:00",createdBy:"u1" },
];

export const MOCK_BATCHES: StockBatch[] = [
  { id:"b1",productId:"p1",quantity:120,expiryDate:"2026-06-01",receivedAt:"2026-01-10T10:00:00",note:"Initial stock" },
  { id:"b2",productId:"p1",quantity:120,expiryDate:"2026-09-15",receivedAt:"2026-02-18T08:00:00",note:"PT Bogasari delivery" },
  { id:"b3",productId:"p5",quantity:240,expiryDate:"2026-08-20",receivedAt:"2026-01-05T09:00:00",note:"Initial stock" },
  { id:"b4",productId:"p5",quantity:60,expiryDate:"2026-07-30",receivedAt:"2026-02-18T09:00:00",note:"Sugar Co shipment" },
  { id:"b5",productId:"p10",quantity:96,expiryDate:"2026-03-20",receivedAt:"2026-01-15T08:00:00",note:"Initial stock" },
  { id:"b6",productId:"p10",quantity:48,expiryDate:"2026-04-10",receivedAt:"2026-02-17T10:00:00",note:"Weekly butter restock" },
  { id:"b7",productId:"p13",quantity:91,expiryDate:"2026-11-15",receivedAt:"2026-01-20T08:00:00",note:"Initial stock" },
  { id:"b8",productId:"p9",quantity:80,expiryDate:"2026-03-05",receivedAt:"2026-02-01T08:00:00",note:"Farm delivery" },
  { id:"b9",productId:"p12",quantity:5,expiryDate:"2026-03-15",receivedAt:"2026-01-10T08:00:00",note:"Cream cheese delivery" },
  { id:"b10",productId:"p24",quantity:8,expiryDate:"2026-04-01",receivedAt:"2026-02-01T08:00:00",note:"Lemon zest restock" },
  { id:"b11",productId:"p11",quantity:20,expiryDate:"2026-03-01",receivedAt:"2026-01-20T08:00:00",note:"Cream delivery" },
];
