import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Product, CartItem, Order, StockMovement, StockBatch, Category, Supplier, BankAccount, Member, PaymentMethod, PaymentStatus, UnitType, Lang, PageId } from "@/types";
import { translations } from "@/i18n";
import { MOCK_USERS, MOCK_PRODUCTS, MOCK_ORDERS, MOCK_MOVEMENTS, MOCK_BATCHES, MOCK_SUPPLIERS, CATEGORIES, ROLE_PERMISSIONS } from "@/constants";
import { genId } from "@/utils";

// ─── Auth ───
interface AuthState {
  user: User | null;
  users: User[];
  login: (email: string, pw: string) => boolean;
  loginDirect: (user: User) => void;
  logout: () => void;
  hasPerm: (page: PageId) => boolean;
  defaultPage: () => PageId;
  addUser: (user: User) => void;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  users: [...MOCK_USERS],
  login: (email, pw) => {
    const u = get().users.find(u => u.email === email && u.password === pw);
    if (u) { set({ user: u }); return true; }
    return false;
  },
  loginDirect: (user) => set({ user }),
  logout: () => set({ user: null }),
  hasPerm: (page) => {
    const u = get().user;
    return u ? (ROLE_PERMISSIONS[u.role] || []).includes(page) : false;
  },
  defaultPage: () => {
    const u = get().user;
    return u ? (ROLE_PERMISSIONS[u.role]?.[0] || "dashboard") : "dashboard";
  },
  addUser: (user) => set(s => ({ users: [...s.users, user] })),
}));

// ─── Categories ───
interface CategoryState {
  categories: Category[];
  addCategory: (category: Category) => void;
}
export const useCategoryStore = create<CategoryState>((set) => ({
  categories: CATEGORIES,
  addCategory: (category) => set(s => ({ categories: [...s.categories, category] })),
}));

// ─── Suppliers ───
interface SupplierState {
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, data: Partial<Omit<Supplier, "id" | "createdAt">>) => void;
  deleteSupplier: (id: string) => void;
}
export const useSupplierStore = create<SupplierState>((set) => ({
  suppliers: [...MOCK_SUPPLIERS],
  addSupplier: (supplier) => set(s => ({ suppliers: [...s.suppliers, supplier] })),
  updateSupplier: (id, data) => set(s => ({
    suppliers: s.suppliers.map(sup => sup.id === id ? { ...sup, ...data } : sup),
  })),
  deleteSupplier: (id) => set(s => ({
    suppliers: s.suppliers.filter(sup => sup.id !== id),
  })),
}));

// ─── Products ───
interface ProductState {
  products: Product[];
  addProduct: (product: Product) => void;
  adjustStock: (id: string, delta: number) => void;
  toggleActive: (id: string) => void;
}
export const useProductStore = create<ProductState>((set) => ({
  products: MOCK_PRODUCTS,
  addProduct: (product) => set(s => ({ products: [product, ...s.products] })),
  adjustStock: (id, delta) => set(s => ({
    products: s.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p),
  })),
  toggleActive: (id) => set(s => ({
    products: s.products.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p),
  })),
}));

// ─── Cart (persisted) ───
interface CartState {
  items: CartItem[];
  customer: string;
  payment: PaymentMethod;
  setCustomer: (n: string) => void;
  setPayment: (p: PaymentMethod) => void;
  addItem: (product: Product, unitType: UnitType, lang: Lang) => void;
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
}
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: "",
      payment: "cash",
      setCustomer: (n) => set({ customer: n }),
      setPayment: (p) => set({ payment: p }),
      addItem: (product, unitType, lang) => {
        set(s => {
          const existing = s.items.find(i => i.productId === product.id && i.unitType === unitType);
          if (existing) {
            return { items: s.items.map(i => i.productId === product.id && i.unitType === unitType ? { ...i, quantity: i.quantity + 1 } : i) };
          }
          const item: CartItem = {
            id: genId(), productId: product.id,
            name: lang === "id" ? product.nameId : product.name,
            category: product.category, image: product.image,
            quantity: 1, unitType,
            unitPrice: unitType === "box" ? product.sellingPrice * product.qtyPerBox : product.sellingPrice,
            qtyPerBox: product.qtyPerBox, unit: product.unit,
          };
          return { items: [...s.items, item] };
        });
      },
      updateQty: (id, delta) => set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0),
      })),
      removeItem: (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),
      clearCart: () => set({ items: [], customer: "", payment: "cash" }),
      total: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name: "bakeshop-cart",
      version: 2,
      migrate: () => ({ items: [], customer: "", payment: "cash" as PaymentMethod }),
      partialize: (state) => ({ items: state.items, customer: state.customer, payment: state.payment }),
    }
  )
);

