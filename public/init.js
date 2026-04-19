// Script de inicialização carregado no <head> antes do React renderizar.
// Fica fora do bundle pra permitir CSP sem 'unsafe-inline' em script-src.
(function () {
  // Anti-flash: aplica tema salvo antes do primeiro paint.
  try {
    var saved = localStorage.getItem('compasss_theme');
    var systemPref = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    var theme = saved || systemPref;
    document.documentElement.setAttribute('data-theme', theme);
    var m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = theme === 'light' ? '#ffffff' : '#111111';
    document.head.appendChild(m);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// Registro do service worker (PWA). Executa depois do load pra não bloquear render.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js');
  });
}
