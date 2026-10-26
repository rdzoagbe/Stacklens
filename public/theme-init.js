// Applies the saved colour theme before the page paints, so a light-mode
// reader never sees a dark flash. A file rather than an inline script because
// the Content-Security-Policy refuses inline scripts (src/lib/csp.test.js).
// The choice is kept in this browser only ('theme': dark, light or system);
// src/lib/theme.js is the same rule for the switch in the app.
(function () {
  var theme = 'dark';
  try {
    var choice = localStorage.getItem('theme');
    if (choice === 'light') theme = 'light';
    else if (choice === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch (e) { /* storage blocked: the default theme */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
