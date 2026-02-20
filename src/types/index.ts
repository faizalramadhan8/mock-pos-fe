export type Lang = "en" | "id";
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "cashier" | "user";
export type PaymentMethod = "cash" | "card" | "transfer";
export type OrderStatus = "completed" | "pending" | "cancelled";
export type UnitType = "individual" | "box";
export type StockType = "in" | "out";
export type PageId = "dashboard" | "pos" | "inventory" | "orders" | "settings";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  initials: string;
}

export interface Category {
  id: string;
  name: string;
  nameId: string;
  icon: string; // key for SVG icon component
  color: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameId: string;
  category: string;
  priceIndividual: number;
  priceBox: number;
  qtyPerBox: number;
  stock: number;
  unit: string;
  image: string; // URL path to product image
  minStock: number;
  isActive: boolean;
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
}

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  receivedAt: string;
  note: string;
}
