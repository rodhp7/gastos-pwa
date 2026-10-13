(function () {

"use strict";

/* =========================================================
   CONFIGURACIÓN / DATOS PREDETERMINADOS (módulo externo)
========================================================= */

var APP_CONFIG = window.GastosConfig;
var DEFAULT_CATEGORIES = APP_CONFIG.DEFAULT_CATEGORIES;
var DEFAULT_PAYMENT_METHODS = APP_CONFIG.DEFAULT_PAYMENT_METHODS;
var PERU_FINANCE_PRESETS = APP_CONFIG.PERU_FINANCE_PRESETS;
var DEFAULT_INCOME_CATEGORIES = APP_CONFIG.DEFAULT_INCOME_CATEGORIES;
var DEFAULT_BUDGETS = APP_CONFIG.DEFAULT_BUDGETS;
var DEFAULT_SUBCATEGORIES = APP_CONFIG.DEFAULT_SUBCATEGORIES;

var CATEGORIES = [];
var PAYMENT_METHODS = [];
var SUBCATEGORIES = [];
var INCOME_CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES));
var INCOME_PAYMENT_METHODS = JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
var STORAGE_KEY = "gastos-app-data";
var SETTINGS_KEY = "gastos-app-settings";
var DATA_VERSION = 6;
var BACKUP_PREFIX = "gastos-app-backup-";
var BACKUP_INDEX_KEY = "gastos-app-backup-index";
var MAX_LOCAL_BACKUPS = 5;

function dedupePaymentMethods(methods) {
  var seen = Object.create(null);
  return (Array.isArray(methods) ? methods : []).filter(function (p) {
    if (!p || !p.id || seen[p.id]) return false;
    seen[p.id] = true;
    return true;
  });
}

/* Solo quita duplicados y conserva el orden que eligió la persona. Antes
   además reordenaba según una lista fija en cada guardado, así que ordenar
   los métodos arrastrándolos en Configuración no tenía ningún efecto. */
function normalizePaymentMethodOrder() {
  PAYMENT_METHODS = dedupePaymentMethods(PAYMENT_METHODS);
  INCOME_PAYMENT_METHODS = dedupePaymentMethods(INCOME_PAYMENT_METHODS);
}

function findMovement(id, type) {
  var list = type === "income" ? state.incomes : state.expenses;
  return list.find(function (item) { return item.id === id; }) || null;
}

function deleteMovement(id, type, options) {
  options = options || {};
  var isIncome = type === "income";
  var item = findMovement(id, type);
  if (!item) return;

  function eliminar() {
    var snapshot = JSON.parse(JSON.stringify(item));
    if (isIncome) state.incomes = state.incomes.filter(function (x) { return x.id !== id; });
    else state.expenses = state.expenses.filter(function (x) { return x.id !== id; });
    state.undoAction = { type: type, item: snapshot, expiresAt: Date.now() + 8000 };
    persist();
    if (!options.skipRender) render();
    showUndoToast((isIncome ? "Ingreso" : "Gasto") + " eliminado.");
  }

  if (options.skipConfirm) { eliminar(); return; }
  confirmar({
    titulo: "¿Eliminar este " + (isIncome ? "ingreso" : "gasto") + "?",
    mensaje: formatSoles(item.amount) + (item.note ? " · " + item.note : "") + ". Podrás deshacerlo durante unos segundos.",
    aceptar: "Eliminar",
    peligro: true
  }).then(function (ok) { if (ok) eliminar(); });
}

function showUndoToast(message) {
  var el = document.getElementById("save-toast");
  if (!el) return;
  delete el.dataset.error;
  el.innerHTML = escapeHtml(message) + ' <button type="button" data-undo-delete style="margin-left:8px;border:0;background:transparent;text-decoration:underline;font-weight:700;cursor:pointer;color:inherit">Deshacer</button>';
  el.style.display = "block";
  clearTimeout(showUndoToast.timer);
  showUndoToast.timer = setTimeout(function () {
    if (el) el.style.display = "none";
    if (state.undoAction && state.undoAction.expiresAt <= Date.now()) state.undoAction = null;
  }, 8000);
}

/* Aviso breve de confirmación ("Copia restaurada", "Movimientos borrados").
   Reutiliza la misma franja que el aviso de deshacer. */
function mostrarAviso(mensaje) {
  var el = document.getElementById("save-toast");
  if (!el) return;
  delete el.dataset.error;
  el.textContent = mensaje;
  el.style.display = "block";
  clearTimeout(showUndoToast.timer);
  showUndoToast.timer = setTimeout(function () { el.style.display = "none"; }, 3500);
}

function undoLastDelete() {
  var action = state.undoAction;
  if (!action || action.expiresAt < Date.now()) { state.undoAction = null; return false; }
  var list = action.type === "income" ? state.incomes : state.expenses;
  if (list.some(function (x) { return x.id === action.item.id; })) return false;
  list.unshift(action.item);
  state.undoAction = null;
  persist();
  render();
  var el = document.getElementById("save-toast");
  if (el) el.style.display = "none";
  return true;
}

function deleteExpense(id, options) { return deleteMovement(id, "expense", options); }
function deleteIncome(id, options) { return deleteMovement(id, "income", options); }

/* El botón "Deshacer" vive dentro del aviso, que se reconstruye cada vez: por
   eso el listener va delegado en el documento y no en el botón. */
document.addEventListener("click", function (event) {
  var undo = event.target.closest && event.target.closest("[data-undo-delete]");
  if (!undo) return;
  event.preventDefault();
  event.stopPropagation();
  undoLastDelete();
});

function initializeDefaults(){
  if(!Array.isArray(CATEGORIES)||!CATEGORIES.length) CATEGORIES=JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  if(!Array.isArray(PAYMENT_METHODS)||!PAYMENT_METHODS.length) PAYMENT_METHODS=JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
  if(!Array.isArray(INCOME_CATEGORIES)||!INCOME_CATEGORIES.length) INCOME_CATEGORIES=JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES));
  if(!Array.isArray(INCOME_PAYMENT_METHODS)||!INCOME_PAYMENT_METHODS.length) INCOME_PAYMENT_METHODS=JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
  if(!Array.isArray(SUBCATEGORIES)||!SUBCATEGORIES.length) SUBCATEGORIES=JSON.parse(JSON.stringify(DEFAULT_SUBCATEGORIES));
  if(!Array.isArray(state.recurringExpenses)) state.recurringExpenses=[];
  if(!Array.isArray(state.savingsGoals)) state.savingsGoals=[];
  if(!Array.isArray(state.transfers)) state.transfers=[];
  if(!state.accountOpeningBalances||typeof state.accountOpeningBalances!=="object") state.accountOpeningBalances={};
  if(!state.accountMetadata||typeof state.accountMetadata!=="object") state.accountMetadata={};
  if(!Array.isArray(state.pendingPayments)) state.pendingPayments=[];
  if(!Array.isArray(state.debts)) state.debts=[];
  if(!state.budgets||typeof state.budgets!=="object") state.budgets=Object.assign({},DEFAULT_BUDGETS);
  normalizePaymentMethodOrder();
}
function loadSettings(){
  try{
    var raw=localStorage.getItem(SETTINGS_KEY); if(!raw)return;
    var s=JSON.parse(raw)||{};
    if(Array.isArray(s.categories)&&s.categories.length)CATEGORIES=s.categories;
    if(Array.isArray(s.paymentMethods)&&s.paymentMethods.length)PAYMENT_METHODS=s.paymentMethods;
    if(Array.isArray(s.incomeCategories)&&s.incomeCategories.length)INCOME_CATEGORIES=s.incomeCategories;
    if(Array.isArray(s.incomePaymentMethods)&&s.incomePaymentMethods.length)INCOME_PAYMENT_METHODS=s.incomePaymentMethods;
    if(Array.isArray(s.subcategories))SUBCATEGORIES=s.subcategories;
    sanitizeSubcategories();
    normalizePaymentMethodOrder();
  }catch(e){console.warn("No se pudieron cargar las preferencias antiguas.",e);}
}


/* =========================================================
   ICONOS
========================================================= */

var AVAILABLE_ICONS = [

  "shopping-cart",
  "bus",
  "zap",
  "film",
  "more",
  "home",
  "heart",
  "book",
  "game",
  "car",
  "income",
  "gift",
  "briefcase",
  "coins",
  "store",
  "trending-up",
  "refresh",
  "award",
  "handshake",
  "plane",
  "phone",
  "paw",
  "laptop"

];

var ICONS = {

  "shopping-cart":
    '<path d="M6 6h15l-1.5 9h-12z"/>' +
    '<circle cx="9" cy="20" r="1"/>' +
    '<circle cx="18" cy="20" r="1"/>' +
    '<path d="M3 3h2l1 3"/>',

  "bus":
    '<path d="M4 17h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0h1"/>' +
    '<path d="M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11"/>' +
    '<path d="M4 11h16"/>',

  "zap":
    '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',

  "film":
    '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
    '<path d="M7 4v16"/>' +
    '<path d="M17 4v16"/>' +
    '<path d="M3 9h4"/>' +
    '<path d="M17 9h4"/>' +
    '<path d="M3 15h4"/>' +
    '<path d="M17 15h4"/>',

  "more":
    '<circle cx="5" cy="12" r="1.5"/>' +
    '<circle cx="12" cy="12" r="1.5"/>' +
    '<circle cx="19" cy="12" r="1.5"/>',

  "moreVertical":
    '<circle cx="12" cy="5" r="1.5"/>' +
    '<circle cx="12" cy="12" r="1.5"/>' +
    '<circle cx="12" cy="19" r="1.5"/>',

  "chevronDown":
    '<path d="M6 9l6 6 6-6"/>',

  "home":
    '<path d="M3 11 12 3l9 8"/>' +
    '<path d="M5 10v10h14V10"/>' +
    '<path d="M9 20v-6h6v6"/>',

  "heart":
    '<path d="M20.8 8.6c0 5.5-8.8 11.2-8.8 11.2S3.2 14.1 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4z"/>',

  "book":
    '<path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z"/>' +
    '<path d="M4 20a2 2 0 0 1 2-2h13"/>',

  "game":
    '<path d="M6 8h12a4 4 0 0 1 4 4v2a4 4 0 0 1-7 2l-1-1h-4l-1 1a4 4 0 0 1-7-2v-2a4 4 0 0 1 4-4z"/>' +
    '<path d="M8 12v4"/>' +
    '<path d="M6 14h4"/>' +
    '<circle cx="17" cy="13" r="1"/>' +
    '<circle cx="19" cy="15" r="1"/>',

  "car":
    '<path d="M5 17h14"/>' +
    '<path d="M6 17l1-7h10l1 7"/>' +
    '<path d="M7 10l2-4h6l2 4"/>' +
    '<circle cx="8" cy="17" r="2"/>' +
    '<circle cx="16" cy="17" r="2"/>',

  "gift":
    '<rect x="3" y="8" width="18" height="13" rx="2"/>' +
    '<path d="M12 8v13"/>' +
    '<path d="M3 12h18"/>' +
    '<path d="M7.5 8A2.5 2.5 0 1 1 12 5.5V8"/>' +
    '<path d="M16.5 8A2.5 2.5 0 1 0 12 5.5V8"/>',

  "briefcase":
    '<rect x="3" y="7" width="18" height="13" rx="2"/>' +
    '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    '<path d="M3 12h18"/>' +
    '<path d="M10 12v2h4v-2"/>',

  "coins":
    '<ellipse cx="8" cy="7" rx="5" ry="3"/>' +
    '<path d="M3 7v6c0 1.7 2.2 3 5 3s5-1.3 5-3V7"/>' +
    '<path d="M13 10c2.8 0 5 1.3 5 3s-2.2 3-5 3"/>' +
    '<path d="M18 13v4c0 1.7-2.2 3-5 3-2.1 0-3.9-.7-4.6-1.8"/>',

  "store":
    '<path d="M4 10h16"/>' +
    '<path d="M5 10l1-5h12l1 5"/>' +
    '<path d="M6 10v10h12V10"/>' +
    '<path d="M9 20v-6h6v6"/>',

  "trending-up":
    '<path d="M3 17 9 11l4 4 7-7"/>' +
    '<path d="M14 8h6v6"/>',

  "refresh":
    '<path d="M21 12a9 9 0 0 1-15.2 6.5"/>' +
    '<path d="M3 12A9 9 0 0 1 18.2 5.5"/>' +
    '<path d="M6 19H3v-3"/>' +
    '<path d="M18 5h3v3"/>',

  "award":
    '<circle cx="12" cy="8" r="5"/>' +
    '<path d="m8.5 12.5-1.2 7 4.7-2.6 4.7 2.6-1.2-7"/>',

  "handshake":
    '<path d="M8 12 4.5 15.5a2.1 2.1 0 0 0 3 3L11 15"/>' +
    '<path d="m14 9 2.5 2.5a2.1 2.1 0 0 0 3-3L16 5h-4L9.5 7.5"/>' +
    '<path d="M2 12l4-4"/>' +
    '<path d="m22 12-4-4"/>' +
    '<path d="m11 15 2 2a2 2 0 0 0 3-2.6"/>',

  "plane":
    '<path d="M21 15.5V13l-8-5V5a2 2 0 0 0-4 0v3l-8 5v2.5l8-2.5V17l-3 2v1.5l5-1.5 5 1.5V19l-3-2v-4z"/>',

  "phone":
    '<path d="M6.5 3h4l1.5 4.5-2.3 2.3a13 13 0 0 0 5 5l2.3-2.3 4.5 1.5v4a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"/>',

  "paw":
    '<circle cx="7" cy="9" r="2"/>' +
    '<circle cx="12" cy="6.5" r="2"/>' +
    '<circle cx="17" cy="9" r="2"/>' +
    '<path d="M12 12c-3.5 0-6.5 2.2-6.5 5a2.5 2.5 0 0 0 4 2c1-1 1.5-1.5 2.5-1.5s1.5.5 2.5 1.5a2.5 2.5 0 0 0 4-2c0-2.8-3-5-6.5-5z"/>',

  "laptop":
    '<rect x="4" y="4" width="16" height="10" rx="1.5"/>' +
    '<path d="M2 18.5h20"/>' +
    '<path d="M9 18.5l1-2h4l1 2"/>',

  "grip":
    '<circle cx="8" cy="6" r="1"/>' +
    '<circle cx="16" cy="6" r="1"/>' +
    '<circle cx="8" cy="12" r="1"/>' +
    '<circle cx="16" cy="12" r="1"/>' +
    '<circle cx="8" cy="18" r="1"/>' +
    '<circle cx="16" cy="18" r="1"/>',

  "calendar":
    '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
    '<path d="M16 2v4"/>' +
    '<path d="M8 2v4"/>' +
    '<path d="M3 10h18"/>',

  "clock":
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 7v5l3 2"/>',

  "user":
    '<circle cx="12" cy="8" r="4"/>' +
    '<path d="M4 21a8 8 0 0 1 16 0"/>',

  "download":
    '<path d="M12 4v11"/>' +
    '<path d="m7 10 5 5 5-5"/>' +
    '<path d="M5 20h14"/>',

  "upload":
    '<path d="M12 15V4"/>' +
    '<path d="m7 9 5-5 5 5"/>' +
    '<path d="M5 20h14"/>',

  "chevronRight":
    '<path d="m9 6 6 6-6 6"/>',

  "plus":
    '<path d="M12 5v14"/>' +
    '<path d="M5 12h14"/>',

  "edit":
    '<path d="M12 20h9"/>' +
    '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',

  "x":
    '<path d="M18 6 6 18"/>' +
    '<path d="m6 6 12 12"/>',

  "check":
    '<path d="M20 6 9 17l-5-5"/>',

  "income":
    '<path d="M12 19V5"/>' +
    '<path d="m5 12 7 7 7-7"/>',

  "cash":
    '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M6 12h.01"/>' +
    '<path d="M18 12h.01"/>',

  "wallet":
    '<path d="M4 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>' +
    '<path d="M17 13h.01"/>',

  "bank":
    '<path d="M4 10h16"/>' +
    '<path d="M4 10 12 4l8 6"/>' +
    '<path d="M6 10v8"/>' +
    '<path d="M10 10v8"/>' +
    '<path d="M14 10v8"/>' +
    '<path d="M18 10v8"/>' +
    '<path d="M4 21h16"/>',

  "card":
    '<rect x="2" y="5" width="20" height="14" rx="2"/>' +
    '<path d="M2 10h20"/>' +
    '<path d="M6 15h4"/>',

  "eye":
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>' +
    '<circle cx="12" cy="12" r="3"/>',

  "eyeOff":
    '<path d="M3 3l18 18"/>' +
    '<path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.1 4.1M6.5 6.6C3.4 8.5 2 12 2 12s1.3 2.6 3.7 4.5"/>' +
    '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',

  "sun":
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2"/>' +
    '<path d="M12 20v2"/>' +
    '<path d="m4.9 4.9 1.4 1.4"/>' +
    '<path d="m17.7 17.7 1.4 1.4"/>' +
    '<path d="M2 12h2"/>' +
    '<path d="M20 12h2"/>' +
    '<path d="m4.9 19.1 1.4-1.4"/>' +
    '<path d="m17.7 6.3 1.4-1.4"/>',

  "moon":
    '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"/>',

  "contrast":
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 3v18"/>' +
    '<path d="M12 8h5"/>' +
    '<path d="M12 12h7"/>' +
    '<path d="M12 16h5"/>'

};

/* =========================================================
   COLORES DISPONIBLES
========================================================= */

var AVAILABLE_COLORS = [

  {
    color: "#1D9E75",
    soft: "#E1F5EE"
  },

  {
    color: "#D85A30",
    soft: "#FAECE7"
  },

  {
    color: "#BA7517",
    soft: "#FAEEDA"
  },

  {
    color: "#378ADD",
    soft: "#E6F1FB"
  },

  {
    color: "#742384",
    soft: "#F3E5F5"
  },

  {
    color: "#00A99D",
    soft: "#E0F7F5"
  },

  {
    color: "#185FA5",
    soft: "#E4F0FA"
  },

  {
    color: "#0F6E56",
    soft: "#E1F3EE"
  },

  {
    color: "#D4537E",
    soft: "#FCE8EF"
  },

  {
    color: "#888780",
    soft: "#F1EFE8"
  }

];

/* =========================================================
   ESTADO
========================================================= */

var state = {

  expenses: [],

  incomes: [],

  incomeDraft: { amount: "", note: "", category: null, subcategory: null, paymentMethod: null },

  budgets: Object.assign({}, DEFAULT_BUDGETS),

  recurringExpenses: [],

  savingsGoals: [],

  transfers: [],

  accountOpeningBalances: {},

  accountMetadata: {},

  pendingPayments: [],

  debts: [],

  screen: "home",

  filter: "todos",

  subFilter: "todos",

  movementSearch: "",

  movementTypeFilter: "todos",

  movementCategoryFilter: "todos",
  movementSubcategoryFilter: "todos",

  movementPaymentFilter: "todos",

  movementDateFrom: "",

  movementDateTo: "",

  movementAmountMin: "",

  movementAmountMax: "",

  movementMonth: "all",

  movementYear: "all",

  movementLimit: 0,
  movementFiltersOpen: false,
  movementRecordsOpen: true,
  movementDistributionOpen: false,

  undoAction: null,



  analysisMonth: new Date().getMonth(),

  analysisYear: new Date().getFullYear(),

  monthsYear: new Date().getFullYear(),

  calendarView: "years",

  calendarYear: new Date().getFullYear(),

  calendarMonth: new Date().getMonth(),

  calendarDay: new Date().getDate(),

  calendarExpensePaymentFilter: "todos",

  calendarIncomePaymentFilter: "todos",

  calendarExpenseSubcategoryFilter: "todos",

  calendarIncomeSubcategoryFilter: "todos",

  settingsExpandedCategories: {},

  settingsOpenSection: null,

  modal: null,

  editingType: null,

  editingId: null,

  addDraft: null

};

/* =========================================================
   ESTADO DEL ARRASTRE
========================================================= */

var dragState = {

  active: false,

  type: null,

  id: null,

  element: null,

  placeholder: null,

  /* Lista de los demás elementos arrastrables (sin el que se está
     moviendo), calculada una sola vez al iniciar el arrastre. Como el
     DOM de la lista no cambia mientras se arrastra (solo se reordena el
     placeholder), no hace falta volver a llamar a document.querySelectorAll
     en cada pointermove. */
  otherItems: null,

  pointerId: null,

  pointerType: null,

  handle: null,

  startX: 0,

  startY: 0,

  currentX: 0,

  currentY: 0,

  grabOffsetX: 0,

  grabOffsetY: 0,

  originalRect: null,

  originalParent: null,

  originalNextSibling: null,

  startIndex: -1

};

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

/* =========================================================
   CÁLCULOS
========================================================= */

function currentMonthExpenses() {
  var cm = monthKey(new Date());
  return state.expenses.filter(function (e) {
    return monthKey(e.date) === cm;
  });
}

function currentMonthIncomes() {
  var cm = monthKey(new Date());
  return state.incomes.filter(function (e) {
    return monthKey(e.date) === cm;
  });
}

function totalIncomes(list){ return window.GastosFinanceCore.totalIncomes(list); }

function totalExpenses(list){ return window.GastosFinanceCore.totalExpenses(list); }

function availableYears(){ return window.GastosFinanceCore.availableYears(state.expenses,state.incomes,parseLocalDate); }

function monthNameFor(year,monthIndex){ return window.GastosFinanceCore.monthNameFor(year,monthIndex); }

function monthlySummaryForYear(year){ return window.GastosFinanceCore.monthlySummaryForYear(year,state.expenses,state.incomes,parseLocalDate); }

function spentByCategory(expenses){ return window.GastosFinanceCore.spentByCategory(expenses,CATEGORIES); }

function incomeByCategory(incomes){ return window.GastosFinanceCore.incomeByCategory(incomes,INCOME_CATEGORIES); }


function analysisMonthItems(year,month){ return window.GastosFinanceCore.analysisMonthItems(year,month,state.expenses,state.incomes,parseLocalDate); }


/* Variación frente al mes anterior, en palabras. */
function variacionTexto(actual, anterior, nombreMesAnterior) {
  if (!anterior) return actual ? "Sin datos de " + nombreMesAnterior : "Sin movimientos";
  var pct = ((actual - anterior) / anterior) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "% vs. " + nombreMesAnterior;
}

function signoSoles(valor) {
  return (valor < 0 ? "-" : "+") + formatSoles(Math.abs(valor));
}

/* Avisos accionables: solo lo que pide hacer algo. Las frases que repetían
   una cifra ya visible ("tu resultado es positivo", "tu mayor categoría es…")
   se quitaron. */
function avisosDelMes(year, month, income, expense, balance, rows) {
  var avisos = [];
  var budgetSummary = budgetMonthSummary(year, month);

  if (budgetSummary.budget > 0) {
    if (budgetSummary.available < 0) {
      avisos.push({ level: "danger", text: "Tu proyección supera el presupuesto en " + formatSoles(Math.abs(budgetSummary.available)) + ". Revisa primero las categorías con mayor gasto." });
    } else if (budgetSummary.pct >= 85) {
      avisos.push({ level: "warning", text: "Ya usas el " + Math.round(budgetSummary.pct) + "% de tu presupuesto proyectado. Conviene moderar los gastos variables el resto del mes." });
    }
  }

  if (Number(budgetSummary.committed) > 0) {
    avisos.push({ level: "neutral", text: "Tienes " + formatSoles(budgetSummary.committed) + " en gastos recurrentes por pagar este mes. Trátalos como dinero ya comprometido." });
  }

  if (balance < 0) {
    avisos.push({ level: "danger", text: "Este mes gastas más de lo que ingresas." });
  } else if (income > 0 && (balance / income) * 100 < 10) {
    avisos.push({ level: "warning", text: "Ahorras el " + ((balance / income) * 100).toFixed(1) + "% de tus ingresos. Intenta subirlo antes de sumar gastos fijos." });
  }

  if (rows.length >= 2 && expense > 0) {
    var share = (rows[0].amount / expense) * 100;
    if (share >= 35) {
      avisos.push({ level: "neutral", text: rows[0].cat.label + " concentra el " + share.toFixed(0) + "% de tus gastos: es donde más margen tienes para recortar." });
    }
  }

  var goals = safeArray(state.savingsGoals).filter(function (g) {
    return Number(g.target) > 0 && Number(g.saved) < Number(g.target) && g.targetDate;
  }).sort(function (a, b) { return String(a.targetDate).localeCompare(String(b.targetDate)); });
  if (goals.length) {
    var goal = goals[0];
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var daysLeft = Math.max(0, Math.ceil((parseLocalDate(goal.targetDate) - today) / 86400000));
    var remaining = Number(goal.target) - Number(goal.saved);
    if (daysLeft === 0) {
      avisos.push({ level: "danger", text: "La meta “" + goal.name + "” llegó a su fecha y faltan " + formatSoles(remaining) + ". Ajusta el plazo o el aporte." });
    } else {
      var monthsLeft = Math.max(1, daysLeft / 30.4375);
      avisos.push({ level: "neutral", text: "Para cumplir “" + goal.name + "” a tiempo necesitas ahorrar unos " + formatSoles(remaining / monthsLeft) + " al mes." });
    }
  }

  return avisos.slice(0, 3);
}

function renderAnalisis() {
  var year = state.analysisYear;
  var month = state.analysisMonth;
  var current = analysisMonthItems(year, month);
  var prevDate = new Date(year, month - 1, 1);
  var previous = analysisMonthItems(prevDate.getFullYear(), prevDate.getMonth());
  var prevName = monthNameFor(prevDate.getFullYear(), prevDate.getMonth()).toLowerCase();

  var income = totalIncomes(current.incomes);
  var expense = totalExpenses(current.expenses);
  var balance = income - expense;
  var prevIncome = totalIncomes(previous.incomes);
  var prevExpense = totalExpenses(previous.expenses);
  var hayDatos = current.expenses.length + current.incomes.length > 0;

  var byCategory = spentByCategory(current.expenses);
  var rows = CATEGORIES.map(function (cat) {
    return { cat: cat, amount: Number(byCategory[cat.id] || 0) };
  }).filter(function (row) {
    return row.amount > 0;
  }).sort(function (a, b) {
    return b.amount - a.amount;
  });

  /* Un único color para todas las categorías: la longitud de la barra y el
     orden ya dicen cuál pesa más. Con un color por categoría el bloque
     parecía un arcoíris sin que el color significara nada. */
  var max = rows.length ? rows[0].amount : 1;
  var categoryHtml = rows.length ? rows.map(function (row) {
    var width = Math.max(3, Math.round((row.amount / max) * 100));
    var share = expense ? Math.round((row.amount / expense) * 100) : 0;
    return '<div class="analysis-cat-row">' +
      '<div class="analysis-cat-line">' +
        '<span class="analysis-cat-name">' + iconOrEmoji(row.cat.iconEmoji, row.cat.icon, 15, "currentColor") + escapeHtml(row.cat.label) + '</span>' +
        '<span class="analysis-cat-amount">' + formatSoles(row.amount) + '<small>' + share + '%</small></span>' +
      '</div>' +
      '<div class="analysis-bar"><div class="analysis-bar-fill" style="width:' + width + '%"></div></div>' +
    '</div>';
  }).join("") : '<p class="analysis-empty">Todavía no hay gastos en este mes.</p>';

  // Evolución de los últimos 6 meses.
  var trend = [];
  for (var ti = 5; ti >= 0; ti--) {
    var td = new Date(year, month - ti, 1);
    var ts = analysisMonthItems(td.getFullYear(), td.getMonth());
    trend.push({
      year: td.getFullYear(),
      month: td.getMonth(),
      label: monthNameFor(td.getFullYear(), td.getMonth()).slice(0, 3),
      balance: totalIncomes(ts.incomes) - totalExpenses(ts.expenses),
      activo: ts.expenses.length + ts.incomes.length > 0
    });
  }
  /* Mejor, peor y promedio solo entre meses con movimientos: un mes vacío
     salía como "peor mes" con S/ 0.00 y arrastraba el promedio hacia abajo. */
  var activos = trend.filter(function (x) { return x.activo; });
  var trendMax = Math.max.apply(null, trend.map(function (x) { return Math.abs(x.balance); }).concat([1]));
  var trendHtml = trend.map(function (x, i) {
    var height = x.activo ? Math.max(4, Math.round((Math.abs(x.balance) / trendMax) * 100)) : 0;
    var esActual = i === trend.length - 1;
    return '<div class="analysis-trend-item' + (esActual ? ' is-current' : '') + '" title="' + escapeHtml(monthNameFor(x.year, x.month)) + ': ' + (x.activo ? signoSoles(x.balance) : 'sin movimientos') + '">' +
      '<div class="analysis-trend-track"><div class="analysis-trend-bar ' + (x.balance < 0 ? 'analysis-trend-negative' : 'analysis-trend-positive') + '" style="height:' + height + '%"></div></div>' +
      '<span>' + escapeHtml(x.label) + '</span>' +
    '</div>';
  }).join('');

  var resumenTendencia = '';
  if (activos.length >= 2) {
    var best = activos.reduce(function (a, b) { return b.balance > a.balance ? b : a; });
    var worst = activos.reduce(function (a, b) { return b.balance < a.balance ? b : a; });
    var avg = activos.reduce(function (sum, x) { return sum + x.balance; }, 0) / activos.length;
    resumenTendencia = '<div class="analysis-trend-stats">' +
      '<div><span>Mejor mes</span><strong>' + escapeHtml(monthNameFor(best.year, best.month)) + '</strong><b>' + signoSoles(best.balance) + '</b></div>' +
      '<div><span>Peor mes</span><strong>' + escapeHtml(monthNameFor(worst.year, worst.month)) + '</strong><b>' + signoSoles(worst.balance) + '</b></div>' +
      '<div><span>Promedio</span><strong>' + activos.length + ' meses</strong><b>' + signoSoles(avg) + '</b></div>' +
    '</div>';
  }

  var avisos = avisosDelMes(year, month, income, expense, balance, rows);
  var rotuloAviso = { danger: "Atención", warning: "Vigila esto", neutral: "Sugerencia" };

  var title = monthLabelFor(year + "-" + String(month + 1).padStart(2, "0"));

  return '<div class="analysis-page">' +
    '<div class="analysis-head">' +
      '<div><p class="analysis-kicker">Análisis</p><h2 class="analysis-title">' + escapeHtml(title) + '</h2></div>' +
      '<div class="analysis-nav">' +
        '<button type="button" data-analysis-prev aria-label="Mes anterior">' + icon("chevronDown", 18, "currentColor") + '</button>' +
        '<button type="button" data-analysis-next aria-label="Mes siguiente">' + icon("chevronDown", 18, "currentColor") + '</button>' +
      '</div>' +
    '</div>' +

    /* Resumen único: antes eran cuatro tarjetas, una de ellas solo con el
       número de movimientos registrados. */
    '<section class="analysis-card analysis-summary">' +
      '<p class="analysis-label">Resultado del mes</p>' +
      '<p class="analysis-summary-value' + (balance < 0 ? ' analysis-negative' : '') + '">' + (balance < 0 ? '-' : '') + formatSoles(Math.abs(balance)) + '</p>' +
      '<p class="analysis-summary-note">' +
        (income > 0
          ? (balance >= 0 ? 'Ahorras el ' + ((balance / income) * 100).toFixed(1) + '% de tus ingresos' : 'Gastas ' + formatSoles(-balance) + ' más de lo que ingresas')
          : (hayDatos ? 'Sin ingresos registrados este mes' : 'Sin movimientos este mes')) +
      '</p>' +
      '<div class="analysis-summary-split">' +
        '<div><span>Ingresos</span><strong>' + formatSoles(income) + '</strong><small>' + escapeHtml(variacionTexto(income, prevIncome, prevName)) + '</small></div>' +
        '<div><span>Gastos</span><strong>' + formatSoles(expense) + '</strong><small>' + escapeHtml(variacionTexto(expense, prevExpense, prevName)) + '</small></div>' +
      '</div>' +
    '</section>' +

    /* Proyección al cierre: solo en el mes en curso, el único proyectable. */
    (function () {
      var ahora = new Date();
      if (year !== ahora.getFullYear() || month !== ahora.getMonth()) return "";
      var cf = cashFlowSummary(year, month);
      return '<section class="analysis-card analysis-projection">' +
        '<p class="analysis-label">Proyección al cierre del mes</p>' +
        '<p class="analysis-projection-value' + (cf.available < 0 ? ' analysis-negative' : '') + '">' + (cf.available < 0 ? '-' : '') + formatSoles(Math.abs(cf.available)) + '<small> disponibles</small></p>' +
        '<p class="analysis-summary-note">Al ritmo actual gastarías ' + formatSoles(cf.projectedAtClose) + ' este mes' + (cf.recurring ? ', incluidos ' + formatSoles(cf.recurring) + ' en recurrentes por pagar' : '') + '.</p>' +
      '</section>';
    })() +

    '<section class="analysis-card">' +
      '<p class="analysis-label">Dónde se fue tu dinero</p>' + categoryHtml +
    '</section>' +

    '<section class="analysis-card analysis-trend-card">' +
      '<p class="analysis-label">Resultado de los últimos 6 meses</p>' +
      '<div class="analysis-trend">' + trendHtml + '</div>' +
      resumenTendencia +
    '</section>' +

    (avisos.length
      ? '<section class="analysis-card analysis-recommendations">' +
          '<p class="analysis-label">Para tener en cuenta</p>' +
          avisos.map(function (item) {
            return '<div class="analysis-recommendation analysis-recommendation-' + item.level + '">' +
              '<strong>' + rotuloAviso[item.level] + '</strong><p>' + escapeHtml(item.text) + '</p>' +
            '</div>';
          }).join("") +
        '</section>'
      : '') +
  '</div>';
}

