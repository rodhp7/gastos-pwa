/* =========================================================
   GUARDAR / CARGAR
========================================================= */

/* Error de guardado. La franja #save-toast la comparten otros avisos
   (deshacer, confirmaciones): el texto se fija aquí y, al guardar bien, solo
   se oculta si lo que mostraba era este error. */
function showToast(isError) {
  var el = document.getElementById("save-toast");
  if (!el) return;
  if (isError) {
    el.textContent = "No se pudo guardar. Revisa el espacio disponible en tu dispositivo.";
    el.dataset.error = "1";
    el.style.display = "block";
  } else if (el.dataset.error) {
    delete el.dataset.error;
    el.style.display = "none";
  }
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/* Única definición de qué se guarda. Guardar en el dispositivo, subir a la
   nube y crear copias usan este mismo paquete: antes había tres copias de la
   lista y la de la nube no incluía las deudas, así que al sincronizar se
   perdían. */
function buildPayload() {
  return {
    version: DATA_VERSION,
    expenses: safeArray(state.expenses),
    incomes: safeArray(state.incomes),
    budgets: plainObject(state.budgets),
    recurringExpenses: safeArray(state.recurringExpenses),
    savingsGoals: safeArray(state.savingsGoals),
    transfers: safeArray(state.transfers),
    accountOpeningBalances: plainObject(state.accountOpeningBalances),
    accountMetadata: plainObject(state.accountMetadata),
    pendingPayments: safeArray(state.pendingPayments),
    debts: safeArray(state.debts),
    settings: {
      categories: safeArray(CATEGORIES),
      paymentMethods: safeArray(PAYMENT_METHODS),
      incomeCategories: safeArray(INCOME_CATEGORIES),
      incomePaymentMethods: safeArray(INCOME_PAYMENT_METHODS),
      subcategories: safeArray(SUBCATEGORIES)
    }
  };
}

/* Contraparte de buildPayload: vuelca un paquete ya migrado en el estado. Las
   listas de configuración vacías se ignoran para no dejar la app sin
   categorías ni métodos de pago. */
function applyPayload(data) {
  state.expenses = safeArray(data.expenses);
  state.incomes = safeArray(data.incomes);
  state.budgets = plainObject(data.budgets);
  state.recurringExpenses = safeArray(data.recurringExpenses);
  state.savingsGoals = safeArray(data.savingsGoals);
  state.transfers = safeArray(data.transfers);
  state.accountOpeningBalances = plainObject(data.accountOpeningBalances);
  state.accountMetadata = plainObject(data.accountMetadata);
  state.pendingPayments = safeArray(data.pendingPayments);
  state.debts = safeArray(data.debts);

  var settings = plainObject(data.settings);
  if (Array.isArray(settings.categories) && settings.categories.length) CATEGORIES = settings.categories;
  if (Array.isArray(settings.paymentMethods) && settings.paymentMethods.length) PAYMENT_METHODS = settings.paymentMethods;
  if (Array.isArray(settings.incomeCategories) && settings.incomeCategories.length) INCOME_CATEGORIES = settings.incomeCategories;
  if (Array.isArray(settings.incomePaymentMethods) && settings.incomePaymentMethods.length) INCOME_PAYMENT_METHODS = settings.incomePaymentMethods;
  if (Array.isArray(settings.subcategories)) SUBCATEGORIES = settings.subcategories;
}

/* Los datos principales tienen prioridad sobre las copias: si no caben,
   se liberan copias de la más antigua a la más reciente y se reintenta.
   Con muchos movimientos, las 5 copias podían ocupar casi todo el espacio
   del navegador y hacer fallar el guardado principal. */
function guardarConPrioridad(clave, valor) {
  try { localStorage.setItem(clave, valor); return; } catch (e) {
    var indice = readBackupIndex();
    while (indice.length) {
      localStorage.removeItem(BACKUP_PREFIX + indice.shift());
      localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(indice));
      try { localStorage.setItem(clave, valor); return; } catch (otro) {}
    }
    throw e;
  }
}

function persist() {
  if (typeof normalizeState === "function") normalizeState();
  normalizePaymentMethodOrder();
  rebuildIndexes();
  var payload = buildPayload();
  try {
    guardarConPrioridad(STORAGE_KEY, JSON.stringify(payload));
    maybeCreateLocalBackup(payload);
    if (window.GastosAuth && window.GastosAuth.getUser && window.GastosAuth.getUser() && window.GastosAuth.savePayload) {
      window.GastosAuth.savePayload(payload).catch(function (err) { console.error("No se pudo sincronizar la cuenta.", err); });
    }
  } catch (e) {
    console.error("No se pudieron guardar los datos.", e);
    if (typeof showToast === "function") showToast("No se pudieron guardar los datos.");
  }
}

