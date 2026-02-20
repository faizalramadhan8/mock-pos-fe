# 🧁 BakeShop POS

Point-of-Sale system for baking ingredient stores. Mobile-first PWA with bilingual support (EN/ID), dark/light mode, and warm artisan design.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open **http://localhost:3000** in your browser.

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Owner (Super Admin) | rina@bakeshop.id | admin |
| Manager (Admin) | andi@bakeshop.id | admin |
| Cashier | siti@bakeshop.id | admin |
| Staff (User) | budi@bakeshop.id | admin |

Or use the **Quick demo login** buttons on the login page.

## Features

- 🛒 **Cashier/POS** — Product grid, category filters with SVG icons, cart, 3 payment methods, checkout
- 📦 **Inventory** — Stock In/Out, movement log, net flow stats
- 🧾 **Orders** — Order history, status filtering, payment badges
- 🏠 **Dashboard** — Revenue stats, recent orders, low stock alerts
- ⚙️ **Settings** — Theme toggle, language switch, store info

## Tech Stack

- React 19 + TypeScript
- Vite 7 (build)
- Tailwind CSS v4
- Zustand (state)
- Lucide React (icons)
- DM Sans (font)

## Product Images

Product cards use images from `/public/products/`. If no image found, falls back to SVG category icon.

To add real images:
1. Place `.png` / `.jpg` files in `public/products/`
2. File names referenced in `src/constants/index.ts` → `MOCK_PRODUCTS[].image`

## Build

```bash
npm run build    # Output in dist/
```