/* =========================================================
   RENDER PRINCIPAL
========================================================= */

/* Última pantalla dibujada. render() se ejecuta también al abrir un acordeón,
   guardar un gasto o cambiar un filtro; animar la entrada en todos esos casos
   haría parpadear la interfaz constantemente. Comparando con este valor, la
   animación queda reservada a los cambios reales de pantalla. */
var pantallaRenderizada = null;

/* Numera las primeras fichas de la pantalla para escalonar su entrada. El
   índice se asigna aquí y no con :nth-child en CSS porque esas fichas conviven
   con títulos y otros bloques dentro del mismo contenedor: nth-child cuenta
   todos los hermanos, así que la numeración no coincidiría con el orden real
   de las fichas. A partir de la sexta todas comparten el retraso máximo, para
   que una lista larga no obligue a esperar a que termine el escalonado. */
var ORDEN_MAXIMO_ENTRADA = 5;

/* Margen suficiente para que terminen el escalonado (140 ms) y el crecimiento
   de las barras (420 ms) antes de retirar la clase. */
var DURACION_ENTRADA_MS = 700;
var temporizadorEntrada = null;

function escalonarEntrada(contenedor) {
  var fichas = contenedor.querySelectorAll(
    ".tx-card-row, .budget-row, .account-row, .transfer-row, .pending-row, .debt-row"
  );

  for (var i = 0; i < fichas.length && i <= ORDEN_MAXIMO_ENTRADA; i++) {
    fichas[i].style.setProperty("--orden", i);
  }
}

function render() {

  /* Limpieza defensiva: si algún menú de acciones (⋮) de categoría o
     subcategoría había sido "portado" a <body> (para no quedar cortado
     ni tapado) y sigue ahí cuando se reconstruye la pantalla, se retira
     para no dejar elementos huérfanos; el nuevo HTML generará uno limpio. */
  document.querySelectorAll(".settings-item-menu-dropdown--portal").forEach(function (dd) {
    if (dd.parentNode) dd.parentNode.removeChild(dd);
  });

  var el =
    document.getElementById("screen-area");

  if (state.screen === "home") {

    el.innerHTML = renderHome();

  }

  else if (state.screen === "add") {

    el.innerHTML = renderAdd();

  }

  else if (state.screen === "movimientos") {

    el.innerHTML = renderMovimientos();

  }

  else if (state.screen === "meses") {

    el.innerHTML = renderCalendario();

  }

  else if (state.screen === "ingresos") {

    el.innerHTML = renderIngresos();

  }

  else if (state.screen === "presupuestos") {

    el.innerHTML = renderPresupuestos();

  }

  else if (state.screen === "dashboard") {
    state.screen = "analisis";
    el.innerHTML = renderAnalisis();
  }

  else if (state.screen === "analisis") {

    el.innerHTML = renderAnalisis();

  }

  else if (state.screen === "cuentas") {
    el.innerHTML = renderAccounts();
  }

  else if (state.screen === "pendientes") {
    el.innerHTML = renderPendingPayments();
  }

  else if (state.screen === "deudas") {
    el.innerHTML = renderDebts();
  }

  else if (state.screen === "recurrentes") {
    el.innerHTML = renderRecurringExpenses();
  }

  else if (state.screen === "metas") {
    el.innerHTML = renderSavingsGoals();
  }

  else if (state.screen === "configuracion") {

    el.innerHTML = renderConfiguracion();

  }

  if (state.screen !== pantallaRenderizada) {
    pantallaRenderizada = state.screen;

    /* Cada pantalla empieza arriba. Sin esto, la nueva heredaba el
       desplazamiento de la anterior y se abría a mitad de contenido. */
    window.scrollTo(0, 0);
    el.scrollTop = 0;

    clearTimeout(temporizadorEntrada);
    el.classList.remove("screen-enter");
    void el.offsetWidth; /* reinicia la animación si la clase seguía puesta */
    el.classList.add("screen-enter");
    escalonarEntrada(el);

    /* La clase se retira al acabar. Si se quedara puesta, cualquier repintado
       posterior dentro de la misma pantalla —cambiar un filtro, guardar un
       gasto— volvería a animar las fichas recién creadas, que es justo la
       sensación de parpadeo que se quiere evitar. */
    temporizadorEntrada = setTimeout(function () {
      el.classList.remove("screen-enter");
    }, DURACION_ENTRADA_MS);
  }

  document
    .querySelectorAll("[data-top-screen]")
    .forEach(function (btn) {

      btn.classList.toggle(
        "active",
        btn.getAttribute("data-top-screen") ===
        state.screen
      );

    });

  /* En Configuración no se registran movimientos: los botones Gasto/Ingreso
     de la cabecera sobraban allí. */
  var accionesCabecera = document.querySelector(".top-nav-actions");
  if (accionesCabecera) accionesCabecera.hidden = state.screen === "configuracion";

  try {
    attachScreenHandlers();
  } catch (error) {
    console.error("Error en los manejadores de pantalla:", error);
    /* Nunca sustituir una pantalla ya renderizada por un mensaje de error.
       La interfaz debe seguir siendo navegable aunque falle un manejador no crítico. */
  }

  renderModal();

}

/* =========================================================
   CONSERVAR LA POSICIÓN AL REPINTAR
   render() reconstruye la pantalla entera; dentro de una misma pantalla
   (abrir una sección de Configuración, cambiar el tema…) la posición de
   desplazamiento se conserva para que la vista no salte.
========================================================= */

function preserveScroll(fn) {
  var screenArea = document.getElementById("screen-area");
  var areaTop = screenArea ? screenArea.scrollTop : 0;
  var windowTop = window.scrollY;

  fn();

  if (screenArea) screenArea.scrollTop = areaTop;
  window.scrollTo(0, windowTop);
}

/* Al desplegar una categoría, si sus subcategorías quedan por debajo del
   borde de la pantalla, se desplaza lo justo para mostrarlas. */
function centerSettingsElement(selector) {
  requestAnimationFrame(function () {
    var target = document.querySelector(selector);
    if (!target) return;
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "nearest" });
  });
}
/* =========================================================
   MENÚ DE ACCIONES (⋮) DE CATEGORÍAS Y SUBCATEGORÍAS
========================================================= */

/* Coloca el menú (ya "portado" a <body>) justo debajo del botón "⋮" que lo
   abrió, alineado a su borde derecho. Si no cabe hacia abajo o hacia la
   derecha, se ajusta hacia arriba / hacia la izquierda para no salirse de
   la ventana. Se usa position:fixed, así que las coordenadas son relativas
   al viewport y no dependen del scroll de ningún contenedor. */
function positionSettingsItemMenuDropdown(toggle, dropdown) {
  var rect = toggle.getBoundingClientRect();
  var margin = 6;
  var viewportMargin = 8;

  var ddRect = dropdown.getBoundingClientRect();
  var width = ddRect.width || 150;
  var height = ddRect.height || 90;

  var left = rect.right - width;
  if (left < viewportMargin) left = Math.min(rect.left, window.innerWidth - viewportMargin - width);
  if (left < viewportMargin) left = viewportMargin;
  if (left + width > window.innerWidth - viewportMargin) left = window.innerWidth - viewportMargin - width;

  var top = rect.bottom + margin;
  if (top + height > window.innerHeight - viewportMargin) {
    top = rect.top - margin - height;
  }
  if (top < viewportMargin) top = viewportMargin;

  dropdown.style.left = left + "px";
  dropdown.style.top = top + "px";
}

/* Bandera simple para saber si hay algún menú de acciones (⋮) abierto,
   sin tener que consultar el DOM. Como máximo un menú puede estar abierto
   a la vez (openSettingsItemMenu siempre cierra los demás antes de abrir
   uno nuevo), así que un booleano es suficiente. Se usa para que el
   listener global de "scroll" (que se dispara muy seguido durante el
   desplazamiento) pueda salir de inmediato sin hacer querySelectorAll en
   cada evento cuando no hay ningún menú abierto. */
var hasOpenSettingsMenu = false;

/* Abre el menú de acciones (⋮) de una categoría/subcategoría. Se saca el
   desplegable de su ficha y se añade a <body> con position:fixed, para que
   nunca quede recortado por el scroll interno de la lista ni tapado por
   otras categorías (ver .settings-item-menu-dropdown--portal). */
function openSettingsItemMenu(toggle, dropdown) {
  closeSettingsItemMenus();

  if (!dropdown.settingsMenuHome) {
    dropdown.settingsMenuHome = {
      parent: dropdown.parentNode,
      next: dropdown.nextSibling
    };
  }

  document.body.appendChild(dropdown);
  dropdown.classList.add("settings-item-menu-dropdown--portal");

  positionSettingsItemMenuDropdown(toggle, dropdown);

  dropdown.classList.add("open");
  toggle.setAttribute("aria-expanded", "true");
  hasOpenSettingsMenu = true;
}

/* Cierra un menú de acciones y, una vez terminada la animación de
   desvanecido, lo devuelve a su posición original en el DOM (dentro de la
   ficha de la categoría/subcategoría), dejando todo como estaba antes de
   abrirlo. */
function closeSettingsItemMenu(dropdown, toggle) {
  dropdown.classList.remove("open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  hasOpenSettingsMenu = false;

  setTimeout(function () {
    if (dropdown.classList.contains("open")) return; // se reabrió mientras tanto

    dropdown.classList.remove("settings-item-menu-dropdown--portal");
    dropdown.style.top = "";
    dropdown.style.left = "";
    dropdown.style.right = "";
    dropdown.style.bottom = "";

    var home = dropdown.settingsMenuHome;
    if (home && home.parent && home.parent.isConnected) {
      if (home.next && home.next.isConnected && home.next.parentNode === home.parent) {
        home.parent.insertBefore(dropdown, home.next);
      } else {
        home.parent.appendChild(dropdown);
      }
    } else if (dropdown.parentNode === document.body) {
      dropdown.parentNode.removeChild(dropdown);
    }
  }, 180);
}

function closeSettingsItemMenus(exceptTarget) {
  var openMenus = document.querySelectorAll(".settings-item-menu-dropdown.open");
  if (!openMenus.length) { hasOpenSettingsMenu = false; return; }

  openMenus.forEach(function (dd) {
    if (exceptTarget && dd.contains(exceptTarget)) return;

    var menuId = dd.getAttribute("data-item-menu-dropdown");
    var toggle = menuId ? document.querySelector('[data-item-menu-toggle="' + menuId + '"]') : null;
    if (exceptTarget && toggle && toggle.contains(exceptTarget)) return;

    closeSettingsItemMenu(dd, toggle);
  });
}


/* =========================================================
   MANTENER PRESIONADO (long-press) — helper reutilizable
   Dispara onTrigger tras LONG_PRESS_MS de presión sostenida sobre `el`,
   siempre que el puntero no se haya movido más de la tolerancia ni se
   haya soltado/cancelado antes. Funciona con mouse y touch (Pointer
   Events). Los descendientes marcados con [data-longpress-ignore] no
   inician el gesto, para no interferir con inputs/botones internos.
========================================================= */
var LONG_PRESS_MS = 500;
var LONG_PRESS_MOVE_TOLERANCE = 10;

function attachLongPress(el, onTrigger) {
  var timer = null;
  var pointerId = null;
  var startX = 0, startY = 0;
  /* Al soltar tras el gesto, el navegador (sobre todo con ratón) emite un
     clic. Ese clic cerraba al instante el menú recién abierto —el cierre
     global escucha clics fuera de él— y, en fichas que responden al toque,
     abría además una segunda acción. Se descarta escuchando en window y en
     fase de captura, que va antes que cualquier otro oyente. */
  var quitarTragaClics = null;

  function tragarClics() {
    function tragar(e) { e.preventDefault(); e.stopImmediatePropagation(); quitar(); }
    function quitar() {
      window.removeEventListener("click", tragar, true);
      clearTimeout(respaldo);
      quitarTragaClics = null;
    }
    window.addEventListener("click", tragar, true);
    var respaldo = setTimeout(quitar, 5000);
    quitarTragaClics = quitar;
  }

  /* En pantallas táctiles a menudo no llega ningún clic tras soltar: el
     filtro se retira enseguida para no comerse el siguiente toque real. */
  function alSoltar() {
    if (quitarTragaClics) setTimeout(quitarTragaClics, 350);
    clear();
  }

  function clear() {
    clearTimeout(timer);
    timer = null;
    pointerId = null;
    el.classList.remove("is-longpressing");
  }

  el.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest && e.target.closest("[data-longpress-ignore]")) return;
    clear();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    el.classList.add("is-longpressing");
    timer = setTimeout(function () {
      el.classList.remove("is-longpressing");
      if (navigator.vibrate) navigator.vibrate(20);
      tragarClics();
      onTrigger(el);
    }, LONG_PRESS_MS);
  }, { passive: true });

  el.addEventListener("pointermove", function (e) {
    if (e.pointerId !== pointerId) return;
    if (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_TOLERANCE) clear();
  }, { passive: true });

  el.addEventListener("pointerup", alSoltar, { passive: true });
  el.addEventListener("pointercancel", alSoltar, { passive: true });
  el.addEventListener("pointerleave", clear, { passive: true });
  el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}

/* Hace que una fila responda como un botón: clic, Intro o Espacio. Los
   controles propios de la fila (p. ej. "Marcar pagado") conservan su acción
   sin abrir además la de la fila. El clic que sigue a mantener presionado
   ya lo descarta attachLongPress. */
function onRowActivate(row, handler) {
  row.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest(".settings-item-menu, button, a, input, select")) return;
    handler();
  });
  row.addEventListener("keydown", function (event) {
    if (event.target !== row) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler();
  });
}

function itemMenuHtml(menuId, editAttr, editVal, deleteAttr, deleteVal) {
  return (
    '<div class="settings-item-menu" data-settings-item-menu="' + menuId + '">' +
      '<button type="button" class="icon-btn settings-item-menu-toggle" data-item-menu-toggle="' + menuId + '" aria-haspopup="true" aria-expanded="false" title="Más opciones">' +
        icon("moreVertical", 18) +
      '</button>' +
      '<div class="settings-item-menu-dropdown" data-item-menu-dropdown="' + menuId + '">' +
        '<button type="button" class="settings-item-menu-option" ' + editAttr + '="' + escapeHtml(editVal) + '">' + icon("edit", 15) + '<span>Editar</span></button>' +
        '<button type="button" class="settings-item-menu-option settings-item-menu-option-danger" ' + deleteAttr + '="' + escapeHtml(deleteVal) + '">' + icon("x", 15) + '<span>Eliminar</span></button>' +
      '</div>' +
    '</div>'
  );
}

/* =========================================================
   DIÁLOGOS PROPIOS
   Sustituyen a alert() y confirm() del navegador, que rompían la estética
   (ventana gris del sistema con el nombre del dominio), no respetaban el
   tema oscuro y en algunas apps instaladas ni siquiera se muestran.

   Viven en su propia capa, por encima de los formularios: confirmar una
   eliminación desde un modal no lo cierra.

     avisar("Ingresa un monto válido.")
     confirmar({ titulo: "¿Eliminar…?", mensaje: "…", aceptar: "Eliminar",
                 peligro: true }).then(function (ok) { if (ok) … })
========================================================= */

var cerrarDialogoAbierto = null;

function abrirDialogo(opciones) {
  return new Promise(function (resolver) {
    if (cerrarDialogoAbierto) cerrarDialogoAbierto(false);

    var focoAnterior = document.activeElement;
    var fondo = document.createElement("div");
    fondo.className = "dialogo-fondo";
    fondo.innerHTML =
      '<div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo"' +
        (opciones.mensaje ? ' aria-describedby="dialogo-texto"' : '') + '>' +
        '<h3 id="dialogo-titulo">' + escapeHtml(opciones.titulo) + '</h3>' +
        (opciones.mensaje ? '<p id="dialogo-texto">' + escapeHtml(opciones.mensaje) + '</p>' : '') +
        '<div class="dialogo-acciones">' +
          (opciones.cancelar
            ? '<button type="button" class="secondary-btn" data-dialogo="no">' + escapeHtml(opciones.cancelar) + '</button>'
            : '') +
          '<button type="button" class="primary-btn' + (opciones.peligro ? ' dialogo-peligro' : '') + '" data-dialogo="si">' +
            escapeHtml(opciones.aceptar || "Entendido") +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fondo);

    function cerrar(valor) {
      window.removeEventListener("keydown", teclado, true);
      fondo.remove();
      cerrarDialogoAbierto = null;
      if (focoAnterior && focoAnterior.focus && document.contains(focoAnterior)) focoAnterior.focus();
      resolver(valor);
    }

    /* Escape cancela sin cerrar además el formulario de debajo, y el foco
       no se escapa del diálogo con Tab. */
    function teclado(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cerrar(false);
        return;
      }
      if (event.key !== "Tab") return;
      var botones = fondo.querySelectorAll("button");
      var primero = botones[0];
      var ultimo = botones[botones.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    }

    fondo.addEventListener("click", function (event) {
      var boton = event.target.closest && event.target.closest("[data-dialogo]");
      if (boton) cerrar(boton.getAttribute("data-dialogo") === "si");
      else if (event.target === fondo) cerrar(false);
    });
    window.addEventListener("keydown", teclado, true);
    cerrarDialogoAbierto = cerrar;

    /* En acciones destructivas el foco empieza en "Cancelar": un Intro
       involuntario no borra nada. */
    var foco = fondo.querySelector(opciones.peligro ? '[data-dialogo="no"]' : '[data-dialogo="si"]') ||
      fondo.querySelector("[data-dialogo]");
    foco.focus();
  });
}

function avisar(mensaje, titulo) {
  return abrirDialogo({
    titulo: titulo || mensaje,
    mensaje: titulo ? mensaje : "",
    aceptar: "Entendido"
  });
}

function confirmar(opciones) {
  return abrirDialogo({
    titulo: opciones.titulo,
    mensaje: opciones.mensaje || "",
    aceptar: opciones.aceptar || "Aceptar",
    cancelar: opciones.cancelar || "Cancelar",
    peligro: !!opciones.peligro
  });
}

/* auth.js es un script aparte y también los usa. */
window.NexoDialogo = { avisar: avisar, confirmar: confirmar };
/* =========================================================
   FILA DE MOVIMIENTO
   Dos líneas a la izquierda (qué fue · de dónde salió) y dos a la derecha
   (cuánto · a qué hora). Antes la hora, una píldora con el método y el
   importe competían en una sola línea y, en pantallas estrechas, el texto
   bajaba a 9–10 px para caber.
========================================================= */

function movementRowHtml(kind, item, catLabel, sub, badge, payLabel) {
  var note = typeof item.note === "string" ? item.note.trim() : "";
  var title = note || catLabel;
  /* Con nota, la categoría pasa a la segunda línea; sin ella ya es el título. */
  var detalle = [note ? catLabel : "", sub ? sub.label : "", payLabel].filter(Boolean).join(" · ");
  var time = formatMovementTime(item);

  return '<div class="tx-row tx-card-row movement-detail-trigger" data-movement-detail-kind="' + kind + '" data-movement-detail-id="' + escapeHtml(item.id) + '" tabindex="0" role="button">' +
    badge +
    '<div class="tx-body">' +
      '<p class="name" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</p>' +
      (detalle ? '<p class="tx-subcategory" title="' + escapeHtml(detalle) + '">' + escapeHtml(detalle) + '</p>' : '') +
    '</div>' +
    '<div class="tx-end">' +
      '<span class="tx-amount amt tx-amount-' + kind + '">' + (kind === "income" ? "+" : "-") + formatSoles(item.amount) + '</span>' +
      (time ? '<span class="tx-time">' + escapeHtml(time) + '</span>' : '') +
    '</div>' +
  '</div>';
}

function renderTxRow(e) {
  var cat = catInfo(e.category);
  var pay = payInfo(e.paymentMethod);
  var sub = e.subcategory ? subInfo(e.subcategory) : null;
  return movementRowHtml("expense", e, cat.label, sub,
    categoryIconBadge(cat.icon, cat.color, cat.soft, "tx-icon", cat.iconEmoji),
    pay.label);
}

function renderIncomeRow(e) {
  var cat = incomeCategoryIndex[e.category];
  var pay = incomePaymentIndex[e.paymentMethod];
  var sub = e.subcategory ? subInfo(e.subcategory) : null;
  return movementRowHtml("income", e, cat ? cat.label : "Ingreso", sub,
    categoryIconBadge((cat && cat.icon) || "income", "", "", "tx-icon", cat && cat.iconEmoji),
    pay ? pay.label : "");
}

/* "Hoy", "Ayer", "Lunes, 10 de octubre" o, si es de otro año, con el año. */
function etiquetaDia(valor) {
  var d = parseLocalDate(valor);
  if (!d) return "";
  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  var dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diferencia = Math.round((hoy - dia) / 86400000);
  if (diferencia === 0) return "Hoy";
  if (diferencia === 1) return "Ayer";
  var texto = d.getFullYear() === hoy.getFullYear()
    ? d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })
    : d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* =========================================================
   MOVIMIENTOS REGISTRADOS POR DÍA
   Muestra 7 movimientos inicialmente y permite ampliar.
========================================================= */
function movementSortTimestamp(item) {
  var d = parseLocalDate(item && item.date);
  var base = d && !isNaN(d.getTime()) ? d.getTime() : 0;
  var created = Number(item && item.createdAt);
  if (!Number.isFinite(created) || created <= 0) created = Date.parse(item && item.createdAt);
  if (!Number.isFinite(created) || created <= 0) return base;
  /* Hora local del día: con el resto de la división (hora UTC) un gasto de
     las 20:00 en Perú se ordenaba como si fuera de la 01:00. */
  var c = new Date(created);
  return base + ((c.getHours() * 60 + c.getMinutes()) * 60 + c.getSeconds()) * 1000 + c.getMilliseconds();
}

function formatMovementTime(item) {
  var raw = item && item.createdAt;
  var created = Number(raw);
  if (!Number.isFinite(created) || created <= 0) created = Date.parse(raw);
  if (Number.isFinite(created) && created > 0) {
    var d = new Date(created);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }
  return "";
}


function movementDetailModalHtml(kind, item) {
  var isIncome = kind === "income";
  var cat = isIncome ? (incomeCategoryIndex[item.category] || {}) : (categoryIndex[item.category] || {});
  var pay = isIncome ? (incomePaymentIndex[item.paymentMethod] || {}) : (paymentIndex[item.paymentMethod] || {});
  var sub = item.subcategory ? (subcategoryIndex[item.subcategory] || {}) : {};
  var note = typeof item.note === "string" ? item.note.trim() : "";
  var title = note || cat.label || (isIncome ? "Ingreso" : "Gasto");
  var categoryText = (cat.label || (isIncome ? "Ingreso" : "Gasto")) + (sub.label ? " · " + sub.label : "");
  var amountPrefix = isIncome ? "+" : "-";
  return '<div class="modal-card movement-detail-modal">' +
    '<div class="modal-header"><h3>Detalle del movimiento</h3><button type="button" id="close-movement-detail">×</button></div>' +
    '<div class="movement-detail-hero"><div class="movement-detail-icon">' + iconOrEmoji(cat.iconEmoji, cat.icon || (isIncome ? 'income' : 'more'), 20, 'currentColor') + '</div><div><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(categoryText) + '</small></div><b class="' + (isIncome ? 'movement-detail-income' : 'movement-detail-expense') + '">' + amountPrefix + formatSoles(item.amount) + '</b></div>' +
    '<div class="movement-detail-grid">' +
      '<div><small>Tipo</small><strong>' + (isIncome ? 'Ingreso' : 'Gasto') + '</strong></div>' +
      '<div><small>Método</small><strong>' + escapeHtml(pay.label || 'Sin método') + '</strong></div>' +
      '<div><small>Fecha</small><strong>' + escapeHtml(etiquetaDia(item.date) || String(item.date || '')) + '</strong></div>' +
      '<div><small>Hora</small><strong>' + escapeHtml(formatMovementTime(item) || '—') + '</strong></div>' +
    '</div>' +
    (note ? '<div class="movement-detail-note"><small>Nota</small><p>' + escapeHtml(note) + '</p></div>' : '') +
    '<div class="movement-detail-actions">' +
      '<button type="button" class="secondary-btn" id="detail-edit-movement">Editar</button>' +
      '<button type="button" class="secondary-btn" id="detail-duplicate-movement">Duplicar</button>' +
      '<button type="button" class="secondary-btn detail-delete-btn" id="detail-delete-movement">Eliminar</button>' +
    '</div>' +
  '</div>';
}
/* =========================================================
   FLUJO DE CAJA Y PROYECCIONES
========================================================= */
function cashFlowSummary(year, month) {
  year = year == null ? new Date().getFullYear() : year;
  month = month == null ? new Date().getMonth() : month;
  var now = new Date();
  var current = year === now.getFullYear() && month === now.getMonth();
  var days = new Date(year, month + 1, 0).getDate();
  var start = new Date(year, month, 1);
  var end = new Date(year, month, days);
  var incomes = state.incomes.filter(function(i){
    var d=parseLocalDate(i.date); return !isNaN(d.getTime()) && d.getFullYear()===year && d.getMonth()===month;
  });
  var expenses = state.expenses.filter(function(e){
    var d=parseLocalDate(e.date); return !isNaN(d.getTime()) && d.getFullYear()===year && d.getMonth()===month;
  });
  var income = totalIncomes(incomes);
  var spent = totalExpenses(expenses);
  var from = current ? new Date(year, month, Math.min(days, now.getDate()+1)) : start;
  var recurring = recurringProjectedAmount(null, from, end);
  var projectedExpenses = spent + recurring;
  var projectedResult = income - projectedExpenses;
  var elapsed = current ? Math.max(1, now.getDate()) : days;
  var dailySpend = elapsed ? spent / elapsed : 0;
  var projectedByPace = current ? dailySpend * days : spent;
  var projectedAtClose = Math.max(projectedExpenses, projectedByPace + recurring);
  return { income:income, spent:spent, recurring:recurring, projectedExpenses:projectedExpenses,
    projectedResult:projectedResult, projectedAtClose:projectedAtClose, dailySpend:dailySpend,
    available: income - projectedAtClose, current:current };
}

