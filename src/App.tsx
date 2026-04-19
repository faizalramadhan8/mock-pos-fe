import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuthStore, useLangStore, hydrateStores } from "@/stores";
import { getToken } from "@/api/client";
import { BakeryLogo } from "@/components/icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ROLE_PERMISSIONS } from "@/constants";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { PageId } from "@/types";
import { Toaster } from "react-hot-toast";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Home, ShoppingBag, Package, FileText, Settings,
} from "lucide-react";

// Code-split pages
const LoginPage = lazy(() => import("@/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import("@/pages/POSPage").then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import("@/pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const OrdersPage = lazy(() => import("@/pages/OrdersPage").then(m => ({ default: m.OrdersPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const DeviceApprovalPage = lazy(() => import("@/pages/DeviceApprovalPage").then(m => ({ default: m.DeviceApprovalPage })));

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
  const { t } = useLangStore();
  const { user, defaultPage } = useAuthStore();
  const [page, setPage] = useState<PageId>("pos");
  const [initializing, setInitializing] = useState(true);

  // Standalone routes for device approval links (sent via WhatsApp to owners).
  // Short-circuit before the normal auth/session flow — no login required,
  // the token in the URL is the authn.
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/approve" || path === "/reject") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <DeviceApprovalPage kind={path === "/approve" ? "approve" : "reject"} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  useEffect(() => {
    (async () => {
      if (getToken()) {
        const valid = await useAuthStore.getState().checkSession();
        if (valid) await hydrateStores();
      }
      setInitializing(false);
    })();
  }, []);

  const perms = user ? (ROLE_PERMISSIONS[user.role] || []) : [];
  const navItems = (["dashboard", "pos", "inventory", "orders", "settings"] as PageId[]).filter(p => perms.includes(p));
  const currentPage = user ? (perms.includes(page) ? page : defaultPage()) : null;

  // Dynamic page title
  useEffect(() => {
    const pageName = currentPage ? (t[currentPage as keyof typeof t] as string || t.appName) : t.signIn;
    document.title = `${pageName} — Toko Bahan Kue Santi POS`;
  }, [currentPage, t]);

  // Keyboard nav for bottom nav (Arrow Left/Right cycles tabs)
  const handleNavKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % navItems.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + navItems.length) % navItems.length;
    if (next >= 0) {
      e.preventDefault();
      setPage(navItems[next]);
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    }
  }, [navItems, setPage]);

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

  if (initializing) return (
    <div className={`min-h-screen flex items-center justify-center ${th.bg}`}>
      <div className="flex flex-col items-center gap-4">
        <BakeryLogo size={56} />
        <div className="w-6 h-6 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!user) return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
      </ErrorBoundary>
      <Toaster position="top-center" toastOptions={{ className: "!rounded-2xl !text-sm !font-semibold", duration: 2500 }} />
    </>
  );

  return (
    <div className={`min-h-screen ${th.bg}`}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b backdrop-blur-xl ${th.dark ? "bg-[#1E293B]/85" : "bg-white/85"} ${th.bdr}`}>
        <div className="flex items-center gap-3">
          <BakeryLogo size={32} />
          <div>
            <p className={`text-sm font-extrabold leading-tight tracking-tight ${th.tx}`}>{t[currentPage as keyof typeof t] as string || t.appName}</p>
            <p className={`text-[10px] ${th.txm}`}>{user.name} · {(t.roles as Record<string, string>)[user.role]}</p>
          </div>
        </div>
        <NotificationBell />
      </header>

      {/* Content */}
      <main className="pt-[68px] pb-24 px-4 max-w-5xl mx-auto">
        <ErrorBoundary onReset={() => setPage("dashboard")}>
          <Suspense fallback={<PageLoader />}>
            <div key={currentPage} className="animate-page-enter">
              {renderPage()}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Bottom Nav */}
      <nav aria-label="Main navigation" className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl pb-safe ${th.dark ? "bg-[#1E293B]/92" : "bg-white/92"} ${th.bdr}`}>
        <div role="tablist" className="flex items-center justify-around max-w-md mx-auto h-16">
          {navItems.map((id, idx) => {
            const active = currentPage === id;
            return (
              <button key={id} role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
                onClick={() => setPage(id)} onKeyDown={(e) => handleNavKeyDown(e, idx)}
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
