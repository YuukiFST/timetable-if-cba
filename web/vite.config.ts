import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: {
        name: "Trilha IF CBA",
        short_name: "Trilha",
        description: "Matérias, progresso e horários — IFMT Campus Cuiabá",
        lang: "pt-BR",
        display: "standalone",
        theme_color: "#2f9e41",
        background_color: "#f7faf7",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // app shell no precache; JSON de dados via SWR para funcionar offline e atualizar em background (F4)
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "dados-edupage", expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
})
