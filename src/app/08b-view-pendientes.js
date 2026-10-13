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
