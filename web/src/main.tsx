import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { registerSW } from "virtual:pwa-register"
import { migrarPlanoLegado } from "./storage"
import { carregarFonte } from "./fonte"
import { loadCursos } from "./data/api"
import { App } from "./App"
import "./index.css"

// SW só depois do load + folga: o precache (~300 KB) durante o arranque
// disputa rede/CPU com o caminho crítico do LCP; offline segue garantido
// a partir do momento em que o registro completa
const registrarSW = () => setTimeout(() => registerSW({ immediate: true }), 4000)
if (document.readyState === "complete") registrarSW()
else window.addEventListener("load", registrarSW, { once: true })
migrarPlanoLegado()
void carregarFonte()
// dispara o fetch (já aquecido pelo <link rel="preload">) antes do primeiro
// render; o useQuery de cursos reaproveita a promise do cache
loadCursos().catch(() => {})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