function savingsGoalPlan(goal) {
  var target=Number(goal.target)||0, saved=Number(goal.saved)||0;
  var remaining=Math.max(0,target-saved);
  var deadline=goal.targetDate ? parseLocalDate(goal.targetDate) : null;
  if (!deadline || isNaN(deadline.getTime()) || remaining<=0) return {remaining:remaining, months:0, monthly:0, days:0, status:remaining<=0?'Completada':'Sin fecha objetivo'};
  var now=new Date();
  var months=Math.max(1,(deadline.getFullYear()-now.getFullYear())*12+(deadline.getMonth()-now.getMonth())+(deadline.getDate()>now.getDate()?1:0));
  var monthly=remaining/months;
  var days=Math.ceil((deadline-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
  return {remaining:remaining,months:months,monthly:monthly,days:days,status:days<0?'Atrasada':'En camino'};
}

/* =========================================================
   INICIO
   Responde a una sola pregunta —¿cómo voy este mes?— en este orden:
   resultado, dinero disponible, presupuesto y últimos movimientos. Lo que
   mira hacia atrás o hacia adelante (comparativas, proyecciones) vive en
   Análisis.
========================================================= */

var RECIENTES_EN_INICIO = 5;
var PRESUPUESTOS_EN_INICIO = 3;

function saludoSegunHora() {
  var hora = new Date().getHours();
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/* Accesos directos a las secciones que no caben en la barra inferior. Evita
   que queden sepultadas dentro del menú "Más". Presupuestos no está porque
   ya tiene su propio bloque en esta pantalla. */
function accesosRapidosHtml() {
  var accesos = [
    { pantalla: "pendientes", etiqueta: "Pendientes", icono: "clock" },
    { pantalla: "deudas", etiqueta: "Deudas", icono: "handshake" },
    { pantalla: "metas", etiqueta: "Metas", icono: "award" },
    { pantalla: "meses", etiqueta: "Calendario", icono: "calendar" }
  ];

  return '<div class="quick-actions">' +
    accesos.map(function (acceso) {
      return '<button type="button" class="quick-action" data-top-screen="' + acceso.pantalla + '">' +
        '<span class="quick-action-icon">' + icon(acceso.icono, 20, "currentColor") + '</span>' +
        '<span class="quick-action-label">' + escapeHtml(acceso.etiqueta) + '</span>' +
      '</button>';
    }).join("") +
  '</div>';
}

function nivelPresupuesto(pct) {
  return pct > 100 ? "danger" : pct >= 80 ? "warning" : "good";
}

/* Un solo bloque: el total del mes y las categorías más cerca de su límite.
   Antes había una tarjeta por categoría —incluidas las que no tienen
   presupuesto— y ocupaban más de una pantalla. */
function presupuestoInicioHtml(spent) {
  var conPresupuesto = CATEGORIES.filter(function (cat) {
    return Number(state.budgets[cat.id] || 0) > 0;
  });

  if (!conPresupuesto.length) {
    return '<section class="home-card home-budget-empty">' +
      '<p>Define un presupuesto por categoría para saber cuánto te queda cada mes.</p>' +
      '<button type="button" class="secondary-btn" data-top-screen="presupuestos">Crear presupuesto</button>' +
    '</section>';
  }

  var totalPresupuesto = 0;
  var totalGastado = 0;
  var filas = conPresupuesto.map(function (cat) {
    var limite = Number(state.budgets[cat.id] || 0);
    var gastado = Number(spent[cat.id] || 0);
    totalPresupuesto += limite;
    totalGastado += gastado;
    return { cat: cat, limite: limite, gastado: gastado, pct: (gastado / limite) * 100 };
  }).sort(function (a, b) { return b.pct - a.pct; });

  var pctTotal = totalPresupuesto ? (totalGastado / totalPresupuesto) * 100 : 0;
  var restante = totalPresupuesto - totalGastado;

  return '<section class="home-card home-budget">' +
    '<div class="home-card-head">' +
      '<h2>Presupuesto del mes</h2>' +
      '<button type="button" class="home-card-link" data-top-screen="presupuestos">Ver todos</button>' +
    '</div>' +
    '<div class="home-budget-total">' +
      '<strong class="amt">' + formatSoles(totalGastado) + '</strong>' +
      '<span>de ' + formatSoles(totalPresupuesto) + '</span>' +
    '</div>' +
    '<div class="budget-track budget-track-' + nivelPresupuesto(pctTotal) + '"><div style="width:' + Math.min(100, pctTotal).toFixed(1) + '%"></div></div>' +
    '<p class="home-budget-left' + (restante < 0 ? ' is-over' : '') + '">' +
      (restante < 0 ? 'Te pasaste por ' + formatSoles(-restante) : 'Te quedan ' + formatSoles(restante)) +
    '</p>' +
    '<ul class="home-budget-list">' +
      filas.slice(0, PRESUPUESTOS_EN_INICIO).map(function (fila) {
        return '<li>' +
          '<div class="home-budget-row">' +
            '<span class="home-budget-name">' + iconOrEmoji(fila.cat.iconEmoji, fila.cat.icon, 15, "currentColor") + escapeHtml(fila.cat.label) + '</span>' +
            '<span class="home-budget-pct budget-pct-' + nivelPresupuesto(fila.pct) + '">' + Math.round(fila.pct) + '%</span>' +
          '</div>' +
          '<div class="budget-track budget-track-thin budget-track-' + nivelPresupuesto(fila.pct) + '"><div style="width:' + Math.min(100, fila.pct).toFixed(1) + '%"></div></div>' +
        '</li>';
      }).join("") +
    '</ul>' +
  '</section>';
}

function renderHome() {
  var monthExpenses = currentMonthExpenses();
  var monthIncomes = currentMonthIncomes();
  var spent = spentByCategory(monthExpenses);
  var totalSpent = totalExpenses(monthExpenses);
  var totalIncome = totalIncomes(monthIncomes);
  var balance = totalIncome - totalSpent;

  var accountTotal = totalAccountBalance();
  var pendingTotal = pendingPaymentsTotal();
  var availableReal = accountTotal - pendingTotal;
  var committed = budgetMonthSummary(new Date().getFullYear(), new Date().getMonth()).committed;

  /* Los últimos movimientos, no solo los de este mes: el día 1 la lista
     quedaba vacía aunque hubiera actividad de ayer. */
  var recent = state.expenses.map(function (e) { return { kind: "expense", item: e }; })
    .concat(state.incomes.map(function (e) { return { kind: "income", item: e }; }))
    .sort(function (a, b) { return movementSortTimestamp(b.item) - movementSortTimestamp(a.item); })
    .slice(0, RECIENTES_EN_INICIO);

  return (
    '<div class="home-page">' +

      '<p class="home-saludo">' + escapeHtml(saludoSegunHora()) + '</p>' +
      '<p class="home-hero-kicker">' + escapeHtml(monthLabelFor(monthKey(new Date()))) + ' · Resultado del mes</p>' +
      '<p class="home-hero-amount' + (balance < 0 ? ' is-negative' : '') + '">' +
        (balance < 0 ? "-" : "") + formatSoles(Math.abs(balance)) +
      '</p>' +
      '<p class="home-hero-detail">' +
        "Ingresos " + formatSoles(totalIncome) +
        " · Gastos " + formatSoles(totalSpent) +
        (committed ? " · Comprometido " + formatSoles(committed) : "") +
      '</p>' +

      '<section class="home-balance">' +
        '<div class="home-balance-row"><span>Dinero en cuentas</span><b>' + (accountTotal < 0 ? '-' : '') + formatSoles(Math.abs(accountTotal)) + '</b></div>' +
        (pendingTotal ? '<div class="home-balance-row"><span>Pagos pendientes</span><b class="home-pending-value">-' + formatSoles(pendingTotal) + '</b></div>' : '') +
        '<div class="home-balance-row home-balance-total"><span>Disponible real</span><b class="' + (availableReal < 0 ? 'danger-text' : '') + '">' + (availableReal < 0 ? '-' : '') + formatSoles(Math.abs(availableReal)) + '</b></div>' +
        '<button type="button" class="home-balance-link" id="open-accounts-home">Ver cuentas</button>' +
      '</section>' +

      accesosRapidosHtml() +

      presupuestoInicioHtml(spent) +

      '<section class="home-card home-recent">' +
        '<div class="home-card-head">' +
          '<h2>Últimos movimientos</h2>' +
          (recent.length ? '<button type="button" class="home-card-link" data-top-screen="movimientos">Ver todos</button>' : '') +
        '</div>' +
        (recent.length
          ? '<div class="tx-list tx-list-flush">' + recent.map(function (entry) {
              return entry.kind === "income" ? renderIncomeRow(entry.item) : renderTxRow(entry.item);
            }).join("") + '</div>'
          : '<p class="home-card-empty">Aún no registras movimientos. Toca <b>Gasto</b> o <b>Ingreso</b> arriba para empezar.</p>') +
      '</section>' +

    '</div>'
  );
}
/* =========================================================
   CUENTAS Y TRANSFERENCIAS
========================================================= */

function accountMenuHtml(method, meta) {
  var menuId = 'account-' + method.id;
  return '<div class="settings-item-menu account-item-menu" data-settings-item-menu="' + menuId + '">' +
    '<div class="settings-item-menu-dropdown" data-item-menu-dropdown="' + menuId + '">' +
      '<button type="button" class="settings-item-menu-option" data-toggle-account-hidden="' + escapeHtml(method.id) + '">' + icon(meta.hidden ? 'eye' : 'eyeOff', 15) + '<span>' + (meta.hidden ? 'Mostrar cuenta' : 'Ocultar cuenta') + '</span></button>' +
      '<button type="button" class="settings-item-menu-option settings-item-menu-option-danger" data-delete-account="' + escapeHtml(method.id) + '">' + icon('x', 15) + '<span>Eliminar cuenta</span></button>' +
    '</div>' +
  '</div>';
}

var TIPO_DE_CUENTA = { cash: "Efectivo", wallet: "Billetera digital", bank: "Banco", card: "Tarjeta" };
var TRANSFERENCIAS_VISIBLES = 10;

function accountIconHtml(method, size) {
  return marcaHtml(method, size, "account-icon");
}

/* Fila de cuenta. Tocarla abre "Ajustar saldo"; mantenerla presionada, el
   menú de ocultar/eliminar. Antes cada ficha llevaba siempre a la vista un
   campo de saldo y un botón "Actualizar": siete formularios abiertos para una
   acción que se hace de vez en cuando. */
function accountRowHtml(method) {
  var balance = accountBalance(method.id);
  var meta = accountMeta(method.id);
  var tipo = TIPO_DE_CUENTA[method.icon] || "Cuenta";
  if (tipo === method.label) tipo = ""; /* "Efectivo · Efectivo" no aporta nada */
  var detalle = [tipo, meta.custom ? "Personalizada" : ""].filter(Boolean).join(" · ");
  return '<div class="account-row" role="button" tabindex="0" data-account-adjust="' + escapeHtml(method.id) + '" data-account-longpress="' + escapeHtml(method.id) + '">' +
    accountIconHtml(method, 18) +
    '<div class="account-row-body">' +
      '<strong>' + escapeHtml(method.label) + '</strong>' +
      (detalle ? '<small>' + escapeHtml(detalle) + '</small>' : '') +
    '</div>' +
    '<strong class="account-balance ' + (balance < 0 ? 'is-negative' : '') + '">' + (balance < 0 ? '-' : '') + formatSoles(Math.abs(balance)) + '</strong>' +
    accountMenuHtml(method, meta) +
  '</div>';
}

function transferRowHtml(item) {
  var from = paymentIndex[item.fromAccount] || {};
  var to = paymentIndex[item.toAccount] || {};
  return '<div class="transfer-row" role="button" tabindex="0" data-edit-transfer="' + escapeHtml(item.id) + '">' +
    '<div class="transfer-row-body">' +
      '<strong>' + escapeHtml(from.label || item.fromAccount) + ' → ' + escapeHtml(to.label || item.toAccount) + '</strong>' +
      '<small>' + escapeHtml(etiquetaDia(item.date)) + (item.note ? ' · ' + escapeHtml(item.note) : '') + '</small>' +
    '</div>' +
    '<strong class="transfer-amount">' + formatSoles(item.amount) + '</strong>' +
  '</div>';
}

function renderAccounts() {
  var total = totalAccountBalance();
  var visible = PAYMENT_METHODS.filter(function (method) { return !isAccountHidden(method.id); });
  var hidden = PAYMENT_METHODS.filter(function (method) { return isAccountHidden(method.id); });
  var transfers = (state.transfers || []).slice().sort(function (a, b) { return movementSortTimestamp(b) - movementSortTimestamp(a); });

  return '<div class="analysis-page accounts-page">' +
    '<p class="analysis-kicker">Saldo total</p>' +
    '<h2 class="accounts-total' + (total < 0 ? ' is-negative' : '') + '">' + (total < 0 ? '-' : '') + formatSoles(Math.abs(total)) + '</h2>' +
    '<p class="accounts-total-detail">En ' + visible.length + ' cuenta' + (visible.length === 1 ? '' : 's') + '</p>' +
    '<div class="accounts-actions">' +
      '<button type="button" class="primary-btn" id="add-transfer-btn"' + (visible.length < 2 ? ' disabled title="Necesitas al menos dos cuentas visibles"' : '') + '>Transferir</button>' +
      '<button type="button" class="secondary-btn" id="add-account-btn">Nueva cuenta</button>' +
    '</div>' +

    '<div class="tx-list accounts-list">' +
      (visible.map(accountRowHtml).join('') || '<p class="data-tools-copy">No hay cuentas visibles.</p>') +
    '</div>' +
    '<p class="accounts-hint">Toca una cuenta para ajustar su saldo. Mantenla presionada para ocultarla o eliminarla.</p>' +

    (hidden.length
      ? '<details class="accounts-hidden"><summary>Cuentas ocultas (' + hidden.length + ')</summary>' +
          '<div class="tx-list accounts-list">' + hidden.map(accountRowHtml).join('') + '</div>' +
        '</details>'
      : '') +

    (transfers.length
      ? '<section class="accounts-transfers">' +
          '<p class="section-label">Transferencias recientes</p>' +
          '<div class="tx-list">' + transfers.slice(0, TRANSFERENCIAS_VISIBLES).map(transferRowHtml).join('') + '</div>' +
        '</section>'
      : '') +
  '</div>';
}

/* Ajustar el saldo no crea un gasto ni un ingreso: corrige el saldo inicial
   para que el actual coincida con lo que la persona ve en su banco. */
function adjustBalanceForm(method) {
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Ajustar saldo</h3><button type="button" id="close-adjust-balance" aria-label="Cerrar">×</button></div>' +
    '<div class="adjust-balance-account">' + accountIconHtml(method, 18) + '<strong>' + escapeHtml(method.label) + '</strong></div>' +
    '<label>Saldo actual<input id="adjust-balance-value" type="number" step="0.01" inputmode="decimal" value="' + Number(accountBalance(method.id)).toFixed(2) + '"></label>' +
    '<p class="modal-hint">Escribe el saldo que ves en tu banco o billetera. La diferencia se registra como ajuste, sin contar como gasto ni ingreso.</p>' +
    '<button type="button" class="primary-btn" id="save-adjust-balance">Guardar saldo</button>' +
  '</div>';
}

function accountForm() {
  var baseOptions = DEFAULT_PAYMENT_METHODS.map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.label) + '</option>'; }).join('');
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Nueva cuenta</h3><button type="button" id="close-account">×</button></div>' +
    '<label>Entidad o tipo<select id="account-base">' + baseOptions + '</select></label>' +
    '<label>Nombre de la cuenta<input id="account-name" type="text" placeholder="Ej. BCP Ahorros"></label>' +
    '<label>Ingresar saldo<input id="account-opening" type="number" step="0.01" value="0.00"></label>' +
    '<button type="button" class="primary-btn" id="save-account">Crear cuenta</button>' +
  '</div>';
}

