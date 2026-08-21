// Service worker minimo: existe apenas para permitir a instalacao do PWA.
// Nao faz cache de nada — todo request segue direto para a rede, sempre com dados atuais.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // passthrough — deixa o navegador tratar normalmente
});
