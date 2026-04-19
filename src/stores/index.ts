import { create } from "zustand";
import { persist } from "zustand/middleware";
import toast from "react-hot-toast";
import type { User, Product, CartItem, Order, OrderItem, StockMovement, StockBatch, Category, Supplier, BankAccount, Member, Refund, RefundItem, CashSession, AuditEntry, PaymentMethod, PaymentStatus, DiscountType, UnitType, Lang, PageId, AuditAction } from "@/types";
import { translations } from "@/i18n";
import { ROLE_PERMISSIONS } from "@/constants";
import { genId } from "@/utils";
import { authApi, userApi, productApi, categoryApi, supplierApi, orderApi, refundApi, movementApi, batchApi, memberApi, cashSessionApi, auditApi, settingsApi } from "@/api";
import { setToken, getToken } from "@/api/client";

// ─── Mappers (BE → FE) ───
const mapUser = (u: any): User => ({
  id: u.id, name: u.fullname || u.full_name || '', email: u.email, password: '',
  role: u.role, initials: u.initials || '', nik: u.nik, phone: u.phone,
  dateOfBirth: u.date_of_birth, isActive: u.is_active !== false,
});

const mapProduct = (p: any): Product => ({
  id: p.id, sku: p.sku, barcode: p.barcode || '', name: p.name, nameId: p.name_id || '',
  category: p.category_id, purchasePrice: p.purchase_price, sellingPrice: p.selling_price,
  memberPrice: typeof p.member_price === 'number' ? p.member_price : undefined,
  qtyPerBox: p.qty_per_box || 1, stock: p.stock, unit: p.unit,
  image: p.image || '', minStock: p.min_stock || 0, isActive: p.is_active !== false,
  createdAt: p.created_at,
});

const mapCategory = (c: any): Category => ({
  id: c.id, name: c.name, nameId: c.name_id || '', icon: c.icon || '', color: c.color || '',
});

const mapSupplier = (s: any): Supplier => ({
  id: s.id, name: s.name, phone: s.phone || '', email: s.email || '',
  address: s.address || '', createdAt: s.created_at,
});

const mapOrderItem = (i: any): OrderItem => ({
  productId: i.product_id, name: i.name, quantity: i.quantity,
  unitType: i.unit_type || 'individual', unitPrice: i.unit_price,
  regularPrice: typeof i.regular_price === 'number' ? i.regular_price : undefined,
  discountType: i.discount_type, discountValue: i.discount_value,
  discountAmount: i.discount_amount,
});

const mapOrder = (o: any): Order => ({
  id: o.id, items: (o.items || []).map(mapOrderItem),
  subtotal: o.subtotal, ppnRate: o.ppn_rate, ppn: o.ppn, total: o.total,
  payment: o.payment, status: o.status, customer: o.customer || '',
  memberId: o.member_id || undefined,
  member: o.member ? { id: o.member.id, name: o.member.name, phone: o.member.phone } : undefined,
  memberSavings: o.member_savings || 0,
  createdAt: o.created_at, createdBy: o.created_by,
  paymentProof: o.payment_proof, orderDiscountType: o.order_discount_type,
  orderDiscountValue: o.order_discount_value, orderDiscount: o.order_discount,
});

const mapMovement = (m: any): StockMovement => ({
  id: m.id, productId: m.product_id, type: m.type, quantity: m.quantity,
  unitType: m.unit_type || 'individual', unitPrice: m.unit_price, note: m.note || '',
  createdAt: m.created_at, createdBy: m.created_by,
  expiryDate: m.expiry_date, supplierId: m.supplier_id,
  paymentTerms: m.payment_terms, dueDate: m.due_date, paymentStatus: m.payment_status,
});

const mapBatch = (b: any): StockBatch => ({
  id: b.id, productId: b.product_id, quantity: b.quantity,
  expiryDate: b.expiry_date || '', receivedAt: b.received_at,
  note: b.note || '', batchNumber: b.batch_number,
});

const mapMember = (m: any): Member => ({
  id: m.id, name: m.name, phone: m.phone,
  address: m.address || '', memberNumber: m.member_number || '',
  createdAt: m.created_at,
});