function transferForm(item) {
  item = item || null;
  var methods = visiblePaymentMethods(PAYMENT_METHODS);
  if (item) {
    [item.fromAccount, item.toAccount].forEach(function (id) {
      if (!id || methods.some(function (p) { return p.id === id; })) return;
      var existing = PAYMENT_METHODS.find(function (p) { return p.id === id; });
      if (existing) methods.push(existing);
    });
  }
  var optionsFor = function (selectedId) {
    return methods.map(function (p) { return '<option value="' + escapeHtml(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>'; }).join('');
  };
  var fromId = item ? item.fromAccount : (methods[0] ? methods[0].id : '');
  var toId = item ? item.toAccount : (methods[1] ? methods[1].id : fromId);
  var amount = item ? Number(item.amount).toFixed(2) : '';
  var date = item && item.date ? item.date : localDateKey(new Date());
  var note = item && item.note ? item.note : '';
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>' + (item ? 'Editar transferencia' : 'Nueva transferencia') + '</h3><button type="button" id="close-transfer">×</button></div>' +
    '<label>Desde<select id="transfer-from">' + optionsFor(fromId) + '</select></label>' +
    '<label>Hacia<select id="transfer-to">' + optionsFor(toId) + '</select></label>' +
    '<label>Monto<input id="transfer-amount" type="number" min="0.01" step="0.01" placeholder="0.00" value="' + escapeHtml(amount) + '"></label>' +
    '<label>Fecha<input id="transfer-date" type="date" value="' + escapeHtml(date) + '"></label>' +
    '<label>Nota<input id="transfer-note" type="text" placeholder="Opcional" value="' + escapeHtml(note) + '"></label>' +
    '<button type="button" class="primary-btn" id="save-transfer">' + (item ? 'Guardar cambios' : 'Guardar transferencia') + '</button>' +
    (item ? '<button type="button" class="secondary-btn danger-btn modal-secondary-action" id="delete-transfer">Eliminar transferencia</button>' : '') +
  '</div>';
}
/* =========================================================
   PAGOS PENDIENTES
========================================================= */
/* "Vence hoy", "Vence mañana", "Vence el viernes", "Venció hace 3 días"…
   La fecha ISO (2026-10-16) obligaba a hacer la cuenta mentalmente. */
function etiquetaVencimiento(fecha) {
  var d = parseLocalDate(fecha);
  if (!d) return "";
  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  var dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - hoy) / 86400000);
  if (dias < -1) return "Venció hace " + (-dias) + " días";
  if (dias === -1) return "Venció ayer";
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  if (dias < 7) return "Vence el " + d.toLocaleDateString("es-PE", { weekday: "long" });
  return "Vence el " + d.toLocaleDateString("es-PE", { day: "numeric", month: "long" }) +
    (d.getFullYear() !== hoy.getFullYear() ? " de " + d.getFullYear() : "");
}

/* Tocar la fila abre la edición (con "Eliminar" dentro); a la vista solo
   queda la acción frecuente, marcar como pagado. */
function pendingRowHtml(item, todayKey) {
  var cat = categoryIndex[item.category] || {};
  var pay = paymentIndex[item.paymentMethod] || {};
  var isOverdue = item.dueDate < todayKey;
  var detalle = [etiquetaVencimiento(item.dueDate), pay.label, item.recurringId ? "Recurrente" : ""].filter(Boolean).join(" · ");
  return '<div class="pending-row' + (isOverdue ? ' is-overdue' : '') + '" role="button" tabindex="0" data-edit-pending="' + escapeHtml(item.id) + '">' +
    '<div class="pending-main">' +
      '<div class="pending-icon">' + iconOrEmoji(cat.iconEmoji, cat.icon, 16, 'currentColor') + '</div>' +
      '<div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(detalle) + '</small></div>' +
    '</div>' +
    '<strong class="pending-amount">' + formatSoles(item.amount) + '</strong>' +
    '<button type="button" class="secondary-btn pending-pay-btn" data-pay-pending="' + escapeHtml(item.id) + '">Marcar pagado</button>' +
  '</div>';
}

function renderPendingPayments() {
  var todayKey = localDateKey(new Date());
  var list = (state.pendingPayments || []).slice().sort(function(a,b){ return String(a.dueDate).localeCompare(String(b.dueDate)); });
  var total = list.reduce(function(sum,item){ return sum + (Number(item.amount)||0); },0);
  var overdue = list.filter(function(item){ return item.dueDate < todayKey; }).reduce(function(sum,item){ return sum + (Number(item.amount)||0); },0);

  return '<div class="analysis-page">' +
    '<p class="analysis-kicker">Pagos pendientes</p>' +
    '<h2 class="accounts-total">' + formatSoles(total) + '</h2>' +
    '<p class="accounts-total-detail">' +
      (list.length
        ? list.length + ' pago' + (list.length === 1 ? '' : 's') + ' por hacer' + (overdue ? ' · <span class="danger-text">' + formatSoles(overdue) + ' vencido</span>' : '')
        : 'Nada pendiente') +
    '</p>' +
    '<div class="accounts-actions accounts-actions-single"><button type="button" class="primary-btn" id="add-pending-btn">Nuevo pago pendiente</button></div>' +
    (list.length
      ? '<div class="tx-list">' + list.map(function (item) { return pendingRowHtml(item, todayKey); }).join('') + '</div>' +
        '<p class="accounts-hint">Toca un pago para editarlo o eliminarlo.</p>'
      : '<section class="home-card"><p class="home-card-empty">Anota aquí lo que tienes que pagar —alquiler, cuotas, recibos— para descontarlo de tu disponible real antes de que salga de tu cuenta.</p></section>') +
  '</div>';
}

function pendingPaymentForm(item){
  item = item || {};
  var categoryId = item.category || (CATEGORIES[0] ? CATEGORIES[0].id : '');
  var cats=CATEGORIES.map(function(c){return '<option value="'+escapeHtml(c.id)+'" '+(c.id===categoryId?'selected':'')+'>'+escapeHtml(c.label)+'</option>';}).join('');
  var pendingMethods = visiblePaymentMethods(PAYMENT_METHODS).slice();
  if (item.paymentMethod && !pendingMethods.some(function(p){ return p.id === item.paymentMethod; })) {
    var hiddenCurrent = PAYMENT_METHODS.find(function(p){ return p.id === item.paymentMethod; });
    if (hiddenCurrent) pendingMethods.push(hiddenCurrent);
  }
  var pays=pendingMethods.map(function(p){return '<option value="'+escapeHtml(p.id)+'" '+(p.id===item.paymentMethod?'selected':'')+'>'+escapeHtml(p.label)+'</option>';}).join('');
  var subs = '<option value="">Sin subcategoría</option>' + SUBCATEGORIES.filter(function(s){return (s.kind||'expense')==='expense' && (s.categoryId||s.category||s.parentCategory)===categoryId;}).map(function(s){return '<option value="'+escapeHtml(s.id)+'" '+(s.id===item.subcategory?'selected':'')+'>'+escapeHtml(s.label)+'</option>';}).join('');
  return '<div class="modal-card"><div class="modal-header"><h3>'+(item.id?'Editar pago pendiente':'Nuevo pago pendiente')+'</h3><button type="button" id="close-pending">×</button></div>' +
    '<label>Nombre<input id="pending-name" type="text" placeholder="Alquiler, luz, cuota..." value="'+escapeHtml(item.name||'')+'"></label><label>Monto<input id="pending-amount" type="number" min="0.01" step="0.01" placeholder="0.00" value="'+(item.amount!=null?escapeHtml(Number(item.amount).toFixed(2)):'')+'"></label>' +
    '<label>Vencimiento<input id="pending-date" type="date" value="'+escapeHtml(item.dueDate||localDateKey(new Date()))+'"></label><label>Categoría<select id="pending-category">'+cats+'</select></label>' +
    '<label>Subcategoría<select id="pending-subcategory">'+subs+'</select></label>' +
    '<label>Método de pago<select id="pending-payment">'+pays+'</select></label><label>Nota<input id="pending-note" type="text" placeholder="Opcional" value="'+escapeHtml(item.note||'')+'"></label><button type="button" class="primary-btn" id="save-pending">Guardar</button>' +
    (item.id ? '<button type="button" class="secondary-btn danger-btn modal-secondary-action" id="delete-pending">Eliminar pago</button>' : '') +
  '</div>';
}
/* =========================================================
   DEUDAS
========================================================= */

function debtProgressPct(debt) {
  if (!debt.principal) return 0;
  var paid = debt.principal - debt.balance;
  return Math.min(100, Math.max(0, (paid / debt.principal) * 100));
}

/* Fila de deuda: tocarla abre la edición (con "Eliminar" dentro). A la vista
   quedan el saldo, el avance y la acción frecuente: registrar un pago. */
function debtRowHtml(debt) {
  var pay = paymentIndex[debt.paymentMethod] || {};
  var cat = categoryIndex[debt.category] || incomeCategoryIndex[debt.category] || {};
  var isSettled = debt.balance <= 0;
  var pct = debtProgressPct(debt);
  var metaParts = [];
  if (debt.dueDate && !isSettled) metaParts.push(etiquetaVencimiento(debt.dueDate));
  if (debt.minPayment) metaParts.push("Cuota " + formatSoles(debt.minPayment));
  if (debt.interestRate) metaParts.push(debt.interestRate + "% anual");
  if (pay.label) metaParts.push(pay.label);

  return '<div class="debt-row' + (isSettled ? ' is-settled' : '') + '" role="button" tabindex="0" data-edit-debt="' + escapeHtml(debt.id) + '">' +
    '<div class="pending-main"><div class="pending-icon">' + iconOrEmoji(cat.iconEmoji, cat.icon, 16, 'currentColor') + '</div>' +
      '<div><strong>' + escapeHtml(debt.name) + '</strong>' +
      '<small>' + escapeHtml(metaParts.join(" · ") || (debt.direction === "owed" ? "Préstamo dado" : "Deuda")) + '</small></div></div>' +
    '<div class="debt-amounts">' +
      '<strong>' + formatSoles(debt.balance) + '</strong>' +
      '<small>de ' + formatSoles(debt.principal) + '</small>' +
    '</div>' +
    '<div class="budget-mini-track"><div style="width:' + pct.toFixed(1) + '%"></div></div>' +
    '<div class="debt-row-actions">' +
      (isSettled
        ? '<span class="debt-settled-badge">Liquidada</span>'
        : '<button type="button" class="secondary-btn debt-pay-btn" data-pay-debt="' + escapeHtml(debt.id) + '">' + (debt.direction === "owed" ? "Registrar cobro" : "Registrar pago") + '</button>') +
    '</div>' +
  '</div>';
}

function debtSectionHtml(titulo, botonId, lista, vacio) {
  return '<section class="debt-section">' +
    '<div class="home-card-head"><h2>' + titulo + '</h2><button type="button" class="home-card-link" id="' + botonId + '">Añadir</button></div>' +
    (lista.length
      ? '<div class="tx-list">' + lista.map(debtRowHtml).join("") + '</div>'
      : '<p class="home-card-empty debt-empty">' + vacio + '</p>') +
  '</section>';
}

function renderDebts() {
  var debts = (state.debts || []).slice().sort(function (a, b) {
    if (a.balance <= 0 !== b.balance <= 0) return a.balance <= 0 ? 1 : -1;
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  });
  var owe = debts.filter(function (d) { return d.direction === "owe"; });
  var owed = debts.filter(function (d) { return d.direction === "owed"; });
  var totalOwe = totalDebtBalance("owe");
  var totalOwed = totalDebtBalance("owed");
  var net = totalOwed - totalOwe;

  /* Un balance en lugar de tres tarjetas en rojo: el signo ya dice si
     debes más de lo que te deben. */
  return '<div class="analysis-page">' +
    '<p class="analysis-kicker">Deudas · balance neto</p>' +
    '<h2 class="accounts-total">' + (net < 0 ? '-' : '') + formatSoles(Math.abs(net)) + '</h2>' +
    '<p class="accounts-total-detail">Debes ' + formatSoles(totalOwe) + ' · Te deben ' + formatSoles(totalOwed) + '</p>' +
    debtSectionHtml("Lo que debo", "add-debt-owe-btn", owe, "No registras deudas propias.") +
    debtSectionHtml("Lo que me deben", "add-debt-owed-btn", owed, "Nadie te debe dinero registrado.") +
    (debts.length ? '<p class="accounts-hint">Toca una deuda para editarla o eliminarla.</p>' : '') +
  '</div>';
}

function debtForm(item, defaultDirection) {
  item = item || {};
  var direction = item.direction || defaultDirection || "owe";
  var isExpenseSide = direction === "owe";
  var categories = isExpenseSide ? CATEGORIES : INCOME_CATEGORIES;
  var categoryId = item.category || (categories[0] ? categories[0].id : "");
  var cats = categories.map(function (c) { return '<option value="' + escapeHtml(c.id) + '" ' + (c.id === categoryId ? "selected" : "") + '>' + escapeHtml(c.label) + "</option>"; }).join("");
  var methods = isExpenseSide ? PAYMENT_METHODS : INCOME_PAYMENT_METHODS;
  var pays = '<option value="">Sin cuenta asociada</option>' + methods.map(function (p) { return '<option value="' + escapeHtml(p.id) + '" ' + (p.id === item.paymentMethod ? "selected" : "") + '>' + escapeHtml(p.label) + "</option>"; }).join("");
  var subs = '<option value="">Sin subcategoría</option>' + (isExpenseSide ? subcategoriesOptions(categoryId, item.subcategory) : "");

  return '<div class="modal-card"><div class="modal-header"><h3>' + (item.id ? "Editar deuda" : "Nueva deuda") + '</h3><button type="button" id="close-debt">×</button></div>' +
    '<label>Nombre<input id="debt-name" type="text" placeholder="Tarjeta BCP, Préstamo a Juan..." value="' + escapeHtml(item.name || "") + '"></label>' +
    '<label>Tipo<select id="debt-direction">' +
      '<option value="owe" ' + (direction === "owe" ? "selected" : "") + '>Yo debo</option>' +
      '<option value="owed" ' + (direction === "owed" ? "selected" : "") + '>Me deben</option>' +
    '</select></label>' +
    '<label>Monto total<input id="debt-principal" type="number" min="0.01" step="0.01" placeholder="0.00" value="' + (item.principal != null ? escapeHtml(Number(item.principal).toFixed(2)) : "") + '"></label>' +
    '<label>Saldo pendiente actual<input id="debt-balance" type="number" min="0" step="0.01" placeholder="Igual al monto total si es nueva" value="' + (item.balance != null ? escapeHtml(Number(item.balance).toFixed(2)) : "") + '"></label>' +
    '<label>Tasa de interés % anual (opcional)<input id="debt-interest" type="number" min="0" step="0.01" placeholder="0" value="' + (item.interestRate ? escapeHtml(String(item.interestRate)) : "") + '"></label>' +
    '<label>Cuota mínima (opcional)<input id="debt-min-payment" type="number" min="0" step="0.01" placeholder="0.00" value="' + (item.minPayment ? escapeHtml(Number(item.minPayment).toFixed(2)) : "") + '"></label>' +
    '<label>Próximo vencimiento (opcional)<input id="debt-due-date" type="date" value="' + escapeHtml(item.dueDate || "") + '"></label>' +
    '<label>Categoría (' + (isExpenseSide ? "para el gasto" : "para el ingreso") + ' al registrar pagos)<select id="debt-category">' + cats + '</select></label>' +
    (isExpenseSide ? '<label>Subcategoría<select id="debt-subcategory">' + subs + '</select></label>' : '') +
    '<label>Cuenta asociada (opcional)<select id="debt-payment">' + pays + '</select></label>' +
    '<label>Nota<input id="debt-note" type="text" placeholder="Opcional" value="' + escapeHtml(item.note || "") + '"></label>' +
    '<button type="button" class="primary-btn" id="save-debt">Guardar</button>' +
    (item.id ? '<button type="button" class="secondary-btn danger-btn modal-secondary-action" id="delete-debt">Eliminar deuda</button>' : '') +
  '</div>';
}

function debtPaymentForm(debt) {
  var isExpenseSide = debt.direction === "owe";
  return '<div class="modal-card"><div class="modal-header"><h3>' + (isExpenseSide ? "Registrar pago" : "Registrar cobro") + '</h3><button type="button" id="close-debt-payment">×</button></div>' +
    '<p class="data-tools-copy">' + escapeHtml(debt.name) + " · Saldo actual " + formatSoles(debt.balance) + '</p>' +
    '<label>Monto<input id="debt-payment-amount" type="number" min="0.01" step="0.01" max="' + debt.balance + '" placeholder="0.00" value="' + (debt.minPayment ? Math.min(debt.minPayment, debt.balance).toFixed(2) : debt.balance.toFixed(2)) + '"></label>' +
    '<label>Fecha<input id="debt-payment-date" type="date" value="' + escapeHtml(localDateKey(new Date())) + '"></label>' +
    '<label>Nota (opcional)<input id="debt-payment-note" type="text" placeholder="Opcional" value=""></label>' +
    '<button type="button" class="primary-btn" id="save-debt-payment">' + (isExpenseSide ? "Registrar pago" : "Registrar cobro") + '</button></div>';
}
/* =========================================================
   AGREGAR GASTO
========================================================= */

function renderAdd() {
  var editing = state.editingType === "expense" && !!state.editingId;
  var monthTotal = currentMonthExpenses().reduce(function (sum, e) {
    return sum + Number(e.amount || 0);
  }, 0);


  if (!state.addDraft) {

    state.addDraft = {
      amount: "",
      note: "",
      category: null,
      subcategory: null,
      paymentMethod: null
    };

  }

  var d =
    state.addDraft;

  var amountValue =
    escapeHtml(
      d.amount || ""
    );

  var noteValue =
    escapeHtml(
      d.note || ""
    );

  var catChips =
    CATEGORIES.map(function (cat) {

      var selected =
        d.category === cat.id;

      return (

        '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
          ' data-cat="' + cat.id + '" aria-pressed="' + selected + '">' +

          icon(cat.icon, 15, 'currentColor') +

          escapeHtml(cat.label) +

        '</button>'

      );

    }).join("");

  var addSubcats = d.category ? subcategoriesFor("expense", d.category) : [];
  var subcategoryPicker = addSubcats.length
    ? '<p class="section-label js-section-top">Subcategoría</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px" id="subcategory-group">' +
      addSubcats.map(function (sub) {
        var selected = d.subcategory === sub.id;
        var iconData = subcategoryIconData(sub);
        return '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '" data-add-subcategory="' + escapeHtml(sub.id) + '" aria-pressed="' + selected + '">' +
          iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + escapeHtml(sub.label) + '</button>';
      }).join("") +
      '</div>'
    : "";

  var payButtons =
    visiblePaymentMethods(PAYMENT_METHODS).map(function (pay) {

      var selected =
        d.paymentMethod === pay.id;

      return (

        /* La selección se marca igual que en categorías. Con el color de la
           entidad como borde, elegir BBVA (azul marino) en tema oscuro no
           se distinguía de no elegir nada. */
        '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
          ' data-pay="' + pay.id + '" aria-pressed="' + selected + '">' +

          marcaHtml(pay, 12, "marca-xs") +

          '<span>' +
            escapeHtml(pay.label) +
          '</span>' +

        '</button>'

      );

    }).join("");


  return (

    '<div style="padding:20px 20px 12px">' +

      '<div style="' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'margin-bottom:20px' +
      '">' +

        '<button class="icon-btn" id="cancel-add">' +

          icon("x", 20) +

        '</button>' +

        '<div style="display:flex;align-items:center;gap:8px">' +
          '<p style="font-size:15px;font-weight:600;margin:0">' + (editing ? "Editar Gasto" : "Nuevo Gasto") + '</p>' +
          '<button type="button" class="secondary-btn" id="open-recurring-from-expenses" style="width:auto;padding:8px 10px;font-size:11px">↻ Recurrentes</button>' +
        '</div>' +
        '<span style="width:28px"></span>' +

      '</div>' +

      '<div style="' +
        'text-align:center;' +
        'margin-bottom:20px' +
      '">' +

        '<p style="' +
          'font-size:13px;' +
          'color:var(--text-muted);' +
          'margin:0 0 4px' +
        '">' +

          "Monto" +

        '</p>' +

        '<div style="' +
          'display:flex;' +
          'align-items:baseline;' +
          'justify-content:center;' +
          'gap:4px' +
        '">' +

          '<span class="disp" style="' +
            'font-size:20px;' +
            'color:var(--text-muted)' +
          '">' +

            "S/" +

          '</span>' +

          '<input ' +
            'type="number" ' +
            'inputmode="decimal" ' +
            'placeholder="0.00" ' +
            'id="amount-input" ' +
            'class="disp" ' +
            'value="' + amountValue + '" ' +
            'style="' +
              'border:none;' +
              'background:none;' +
              'font-size:38px;' +
              'font-weight:600;' +
              'width:160px;' +
              'text-align:center;' +
              'color:var(--ink)' +
            '"' +
          '/>' +

        '</div>' +

        '<p class="error-text" id="amount-error" style="display:none">' +
          "Ingresa un monto válido." +
        '</p>' +

      '</div>' +

      '<p class="section-label">' +
        "Categoría" +
      '</p>' +

      '<div style="' +
        'display:flex;' +
        'flex-wrap:wrap;' +
        'gap:8px;' +
        'margin-bottom:6px' +
        '" id="cat-group">' +

        catChips +

      '</div>' +

      '<p class="error-text" id="cat-error" style="display:none">' +
        "Elige una categoría." +
      '</p>' +

      subcategoryPicker +

      '<p class="section-label" class="js-section-top">' +
        "Método de pago" +
      '</p>' +

      '<div style="' +
        'display:flex;' +
        'flex-wrap:wrap;' +
        'gap:8px;' +
        'margin-bottom:6px' +
        '" id="pay-group">' +

        payButtons +

      '</div>' +

      '<p class="error-text" id="pay-error" style="display:none">' +
        "Elige un método de pago." +
      '</p>' +

      '<input ' +
        'type="text" ' +
        'placeholder="Nota (opcional)" ' +
        'id="note-input" ' +
        'class="field-input" ' +
        'value="' + noteValue + '" ' +
        'style="margin-top:14px;margin-bottom:18px"' +
      '/>' +

      '<button class="primary-btn" id="save-expense-btn">' +
        (editing ? "Guardar Cambios" : "Guardar Gasto") +
      '</button>' +

    '</div>'

  );

}

/* =========================================================
   MOVIMIENTOS
========================================================= */

var MOVIMIENTOS_POR_PAGINA = 30;

function duplicateMovement(kind, movementId) {
  var isIncome = kind === "income";
  var list = isIncome ? state.incomes : state.expenses;
  var original = list.find(function (item) { return item.id === movementId; });
  if (!original) return null;
  var now = new Date();
  var copy = Object.assign({}, original, {
    id: makeId(isIncome ? "income" : "expense"),
    date: localDateKey(now),
    createdAt: now.getTime()
  });
  delete copy.recurringId;
  delete copy.occurrenceDate;
  list.unshift(copy);
  persist();
  render();
  return copy;
}

function renderMovimientos() {
  var typeFilter = state.movementTypeFilter || "todos";
  var categoryFilter = state.movementCategoryFilter || "todos";
  var subcategoryFilter = state.movementSubcategoryFilter || "todos";

  function filterListByCategory(list, kind) {
    var result = Array.isArray(list) ? list.slice() : [];
    if (typeFilter !== kind) return result;
    if (categoryFilter !== "todos") {
      result = result.filter(function (item) { return item.category === categoryFilter; });
      if (subcategoryFilter !== "todos") {
        result = result.filter(function (item) { return item.subcategory === subcategoryFilter; });
      }
    }
    return result;
  }

  var filtered = [];
  if (typeFilter === "todos" || typeFilter === "expense") {
    filterListByCategory(state.expenses, "expense").forEach(function (e) {
      filtered.push({ kind: "expense", item: e });
    });
  }
  if (typeFilter === "todos" || typeFilter === "income") {
    filterListByCategory(state.incomes, "income").forEach(function (e) {
      filtered.push({ kind: "income", item: e });
    });
  }

  /* Por fecha del movimiento y, dentro del día, por hora de registro. Ordenar
     solo por hora de registro partía un mismo día en dos grupos cuando se
     anotaba algo con fecha pasada. */
  filtered.sort(function (a, b) {
    return movementSortTimestamp(b.item) - movementSortTimestamp(a.item);
  });

  if (state.movementSearch || state.movementMonth !== "all" || state.movementYear !== "all") {
    var q = (state.movementSearch || "").toLowerCase().trim();
    filtered = filtered.filter(function (entry) {
      var item = entry.item;
      var cat = entry.kind === "income" ? (incomeCategoryIndex[item.category] || {}) : (categoryIndex[item.category] || {});
      var pay = entry.kind === "income" ? (incomePaymentIndex[item.paymentMethod] || {}) : (paymentIndex[item.paymentMethod] || {});
      var sub = subcategoryIndex[item.subcategory] || {};
      var haystack = [item.note, Number(item.amount || 0).toFixed(2), item.date, cat.label, pay.label, sub.label].join(" ").toLowerCase();
      if (q && haystack.indexOf(q) === -1) return false;
      if (state.movementMonth && state.movementMonth !== "all" && String(item.date || '').slice(5,7) !== String(state.movementMonth).padStart(2,"0")) return false;
      if (state.movementYear && state.movementYear !== "all" && String(item.date || '').slice(0,4) !== String(state.movementYear)) return false;
      return true;
    });
  }

  var availableMovementYears = {};
  state.expenses.concat(state.incomes).forEach(function(item){
    var d = parseLocalDate(item.date);
    if (!isNaN(d.getTime())) availableMovementYears[d.getFullYear()] = true;
  });
  var currentMovementYear = new Date().getFullYear();
  var movementYears = Object.keys(availableMovementYears).map(Number)
    .filter(function(y){ return y <= currentMovementYear; })
    .sort(function(a,b){ return b-a; });

  var activeMovementFilterCount = (state.movementSearch || "").trim() ? 1 : 0;
  if (state.movementYear !== "all") activeMovementFilterCount++;
  if (state.movementYear !== "all" && state.movementMonth !== "all") activeMovementFilterCount++;
  if (typeFilter !== "todos") activeMovementFilterCount++;
  if (categoryFilter !== "todos") activeMovementFilterCount++;
  if (subcategoryFilter !== "todos") activeMovementFilterCount++;

  var movementMonthOptions = [
    ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],["05","Mayo"],["06","Junio"],
    ["07","Julio"],["08","Agosto"],["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
  ];

  var movementSearchHtml =
    '<div class="movement-filter-wrap movement-filter-wrap-top">' +
      '<button type="button" class="movement-filter-icon" id="movement-filter-toggle" aria-label="Filtrar movimientos" aria-expanded="' + (state.movementFiltersOpen ? 'true' : 'false') + '" title="Filtrar movimientos">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        (activeMovementFilterCount ? '<span class="movement-filter-count">' + activeMovementFilterCount + '</span>' : '') +
      '</button>' +
      '<div class="movement-filter-panel movement-filter-panel-compact movement-filter-panel-year-first" id="movement-filter-panel" ' + (state.movementFiltersOpen ? '' : 'hidden') + '>' +
        '<input type="search" id="movement-search" class="movement-search" placeholder="Buscar por nota, categoría, método o monto" aria-label="Buscar movimientos" value="' + escapeHtml(state.movementSearch || "") + '" autocomplete="off">' +
        '<select id="movement-year-filter" aria-label="Seleccionar año"><option value="all" ' + (state.movementYear === "all" ? 'selected' : '') + '>Año</option>' +
          movementYears.map(function(y){ return '<option value="'+y+'" '+(String(state.movementYear)===String(y)?'selected':'')+'>'+y+'</option>'; }).join("") +
        '</select>' +
        (state.movementYear !== "all" ? '<select id="movement-month-filter" aria-label="Seleccionar mes"><option value="all" ' + (state.movementMonth === "all" ? 'selected' : '') + '>Mes</option>' +
          movementMonthOptions.map(function(m){ return '<option value="'+m[0]+'" '+(state.movementMonth===m[0]?'selected':'')+'>'+m[1]+'</option>'; }).join("") + '</select>' : '') +
      '</div>' +
    '</div>';

  /* Se muestran de MOVIMIENTOS_POR_PAGINA en MOVIMIENTOS_POR_PAGINA. Antes
     eran solo 7 —media pantalla— y "Mostrar más" saltaba a un mes entero. */
  var limite = Number(state.movementLimit) || MOVIMIENTOS_POR_PAGINA;
  var displayFiltered = filtered.slice(0, limite);
  var hasMoreMovement = filtered.length > displayFiltered.length;

  var groups = {}, order = [];
  displayFiltered.forEach(function (entry) {
    var key = entry.item.date;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(entry);
  });

  var selectedKind = typeFilter === "expense" || typeFilter === "income" ? typeFilter : null;
  var availableCategories = selectedKind === "expense" ? CATEGORIES : (selectedKind === "income" ? INCOME_CATEGORIES : []);
  var availableSubcategories = selectedKind && categoryFilter !== "todos" ? subcategoriesFor(selectedKind, categoryFilter) : [];
  var categoryControls = selectedKind ?
    '<div class="movement-secondary-filters movement-chip-filters">' +
      '<div class="movement-filter-group movement-category-group" aria-label="Filtrar por categoría">' +
        '<div class="movement-filter-label-row"><span class="movement-filter-label">Categoría</span></div>' +
        '<div class="movement-filter-chips movement-category-chips">' +
          '<button type="button" class="cat-chip movement-category-chip' + (categoryFilter === "todos" ? ' active is-selected' : '') + '" data-movement-category="todos" aria-pressed="' + (categoryFilter === "todos" ? 'true' : 'false') + '">' +
            icon("grid", 13, "currentColor") + '<span>Todas</span>' +
          '</button>' +
          availableCategories.map(function(cat){
            var selected = categoryFilter === cat.id;
            return '<button type="button" class="cat-chip movement-category-chip' + (selected ? ' active is-selected' : '') + '" data-movement-category="' + escapeHtml(cat.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
              iconOrEmoji(cat.iconEmoji, cat.icon || 'tag', 13, 'currentColor') + '<span>' + escapeHtml(cat.label) + '</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</div>' +
      (categoryFilter !== "todos" && availableSubcategories.length ?
        '<div class="movement-filter-group movement-subcategory-group" aria-label="Filtrar por subcategoría">' +
          '<div class="movement-filter-label-row"><span class="movement-filter-label">Subcategoría</span></div>' +
          '<div class="movement-filter-chips movement-subcategory-chips">' +
            '<button type="button" class="cat-chip movement-category-chip movement-subcategory-chip' + (subcategoryFilter === "todos" ? ' active is-selected' : '') + '" data-movement-subcategory="todos" aria-pressed="' + (subcategoryFilter === "todos" ? 'true' : 'false') + '">' +
              icon("tag", 12, "currentColor") + '<span>Todas</span>' +
            '</button>' +
            availableSubcategories.map(function(sub){
              var selected = subcategoryFilter === sub.id;
              return '<button type="button" class="cat-chip movement-category-chip movement-subcategory-chip' + (selected ? ' active is-selected' : '') + '" data-movement-subcategory="' + escapeHtml(sub.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
                iconOrEmoji(subcategoryIconData(sub).iconEmoji, subcategoryIconData(sub).icon || "more", 12, "currentColor") + '<span>' + escapeHtml(sub.label) + '</span>' +
              '</button>';
            }).join("") +
          '</div>' +
        '</div>' : '') +
    '</div>' : '';

  var movementPaging = hasMoreMovement
    ? '<div class="movement-paging"><button type="button" class="secondary-btn" data-movement-show-more>Mostrar más</button></div>'
    : '';

  var movementTypeControls =
    '<div class="movement-type-controls" role="group" aria-label="Tipo de movimiento">' +
      '<button type="button" class="movement-type-btn ' + (typeFilter === "todos" ? 'active' : '') + '" data-movement-type="todos">Todos</button>' +
      '<button type="button" class="movement-type-btn ' + (typeFilter === "expense" ? 'active' : '') + '" data-movement-type="expense">Gastos</button>' +
      '<button type="button" class="movement-type-btn ' + (typeFilter === "income" ? 'active' : '') + '" data-movement-type="income">Ingresos</button>' +
    '</div>' + categoryControls;

  var hayBusqueda = !!(state.movementSearch || "").trim();
  var vacio = state.expenses.length + state.incomes.length === 0
    ? "Aún no registras movimientos. Usa Gasto o Ingreso arriba para empezar."
    : (hayBusqueda ? "Ningún movimiento coincide con la búsqueda." : "No hay movimientos con este filtro.");

  var movementRecordsContent = (filtered.length === 0 ? '<div class="empty-state"><p>' + vacio + '</p></div>' :
    order.map(function (key) {
      var entries = groups[key];
      /* El neto del día a la derecha del encabezado: permite repasar la
         semana sin abrir el calendario. */
      var neto = entries.reduce(function (total, entry) {
        return total + (entry.kind === "income" ? 1 : -1) * Number(entry.item.amount || 0);
      }, 0);
      return '<section class="movement-day-group">' +
        '<header class="movement-day-head"><span>' + escapeHtml(etiquetaDia(key)) + '</span>' +
          '<span class="movement-day-total">' + (neto < 0 ? '-' : '+') + formatSoles(Math.abs(neto)) + '</span></header>' +
        '<div class="tx-list">' +
          entries.map(function (entry) { return entry.kind === "income" ? renderIncomeRow(entry.item) : renderTxRow(entry.item); }).join("") +
        '</div>' +
      '</section>';
    }).join("")) + movementPaging;

  return '<div style="padding:20px 20px 12px"><section class="movement-records-section" aria-labelledby="movement-records-title">' +
    '<div class="movement-records-header">' +
      '<div><div id="movement-records-title" class="movement-records-title">Movimientos registrados</div><div class="movement-records-subtitle">' + filtered.length + ' movimiento' + (filtered.length === 1 ? '' : 's') + '</div></div>' +
      movementSearchHtml +
    '</div>' +
    '<div class="movement-records-content">' + movementTypeControls + movementRecordsContent + '</div>' +
  '</section></div>';
}

/* =========================================================
   MESES
========================================================= */


/* =========================================================
   CALENDARIO
========================================================= */

/* 46 → "46", 1250 → "1.3k", 12400 → "12k" (punto decimal, como formatSoles). */
function importeCompacto(valor) {
  if (valor < 1000) return String(Math.round(valor));
  var miles = valor / 1000;
  return (miles < 10 ? miles.toFixed(1) : String(Math.round(miles))) + "k";
}

function calendarDateKey(year, month, day) {
  return (
    String(year) +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function calendarItemsForDay(year, month, day) {
  var key = calendarDateKey(year, month, day);

  return state.expenses.concat(state.incomes)
    .filter(function (item) {
      var d = parseLocalDate(item.date);
      return !isNaN(d.getTime()) &&
        calendarDateKey(
          d.getFullYear(),
          d.getMonth(),
          d.getDate()
        ) === key;
    })
    .sort(function (a, b) {
      return parseLocalDate(b.date) - parseLocalDate(a.date);
    });
}

function renderCategoryChart(map, categories, emptyText) {
  var rows = categories
    .map(function (cat) {
      return { cat: cat, amount: map[cat.id] || 0 };
    })
    .filter(function (r) { return r.amount > 0; })
    .sort(function (a, b) { return b.amount - a.amount; });

  if (!rows.length) {
    return '<div class="empty-state"><p>' + escapeHtml(emptyText || 'Sin movimientos este mes.') + '</p></div>';
  }

  var max = rows.reduce(function (m, r) { return Math.max(m, r.amount); }, 1);

  return '<div class="bar-chart">' + rows.map(function (r) {
    /* El track nunca debe ocupar el 100% de la altura del stack: hay que
       reservar siempre espacio arriba para el monto (bar-chart-amount).
       Si la barra más alta llegara al 100%, el monto quedaría empujado
       fuera de la caja y, por el overflow-x:auto del contenedor
       (.bar-chart), se recorta y deja de verse en vez de desbordar hacia
       arriba. Por eso se escala el porcentaje máximo a 78% en vez de
       100%, manteniendo las proporciones entre barras pero dejando
       siempre ~22% de la altura libre para el texto del monto. */
    var pct = Math.max(4, Math.round((r.amount / max) * 78));
    return (
      '<div class="bar-chart-item">' +
        '<div class="bar-chart-stack">' +
          '<span class="bar-chart-amount amt">' + formatSoles(r.amount) + '</span>' +
          '<div class="bar-chart-track" style="height:' + pct + '%"><div class="bar-chart-fill" style="height:100%"></div></div>' +
        '</div>' +
        '<span class="bar-chart-label">' + icon(r.cat.icon, 14, 'currentColor') + '<span>' + escapeHtml(r.cat.label) + '</span></span>' +
      '</div>'
    );
  }).join('') + '</div>';
}

function filterCalendarItemsByPayment(items, paymentId) {
  if (!paymentId || paymentId === "todos") return items;
  return items.filter(function (item) {
    return item.paymentMethod === paymentId;
  });
}


function chartFilterLogoHtml(pay) {
  return marcaHtml(pay, 13, "chart-filter-logo");
}

/* Ambos desplegables de filtro (métodos de pago y el genérico de
   categoría/subcategoría) comparten exactamente el mismo componente
   visual (.chart-filter / .chart-filter-btn / .chart-filter-dropdown).
   renderPickerDropdown es la única función que arma ese HTML; cuando
   useLogo es true, cada opción se dibuja con el logo del método de pago
   (chartFilterLogoHtml) en vez de un ícono de categoría. */
function renderFilterOptionIcon(item, useLogo) {
  if (useLogo) return chartFilterLogoHtml(item);
  return item.icon ? icon(item.icon, 14, "currentColor") : '';
}

function renderPickerDropdown(dataAttr, label, items, selectedId, placeholder, includeAllOption, useLogo) {
  var buttons = includeAllOption === false ? [] : [
    '<button type="button" class="chart-filter-btn' + (!selectedId || selectedId === "todos" ? ' active' : '') + '" data-' + dataAttr + '="todos">' + escapeHtml(placeholder) + '</button>'
  ];

  items.forEach(function (item) {
    var active = selectedId === item.id;
    /* El filtro de métodos de pago (useLogo) no envuelve la etiqueta en un
       <span> adicional, igual que la implementación original; el resto de
       desplegables (categorías/subcategorías) sí lo hace, como ya venía
       funcionando. Se respeta esa diferencia para no alterar el HTML. */
    var labelHtml = useLogo ? escapeHtml(item.label) : '<span>' + escapeHtml(item.label) + '</span>';
    buttons.push(
      '<button type="button" class="chart-filter-btn' + (active ? ' active' : '') + '" data-' + dataAttr + '="' + escapeHtml(item.id) + '">' +
        renderFilterOptionIcon(item, useLogo) +
        labelHtml +
      '</button>'
    );
  });

  var selected = items.find(function (item) { return item.id === selectedId; });

  var toggleContent = selected
    ? renderFilterOptionIcon(selected, useLogo) +
      '<span class="chart-filter-toggle-text">' + escapeHtml(selected.label) + '</span>'
    : '<span class="chart-filter-toggle-text">' + escapeHtml(placeholder) + '</span>';

  return (
    '<div class="chart-filter" data-chart-filter="' + dataAttr + '">' +
      (label ? '<p class="chart-filter-label">' + escapeHtml(label) + '</p>' : '') +
      '<button type="button" class="chart-filter-toggle" data-chart-filter-toggle="' + dataAttr + '" aria-expanded="false">' +
        toggleContent +
        '<svg class="chart-filter-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</button>' +
      '<div class="chart-filter-dropdown" data-chart-filter-dropdown="' + dataAttr + '">' +
        '<div class="chart-filter-list">' + buttons.join('') + '</div>' +
      '</div>' +
    '</div>'
  );
}

/* Filtro desplegable de métodos de pago: ordena los métodos según
   `paymentOrder` y delega el armado del HTML a renderPickerDropdown
   (useLogo=true), para no duplicar la plantilla del componente. */
/* Mismo orden que en Configuración. */
function renderChartPaymentFilters(methods, selectedId, dataAttr, label) {
  return renderPickerDropdown(dataAttr, label, methods, selectedId, "Todos", true, true);
}

function renderCalendario() {
  var year = Number(state.calendarYear) || new Date().getFullYear();
  var month = Number(state.calendarMonth);
  if (isNaN(month) || month < 0 || month > 11) month = new Date().getMonth();

  var years = availableYears();
  var currentYear = new Date().getFullYear();
  if (years.indexOf(currentYear) === -1) years.push(currentYear);
  if (years.indexOf(year) === -1) years.push(year);
  years.sort(function (a, b) { return b - a; });

  function renderYearSelector() {
    var cards = years.map(function (itemYear) {
      var summary = monthlySummaryForYear(itemYear);
      var income = summary.reduce(function (sum, m) { return sum + m.incomes; }, 0);
      var expense = summary.reduce(function (sum, m) { return sum + m.expenses; }, 0);
      return (
        '<button type="button" class="calendar-level-card" data-calendar-year="' + itemYear + '">' +
          '<div class="calendar-level-main">' +
            '<strong>' + itemYear + '</strong>' +
            '' +
          '</div>' +
          '<div class="calendar-level-totals">' +
            '<span class="calendar-income">+' + formatSoles(income) + '</span>' +
            '<span class="calendar-expense">-' + formatSoles(expense) + '</span>' +
          '</div>' +
        '</button>'
      );
    }).join('');

    return (
      '<div class="calendar-page calendar-level-page">' +
        '<div class="calendar-header">' +
          '<div><p class="calendar-kicker">Calendario</p><h2 class="calendar-title">Selecciona un año</h2></div>' +
        '</div>' +
        '<p class="calendar-level-help">Elige el año para ver solamente sus meses.</p>' +
        '<div class="calendar-level-list">' + cards + '</div>' +
      '</div>'
    );
  }

  function renderMonthSelector() {
    var months = monthlySummaryForYear(year);
    var rows = months.map(function (m) {
      var face = m.balance < 0
        ? '😠'
        : (m.balance <= 200 ? '😐' : '😄');
      var faceClass = m.balance < 0
        ? 'calendar-face-negative'
        : (m.balance <= 200 ? 'calendar-face-neutral' : 'calendar-face-positive');
      var status = m.balance < 0
        ? 'En pérdida'
        : (m.balance <= 200 ? 'Balance ajustado' : 'Resultado positivo');
      var signedBalance = (m.balance < 0 ? '-' : '') + formatSoles(Math.abs(m.balance));

      return (
        '<button type="button" class="calendar-level-card calendar-month-balance-card" data-calendar-month="' + m.month + '" aria-label="' + escapeHtml(m.label) + ': ' + escapeHtml(status) + ', resultado ' + escapeHtml(signedBalance) + '">' +
          '<div class="calendar-month-face-wrap">' +
            '<span class="calendar-face ' + faceClass + '" aria-hidden="true">' + face + '</span>' +
          '</div>' +
          '<div class="calendar-level-main calendar-month-main">' +
            '<strong>' + escapeHtml(m.label) + '</strong>' +
            '<span class="calendar-month-status">' + escapeHtml(status) + '</span>' +
          '</div>' +
          '<div class="calendar-level-balance calendar-month-balance">' +
            '<span class="calendar-balance-caption">Resultado</span>' +
            '<span class="calendar-balance-value ' + (m.balance < 0 ? 'calendar-balance-negative' : '') + '">' + signedBalance + '</span>' +
          '</div>' +
        '</button>'
      );
    }).join('');

    return (
      '<div class="calendar-page calendar-level-page">' +
        '<div class="calendar-header">' +
          '<div><p class="calendar-kicker">Calendario · ' + year + '</p><h2 class="calendar-title">Selecciona un mes</h2></div>' +
          '<button type="button" class="calendar-nav-btn" data-calendar-back-years>← Años</button>' +
        '</div>' +
        '<div class="calendar-level-list calendar-month-list">' + rows + '</div>' +
      '</div>'
    );
  }

  function renderMonthDetail() {
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstDay = new Date(year, month, 1).getDay();
    var mondayOffset = (firstDay + 6) % 7;
    var selectedDay = Number(state.calendarDay) || 1;
    if (selectedDay > daysInMonth) selectedDay = daysInMonth;

    /* Índice de movimientos del mes: un solo recorrido de state.expenses y
       state.incomes en vez de que cada una de las ~30 celdas del calendario
       vuelva a escanear (calendarItemsForDay + indexOf) los arreglos
       completos. Esto no cambia el resultado, solo evita recalcularlo de
       más en cada render (incluido cuando solo cambia un filtro de método
       de pago o subcategoría, que ni siquiera afecta a esta grilla). */
    var monthExpensesByDay = {};
    var monthIncomesByDay = {};
    for (var dInit = 1; dInit <= daysInMonth; dInit++) {
      monthExpensesByDay[dInit] = [];
      monthIncomesByDay[dInit] = [];
    }
    state.expenses.forEach(function (item) {
      var d = parseLocalDate(item.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        monthExpensesByDay[d.getDate()].push(item);
      }
    });
    state.incomes.forEach(function (item) {
      var d = parseLocalDate(item.date);
      if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        monthIncomesByDay[d.getDate()].push(item);
      }
    });

    var cells = [];
    for (var blank = 0; blank < mondayOffset; blank++) {
      cells.push('<div class="calendar-day calendar-day-empty"></div>');
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var cls = 'calendar-day';
      if (selectedDay === day) cls += ' calendar-day-selected';

      var dayExpenseItems = monthExpensesByDay[day];
      var dayIncomeItems = monthIncomesByDay[day];
      var dayIncome = totalIncomes(dayIncomeItems);
      var dayExpense = totalExpenses(dayExpenseItems);
      var dayBalance = dayIncome - dayExpense;

      var dayBalanceHtml = '';
      if (dayExpenseItems.length + dayIncomeItems.length) {
        var balanceClass = dayBalance > 0
          ? 'calendar-day-balance-positive'
          : (dayBalance < 0 ? 'calendar-day-balance-negative' : 'calendar-day-balance-zero');

        /* Cifra compacta: en una celda de 45 px "-S/ 45.50" se cortaba en
           "-S/ 4…" y no se podía leer. El detalle exacto está debajo. */
        dayBalanceHtml =
          '<span class="calendar-day-balance ' + balanceClass + '" title="' + escapeHtml(formatSoles(Math.abs(dayBalance))) + '">' +
            (dayBalance > 0 ? '+' : (dayBalance < 0 ? '−' : '')) +
            importeCompacto(Math.abs(dayBalance)) +
          '</span>';
      }

      cells.push(
        '<button type="button" class="' + cls + '" data-calendar-day="' + day + '">' +
          '<span class="calendar-day-number">' + day + '</span>' +
          dayBalanceHtml +
        '</button>'
      );
    }

    var selectedExpenseItems = monthExpensesByDay[selectedDay] || [];
    var selectedIncomeItems = monthIncomesByDay[selectedDay] || [];
    var selectedItems = selectedExpenseItems.concat(selectedIncomeItems).sort(function (a, b) {
      return parseLocalDate(b.date) - parseLocalDate(a.date);
    });
    var selectedDate = new Date(year, month, selectedDay);
    var selectedLabel = selectedDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    selectedLabel = selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1);
    var selectedIncome = totalIncomes(selectedIncomeItems);
    var selectedExpense = totalExpenses(selectedExpenseItems);
    var selectedRows = selectedItems.length ? selectedItems.map(function (item) {
      var isIncome = state.incomes.indexOf(item) !== -1;
      return isIncome ? renderIncomeRow(item) : renderTxRow(item);
    }).join('') : '<div class="calendar-empty-day">No hay movimientos registrados este día.</div>';

    var monthPrefix = String(year) + "-" + String(month + 1).padStart(2, "0") + "-";
    var monthExpenseItems = state.expenses.filter(function (item) {
      var d = parseLocalDate(item.date);
      return !isNaN(d.getTime()) && calendarDateKey(d.getFullYear(), d.getMonth(), d.getDate()).indexOf(monthPrefix) === 0;
    });
    var monthIncomeItems = state.incomes.filter(function (item) {
      var d = parseLocalDate(item.date);
      return !isNaN(d.getTime()) && calendarDateKey(d.getFullYear(), d.getMonth(), d.getDate()).indexOf(monthPrefix) === 0;
    });
    var filteredExpenseItems = filterCalendarItemsByPayment(monthExpenseItems, state.calendarExpensePaymentFilter);
    var filteredIncomeItems = filterCalendarItemsByPayment(monthIncomeItems, state.calendarIncomePaymentFilter);

    if (state.calendarExpenseSubcategoryFilter && state.calendarExpenseSubcategoryFilter !== "todos") {
      filteredExpenseItems = filteredExpenseItems.filter(function (item) {
        return item.subcategory === state.calendarExpenseSubcategoryFilter;
      });
    }
    if (state.calendarIncomeSubcategoryFilter && state.calendarIncomeSubcategoryFilter !== "todos") {
      filteredIncomeItems = filteredIncomeItems.filter(function (item) {
        return item.subcategory === state.calendarIncomeSubcategoryFilter;
      });
    }

    var expenseChart = renderCategoryChart(
      spentByCategory(filteredExpenseItems),
      CATEGORIES,
      'Sin gastos con este método de pago este mes.'
    );
    var incomeChart = renderCategoryChart(
      incomeByCategory(filteredIncomeItems),
      INCOME_CATEGORIES,
      'Sin ingresos con este método de ingreso este mes.'
    );

    var expenseFilter = renderChartPaymentFilters(
      PAYMENT_METHODS,
      state.calendarExpensePaymentFilter,
      'calendar-expense-filter',
      'Filtrar por método de pago'
    );
    var incomeFilter = renderChartPaymentFilters(
      INCOME_PAYMENT_METHODS,
      state.calendarIncomePaymentFilter,
      'calendar-income-filter',
      'Filtrar por método de ingreso'
    );

    var expenseSubcatOptions = SUBCATEGORIES.filter(function (s) { return s.kind === "expense"; });
    var incomeSubcatOptions = SUBCATEGORIES.filter(function (s) { return s.kind === "income"; });

    var expenseSubcatFilter = expenseSubcatOptions.length
      ? renderPickerDropdown(
          'calendar-expense-subcategory-filter',
          'Filtrar por subcategoría',
          expenseSubcatOptions,
          state.calendarExpenseSubcategoryFilter,
          'Todas'
        )
      : '';
    var incomeSubcatFilter = incomeSubcatOptions.length
      ? renderPickerDropdown(
          'calendar-income-subcategory-filter',
          'Filtrar por subcategoría',
          incomeSubcatOptions,
          state.calendarIncomeSubcategoryFilter,
          'Todas'
        )
      : '';

    // Los totales del encabezado respetan los mismos filtros que los gráficos.
    var filteredExpenseTotal = totalExpenses(filteredExpenseItems);
    var filteredIncomeTotal = totalIncomes(filteredIncomeItems);
    var monthBalance = filteredIncomeTotal - filteredExpenseTotal;

    return (
      '<div class="calendar-page calendar-detail-page">' +
        '<div class="calendar-header">' +
          '<div><p class="calendar-kicker">Calendario · ' + year + '</p><h2 class="calendar-title">' + escapeHtml(monthNameFor(year, month)) + '</h2></div>' +
          '<button type="button" class="calendar-nav-btn" data-calendar-back-months>← Meses</button>' +
        '</div>' +
        '<p style="font-size:11.5px;color:var(--text-muted);margin:0;text-transform:uppercase;letter-spacing:0.4px">Saldo del mes</p>' +
        '<p class="disp" style="font-size:40px;font-weight:600;margin:4px 0 2px;color:' + (monthBalance < 0 ? 'var(--danger)' : 'var(--ink)') + '">' + (monthBalance < 0 ? '-' : '') + formatSoles(Math.abs(monthBalance)) + '</p>' +
        '<p style="font-size:13px;color:var(--text-muted);margin:0 0 16px">Ingresos ' + formatSoles(filteredIncomeTotal) + ' · Gastos ' + formatSoles(filteredExpenseTotal) + '</p>' +
        '<div class="calendar-card"><div class="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div><div class="calendar-grid">' + cells.join('') + '</div></div>' +
        '<section class="calendar-day-detail"><div class="calendar-detail-head"><div><p class="section-label">Día seleccionado</p><h3>' + escapeHtml(selectedLabel) + '</h3></div><strong class="amt calendar-detail-balance" style="color:' + (selectedIncome - selectedExpense < 0 ? 'var(--ink)' : 'var(--success)') + '">' + (selectedIncome - selectedExpense < 0 ? '-' : '+') + formatSoles(Math.abs(selectedIncome - selectedExpense)) + '</strong></div><div class="calendar-movements">' + selectedRows + '</div></section>' +
        '<div class="chart-card"><p class="section-label">Gastos por categoría</p>' + expenseFilter + expenseSubcatFilter + expenseChart + '</div>' +
        '<div class="chart-card"><p class="section-label">Ingresos por categoría</p>' + incomeFilter + incomeSubcatFilter + incomeChart + '</div>' +
      '</div>'
    );
  }

  if (state.calendarView === 'months') return renderMonthSelector();
  if (state.calendarView === 'month') return renderMonthDetail();
  return renderYearSelector();
}
/* =========================================================
   INGRESOS
========================================================= */
function renderIngresos() {
  var editingIncome = state.editingType === "income" && !!state.editingId;
  var monthTotal = totalIncomes(currentMonthIncomes());

  if (!state.incomeDraft) {
    state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
  }

  var d = state.incomeDraft;
  var amountValue = escapeHtml(d.amount || "");
  var noteValue = escapeHtml(d.note || "");



  var categoryButtons = INCOME_CATEGORIES.map(function (cat) {
    var selected = d.category === cat.id;

    return (
      '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
        ' data-income-category="' + cat.id + '" aria-pressed="' + selected + '">' +
        icon((cat && cat.icon) || 'income', 15, 'currentColor') +
        escapeHtml(cat.label) +
      '</button>'
    );
  }).join("");

  var incomeSubcats = d.category ? subcategoriesFor("income", d.category) : [];
  var incomeSubcategoryPicker = incomeSubcats.length
    ? '<p class="section-label js-section-top">Subcategoría</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px" id="income-subcategory-group">' +
      incomeSubcats.map(function (sub) {
        var selected = d.subcategory === sub.id;
        var iconData = subcategoryIconData(sub);
        return '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '" data-income-subcategory="' + escapeHtml(sub.id) + '" aria-pressed="' + selected + '">' +
          iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + escapeHtml(sub.label) + '</button>';
      }).join("") +
      '</div>'
    : "";

  var paymentButtons = visiblePaymentMethods(INCOME_PAYMENT_METHODS).map(function (pay) {
    var selected = d.paymentMethod === pay.id;

    return (
      '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
        ' data-income-payment="' + pay.id + '" aria-pressed="' + selected + '">' +
        marcaHtml(pay, 12, "marca-xs") +
        '<span>' +
          escapeHtml(pay.label) +
        '</span>' +
      '</button>'
    );
  }).join("");

  return '<div style="padding:20px 20px 12px">' +
    '<div style="' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:space-between;' +
      'margin-bottom:20px' +
    '">' +
      '<button class="icon-btn" id="cancel-income">' +
        icon("x", 20) +
      '</button>' +
      '<p style="' +
        'font-size:15px;' +
        'font-weight:600;' +
        'margin:0' +
      '">' +
        (editingIncome ? "Editar Ingreso" : "Nuevo Ingreso") +
      '</p>' +
      '<span style="width:28px"></span>' +
    '</div>' +

    '<div style="' +
      'text-align:center;' +
      'margin-bottom:20px' +
    '">' +
      '<p style="' +
        'font-size:13px;' +
        'color:var(--text-muted);' +
        'margin:0 0 4px' +
      '">' +
        "Monto" +
      '</p>' +
      '<div style="' +
        'display:flex;' +
        'align-items:baseline;' +
        'justify-content:center;' +
        'gap:4px' +
      '">' +
        '<span class="disp" style="' +
          'font-size:20px;' +
          'color:var(--text-muted)' +
        '">' +
          "S/" +
        '</span>' +
        '<input ' +
          'type="number" ' +
          'inputmode="decimal" ' +
          'placeholder="0.00" ' +
          'id="income-amount-input" ' +
          'class="disp" ' +
          'value="' + amountValue + '" ' +
          'style="' +
            'border:none;' +
            'background:none;' +
            'font-size:38px;' +
            'font-weight:600;' +
            'width:160px;' +
            'text-align:center;' +
            'color:var(--ink)' +
          '"' +
        '/>' +
      '</div>' +
      '<p class="error-text" id="income-error" style="display:none">' +
        "Ingresa un monto válido." +
      '</p>' +
    '</div>' +

    '<p class="section-label">' +
      "Categoría" +
    '</p>' +
    '<div style="' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:8px;' +
      'margin-bottom:6px' +
      '" id="income-category-group">' +
      categoryButtons +
    '</div>' +
    '<p class="error-text" id="income-category-error" style="display:none">' +
      "Elige una categoría." +
    '</p>' +

    incomeSubcategoryPicker +

    '<p class="section-label" class="js-section-top">' +
      "Fuente de ingreso" +
    '</p>' +
    '<div style="' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:8px;' +
      'margin-bottom:6px' +
      '" id="income-payment-group">' +
      paymentButtons +
    '</div>' +
    '<p class="error-text" id="income-payment-error" style="display:none">' +
      "Elige una fuente de ingreso." +
    '</p>' +

    '<input ' +
      'type="text" ' +
      'placeholder="Nota (opcional)" ' +
      'id="income-note-input" ' +
      'class="field-input" ' +
      'maxlength="80" ' +
      'value="' + noteValue + '" ' +
      'style="margin-top:14px;margin-bottom:18px"' +
    '/>' +

    '<button class="primary-btn" id="save-income-btn">' +
      (editingIncome ? "Guardar Cambios" : "Guardar Ingreso") +
    '</button>' +
  '</div>';
}
/* =========================================================
   PRESUPUESTOS
========================================================= */


function recurringOccurrencesBetween(recurring, fromDate, toDate, categoryId) {
  if (!recurring || !recurring.active) return 0;
  if (categoryId && recurring.category !== categoryId) return 0;

  var start = parseLocalDate(recurring.startDate || recurring.nextDate);
  if (isNaN(start.getTime())) return 0;

  var from = parseLocalDate(fromDate);
  var to = parseLocalDate(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;

  var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var count = 0;
  var guard = 0;

  while (cursor <= to && guard++ < 5000) {
    if (cursor >= from) count++;

    if (recurring.frequency === "weekly") {
      cursor.setDate(cursor.getDate() + 7);
    } else if (recurring.frequency === "yearly") {
      cursor.setFullYear(cursor.getFullYear() + 1);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return count;
}

function recurringProjectedAmount(categoryId, fromDate, toDate) {
  if (!Array.isArray(state.recurringExpenses)) return 0;
  return state.recurringExpenses.reduce(function (total, recurring) {
    return total + recurringOccurrencesBetween(recurring, fromDate, toDate, categoryId) * (Number(recurring.amount) || 0);
  }, 0);
}

function budgetForecast(categoryId, year, month) {
  var now = new Date();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var monthStart = new Date(year, month, 1);
  var monthEnd = new Date(year, month, daysInMonth);
  var isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  var elapsed = isCurrentMonth ? Math.max(1, Math.min(now.getDate(), daysInMonth)) : daysInMonth;
  var elapsedEnd = new Date(year, month, elapsed);

  var expenses = state.expenses.filter(function (item) {
    var d = parseLocalDate(item.date);
    return !isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month &&
      item.category === categoryId;
  });

  var spent = totalExpenses(expenses);
  var futureRecurring = isCurrentMonth
    ? recurringProjectedAmount(categoryId, new Date(year, month, elapsed + 1), monthEnd)
    : recurringProjectedAmount(categoryId, monthStart, monthEnd);

  var projected = isCurrentMonth
    ? spent + futureRecurring
    : spent + futureRecurring;

  return {
    spent: spent,
    recurring: futureRecurring,
    projected: projected,
    elapsed: elapsed,
    daysInMonth: daysInMonth
  };
}

function budgetMonthSummary(year, month) {
  year = year == null ? new Date().getFullYear() : year;
  month = month == null ? new Date().getMonth() : month;
  var expenses = state.expenses.filter(function (item) {
    var d = parseLocalDate(item.date);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  });
  var spent = totalExpenses(expenses);
  var totalBudget = Object.keys(state.budgets || {}).reduce(function (sum, id) {
    return sum + (Number(state.budgets[id]) || 0);
  }, 0);
  var now = new Date();
  var current = year === now.getFullYear() && month === now.getMonth();
  var isPast = new Date(year, month, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
  var days = new Date(year, month + 1, 0).getDate();
  var from = current ? new Date(year, month, Math.min(days, now.getDate() + 1)) : new Date(year, month, 1);
  var to = new Date(year, month, days);
  var committed = isPast ? 0 : recurringProjectedAmount(null, from, to);
  var projected = spent + committed;
  return {
    spent: spent,
    budget: totalBudget,
    committed: committed,
    projected: projected,
    available: totalBudget - projected,
    pct: totalBudget > 0 ? (projected / totalBudget) * 100 : 0
  };
}

/* Fila de presupuesto. La barra muestra lo gastado; el color avisa según la
   proyección al cierre, que ya suma los recurrentes por pagar. El detalle
   (comprometido, proyección, disponible) y la edición del límite se abren al
   tocarla: antes cada categoría llevaba siempre a la vista un campo, tres
   cifras, una barra y una frase, y había que pulsar "Guardar" al final. */
function budgetRowHtml(cat, year, month) {
  var limite = Number(state.budgets[cat.id] || 0);
  var forecast = budgetForecast(cat.id, year, month);
  var head = '<span class="budget-row-name">' + iconOrEmoji(cat.iconEmoji, cat.icon, 16, "currentColor") + escapeHtml(cat.label) + '</span>';

  if (!limite) {
    return '<div class="budget-row budget-row-none" role="button" tabindex="0" data-budget-edit="' + escapeHtml(cat.id) + '">' +
      '<div class="budget-row-line">' + head + '<span class="budget-row-define">Definir</span></div>' +
      '<p class="budget-row-detail">' + (forecast.spent ? 'Gastado ' + formatSoles(forecast.spent) + ' · sin límite' : 'Sin límite definido') + '</p>' +
    '</div>';
  }

  var pctGastado = (forecast.spent / limite) * 100;
  var pctProyectado = (forecast.projected / limite) * 100;
  var restante = limite - forecast.spent;
  return '<div class="budget-row" role="button" tabindex="0" data-budget-edit="' + escapeHtml(cat.id) + '">' +
    '<div class="budget-row-line">' + head +
      '<span class="budget-row-left' + (restante < 0 ? ' is-over' : '') + '">' + (restante < 0 ? 'Excedido ' + formatSoles(-restante) : 'Quedan ' + formatSoles(restante)) + '</span>' +
    '</div>' +
    '<div class="budget-track budget-track-' + nivelPresupuesto(pctProyectado) + '"><div style="width:' + Math.min(100, pctGastado).toFixed(1) + '%"></div></div>' +
    '<p class="budget-row-detail">' + formatSoles(forecast.spent) + ' de ' + formatSoles(limite) +
      (forecast.recurring ? ' · ' + formatSoles(forecast.recurring) + ' por pagar' : '') +
    '</p>' +
  '</div>';
}

function renderPresupuestos() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();

  /* El total sale de las categorías actuales: state.budgets puede guardar
     límites de categorías ya eliminadas. */
  var total = 0, gastado = 0, proyectado = 0;
  CATEGORIES.forEach(function (cat) {
    var limite = Number(state.budgets[cat.id] || 0);
    if (!limite) return;
    var forecast = budgetForecast(cat.id, year, month);
    total += limite;
    gastado += forecast.spent;
    proyectado += forecast.projected;
  });
  var pct = total ? (gastado / total) * 100 : 0;
  var restante = total - gastado;

  var resumen = total
    ? '<section class="home-card budget-overview">' +
        '<p class="analysis-label">' + escapeHtml(monthLabelFor(monthKey(now))) + '</p>' +
        '<div class="home-budget-total"><strong class="amt">' + formatSoles(gastado) + '</strong><span>de ' + formatSoles(total) + '</span></div>' +
        '<div class="budget-track budget-track-' + nivelPresupuesto(total ? (proyectado / total) * 100 : 0) + '"><div style="width:' + Math.min(100, pct).toFixed(1) + '%"></div></div>' +
        '<p class="home-budget-left' + (restante < 0 ? ' is-over' : '') + '">' +
          (restante < 0 ? 'Te pasaste por ' + formatSoles(-restante) : 'Te quedan ' + formatSoles(restante)) +
          (proyectado > gastado ? ' · Proyección al cierre ' + formatSoles(proyectado) : '') +
        '</p>' +
      '</section>'
    : '<section class="home-card"><p class="home-card-empty">Define un límite mensual por categoría. Toca cualquiera de la lista para empezar.</p></section>';

  return '<div class="analysis-page">' +
    '<p class="analysis-kicker">Presupuestos</p>' +
    '<h2 class="analysis-title budgets-title">Límites del mes</h2>' +
    resumen +
    '<div class="tx-list budget-list">' +
      CATEGORIES.map(function (cat) { return budgetRowHtml(cat, year, month); }).join("") +
    '</div>' +
    '<p class="accounts-hint">Toca una categoría para cambiar su límite o ver el detalle.</p>' +
  '</div>';
}

function budgetEditForm(cat) {
  var now = new Date();
  var limite = Number(state.budgets[cat.id] || 0);
  var forecast = budgetForecast(cat.id, now.getFullYear(), now.getMonth());
  var disponible = limite - forecast.projected;
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>' + escapeHtml(cat.label) + '</h3><button type="button" id="close-budget-edit" aria-label="Cerrar">×</button></div>' +
    '<label>Límite mensual<input id="budget-edit-value" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="' + (limite ? limite.toFixed(2) : '') + '"></label>' +
    '<dl class="budget-edit-detail">' +
      '<div><dt>Gastado este mes</dt><dd>' + formatSoles(forecast.spent) + '</dd></div>' +
      '<div><dt>Recurrentes por pagar</dt><dd>' + formatSoles(forecast.recurring) + '</dd></div>' +
      '<div><dt>Proyección al cierre</dt><dd>' + formatSoles(forecast.projected) + '</dd></div>' +
      (limite ? '<div><dt>' + (disponible >= 0 ? 'Disponible' : 'Exceso proyectado') + '</dt><dd class="' + (disponible < 0 ? 'danger-text' : '') + '">' + formatSoles(Math.abs(disponible)) + '</dd></div>' : '') +
    '</dl>' +
    '<button type="button" class="primary-btn" id="save-budget-edit">Guardar límite</button>' +
    (limite ? '<button type="button" class="secondary-btn modal-secondary-action" id="clear-budget-edit">Quitar límite</button>' : '') +
  '</div>';
}

/* =========================================================
   CONFIGURACIÓN
   Apariencia, personalización (categorías y métodos), cuenta y datos.
   Cada lista es plana y crece con su contenido: antes vivía dentro de un
   recuadro con scroll propio —un scroll dentro del scroll de la página— que
   cortaba la última fila, y cada elemento era una tarjeta dentro de otra.
========================================================= */

function renderConfiguracion() {
  function categoryGroupHtml(cat, kind) {
    var key = kind + "|" + cat.id;
    var subs = subcategoriesFor(kind, cat.id);
    var expanded = !!state.settingsExpandedCategories[key];

    var dragHandle = kind === "expense"
      ? '<div class="drag-handle" data-drag-handle="true" data-drag-type="category" data-drag-id="' + cat.id + '" title="Arrastrar para ordenar">' +
          icon("grip", 18) +
        '</div>'
      : "";

    var editAttr = kind === "income" ? "data-edit-income-category" : "data-edit-category";
    var deleteAttr = kind === "income" ? "data-delete-income-category" : "data-delete-category";

    var subCountLabel = subs.length
      ? subs.length + " subcategoría" + (subs.length === 1 ? "" : "s")
      : "Sin subcategorías";

    var subRows = subs.map(function (sub) {
      var menuId = "sub-" + kind + "-" + cat.id + "-" + sub.id;
      var iconData = subcategoryIconData(sub);
      return '<div class="settings-item settings-subitem">' +
          '<div class="settings-icon settings-subicon" aria-hidden="true">' + iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + '</div>' +
          '<div class="settings-info"><div class="settings-name">' + escapeHtml(sub.label) + '</div></div>' +
          itemMenuHtml(menuId, "data-edit-subcategory", escapeHtml(sub.id), "data-delete-subcategory", escapeHtml(sub.id)) +
        '</div>';
    }).join("");

    return '<div class="settings-category-group' + (expanded ? ' expanded' : '') + '"' +
        ' data-category-key="' + key + '"' +
        (kind === "expense" ? ' data-drag-type="category" data-drag-id="' + cat.id + '"' : '') +
      '>' +
        '<div class="settings-item settings-category-item">' +
          dragHandle +
          '<div class="settings-icon">' + iconOrEmoji(cat.iconEmoji, cat.icon || (kind === "income" ? "income" : "more"), 18, "currentColor") + '</div>' +
          '<div class="settings-info">' +
            '<div class="settings-name">' + escapeHtml(cat.label) + '</div>' +
            '<div class="settings-type">' + subCountLabel + '</div>' +
          '</div>' +
          '<button type="button" class="icon-btn settings-category-toggle" data-category-toggle="' + key + '" aria-expanded="' + (expanded ? "true" : "false") + '" aria-label="Ver subcategorías de ' + escapeHtml(cat.label) + '">' +
            icon("chevronDown", 18) +
          '</button>' +
          itemMenuHtml(kind + "-cat-" + cat.id, editAttr, cat.id, deleteAttr, cat.id) +
        '</div>' +
        '<div class="settings-subcategory-panel" data-subcategory-panel="' + key + '"' + (expanded ? "" : " hidden") + '>' +
          subRows +
          '<button type="button" class="settings-add-row settings-add-sub" data-add-subcategory-for="' + key + '">' + icon("plus", 16, "currentColor") + 'Añadir subcategoría</button>' +
        '</div>' +
      '</div>';
  }

  function paymentRowHtml(pay, draggable, editAttr, deleteAttr, menuPrefix) {
    return '<div class="settings-item"' + (draggable ? ' data-drag-type="payment" data-drag-id="' + pay.id + '"' : '') + '>' +
        (draggable
          ? '<div class="drag-handle" data-drag-handle="true" data-drag-type="payment" data-drag-id="' + pay.id + '" title="Arrastrar para ordenar">' + icon("grip", 18) + '</div>'
          : '') +
        paymentBadgeHtml(pay) +
        '<div class="settings-info"><div class="settings-name">' + escapeHtml(pay.label) + '</div></div>' +
        itemMenuHtml(menuPrefix + pay.id, editAttr, pay.id, deleteAttr, pay.id) +
      '</div>';
  }

  /* Sección plegable. El botón "Añadir" es la última fila de la misma lista:
     el arrastre para ordenar usa ese botón como tope del final. */
  function accordion(id, title, count, rows, addId, addLabel) {
    var isOpen = state.settingsOpenSection === id;
    return '<section class="settings-accordion' + (isOpen ? ' is-open' : '') + '">' +
        '<button type="button" class="settings-accordion-toggle" data-settings-section="' + id + '" aria-expanded="' + (isOpen ? "true" : "false") + '">' +
          '<span>' + title + '</span>' +
          '<span class="settings-accordion-count">' + count + '</span>' +
          '<span class="settings-accordion-chevron" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="settings-accordion-panel" data-settings-panel="' + id + '"' + (isOpen ? "" : " hidden") + '>' +
          rows +
          '<button type="button" class="settings-add-row" id="' + addId + '">' + icon("plus", 16, "currentColor") + addLabel + '</button>' +
        '</div>' +
      '</section>';
  }

  function linkRowHtml(attrs, iconName, title, detail) {
    return '<button type="button" class="settings-link" ' + attrs + '>' +
        '<span class="settings-link-icon">' + icon(iconName, 18, "currentColor") + '</span>' +
        '<span class="settings-link-body"><strong>' + title + '</strong><small>' + detail + '</small></span>' +
        icon("chevronRight", 18, "currentColor") +
      '</button>';
  }

  var user = window.GastosAuth && window.GastosAuth.getUser ? window.GastosAuth.getUser() : null;

  return '<div class="analysis-page settings-page">' +
      '<p class="analysis-kicker">Ajustes</p>' +
      '<h2 class="analysis-title settings-title">Configuración</h2>' +

      '<p class="section-label">Apariencia</p>' +
      temaSelectorHtml() +

      '<p class="section-label">Personalización</p>' +
      accordion("expense-categories", "Categorías de gastos", CATEGORIES.length,
        CATEGORIES.map(function (cat) { return categoryGroupHtml(cat, "expense"); }).join(""),
        "add-category-btn", "Añadir categoría") +
      accordion("payment-methods", "Métodos de pago", PAYMENT_METHODS.length,
        PAYMENT_METHODS.map(function (pay) { return paymentRowHtml(pay, true, "data-edit-payment", "data-delete-payment", "pay-"); }).join(""),
        "add-payment-btn", "Añadir método de pago") +
      accordion("income-categories", "Categorías de ingresos", INCOME_CATEGORIES.length,
        INCOME_CATEGORIES.map(function (cat) { return categoryGroupHtml(cat, "income"); }).join(""),
        "add-income-category-btn", "Añadir categoría de ingreso") +
      accordion("income-sources", "Fuentes de ingresos", INCOME_PAYMENT_METHODS.length,
        INCOME_PAYMENT_METHODS.map(function (pay) { return paymentRowHtml(pay, false, "data-edit-income-payment", "data-delete-income-payment", "income-pay-"); }).join(""),
        "add-income-payment-btn", "Añadir fuente de ingreso") +

      '<p class="section-label">Cuenta</p>' +
      '<div class="tx-list settings-links">' +
        linkRowHtml("data-account-open", "user",
          user ? escapeHtml(user.email || "Cuenta conectada") : "Cuenta y sincronización",
          user ? "Sincronizando con la nube" : "Guarda tus datos en la nube y úsalos en varios dispositivos") +
      '</div>' +

      '<p class="section-label">Datos y respaldo</p>' +
      '<div class="tx-list settings-links">' +
        linkRowHtml('id="export-data-btn"', "download", "Exportar copia", "Descarga un archivo con todos tus datos") +
        linkRowHtml('id="import-data-btn"', "upload", "Importar copia", "Reemplaza tus datos por los de un archivo") +
        '<div class="settings-backup">' +
          '<span class="settings-link-icon">' + icon("refresh", 18, "currentColor") + '</span>' +
          '<div class="settings-link-body">' +
            '<strong>Copias automáticas</strong>' +
            '<small>Nexo guarda hasta 5 copias en este dispositivo, una por día.</small>' +
            '<div class="settings-backup-controls">' +
              '<select id="local-backup-select" aria-label="Copia automática"></select>' +
              '<button type="button" class="secondary-btn" id="restore-local-backup-btn">Restaurar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<input type="file" id="import-data-file" accept=".json,application/json" hidden>' +

      '<button type="button" class="settings-danger-link" id="clear-movements-btn">Borrar todos los movimientos</button>' +
    '</div>';
}
/* =========================================================
   MODAL
========================================================= */

// Modal genérico para flujos que no usan el editor de categorías.
// Las pantallas de metas y gastos recurrentes lo utilizan para abrir
// formularios propios sin depender de state.modal.
function openModal(content) {
  closeModal();
  var root = document.createElement("div");
  root.id = "generic-modal-root";
  root.className = "modal-overlay";
  root.innerHTML = '<div class="modal generic-modal">' + content + '</div>';
  document.body.appendChild(root);
  root.addEventListener("click", function (event) {
    if (event.target === root) closeModal();
  });
}

function closeModal() {
  var root = document.getElementById("generic-modal-root");
  if (root) root.remove();
}

function renderModal() {

  var existing =
    document.getElementById(
      "modal-root"
    );

  if (existing) {

    existing.remove();

  }

  if (!state.modal) {

    return;

  }

  var type =
    state.modal.type;

  var isCategory = type === "category" || type === "incomeCategory";
  var isIncome = type === "incomeCategory" || type === "incomePayment";
  var isIncomeCategory = type === "incomeCategory";
  var isPayment = type === "payment" || type === "incomePayment";
  var isSubcategory = type === "subcategory";

  var editing =
    state.modal.editing;

  var title = isSubcategory
    ? (editing ? "Editar Subcategoría" : "Nueva Subcategoría")
    : editing ?
      (isIncomeCategory ? "Editar Categoría de Ingreso" : type === "incomePayment" ? "Editar Método de Ingreso" : isCategory ? "Editar Categoría" : "Editar Método de Pago") :
      (isIncomeCategory ? "Nueva Categoría de Ingreso" : type === "incomePayment" ? "Nuevo Método de Ingreso" : isCategory ? "Nueva Categoría" : "Nuevo Método de Pago");

  var current =
    editing
      ? (
          isSubcategory ? SUBCATEGORIES.find(function(s){ return s.id === state.modal.id; }) :
          isIncomeCategory ? INCOME_CATEGORIES.find(function(c){ return c.id === state.modal.id; }) :
          type === "incomePayment" ? INCOME_PAYMENT_METHODS.find(function(p){ return p.id === state.modal.id; }) :
          isCategory ? CATEGORIES.find(function(c){ return c.id === state.modal.id; }) :
          PAYMENT_METHODS.find(function(p){ return p.id === state.modal.id; })
        )
      : null;

  /* Selector de categoría principal (solo subcategorías): lista combinada
     de categorías de gasto e ingreso, con clave compuesta "kind|id". */
  var categoryOptions = isSubcategory
    ? CATEGORIES.map(function (c) {
        return { id: "expense|" + c.id, label: c.label + " · Gasto", icon: c.icon, color: c.color };
      }).concat(INCOME_CATEGORIES.map(function (c) {
        return { id: "income|" + c.id, label: c.label + " · Ingreso", icon: c.icon || "income", color: c.color };
      }))
    : [];

  var defaultCategoryKey = current ? (current.kind + "|" + current.categoryId) : (categoryOptions[0] ? categoryOptions[0].id : "");
  var selectedCategoryKey = state.modal.categoryKey || defaultCategoryKey;

  var categoryPicker = isSubcategory
    ? '<p class="modal-label">Categoría principal</p>' +
      renderPickerDropdown("modal-subcategory-category", "", categoryOptions, selectedCategoryKey, "Selecciona una categoría", false)
    : "";

  var selectedIcon =
    current
      ? current.icon
      : isIncomeCategory
        ? "income"
        : "more";

  var selectedColor =
    current
      ? current.color
      : AVAILABLE_COLORS[0].color;

  var iconPicker = "";

  if (isCategory) {

    iconPicker =
      '' +
      '<div class="icon-picker">'

      + AVAILABLE_ICONS.map(
        function (name) {

          return (

            '<button class="icon-option ' +
              (
                selectedIcon === name
                  ? "selected"
                  : ""
              ) +
              '" data-select-icon="' +
                name +
              '">' +

              icon(
                name,
                22
              ) +

            '</button>'

          );

        }
      ).join("")

      + '</div>';

  }

  var colorPicker =
    '<div class="color-picker">'

    + AVAILABLE_COLORS.map(
      function (item) {

        return (

          '<button class="color-option ' +
            (
              selectedColor ===
              item.color
                ? "selected"
                : ""
            ) +
            '" ' +
            'data-select-color="' +
              item.color +
            '" ' +
            'data-select-soft="' +
              item.soft +
            '" ' +
            'style="background:' +
              item.color +
            '">' +

          '</button>'

        );

      }
    ).join("")

    + '</div>';

  var presetPicker = "";

  if (isPayment && !editing) {

    presetPicker =

      '<p class="modal-label">' +
        "Sugerencias · bancos y billeteras del Perú" +
      '</p>' +

      '<div class="icon-picker" id="modal-bank-presets" style="' +
        'grid-template-columns:repeat(3,1fr);' +
        'margin-bottom:16px' +
      '">' +

      PERU_FINANCE_PRESETS.map(function (p) {

        return (

          '<button type="button" class="icon-option"' +
            ' data-preset-label="' + escapeHtml(p.label) + '"' +
            ' data-preset-color="' + p.color + '"' +
            ' data-preset-icon="' + escapeHtml(p.icon || "") + '"' +
            ' style="' +
              'height:auto;' +
              'padding:8px 4px;' +
              'flex-direction:column;' +
              'gap:4px;' +
              'font-size:10px;' +
              'font-weight:500;' +
              'line-height:1.15;' +
              'text-align:center' +
            '">' +

            marcaHtml(p, 13, "marca-sm") +

            '<span>' + escapeHtml(p.label) + '</span>' +

          '</button>'

        );

      }).join("") +

      '</div>' +

      '<input type="hidden" id="modal-preset-icon" value="" />';

  }

  var root =
    document.createElement(
      "div"
    );

  root.id =
    "modal-root";

  root.className =
    "modal-overlay";

  root.innerHTML =

    '<div class="modal">' +

      '<p class="modal-title">' +
        title +
      '</p>' +

      categoryPicker +

      presetPicker +

      '<p class="modal-label">' +
        "Nombre" +
      '</p>' +

      '<input ' +
        'id="modal-name" ' +
        'class="field-input" ' +
        'type="text" ' +
        'maxlength="30" ' +
        'placeholder="' +
          (
            isSubcategory
              ? "Ej. Supermercado"
              : isIncomeCategory
                ? "Ej. Freelance"
                : type === "incomePayment"
                  ? "Ej. Plin"
                  : isCategory
                    ? "Ej. Mascotas"
                    : "Ej. Tarjeta de crédito"
          ) +
        '" ' +
        'value="' +
          escapeHtml(
            current
              ? current.label
              : ""
          ) +
        '"' +
      '/>' +

      (
        isCategory

          ? (
              '<p class="modal-label">' +
                "Icono" +
              '</p>' +

              '<div id="modal-icons">' +
                iconPicker +
              '</div>'
            )

          : ""
      ) +

      /* El color solo se pide para métodos de pago, donde tiñe su insignia.
         Las categorías se muestran en un único tono neutro y elegirles un
         color era un paso sin efecto visible. */
      (
        !isPayment
          ? ""
          : (
              '<p class="modal-label">' +
                "Color" +
              '</p>' +

              '<div id="modal-colors">' +
                colorPicker +
              '</div>'
            )
      ) +

      '<div class="modal-buttons">' +

        '<button class="secondary-btn"' +
          ' id="modal-cancel">' +

          "Cancelar" +

        '</button>' +

        '<button class="primary-btn"' +
          ' id="modal-save">' +

          "Guardar" +

        '</button>' +

      '</div>' +

    '</div>';

  document.body.appendChild(root);

  attachModalHandlers();

}

/* =========================================================
   EVENTOS DEL MODAL
========================================================= */

function saveCurrentModal() {
  var modal = state.modal || {};
  if (!modal.type) return;

        var name =
          document
            .getElementById(
              "modal-name"
            )
            .value
            .trim();

        if (!name) {

          avisar(
            "Ingresa un nombre."
          );

          return;

        }

        var selectedColor =
          document.querySelector(
            ".color-option.selected"
          );

        var color =
          selectedColor
            ? selectedColor.getAttribute(
                "data-select-color"
              )
            : AVAILABLE_COLORS[0].color;

        var soft =
          selectedColor
            ? selectedColor.getAttribute(
                "data-select-soft"
              )
            : AVAILABLE_COLORS[0].soft;

        if (modal.type === "subcategory") {

          var catKey =
            state.modal.categoryKey ||
            (CATEGORIES[0] ? "expense|" + CATEGORIES[0].id : null);

          if (!catKey) {
            avisar("Crea primero una categoría.");
            return;
          }

          var keyParts = catKey.split("|");
          var subKind = keyParts[0];
          var subCategoryId = keyParts[1];

          if (modal.editing) {
            var sub = SUBCATEGORIES.find(function (s) { return s.id === modal.id; });
            if (sub) {
              sub.label = capitalizeName(name);
              sub.kind = subKind;
              sub.categoryId = subCategoryId;
            }
          } else {
            SUBCATEGORIES.push({
              id: slugify(name) + "-" + Date.now(),
              label: capitalizeName(name),
              kind: subKind,
              categoryId: subCategoryId,
            });
          }

        } else if (modal.type === "incomeCategory") {
          var selectedIncomeIcon = document.querySelector(".icon-option.selected");
          var incomeIconName =
            selectedIncomeIcon
              ? selectedIncomeIcon.getAttribute("data-select-icon")
              : "income";
          var incomeCat = modal.editing ? INCOME_CATEGORIES.find(function(c){ return c.id === modal.id; }) : null;
          if (incomeCat) { incomeCat.label = capitalizeName(name); incomeCat.icon = incomeIconName; }
          else INCOME_CATEGORIES.push({ id: slugify(name) + "-" + Date.now(), label: capitalizeName(name), icon: incomeIconName, color: color, soft: soft });
        } else if (modal.type === "incomePayment") {
          var incomePay = modal.editing ? INCOME_PAYMENT_METHODS.find(function(p){ return p.id === modal.id; }) : null;
          if (incomePay) {
            incomePay.label = capitalizeName(name);
            incomePay.color = color;
            restoreFixedFinanceLogo(incomePay);
          } else {
            var incomePresetIcon = document.getElementById("modal-preset-icon");
            var newIncomePay = { id: slugify(name) + "-" + Date.now(), label: capitalizeName(name), color: color, icon: incomePresetIcon ? incomePresetIcon.value : "" };
            INCOME_PAYMENT_METHODS.push(newIncomePay);
          }
        } else if (modal.type === "category") {

          var selectedIcon =
            document.querySelector(
              ".icon-option.selected"
            );

          var iconName =
            selectedIcon
              ? selectedIcon.getAttribute(
                  "data-select-icon"
                )
              : "more";

          if (modal.editing) {

            var cat =
              CATEGORIES.find(
                function (c) {
                  return c.id ===
                    modal.id;
                }
              );

            if (cat) {

              cat.label = capitalizeName(name);
              cat.icon = iconName;

            }

          } else {

            var id =
              slugify(name) +
              "-" +
              Date.now();

            CATEGORIES.push({

              id: id,

              label:
                capitalizeName(name),

              color: color,

              soft: soft,

              icon: iconName

            });

            state.budgets[id] = 0;

          }

        } else {

          if (modal.editing) {

            var pay =
              PAYMENT_METHODS.find(
                function (p) {
                  return p.id ===
                    modal.id;
                }
              );

            if (pay) {

              pay.label =
                capitalizeName(name);

              pay.color =
                color;

              restoreFixedFinanceLogo(pay);

            }

          } else {

            var paymentId =
              slugify(name) +
              "-" +
              Date.now();

            var presetIconValue =
              document.getElementById("modal-preset-icon");

            var newPay = {

              id: paymentId,

              label:
                capitalizeName(name),

              color: color,

              icon: presetIconValue ? presetIconValue.value : ""

            };

            PAYMENT_METHODS.push(newPay);

          }

        }

        saveSettings();

        persist();

        state.modal = null;

        render();


}

function attachModalHandlers() {

  if (!document.documentElement.dataset.nexoModalDelegatedV2) {
    document.documentElement.dataset.nexoModalDelegatedV2 = "1";
    document.addEventListener("click", function (event) {
      var cancel = event.target.closest ? event.target.closest("#modal-cancel") : null;
      if (cancel) {
        event.preventDefault();
        state.modal = null;
        render();
        return;
      }
      var save = event.target.closest ? event.target.closest("#modal-save") : null;
      if (save) {
        event.preventDefault();
        saveCurrentModal();
      }
    });
  }

  var modal = state.modal || {};
  var isSubcategory = modal.type === "subcategory";
  var isIncomeCategory = modal.type === "incomeCategory";
  var isCategory = modal.type === "category" || isIncomeCategory;
  var editing = !!modal.editing;

  /* Modal buttons are handled through a single delegated listener installed below. */

  document
    .querySelectorAll(
      "[data-select-icon]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            document
              .querySelectorAll(
                "[data-select-icon]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            btn.classList.add(
              "selected"
            );
            if (state.modal && (state.modal.type === "subcategory" || state.modal.type === "category")) {
              state.modal.iconManuallySelected = true;
            }

          }
        );

      }
    );

  document
    .querySelectorAll(
      "[data-select-color]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            document
              .querySelectorAll(
                "[data-select-color]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            btn.classList.add(
              "selected"
            );

          }
        );

      }
    );

  document
    .querySelectorAll(
      "[data-preset-label]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            var nameInput =
              document.getElementById(
                "modal-name"
              );

            if (nameInput) {

              nameInput.value =
                btn.getAttribute(
                  "data-preset-label"
                );

            }

            var presetIconInput =
              document.getElementById(
                "modal-preset-icon"
              );

            if (presetIconInput) {

              presetIconInput.value =
                btn.getAttribute(
                  "data-preset-icon"
                ) || "";

            }

            var color =
              btn.getAttribute(
                "data-preset-color"
              );

            var soft =
              lightenColor(color, 0.85);

            var picker =
              document.querySelector(
                "#modal-colors .color-picker"
              );

            if (!picker) {
              return;
            }

            var swatch =
              picker.querySelector(
                '[data-select-color="' +
                color +
                '"]'
              );

            if (!swatch) {

              swatch =
                document.createElement(
                  "button"
                );

              swatch.className =
                "color-option";

              swatch.setAttribute(
                "data-select-color",
                color
              );

              swatch.setAttribute(
                "data-select-soft",
                soft
              );

              swatch.style.background =
                color;

              swatch.addEventListener(
                "click",
                function () {

                  document
                    .querySelectorAll(
                      "[data-select-color]"
                    )
                    .forEach(
                      function (b) {
                        b.classList.remove(
                          "selected"
                        );
                      }
                    );

                  swatch.classList.add(
                    "selected"
                  );

                }
              );

              picker.insertBefore(
                swatch,
                picker.firstChild
              );

            }

            document
              .querySelectorAll(
                "[data-select-color]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            swatch.classList.add(
              "selected"
            );

          }
        );

      }
    );

  attachChartFilterToggleHandlers();

  document.querySelectorAll("[data-modal-subcategory-category]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.modal.categoryKey = btn.getAttribute("data-modal-subcategory-category");
      renderModal();
    });
  });

}

