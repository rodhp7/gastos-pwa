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