const mapCashSession = (s: any): CashSession => ({
  id: s.id, date: s.date, openingCash: s.opening_cash, openedBy: s.opened_by,
  openedAt: s.opened_at, expectedCash: s.expected_cash || 0,
  actualCash: s.actual_cash || 0, difference: s.difference || 0,
  notes: s.notes || '', closedBy: s.closed_by || '', closedAt: s.closed_at || '',
});

const mapAudit = (a: any): AuditEntry => ({
  id: a.id, action: a.action as AuditAction, userId: a.user_id,
  userName: a.user_name, details: a.details || '', createdAt: a.created_at,
});

// ─── Auth ───
export type LoginResult = true | false | "inactive" | "pending" | "rejected";

interface AuthState {
  user: User | null;
  users: User[];
  login: (email: string, pw: string) => Promise<LoginResult>;
  loginDirect: (user: User) => void;
  logout: () => void;
  checkSession: () => Promise<boolean>;
  hasPerm: (page: PageId) => boolean;
  defaultPage: () => PageId;
  fetchUsers: () => Promise<void>;
  addUser: (user: User) => Promise<void>;
  updateUser: (id: string, data: Partial<Omit<User, "id">>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserActive: (id: string) => Promise<void>;
  resetPassword: (id: string, pw: string) => Promise<void>;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  users: [],
  login: async (email, pw) => {
    try {
      const res = await authApi.login(email, pw);
      // HTTP 202 → device approval pending. Server sends `code: 202` in envelope.
      if (res.code === 202) return "pending";
      const data = res.body as any;
      if (!data?.access_token) return false;
      setToken(data.access_token);
      set({ user: mapUser(data.user) });
      return true;
    } catch (e: any) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('deactivat') || msg.includes('inactive')) return "inactive";
      if (msg.includes('ditolak') || msg.includes('rejected')) return "rejected";
      return false;
    }
  },
  loginDirect: (user) => set({ user }),
  logout: () => {
    authApi.logout().catch(() => {});
    setToken(null);
    set({ user: null, users: [] });
  },
  checkSession: async () => {
    if (!getToken()) return false;
    try {
      const res = await authApi.getSession();
      const s = res.body!;
      set({ user: { id: s.id, name: s.fullname, email: s.email || '', password: '', role: s.role as any, initials: '', isActive: s.is_active } });
      return true;
    } catch {
      setToken(null);
      return false;
    }
  },
  hasPerm: (page) => {
    const u = get().user;
    return u ? (ROLE_PERMISSIONS[u.role] || []).includes(page) : false;
  },
  defaultPage: () => {
    const u = get().user;
    return u ? (ROLE_PERMISSIONS[u.role]?.[0] || "dashboard") : "dashboard";
  },
  fetchUsers: async () => {
    try {
      const res = await userApi.getAll();
      set({ users: (res.body || []).map(mapUser) });
    } catch { /* ignore */ }
  },
  addUser: async (user) => {
    try {
      await userApi.create({
        email: user.email, password: user.password || 'bakeshop123',
        fullname: user.name, phone: user.phone, role: user.role,
        nik: user.nik, date_of_birth: user.dateOfBirth,
      });
      await get().fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  },
  updateUser: async (id, data) => {
    try {
      await userApi.update(id, {
        fullname: data.name, phone: data.phone, role: data.role,
        nik: data.nik, date_of_birth: data.dateOfBirth,
      });
      await get().fetchUsers();
    } catch (e: any) { toast.error(e.message); }
  },
  deleteUser: async (id) => {
    try {
      await userApi.delete(id);
      set(s => ({ users: s.users.filter(u => u.id !== id) }));
    } catch (e: any) { toast.error(e.message); }
  },
  toggleUserActive: async (id) => {
    try {
      await userApi.toggleActive(id);
      set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u) }));
    } catch (e: any) { toast.error(e.message); }
  },
  resetPassword: async (id, pw) => {
    try {
      await userApi.resetPassword(id, pw);
      toast.success('Password reset');
    } catch (e: any) { toast.error(e.message); }
  },
}));

