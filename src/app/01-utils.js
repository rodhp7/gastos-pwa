/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function icon(name, size, color) {

  size = size || 16;

  return (
    '<svg viewBox="0 0 24 24"' +
    ' width="' + size + '"' +
    ' height="' + size + '"' +
    ' fill="none"' +
    ' stroke="' + (color || "currentColor") + '"' +
    ' stroke-width="2"' +
    ' stroke-linecap="round"' +
    ' stroke-linejoin="round">' +
    (ICONS[name] || ICONS.more) +
    "</svg>"
  );

}

var categoryIndex = Object.create(null);
var paymentIndex = Object.create(null);
var incomeCategoryIndex = Object.create(null);
var incomePaymentIndex = Object.create(null);
var subcategoryIndex = Object.create(null);

var dateUtils = window.GastosDateUtils;
var parseLocalDate = dateUtils.parseLocalDate;
var localDateKey = dateUtils.localDateKey;
var normalizeDate = dateUtils.normalizeDate;
var monthKey = dateUtils.monthKey;
var formatMovementDateTime = dateUtils.formatMovementDateTime;


function safeArray(value){ return window.GastosFinanceCore.safeArray(value); }

function normalizeAmount(value){ return window.GastosFinanceCore.normalizeAmount(value); }

function normalizeCreatedAt(value) {
  var numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  var parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeExpense(item) {
  item = item && typeof item === "object" ? item : {};
  var category = categoryIndex[item.category] ? item.category : (CATEGORIES[0] ? CATEGORIES[0].id : "otros");
  var validSubs = SUBCATEGORIES.filter(function (s) { return (s.kind || "expense") === "expense" && (s.categoryId || s.category || s.parentCategory) === category; });
  var subcategory = validSubs.some(function (s) { return s.id === item.subcategory; }) ? item.subcategory : "";

  return {
    id: item.id || "expense-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    amount: normalizeAmount(item.amount),
    date: normalizeDate(item.date),
    category: category,
    subcategory: subcategory,
    paymentMethod: paymentIndex[item.paymentMethod] ? item.paymentMethod : (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "efectivo"),
    note: typeof item.note === "string" ? item.note : "",
    createdAt: normalizeCreatedAt(item.createdAt),
    recurringId: typeof item.recurringId === "string" ? item.recurringId : undefined,
    occurrenceDate: item.occurrenceDate ? normalizeDate(item.occurrenceDate) : undefined,
    debtId: typeof item.debtId === "string" ? item.debtId : undefined
  };
}

function normalizeIncome(item) {
  item = item && typeof item === "object" ? item : {};
  var category = incomeCategoryIndex[item.category] ? item.category : (INCOME_CATEGORIES[0] ? INCOME_CATEGORIES[0].id : "");
  var validSubs = SUBCATEGORIES.filter(function (s) { return (s.kind || "expense") === "income" && (s.categoryId || s.category || s.parentCategory) === category; });
  var subcategory = validSubs.some(function (s) { return s.id === item.subcategory; }) ? item.subcategory : "";
  return {
    id: item.id || "income-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    amount: normalizeAmount(item.amount),
    date: normalizeDate(item.date),
    category: category,
    subcategory: subcategory,
    paymentMethod: incomePaymentIndex[item.paymentMethod] ? item.paymentMethod : (INCOME_PAYMENT_METHODS[0] ? INCOME_PAYMENT_METHODS[0].id : ""),
    note: typeof item.note === "string" ? item.note : "",
    createdAt: normalizeCreatedAt(item.createdAt),
    debtId: typeof item.debtId === "string" ? item.debtId : undefined
  };
}

function normalizeRecurring(item) {
  item = item && typeof item === "object" ? item : {};
  var category = categoryIndex[item.category] ? item.category : (CATEGORIES[0] ? CATEGORIES[0].id : "otros");
  var validSubs = SUBCATEGORIES.filter(function (s) { return (s.kind || "expense") === "expense" && (s.categoryId || s.category || s.parentCategory) === category; });
  return {
    id: item.id || "recurring-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Gasto recurrente",
    amount: normalizeAmount(item.amount),
    frequency: ["weekly", "monthly", "yearly"].indexOf(item.frequency) >= 0 ? item.frequency : "monthly",
    startDate: normalizeDate(item.startDate || item.nextDate),
    nextDate: normalizeDate(item.nextDate || item.startDate),
    category: category,
    subcategory: validSubs.some(function (s) { return s.id === item.subcategory; }) ? item.subcategory : "",
    paymentMethod: paymentIndex[item.paymentMethod] ? item.paymentMethod : (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "efectivo"),
    note: typeof item.note === "string" ? item.note : "",
    active: item.active !== false
  };
}

function normalizeGoal(item) {
  item = item && typeof item === "object" ? item : {};
  return {
    id: item.id || "goal-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Meta",
    target: normalizeAmount(item.target),
    saved: Math.min(normalizeAmount(item.saved), normalizeAmount(item.target)),
    targetDate: typeof item.targetDate === 'string' ? item.targetDate : '',
    contributions: Array.isArray(item.contributions) ? item.contributions.map(function(c){ return { amount: normalizeAmount(c.amount), createdAt: Number(c.createdAt)||Date.now() }; }).filter(function(c){ return c.amount > 0; }) : []
  };
}



function normalizePendingPayment(item) {
  item = item && typeof item === "object" ? item : {};
  var category = categoryIndex[item.category] ? item.category : (CATEGORIES[0] ? CATEGORIES[0].id : "otros");
  var validSubs = SUBCATEGORIES.filter(function (s) { return (s.kind || "expense") === "expense" && (s.categoryId || s.category || s.parentCategory) === category; });
  return {
    id: item.id || "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Pago pendiente",
    amount: normalizeAmount(item.amount),
    dueDate: normalizeDate(item.dueDate || item.date),
    category: category,
    subcategory: validSubs.some(function (s) { return s.id === item.subcategory; }) ? item.subcategory : "",
    paymentMethod: paymentIndex[item.paymentMethod] ? item.paymentMethod : (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "efectivo"),
    note: typeof item.note === "string" ? item.note : "",
    recurringId: typeof item.recurringId === "string" ? item.recurringId : "",
    occurrenceDate: item.occurrenceDate ? normalizeDate(item.occurrenceDate) : "",
    createdAt: Number(item.createdAt) || Date.now()
  };
}

function normalizeTransfer(item) {
  item = item && typeof item === "object" ? item : {};
  var from = paymentIndex[item.fromAccount] ? item.fromAccount : (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "efectivo");
  var to = paymentIndex[item.toAccount] ? item.toAccount : (PAYMENT_METHODS[1] ? PAYMENT_METHODS[1].id : from);
  return {
    id: item.id || "transfer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    amount: normalizeAmount(item.amount),
    date: normalizeDate(item.date),
    fromAccount: from,
    toAccount: to,
    note: typeof item.note === "string" ? item.note : "",
    createdAt: normalizeCreatedAt(item.createdAt) || Date.now()
  };
}

function accountOpeningBalance(accountId) {
  var value = state.accountOpeningBalances && state.accountOpeningBalances[accountId];
  return Number(value) || 0;
}

function accountBalance(accountId) {
  var balance = accountOpeningBalance(accountId);
  state.incomes.forEach(function (item) { if (item.paymentMethod === accountId) balance += Number(item.amount) || 0; });
  state.expenses.forEach(function (item) { if (item.paymentMethod === accountId) balance -= Number(item.amount) || 0; });
  (state.transfers || []).forEach(function (item) {
    var amount = Number(item.amount) || 0;
    if (item.fromAccount === accountId) balance -= amount;
    if (item.toAccount === accountId) balance += amount;
  });
  return balance;
}

function totalAccountBalance() {
  return PAYMENT_METHODS.reduce(function (total, method) { return total + accountBalance(method.id); }, 0);
}


function accountMeta(accountId) {
  var meta = state.accountMetadata && state.accountMetadata[accountId];
  return meta && typeof meta === "object" ? meta : {};
}

function isAccountHidden(accountId) {
  return accountMeta(accountId).hidden === true;
}

function visiblePaymentMethods(methods) {
  return (Array.isArray(methods) ? methods : []).filter(function (method) {
    return method && method.id && !isAccountHidden(method.id);
  });
}

function pendingPaymentsTotal() {
  return (state.pendingPayments || []).reduce(function (total, item) {
    return total + (Number(item.amount) || 0);
  }, 0);
}

function normalizeDebt(item) {
  item = item && typeof item === "object" ? item : {};
  var direction = item.direction === "owed" ? "owed" : "owe";
  var principal = normalizeAmount(item.principal);
  var balance = item.balance != null ? normalizeAmount(item.balance) : principal;
  if (!principal && balance) principal = balance;
  balance = Math.max(0, Math.min(balance, principal));
  /* La categoría es la del gasto (o ingreso, si te deben) que se crea al
     registrar un pago. Antes no se conservaba: cada guardado la borraba y
     los pagos acababan siempre en la primera categoría. */
  var categorias = direction === "owed" ? incomeCategoryIndex : categoryIndex;
  var category = categorias[item.category] ? item.category : "";
  var sub = category && item.subcategory ? subcategoryIndex[item.subcategory] : null;
  return {
    id: item.id || "debt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : (direction === "owed" ? "Préstamo dado" : "Deuda"),
    direction: direction,
    principal: principal,
    balance: balance,
    interestRate: Math.max(0, Number(item.interestRate) || 0),
    minPayment: Math.max(0, normalizeAmount(item.minPayment)),
    dueDate: item.dueDate ? normalizeDate(item.dueDate) : "",
    category: category,
    subcategory: sub && (sub.categoryId || sub.category || sub.parentCategory) === category ? item.subcategory : "",
    paymentMethod: paymentIndex[item.paymentMethod] ? item.paymentMethod : "",
    note: typeof item.note === "string" ? item.note : "",
    createdAt: normalizeCreatedAt(item.createdAt) || Date.now()
  };
}

function totalDebtBalance(direction) {
  return (state.debts || []).reduce(function (total, item) {
    return item.direction === direction ? total + (Number(item.balance) || 0) : total;
  }, 0);
}

function dedupeById(items) {
  var seen = Object.create(null);
  return items.filter(function (item) {
    if (!item.id || seen[item.id]) return false;
    seen[item.id] = true;
    return true;
  });
}

function normalizeState() {
  state.expenses = dedupeById(safeArray(state.expenses).map(normalizeExpense));
  state.incomes = dedupeById(safeArray(state.incomes).map(normalizeIncome));
  state.recurringExpenses = safeArray(state.recurringExpenses).map(normalizeRecurring);
  state.savingsGoals = safeArray(state.savingsGoals).map(normalizeGoal);
  state.transfers = dedupeById(safeArray(state.transfers).map(normalizeTransfer)).filter(function (item) { return item.amount > 0 && item.fromAccount !== item.toAccount; });
  state.accountOpeningBalances = state.accountOpeningBalances && typeof state.accountOpeningBalances === "object" ? state.accountOpeningBalances : {};
  state.accountMetadata = state.accountMetadata && typeof state.accountMetadata === "object" ? state.accountMetadata : {};
  state.pendingPayments = dedupeById(safeArray(state.pendingPayments).map(normalizePendingPayment)).filter(function (item) { return item.amount > 0; });
  state.debts = dedupeById(safeArray(state.debts).map(normalizeDebt)).filter(function (item) { return item.principal > 0; });
  state.budgets = state.budgets && typeof state.budgets === "object" ? state.budgets : {};
}

function makeId(prefix){ return window.GastosFinanceCore.makeId(prefix); }

/* Los colores se escriben directamente dentro de atributos style al renderizar.
   Un archivo de copia manipulado podría traer un color con comillas y cerrar el
   atributo para inyectar HTML, así que se validan aquí, en el único punto por el
   que pasan todos los orígenes de datos (localStorage, importación, nube y
   backups) antes de llegar a la vista. */
function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(value || "").trim())
    ? String(value).trim()
    : fallback;
}

