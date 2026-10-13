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