// ─── Categories ───
interface CategoryState {
  categories: Category[];
  fetchCategories: () => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
}
export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  fetchCategories: async () => {
    try {
      const res = await categoryApi.getAll();
      set({ categories: (res.body || []).map(mapCategory) });
    } catch { /* ignore */ }
  },
  addCategory: async (category) => {
    try {
      await categoryApi.create({ name: category.name, name_id: category.nameId, icon: category.icon, color: category.color });
      await get().fetchCategories();
    } catch (e: any) {
      set(s => ({ categories: [...s.categories, category] }));
      toast.error(e.message);
    }
  },
}));

// ─── Suppliers ───
interface SupplierState {
  suppliers: Supplier[];
  fetchSuppliers: () => Promise<void>;
  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (id: string, data: Partial<Omit<Supplier, "id" | "createdAt">>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
}
export const useSupplierStore = create<SupplierState>((set, get) => ({
  suppliers: [],
  fetchSuppliers: async () => {
    try {
      const res = await supplierApi.getAll({ limit: 200 });
      set({ suppliers: (res.body || []).map(mapSupplier) });
    } catch { /* ignore */ }
  },
  addSupplier: async (supplier) => {
    try {
      await supplierApi.create({ name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address });
      await get().fetchSuppliers();
    } catch (e: any) {
      set(s => ({ suppliers: [...s.suppliers, supplier] }));
      toast.error(e.message);
    }
  },
  updateSupplier: async (id, data) => {
    try {
      await supplierApi.update(id, data);
      await get().fetchSuppliers();
    } catch (e: any) {
      set(s => ({ suppliers: s.suppliers.map(sup => sup.id === id ? { ...sup, ...data } : sup) }));
      toast.error(e.message);
    }
  },
  deleteSupplier: async (id) => {
    try {
      await supplierApi.delete(id);
      set(s => ({ suppliers: s.suppliers.filter(sup => sup.id !== id) }));
    } catch (e: any) { toast.error(e.message); }
  },
}));

// ─── Products ───
interface ProductState {
  products: Product[];
  fetchProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => Promise<void>;
  adjustStock: (id: string, delta: number) => void;
  toggleActive: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}
export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  fetchProducts: async () => {
    try {
      const res = await productApi.getAll({ limit: 10000 });
      set({ products: (res.body || []).map(mapProduct) });
    } catch { /* ignore */ }
  },
  addProduct: async (product) => {
    try {
      await productApi.create({
        sku: product.sku, name: product.name, name_id: product.nameId,
        category_id: product.category, purchase_price: product.purchasePrice,
        selling_price: product.sellingPrice,
        member_price: product.memberPrice ?? null,
        qty_per_box: product.qtyPerBox,
        stock: product.stock, unit: product.unit, image: product.image,
        min_stock: product.minStock,
      });
      await get().fetchProducts();
    } catch (e: any) {
      set(s => ({ products: [product, ...s.products] }));
      toast.error(e.message);
    }
  },
  updateProduct: async (id, data) => {
    try {
      const send: any = {};
      if (data.name !== undefined) send.name = data.name;
      if (data.nameId !== undefined) send.name_id = data.nameId;
      if (data.sku !== undefined) send.sku = data.sku;
      if (data.category !== undefined) send.category_id = data.category;
      if (data.purchasePrice !== undefined) send.purchase_price = data.purchasePrice;
      if (data.sellingPrice !== undefined) send.selling_price = data.sellingPrice;
      if (data.memberPrice !== undefined) send.member_price = data.memberPrice ?? null;
      if (data.qtyPerBox !== undefined) send.qty_per_box = data.qtyPerBox;
      if (data.unit !== undefined) send.unit = data.unit;
      if (data.image !== undefined) send.image = data.image;
      if (data.minStock !== undefined) send.min_stock = data.minStock;
      if (data.stock !== undefined) send.stock = data.stock;
      await productApi.update(id, send);
      set(s => ({ products: s.products.map(p => p.id === id ? { ...p, ...data } : p) }));
    } catch (e: any) {
      set(s => ({ products: s.products.map(p => p.id === id ? { ...p, ...data } : p) }));
      toast.error(e.message);
    }
  },
  // adjustStock: local-only for optimistic UI (BE handles actual stock during order/movement)
  adjustStock: (id, delta) => set(s => ({
    products: s.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p),
  })),
  toggleActive: async (id) => {
    try {
      await productApi.toggleActive(id);
      set(s => ({ products: s.products.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p) }));
    } catch (e: any) { toast.error(e.message); }
  },
  deleteProduct: async (id) => {
    try {
      await productApi.delete(id);
      set(s => ({ products: s.products.filter(p => p.id !== id) }));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete product");
    }
  },
}));