function sanitizeColorFields(list, fallback, softFallback) {
  (Array.isArray(list) ? list : []).forEach(function (item) {
    if (!item || typeof item !== "object") return;
    /* Solo se tocan los campos que ya existen: añadir un color a elementos que
       no lo definen (p. ej. subcategorías) rompería la herencia del color de su
       categoría padre al dibujar el icono. */
    if (item.color != null) item.color = safeColor(item.color, fallback);
    if (item.soft != null) item.soft = safeColor(item.soft, softFallback);
  });
}

function rebuildIndexes() {
  sanitizeColorFields(CATEGORIES, "#888780", "#F1EFE8");
  sanitizeColorFields(PAYMENT_METHODS, "#888780", "#F1EFE8");
  sanitizeColorFields(INCOME_CATEGORIES, "#0F6E56", "#E1F5EE");
  sanitizeColorFields(INCOME_PAYMENT_METHODS, "#888780", "#F1EFE8");
  sanitizeColorFields(SUBCATEGORIES, "#667085", "#F1EFE8");

  categoryIndex = Object.create(null);
  paymentIndex = Object.create(null);
  incomeCategoryIndex = Object.create(null);
  incomePaymentIndex = Object.create(null);
  subcategoryIndex = Object.create(null);

  CATEGORIES.forEach(function (item) { categoryIndex[item.id] = item; });
  PAYMENT_METHODS.forEach(function (item) { paymentIndex[item.id] = item; });
  INCOME_CATEGORIES.forEach(function (item) { incomeCategoryIndex[item.id] = item; });
  INCOME_PAYMENT_METHODS.forEach(function (item) { incomePaymentIndex[item.id] = item; });
  SUBCATEGORIES.forEach(function (item) { subcategoryIndex[item.id] = item; });
}

