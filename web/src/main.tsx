import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { registerSW } from "virtual:pwa-register"
import { migrarPlanoLegado } from "./storage"
import { App } from "./App"
import "./index.css"

registerSW({ immediate: true })
migrarPlanoLegado()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