// ─── Cart (persisted, client-only — UNCHANGED) ───
interface ActiveMember { id: string; name: string; phone: string; }

interface CartState {
  items: CartItem[];
  customer: string;
  payment: PaymentMethod;
  member: ActiveMember | null;
  orderDiscountType: DiscountType | null;
  orderDiscountValue: number;
  setCustomer: (n: string) => void;
  setPayment: (p: PaymentMethod) => void;
  setMember: (m: ActiveMember | null) => void;
  addItem: (product: Product, unitType: UnitType, lang: Lang) => void;
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  setItemDiscount: (id: string, type: DiscountType | null, value: number) => void;
  setOrderDiscount: (type: DiscountType | null, value: number) => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
}

// Helper: compute unit price for an item given member status and product.
// Returns { unitPrice, regularPrice } where regularPrice is the non-member
// price snapshot (for showing savings).
function computePrices(product: Product, unitType: UnitType, isMember: boolean) {
  const boxMultiplier = unitType === "box" ? product.qtyPerBox : 1;
  const regular = product.sellingPrice * boxMultiplier;
  const hasMemberPrice = typeof product.memberPrice === "number" && product.memberPrice > 0;
  const memberTotal = hasMemberPrice ? (product.memberPrice as number) * boxMultiplier : null;
  const unitPrice = isMember && memberTotal !== null && memberTotal < regular ? memberTotal : regular;
  return { unitPrice, regularPrice: regular };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: "",
      payment: "cash",
      member: null,
      orderDiscountType: null,
      orderDiscountValue: 0,
      setCustomer: (n) => set({ customer: n }),
      setPayment: (p) => set({ payment: p }),
      setMember: (m) => {
        const isMember = m !== null;
        // Recompute existing cart items based on new member status
        const products = useProductStore.getState().products;
        set(s => ({
          member: m,
          customer: m ? m.name : s.customer,
          items: s.items.map(i => {
            const product = products.find(p => p.id === i.productId);
            if (!product) return i;
            const { unitPrice, regularPrice } = computePrices(product, i.unitType, isMember);
            return { ...i, unitPrice, regularPrice };
          }),
        }));
      },
      addItem: (product, unitType, lang) => {
        set(s => {
          const existing = s.items.find(i => i.productId === product.id && i.unitType === unitType);
          if (existing) {
            return { items: s.items.map(i => i.productId === product.id && i.unitType === unitType ? { ...i, quantity: i.quantity + 1 } : i) };
          }
          const { unitPrice, regularPrice } = computePrices(product, unitType, s.member !== null);
          const item: CartItem = {
            id: genId(), productId: product.id,
            name: lang === "id" ? product.nameId : product.name,
            category: product.category, image: product.image,
            quantity: 1, unitType,
            unitPrice, regularPrice,
            qtyPerBox: product.qtyPerBox, unit: product.unit,
          };
          return { items: [...s.items, item] };
        });
      },
      updateQty: (id, delta) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0),
      })),
      removeItem: (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),
      setItemDiscount: (id, type, value) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, discountType: type || undefined, discountValue: type ? value : undefined } : i),
      })),
      setOrderDiscount: (type, value) => set({ orderDiscountType: type, orderDiscountValue: type ? value : 0 }),
      clearCart: () => set({ items: [], customer: "", payment: "cash", member: null, orderDiscountType: null, orderDiscountValue: 0 }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name: "bakeshop-cart",
      version: 4,
      migrate: () => ({ items: [], customer: "", payment: "cash" as PaymentMethod, member: null, orderDiscountType: null, orderDiscountValue: 0 }),
      partialize: (state) => ({ items: state.items, customer: state.customer, payment: state.payment, member: state.member, orderDiscountType: state.orderDiscountType, orderDiscountValue: state.orderDiscountValue }),
    }
  )
);