function catInfo(id) {
  return categoryIndex[id] ||
    categoryIndex.otros ||
    CATEGORIES[0];
}

function subInfo(id) {
  return subcategoryIndex[id] || null;
}

function subcategoryParentCategory(sub) {
  if (!sub) return null;
  var kind = sub.kind || "expense";
  var categoryId = sub.categoryId || sub.category || sub.parentCategory;
  if (kind === "income") {
    return incomeCategoryIndex[categoryId] || INCOME_CATEGORIES.find(function (c) { return c.id === categoryId; }) || null;
  }
  return categoryIndex[categoryId] || CATEGORIES.find(function (c) { return c.id === categoryId; }) || null;
}

function subcategoryIconData(sub) {
  var parent = subcategoryParentCategory(sub);
  return parent || { icon: "more", color: "#667085", soft: "#F2F2F0" };
}

function subcategoriesFor(kind, categoryId) {
  return SUBCATEGORIES.filter(function (s) {
    return (s.kind || "expense") === kind &&
      (s.categoryId || s.category || s.parentCategory) === categoryId;
  });
}

function payInfo(id) {
  return paymentIndex[id] ||
    paymentIndex.efectivo ||
    PAYMENT_METHODS[0];
}

/* El distintivo es neutro a propósito. Dar a cada categoría su propio tono
   llenaba de colores cada lista, tarjeta y resumen, compitiendo con los
   importes; la categoría ya se identifica por el icono y por su nombre al
   lado. El color de la categoría se reserva para donde sí aporta: las barras
   de presupuesto y los gráficos, donde distingue series. */
