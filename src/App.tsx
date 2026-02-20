import { lazy, Suspense, useState } from "react";
import { useAuthStore, useThemeStore, useLangStore } from "@/stores";
import { BakeryLogo } from "@/components/icons";
import { ROLE_PERMISSIONS } from "@/constants";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { PageId } from "@/types";
import { Toaster } from "react-hot-toast";
import {
  Home, ShoppingBag, Package, FileText, Settings,
  Sun, Moon, LogOut,
} from "lucide-react";

// Code-split pages
const LoginPage = lazy(() => import("@/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import("@/pages/POSPage").then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import("@/pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const OrdersPage = lazy(() => import("@/pages/OrdersPage").then(m => ({ default: m.OrdersPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));

const NAV_ICONS: Record<PageId, React.ReactNode> = {
  dashboard: <Home size={20} />,
  pos: <ShoppingBag size={20} />,
  inventory: <Package size={20} />,
  orders: <FileText size={20} />,
  settings: <Settings size={20} />,
};

function PageLoader() {
  const th = useThemeClasses();
  return (
    <div className={`flex items-center justify-center py-20 ${th.txf}`}>
      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const { dark, toggle } = useThemeStore();
  const { user, logout, defaultPage } = useAuthStore();
  const [page, setPage] = useState<PageId>("pos");

  if (!user) return (
    <>
      <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
      <Toaster position="top-center" toastOptions={{
        className: "!rounded-2xl !text-sm !font-semibold",
        duration: 2500,
      }} />
    </>
  );

  const perms = ROLE_PERMISSIONS[user.role] || [];
  const navItems = (["dashboard", "pos", "inventory", "orders", "settings"] as PageId[]).filter(p => perms.includes(p));
  const currentPage = perms.includes(page) ? page : defaultPage();

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <DashboardPage />;
      case "pos": return <POSPage />;
      case "inventory": return <InventoryPage />;
      case "orders": return <OrdersPage />;
      case "settings": return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className={`min-h-screen ${th.bg}`}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b backdrop-blur-xl ${th.dark ? "bg-[#1C1916]/85" : "bg-white/85"} ${th.bdr}`}>
        <div className="flex items-center gap-3">
          <BakeryLogo size={32} />
          <div>
            <p className={`text-sm font-extrabold leading-tight tracking-tight ${th.tx}`}>{t[currentPage as keyof typeof t] as string || t.appName}</p>
            <p className={`text-[10px] ${th.txm}`}>{user.name} · {(t.roles as Record<string, string>)[user.role]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className={`p-2 rounded-xl ${th.txm}`}>
            {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>
          <button onClick={() => setLang(lang === "en" ? "id" : "en")}
            className={`px-2 py-1.5 rounded-xl text-[11px] font-extrabold ${th.tx}`}>
            {lang === "en" ? "🇮🇩" : "🇬🇧"}
          </button>
          <button onClick={logout} className="p-2 rounded-xl text-[#C4504A]">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-[68px] pb-24 px-4 max-w-5xl mx-auto">
        <Suspense fallback={<PageLoader />}>
          {renderPage()}
        </Suspense>
      </main>

      {/* Bottom Nav */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl pb-safe ${th.dark ? "bg-[#1C1916]/92" : "bg-white/92"} ${th.bdr}`}>
        <div className="flex items-center justify-around max-w-md mx-auto h-16">
          {navItems.map(id => {
            const active = currentPage === id;
            return (
              <button key={id} onClick={() => setPage(id)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-2xl transition-colors ${active ? th.acc : th.txf}`}>
                <div className={`p-1.5 rounded-xl transition-colors ${active ? th.accBg : ""}`}>
                  {NAV_ICONS[id]}
                </div>
                <span className="text-[10px] font-semibold">{t[id as keyof typeof t] as string}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast notifications */}
      <Toaster position="top-center" toastOptions={{
        className: "!rounded-2xl !text-sm !font-semibold",
        duration: 2500,
      }} />
    </div>
  );
}
