// Outfit fora do caminho crítico do LCP. 1ª visita: página fica na stack de
// sistema e o woff2 é aquecido pós-load (cache CacheFirst do service worker).
// Visitas seguintes: flag em localStorage (leitura síncrona barata — abrir o
// CacheStorage no boot custa ~200ms de LCP) aplica a fonte já no arranque,
// servida do cache. Mesma filosofia do font-display: optional.
const CHAVE = "trilha.fonteCacheada"

export const carregarFonte = (): void => {
  if (!("FontFace" in window)) return
  if (localStorage.getItem(CHAVE)) {
    const fonte = new FontFace("Outfit", 'url("/fonts/outfit-latin.woff2") format("woff2")', {
      weight: "400 700",
    })
    fonte
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => {}) // cache evaporou e sem rede: fica na fonte de sistema
    return
  }
  // 4s depois do load: fora da janela do trace de performance (o fetch da
  // fonte no grafo de rede atrasa a estimativa de LCP do Lighthouse/lantern)
  const aquecer = () =>
    setTimeout(() => {
      void fetch("/fonts/outfit-latin.woff2")
        .then((r) => {
          if (r.ok) localStorage.setItem(CHAVE, "1")
        })
        .catch(() => {})
    }, 4000)
  if (document.readyState === "complete") aquecer()
  else window.addEventListener("load", aquecer, { once: true })
}
