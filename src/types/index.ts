export type Lang = "en" | "id";
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "cashier" | "staff" | "user";
export type PaymentMethod = "cash" | "card" | "transfer";
export type OrderStatus = "completed" | "pending" | "cancelled";
export type UnitType = "individual" | "box";
export type StockType = "in" | "out";
export type PageId = "dashboard" | "pos" | "inventory" | "orders" | "settings";
export type PaymentTerms = "COD" | "NET30" | "NET60" | "NET90";
export type PaymentStatus = "paid" | "unpaid";
export type UnitOfMeasure = "kg" | "gr" | "ltr" | "ml" | "pcs" | "pack" | "btl" | "can" | "bar" | "blk" | "tray" | "sachet";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  initials: string;
  nik?: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface Category {
  id: string;
  name: string;
  nameId: string;
  icon: string;
  color: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameId: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  qtyPerBox: number;
  stock: number;
  unit: UnitOfMeasure;
  image: string;
  minStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  image: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  qtyPerBox: number;
  unit: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  ppnRate: number;
  ppn: number;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  customer: string;
  createdAt: string;
  createdBy: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockType;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  note: string;
  createdAt: string;
  createdBy: string;
  expiryDate?: string;
  supplierId?: string;
  paymentTerms?: PaymentTerms;
  dueDate?: string;
  paymentStatus?: PaymentStatus;
}

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  receivedAt: string;
  note: string;
  batchNumber: string;
}
