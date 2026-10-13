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