// ─── Orders ───
interface OrderState {
  orders: Order[];
  fetchOrders: () => Promise<void>;
  addOrder: (order: Order) => Promise<Order>;
  cancelOrder: (id: string) => void;
  refundOrder: (id: string) => void;
}
export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  fetchOrders: async () => {
    try {
      const res = await orderApi.getAll({ limit: 200 });
      set({ orders: (res.body || []).map(mapOrder) });
    } catch { /* ignore */ }
  },
  addOrder: async (order) => {
    try {
      const res = await orderApi.create({
        items: order.items.map(i => ({
          product_id: i.productId, name: i.name, quantity: i.quantity,
          unit_type: i.unitType || 'individual', unit_price: i.unitPrice,
          regular_price: i.regularPrice,
          discount_type: i.discountType, discount_value: i.discountValue,
          discount_amount: i.discountAmount,
        })),
        subtotal: order.subtotal, ppn_rate: order.ppnRate, ppn: order.ppn, total: order.total,
        payment: order.payment, customer: order.customer, member_id: order.memberId,
        payment_proof: order.paymentProof,
        order_discount_type: order.orderDiscountType, order_discount_value: order.orderDiscountValue,
        order_discount: order.orderDiscount,
      });
      const saved = res.body ? mapOrder(res.body) : order;
      set(s => ({ orders: [saved, ...s.orders] }));
      // Refresh products and batches (stock was updated by BE)
      await useProductStore.getState().fetchProducts();
      await useBatchStore.getState().fetchBatches();
      return saved;
    } catch (e: any) {
      // Fallback: add locally
      set(s => ({ orders: [order, ...s.orders] }));
      toast.error(e.message || 'Failed to create order');
      return order;
    }
  },
  cancelOrder: (id) => {
    orderApi.cancel(id).then(async () => {
      set(s => ({ orders: s.orders.map(o => o.id === id ? { ...o, status: "cancelled" as const } : o) }));
      await useProductStore.getState().fetchProducts();
      await useBatchStore.getState().fetchBatches();
    }).catch((e) => {
      // Fallback: local cancel with manual stock restore
      set(s => {
        const order = s.orders.find(o => o.id === id);
        if (order && order.status === "completed") {
          order.items.forEach(item => {
            const delta = item.unitType === "box"
              ? item.quantity * (useProductStore.getState().products.find(p => p.id === item.productId)?.qtyPerBox || 1)
              : item.quantity;
            useProductStore.getState().adjustStock(item.productId, delta);
          });
        }
        return { orders: s.orders.map(o => o.id === id ? { ...o, status: "cancelled" as const } : o) };
      });
      toast.error(e.message || 'Failed to cancel order');
    });
  },
  refundOrder: (id) => set(s => ({
    orders: s.orders.map(o => o.id === id ? { ...o, status: "refunded" as const } : o),
  })),
}));

// ─── Inventory ───
interface InventoryState {
  movements: StockMovement[];
  fetchMovements: () => Promise<void>;
  addMovement: (m: StockMovement) => Promise<void>;
  updatePaymentStatus: (movementId: string, status: PaymentStatus) => Promise<void>;
}
export const useInventoryStore = create<InventoryState>((set, get) => ({
  movements: [],
  fetchMovements: async () => {
    try {
      const res = await movementApi.getAll({ limit: 500 });
      set({ movements: (res.body || []).map(mapMovement) });
    } catch { /* ignore */ }
  },
  addMovement: async (m) => {
    try {
      await movementApi.create({
        product_id: m.productId, type: m.type, quantity: m.quantity,
        unit_type: m.unitType || 'individual', unit_price: m.unitPrice,
        note: m.note, expiry_date: m.expiryDate, supplier_id: m.supplierId,
        payment_terms: m.paymentTerms, due_date: m.dueDate, payment_status: m.paymentStatus,
      });
      await get().fetchMovements();
      // Refresh products and batches (stock was updated by BE)
      await useProductStore.getState().fetchProducts();
      await useBatchStore.getState().fetchBatches();
    } catch (e: any) {
      set(s => ({ movements: [m, ...s.movements] }));
      toast.error(e.message || 'Failed to create movement');
    }
  },
  updatePaymentStatus: async (id, status) => {
    try {
      await movementApi.updatePaymentStatus(id, status);
      set(s => ({ movements: s.movements.map(m => m.id === id ? { ...m, paymentStatus: status } : m) }));
    } catch (e: any) {
      set(s => ({ movements: s.movements.map(m => m.id === id ? { ...m, paymentStatus: status } : m) }));
      toast.error(e.message);
    }
  },
}));