/* =========================================================
   MAYÚSCULA INICIAL
========================================================= */

/* Solo pone en mayúscula la inicial. Antes pasaba el resto a minúsculas y
   las siglas se estropeaban al editar: "BCP" quedaba "Bcp", "BBVA" "Bbva". */
function capitalizeName(text) {
  text = String(text).trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* =========================
   ARRASTRE: MOUSE · TOUCH · PEN
========================= */

function dragArray(type) {
  return type === "category" ? CATEGORIES :
         type === "payment" ? PAYMENT_METHODS : null;
}

function dragItemSelector(type) {
  return type === "category"
    ? '.settings-category-group[data-drag-type="category"]'
    : '.settings-item[data-drag-type="' + type + '"]';
}

function dragItems(type) {
  return Array.from(document.querySelectorAll(
    dragItemSelector(type)
  ));
}

function dragEndButton(type) {
  return document.getElementById(
    type === "category" ? "add-category-btn" : "add-payment-btn"
  );
}

function resetDragState() {
  Object.assign(dragState, {
    active:false, type:null, id:null, element:null, placeholder:null,
    otherItems:null,
    pointerId:null, pointerType:null, handle:null,
    startX:0, startY:0, currentX:0, currentY:0,
    grabOffsetX:0, grabOffsetY:0, originalRect:null,
    originalParent:null, originalNextSibling:null, startIndex:-1
  });
}

function movePlaceholder(y) {
  var p = dragState.placeholder;
  if (!p) return;

  var before = dragState.otherItems.find(function (el) {
      var r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });

  var end = dragEndButton(dragState.type);

  if (before) {
    if (p.nextElementSibling !== before) before.parentNode.insertBefore(p, before);
  } else if (end && end.previousElementSibling !== p) {
    end.parentNode.insertBefore(p, end);
  }
}

function startDrag(e) {
  if (dragState.active || state.screen !== "configuracion") return;
  if (e.pointerType === "mouse" && e.button !== 0) return;

  var handle = e.currentTarget;

  /* Reordenar solo puede comenzar desde el asa. */
  if (!handle || handle.dataset.dragHandle !== "true") return;

  var dragType = handle.dataset.dragType;

  var item = dragType === "category"
    ? handle.closest(".settings-category-group")
    : handle.closest(".settings-item");
  if (!item) return;

  e.preventDefault();

  var r = item.getBoundingClientRect();
  var type = item.dataset.dragType;
  var id = item.dataset.dragId;
  var arr = dragArray(type);

  var p = document.createElement("div");
  p.className = "settings-item drag-placeholder";
  p.style.height = r.height + "px";
  p.style.marginBottom = getComputedStyle(item).marginBottom;
  p.setAttribute("aria-hidden", "true");
  item.parentNode.insertBefore(p, item);

  Object.assign(dragState, {
    active:true, type:type, id:id, element:item, placeholder:p,
    otherItems:dragItems(type).filter(function (x) { return x !== item; }),
    pointerId:e.pointerId, pointerType:e.pointerType, handle:handle,
    startX:e.clientX, startY:e.clientY,
    currentX:e.clientX, currentY:e.clientY,
    grabOffsetX:e.clientX-r.left, grabOffsetY:e.clientY-r.top,
    originalRect:r, originalParent:item.parentNode,
    originalNextSibling:item.nextSibling,
    startIndex:arr ? arr.findIndex(function (x) { return x.id === id; }) : -1
  });

  Object.assign(item.style, {
    position:"fixed", left:r.left+"px", top:r.top+"px",
    width:r.width+"px", height:r.height+"px", margin:"0"
  });

  item.classList.add("dragging");
  handle.classList.add("dragging-handle");
  document.body.classList.add("dragging-settings");

  if (navigator.vibrate && e.pointerType !== "mouse") navigator.vibrate(25);
}

function moveDrag(e) {
  if (!dragState.active || e.pointerId !== dragState.pointerId) return;
  e.preventDefault();

  var x = e.clientX - dragState.grabOffsetX;
  var y = e.clientY - dragState.grabOffsetY;

  dragState.currentX = e.clientX;
  dragState.currentY = e.clientY;

  dragState.element.style.setProperty("--drag-x", x - dragState.originalRect.left + "px");
  dragState.element.style.setProperty("--drag-y", y - dragState.originalRect.top + "px");
  movePlaceholder(e.clientY);
}

function syncDragArray(type) {
  var arr = dragArray(type);
  if (!arr) return;

  var ids = dragItems(type).map(function (el) { return el.dataset.dragId; });
  var ordered = ids.map(function (id) {
    return arr.find(function (x) { return x.id === id; });
  }).filter(Boolean);

  if (ordered.length === arr.length) {
    arr.splice.apply(arr, [0, arr.length].concat(ordered));
  }
}

function finishDrag(cancel) {
  if (!dragState.active) return;

  var el = dragState.element;
  var p = dragState.placeholder;
  var type = dragState.type;
  var pointerType = dragState.pointerType;

  if (cancel) {
    var items = dragItems(type).filter(function (x) { return x !== el; });
    var target = items[dragState.startIndex] || dragEndButton(type);
    if (target && target.parentNode) target.parentNode.insertBefore(el, target);
    else if (dragState.originalParent) dragState.originalParent.appendChild(el);
  } else if (p && p.parentNode) {
    p.parentNode.insertBefore(el, p);
  }

  el.classList.remove("dragging");
  if (dragState.handle) dragState.handle.classList.remove("dragging-handle");
  document.body.classList.remove("dragging-settings");

  Object.assign(el.style, {
    position:"", left:"", top:"", width:"", height:"", margin:""
  });
  el.style.setProperty("--drag-x", "0px");
  el.style.setProperty("--drag-y", "0px");

  if (p) p.remove();

  if (!cancel) {
    syncDragArray(type);
    /* persist() además de saveSettings(): las listas también viajan dentro
       de los datos principales, que son los que se leen al arrancar. Solo
       con saveSettings() el nuevo orden se perdía al recargar. */
    saveSettings();
    persist();
    if (navigator.vibrate && pointerType !== "mouse") navigator.vibrate(15);
  }

  resetDragState();
}

function attachDragHandlers() {
  if (state.screen !== "configuracion") return;

  document.querySelectorAll("[data-drag-handle='true']").forEach(function (handle) {
    handle.addEventListener("pointerdown", startDrag, { passive:false });
    handle.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
}

document.addEventListener("pointermove", function (e) {
  if (dragState.active) moveDrag(e);
}, { passive:false });

document.addEventListener("pointerup", function (e) {
  if (dragState.active && e.pointerId === dragState.pointerId) {
    e.preventDefault();
    finishDrag(false);
  }
}, { passive:false });

document.addEventListener("pointercancel", function (e) {
  if (dragState.active && e.pointerId === dragState.pointerId) {
    e.preventDefault();
    finishDrag(true);
  }
}, { passive:false });

window.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && dragState.active) finishDrag(true);
});

