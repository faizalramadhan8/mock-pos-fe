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
  dashboard: <Home size={26} />,
  pos: <ShoppingBag size={26} />,
  inventory: <Package size={26} />,
  orders: <FileText size={26} />,
  settings: <Settings size={26} />,
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
        <div className="w-6 h-6 border-2 border-[#E11D48] border-t-transparent rounded-full animate-spin" />
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
      {/* Header — max-width matches main so the logo/title line up with page
          content on wide screens, not floating at the extreme left edge. */}
      <header className={`fixed top-0 left-0 right-0 z-40 h-[72px] border-b backdrop-blur-xl ${th.dark ? "bg-[#261620]/85" : "bg-white/90"} ${th.bdr}`}>
        <div className="max-w-4xl mx-auto h-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <BakeryLogo size={44} />
            <div className="min-w-0">
              <p className={`font-display text-lg font-black leading-tight tracking-tight truncate ${th.tx}`} style={{ fontVariationSettings: '"wght" 800' }}>
                {t[currentPage as keyof typeof t] as string || t.appName}
              </p>
              <p className={`text-sm truncate ${th.txm}`}>{user.name} · {(t.roles as Record<string, string>)[user.role]}</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      {/* Content — max-w-4xl (≈1280px at 20px base) matches expected tablet/
          desktop usage; the app is never used on 1600px+ monitors and
          limiting width prevents awkward grid stretching. */}
      <main className="pt-[84px] pb-28 px-4 max-w-4xl mx-auto">
        <ErrorBoundary onReset={() => setPage("dashboard")}>
          <Suspense fallback={<PageLoader />}>
            <div key={currentPage} className="animate-page-enter">
              {renderPage()}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Bottom Nav — active tab now has a bottom-aligned pink indicator bar
          plus a subtle scale bounce, so location is spatially obvious even
          with glance-and-tap usage. */}
      <nav aria-label="Main navigation" className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl pb-safe ${th.dark ? "bg-[#261620]/92" : "bg-white/95"} ${th.bdr}`}>
        <div role="tablist" className="flex items-center justify-around max-w-md mx-auto h-20">
          {navItems.map((id, idx) => {
            const active = currentPage === id;
            return (
              <button key={id} role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
                onClick={() => setPage(id)} onKeyDown={(e) => handleNavKeyDown(e, idx)}
                className={`relative flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all ${active ? th.acc : th.txf}`}>
                <div className={`p-2 rounded-2xl transition-all ${active ? `${th.accBg} scale-110` : ""}`}>
                  {NAV_ICONS[id]}
                </div>
                <span className={`text-xs font-semibold transition-all ${active ? "font-black" : ""}`}>
                  {t[id as keyof typeof t] as string}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute -top-px left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-gradient-to-r from-[#FFB5C0] to-[#E11D48]"
                  />
                )}
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
