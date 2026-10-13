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