// ─── Orders ───
interface OrderState {
  orders: Order[];
  addOrder: (order: Order) => void;
  cancelOrder: (id: string) => void;
}
export const useOrderStore = create<OrderState>((set) => ({
  orders: MOCK_ORDERS,
  addOrder: (order) => set(s => ({ orders: [order, ...s.orders] })),
  cancelOrder: (id) => set(s => {
    const order = s.orders.find(o => o.id === id);
    if (order && order.status === "completed") {
      // Restore stock for each item
      order.items.forEach(item => {
        const delta = item.unitType === "box"
          ? item.quantity * (useProductStore.getState().products.find(p => p.id === item.productId)?.qtyPerBox || 1)
          : item.quantity;
        useProductStore.getState().adjustStock(item.productId, delta);
      });
    }
    return { orders: s.orders.map(o => o.id === id ? { ...o, status: "cancelled" as const } : o) };
  }),
}));

// ─── Inventory ───
interface InventoryState {
  movements: StockMovement[];
  addMovement: (m: StockMovement) => void;
  updatePaymentStatus: (movementId: string, status: PaymentStatus) => void;
}
export const useInventoryStore = create<InventoryState>((set) => ({
  movements: MOCK_MOVEMENTS,
  addMovement: (m) => set(s => ({ movements: [m, ...s.movements] })),
  updatePaymentStatus: (id, status) => set(s => ({
    movements: s.movements.map(m => m.id === id ? { ...m, paymentStatus: status } : m),
  })),
}));

// ─── Batches (FIFO) ───
interface BatchState {
  batches: StockBatch[];
  addBatch: (batch: StockBatch) => void;
  consumeFIFO: (productId: string, qty: number) => void;
  getNearestExpiry: (productId: string) => string | null;
  getExpiringBatches: (withinDays: number) => StockBatch[];
}
export const useBatchStore = create<BatchState>((set, get) => ({
  batches: MOCK_BATCHES,
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

// ─── Theme (persisted) ───
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

// ─── Language (persisted) ───
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

// ─── Members (persisted) ───
interface MemberState {
  members: Member[];
  addMember: (member: Member) => void;
  deleteMember: (id: string) => void;
}
export const useMemberStore = create<MemberState>()(
  persist(
    (set) => ({
      members: [],
      addMember: (member) => set(s => ({ members: [member, ...s.members] })),
      deleteMember: (id) => set(s => ({ members: s.members.filter(m => m.id !== id) })),
    }),
    { name: "bakeshop-members" }
  )
);

// ─── Settings (persisted) ───
interface SettingsState {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  ppnRate: number;
  bankAccounts: BankAccount[];
  update: (data: Partial<Pick<SettingsState, "storeName" | "storeAddress" | "storePhone" | "ppnRate" | "bankAccounts">>) => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: "BakeShop",
      storeAddress: "Jl. Sudirman No. 123, Jakarta",
      storePhone: "+62 812-3456-7890",
      ppnRate: 11,
      bankAccounts: [],
      update: (data) => set(s => ({ ...s, ...data })),
    }),
    { name: "bakeshop-settings" }
  )
);