// ─── Batches (FIFO) ───
interface BatchState {
  batches: StockBatch[];
  fetchBatches: () => Promise<void>;
  addBatch: (batch: StockBatch) => void;
  consumeFIFO: (productId: string, qty: number) => void;
  getNearestExpiry: (productId: string) => string | null;
  getExpiringBatches: (withinDays: number) => StockBatch[];
}
export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  fetchBatches: async () => {
    try {
      const res = await batchApi.getAll({ limit: 1000 });
      set({ batches: (res.body || []).map(mapBatch) });
    } catch { /* ignore */ }
  },
  // addBatch and consumeFIFO are local-only now (BE handles them during movements/orders)
  addBatch: (batch) => set(s => ({ batches: [...s.batches, batch] })),
  consumeFIFO: (productId, qty) => set(s => {
    let remaining = qty;
    const updated = s.batches
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
      .map(b => {
        if (b.productId !== productId || remaining <= 0) return b;
        const deduct = Math.min(b.quantity, remaining);
        remaining -= deduct;
        return { ...b, quantity: b.quantity - deduct };
      }).filter(b => b.quantity > 0);
    return { batches: updated };
  }),
  getNearestExpiry: (productId) => {
    const batch = get().batches
      .filter(b => b.productId === productId && b.quantity > 0 && b.expiryDate)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
    return batch?.expiryDate || null;
  },
  getExpiringBatches: (withinDays) => {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return get().batches
      .filter(b => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) <= threshold)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  },
}));

// ─── Theme (persisted, client-only — UNCHANGED) ───
interface ThemeState {
  dark: boolean;
  toggle: () => void;
}
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set(s => {
        const next = !s.dark;
        document.documentElement.classList.toggle("dark", next);
        return { dark: next };
      }),
    }),
    { name: "bakeshop-theme" }
  )
);

// ─── Language (persisted, client-only — UNCHANGED) ───
interface LangState {
  lang: Lang;
  t: Record<string, any>;
  setLang: (l: Lang) => void;
}
export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "en",
      t: translations.en as Record<string, any>,
      setLang: (l) => set({ lang: l, t: translations[l] as Record<string, any> }),
    }),
    {
      name: "bakeshop-lang",
      partialize: (state) => ({ lang: state.lang }),
      merge: (persisted, current) => {
        const p = persisted as { lang?: Lang };
        const lang = p?.lang || "en";
        return { ...current, lang, t: translations[lang] as Record<string, any> };
      },
    }
  )
);

// ─── Members ───
interface MemberState {
  members: Member[];
  fetchMembers: () => Promise<void>;
  addMember: (member: Member) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  updateMember: (id: string, data: Partial<Omit<Member, "id" | "createdAt">>) => Promise<void>;
}
export const useMemberStore = create<MemberState>((set, get) => ({
  members: [],
  fetchMembers: async () => {
    try {
      const res = await memberApi.getAll({ limit: 500 });
      set({ members: (res.body || []).map(mapMember) });
    } catch { /* ignore */ }
  },
  addMember: async (member) => {
    try {
      await memberApi.create({
        name: member.name,
        phone: member.phone,
        address: member.address || undefined,
        member_number: member.memberNumber || undefined,
      });
      await get().fetchMembers();
    } catch (e: any) {
      set(s => ({ members: [member, ...s.members] }));
      toast.error(e.message);
    }
  },
  updateMember: async (id, data) => {
    try {
      await memberApi.update(id, {
        name: data.name,
        phone: data.phone,
        address: data.address ?? '',
        member_number: data.memberNumber ?? '',
      });
      await get().fetchMembers();
    } catch (e: any) {
      toast.error(e.message);
    }
  },
  deleteMember: async (id) => {
    try {
      await memberApi.delete(id);
      set(s => ({ members: s.members.filter(m => m.id !== id) }));
    } catch (e: any) {
      set(s => ({ members: s.members.filter(m => m.id !== id) }));
      toast.error(e.message);
    }
  },
}));

