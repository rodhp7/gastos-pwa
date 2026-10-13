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
