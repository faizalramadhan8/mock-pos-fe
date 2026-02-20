import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Product, CartItem, Order, StockMovement, StockBatch, Category, PaymentMethod, UnitType, Lang, PageId } from "@/types";
import { translations } from "@/i18n";
import { MOCK_USERS, MOCK_PRODUCTS, MOCK_ORDERS, MOCK_MOVEMENTS, MOCK_BATCHES, CATEGORIES, ROLE_PERMISSIONS } from "@/constants";
import { genId } from "@/utils";

// ─── Auth ───
interface AuthState {
  user: User | null;
  login: (email: string, pw: string) => boolean;
  loginDirect: (user: User) => void;
  logout: () => void;
  hasPerm: (page: PageId) => boolean;
  defaultPage: () => PageId;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  login: (email, pw) => {
    const u = MOCK_USERS.find(u => u.email === email && u.password === pw);
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

// ─── Products ───
interface ProductState {
  products: Product[];
  addProduct: (product: Product) => void;
  adjustStock: (id: string, delta: number) => void;
  getLowStock: () => Product[];
}
export const useProductStore = create<ProductState>((set, get) => ({
  products: MOCK_PRODUCTS,
  addProduct: (product) => set(s => ({ products: [product, ...s.products] })),
  adjustStock: (id, delta) => set(s => ({
    products: s.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p),
  })),
  getLowStock: () => get().products.filter(p => p.stock <= p.minStock),
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
            unitPrice: unitType === "box" ? product.priceBox : product.priceIndividual,
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
      partialize: (state) => ({ items: state.items, customer: state.customer, payment: state.payment }),
    }
  )
);

// ─── Orders ───
interface OrderState {
  orders: Order[];
  addOrder: (order: Order) => void;
  todayRevenue: () => number;
}
export const useOrderStore = create<OrderState>((set, get) => ({
  orders: MOCK_ORDERS,
  addOrder: (order) => set(s => ({ orders: [order, ...s.orders] })),
  todayRevenue: () => get().orders.filter(o => o.status === "completed").reduce((s, o) => s + o.total, 0),
}));

// ─── Inventory ───
interface InventoryState {
  movements: StockMovement[];
  addMovement: (m: StockMovement) => void;
  totalIn: () => number;
  totalOut: () => number;
}
export const useInventoryStore = create<InventoryState>((set, get) => ({
  movements: MOCK_MOVEMENTS,
  addMovement: (m) => set(s => ({ movements: [m, ...s.movements] })),
  totalIn: () => get().movements.filter(m => m.type === "in").reduce((s, m) => s + m.quantity, 0),
  totalOut: () => get().movements.filter(m => m.type === "out").reduce((s, m) => s + m.quantity, 0),
}));

// ─── Batches (FIFO) ───
interface BatchState {
  batches: StockBatch[];
  addBatch: (batch: StockBatch) => void;
  consumeFIFO: (productId: string, qty: number) => void;
  getNearestExpiry: (productId: string) => string | null;
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

// ─── Settings (persisted) ───
interface SettingsState {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  update: (data: Partial<Pick<SettingsState, "storeName" | "storeAddress" | "storePhone">>) => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: "BakeShop",
      storeAddress: "Jl. Sudirman No. 123, Jakarta",
      storePhone: "+62 812-3456-7890",
      update: (data) => set(s => ({ ...s, ...data })),
    }),
    { name: "bakeshop-settings" }
  )
);