// ─── Refunds ───
interface RefundState {
  refunds: Refund[];
  addRefund: (refund: Refund) => Promise<void>;
}
export const useRefundStore = create<RefundState>((set) => ({
  refunds: [],
  addRefund: async (refund) => {
    try {
      await refundApi.create({
        order_id: refund.orderId,
        items: refund.items.map(i => ({
          product_id: i.productId, name: i.name, quantity: i.quantity,
          unit_type: i.unitType, unit_price: i.unitPrice, refund_amount: i.refundAmount,
        })),
        amount: refund.amount, reason: refund.reason,
      });
      set(s => ({ refunds: [refund, ...s.refunds] }));
      // Refresh products (stock was restored by BE)
      await useProductStore.getState().fetchProducts();
      await useBatchStore.getState().fetchBatches();
    } catch (e: any) {
      // Fallback: local with manual stock restore
      refund.items.forEach(item => {
        const delta = item.unitType === "box"
          ? item.quantity * (useProductStore.getState().products.find(p => p.id === item.productId)?.qtyPerBox || 1)
          : item.quantity;
        useProductStore.getState().adjustStock(item.productId, delta);
      });
      set(s => ({ refunds: [refund, ...s.refunds] }));
      toast.error(e.message || 'Failed to create refund');
    }
  },
}));

// ─── Cash Sessions ───
interface CashSessionState {
  sessions: CashSession[];
  activeSession: CashSession | null;
  fetchSessions: () => Promise<void>;
  openSession: (session: CashSession) => Promise<void>;
  closeSession: (data: { actualCash: number; expectedCash: number; difference: number; notes: string; closedBy: string }) => Promise<void>;
  addSession: (session: CashSession) => void;
}
export const useCashSessionStore = create<CashSessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  fetchSessions: async () => {
    try {
      const res = await cashSessionApi.getAll();
      const sessions = (res.body || []).map(mapCashSession);
      set({ sessions });
      // Check for open session
      try {
        const openRes = await cashSessionApi.getOpen();
        if (openRes.body) set({ activeSession: mapCashSession(openRes.body) });
      } catch { /* no open session */ }
    } catch { /* ignore */ }
  },
  openSession: async (session) => {
    try {
      const res = await cashSessionApi.open({
        date: session.date, opening_cash: session.openingCash, opened_by: session.openedBy,
      });
      if (res.body) set({ activeSession: mapCashSession(res.body) });
      else set({ activeSession: session });
    } catch (e: any) {
      set({ activeSession: session });
      toast.error(e.message);
    }
  },
  closeSession: async (data) => {
    const active = get().activeSession;
    if (!active) return;
    try {
      await cashSessionApi.close(active.id, {
        expected_cash: data.expectedCash, actual_cash: data.actualCash,
        difference: data.difference, notes: data.notes, closed_by: data.closedBy,
      });
      const closed: CashSession = { ...active, ...data, closedAt: new Date().toISOString() };
      set({ activeSession: null, sessions: [closed, ...get().sessions] });
    } catch (e: any) {
      const closed: CashSession = { ...active, ...data, closedAt: new Date().toISOString() };
      set({ activeSession: null, sessions: [closed, ...get().sessions] });
      toast.error(e.message);
    }
  },
  addSession: (session) => set(s => ({ sessions: [session, ...s.sessions] })),
}));

