/* =========================================================
   ARRANQUE
========================================================= */

function restoreFixedFinanceLogo(pay) {
  if (!pay || !pay.id) return;
  var source = DEFAULT_PAYMENT_METHODS.find(function (p) { return p.id === pay.id; });
  if (source && source.icon) pay.icon = source.icon;
}

/* Los métodos de fábrica (Efectivo, Yape, BCP…) conservan su icono, pero
   nombre, color, orden y si existen o no los decide la persona. Antes esta
   función los reconstruía desde cero en cada arranque: un método renombrado
   volvía a su nombre original, uno eliminado reaparecía y el orden elegido
   se perdía. Solo se retira el antiguo método "transferencia". */
function ensureFixedFinanceMethods() {
  function limpiar(lista) {
    return dedupePaymentMethods(lista)
      .filter(function (p) { return p.id !== "transferencia"; })
      .map(function (p) { restoreFixedFinanceLogo(p); return p; });
  }

  PAYMENT_METHODS = limpiar(PAYMENT_METHODS);
  INCOME_PAYMENT_METHODS = limpiar(INCOME_PAYMENT_METHODS);

  if (!PAYMENT_METHODS.length) PAYMENT_METHODS = JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
  if (!INCOME_PAYMENT_METHODS.length) INCOME_PAYMENT_METHODS = JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
}

initializeDefaults();
loadSettings();
loadData();
initializeDefaults();
ensureFixedFinanceMethods();
rebuildIndexes();
normalizeState();
generateRecurringExpenses();
persist();

/* Puente con auth.js para la sincronización en la nube. Usa el mismo paquete
   que el guardado local (buildPayload/applyPayload). */
window.GastosAppBridge = {
  getPayload: function () {
    if (typeof normalizeState === "function") normalizeState();
    normalizePaymentMethodOrder(); rebuildIndexes();
    return buildPayload();
  },
  loadPayload: function (payload) {
    var data = migrateData(payload || {});
    if (!data.budgets || typeof data.budgets !== "object") data.budgets = Object.assign({}, DEFAULT_BUDGETS);
    applyPayload(data);
    initializeDefaults(); ensureFixedFinanceMethods(); normalizePaymentMethodOrder(); rebuildIndexes(); normalizeState(); generateRecurringExpenses();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
    render();
  },
  render: render
};
render();

if (datosRecuperadosDe) {
  var fechaCopia = new Date(datosRecuperadosDe);
  mostrarAviso("Tus datos no se podían leer. Se recuperó la copia de " + etiquetaDia(fechaCopia).toLowerCase() + " a las " +
    fechaCopia.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }) + ".");
}

document.addEventListener("click", function (event) {
  var openBtn = event.target.closest && event.target.closest("[data-account-open]");
  if (!openBtn || !window.GastosAuth || !window.GastosAuth.open) return;
  var menu = document.getElementById("top-menu-dropdown");
  var menuBtn = document.getElementById("top-menu-btn");
  if (menu) menu.classList.remove("open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  window.GastosAuth.open();
});

function updateConnectionStatus() {
  var el = document.getElementById("connection-status");
  if (!el) return;
  el.style.display = navigator.onLine ? "none" : "block";
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