/* =========================================================
   EVENTOS DE PANTALLA
========================================================= */

/* Abre/cierra cualquier desplegable .chart-filter (reutilizado por
   pantallas y por el modal). El cierre al hacer clic afuera ya está
   cubierto por el listener global de document. */
function attachChartFilterToggleHandlers() {
  document.querySelectorAll("[data-chart-filter-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var wrap = btn.closest(".chart-filter");
      if (!wrap) return;
      var wasOpen = wrap.classList.contains("open");
      document.querySelectorAll(".chart-filter.open").forEach(function (el) {
        el.classList.remove("open");
        var toggle = el.querySelector("[data-chart-filter-toggle]");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        wrap.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}



function recurringNextDate(dateValue, frequency) {
  var date = parseLocalDate(dateValue);
  if (isNaN(date.getTime())) date = new Date();
  var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return localDateKey(next);
}

function createPendingFromRecurring(recurring, dueDate) {
  var exists = (state.pendingPayments || []).some(function (item) {
    return item.recurringId === recurring.id && (item.occurrenceDate || item.dueDate) === dueDate;
  });
  var alreadyPaid = state.expenses.some(function (expense) {
    return expense.recurringId === recurring.id && (expense.occurrenceDate || expense.date) === dueDate;
  });
  if (exists || alreadyPaid) return false;
  state.pendingPayments.push({
    id: makeId("pending-rec"),
    name: recurring.name,
    amount: Number(recurring.amount) || 0,
    dueDate: dueDate,
    category: recurring.category,
    subcategory: recurring.subcategory || "",
    paymentMethod: recurring.paymentMethod,
    note: recurring.note || "",
    recurringId: recurring.id,
    occurrenceDate: dueDate,
    createdAt: Date.now()
  });
  return true;
}

function generateRecurringExpenses() {
  var todayKey = localDateKey(new Date());
  var changed = false;

  state.recurringExpenses.forEach(function (recurring) {
    if (!recurring.active) return;
    var cursorKey = recurring.nextDate || recurring.startDate;
    if (!cursorKey) return;
    var guard = 0;
    var processedDue = false;

    while (cursorKey <= todayKey && guard++ < 120) {
      if (createPendingFromRecurring(recurring, cursorKey)) changed = true;
      processedDue = true;
      cursorKey = recurringNextDate(cursorKey, recurring.frequency);
      recurring.nextDate = cursorKey;
      changed = true;
    }

    // Si la siguiente fecha aún es futura, dejamos un único compromiso visible.
    if (!processedDue && cursorKey > todayKey) {
      if (createPendingFromRecurring(recurring, cursorKey)) changed = true;
    }
  });

  if (changed) persist();
  return changed;
}


/* Misma estructura que pendientes y deudas: tocar la meta la edita (con
   "Eliminar" dentro) y a la vista queda solo "Añadir ahorro". */
function goalRowHtml(goal) {
  var saved = Number(goal.saved) || 0;
  var target = Number(goal.target) || 0;
  var pct = target ? Math.min(100, (saved / target) * 100) : 0;
  var plan = savingsGoalPlan(goal);
  var completada = plan.status === 'Completada';
  var planText = completada
    ? 'Meta alcanzada'
    : (plan.monthly ? 'Ahorra ' + formatSoles(plan.monthly) + ' al mes para llegar a tiempo' : Math.round(pct) + '% del objetivo');
  return '<div class="goal-row" role="button" tabindex="0" data-goal-edit="' + escapeHtml(goal.id) + '">' +
    '<div class="goal-top"><strong>' + escapeHtml(goal.name) + '</strong><span>' + formatSoles(saved) + '<small> de ' + formatSoles(target) + '</small></span></div>' +
    '<div class="budget-track"><div style="width:' + pct.toFixed(1) + '%"></div></div>' +
    '<div class="goal-foot">' +
      '<span class="goal-plan' + (plan.status === 'Atrasada' ? ' danger-text' : '') + '">' + escapeHtml(planText) + '</span>' +
      (completada ? '' : '<button type="button" class="secondary-btn goal-add-btn" data-goal-add="' + escapeHtml(goal.id) + '">Añadir ahorro</button>') +
    '</div>' +
  '</div>';
}

function renderSavingsGoals() {
  if (!Array.isArray(state.savingsGoals)) state.savingsGoals = [];
  var goals = state.savingsGoals;
  var ahorrado = goals.reduce(function (s, g) { return s + (Number(g.saved) || 0); }, 0);
  var objetivo = goals.reduce(function (s, g) { return s + (Number(g.target) || 0); }, 0);

  return '<div class="analysis-page">' +
    '<p class="analysis-kicker">Metas de ahorro</p>' +
    '<h2 class="accounts-total">' + formatSoles(ahorrado) + '</h2>' +
    '<p class="accounts-total-detail">' + (goals.length ? 'Ahorrado de ' + formatSoles(objetivo) + ' en ' + goals.length + ' meta' + (goals.length === 1 ? '' : 's') : 'Aún no tienes metas') + '</p>' +
    '<div class="accounts-actions accounts-actions-single"><button type="button" class="primary-btn" id="add-goal-btn">Nueva meta</button></div>' +
    (goals.length
      ? '<div class="tx-list goal-list">' + goals.map(goalRowHtml).join("") + '</div>' +
        '<p class="accounts-hint">Toca una meta para editarla o eliminarla.</p>'
      : '<section class="home-card"><p class="home-card-empty">Ponle nombre y cifra a un objetivo —un viaje, un fondo de emergencia— y Nexo te dirá cuánto apartar cada mes para llegar a tiempo.</p></section>') +
  '</div>';
}

function goalContributionForm(goal) {
  var restante = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Añadir ahorro</h3><button type="button" id="close-goal-add" aria-label="Cerrar">×</button></div>' +
    '<p class="modal-hint">' + escapeHtml(goal.name) + ' · faltan ' + formatSoles(restante) + '</p>' +
    '<label>Monto<input id="goal-add-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></label>' +
    '<button type="button" class="primary-btn" id="save-goal-add">Añadir</button>' +
  '</div>';
}

function savingsGoalForm() {
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Nueva meta</h3><button type="button" id="close-goal">×</button></div>' +
    '<label>Nombre<input id="goal-name" type="text" placeholder="Viaje, fondo de emergencia..."></label>' +
    '<label>Objetivo<input id="goal-target" type="number" min="1" step="0.01" placeholder="5000"></label>' +
    '<label>Ahorrado inicialmente<input id="goal-saved" type="number" min="0" step="0.01" value="0"></label>' +
    '<label>Fecha objetivo<input id="goal-date" type="date"></label>' +
    '<button type="button" class="primary-btn" id="save-goal">Guardar</button>' +
    '</div>';
}

function renderRecurringExpenses() {
  if (!Array.isArray(state.recurringExpenses)) state.recurringExpenses = [];
  var activeRecurring = state.recurringExpenses.filter(function (item) { return item.active; });
  var monthlyEquivalent = activeRecurring.reduce(function (total, item) {
    var amount = Number(item.amount) || 0;
    if (item.frequency === "weekly") return total + amount * 52 / 12;
    if (item.frequency === "yearly") return total + amount / 12;
    return total + amount;
  }, 0);
  var currentMonth = new Date();
  var monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  var upcoming = recurringProjectedAmount(null, new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 1), monthEnd);
  var rows = state.recurringExpenses.length ? state.recurringExpenses.map(function (item) {
    var cat = categoryIndex[item.category] || {};
    var pay = paymentIndex[item.paymentMethod] || {};
    var frequency = item.frequency === "weekly" ? "Cada semana" :
      item.frequency === "yearly" ? "Cada año" : "Cada mes";

    return '<div class="recurring-row">' +
      '<div class="recurring-main">' +
        '<div class="recurring-icon">' + (cat.icon || "↻") + '</div>' +
        '<div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(frequency + " · Próximo " + (item.nextDate || item.startDate || "") + " · " + (cat.label || "") + " · " + (pay.label || "")) + '</small></div>' +
      '</div>' +
      '<div class="recurring-amount">' + formatSoles(Number(item.amount) || 0) + '</div>' +
      '<button type="button" class="icon-btn" data-recurring-edit="' + escapeHtml(item.id) + '" title="Editar gasto recurrente">' + icon("edit",16) + '</button>' +
      '<button type="button" class="icon-btn" data-recurring-toggle="' + escapeHtml(item.id) + '" title="' + (item.active ? 'Pausar' : 'Activar') + '">' + (item.active ? 'Ⅱ' : '▶') + '</button>' +
      '<button type="button" class="icon-btn" data-recurring-delete="' + escapeHtml(item.id) + '" title="Eliminar gasto recurrente">' + icon("x",16) + '</button>' +
    '</div>';
  }).join("") : '<p class="data-tools-copy">No tienes gastos recurrentes todavía.</p>';

  return '<div class="analysis-page">' +
    '<div class="analysis-head"><div><p class="analysis-kicker">Automatización</p><h2 class="analysis-title">Gastos recurrentes</h2></div>' +
    '<button type="button" class="primary-btn" id="add-recurring-btn">+ Nuevo</button></div>' +
    '<p class="data-tools-copy">Cada vencimiento se crea primero como pago pendiente. Solo afecta tus gastos y el saldo cuando lo marcas como pagado.</p>' +
    '<section class="analysis-card">' + rows + '</section>' +
    '</div>';
}



function subcategoriesOptions(categoryId, selectedId) {
  return SUBCATEGORIES
    .filter(function (s) { return (s.categoryId || s.category || s.parentCategory) === categoryId; })
    .map(function (s) {
      return '<option value="' + escapeHtml(s.id) + '"' +
        (s.id === selectedId ? ' selected' : '') + '>' +
        escapeHtml(s.label) + '</option>';
    }).join("");
}

function recurringForm(item) {
  item = item || {};
  var cats = CATEGORIES.map(function (c) {
    return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.label) + '</option>';
  }).join("");
  var recurringMethods = visiblePaymentMethods(PAYMENT_METHODS).slice();
  if (item.paymentMethod && !recurringMethods.some(function (p) { return p.id === item.paymentMethod; })) {
    var hiddenRecurringMethod = PAYMENT_METHODS.find(function (p) { return p.id === item.paymentMethod; });
    if (hiddenRecurringMethod) recurringMethods.push(hiddenRecurringMethod);
  }
  var pays = recurringMethods.map(function (p) {
    return '<option value="' + escapeHtml(p.id) + '"' + (p.id === item.paymentMethod ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
  }).join("");

  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Nuevo gasto recurrente</h3><button type="button" id="close-recurring">×</button></div>' +
    '<label>Nombre<input id="rec-name" type="text" placeholder="Netflix, alquiler, internet..."></label>' +
    '<label>Monto<input id="rec-amount" type="number" step="0.01" min="0" placeholder="0.00"></label>' +
    '<label>Frecuencia<select id="rec-frequency"><option value="monthly">Cada mes</option><option value="weekly">Cada semana</option><option value="yearly">Cada año</option></select></label>' +
    '<label>Primera fecha<input id="rec-start" type="date" value="' + localDateKey(new Date()) + '"></label>' +
    '<label>Categoría<select id="rec-category">' + cats + '</select></label>' +
    '<label>Subcategoría<select id="rec-subcategory">' + subcategoriesOptions(CATEGORIES[0] ? CATEGORIES[0].id : "") + '</select></label>' +
    '<label>Método de pago<select id="rec-payment">' + pays + '</select></label>' +
    '<label>Nota<input id="rec-note" type="text" placeholder="Opcional"></label>' +
    '<button type="button" class="primary-btn" id="save-recurring">Guardar</button>' +
    '</div>';
}


/* Antes enviaba a una pantalla "dashboard" que ya no existe y llamaba a
   showToast con un mensaje que esa función ignora, así que no se confirmaba
   nada. Ahora se queda en Configuración y avisa del resultado. */
function clearAllMovements() {
  var total = state.expenses.length + state.incomes.length;
  if (!total) {
    mostrarAviso("No hay movimientos para borrar.");
    return;
  }
  confirmar({
    titulo: "¿Borrar los " + total + " movimientos?",
    mensaje: "Se eliminan todos los gastos e ingresos. Presupuestos, metas, deudas y recurrentes se conservan. Antes de borrar se guarda una copia que puedes restaurar.",
    aceptar: "Borrar todo",
    peligro: true
  }).then(function (ok) {
    if (!ok) return;
    var copiaHecha = crearCopiaLocal(buildPayload());
    state.expenses = [];
    state.incomes = [];
    persist();
    preserveScroll(render);
    mostrarAviso("Se borraron " + total + " movimientos." + (copiaHecha ? " Puedes recuperarlos restaurando la copia más reciente." : ""));
  });
}

/* Copia en archivo. Usa el mismo paquete que el guardado local
   (buildPayload/applyPayload): antes exportar e importar llevaban su propia
   lista de campos, y cualquier campo nuevo había que recordarlo en cuatro
   sitios. El formato del archivo (data + settings) se mantiene para que las
   copias antiguas sigan importándose. */
function exportAppData() {
  var paquete = buildPayload();
  var settings = paquete.settings;
  delete paquete.settings;
  delete paquete.version;
  var archivo = {
    format: "gastos-backup",
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: paquete,
    settings: settings
  };

  var blob = new Blob([JSON.stringify(archivo, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "nexo-copia-" + localDateKey(new Date()) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  mostrarAviso("Copia descargada.");
}

function importAppData(file) {
  var reader = new FileReader();

  reader.onload = function () {
    var archivo;
    try {
      archivo = JSON.parse(reader.result);
      if (!archivo || archivo.format !== "gastos-backup" || !archivo.data || !archivo.settings ||
          !Array.isArray(archivo.data.expenses) || !Array.isArray(archivo.data.incomes)) {
        throw new Error("Formato de copia no válido");
      }
    } catch (error) {
      avisar("No se pudo importar: el archivo no es una copia de Nexo válida.");
      return;
    }

    confirmar({
      titulo: "¿Importar esta copia?",
      mensaje: "Reemplaza tus datos actuales por los del archivo (" + archivo.data.expenses.length + " gastos y " + archivo.data.incomes.length + " ingresos). Antes se guarda una copia de lo que tienes ahora.",
      aceptar: "Importar"
    }).then(function (ok) {
      if (!ok) return;

      /* Antes de reemplazar, se guarda una copia de lo actual para poder
         volver atrás desde Datos y respaldo. */
      crearCopiaLocal(buildPayload());

      var datos = migrateData(Object.assign({}, archivo.data, {
        version: archivo.version,
        settings: archivo.settings
      }));
      if (!datos.budgets || typeof datos.budgets !== "object") datos.budgets = Object.assign({}, DEFAULT_BUDGETS);
      applyPayload(datos);
      sanitizeSubcategories();
      ensureFixedFinanceMethods();
      normalizePaymentMethodOrder();
      rebuildIndexes();
      normalizeState();
      saveSettings();
      persist();
      state.screen = "home";
      render();
      mostrarAviso("Copia importada. Tus datos anteriores quedaron en Copias automáticas.");
    });
  };

  reader.readAsText(file);
}

function attachScreenHandlers() {

  /* Los menús de acciones (⋮ categorías/subcategorías, cuentas, etc.) usan
     delegación única a nivel de documento, independiente de la pantalla
     activa, para que funcionen también en elementos creados dinámicamente
     y evitar controladores duplicados. */
  if (!document.documentElement.dataset.settingsMenuDelegatedV2) {
    document.documentElement.dataset.settingsMenuDelegatedV2 = "1";
    document.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("[data-item-menu-toggle]") : null;
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        var menuId = btn.getAttribute("data-item-menu-toggle");
        var dropdown = Array.from(document.querySelectorAll("[data-item-menu-dropdown]")).find(function (node) { return node.getAttribute("data-item-menu-dropdown") === menuId; });
        if (!dropdown) return;
        var isOpen = dropdown.classList.contains("open");
        if (isOpen) closeSettingsItemMenu(dropdown, btn); else openSettingsItemMenu(btn, dropdown);
        return;
      }
      var option = event.target.closest ? event.target.closest(".settings-item-menu-option") : null;
      if (option) {
        closeSettingsItemMenus();
        return;
      }
      if (!event.target.closest || !event.target.closest(".settings-item-menu-dropdown")) closeSettingsItemMenus();
    }, true);
    document.addEventListener("keydown", function(event){ if(event.key === "Escape") closeSettingsItemMenus(); }, true);
    document.addEventListener("scroll", function(){ if(hasOpenSettingsMenu) closeSettingsItemMenus(); }, true);
    window.addEventListener("resize", function(){ if(hasOpenSettingsMenu) closeSettingsItemMenus(); });
  }

  if (state.screen === "pendientes") {
    function bindPendingForm(item) {
      item = item || null;
      openModal(pendingPaymentForm(item));
      var close = document.getElementById("close-pending");
      if (close) close.addEventListener("click", closeModal);
      var categoryEl = document.getElementById("pending-category");
      var subcategoryEl = document.getElementById("pending-subcategory");
      if (categoryEl && subcategoryEl) categoryEl.addEventListener("change", function () {
        subcategoryEl.innerHTML = '<option value="">Sin subcategoría</option>' + subcategoriesOptions(this.value);
      });
      var save = document.getElementById("save-pending");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("pending-name").value.trim();
        var amount = normalizeAmount(document.getElementById("pending-amount").value);
        var dueDate = document.getElementById("pending-date").value || localDateKey(new Date());
        var category = document.getElementById("pending-category").value;
        var subcategory = document.getElementById("pending-subcategory").value || "";
        var paymentMethod = document.getElementById("pending-payment").value;
        var note = document.getElementById("pending-note").value.trim();
        if (!name) { avisar("Escribe un nombre para el pago."); return; }
        if (!amount) { avisar("Ingresa un monto válido."); return; }
        if (item) {
          var oldOccurrenceDate = item.occurrenceDate || item.dueDate;
          item.name = name; item.amount = amount; item.dueDate = dueDate; item.category = category;
          item.subcategory = subcategory; item.paymentMethod = paymentMethod; item.note = note;
          if (item.recurringId) {
            var recurringEdit = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
            if (recurringEdit && recurringEdit.nextDate === oldOccurrenceDate) recurringEdit.nextDate = dueDate;
            item.occurrenceDate = dueDate;
          }
        } else {
          state.pendingPayments.push({ id: makeId("pending"), name: name, amount: amount, dueDate: dueDate, category: category, subcategory: subcategory, paymentMethod: paymentMethod, note: note, createdAt: Date.now() });
        }
        persist(); closeModal(); render();
      });
      var remove = document.getElementById("delete-pending");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar este pago pendiente?",
          mensaje: item.name + " · " + formatSoles(item.amount) + (item.recurringId ? ". Se omite solo esta vez; el recurrente sigue activo." : "."),
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          /* Si viene de un gasto recurrente, se salta esa ocurrencia para que
             no vuelva a generarse en el siguiente arranque. */
          if (item.recurringId) {
            var recurringSkipped = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
            var skippedOccurrence = item.occurrenceDate || item.dueDate;
            if (recurringSkipped && recurringSkipped.nextDate === skippedOccurrence) recurringSkipped.nextDate = recurringNextDate(skippedOccurrence, recurringSkipped.frequency);
          }
          state.pendingPayments = state.pendingPayments.filter(function (x) { return x.id !== item.id; });
          persist(); closeModal(); render();
        });
      });
    }

    var addPendingBtn = document.getElementById("add-pending-btn");
    if (addPendingBtn) addPendingBtn.addEventListener("click", function () { bindPendingForm(null); });

    document.querySelectorAll("[data-edit-pending]").forEach(function (row) {
      onRowActivate(row, function () {
        var item = (state.pendingPayments || []).find(function (x) { return x.id === row.getAttribute("data-edit-pending"); });
        if (item) bindPendingForm(item);
      });
    });

    document.querySelectorAll("[data-pay-pending]").forEach(function(button){
      button.addEventListener("click",function(){
        var id=this.getAttribute("data-pay-pending");
        var item=(state.pendingPayments||[]).find(function(x){return x.id===id;});
        if(!item)return;
        var now=new Date();
        state.expenses.unshift({ id:makeId("expense"), amount:item.amount, date:localDateKey(now), createdAt:now.getTime(), category:item.category, subcategory:item.subcategory||"", paymentMethod:item.paymentMethod, note:item.note||item.name, recurringId:item.recurringId||undefined, occurrenceDate:item.occurrenceDate||item.dueDate });
        if (item.recurringId) {
          var recurringPaid = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
          var paidOccurrence = item.occurrenceDate || item.dueDate;
          if (recurringPaid && recurringPaid.nextDate === paidOccurrence) recurringPaid.nextDate = recurringNextDate(paidOccurrence, recurringPaid.frequency);
        }
        state.pendingPayments=state.pendingPayments.filter(function(x){return x.id!==id;});
        generateRecurringExpenses();
        persist(); render();
      });
    });
  }

  if (state.screen === "deudas") {
    function bindDebtForm(item, defaultDirection) {
      item = item || null;
      openModal(debtForm(item, defaultDirection));

      var close = document.getElementById("close-debt");
      if (close) close.addEventListener("click", closeModal);

      var directionEl = document.getElementById("debt-direction");
      if (directionEl) directionEl.addEventListener("change", function () {
        var draft = item ? Object.assign({}, item) : {};
        draft.direction = this.value;
        draft.name = document.getElementById("debt-name").value;
        draft.principal = document.getElementById("debt-principal").value;
        draft.balance = document.getElementById("debt-balance").value;
        bindDebtForm(draft, this.value);
      });

      var categoryEl = document.getElementById("debt-category");
      var subcategoryEl = document.getElementById("debt-subcategory");
      if (categoryEl && subcategoryEl) categoryEl.addEventListener("change", function () {
        subcategoryEl.innerHTML = '<option value="">Sin subcategoría</option>' + subcategoriesOptions(this.value);
      });

      var save = document.getElementById("save-debt");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("debt-name").value.trim();
        var direction = document.getElementById("debt-direction").value;
        var principal = normalizeAmount(document.getElementById("debt-principal").value);
        var balanceInput = document.getElementById("debt-balance").value;
        var balance = balanceInput === "" ? principal : normalizeAmount(balanceInput);
        var interestRate = Math.max(0, Number(document.getElementById("debt-interest").value) || 0);
        var minPayment = normalizeAmount(document.getElementById("debt-min-payment").value);
        var dueDate = document.getElementById("debt-due-date").value || "";
        var category = document.getElementById("debt-category").value;
        var subcategoryEl2 = document.getElementById("debt-subcategory");
        var subcategory = subcategoryEl2 ? subcategoryEl2.value : "";
        var paymentMethod = document.getElementById("debt-payment").value || "";
        var note = document.getElementById("debt-note").value.trim();

        if (!name) { avisar("Escribe un nombre para la deuda."); return; }
        if (!principal) { avisar("Ingresa un monto total válido."); return; }
        if (balance > principal) { avisar("El saldo pendiente no puede ser mayor al monto total."); return; }

        if (item && item.id) {
          item.name = name; item.direction = direction; item.principal = principal; item.balance = balance;
          item.interestRate = interestRate; item.minPayment = minPayment; item.dueDate = dueDate;
          item.category = category; item.subcategory = subcategory; item.paymentMethod = paymentMethod; item.note = note;
        } else {
          state.debts.push(normalizeDebt({
            name: name, direction: direction, principal: principal, balance: balance,
            interestRate: interestRate, minPayment: minPayment, dueDate: dueDate,
            category: category, subcategory: subcategory, paymentMethod: paymentMethod, note: note
          }));
        }
        persist(); closeModal(); render();
      });
      var remove = document.getElementById("delete-debt");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar esta deuda?",
          mensaje: item.name + ". Los pagos ya registrados se conservan como movimientos.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.debts = state.debts.filter(function (x) { return x.id !== item.id; });
          persist(); closeModal(); render();
        });
      });
    }

    var addDebtOweBtn = document.getElementById("add-debt-owe-btn");
    if (addDebtOweBtn) addDebtOweBtn.addEventListener("click", function () { bindDebtForm(null, "owe"); });
    var addDebtOwedBtn = document.getElementById("add-debt-owed-btn");
    if (addDebtOwedBtn) addDebtOwedBtn.addEventListener("click", function () { bindDebtForm(null, "owed"); });

    document.querySelectorAll("[data-edit-debt]").forEach(function (row) {
      onRowActivate(row, function () {
        var item = (state.debts || []).find(function (x) { return x.id === row.getAttribute("data-edit-debt"); });
        if (item) bindDebtForm(item);
      });
    });

    document.querySelectorAll("[data-pay-debt]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-pay-debt");
        var debt = (state.debts || []).find(function (x) { return x.id === id; });
        if (!debt) return;

        openModal(debtPaymentForm(debt));
        var close = document.getElementById("close-debt-payment");
        if (close) close.addEventListener("click", closeModal);

        var save = document.getElementById("save-debt-payment");
        if (save) save.addEventListener("click", function () {
          var amount = normalizeAmount(document.getElementById("debt-payment-amount").value);
          var date = document.getElementById("debt-payment-date").value || localDateKey(new Date());
          var note = document.getElementById("debt-payment-note").value.trim();
          if (!amount) { avisar("Ingresa un monto válido."); return; }
          amount = Math.min(amount, debt.balance);

          var isExpenseSide = debt.direction === "owe";
          var fallbackMethod = isExpenseSide
            ? (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "")
            : (INCOME_PAYMENT_METHODS[0] ? INCOME_PAYMENT_METHODS[0].id : "");
          var paymentMethod = debt.paymentMethod || fallbackMethod;
          var noteText = (note ? note + " · " : "") + debt.name;

          if (isExpenseSide) {
            state.expenses.unshift({ id: makeId("expense"), amount: amount, date: date, createdAt: Date.now(), category: debt.category || (CATEGORIES[0] ? CATEGORIES[0].id : ""), subcategory: debt.subcategory || "", paymentMethod: paymentMethod, note: noteText, debtId: debt.id });
          } else {
            state.incomes.unshift({ id: makeId("income"), amount: amount, date: date, createdAt: Date.now(), category: debt.category || (INCOME_CATEGORIES[0] ? INCOME_CATEGORIES[0].id : ""), subcategory: debt.subcategory || "", paymentMethod: paymentMethod, note: noteText, debtId: debt.id });
          }

          debt.balance = Math.max(0, debt.balance - amount);
          persist(); closeModal(); render();
        });
      });
    });
  }

  if (state.screen === "cuentas") {
    document.querySelectorAll("[data-account-longpress]").forEach(function (card) {
      attachLongPress(card, function (target) {
        var id = target.getAttribute("data-account-longpress");
        var dropdown = document.querySelector('[data-item-menu-dropdown="account-' + id + '"]');
        if (dropdown) openSettingsItemMenu(target, dropdown);
      });
    });

    var addAccountBtn = document.getElementById("add-account-btn");
    if (addAccountBtn) addAccountBtn.addEventListener("click", function () {
      openModal(accountForm());
      var closeAccount = document.getElementById("close-account");
      if (closeAccount) closeAccount.addEventListener("click", closeModal);
      var saveAccount = document.getElementById("save-account");
      if (saveAccount) saveAccount.addEventListener("click", function () {
        var baseId = document.getElementById("account-base").value;
        var base = DEFAULT_PAYMENT_METHODS.find(function (p) { return p.id === baseId; }) || DEFAULT_PAYMENT_METHODS[0] || { color: "#77746b" };
        var name = document.getElementById("account-name").value.trim();
        var opening = Number(document.getElementById("account-opening").value) || 0;
        if (!name) { avisar("Escribe un nombre para la cuenta."); return; }
        var id = "account-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
        var method = { id: id, label: name, color: base.color || "#77746b", icon: base.icon || "bank" };
        PAYMENT_METHODS.push(method);
        INCOME_PAYMENT_METHODS.push(Object.assign({}, method));
        state.accountOpeningBalances[id] = opening;
        state.accountMetadata[id] = { custom: true, hidden: false, baseId: baseId };
        normalizePaymentMethodOrder(); rebuildIndexes(); saveSettings(); persist(); closeModal(); render();
      });
    });

    document.querySelectorAll("[data-toggle-account-hidden]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-toggle-account-hidden");
        if (!state.accountMetadata[id]) state.accountMetadata[id] = {};
        var hiding = !isAccountHidden(id);
        if (hiding && visiblePaymentMethods(PAYMENT_METHODS).length <= 1) { avisar("Debe quedar al menos una cuenta visible."); return; }
        state.accountMetadata[id].hidden = hiding;
        persist(); render();
      });
    });

    document.querySelectorAll("[data-delete-account]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-delete-account");
        var method = PAYMENT_METHODS.find(function (p) { return p.id === id; });
        if (!method) return;
        if (!isAccountHidden(id) && visiblePaymentMethods(PAYMENT_METHODS).length <= 1) {
          avisar("Debe quedar al menos una cuenta visible.");
          return;
        }
        var expenseCount = state.expenses.filter(function (x) { return x.paymentMethod === id; }).length;
        var incomeCount = state.incomes.filter(function (x) { return x.paymentMethod === id; }).length;
        var transferCount = (state.transfers || []).filter(function (x) { return x.fromAccount === id || x.toAccount === id; }).length;
        var pendingCount = (state.pendingPayments || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var recurringCount = (state.recurringExpenses || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var debtCount = (state.debts || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var linked = expenseCount + incomeCount + transferCount + pendingCount + recurringCount + debtCount;
        if (linked > 0) {
          avisar("No se puede eliminar esta cuenta porque todavía está vinculada a " + linked + " registro" + (linked === 1 ? "" : "s") + ". Elimina o cambia primero esos movimientos, transferencias o pagos.");
          return;
        }
        confirmar({
          titulo: "¿Eliminar la cuenta " + method.label + "?",
          mensaje: "Esta acción no se puede deshacer.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          PAYMENT_METHODS = PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
          INCOME_PAYMENT_METHODS = INCOME_PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
          delete state.accountOpeningBalances[id];
          delete state.accountMetadata[id];
          normalizePaymentMethodOrder(); rebuildIndexes(); saveSettings(); persist(); render();
        });
      });
    });

    function bindTransferForm(item) {
      openModal(transferForm(item));
      var close = document.getElementById("close-transfer");
      if (close) close.addEventListener("click", closeModal);
      var save = document.getElementById("save-transfer");
      if (save) save.addEventListener("click", function () {
        var fromId = document.getElementById("transfer-from").value;
        var toId = document.getElementById("transfer-to").value;
        var amount = normalizeAmount(document.getElementById("transfer-amount").value);
        var date = document.getElementById("transfer-date").value || localDateKey(new Date());
        var note = document.getElementById("transfer-note").value.trim();
        if (!amount) { avisar("Ingresa un monto válido."); return; }
        if (fromId === toId) { avisar("Elige dos cuentas diferentes."); return; }
        if (item) {
          item.fromAccount = fromId;
          item.toAccount = toId;
          item.amount = amount;
          item.date = date;
          item.note = note;
        } else {
          state.transfers.unshift({ id: makeId("transfer"), amount: amount, date: date, fromAccount: fromId, toAccount: toId, note: note, createdAt: Date.now() });
        }
        persist();
        closeModal();
        render();
      });
      var remove = document.getElementById("delete-transfer");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar esta transferencia?",
          mensaje: formatSoles(item.amount) + ". Los saldos de ambas cuentas vuelven a como estaban.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.transfers = state.transfers.filter(function (x) { return x.id !== item.id; });
          persist();
          closeModal();
          render();
        });
      });
    }

    var addTransferBtn = document.getElementById("add-transfer-btn");
    if (addTransferBtn) addTransferBtn.addEventListener("click", function () { bindTransferForm(null); });

    document.querySelectorAll("[data-edit-transfer]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-edit-transfer");
        var item = (state.transfers || []).find(function (x) { return x.id === id; });
        if (item) bindTransferForm(item);
      });
    });

    document.querySelectorAll("[data-account-adjust]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-account-adjust");
        var method = paymentIndex[id];
        if (!method) return;
        openModal(adjustBalanceForm(method));
        var close = document.getElementById("close-adjust-balance");
        if (close) close.addEventListener("click", closeModal);
        var input = document.getElementById("adjust-balance-value");
        if (input) { input.focus(); input.select(); }
        function save() {
          var targetBalance = Number(input && input.value);
          if (!input || input.value.trim() === "" || !Number.isFinite(targetBalance)) { avisar("Ingresa un saldo válido."); return; }
          var redondeado = Math.round(targetBalance * 100) / 100;
          state.accountOpeningBalances[id] = Math.round((accountOpeningBalance(id) + redondeado - accountBalance(id)) * 100) / 100;
          persist();
          closeModal();
          render();
        }
        var saveBtn = document.getElementById("save-adjust-balance");
        if (saveBtn) saveBtn.addEventListener("click", save);
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") save(); });
      });
    });
  }
  var openAccountsHome = document.getElementById("open-accounts-home");
  if (openAccountsHome) openAccountsHome.addEventListener("click", function () { state.screen = "cuentas"; render(); });

  var recurringFromExpenses = document.getElementById("open-recurring-from-expenses");
  if (recurringFromExpenses) recurringFromExpenses.addEventListener("click", function () {
    state.screen = "recurrentes";
    render();
  });

  document.querySelectorAll("[data-movement-detail-kind][data-movement-detail-id]").forEach(function (row) {
    function openDetail(event) {
      if (event && event.type === "click" && event.target.closest && event.target.closest("button,a,.settings-item-menu")) return;
      if (event && event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      if (event && event.type === "keydown") event.preventDefault();
      var kind = row.getAttribute("data-movement-detail-kind");
      var id = row.getAttribute("data-movement-detail-id");
      var item = findMovement(id, kind);
      if (!item) return;
      openModal(movementDetailModalHtml(kind, item));
      var close = document.getElementById("close-movement-detail");
      if (close) close.addEventListener("click", closeModal);
      var edit = document.getElementById("detail-edit-movement");
      if (edit) edit.addEventListener("click", function () {
        closeModal();
        if (kind === "income") {
          state.editingType = "income"; state.editingId = item.id;
          state.incomeDraft = { amount: String(item.amount), note: item.note || "", category: item.category, subcategory: item.subcategory || null, paymentMethod: item.paymentMethod };
          state.screen = "ingresos";
        } else {
          state.editingType = "expense"; state.editingId = item.id;
          state.addDraft = { amount: String(item.amount), note: item.note || "", category: item.category, subcategory: item.subcategory || null, paymentMethod: item.paymentMethod };
          state.screen = "add";
        }
        render();
      });
      var duplicate = document.getElementById("detail-duplicate-movement");
      if (duplicate) duplicate.addEventListener("click", function () { closeModal(); duplicateMovement(kind, item.id); });
      var del = document.getElementById("detail-delete-movement");
      if (del) del.addEventListener("click", function () {
        closeModal();
        if (kind === "income") deleteIncome(item.id, { skipConfirm: false });
        else deleteExpense(item.id, { skipConfirm: false });
      });
    }
    row.addEventListener("click", openDetail);
    row.addEventListener("keydown", openDetail);
  });

  var clearMovementsBtn=document.getElementById("clear-movements-btn");
  if(clearMovementsBtn)clearMovementsBtn.addEventListener("click",clearAllMovements);


  if (state.screen === "metas") {
    var addGoalBtn = document.getElementById("add-goal-btn");
    if (addGoalBtn) addGoalBtn.addEventListener("click", function () {
      openModal(savingsGoalForm());
      var closeGoal = document.getElementById("close-goal");
      if (closeGoal) closeGoal.addEventListener("click", closeModal);
      var saveGoal = document.getElementById("save-goal");
      if (saveGoal) saveGoal.addEventListener("click", function () {
        var name = (document.getElementById("goal-name").value || "").trim();
        var target = Number(document.getElementById("goal-target").value);
        var saved = Number(document.getElementById("goal-saved").value || 0);
        if (!name || !target || target <= 0 || saved < 0) {
          avisar("Completa el nombre y un objetivo válido.");
          return;
        }
        state.savingsGoals.push({
          id: "goal-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
          name: name,
          target: normalizeAmount(target),
          saved: normalizeAmount(saved),
          targetDate: (document.getElementById('goal-date').value || ''),
          createdAt: Date.now(),
          contributions: saved > 0 ? [{amount: normalizeAmount(saved), createdAt: Date.now()}] : []
        });
        persist();
        closeModal();
        render();
      });
    });

    document.querySelectorAll("[data-goal-edit]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-goal-edit");
        var goal = state.savingsGoals.find(function (item) { return item.id === id; });
        if (!goal) return;
        openModal('<div class="modal-card"><div class="modal-header"><h3>Editar meta</h3><button type="button" id="close-goal-edit" aria-label="Cerrar">×</button></div>' +
          '<label>Nombre<input id="edit-goal-name" type="text" value="' + escapeHtml(goal.name) + '"></label>' +
          '<label>Objetivo<input id="edit-goal-target" type="number" min="1" step="0.01" value="' + escapeHtml(goal.target) + '"></label>' +
          '<label>Fecha objetivo<input id="edit-goal-date" type="date" value="' + escapeHtml(goal.targetDate || '') + '"></label>' +
          '<button type="button" class="primary-btn" id="save-goal-edit">Guardar</button>' +
          '<button type="button" class="secondary-btn danger-btn modal-secondary-action" id="delete-goal">Eliminar meta</button></div>');
        document.getElementById("close-goal-edit").addEventListener("click", closeModal);
        document.getElementById("save-goal-edit").addEventListener("click", function () {
          var name = document.getElementById("edit-goal-name").value.trim();
          var target = Number(document.getElementById("edit-goal-target").value);
          if (!name || !target || target <= 0) { avisar("Completa un nombre y un objetivo válido."); return; }
          goal.name = name; goal.target = normalizeAmount(target); goal.targetDate = document.getElementById('edit-goal-date').value || ''; goal.saved = Math.min(normalizeAmount(goal.saved), goal.target);
          persist(); closeModal(); render();
        });
        document.getElementById("delete-goal").addEventListener("click", function () {
          confirmar({
            titulo: "¿Eliminar la meta " + goal.name + "?",
            mensaje: "Se pierde el registro de lo ahorrado en ella.",
            aceptar: "Eliminar",
            peligro: true
          }).then(function (ok) {
            if (!ok) return;
            state.savingsGoals = state.savingsGoals.filter(function (item) { return item.id !== id; });
            persist(); closeModal(); render();
          });
        });
      });
    });

    document.querySelectorAll("[data-goal-add]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-goal-add");
        var goal = state.savingsGoals.find(function (item) { return item.id === id; });
        if (!goal) return;
        openModal(goalContributionForm(goal));
        var input = document.getElementById("goal-add-amount");
        if (input) input.focus();
        document.getElementById("close-goal-add").addEventListener("click", closeModal);
        function guardar() {
          var amount = Number(input && input.value);
          if (!amount || amount <= 0) { avisar("Ingresa un monto válido."); return; }
          var remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
          amount = Math.min(amount, remaining);
          goal.saved = normalizeAmount((Number(goal.saved) || 0) + amount);
          if (!Array.isArray(goal.contributions)) goal.contributions = [];
          if (amount > 0) goal.contributions.push({ amount: normalizeAmount(amount), createdAt: Date.now() });
          persist(); closeModal(); render();
        }
        document.getElementById("save-goal-add").addEventListener("click", guardar);
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") guardar(); });
      });
    });
  }

  if (state.screen === "recurrentes") {
    var addRecurringBtn = document.getElementById("add-recurring-btn");
    if (addRecurringBtn) addRecurringBtn.addEventListener("click", function () {
      openModal(recurringForm());
      var close = document.getElementById("close-recurring");
      if (close) close.addEventListener("click", closeModal);

      
      var recurringCategory = document.getElementById("rec-category");
      var recurringSubcategory = document.getElementById("rec-subcategory");
      if (recurringCategory && recurringSubcategory) {
        recurringCategory.addEventListener("change", function () {
          recurringSubcategory.innerHTML = subcategoriesOptions(this.value);
        });
      }

var save = document.getElementById("save-recurring");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("rec-name").value.trim();
        var amount = Number(document.getElementById("rec-amount").value);
        var startDate = document.getElementById("rec-start").value;

        if (!name || !amount || amount <= 0 || !startDate) {
          avisar("Completa el nombre, monto y fecha.");
          return;
        }

        state.recurringExpenses.push({
          id: "recurring-" + Date.now(),
          name: name,
          amount: amount,
          frequency: document.getElementById("rec-frequency").value,
          startDate: startDate,
          nextDate: startDate,
          category: document.getElementById("rec-category").value,
          subcategory: document.getElementById("rec-subcategory").value,
          paymentMethod: document.getElementById("rec-payment").value,
          note: document.getElementById("rec-note").value.trim(),
          active: true
        });

        persist();
        closeModal();
        generateRecurringExpenses();
        render();
      });
    });

    document.querySelectorAll("[data-recurring-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-recurring-edit");
        var item = state.recurringExpenses.find(function (r) { return r.id === id; });
        if (!item) return;
        openModal(recurringForm(item).replace("Nuevo gasto recurrente", "Editar gasto recurrente"));
        document.getElementById("rec-name").value = item.name || "";
        document.getElementById("rec-amount").value = item.amount || "";
        document.getElementById("rec-frequency").value = item.frequency || "monthly";
        document.getElementById("rec-start").value = item.startDate || localDateKey(new Date());
        document.getElementById("rec-category").value = item.category || (CATEGORIES[0] && CATEGORIES[0].id) || "";
        document.getElementById("rec-subcategory").innerHTML = subcategoriesOptions(document.getElementById("rec-category").value, item.subcategory || "");
        document.getElementById("rec-payment").value = item.paymentMethod || (PAYMENT_METHODS[0] && PAYMENT_METHODS[0].id) || "";
        document.getElementById("rec-note").value = item.note || "";
        document.getElementById("close-recurring").addEventListener("click", closeModal);
        document.getElementById("rec-category").addEventListener("change", function () { document.getElementById("rec-subcategory").innerHTML = subcategoriesOptions(this.value); });
        document.getElementById("save-recurring").addEventListener("click", function () {
          var name = document.getElementById("rec-name").value.trim();
          var amount = Number(document.getElementById("rec-amount").value);
          var startDate = document.getElementById("rec-start").value;
          if (!name || !amount || amount <= 0 || !startDate) { avisar("Completa el nombre, monto y fecha."); return; }
          item.name = name; item.amount = normalizeAmount(amount); item.frequency = document.getElementById("rec-frequency").value; item.startDate = startDate; item.category = document.getElementById("rec-category").value; item.subcategory = document.getElementById("rec-subcategory").value; item.paymentMethod = document.getElementById("rec-payment").value; item.note = document.getElementById("rec-note").value.trim();
          state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== item.id; });
          item.nextDate = startDate;
          persist(); closeModal(); generateRecurringExpenses(); render();
        });
      });
    });

    document.querySelectorAll("[data-recurring-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = state.recurringExpenses.find(function (r) { return r.id === button.getAttribute("data-recurring-toggle"); });
        if (!item) return;
        item.active = !item.active;
        if (!item.active) state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== item.id; });
        persist();
        if (item.active) generateRecurringExpenses();
        render();
      });
    });

    document.querySelectorAll("[data-recurring-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-recurring-delete");
        var item = state.recurringExpenses.find(function (r) { return r.id === id; });
        if (!item) return;
        confirmar({
          titulo: "¿Eliminar el gasto recurrente " + item.name + "?",
          mensaje: "Se quitan también sus pagos pendientes. Los gastos ya pagados se conservan.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.recurringExpenses = state.recurringExpenses.filter(function (r) { return r.id !== id; });
          state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== id; });
          // Los gastos ya pagados se conservan como historial.
          persist(); render();
        });
      });
    });
  }



  if (state.screen === "analisis") {
    var analysisPrev = document.querySelector("[data-analysis-prev]");
    var analysisNext = document.querySelector("[data-analysis-next]");

    if (analysisPrev) analysisPrev.addEventListener("click", function () {
      var d = new Date(state.analysisYear, state.analysisMonth - 1, 1);
      state.analysisYear = d.getFullYear();
      state.analysisMonth = d.getMonth();
      persist();
      render();
    });

    if (analysisNext) analysisNext.addEventListener("click", function () {
      var d = new Date(state.analysisYear, state.analysisMonth + 1, 1);
      state.analysisYear = d.getFullYear();
      state.analysisMonth = d.getMonth();
      persist();
      render();
    });
  }



  attachChartFilterToggleHandlers();

  /* =========================
     AGREGAR GASTO
  ========================= */

  if (state.screen === "add") {

    function syncAddDraftFromInputs() {

      var amountInput =
        document.getElementById(
          "amount-input"
        );

      var noteInput =
        document.getElementById(
          "note-input"
        );

      if (amountInput) {

        state.addDraft.amount =
          amountInput.value;

      }

      if (noteInput) {

        state.addDraft.note =
          noteInput.value;

      }

    }

    document
      .getElementById("cancel-add")
      .addEventListener(
        "click",
        function () {

          state.addDraft = {
            amount: "",
            note: "",
            category: null,
            subcategory: null,
            paymentMethod: null
          };
          state.editingType = null;
          state.editingId = null;

          state.screen =
            "home";

          render();

        }
      );

    document
      .querySelectorAll(
        "#cat-group .cat-chip"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              syncAddDraftFromInputs();

              state.addDraft.category =
                btn.getAttribute(
                  "data-cat"
                );

              state.addDraft.subcategory = null;

              render();

            }
          );

        }
      );

    document.querySelectorAll("[data-add-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncAddDraftFromInputs();
        var val = btn.getAttribute("data-add-subcategory");
        state.addDraft.subcategory = val === "todos" ? null : val;
        render();
      });
    });

    document
      .querySelectorAll(
        "#pay-group .cat-chip"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              syncAddDraftFromInputs();

              state.addDraft.paymentMethod =
                btn.getAttribute(
                  "data-pay"
                );

              render();

            }
          );

        }
      );

    document
      .getElementById(
        "save-expense-btn"
      )
      .addEventListener(
        "click",
        function () {

          syncAddDraftFromInputs();

          var amountVal =
            state.addDraft.amount;

          var noteVal =
            state.addDraft.note;

          var amount =
            parseFloat(amountVal);

          var ok = true;

          if (
            !amountVal ||
            isNaN(amount) ||
            amount <= 0
          ) {

            document
              .getElementById(
                "amount-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!state.addDraft.category) {

            document
              .getElementById(
                "cat-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!state.addDraft.paymentMethod) {

            document
              .getElementById(
                "pay-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!ok) {
            return;
          }

          var expenseData = {
            amount: amount,
            category: state.addDraft.category,
            subcategory: state.addDraft.subcategory || null,
            paymentMethod: state.addDraft.paymentMethod,
            note: noteVal.trim()
          };

          if (state.editingType === "expense" && state.editingId) {
            var existingExpense = findMovement(state.editingId, "expense");
            if (existingExpense) {
              Object.assign(existingExpense, expenseData);
            }
          } else {
            var createdNow = new Date();
            state.expenses.unshift(Object.assign({ id: makeId("expense"), date: localDateKey(createdNow), createdAt: createdNow.getTime() }, expenseData));
          }

          persist();

          state.editingType = null;
          state.editingId = null;

          state.addDraft = {

            amount: "",
            note: "",
            category: null,
            subcategory: null,
            paymentMethod: null

          };

          state.screen =
            "home";

          render();

        }
      );

  }

  /* =========================
     INGRESOS
  ========================= */

  else if (state.screen === "ingresos") {
    var amountInput = document.getElementById("income-amount-input");
    var noteInput = document.getElementById("income-note-input");

    function syncIncomeDraftFromInputs() {
      var amountInput = document.getElementById("income-amount-input");
      var noteInput = document.getElementById("income-note-input");

      if (amountInput) {
        state.incomeDraft.amount = amountInput.value;
      }

      if (noteInput) {
        state.incomeDraft.note = noteInput.value;
      }
    }

    if (amountInput) {
      amountInput.value = state.incomeDraft.amount || "";
      amountInput.addEventListener("input", function () {
        state.incomeDraft.amount = amountInput.value;
      });
    }
    if (noteInput) {
      noteInput.value = state.incomeDraft.note || "";
      noteInput.addEventListener("input", function () {
        state.incomeDraft.note = noteInput.value;
      });
    }

    var cancelIncome = document.getElementById("cancel-income");
    if (cancelIncome) {
      cancelIncome.addEventListener("click", function () {
        state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
        state.screen = "home";
        render();
      });
    }

    document.querySelectorAll("[data-income-category]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        state.incomeDraft.category = btn.getAttribute("data-income-category");
        state.incomeDraft.subcategory = null;
        render();
      });
    });

    document.querySelectorAll("[data-income-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        var val = btn.getAttribute("data-income-subcategory");
        state.incomeDraft.subcategory = val === "todos" ? null : val;
        render();
      });
    });


    document.querySelectorAll("[data-income-payment]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        state.incomeDraft.paymentMethod = btn.getAttribute("data-income-payment");
        render();
      });
    });

    var saveIncome = document.getElementById("save-income-btn");
    if (saveIncome) {
      saveIncome.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        var amount = parseFloat(state.incomeDraft.amount);
        var ok = true;
        document.getElementById("income-error").style.display = "none";
        document.getElementById("income-category-error").style.display = "none";
        document.getElementById("income-payment-error").style.display = "none";

        if (!state.incomeDraft.amount || isNaN(amount) || amount <= 0) {
          document.getElementById("income-error").style.display = "block";
          ok = false;
        }
        if (!state.incomeDraft.category) {
          document.getElementById("income-category-error").style.display = "block";
          ok = false;
        }
        if (!state.incomeDraft.paymentMethod) {
          document.getElementById("income-payment-error").style.display = "block";
          ok = false;
        }
        if (!ok) return;

        var incomeData = {
          amount: amount,
          category: state.incomeDraft.category,
          subcategory: state.incomeDraft.subcategory || null,
          paymentMethod: state.incomeDraft.paymentMethod,
          note: (state.incomeDraft.note || "").trim()
        };
        if (state.editingType === "income" && state.editingId) {
          var existingIncome = findMovement(state.editingId, "income");
          if (existingIncome) Object.assign(existingIncome, incomeData);
        } else {
          var createdNow = new Date();
          state.incomes.unshift(Object.assign({ id: makeId("income"), date: localDateKey(createdNow), createdAt: createdNow.getTime() }, incomeData));
        }

        persist();
        state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
        state.editingType = null;
        state.editingId = null;
        render();
      });
    }
  }

  /* =========================
     MOVIMIENTOS
  ========================= */

  else if (
    state.screen === "movimientos"
  ) {
    var movementFilterToggle = document.getElementById("movement-filter-toggle");
    if (movementFilterToggle) movementFilterToggle.addEventListener("click", function(event){ event.stopPropagation(); state.movementFiltersOpen = !state.movementFiltersOpen; render(); });
    document.querySelectorAll("[data-movement-type]").forEach(function(btn){
      btn.addEventListener("click", function(){
        state.movementTypeFilter = this.getAttribute("data-movement-type") || "todos";
        state.movementCategoryFilter = "todos";
        state.movementSubcategoryFilter = "todos";
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    document.querySelectorAll("[data-movement-category]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var value = this.getAttribute("data-movement-category") || "todos";
        state.movementCategoryFilter = value;
        state.movementSubcategoryFilter = "todos";
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    document.querySelectorAll("[data-movement-subcategory]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var value = this.getAttribute("data-movement-subcategory") || "todos";
        state.movementSubcategoryFilter = value;
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    var movementSearchInput = document.getElementById("movement-search");
    if (movementSearchInput) {
      movementSearchInput.addEventListener("input", function () {
        var value = this.value;
        var pos = this.selectionStart;
        state.movementSearch = value;
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
        var next = document.getElementById("movement-search");
        if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch(e) {} }
      });
    }

    var movementMonthFilter = document.getElementById("movement-month-filter");
    var movementYearFilter = document.getElementById("movement-year-filter");
    if (movementMonthFilter) movementMonthFilter.addEventListener("change", function(){ state.movementMonth=this.value; state.movementLimit = MOVIMIENTOS_POR_PAGINA; render(); });
    if (movementYearFilter) movementYearFilter.addEventListener("change", function(){ state.movementYear=this.value; if(this.value === "all") state.movementMonth="all"; state.movementLimit = MOVIMIENTOS_POR_PAGINA; render(); });
    var showMoreMovement = document.querySelector("[data-movement-show-more]");
    if (showMoreMovement) showMoreMovement.addEventListener("click", function(){
      state.movementLimit = (Number(state.movementLimit) || MOVIMIENTOS_POR_PAGINA) + MOVIMIENTOS_POR_PAGINA;
      render();
    });
  }

  /* =========================
     MESES
  ========================= */

  else if (
    state.screen === "meses"
  ) {

    document.querySelectorAll("[data-calendar-year]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarYear = Number(btn.getAttribute("data-calendar-year"));
        state.calendarView = "months";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-month]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarMonth = Number(btn.getAttribute("data-calendar-month"));
        state.calendarDay = 1;
        state.calendarView = "month";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-day]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarDay = Number(btn.getAttribute("data-calendar-day"));
        persist();
        render();
      });
    });

    /* Los filtros del calendario se generan con renderPickerDropdown, que
       compone el atributo como "data-" + prefijo. */
    document.querySelectorAll("[data-calendar-expense-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarExpensePaymentFilter = btn.getAttribute("data-calendar-expense-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-income-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarIncomePaymentFilter = btn.getAttribute("data-calendar-income-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-expense-subcategory-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarExpenseSubcategoryFilter = btn.getAttribute("data-calendar-expense-subcategory-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-income-subcategory-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarIncomeSubcategoryFilter = btn.getAttribute("data-calendar-income-subcategory-filter") || "todos";
        persist();
        render();
      });
    });

    var backYears = document.querySelector("[data-calendar-back-years]");
    if (backYears) {
      backYears.addEventListener("click", function () {
        state.calendarView = "years";
        persist();
        render();
      });
    }

    var backMonths = document.querySelector("[data-calendar-back-months]");
    if (backMonths) {
      backMonths.addEventListener("click", function () {
        state.calendarView = "months";
        persist();
        render();
      });
    }

  }

  /* =========================
     PRESUPUESTOS
  ========================= */

  else if (
    state.screen === "presupuestos"
  ) {

    document.querySelectorAll("[data-budget-edit]").forEach(function (row) {
      onRowActivate(row, function () {
        var cat = categoryIndex[row.getAttribute("data-budget-edit")];
        if (!cat) return;
        openModal(budgetEditForm(cat));
        var input = document.getElementById("budget-edit-value");
        if (input) { input.focus(); input.select(); }

        function guardar(valor) {
          if (valor > 0) state.budgets[cat.id] = Math.round(valor * 100) / 100;
          else delete state.budgets[cat.id];
          persist();
          closeModal();
          render();
        }

        function guardarDesdeCampo() {
          var texto = input ? input.value.trim() : "";
          var valor = texto === "" ? 0 : Number(texto);
          if (!Number.isFinite(valor) || valor < 0) { avisar("Ingresa un monto válido."); return; }
          guardar(valor);
        }

        var close = document.getElementById("close-budget-edit");
        if (close) close.addEventListener("click", closeModal);
        var save = document.getElementById("save-budget-edit");
        if (save) save.addEventListener("click", guardarDesdeCampo);
        var clear = document.getElementById("clear-budget-edit");
        if (clear) clear.addEventListener("click", function () { guardar(0); });
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") guardarDesdeCampo(); });
      });
    });

  }

  /* =========================
     CONFIGURACIÓN
  ========================= */

  else if (
    state.screen === "configuracion"
  ) {
    document.querySelectorAll("[data-tema]").forEach(function (boton) {
      boton.addEventListener("click", function () {
        guardarTema(boton.getAttribute("data-tema"));
        preserveScroll(render);
      });
    });

    var exportDataBtn = document.getElementById("export-data-btn");
    var importDataBtn = document.getElementById("import-data-btn");
    var importDataFile = document.getElementById("import-data-file");

    if (exportDataBtn) exportDataBtn.addEventListener("click", exportAppData);
    var backupSelect = document.getElementById("local-backup-select");
    var restoreBackupBtn = document.getElementById("restore-local-backup-btn");
    if (backupSelect) {
      var backups = listLocalBackups();
      backupSelect.innerHTML = backups.length
        ? backups.slice().reverse().map(function (b) {
            var etiqueta = etiquetaDia(b.date) + " · " + b.date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
            return '<option value="' + b.timestamp + '">' + escapeHtml(etiqueta) + '</option>';
          }).join("")
        : '<option value="">Todavía no hay copias</option>';
      if (!backups.length) {
        backupSelect.disabled = true;
        if (restoreBackupBtn) restoreBackupBtn.disabled = true;
      }
    }
    if (restoreBackupBtn) restoreBackupBtn.addEventListener("click", function(){
      var ts = backupSelect && backupSelect.value;
      if (!ts) return;
      var etiqueta = backupSelect.options[backupSelect.selectedIndex].textContent;
      confirmar({
        titulo: "¿Restaurar la copia de " + etiqueta.toLowerCase() + "?",
        mensaje: "Tus datos actuales se reemplazan por los de esa copia.",
        aceptar: "Restaurar"
      }).then(function (ok) {
        if (!ok) return;
        if (restoreLocalBackup(Number(ts))) mostrarAviso("Copia restaurada.");
        else avisar("No se pudo restaurar la copia.");
      });
    });
    if (importDataBtn && importDataFile) {
      importDataBtn.addEventListener("click", function () {
        importDataFile.value = "";
        importDataFile.click();
      });
      importDataFile.addEventListener("change", function () {
        if (this.files && this.files[0]) importAppData(this.files[0]);
      });
    }



    /* Acordeones independientes: solo uno puede estar abierto a la vez.
       El estado se guarda en `state` para sobrevivir a los re-renders
       que ocurren al agregar/editar/eliminar categorías y subcategorías. */
    document.querySelectorAll("[data-settings-section]").forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        var section = toggle.getAttribute("data-settings-section");
        preserveScroll(function () {
          state.settingsOpenSection = state.settingsOpenSection === section ? null : section;
          render();
        });
      });
    });

    var addCategory =
      document.getElementById(
        "add-category-btn"
      );

    if (addCategory) {

      addCategory.addEventListener(
        "click",
        function () {

          state.modal = {

            type: "category",

            editing: false,

            id: null

          };

          renderModal();

        }
      );

    }

    document.querySelectorAll("[data-add-subcategory-for]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSettingsItemMenus();
        var key = btn.getAttribute("data-add-subcategory-for");
        var kind = key.split("|")[0];
        state.settingsExpandedCategories = {};
        state.settingsExpandedCategories[key] = true;
        state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
        state.modal = { type: "subcategory", editing: false, id: null, categoryKey: key };
        renderModal();
      });
    });

    document.querySelectorAll("[data-category-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-category-toggle");
        var kind = key.split("|")[0];
        var wasOpen = !!state.settingsExpandedCategories[key];

        if (wasOpen) {

          /* Se está CERRANDO: conservar la posición de scroll actual,
             sin saltos ni regreso al inicio. */
          preserveScroll(function () {
            state.settingsExpandedCategories = {};
            state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
            render();
          });

        } else {

          /* Se está ABRIENDO: abrir esta y cerrar cualquier otra ocurre en
             un único render. preserveScroll() mantiene la posición y, si
             las subcategorías quedan fuera de la pantalla, se desplaza lo
             justo para mostrarlas. */
          preserveScroll(function () {
            state.settingsExpandedCategories = {};
            state.settingsExpandedCategories[key] = true;
            state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
            render();
          });

          centerSettingsElement('[data-category-key="' + key + '"]');

        }
      });
    });

    /* Un único acordeón de subcategorías puede estar abierto. Un clic fuera
       del grupo abierto lo cierra; el clic en otra categoría cambia el estado
       en un solo render. Se delega en document para sobrevivir a cada render(). */
    if (!document.documentElement.dataset.nexoSubcategoryAccordionDelegatedV1) {
      document.documentElement.dataset.nexoSubcategoryAccordionDelegatedV1 = "1";
      document.addEventListener("click", function (event) {
        if (state.screen !== "configuracion") return;
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest("[data-category-toggle]")) return;
        if (target.closest(".settings-category-group")) return;
        if (target.closest("#modal-root, #generic-modal-root, .dialogo-fondo")) return;
        var openKeys = Object.keys(state.settingsExpandedCategories || {}).filter(function (key) {
          return !!state.settingsExpandedCategories[key];
        });
        if (!openKeys.length) return;
        state.settingsExpandedCategories = {};
        render();
      });
    }

    document.querySelectorAll("[data-edit-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.modal = { type: "subcategory", editing: true, id: btn.getAttribute("data-edit-subcategory"), categoryKey: null };
        renderModal();
      });
    });

    document.querySelectorAll("[data-delete-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-subcategory");
        var sub = SUBCATEGORIES.find(function (s) { return s.id === id; });
        if (!sub) return;
        confirmar({
          titulo: "¿Eliminar la subcategoría " + sub.label + "?",
          mensaje: "Los movimientos que la usaban se conservan, sin subcategoría.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.expenses.forEach(function (e) { if (e.subcategory === id) e.subcategory = null; });
          state.incomes.forEach(function (e) { if (e.subcategory === id) e.subcategory = null; });
          if (state.addDraft && state.addDraft.subcategory === id) state.addDraft.subcategory = null;
          if (state.incomeDraft && state.incomeDraft.subcategory === id) state.incomeDraft.subcategory = null;

          SUBCATEGORIES = SUBCATEGORIES.filter(function (s) { return s.id !== id; });
          saveSettings();
          persist();
          preserveScroll(render);
        });
      });
    });

    var addPayment =
      document.getElementById(
        "add-payment-btn"
      );

    if (addPayment) {

      addPayment.addEventListener(
        "click",
        function () {

          state.modal = {

            type: "payment",

            editing: false,

            id: null

          };

          renderModal();

        }
      );

    }

    var addIncomeCategory = document.getElementById("add-income-category-btn");
    if (addIncomeCategory) addIncomeCategory.addEventListener("click", function(){ state.modal={type:"incomeCategory",editing:false,id:null}; renderModal(); });
    var addIncomePayment = document.getElementById("add-income-payment-btn");
    if (addIncomePayment) addIncomePayment.addEventListener("click", function(){ state.modal={type:"incomePayment",editing:false,id:null}; renderModal(); });

    document.querySelectorAll("[data-edit-income-category]").forEach(function(btn){ btn.addEventListener("click", function(){ state.modal={type:"incomeCategory",editing:true,id:btn.getAttribute("data-edit-income-category")}; renderModal(); }); });
    document.querySelectorAll("[data-edit-income-payment]").forEach(function(btn){ btn.addEventListener("click", function(){ state.modal={type:"incomePayment",editing:true,id:btn.getAttribute("data-edit-income-payment")}; renderModal(); }); });
    document.querySelectorAll("[data-delete-income-category]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-income-category");
        if (INCOME_CATEGORIES.length <= 1) { avisar("Debes conservar al menos una categoría de ingreso."); return; }
        var cat = INCOME_CATEGORIES.find(function (c) { return c.id === id; });
        if (!cat) return;
        var fallback = INCOME_CATEGORIES.find(function (c) { return c.id !== id; });
        confirmar({
          titulo: "¿Eliminar la categoría " + cat.label + "?",
          mensaje: "Sus ingresos pasan a " + fallback.label + " y se borran sus subcategorías.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.incomes.forEach(function (item) { if (item.category === id) item.category = fallback.id; });

          var orphanIncomeSubIds = SUBCATEGORIES.filter(function (s) {
            return s.kind === "income" && s.categoryId === id;
          }).map(function (s) { return s.id; });

          SUBCATEGORIES = SUBCATEGORIES.filter(function (s) {
            return !(s.kind === "income" && s.categoryId === id);
          });

          state.incomes.forEach(function (item) {
            if (orphanIncomeSubIds.indexOf(item.subcategory) !== -1) item.subcategory = null;
          });

          if (state.incomeDraft && orphanIncomeSubIds.indexOf(state.incomeDraft.subcategory) !== -1) {
            state.incomeDraft.subcategory = null;
          }

          delete state.settingsExpandedCategories["income|" + id];

          INCOME_CATEGORIES.splice(INCOME_CATEGORIES.indexOf(cat), 1);
          saveSettings(); persist(); preserveScroll(render);
        });
      });
    });

    document.querySelectorAll("[data-delete-income-payment]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-income-payment");
        if (INCOME_PAYMENT_METHODS.length <= 1) { avisar("Debes conservar al menos una fuente de ingreso."); return; }
        var pay = INCOME_PAYMENT_METHODS.find(function (p) { return p.id === id; });
        if (!pay) return;
        var fallback = INCOME_PAYMENT_METHODS.find(function (p) { return p.id !== id; });
        confirmar({
          titulo: "¿Eliminar la fuente " + pay.label + "?",
          mensaje: "Sus ingresos pasan a " + fallback.label + ".",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.incomes.forEach(function (item) { if (item.paymentMethod === id) item.paymentMethod = fallback.id; });
          INCOME_PAYMENT_METHODS.splice(INCOME_PAYMENT_METHODS.indexOf(pay), 1);
          saveSettings(); persist(); preserveScroll(render);
        });
      });
    });

    document
      .querySelectorAll(
        "[data-edit-category]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              state.modal = {

                type: "category",

                editing: true,

                id:
                  btn.getAttribute(
                    "data-edit-category"
                  )

              };

              renderModal();

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-edit-payment]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              state.modal = {

                type: "payment",

                editing: true,

                id:
                  btn.getAttribute(
                    "data-edit-payment"
                  )

              };

              renderModal();

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-delete-category]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var id =
                btn.getAttribute(
                  "data-delete-category"
                );

              if (CATEGORIES.length <= 1) {

                avisar("Debes conservar al menos una categoría de gasto.");

                return;

              }

              var cat =
                CATEGORIES.find(function (c) {
                  return c.id === id;
                });

              if (!cat) return;

              var fallback =
                CATEGORIES.find(function (c) {
                  return c.id !== id;
                });

              confirmar({
                titulo: "¿Eliminar la categoría " + cat.label + "?",
                mensaje: "Sus gastos, pagos pendientes y recurrentes pasan a " + fallback.label + ", y se borran su presupuesto y sus subcategorías.",
                aceptar: "Eliminar",
                peligro: true
              }).then(function (ok) {
                if (!ok) return;

                /* Todo lo que apuntaba a la categoría pasa a otra; antes solo
                   se reasignaban los gastos y los pendientes, recurrentes y
                   deudas quedaban apuntando a una categoría inexistente. */
                [state.expenses, state.pendingPayments, state.recurringExpenses, state.debts].forEach(function (lista) {
                  (lista || []).forEach(function (item) {
                    if (item.category === id) item.category = fallback.id;
                  });
                });

                delete state.budgets[id];

                var orphanSubIds = SUBCATEGORIES.filter(function (s) {
                  return s.kind === "expense" && s.categoryId === id;
                }).map(function (s) { return s.id; });

                SUBCATEGORIES = SUBCATEGORIES.filter(function (s) {
                  return !(s.kind === "expense" && s.categoryId === id);
                });

                [state.expenses, state.pendingPayments, state.recurringExpenses, state.debts].forEach(function (lista) {
                  (lista || []).forEach(function (item) {
                    if (orphanSubIds.indexOf(item.subcategory) !== -1) item.subcategory = null;
                  });
                });

                if (state.addDraft && state.addDraft.category === id) state.addDraft.category = null;
                if (state.addDraft && orphanSubIds.indexOf(state.addDraft.subcategory) !== -1) {
                  state.addDraft.subcategory = null;
                }

                delete state.settingsExpandedCategories["expense|" + id];

                CATEGORIES = CATEGORIES.filter(function (c) { return c.id !== id; });

                saveSettings();
                persist();
                preserveScroll(render);
              });

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-delete-payment]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var id =
                btn.getAttribute(
                  "data-delete-payment"
                );

              if (
                PAYMENT_METHODS.length <= 1
              ) {

                avisar(
                  "Debes conservar al menos un método de pago."
                );

                return;

              }

              var pay = payInfo(id);

              /* Un método de pago es también una cuenta con saldo. Igual que
                 al eliminarla desde Cuentas, no se borra si tiene registros:
                 antes se reasignaban en silencio a otra cuenta, lo que movía
                 dinero entre cuentas y dejaba huérfano su saldo inicial. */
              var vinculados =
                state.expenses.filter(function (x) { return x.paymentMethod === id; }).length +
                state.incomes.filter(function (x) { return x.paymentMethod === id; }).length +
                (state.transfers || []).filter(function (x) { return x.fromAccount === id || x.toAccount === id; }).length +
                (state.pendingPayments || []).filter(function (x) { return x.paymentMethod === id; }).length +
                (state.recurringExpenses || []).filter(function (x) { return x.paymentMethod === id; }).length +
                (state.debts || []).filter(function (x) { return x.paymentMethod === id; }).length;

              if (vinculados) {
                avisar(
                  pay.label + " tiene " + vinculados + " registro" + (vinculados === 1 ? "" : "s") + " asociado" + (vinculados === 1 ? "" : "s") +
                  ". Para dejar de verlo sin perder ese historial, ocúltalo desde Cuentas manteniéndolo presionado.",
                  "No se puede eliminar " + pay.label
                );
                return;
              }

              confirmar({
                titulo: "¿Eliminar " + pay.label + "?",
                mensaje: "No tiene movimientos asociados. Esta acción no se puede deshacer.",
                aceptar: "Eliminar",
                peligro: true
              }).then(function (ok) {
                if (!ok) return;
                PAYMENT_METHODS = PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
                INCOME_PAYMENT_METHODS = INCOME_PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
                delete state.accountOpeningBalances[id];
                delete state.accountMetadata[id];
                rebuildIndexes();
                saveSettings();
                persist();
                preserveScroll(render);
              });

            }
          );

        }
      );

    attachDragHandlers();

  }

}

