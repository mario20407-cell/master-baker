// La app ya no usa Service Worker (vite-plugin-pwa fue removido). Este kill-switch
// desinstala cualquier SW/caches que hayan quedado instalados en navegadores de
// visitas anteriores, para que dejen de servir bundles viejos desde cache offline.
export function killServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(reg => reg.unregister()))
    .catch(() => {})

  if (window.caches) {
    caches.keys()
      .then(names => names.forEach(name => caches.delete(name)))
      .catch(() => {})
  }
}
