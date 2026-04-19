/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "TBK Santi - Baking Ingredients Depot",
        short_name: "TBK Santi",
        description: "Baking ingredients depot point-of-sale system",
        theme_color: "#1E40AF",
        background_color: "#F8FAFC",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/main_logo.jpeg", sizes: "any", type: "image/jpeg", purpose: "any" },
          { src: "/main_logo.jpeg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 3000 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