/* =========================================================
   NAVEGACIÓN
========================================================= */

/* Navegación superior: delegada para que funcione siempre aunque el contenido se vuelva a renderizar. */
function openNexoConfiguration(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (dragState.active) finishDrag(true);
  state.screen = "configuracion";
  state.settingsOpenSection = state.settingsOpenSection || "expense-categories";
  var configDropdown = document.getElementById("top-menu-dropdown");
  var configMenuToggle = document.getElementById("top-menu-btn");
  if (configDropdown) configDropdown.classList.remove("open");
  if (configMenuToggle) configMenuToggle.setAttribute("aria-expanded", "false");
  render();
}
window.openNexoConfiguration = openNexoConfiguration;

document.addEventListener("click", function (event) {
  var configMenuBtn = event.target.closest ? event.target.closest("#top-configuracion-item") : null;
  if (configMenuBtn) {
    openNexoConfiguration(event);
    return;
  }

  /* Vale tanto para las pestañas inferiores como para los elementos del menú
     "Más": lo que identifica un destino es el atributo, no la clase. */
  var btn = event.target.closest ? event.target.closest("[data-top-screen]") : null;
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  if (dragState.active) finishDrag(true);

  var targetScreen = btn.getAttribute("data-top-screen");
  if (!targetScreen) return;

  /* El calendario abre en el mes en curso con hoy seleccionado. Antes abría
     en "Selecciona un año" y hacían falta tres toques para ver este mes; el
     año y los meses siguen a un toque con "← Meses". */
  if (targetScreen === "meses" && state.screen !== "meses") {
    var hoy = new Date();
    state.calendarYear = hoy.getFullYear();
    state.calendarMonth = hoy.getMonth();
    state.calendarDay = hoy.getDate();
    state.calendarView = "month";
  }

  state.screen = targetScreen;

  var dropdown = document.getElementById("top-menu-dropdown");
  var menuBtn = document.getElementById("top-menu-btn");
  if (dropdown) dropdown.classList.remove("open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");

  render();
}, true);

