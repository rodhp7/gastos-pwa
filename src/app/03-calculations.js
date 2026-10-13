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

