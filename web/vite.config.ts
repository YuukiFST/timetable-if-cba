import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// Inline do CSS no index.html: elimina o request render-blocking (Lighthouse FCP).
// ~5 KB gzip de CSS não justificam uma ida à rede antes do primeiro paint.
const inlineCss = (): Plugin => ({
  name: "inline-css",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const bundle = ctx.bundle
      if (!bundle) return html
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && name.endsWith(".css")) {
          delete bundle[name]
          return html.replace(
            new RegExp(`<link[^>]*href="/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`),
            () => `<style>${String(asset.source)}</style>`,
          )
        }
      }
      return html
    },
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    inlineCss(),
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