document.getElementById("top-menu-btn").addEventListener("click", function (event) {
  event.stopPropagation();
  var dropdown = document.getElementById("top-menu-dropdown");
  var open = dropdown.classList.toggle("open");
  this.setAttribute("aria-expanded", open ? "true" : "false");
});

/* Accesibilidad y navegación segura: Escape cierra el menú principal y cualquier modal abierto. */
window.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  /* Con un diálogo de confirmación abierto, Escape solo cierra el diálogo
     (lo gestiona abrirDialogo); el formulario de debajo sigue abierto. */
  if (document.querySelector(".dialogo-fondo")) return;
  var dropdown = document.getElementById("top-menu-dropdown");
  var menuBtn = document.getElementById("top-menu-btn");
  if (dropdown && dropdown.classList.contains("open")) {
    dropdown.classList.remove("open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  var modalRoot = document.getElementById("generic-modal-root");
  if (modalRoot && modalRoot.innerHTML.trim()) {
    closeModal();
  }
});

document.getElementById("top-add-expense").addEventListener("click", function () {
  state.addDraft = {amount:"",note:"",category:null,subcategory:null,paymentMethod:null};
  state.screen = "add";
  document.getElementById("top-menu-dropdown").classList.remove("open");
  render();
  setTimeout(function(){ var input=document.getElementById("amount-input"); if(input) input.focus(); },0);
});

document.getElementById("top-add-income").addEventListener("click", function () {
  state.incomeDraft = {amount:"",note:"",category:null,subcategory:null,paymentMethod:null};
  state.screen = "ingresos";
  document.getElementById("top-menu-dropdown").classList.remove("open");
  render();
  setTimeout(function(){ var input=document.getElementById("income-amount-input"); if(input) input.focus(); },0);
});

document.addEventListener("click", function (event) {
  var menu=document.querySelector(".top-menu");
  var dropdown=document.getElementById("top-menu-dropdown");
  var menuBtn=document.getElementById("top-menu-btn");
  if(menu && dropdown && !menu.contains(event.target)){ dropdown.classList.remove("open"); menuBtn.setAttribute("aria-expanded","false"); }

  document.querySelectorAll(".chart-filter.open").forEach(function (wrap) {
    if (wrap.contains(event.target)) return;
    wrap.classList.remove("open");
    var toggle = wrap.querySelector("[data-chart-filter-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
  closeSettingsItemMenus(event.target);
});

/* Sin zoom. iOS no siempre respeta user-scalable=no del viewport, así que el
   pellizco se bloquea también aquí: los eventos gesture* son los de Safari y
   el touchmove con dos dedos cubre al resto. El doble toque lo evita
   touch-action: manipulation en styles.css. */
["gesturestart", "gesturechange", "gestureend"].forEach(function (tipo) {
  document.addEventListener(tipo, function (event) { event.preventDefault(); }, { passive: false });
});
document.addEventListener("touchmove", function (event) {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}, { passive: false });

/* Si el usuario hace scroll (en cualquier contenedor) mientras un menú de
   categoría/subcategoría está abierto, se cierra: al ser position:fixed,
   no acompaña el desplazamiento de la lista y podría quedar "flotando"
   lejos del botón que lo abrió. */
document.addEventListener("scroll", function () {
  closeSettingsItemMenus();
}, { capture: true, passive: true });

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

/* =========================================================
   SERVICE WORKER
========================================================= */

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    function () {

      navigator.serviceWorker
        .register(
          "./sw.js",
          {
            scope: "./",
            updateViaCache: "none"
          }
        )
        .then(
          function (registration) {

            if (
              registration.waiting
            ) {

              registration.waiting.postMessage({
                type:
                  "SKIP_WAITING"
              });

            }

          }
        )
        .catch(
          function () {}
        );

    }
  );

}

/* =========================================================
   ALMACENAMIENTO PERSISTENTE
========================================================= */

if (
  navigator.storage &&
  navigator.storage.persist
) {

  navigator.storage
    .persist()
    .catch(
      function () {}
    );

}

/* =========================================================
   INSTALACIÓN PWA
========================================================= */

var deferredPrompt = null;

var isIos =
  /iphone|ipad|ipod/
    .test(
      window.navigator.userAgent
        .toLowerCase()
    );

var isStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone === true;

window.addEventListener(
  "beforeinstallprompt",
  function (e) {

    e.preventDefault();

    deferredPrompt = e;

    if (!isStandalone) {

      document
        .getElementById(
          "install-banner"
        )
        .style.display =
        "flex";

    }

  }
);

if (
  isIos &&
  !isStandalone
) {

  document
    .getElementById(
      "install-text"
    )
    .textContent =
    'Toca Compartir y luego "Agregar a Inicio" para instalar esta app.';

  document
    .getElementById(
      "install-btn"
    )
    .style.display =
    "none";

  document
    .getElementById(
      "install-banner"
    )
    .style.display =
    "flex";

}

document
  .getElementById(
    "install-btn"
  )
  .addEventListener(
    "click",
    function () {

      if (!deferredPrompt) {
        return;
      }

      deferredPrompt
        .prompt();

      deferredPrompt
        .userChoice
        .then(
          function () {

            deferredPrompt =
              null;

            document
              .getElementById(
                "install-banner"
              )
              .style.display =
              "none";

          }
        );

    }
  );

/* =========================================================
   TEMA (claro / oscuro / seguir al sistema)

   La preferencia vive en localStorage y se traduce al atributo data-theme de
   <html>; la hoja de estilos hace el resto. index.html aplica el mismo valor
   en un script en línea antes del primer pintado, para que abrir la app en
   modo oscuro no produzca un destello blanco.
========================================================= */

var TEMA_KEY = "nexo-tema";
/* Mismo color que la franja de la barra de estado (--barra-estado). */
var TEMA_COLOR_BARRA = { claro: "#072146", oscuro: "#0E1116" };

function temaGuardado() {
  try {
    var valor = localStorage.getItem(TEMA_KEY);
    return valor === "claro" || valor === "oscuro" ? valor : "sistema";
  } catch (e) {
    return "sistema";
  }
}

function temaOscuroActivo() {
  var preferencia = temaGuardado();
  if (preferencia === "oscuro") return true;
  if (preferencia === "claro") return false;
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function aplicarTema(preferencia) {
  var raiz = document.documentElement;

  if (preferencia === "claro") raiz.setAttribute("data-theme", "light");
  else if (preferencia === "oscuro") raiz.setAttribute("data-theme", "dark");
  else raiz.removeAttribute("data-theme");

  /* La barra del navegador y la de la app instalada leen este meta: sin
     actualizarlo, en modo oscuro quedaría una franja clara arriba. */
  var meta = document.getElementById("meta-theme-color");
  if (meta) meta.setAttribute("content", temaOscuroActivo() ? TEMA_COLOR_BARRA.oscuro : TEMA_COLOR_BARRA.claro);
}

function guardarTema(preferencia) {
  try {
    if (preferencia === "sistema") localStorage.removeItem(TEMA_KEY);
    else localStorage.setItem(TEMA_KEY, preferencia);
  } catch (e) {
    /* Sin almacenamiento el tema se aplica igual, solo no se recuerda. */
  }
  aplicarTema(preferencia);
}

function temaSelectorHtml() {
  var actual = temaGuardado();
  var opciones = [
    { id: "sistema", etiqueta: "Sistema", icono: "contrast" },
    { id: "claro", etiqueta: "Claro", icono: "sun" },
    { id: "oscuro", etiqueta: "Oscuro", icono: "moon" }
  ];

  return '<div class="theme-switch" role="group" aria-label="Tema de la aplicación">' +
    opciones.map(function (opcion) {
      var activa = opcion.id === actual;
      return '<button type="button" class="theme-option' + (activa ? " is-active" : "") + '"' +
        ' data-tema="' + opcion.id + '" aria-pressed="' + (activa ? "true" : "false") + '">' +
        icon(opcion.icono, 16) +
        '<span>' + opcion.etiqueta + '</span>' +
      '</button>';
    }).join("") +
  '</div>';
}

/* Mientras la preferencia sea "sistema", seguir en vivo los cambios del
   sistema operativo (por ejemplo, el modo oscuro programado al anochecer). */
if (window.matchMedia) {
  var consultaTemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
  var alCambiarTemaDelSistema = function () {
    if (temaGuardado() === "sistema") aplicarTema("sistema");
  };
  if (consultaTemaOscuro.addEventListener) consultaTemaOscuro.addEventListener("change", alCambiarTemaDelSistema);
  else if (consultaTemaOscuro.addListener) consultaTemaOscuro.addListener(alCambiarTemaDelSistema);
}

})();
