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