function categoryIconBadge(iconName, color, soft, className, emoji) {

  className = className || "tx-icon";

  return (
    '<div class="' + className + '">' +
      iconOrEmoji(emoji, iconName, 16, "currentColor") +
    '</div>'
  );

}

/* Insignia con el color de una entidad (Yape, BCP…). El color viaja como
   variable CSS (--marca) y la hoja de estilos decide cómo aplicarlo en cada
   tema: tal cual en claro y aclarado en oscuro, donde el azul marino de un
   banco o el negro de una tarjeta desaparecían sobre el fondo. */
function marcaHtml(pay, size, className, tag) {
  tag = tag || "span";
  pay = pay || {};
  var contenido = pay.icon
    ? icon(pay.icon, size, "currentColor")
    : escapeHtml((pay.label || "?").charAt(0).toUpperCase());
  return '<' + tag + ' class="marca ' + (className || "") + '" style="--marca:' + safeColor(pay.color, "#888780") + '">' + contenido + '</' + tag + '>';
}

function paymentBadgeHtml(pay, className) {
  return marcaHtml(pay, 18, className || "settings-icon", "div");
}

function formatSoles(n) {

  n = Number(n) || 0;

  return "S/ " +
    n.toLocaleString(
      "es-PE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );

}

function monthLabelFor(key) {

  var parts = key.split("-").map(Number);

  var d = new Date(
    parts[0],
    parts[1] - 1,
    1
  );

  var text = new Intl.DateTimeFormat(
    "es-PE",
    {
      month: "long",
      year: "numeric"
    }
  ).format(d);

  return text.charAt(0).toUpperCase() + text.slice(1);

}

function escapeHtml(s) {

  var div = document.createElement("div");

  div.textContent = s == null ? "" : s;

  return div.innerHTML;

}

function slugify(text) {

  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);

}

function lightenColor(hex, amount) {

  hex = String(hex || "#888780").replace("#", "");

  if (hex.length === 3) {
    hex = hex.split("").map(function (c) { return c + c; }).join("");
  }

  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);

  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);

  return "#" + [r, g, b].map(function (v) {
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  }).join("");

}

