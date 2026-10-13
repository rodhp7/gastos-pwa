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
