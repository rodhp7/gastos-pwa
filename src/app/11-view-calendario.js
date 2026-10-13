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