function readBackupIndex() {
  try {
    var raw = JSON.parse(localStorage.getItem(BACKUP_INDEX_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(Number).filter(function (ts) {
      return Number.isFinite(ts) && ts > 0 && localStorage.getItem(BACKUP_PREFIX + ts);
    }).sort(function (a, b) { return a - b; });
  } catch (e) {
    return [];
  }
}

/* Guarda una copia ya, sin esperar al turno diario. Se usa antes de una
   acción destructiva (borrar todos los movimientos) para poder deshacerla. */
function crearCopiaLocal(payload) {
  try {
    var index = readBackupIndex();
    var now = Date.now();
    localStorage.setItem(BACKUP_PREFIX + now, JSON.stringify(payload));
    index.push(now);
    while (index.length > MAX_LOCAL_BACKUPS) {
      var old = index.shift();
      localStorage.removeItem(BACKUP_PREFIX + old);
    }
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (e) {
    console.warn("No se pudo crear la copia local.", e);
    return false;
  }
}

function maybeCreateLocalBackup(payload) {
  var index = readBackupIndex();
  var last = index.length ? index[index.length - 1] : 0;
  if (Date.now() - Number(last) < 24 * 60 * 60 * 1000) return;
  crearCopiaLocal(payload);
}

function listLocalBackups() {
  return readBackupIndex().map(function (ts) { return { timestamp: ts, date: new Date(ts) }; });
}

function restoreLocalBackup(timestamp) {
  try {
    var raw = localStorage.getItem(BACKUP_PREFIX + timestamp);
    if (!raw) return false;
    applyPayload(migrateData(JSON.parse(raw)));
    sanitizeSubcategories();
    normalizePaymentMethodOrder();
    persist();
    render();
    return true;
  } catch (e) {
    console.error("No se pudo restaurar el backup.", e);
    return false;
  }
}


/* Se conserva porque las categorías guardadas pueden tener un emoji propio
   (iconEmoji) y hay que seguir dibujándolo. */
function isUsableEmoji(value){
  if (!value) return false;
  var text = String(value).trim();
  if (!text || text.length > 8) return false;
  return /[^\x00-\x7F]/.test(text);
}

function iconOrEmoji(emoji, name, size, color){
  if (isUsableEmoji(emoji)) {
    return '<span class="nexo-emoji-icon" aria-hidden="true" style="font-size:' + (size || 16) + 'px;line-height:1;display:inline-flex;align-items:center;justify-content:center">' + escapeHtml(emoji) + '</span>';
  }
  return icon(name || "briefcase", size, color);
}

function sanitizeSubcategories() {
  if (!Array.isArray(SUBCATEGORIES)) {
    SUBCATEGORIES = [];
    return;
  }
  SUBCATEGORIES.forEach(function (sub) {
    if (!sub || typeof sub !== "object") return;
    delete sub.icon;
    delete sub.iconName;
    delete sub.iconEmoji;
    delete sub.emoji;
  });
}

function saveSettings() {

  sanitizeSubcategories();

  try {

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        categories: CATEGORIES,
        paymentMethods: PAYMENT_METHODS,
        incomeCategories: INCOME_CATEGORIES,
        incomePaymentMethods: INCOME_PAYMENT_METHODS,
        subcategories: SUBCATEGORIES
      })
    );

    showToast(false);

  } catch (e) {

    showToast(true);

  }

}

function migrateData(data) {
  data = data && typeof data === "object" ? data : {};
  var version = Number(data.version || 1);

  // v1/v2 -> v3: fechas se normalizan al formato local YYYY-MM-DD y
  // se mantiene la estructura existente sin descartar información.
  if (version < 3) {
    data.expenses = safeArray(data.expenses).map(function (item) {
      if (item && item.date) item.date = normalizeDate(item.date);
      return item;
    });
    data.incomes = safeArray(data.incomes).map(function (item) {
      if (item && item.date) item.date = normalizeDate(item.date);
      return item;
    });
    data.recurringExpenses = safeArray(data.recurringExpenses).map(function (item) {
      if (item && item.startDate) item.startDate = normalizeDate(item.startDate);
      if (item && item.nextDate) item.nextDate = normalizeDate(item.nextDate);
      return item;
    });
    data.version = 3;
  }

  if (version < 4) {
    data.transfers = safeArray(data.transfers);
    data.accountOpeningBalances = data.accountOpeningBalances && typeof data.accountOpeningBalances === "object" ? data.accountOpeningBalances : {};
    data.pendingPayments = safeArray(data.pendingPayments);
    data.version = 4;
  }

  if (version < 5) {
    data.accountMetadata = data.accountMetadata && typeof data.accountMetadata === "object" ? data.accountMetadata : {};
    data.pendingPayments = safeArray(data.pendingPayments);
    data.version = 5;
  }

  if (version < 6) {
    data.debts = safeArray(data.debts);
    data.version = 6;
  }

  return data;
}

/* Marca de tiempo de la copia usada si los datos principales estaban dañados;
   el arranque lo avisa. */
var datosRecuperadosDe = null;

function loadData() {
  var raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    applyPayload(migrateData(JSON.parse(raw)));
    normalizePaymentMethodOrder();
  } catch (e) {
    /* Datos ilegibles (p. ej. una escritura cortada). Antes se arrancaba
       vacío y el primer guardado los sobrescribía, perdiéndolo todo aunque
       hubiera copias sanas. Ahora se apartan los datos dañados y se recupera
       la copia automática más reciente que se pueda leer. */
    console.warn("Datos guardados ilegibles; se intentará recuperar una copia.", e);
    try { if (raw) localStorage.setItem(STORAGE_KEY + "-danado", raw); } catch (ignorado) {}
    var indice = readBackupIndex();
    for (var i = indice.length - 1; i >= 0; i--) {
      try {
        applyPayload(migrateData(JSON.parse(localStorage.getItem(BACKUP_PREFIX + indice[i]))));
        normalizePaymentMethodOrder();
        datosRecuperadosDe = indice[i];
        return;
      } catch (ignorado) {}
    }
  }
}