// ─── Audit Log ───
interface AuditState {
  entries: AuditEntry[];
  fetchEntries: () => Promise<void>;
  log: (action: AuditAction, userId: string, userName: string, details: string) => void;
}
export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  fetchEntries: async () => {
    try {
      const res = await auditApi.getAll({ limit: 200 });
      set({ entries: (res.body || []).map(mapAudit) });
    } catch { /* ignore */ }
  },
  log: (action, userId, userName, details) => {
    const entry: AuditEntry = { id: genId(), action, userId, userName, details, createdAt: new Date().toISOString() };
    set(s => ({ entries: [entry, ...s.entries] }));
    // Fire-and-forget to BE
    auditApi.create({ action, user_id: userId, user_name: userName, details }).catch(() => {});
  },
}));

// ─── Settings ───
interface SettingsState {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  ppnRate: number;
  bankAccounts: BankAccount[];
  labelWidth: number;
  labelHeight: number;
  fetchSettings: () => Promise<void>;
  update: (data: Partial<Pick<SettingsState, "storeName" | "storeAddress" | "storePhone" | "ppnRate" | "bankAccounts" | "labelWidth" | "labelHeight">>) => void;
  addBankAccount: (account: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
}
export const useSettingsStore = create<SettingsState>((set, get) => ({
  storeName: "Toko Bahan Kue Santi",
  storeAddress: "Jl. Sudirman No. 123, Jakarta",
  storePhone: "+62 812-3456-7890",
  ppnRate: 11,
  bankAccounts: [],
  labelWidth: 40,
  labelHeight: 30,
  fetchSettings: async () => {
    try {
      const res = await settingsApi.get();
      const s = res.body!;
      set({
        storeName: s.store_name || 'BakeShop',
        storeAddress: s.store_address || '',
        storePhone: s.store_phone || '',
        ppnRate: s.ppn_rate ?? 11,
        labelWidth: s.label_width || 40,
        labelHeight: s.label_height || 30,
        bankAccounts: (s.bank_accounts || []).map((ba: any) => ({
          id: ba.id, bankName: ba.bank_name, accountNumber: ba.account_number, accountHolder: ba.account_holder,
        })),
      });
    } catch { /* keep defaults */ }
  },
  update: (data) => {
    set(s => ({ ...s, ...data }));
    // Fire-and-forget to BE
    settingsApi.update({
      store_name: data.storeName, store_address: data.storeAddress,
      store_phone: data.storePhone, ppn_rate: data.ppnRate,
      label_width: data.labelWidth, label_height: data.labelHeight,
    }).catch(() => {});
  },
  addBankAccount: async (account) => {
    try {
      await settingsApi.addBankAccount({
        bank_name: account.bankName, account_number: account.accountNumber, account_holder: account.accountHolder,
      });
      await get().fetchSettings();
    } catch (e: any) {
      set(s => ({ bankAccounts: [...s.bankAccounts, account] }));
      toast.error(e.message);
    }
  },
  deleteBankAccount: async (id) => {
    try {
      await settingsApi.deleteBankAccount(id);
      set(s => ({ bankAccounts: s.bankAccounts.filter(ba => ba.id !== id) }));
    } catch (e: any) {
      set(s => ({ bankAccounts: s.bankAccounts.filter(ba => ba.id !== id) }));
      toast.error(e.message);
    }
  },
}));

// ─── Hydrate stores from API after login ───
// Critical data fetched first (blocks UI); non-critical deferred after paint.
export async function hydrateStores() {
  // Critical: needed for Dashboard & POS to render
  await Promise.allSettled([
    useCategoryStore.getState().fetchCategories(),
    useProductStore.getState().fetchProducts(),
    useSettingsStore.getState().fetchSettings(),
    useOrderStore.getState().fetchOrders(),
  ]);

  // Non-critical: fetch in background after first paint
  setTimeout(() => {
    Promise.allSettled([
      useSupplierStore.getState().fetchSuppliers(),
      useInventoryStore.getState().fetchMovements(),
      useBatchStore.getState().fetchBatches(),
      useMemberStore.getState().fetchMembers(),
      useCashSessionStore.getState().fetchSessions(),
      useAuditStore.getState().fetchEntries(),
      useAuthStore.getState().fetchUsers(),
    ]);
  }, 100);
}
