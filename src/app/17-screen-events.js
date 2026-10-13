/* =========================================================
   EVENTOS DE PANTALLA
========================================================= */

/* Abre/cierra cualquier desplegable .chart-filter (reutilizado por
   pantallas y por el modal). El cierre al hacer clic afuera ya está
   cubierto por el listener global de document. */
function attachChartFilterToggleHandlers() {
  document.querySelectorAll("[data-chart-filter-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var wrap = btn.closest(".chart-filter");
      if (!wrap) return;
      var wasOpen = wrap.classList.contains("open");
      document.querySelectorAll(".chart-filter.open").forEach(function (el) {
        el.classList.remove("open");
        var toggle = el.querySelector("[data-chart-filter-toggle]");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        wrap.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}



function recurringNextDate(dateValue, frequency) {
  var date = parseLocalDate(dateValue);
  if (isNaN(date.getTime())) date = new Date();
  var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return localDateKey(next);
}

function createPendingFromRecurring(recurring, dueDate) {
  var exists = (state.pendingPayments || []).some(function (item) {
    return item.recurringId === recurring.id && (item.occurrenceDate || item.dueDate) === dueDate;
  });
  var alreadyPaid = state.expenses.some(function (expense) {
    return expense.recurringId === recurring.id && (expense.occurrenceDate || expense.date) === dueDate;
  });
  if (exists || alreadyPaid) return false;
  state.pendingPayments.push({
    id: makeId("pending-rec"),
    name: recurring.name,
    amount: Number(recurring.amount) || 0,
    dueDate: dueDate,
    category: recurring.category,
    subcategory: recurring.subcategory || "",
    paymentMethod: recurring.paymentMethod,
    note: recurring.note || "",
    recurringId: recurring.id,
    occurrenceDate: dueDate,
    createdAt: Date.now()
  });
  return true;
}

function generateRecurringExpenses() {
  var todayKey = localDateKey(new Date());
  var changed = false;

  state.recurringExpenses.forEach(function (recurring) {
    if (!recurring.active) return;
    var cursorKey = recurring.nextDate || recurring.startDate;
    if (!cursorKey) return;
    var guard = 0;
    var processedDue = false;

    while (cursorKey <= todayKey && guard++ < 120) {
      if (createPendingFromRecurring(recurring, cursorKey)) changed = true;
      processedDue = true;
      cursorKey = recurringNextDate(cursorKey, recurring.frequency);
      recurring.nextDate = cursorKey;
      changed = true;
    }

    // Si la siguiente fecha aún es futura, dejamos un único compromiso visible.
    if (!processedDue && cursorKey > todayKey) {
      if (createPendingFromRecurring(recurring, cursorKey)) changed = true;
    }
  });

  if (changed) persist();
  return changed;
}


/* Misma estructura que pendientes y deudas: tocar la meta la edita (con
   "Eliminar" dentro) y a la vista queda solo "Añadir ahorro". */
function goalRowHtml(goal) {
  var saved = Number(goal.saved) || 0;
  var target = Number(goal.target) || 0;
  var pct = target ? Math.min(100, (saved / target) * 100) : 0;
  var plan = savingsGoalPlan(goal);
  var completada = plan.status === 'Completada';
  var planText = completada
    ? 'Meta alcanzada'
    : (plan.monthly ? 'Ahorra ' + formatSoles(plan.monthly) + ' al mes para llegar a tiempo' : Math.round(pct) + '% del objetivo');
  return '<div class="goal-row" role="button" tabindex="0" data-goal-edit="' + escapeHtml(goal.id) + '">' +
    '<div class="goal-top"><strong>' + escapeHtml(goal.name) + '</strong><span>' + formatSoles(saved) + '<small> de ' + formatSoles(target) + '</small></span></div>' +
    '<div class="budget-track"><div style="width:' + pct.toFixed(1) + '%"></div></div>' +
    '<div class="goal-foot">' +
      '<span class="goal-plan' + (plan.status === 'Atrasada' ? ' danger-text' : '') + '">' + escapeHtml(planText) + '</span>' +
      (completada ? '' : '<button type="button" class="secondary-btn goal-add-btn" data-goal-add="' + escapeHtml(goal.id) + '">Añadir ahorro</button>') +
    '</div>' +
  '</div>';
}

function renderSavingsGoals() {
  if (!Array.isArray(state.savingsGoals)) state.savingsGoals = [];
  var goals = state.savingsGoals;
  var ahorrado = goals.reduce(function (s, g) { return s + (Number(g.saved) || 0); }, 0);
  var objetivo = goals.reduce(function (s, g) { return s + (Number(g.target) || 0); }, 0);

  return '<div class="analysis-page">' +
    '<p class="analysis-kicker">Metas de ahorro</p>' +
    '<h2 class="accounts-total">' + formatSoles(ahorrado) + '</h2>' +
    '<p class="accounts-total-detail">' + (goals.length ? 'Ahorrado de ' + formatSoles(objetivo) + ' en ' + goals.length + ' meta' + (goals.length === 1 ? '' : 's') : 'Aún no tienes metas') + '</p>' +
    '<div class="accounts-actions accounts-actions-single"><button type="button" class="primary-btn" id="add-goal-btn">Nueva meta</button></div>' +
    (goals.length
      ? '<div class="tx-list goal-list">' + goals.map(goalRowHtml).join("") + '</div>' +
        '<p class="accounts-hint">Toca una meta para editarla o eliminarla.</p>'
      : '<section class="home-card"><p class="home-card-empty">Ponle nombre y cifra a un objetivo —un viaje, un fondo de emergencia— y Nexo te dirá cuánto apartar cada mes para llegar a tiempo.</p></section>') +
  '</div>';
}

function goalContributionForm(goal) {
  var restante = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Añadir ahorro</h3><button type="button" id="close-goal-add" aria-label="Cerrar">×</button></div>' +
    '<p class="modal-hint">' + escapeHtml(goal.name) + ' · faltan ' + formatSoles(restante) + '</p>' +
    '<label>Monto<input id="goal-add-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></label>' +
    '<button type="button" class="primary-btn" id="save-goal-add">Añadir</button>' +
  '</div>';
}

function savingsGoalForm() {
  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Nueva meta</h3><button type="button" id="close-goal">×</button></div>' +
    '<label>Nombre<input id="goal-name" type="text" placeholder="Viaje, fondo de emergencia..."></label>' +
    '<label>Objetivo<input id="goal-target" type="number" min="1" step="0.01" placeholder="5000"></label>' +
    '<label>Ahorrado inicialmente<input id="goal-saved" type="number" min="0" step="0.01" value="0"></label>' +
    '<label>Fecha objetivo<input id="goal-date" type="date"></label>' +
    '<button type="button" class="primary-btn" id="save-goal">Guardar</button>' +
    '</div>';
}

function renderRecurringExpenses() {
  if (!Array.isArray(state.recurringExpenses)) state.recurringExpenses = [];
  var activeRecurring = state.recurringExpenses.filter(function (item) { return item.active; });
  var monthlyEquivalent = activeRecurring.reduce(function (total, item) {
    var amount = Number(item.amount) || 0;
    if (item.frequency === "weekly") return total + amount * 52 / 12;
    if (item.frequency === "yearly") return total + amount / 12;
    return total + amount;
  }, 0);
  var currentMonth = new Date();
  var monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  var upcoming = recurringProjectedAmount(null, new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 1), monthEnd);
  var rows = state.recurringExpenses.length ? state.recurringExpenses.map(function (item) {
    var cat = categoryIndex[item.category] || {};
    var pay = paymentIndex[item.paymentMethod] || {};
    var frequency = item.frequency === "weekly" ? "Cada semana" :
      item.frequency === "yearly" ? "Cada año" : "Cada mes";

    return '<div class="recurring-row">' +
      '<div class="recurring-main">' +
        '<div class="recurring-icon">' + (cat.icon || "↻") + '</div>' +
        '<div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(frequency + " · Próximo " + (item.nextDate || item.startDate || "") + " · " + (cat.label || "") + " · " + (pay.label || "")) + '</small></div>' +
      '</div>' +
      '<div class="recurring-amount">' + formatSoles(Number(item.amount) || 0) + '</div>' +
      '<button type="button" class="icon-btn" data-recurring-edit="' + escapeHtml(item.id) + '" title="Editar gasto recurrente">' + icon("edit",16) + '</button>' +
      '<button type="button" class="icon-btn" data-recurring-toggle="' + escapeHtml(item.id) + '" title="' + (item.active ? 'Pausar' : 'Activar') + '">' + (item.active ? 'Ⅱ' : '▶') + '</button>' +
      '<button type="button" class="icon-btn" data-recurring-delete="' + escapeHtml(item.id) + '" title="Eliminar gasto recurrente">' + icon("x",16) + '</button>' +
    '</div>';
  }).join("") : '<p class="data-tools-copy">No tienes gastos recurrentes todavía.</p>';

  return '<div class="analysis-page">' +
    '<div class="analysis-head"><div><p class="analysis-kicker">Automatización</p><h2 class="analysis-title">Gastos recurrentes</h2></div>' +
    '<button type="button" class="primary-btn" id="add-recurring-btn">+ Nuevo</button></div>' +
    '<p class="data-tools-copy">Cada vencimiento se crea primero como pago pendiente. Solo afecta tus gastos y el saldo cuando lo marcas como pagado.</p>' +
    '<section class="analysis-card">' + rows + '</section>' +
    '</div>';
}



function subcategoriesOptions(categoryId, selectedId) {
  return SUBCATEGORIES
    .filter(function (s) { return (s.categoryId || s.category || s.parentCategory) === categoryId; })
    .map(function (s) {
      return '<option value="' + escapeHtml(s.id) + '"' +
        (s.id === selectedId ? ' selected' : '') + '>' +
        escapeHtml(s.label) + '</option>';
    }).join("");
}

function recurringForm(item) {
  item = item || {};
  var cats = CATEGORIES.map(function (c) {
    return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.label) + '</option>';
  }).join("");
  var recurringMethods = visiblePaymentMethods(PAYMENT_METHODS).slice();
  if (item.paymentMethod && !recurringMethods.some(function (p) { return p.id === item.paymentMethod; })) {
    var hiddenRecurringMethod = PAYMENT_METHODS.find(function (p) { return p.id === item.paymentMethod; });
    if (hiddenRecurringMethod) recurringMethods.push(hiddenRecurringMethod);
  }
  var pays = recurringMethods.map(function (p) {
    return '<option value="' + escapeHtml(p.id) + '"' + (p.id === item.paymentMethod ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
  }).join("");

  return '<div class="modal-card">' +
    '<div class="modal-header"><h3>Nuevo gasto recurrente</h3><button type="button" id="close-recurring">×</button></div>' +
    '<label>Nombre<input id="rec-name" type="text" placeholder="Netflix, alquiler, internet..."></label>' +
    '<label>Monto<input id="rec-amount" type="number" step="0.01" min="0" placeholder="0.00"></label>' +
    '<label>Frecuencia<select id="rec-frequency"><option value="monthly">Cada mes</option><option value="weekly">Cada semana</option><option value="yearly">Cada año</option></select></label>' +
    '<label>Primera fecha<input id="rec-start" type="date" value="' + localDateKey(new Date()) + '"></label>' +
    '<label>Categoría<select id="rec-category">' + cats + '</select></label>' +
    '<label>Subcategoría<select id="rec-subcategory">' + subcategoriesOptions(CATEGORIES[0] ? CATEGORIES[0].id : "") + '</select></label>' +
    '<label>Método de pago<select id="rec-payment">' + pays + '</select></label>' +
    '<label>Nota<input id="rec-note" type="text" placeholder="Opcional"></label>' +
    '<button type="button" class="primary-btn" id="save-recurring">Guardar</button>' +
    '</div>';
}


/* Antes enviaba a una pantalla "dashboard" que ya no existe y llamaba a
   showToast con un mensaje que esa función ignora, así que no se confirmaba
   nada. Ahora se queda en Configuración y avisa del resultado. */
function clearAllMovements() {
  var total = state.expenses.length + state.incomes.length;
  if (!total) {
    mostrarAviso("No hay movimientos para borrar.");
    return;
  }
  confirmar({
    titulo: "¿Borrar los " + total + " movimientos?",
    mensaje: "Se eliminan todos los gastos e ingresos. Presupuestos, metas, deudas y recurrentes se conservan. Antes de borrar se guarda una copia que puedes restaurar.",
    aceptar: "Borrar todo",
    peligro: true
  }).then(function (ok) {
    if (!ok) return;
    var copiaHecha = crearCopiaLocal(buildPayload());
    state.expenses = [];
    state.incomes = [];
    persist();
    preserveScroll(render);
    mostrarAviso("Se borraron " + total + " movimientos." + (copiaHecha ? " Puedes recuperarlos restaurando la copia más reciente." : ""));
  });
}

/* Copia en archivo. Usa el mismo paquete que el guardado local
   (buildPayload/applyPayload): antes exportar e importar llevaban su propia
   lista de campos, y cualquier campo nuevo había que recordarlo en cuatro
   sitios. El formato del archivo (data + settings) se mantiene para que las
   copias antiguas sigan importándose. */
function exportAppData() {
  var paquete = buildPayload();
  var settings = paquete.settings;
  delete paquete.settings;
  delete paquete.version;
  var archivo = {
    format: "gastos-backup",
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: paquete,
    settings: settings
  };

  var blob = new Blob([JSON.stringify(archivo, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "nexo-copia-" + localDateKey(new Date()) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  mostrarAviso("Copia descargada.");
}

function importAppData(file) {
  var reader = new FileReader();

  reader.onload = function () {
    var archivo;
    try {
      archivo = JSON.parse(reader.result);
      if (!archivo || archivo.format !== "gastos-backup" || !archivo.data || !archivo.settings ||
          !Array.isArray(archivo.data.expenses) || !Array.isArray(archivo.data.incomes)) {
        throw new Error("Formato de copia no válido");
      }
    } catch (error) {
      avisar("No se pudo importar: el archivo no es una copia de Nexo válida.");
      return;
    }

    confirmar({
      titulo: "¿Importar esta copia?",
      mensaje: "Reemplaza tus datos actuales por los del archivo (" + archivo.data.expenses.length + " gastos y " + archivo.data.incomes.length + " ingresos). Antes se guarda una copia de lo que tienes ahora.",
      aceptar: "Importar"
    }).then(function (ok) {
      if (!ok) return;

      /* Antes de reemplazar, se guarda una copia de lo actual para poder
         volver atrás desde Datos y respaldo. */
      crearCopiaLocal(buildPayload());

      var datos = migrateData(Object.assign({}, archivo.data, {
        version: archivo.version,
        settings: archivo.settings
      }));
      if (!datos.budgets || typeof datos.budgets !== "object") datos.budgets = Object.assign({}, DEFAULT_BUDGETS);
      applyPayload(datos);
      sanitizeSubcategories();
      ensureFixedFinanceMethods();
      normalizePaymentMethodOrder();
      rebuildIndexes();
      normalizeState();
      saveSettings();
      persist();
      state.screen = "home";
      render();
      mostrarAviso("Copia importada. Tus datos anteriores quedaron en Copias automáticas.");
    });
  };

  reader.readAsText(file);
}

function attachScreenHandlers() {

  /* Los menús de acciones (⋮ categorías/subcategorías, cuentas, etc.) usan
     delegación única a nivel de documento, independiente de la pantalla
     activa, para que funcionen también en elementos creados dinámicamente
     y evitar controladores duplicados. */
  if (!document.documentElement.dataset.settingsMenuDelegatedV2) {
    document.documentElement.dataset.settingsMenuDelegatedV2 = "1";
    document.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("[data-item-menu-toggle]") : null;
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        var menuId = btn.getAttribute("data-item-menu-toggle");
        var dropdown = Array.from(document.querySelectorAll("[data-item-menu-dropdown]")).find(function (node) { return node.getAttribute("data-item-menu-dropdown") === menuId; });
        if (!dropdown) return;
        var isOpen = dropdown.classList.contains("open");
        if (isOpen) closeSettingsItemMenu(dropdown, btn); else openSettingsItemMenu(btn, dropdown);
        return;
      }
      var option = event.target.closest ? event.target.closest(".settings-item-menu-option") : null;
      if (option) {
        closeSettingsItemMenus();
        return;
      }
      if (!event.target.closest || !event.target.closest(".settings-item-menu-dropdown")) closeSettingsItemMenus();
    }, true);
    document.addEventListener("keydown", function(event){ if(event.key === "Escape") closeSettingsItemMenus(); }, true);
    document.addEventListener("scroll", function(){ if(hasOpenSettingsMenu) closeSettingsItemMenus(); }, true);
    window.addEventListener("resize", function(){ if(hasOpenSettingsMenu) closeSettingsItemMenus(); });
  }

  if (state.screen === "pendientes") {
    function bindPendingForm(item) {
      item = item || null;
      openModal(pendingPaymentForm(item));
      var close = document.getElementById("close-pending");
      if (close) close.addEventListener("click", closeModal);
      var categoryEl = document.getElementById("pending-category");
      var subcategoryEl = document.getElementById("pending-subcategory");
      if (categoryEl && subcategoryEl) categoryEl.addEventListener("change", function () {
        subcategoryEl.innerHTML = '<option value="">Sin subcategoría</option>' + subcategoriesOptions(this.value);
      });
      var save = document.getElementById("save-pending");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("pending-name").value.trim();
        var amount = normalizeAmount(document.getElementById("pending-amount").value);
        var dueDate = document.getElementById("pending-date").value || localDateKey(new Date());
        var category = document.getElementById("pending-category").value;
        var subcategory = document.getElementById("pending-subcategory").value || "";
        var paymentMethod = document.getElementById("pending-payment").value;
        var note = document.getElementById("pending-note").value.trim();
        if (!name) { avisar("Escribe un nombre para el pago."); return; }
        if (!amount) { avisar("Ingresa un monto válido."); return; }
        if (item) {
          var oldOccurrenceDate = item.occurrenceDate || item.dueDate;
          item.name = name; item.amount = amount; item.dueDate = dueDate; item.category = category;
          item.subcategory = subcategory; item.paymentMethod = paymentMethod; item.note = note;
          if (item.recurringId) {
            var recurringEdit = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
            if (recurringEdit && recurringEdit.nextDate === oldOccurrenceDate) recurringEdit.nextDate = dueDate;
            item.occurrenceDate = dueDate;
          }
        } else {
          state.pendingPayments.push({ id: makeId("pending"), name: name, amount: amount, dueDate: dueDate, category: category, subcategory: subcategory, paymentMethod: paymentMethod, note: note, createdAt: Date.now() });
        }
        persist(); closeModal(); render();
      });
      var remove = document.getElementById("delete-pending");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar este pago pendiente?",
          mensaje: item.name + " · " + formatSoles(item.amount) + (item.recurringId ? ". Se omite solo esta vez; el recurrente sigue activo." : "."),
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          /* Si viene de un gasto recurrente, se salta esa ocurrencia para que
             no vuelva a generarse en el siguiente arranque. */
          if (item.recurringId) {
            var recurringSkipped = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
            var skippedOccurrence = item.occurrenceDate || item.dueDate;
            if (recurringSkipped && recurringSkipped.nextDate === skippedOccurrence) recurringSkipped.nextDate = recurringNextDate(skippedOccurrence, recurringSkipped.frequency);
          }
          state.pendingPayments = state.pendingPayments.filter(function (x) { return x.id !== item.id; });
          persist(); closeModal(); render();
        });
      });
    }

    var addPendingBtn = document.getElementById("add-pending-btn");
    if (addPendingBtn) addPendingBtn.addEventListener("click", function () { bindPendingForm(null); });

    document.querySelectorAll("[data-edit-pending]").forEach(function (row) {
      onRowActivate(row, function () {
        var item = (state.pendingPayments || []).find(function (x) { return x.id === row.getAttribute("data-edit-pending"); });
        if (item) bindPendingForm(item);
      });
    });

    document.querySelectorAll("[data-pay-pending]").forEach(function(button){
      button.addEventListener("click",function(){
        var id=this.getAttribute("data-pay-pending");
        var item=(state.pendingPayments||[]).find(function(x){return x.id===id;});
        if(!item)return;
        var now=new Date();
        state.expenses.unshift({ id:makeId("expense"), amount:item.amount, date:localDateKey(now), createdAt:now.getTime(), category:item.category, subcategory:item.subcategory||"", paymentMethod:item.paymentMethod, note:item.note||item.name, recurringId:item.recurringId||undefined, occurrenceDate:item.occurrenceDate||item.dueDate });
        if (item.recurringId) {
          var recurringPaid = state.recurringExpenses.find(function (r) { return r.id === item.recurringId; });
          var paidOccurrence = item.occurrenceDate || item.dueDate;
          if (recurringPaid && recurringPaid.nextDate === paidOccurrence) recurringPaid.nextDate = recurringNextDate(paidOccurrence, recurringPaid.frequency);
        }
        state.pendingPayments=state.pendingPayments.filter(function(x){return x.id!==id;});
        generateRecurringExpenses();
        persist(); render();
      });
    });
  }

  if (state.screen === "deudas") {
    function bindDebtForm(item, defaultDirection) {
      item = item || null;
      openModal(debtForm(item, defaultDirection));

      var close = document.getElementById("close-debt");
      if (close) close.addEventListener("click", closeModal);

      var directionEl = document.getElementById("debt-direction");
      if (directionEl) directionEl.addEventListener("change", function () {
        var draft = item ? Object.assign({}, item) : {};
        draft.direction = this.value;
        draft.name = document.getElementById("debt-name").value;
        draft.principal = document.getElementById("debt-principal").value;
        draft.balance = document.getElementById("debt-balance").value;
        bindDebtForm(draft, this.value);
      });

      var categoryEl = document.getElementById("debt-category");
      var subcategoryEl = document.getElementById("debt-subcategory");
      if (categoryEl && subcategoryEl) categoryEl.addEventListener("change", function () {
        subcategoryEl.innerHTML = '<option value="">Sin subcategoría</option>' + subcategoriesOptions(this.value);
      });

      var save = document.getElementById("save-debt");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("debt-name").value.trim();
        var direction = document.getElementById("debt-direction").value;
        var principal = normalizeAmount(document.getElementById("debt-principal").value);
        var balanceInput = document.getElementById("debt-balance").value;
        var balance = balanceInput === "" ? principal : normalizeAmount(balanceInput);
        var interestRate = Math.max(0, Number(document.getElementById("debt-interest").value) || 0);
        var minPayment = normalizeAmount(document.getElementById("debt-min-payment").value);
        var dueDate = document.getElementById("debt-due-date").value || "";
        var category = document.getElementById("debt-category").value;
        var subcategoryEl2 = document.getElementById("debt-subcategory");
        var subcategory = subcategoryEl2 ? subcategoryEl2.value : "";
        var paymentMethod = document.getElementById("debt-payment").value || "";
        var note = document.getElementById("debt-note").value.trim();

        if (!name) { avisar("Escribe un nombre para la deuda."); return; }
        if (!principal) { avisar("Ingresa un monto total válido."); return; }
        if (balance > principal) { avisar("El saldo pendiente no puede ser mayor al monto total."); return; }

        if (item && item.id) {
          item.name = name; item.direction = direction; item.principal = principal; item.balance = balance;
          item.interestRate = interestRate; item.minPayment = minPayment; item.dueDate = dueDate;
          item.category = category; item.subcategory = subcategory; item.paymentMethod = paymentMethod; item.note = note;
        } else {
          state.debts.push(normalizeDebt({
            name: name, direction: direction, principal: principal, balance: balance,
            interestRate: interestRate, minPayment: minPayment, dueDate: dueDate,
            category: category, subcategory: subcategory, paymentMethod: paymentMethod, note: note
          }));
        }
        persist(); closeModal(); render();
      });
      var remove = document.getElementById("delete-debt");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar esta deuda?",
          mensaje: item.name + ". Los pagos ya registrados se conservan como movimientos.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.debts = state.debts.filter(function (x) { return x.id !== item.id; });
          persist(); closeModal(); render();
        });
      });
    }

    var addDebtOweBtn = document.getElementById("add-debt-owe-btn");
    if (addDebtOweBtn) addDebtOweBtn.addEventListener("click", function () { bindDebtForm(null, "owe"); });
    var addDebtOwedBtn = document.getElementById("add-debt-owed-btn");
    if (addDebtOwedBtn) addDebtOwedBtn.addEventListener("click", function () { bindDebtForm(null, "owed"); });

    document.querySelectorAll("[data-edit-debt]").forEach(function (row) {
      onRowActivate(row, function () {
        var item = (state.debts || []).find(function (x) { return x.id === row.getAttribute("data-edit-debt"); });
        if (item) bindDebtForm(item);
      });
    });

    document.querySelectorAll("[data-pay-debt]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-pay-debt");
        var debt = (state.debts || []).find(function (x) { return x.id === id; });
        if (!debt) return;

        openModal(debtPaymentForm(debt));
        var close = document.getElementById("close-debt-payment");
        if (close) close.addEventListener("click", closeModal);

        var save = document.getElementById("save-debt-payment");
        if (save) save.addEventListener("click", function () {
          var amount = normalizeAmount(document.getElementById("debt-payment-amount").value);
          var date = document.getElementById("debt-payment-date").value || localDateKey(new Date());
          var note = document.getElementById("debt-payment-note").value.trim();
          if (!amount) { avisar("Ingresa un monto válido."); return; }
          amount = Math.min(amount, debt.balance);

          var isExpenseSide = debt.direction === "owe";
          var fallbackMethod = isExpenseSide
            ? (PAYMENT_METHODS[0] ? PAYMENT_METHODS[0].id : "")
            : (INCOME_PAYMENT_METHODS[0] ? INCOME_PAYMENT_METHODS[0].id : "");
          var paymentMethod = debt.paymentMethod || fallbackMethod;
          var noteText = (note ? note + " · " : "") + debt.name;

          if (isExpenseSide) {
            state.expenses.unshift({ id: makeId("expense"), amount: amount, date: date, createdAt: Date.now(), category: debt.category || (CATEGORIES[0] ? CATEGORIES[0].id : ""), subcategory: debt.subcategory || "", paymentMethod: paymentMethod, note: noteText, debtId: debt.id });
          } else {
            state.incomes.unshift({ id: makeId("income"), amount: amount, date: date, createdAt: Date.now(), category: debt.category || (INCOME_CATEGORIES[0] ? INCOME_CATEGORIES[0].id : ""), subcategory: debt.subcategory || "", paymentMethod: paymentMethod, note: noteText, debtId: debt.id });
          }

          debt.balance = Math.max(0, debt.balance - amount);
          persist(); closeModal(); render();
        });
      });
    });
  }

  if (state.screen === "cuentas") {
    document.querySelectorAll("[data-account-longpress]").forEach(function (card) {
      attachLongPress(card, function (target) {
        var id = target.getAttribute("data-account-longpress");
        var dropdown = document.querySelector('[data-item-menu-dropdown="account-' + id + '"]');
        if (dropdown) openSettingsItemMenu(target, dropdown);
      });
    });

    var addAccountBtn = document.getElementById("add-account-btn");
    if (addAccountBtn) addAccountBtn.addEventListener("click", function () {
      openModal(accountForm());
      var closeAccount = document.getElementById("close-account");
      if (closeAccount) closeAccount.addEventListener("click", closeModal);
      var saveAccount = document.getElementById("save-account");
      if (saveAccount) saveAccount.addEventListener("click", function () {
        var baseId = document.getElementById("account-base").value;
        var base = DEFAULT_PAYMENT_METHODS.find(function (p) { return p.id === baseId; }) || DEFAULT_PAYMENT_METHODS[0] || { color: "#77746b" };
        var name = document.getElementById("account-name").value.trim();
        var opening = Number(document.getElementById("account-opening").value) || 0;
        if (!name) { avisar("Escribe un nombre para la cuenta."); return; }
        var id = "account-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
        var method = { id: id, label: name, color: base.color || "#77746b", icon: base.icon || "bank" };
        PAYMENT_METHODS.push(method);
        INCOME_PAYMENT_METHODS.push(Object.assign({}, method));
        state.accountOpeningBalances[id] = opening;
        state.accountMetadata[id] = { custom: true, hidden: false, baseId: baseId };
        normalizePaymentMethodOrder(); rebuildIndexes(); saveSettings(); persist(); closeModal(); render();
      });
    });

    document.querySelectorAll("[data-toggle-account-hidden]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-toggle-account-hidden");
        if (!state.accountMetadata[id]) state.accountMetadata[id] = {};
        var hiding = !isAccountHidden(id);
        if (hiding && visiblePaymentMethods(PAYMENT_METHODS).length <= 1) { avisar("Debe quedar al menos una cuenta visible."); return; }
        state.accountMetadata[id].hidden = hiding;
        persist(); render();
      });
    });

    document.querySelectorAll("[data-delete-account]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-delete-account");
        var method = PAYMENT_METHODS.find(function (p) { return p.id === id; });
        if (!method) return;
        if (!isAccountHidden(id) && visiblePaymentMethods(PAYMENT_METHODS).length <= 1) {
          avisar("Debe quedar al menos una cuenta visible.");
          return;
        }
        var expenseCount = state.expenses.filter(function (x) { return x.paymentMethod === id; }).length;
        var incomeCount = state.incomes.filter(function (x) { return x.paymentMethod === id; }).length;
        var transferCount = (state.transfers || []).filter(function (x) { return x.fromAccount === id || x.toAccount === id; }).length;
        var pendingCount = (state.pendingPayments || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var recurringCount = (state.recurringExpenses || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var debtCount = (state.debts || []).filter(function (x) { return x.paymentMethod === id; }).length;
        var linked = expenseCount + incomeCount + transferCount + pendingCount + recurringCount + debtCount;
        if (linked > 0) {
          avisar("No se puede eliminar esta cuenta porque todavía está vinculada a " + linked + " registro" + (linked === 1 ? "" : "s") + ". Elimina o cambia primero esos movimientos, transferencias o pagos.");
          return;
        }
        confirmar({
          titulo: "¿Eliminar la cuenta " + method.label + "?",
          mensaje: "Esta acción no se puede deshacer.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          PAYMENT_METHODS = PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
          INCOME_PAYMENT_METHODS = INCOME_PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
          delete state.accountOpeningBalances[id];
          delete state.accountMetadata[id];
          normalizePaymentMethodOrder(); rebuildIndexes(); saveSettings(); persist(); render();
        });
      });
    });

    function bindTransferForm(item) {
      openModal(transferForm(item));
      var close = document.getElementById("close-transfer");
      if (close) close.addEventListener("click", closeModal);
      var save = document.getElementById("save-transfer");
      if (save) save.addEventListener("click", function () {
        var fromId = document.getElementById("transfer-from").value;
        var toId = document.getElementById("transfer-to").value;
        var amount = normalizeAmount(document.getElementById("transfer-amount").value);
        var date = document.getElementById("transfer-date").value || localDateKey(new Date());
        var note = document.getElementById("transfer-note").value.trim();
        if (!amount) { avisar("Ingresa un monto válido."); return; }
        if (fromId === toId) { avisar("Elige dos cuentas diferentes."); return; }
        if (item) {
          item.fromAccount = fromId;
          item.toAccount = toId;
          item.amount = amount;
          item.date = date;
          item.note = note;
        } else {
          state.transfers.unshift({ id: makeId("transfer"), amount: amount, date: date, fromAccount: fromId, toAccount: toId, note: note, createdAt: Date.now() });
        }
        persist();
        closeModal();
        render();
      });
      var remove = document.getElementById("delete-transfer");
      if (remove && item) remove.addEventListener("click", function () {
        confirmar({
          titulo: "¿Eliminar esta transferencia?",
          mensaje: formatSoles(item.amount) + ". Los saldos de ambas cuentas vuelven a como estaban.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.transfers = state.transfers.filter(function (x) { return x.id !== item.id; });
          persist();
          closeModal();
          render();
        });
      });
    }

    var addTransferBtn = document.getElementById("add-transfer-btn");
    if (addTransferBtn) addTransferBtn.addEventListener("click", function () { bindTransferForm(null); });

    document.querySelectorAll("[data-edit-transfer]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-edit-transfer");
        var item = (state.transfers || []).find(function (x) { return x.id === id; });
        if (item) bindTransferForm(item);
      });
    });

    document.querySelectorAll("[data-account-adjust]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-account-adjust");
        var method = paymentIndex[id];
        if (!method) return;
        openModal(adjustBalanceForm(method));
        var close = document.getElementById("close-adjust-balance");
        if (close) close.addEventListener("click", closeModal);
        var input = document.getElementById("adjust-balance-value");
        if (input) { input.focus(); input.select(); }
        function save() {
          var targetBalance = Number(input && input.value);
          if (!input || input.value.trim() === "" || !Number.isFinite(targetBalance)) { avisar("Ingresa un saldo válido."); return; }
          var redondeado = Math.round(targetBalance * 100) / 100;
          state.accountOpeningBalances[id] = Math.round((accountOpeningBalance(id) + redondeado - accountBalance(id)) * 100) / 100;
          persist();
          closeModal();
          render();
        }
        var saveBtn = document.getElementById("save-adjust-balance");
        if (saveBtn) saveBtn.addEventListener("click", save);
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") save(); });
      });
    });
  }
  var openAccountsHome = document.getElementById("open-accounts-home");
  if (openAccountsHome) openAccountsHome.addEventListener("click", function () { state.screen = "cuentas"; render(); });

  var recurringFromExpenses = document.getElementById("open-recurring-from-expenses");
  if (recurringFromExpenses) recurringFromExpenses.addEventListener("click", function () {
    state.screen = "recurrentes";
    render();
  });

  document.querySelectorAll("[data-movement-detail-kind][data-movement-detail-id]").forEach(function (row) {
    function openDetail(event) {
      if (event && event.type === "click" && event.target.closest && event.target.closest("button,a,.settings-item-menu")) return;
      if (event && event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      if (event && event.type === "keydown") event.preventDefault();
      var kind = row.getAttribute("data-movement-detail-kind");
      var id = row.getAttribute("data-movement-detail-id");
      var item = findMovement(id, kind);
      if (!item) return;
      openModal(movementDetailModalHtml(kind, item));
      var close = document.getElementById("close-movement-detail");
      if (close) close.addEventListener("click", closeModal);
      var edit = document.getElementById("detail-edit-movement");
      if (edit) edit.addEventListener("click", function () {
        closeModal();
        if (kind === "income") {
          state.editingType = "income"; state.editingId = item.id;
          state.incomeDraft = { amount: String(item.amount), note: item.note || "", category: item.category, subcategory: item.subcategory || null, paymentMethod: item.paymentMethod };
          state.screen = "ingresos";
        } else {
          state.editingType = "expense"; state.editingId = item.id;
          state.addDraft = { amount: String(item.amount), note: item.note || "", category: item.category, subcategory: item.subcategory || null, paymentMethod: item.paymentMethod };
          state.screen = "add";
        }
        render();
      });
      var duplicate = document.getElementById("detail-duplicate-movement");
      if (duplicate) duplicate.addEventListener("click", function () { closeModal(); duplicateMovement(kind, item.id); });
      var del = document.getElementById("detail-delete-movement");
      if (del) del.addEventListener("click", function () {
        closeModal();
        if (kind === "income") deleteIncome(item.id, { skipConfirm: false });
        else deleteExpense(item.id, { skipConfirm: false });
      });
    }
    row.addEventListener("click", openDetail);
    row.addEventListener("keydown", openDetail);
  });

  var clearMovementsBtn=document.getElementById("clear-movements-btn");
  if(clearMovementsBtn)clearMovementsBtn.addEventListener("click",clearAllMovements);


  if (state.screen === "metas") {
    var addGoalBtn = document.getElementById("add-goal-btn");
    if (addGoalBtn) addGoalBtn.addEventListener("click", function () {
      openModal(savingsGoalForm());
      var closeGoal = document.getElementById("close-goal");
      if (closeGoal) closeGoal.addEventListener("click", closeModal);
      var saveGoal = document.getElementById("save-goal");
      if (saveGoal) saveGoal.addEventListener("click", function () {
        var name = (document.getElementById("goal-name").value || "").trim();
        var target = Number(document.getElementById("goal-target").value);
        var saved = Number(document.getElementById("goal-saved").value || 0);
        if (!name || !target || target <= 0 || saved < 0) {
          avisar("Completa el nombre y un objetivo válido.");
          return;
        }
        state.savingsGoals.push({
          id: "goal-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
          name: name,
          target: normalizeAmount(target),
          saved: normalizeAmount(saved),
          targetDate: (document.getElementById('goal-date').value || ''),
          createdAt: Date.now(),
          contributions: saved > 0 ? [{amount: normalizeAmount(saved), createdAt: Date.now()}] : []
        });
        persist();
        closeModal();
        render();
      });
    });

    document.querySelectorAll("[data-goal-edit]").forEach(function (row) {
      onRowActivate(row, function () {
        var id = row.getAttribute("data-goal-edit");
        var goal = state.savingsGoals.find(function (item) { return item.id === id; });
        if (!goal) return;
        openModal('<div class="modal-card"><div class="modal-header"><h3>Editar meta</h3><button type="button" id="close-goal-edit" aria-label="Cerrar">×</button></div>' +
          '<label>Nombre<input id="edit-goal-name" type="text" value="' + escapeHtml(goal.name) + '"></label>' +
          '<label>Objetivo<input id="edit-goal-target" type="number" min="1" step="0.01" value="' + escapeHtml(goal.target) + '"></label>' +
          '<label>Fecha objetivo<input id="edit-goal-date" type="date" value="' + escapeHtml(goal.targetDate || '') + '"></label>' +
          '<button type="button" class="primary-btn" id="save-goal-edit">Guardar</button>' +
          '<button type="button" class="secondary-btn danger-btn modal-secondary-action" id="delete-goal">Eliminar meta</button></div>');
        document.getElementById("close-goal-edit").addEventListener("click", closeModal);
        document.getElementById("save-goal-edit").addEventListener("click", function () {
          var name = document.getElementById("edit-goal-name").value.trim();
          var target = Number(document.getElementById("edit-goal-target").value);
          if (!name || !target || target <= 0) { avisar("Completa un nombre y un objetivo válido."); return; }
          goal.name = name; goal.target = normalizeAmount(target); goal.targetDate = document.getElementById('edit-goal-date').value || ''; goal.saved = Math.min(normalizeAmount(goal.saved), goal.target);
          persist(); closeModal(); render();
        });
        document.getElementById("delete-goal").addEventListener("click", function () {
          confirmar({
            titulo: "¿Eliminar la meta " + goal.name + "?",
            mensaje: "Se pierde el registro de lo ahorrado en ella.",
            aceptar: "Eliminar",
            peligro: true
          }).then(function (ok) {
            if (!ok) return;
            state.savingsGoals = state.savingsGoals.filter(function (item) { return item.id !== id; });
            persist(); closeModal(); render();
          });
        });
      });
    });

    document.querySelectorAll("[data-goal-add]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-goal-add");
        var goal = state.savingsGoals.find(function (item) { return item.id === id; });
        if (!goal) return;
        openModal(goalContributionForm(goal));
        var input = document.getElementById("goal-add-amount");
        if (input) input.focus();
        document.getElementById("close-goal-add").addEventListener("click", closeModal);
        function guardar() {
          var amount = Number(input && input.value);
          if (!amount || amount <= 0) { avisar("Ingresa un monto válido."); return; }
          var remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
          amount = Math.min(amount, remaining);
          goal.saved = normalizeAmount((Number(goal.saved) || 0) + amount);
          if (!Array.isArray(goal.contributions)) goal.contributions = [];
          if (amount > 0) goal.contributions.push({ amount: normalizeAmount(amount), createdAt: Date.now() });
          persist(); closeModal(); render();
        }
        document.getElementById("save-goal-add").addEventListener("click", guardar);
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") guardar(); });
      });
    });
  }

  if (state.screen === "recurrentes") {
    var addRecurringBtn = document.getElementById("add-recurring-btn");
    if (addRecurringBtn) addRecurringBtn.addEventListener("click", function () {
      openModal(recurringForm());
      var close = document.getElementById("close-recurring");
      if (close) close.addEventListener("click", closeModal);

      
      var recurringCategory = document.getElementById("rec-category");
      var recurringSubcategory = document.getElementById("rec-subcategory");
      if (recurringCategory && recurringSubcategory) {
        recurringCategory.addEventListener("change", function () {
          recurringSubcategory.innerHTML = subcategoriesOptions(this.value);
        });
      }

var save = document.getElementById("save-recurring");
      if (save) save.addEventListener("click", function () {
        var name = document.getElementById("rec-name").value.trim();
        var amount = Number(document.getElementById("rec-amount").value);
        var startDate = document.getElementById("rec-start").value;

        if (!name || !amount || amount <= 0 || !startDate) {
          avisar("Completa el nombre, monto y fecha.");
          return;
        }

        state.recurringExpenses.push({
          id: "recurring-" + Date.now(),
          name: name,
          amount: amount,
          frequency: document.getElementById("rec-frequency").value,
          startDate: startDate,
          nextDate: startDate,
          category: document.getElementById("rec-category").value,
          subcategory: document.getElementById("rec-subcategory").value,
          paymentMethod: document.getElementById("rec-payment").value,
          note: document.getElementById("rec-note").value.trim(),
          active: true
        });

        persist();
        closeModal();
        generateRecurringExpenses();
        render();
      });
    });

    document.querySelectorAll("[data-recurring-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = this.getAttribute("data-recurring-edit");
        var item = state.recurringExpenses.find(function (r) { return r.id === id; });
        if (!item) return;
        openModal(recurringForm(item).replace("Nuevo gasto recurrente", "Editar gasto recurrente"));
        document.getElementById("rec-name").value = item.name || "";
        document.getElementById("rec-amount").value = item.amount || "";
        document.getElementById("rec-frequency").value = item.frequency || "monthly";
        document.getElementById("rec-start").value = item.startDate || localDateKey(new Date());
        document.getElementById("rec-category").value = item.category || (CATEGORIES[0] && CATEGORIES[0].id) || "";
        document.getElementById("rec-subcategory").innerHTML = subcategoriesOptions(document.getElementById("rec-category").value, item.subcategory || "");
        document.getElementById("rec-payment").value = item.paymentMethod || (PAYMENT_METHODS[0] && PAYMENT_METHODS[0].id) || "";
        document.getElementById("rec-note").value = item.note || "";
        document.getElementById("close-recurring").addEventListener("click", closeModal);
        document.getElementById("rec-category").addEventListener("change", function () { document.getElementById("rec-subcategory").innerHTML = subcategoriesOptions(this.value); });
        document.getElementById("save-recurring").addEventListener("click", function () {
          var name = document.getElementById("rec-name").value.trim();
          var amount = Number(document.getElementById("rec-amount").value);
          var startDate = document.getElementById("rec-start").value;
          if (!name || !amount || amount <= 0 || !startDate) { avisar("Completa el nombre, monto y fecha."); return; }
          item.name = name; item.amount = normalizeAmount(amount); item.frequency = document.getElementById("rec-frequency").value; item.startDate = startDate; item.category = document.getElementById("rec-category").value; item.subcategory = document.getElementById("rec-subcategory").value; item.paymentMethod = document.getElementById("rec-payment").value; item.note = document.getElementById("rec-note").value.trim();
          state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== item.id; });
          item.nextDate = startDate;
          persist(); closeModal(); generateRecurringExpenses(); render();
        });
      });
    });

    document.querySelectorAll("[data-recurring-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = state.recurringExpenses.find(function (r) { return r.id === button.getAttribute("data-recurring-toggle"); });
        if (!item) return;
        item.active = !item.active;
        if (!item.active) state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== item.id; });
        persist();
        if (item.active) generateRecurringExpenses();
        render();
      });
    });

    document.querySelectorAll("[data-recurring-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-recurring-delete");
        var item = state.recurringExpenses.find(function (r) { return r.id === id; });
        if (!item) return;
        confirmar({
          titulo: "¿Eliminar el gasto recurrente " + item.name + "?",
          mensaje: "Se quitan también sus pagos pendientes. Los gastos ya pagados se conservan.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.recurringExpenses = state.recurringExpenses.filter(function (r) { return r.id !== id; });
          state.pendingPayments = (state.pendingPayments || []).filter(function (pending) { return pending.recurringId !== id; });
          // Los gastos ya pagados se conservan como historial.
          persist(); render();
        });
      });
    });
  }



  if (state.screen === "analisis") {
    var analysisPrev = document.querySelector("[data-analysis-prev]");
    var analysisNext = document.querySelector("[data-analysis-next]");

    if (analysisPrev) analysisPrev.addEventListener("click", function () {
      var d = new Date(state.analysisYear, state.analysisMonth - 1, 1);
      state.analysisYear = d.getFullYear();
      state.analysisMonth = d.getMonth();
      persist();
      render();
    });

    if (analysisNext) analysisNext.addEventListener("click", function () {
      var d = new Date(state.analysisYear, state.analysisMonth + 1, 1);
      state.analysisYear = d.getFullYear();
      state.analysisMonth = d.getMonth();
      persist();
      render();
    });
  }



  attachChartFilterToggleHandlers();

  /* =========================
     AGREGAR GASTO
  ========================= */

  if (state.screen === "add") {

    function syncAddDraftFromInputs() {

      var amountInput =
        document.getElementById(
          "amount-input"
        );

      var noteInput =
        document.getElementById(
          "note-input"
        );

      if (amountInput) {

        state.addDraft.amount =
          amountInput.value;

      }

      if (noteInput) {

        state.addDraft.note =
          noteInput.value;

      }

    }

    document
      .getElementById("cancel-add")
      .addEventListener(
        "click",
        function () {

          state.addDraft = {
            amount: "",
            note: "",
            category: null,
            subcategory: null,
            paymentMethod: null
          };
          state.editingType = null;
          state.editingId = null;

          state.screen =
            "home";

          render();

        }
      );

    document
      .querySelectorAll(
        "#cat-group .cat-chip"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              syncAddDraftFromInputs();

              state.addDraft.category =
                btn.getAttribute(
                  "data-cat"
                );

              state.addDraft.subcategory = null;

              render();

            }
          );

        }
      );

    document.querySelectorAll("[data-add-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncAddDraftFromInputs();
        var val = btn.getAttribute("data-add-subcategory");
        state.addDraft.subcategory = val === "todos" ? null : val;
        render();
      });
    });

    document
      .querySelectorAll(
        "#pay-group .cat-chip"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              syncAddDraftFromInputs();

              state.addDraft.paymentMethod =
                btn.getAttribute(
                  "data-pay"
                );

              render();

            }
          );

        }
      );

    document
      .getElementById(
        "save-expense-btn"
      )
      .addEventListener(
        "click",
        function () {

          syncAddDraftFromInputs();

          var amountVal =
            state.addDraft.amount;

          var noteVal =
            state.addDraft.note;

          var amount =
            parseFloat(amountVal);

          var ok = true;

          if (
            !amountVal ||
            isNaN(amount) ||
            amount <= 0
          ) {

            document
              .getElementById(
                "amount-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!state.addDraft.category) {

            document
              .getElementById(
                "cat-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!state.addDraft.paymentMethod) {

            document
              .getElementById(
                "pay-error"
              )
              .style.display =
              "block";

            ok = false;

          }

          if (!ok) {
            return;
          }

          var expenseData = {
            amount: amount,
            category: state.addDraft.category,
            subcategory: state.addDraft.subcategory || null,
            paymentMethod: state.addDraft.paymentMethod,
            note: noteVal.trim()
          };

          if (state.editingType === "expense" && state.editingId) {
            var existingExpense = findMovement(state.editingId, "expense");
            if (existingExpense) {
              Object.assign(existingExpense, expenseData);
            }
          } else {
            var createdNow = new Date();
            state.expenses.unshift(Object.assign({ id: makeId("expense"), date: localDateKey(createdNow), createdAt: createdNow.getTime() }, expenseData));
          }

          persist();

          state.editingType = null;
          state.editingId = null;

          state.addDraft = {

            amount: "",
            note: "",
            category: null,
            subcategory: null,
            paymentMethod: null

          };

          state.screen =
            "home";

          render();

        }
      );

  }

  /* =========================
     INGRESOS
  ========================= */

  else if (state.screen === "ingresos") {
    var amountInput = document.getElementById("income-amount-input");
    var noteInput = document.getElementById("income-note-input");

    function syncIncomeDraftFromInputs() {
      var amountInput = document.getElementById("income-amount-input");
      var noteInput = document.getElementById("income-note-input");

      if (amountInput) {
        state.incomeDraft.amount = amountInput.value;
      }

      if (noteInput) {
        state.incomeDraft.note = noteInput.value;
      }
    }

    if (amountInput) {
      amountInput.value = state.incomeDraft.amount || "";
      amountInput.addEventListener("input", function () {
        state.incomeDraft.amount = amountInput.value;
      });
    }
    if (noteInput) {
      noteInput.value = state.incomeDraft.note || "";
      noteInput.addEventListener("input", function () {
        state.incomeDraft.note = noteInput.value;
      });
    }

    var cancelIncome = document.getElementById("cancel-income");
    if (cancelIncome) {
      cancelIncome.addEventListener("click", function () {
        state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
        state.screen = "home";
        render();
      });
    }

    document.querySelectorAll("[data-income-category]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        state.incomeDraft.category = btn.getAttribute("data-income-category");
        state.incomeDraft.subcategory = null;
        render();
      });
    });

    document.querySelectorAll("[data-income-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        var val = btn.getAttribute("data-income-subcategory");
        state.incomeDraft.subcategory = val === "todos" ? null : val;
        render();
      });
    });


    document.querySelectorAll("[data-income-payment]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        state.incomeDraft.paymentMethod = btn.getAttribute("data-income-payment");
        render();
      });
    });

    var saveIncome = document.getElementById("save-income-btn");
    if (saveIncome) {
      saveIncome.addEventListener("click", function () {
        syncIncomeDraftFromInputs();
        var amount = parseFloat(state.incomeDraft.amount);
        var ok = true;
        document.getElementById("income-error").style.display = "none";
        document.getElementById("income-category-error").style.display = "none";
        document.getElementById("income-payment-error").style.display = "none";

        if (!state.incomeDraft.amount || isNaN(amount) || amount <= 0) {
          document.getElementById("income-error").style.display = "block";
          ok = false;
        }
        if (!state.incomeDraft.category) {
          document.getElementById("income-category-error").style.display = "block";
          ok = false;
        }
        if (!state.incomeDraft.paymentMethod) {
          document.getElementById("income-payment-error").style.display = "block";
          ok = false;
        }
        if (!ok) return;

        var incomeData = {
          amount: amount,
          category: state.incomeDraft.category,
          subcategory: state.incomeDraft.subcategory || null,
          paymentMethod: state.incomeDraft.paymentMethod,
          note: (state.incomeDraft.note || "").trim()
        };
        if (state.editingType === "income" && state.editingId) {
          var existingIncome = findMovement(state.editingId, "income");
          if (existingIncome) Object.assign(existingIncome, incomeData);
        } else {
          var createdNow = new Date();
          state.incomes.unshift(Object.assign({ id: makeId("income"), date: localDateKey(createdNow), createdAt: createdNow.getTime() }, incomeData));
        }

        persist();
        state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
        state.editingType = null;
        state.editingId = null;
        render();
      });
    }
  }

  /* =========================
     MOVIMIENTOS
  ========================= */

  else if (
    state.screen === "movimientos"
  ) {
    var movementFilterToggle = document.getElementById("movement-filter-toggle");
    if (movementFilterToggle) movementFilterToggle.addEventListener("click", function(event){ event.stopPropagation(); state.movementFiltersOpen = !state.movementFiltersOpen; render(); });
    document.querySelectorAll("[data-movement-type]").forEach(function(btn){
      btn.addEventListener("click", function(){
        state.movementTypeFilter = this.getAttribute("data-movement-type") || "todos";
        state.movementCategoryFilter = "todos";
        state.movementSubcategoryFilter = "todos";
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    document.querySelectorAll("[data-movement-category]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var value = this.getAttribute("data-movement-category") || "todos";
        state.movementCategoryFilter = value;
        state.movementSubcategoryFilter = "todos";
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    document.querySelectorAll("[data-movement-subcategory]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var value = this.getAttribute("data-movement-subcategory") || "todos";
        state.movementSubcategoryFilter = value;
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
      });
    });
    var movementSearchInput = document.getElementById("movement-search");
    if (movementSearchInput) {
      movementSearchInput.addEventListener("input", function () {
        var value = this.value;
        var pos = this.selectionStart;
        state.movementSearch = value;
        state.movementLimit = MOVIMIENTOS_POR_PAGINA;
        render();
        var next = document.getElementById("movement-search");
        if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch(e) {} }
      });
    }

    var movementMonthFilter = document.getElementById("movement-month-filter");
    var movementYearFilter = document.getElementById("movement-year-filter");
    if (movementMonthFilter) movementMonthFilter.addEventListener("change", function(){ state.movementMonth=this.value; state.movementLimit = MOVIMIENTOS_POR_PAGINA; render(); });
    if (movementYearFilter) movementYearFilter.addEventListener("change", function(){ state.movementYear=this.value; if(this.value === "all") state.movementMonth="all"; state.movementLimit = MOVIMIENTOS_POR_PAGINA; render(); });
    var showMoreMovement = document.querySelector("[data-movement-show-more]");
    if (showMoreMovement) showMoreMovement.addEventListener("click", function(){
      state.movementLimit = (Number(state.movementLimit) || MOVIMIENTOS_POR_PAGINA) + MOVIMIENTOS_POR_PAGINA;
      render();
    });
  }

  /* =========================
     MESES
  ========================= */

  else if (
    state.screen === "meses"
  ) {

    document.querySelectorAll("[data-calendar-year]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarYear = Number(btn.getAttribute("data-calendar-year"));
        state.calendarView = "months";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-month]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarMonth = Number(btn.getAttribute("data-calendar-month"));
        state.calendarDay = 1;
        state.calendarView = "month";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-day]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarDay = Number(btn.getAttribute("data-calendar-day"));
        persist();
        render();
      });
    });

    /* Los filtros del calendario se generan con renderPickerDropdown, que
       compone el atributo como "data-" + prefijo. */
    document.querySelectorAll("[data-calendar-expense-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarExpensePaymentFilter = btn.getAttribute("data-calendar-expense-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-income-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarIncomePaymentFilter = btn.getAttribute("data-calendar-income-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-expense-subcategory-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarExpenseSubcategoryFilter = btn.getAttribute("data-calendar-expense-subcategory-filter") || "todos";
        persist();
        render();
      });
    });

    document.querySelectorAll("[data-calendar-income-subcategory-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.calendarIncomeSubcategoryFilter = btn.getAttribute("data-calendar-income-subcategory-filter") || "todos";
        persist();
        render();
      });
    });

    var backYears = document.querySelector("[data-calendar-back-years]");
    if (backYears) {
      backYears.addEventListener("click", function () {
        state.calendarView = "years";
        persist();
        render();
      });
    }

    var backMonths = document.querySelector("[data-calendar-back-months]");
    if (backMonths) {
      backMonths.addEventListener("click", function () {
        state.calendarView = "months";
        persist();
        render();
      });
    }

  }

  /* =========================
     PRESUPUESTOS
  ========================= */

  else if (
    state.screen === "presupuestos"
  ) {

    document.querySelectorAll("[data-budget-edit]").forEach(function (row) {
      onRowActivate(row, function () {
        var cat = categoryIndex[row.getAttribute("data-budget-edit")];
        if (!cat) return;
        openModal(budgetEditForm(cat));
        var input = document.getElementById("budget-edit-value");
        if (input) { input.focus(); input.select(); }

        function guardar(valor) {
          if (valor > 0) state.budgets[cat.id] = Math.round(valor * 100) / 100;
          else delete state.budgets[cat.id];
          persist();
          closeModal();
          render();
        }

        function guardarDesdeCampo() {
          var texto = input ? input.value.trim() : "";
          var valor = texto === "" ? 0 : Number(texto);
          if (!Number.isFinite(valor) || valor < 0) { avisar("Ingresa un monto válido."); return; }
          guardar(valor);
        }

        var close = document.getElementById("close-budget-edit");
        if (close) close.addEventListener("click", closeModal);
        var save = document.getElementById("save-budget-edit");
        if (save) save.addEventListener("click", guardarDesdeCampo);
        var clear = document.getElementById("clear-budget-edit");
        if (clear) clear.addEventListener("click", function () { guardar(0); });
        if (input) input.addEventListener("keydown", function (event) { if (event.key === "Enter") guardarDesdeCampo(); });
      });
    });

  }

  /* =========================
     CONFIGURACIÓN
  ========================= */

  else if (
    state.screen === "configuracion"
  ) {
    document.querySelectorAll("[data-tema]").forEach(function (boton) {
      boton.addEventListener("click", function () {
        guardarTema(boton.getAttribute("data-tema"));
        preserveScroll(render);
      });
    });

    var exportDataBtn = document.getElementById("export-data-btn");
    var importDataBtn = document.getElementById("import-data-btn");
    var importDataFile = document.getElementById("import-data-file");

    if (exportDataBtn) exportDataBtn.addEventListener("click", exportAppData);
    var backupSelect = document.getElementById("local-backup-select");
    var restoreBackupBtn = document.getElementById("restore-local-backup-btn");
    if (backupSelect) {
      var backups = listLocalBackups();
      backupSelect.innerHTML = backups.length
        ? backups.slice().reverse().map(function (b) {
            var etiqueta = etiquetaDia(b.date) + " · " + b.date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
            return '<option value="' + b.timestamp + '">' + escapeHtml(etiqueta) + '</option>';
          }).join("")
        : '<option value="">Todavía no hay copias</option>';
      if (!backups.length) {
        backupSelect.disabled = true;
        if (restoreBackupBtn) restoreBackupBtn.disabled = true;
      }
    }
    if (restoreBackupBtn) restoreBackupBtn.addEventListener("click", function(){
      var ts = backupSelect && backupSelect.value;
      if (!ts) return;
      var etiqueta = backupSelect.options[backupSelect.selectedIndex].textContent;
      confirmar({
        titulo: "¿Restaurar la copia de " + etiqueta.toLowerCase() + "?",
        mensaje: "Tus datos actuales se reemplazan por los de esa copia.",
        aceptar: "Restaurar"
      }).then(function (ok) {
        if (!ok) return;
        if (restoreLocalBackup(Number(ts))) mostrarAviso("Copia restaurada.");
        else avisar("No se pudo restaurar la copia.");
      });
    });
    if (importDataBtn && importDataFile) {
      importDataBtn.addEventListener("click", function () {
        importDataFile.value = "";
        importDataFile.click();
      });
      importDataFile.addEventListener("change", function () {
        if (this.files && this.files[0]) importAppData(this.files[0]);
      });
    }



    /* Acordeones independientes: solo uno puede estar abierto a la vez.
       El estado se guarda en `state` para sobrevivir a los re-renders
       que ocurren al agregar/editar/eliminar categorías y subcategorías. */
    document.querySelectorAll("[data-settings-section]").forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        var section = toggle.getAttribute("data-settings-section");
        preserveScroll(function () {
          state.settingsOpenSection = state.settingsOpenSection === section ? null : section;
          render();
        });
      });
    });

    var addCategory =
      document.getElementById(
        "add-category-btn"
      );

    if (addCategory) {

      addCategory.addEventListener(
        "click",
        function () {

          state.modal = {

            type: "category",

            editing: false,

            id: null

          };

          renderModal();

        }
      );

    }

    document.querySelectorAll("[data-add-subcategory-for]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSettingsItemMenus();
        var key = btn.getAttribute("data-add-subcategory-for");
        var kind = key.split("|")[0];
        state.settingsExpandedCategories = {};
        state.settingsExpandedCategories[key] = true;
        state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
        state.modal = { type: "subcategory", editing: false, id: null, categoryKey: key };
        renderModal();
      });
    });

    document.querySelectorAll("[data-category-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-category-toggle");
        var kind = key.split("|")[0];
        var wasOpen = !!state.settingsExpandedCategories[key];

        if (wasOpen) {

          /* Se está CERRANDO: conservar la posición de scroll actual,
             sin saltos ni regreso al inicio. */
          preserveScroll(function () {
            state.settingsExpandedCategories = {};
            state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
            render();
          });

        } else {

          /* Se está ABRIENDO: abrir esta y cerrar cualquier otra ocurre en
             un único render. preserveScroll() mantiene la posición y, si
             las subcategorías quedan fuera de la pantalla, se desplaza lo
             justo para mostrarlas. */
          preserveScroll(function () {
            state.settingsExpandedCategories = {};
            state.settingsExpandedCategories[key] = true;
            state.settingsOpenSection = kind === "income" ? "income-categories" : "expense-categories";
            render();
          });

          centerSettingsElement('[data-category-key="' + key + '"]');

        }
      });
    });

    /* Un único acordeón de subcategorías puede estar abierto. Un clic fuera
       del grupo abierto lo cierra; el clic en otra categoría cambia el estado
       en un solo render. Se delega en document para sobrevivir a cada render(). */
    if (!document.documentElement.dataset.nexoSubcategoryAccordionDelegatedV1) {
      document.documentElement.dataset.nexoSubcategoryAccordionDelegatedV1 = "1";
      document.addEventListener("click", function (event) {
        if (state.screen !== "configuracion") return;
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest("[data-category-toggle]")) return;
        if (target.closest(".settings-category-group")) return;
        if (target.closest("#modal-root, #generic-modal-root, .dialogo-fondo")) return;
        var openKeys = Object.keys(state.settingsExpandedCategories || {}).filter(function (key) {
          return !!state.settingsExpandedCategories[key];
        });
        if (!openKeys.length) return;
        state.settingsExpandedCategories = {};
        render();
      });
    }

    document.querySelectorAll("[data-edit-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.modal = { type: "subcategory", editing: true, id: btn.getAttribute("data-edit-subcategory"), categoryKey: null };
        renderModal();
      });
    });

    document.querySelectorAll("[data-delete-subcategory]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-subcategory");
        var sub = SUBCATEGORIES.find(function (s) { return s.id === id; });
        if (!sub) return;
        confirmar({
          titulo: "¿Eliminar la subcategoría " + sub.label + "?",
          mensaje: "Los movimientos que la usaban se conservan, sin subcategoría.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.expenses.forEach(function (e) { if (e.subcategory === id) e.subcategory = null; });
          state.incomes.forEach(function (e) { if (e.subcategory === id) e.subcategory = null; });
          if (state.addDraft && state.addDraft.subcategory === id) state.addDraft.subcategory = null;
          if (state.incomeDraft && state.incomeDraft.subcategory === id) state.incomeDraft.subcategory = null;

          SUBCATEGORIES = SUBCATEGORIES.filter(function (s) { return s.id !== id; });
          saveSettings();
          persist();
          preserveScroll(render);
        });
      });
    });

    var addPayment =
      document.getElementById(
        "add-payment-btn"
      );

    if (addPayment) {

      addPayment.addEventListener(
        "click",
        function () {

          state.modal = {

            type: "payment",

            editing: false,

            id: null

          };

          renderModal();

        }
      );

    }

    var addIncomeCategory = document.getElementById("add-income-category-btn");
    if (addIncomeCategory) addIncomeCategory.addEventListener("click", function(){ state.modal={type:"incomeCategory",editing:false,id:null}; renderModal(); });
    var addIncomePayment = document.getElementById("add-income-payment-btn");
    if (addIncomePayment) addIncomePayment.addEventListener("click", function(){ state.modal={type:"incomePayment",editing:false,id:null}; renderModal(); });

    document.querySelectorAll("[data-edit-income-category]").forEach(function(btn){ btn.addEventListener("click", function(){ state.modal={type:"incomeCategory",editing:true,id:btn.getAttribute("data-edit-income-category")}; renderModal(); }); });
    document.querySelectorAll("[data-edit-income-payment]").forEach(function(btn){ btn.addEventListener("click", function(){ state.modal={type:"incomePayment",editing:true,id:btn.getAttribute("data-edit-income-payment")}; renderModal(); }); });
    document.querySelectorAll("[data-delete-income-category]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-income-category");
        if (INCOME_CATEGORIES.length <= 1) { avisar("Debes conservar al menos una categoría de ingreso."); return; }
        var cat = INCOME_CATEGORIES.find(function (c) { return c.id === id; });
        if (!cat) return;
        var fallback = INCOME_CATEGORIES.find(function (c) { return c.id !== id; });
        confirmar({
          titulo: "¿Eliminar la categoría " + cat.label + "?",
          mensaje: "Sus ingresos pasan a " + fallback.label + " y se borran sus subcategorías.",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.incomes.forEach(function (item) { if (item.category === id) item.category = fallback.id; });

          var orphanIncomeSubIds = SUBCATEGORIES.filter(function (s) {
            return s.kind === "income" && s.categoryId === id;
          }).map(function (s) { return s.id; });

          SUBCATEGORIES = SUBCATEGORIES.filter(function (s) {
            return !(s.kind === "income" && s.categoryId === id);
          });

          state.incomes.forEach(function (item) {
            if (orphanIncomeSubIds.indexOf(item.subcategory) !== -1) item.subcategory = null;
          });

          if (state.incomeDraft && orphanIncomeSubIds.indexOf(state.incomeDraft.subcategory) !== -1) {
            state.incomeDraft.subcategory = null;
          }

          delete state.settingsExpandedCategories["income|" + id];

          INCOME_CATEGORIES.splice(INCOME_CATEGORIES.indexOf(cat), 1);
          saveSettings(); persist(); preserveScroll(render);
        });
      });
    });

    document.querySelectorAll("[data-delete-income-payment]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-income-payment");
        if (INCOME_PAYMENT_METHODS.length <= 1) { avisar("Debes conservar al menos una fuente de ingreso."); return; }
        var pay = INCOME_PAYMENT_METHODS.find(function (p) { return p.id === id; });
        if (!pay) return;
        var fallback = INCOME_PAYMENT_METHODS.find(function (p) { return p.id !== id; });
        confirmar({
          titulo: "¿Eliminar la fuente " + pay.label + "?",
          mensaje: "Sus ingresos pasan a " + fallback.label + ".",
          aceptar: "Eliminar",
          peligro: true
        }).then(function (ok) {
          if (!ok) return;
          state.incomes.forEach(function (item) { if (item.paymentMethod === id) item.paymentMethod = fallback.id; });
          INCOME_PAYMENT_METHODS.splice(INCOME_PAYMENT_METHODS.indexOf(pay), 1);
          saveSettings(); persist(); preserveScroll(render);
        });
      });
    });

    document
      .querySelectorAll(
        "[data-edit-category]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              state.modal = {

                type: "category",

                editing: true,

                id:
                  btn.getAttribute(
                    "data-edit-category"
                  )

              };

              renderModal();

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-edit-payment]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              state.modal = {

                type: "payment",

                editing: true,

                id:
                  btn.getAttribute(
                    "data-edit-payment"
                  )

              };

              renderModal();

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-delete-category]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var id =
                btn.getAttribute(
                  "data-delete-category"
                );

              if (CATEGORIES.length <= 1) {

                avisar("Debes conservar al menos una categoría de gasto.");

                return;

              }

              var cat =
                CATEGORIES.find(function (c) {
                  return c.id === id;
                });

              if (!cat) return;

              var fallback =
                CATEGORIES.find(function (c) {
                  return c.id !== id;
                });

              confirmar({
                titulo: "¿Eliminar la categoría " + cat.label + "?",
                mensaje: "Sus gastos, pagos pendientes y recurrentes pasan a " + fallback.label + ", y se borran su presupuesto y sus subcategorías.",
                aceptar: "Eliminar",
                peligro: true
              }).then(function (ok) {
                if (!ok) return;

                /* Todo lo que apuntaba a la categoría pasa a otra; antes solo
                   se reasignaban los gastos y los pendientes, recurrentes y
                   deudas quedaban apuntando a una categoría inexistente. */
                [state.expenses, state.pendingPayments, state.recurringExpenses, state.debts].forEach(function (lista) {
                  (lista || []).forEach(function (item) {
                    if (item.category === id) item.category = fallback.id;
                  });
                });

                delete state.budgets[id];

                var orphanSubIds = SUBCATEGORIES.filter(function (s) {
                  return s.kind === "expense" && s.categoryId === id;
                }).map(function (s) { return s.id; });

                SUBCATEGORIES = SUBCATEGORIES.filter(function (s) {
                  return !(s.kind === "expense" && s.categoryId === id);
                });

                [state.expenses, state.pendingPayments, state.recurringExpenses, state.debts].forEach(function (lista) {
                  (lista || []).forEach(function (item) {
                    if (orphanSubIds.indexOf(item.subcategory) !== -1) item.subcategory = null;
                  });
                });

                if (state.addDraft && state.addDraft.category === id) state.addDraft.category = null;
                if (state.addDraft && orphanSubIds.indexOf(state.addDraft.subcategory) !== -1) {
                  state.addDraft.subcategory = null;
                }

                delete state.settingsExpandedCategories["expense|" + id];

                CATEGORIES = CATEGORIES.filter(function (c) { return c.id !== id; });

                saveSettings();
                persist();
                preserveScroll(render);
              });

            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-delete-payment]"
      )
      .forEach(
        function (btn) {

          btn.addEventListener(
            "click",
            function () {

              var id =
                btn.getAttribute(
                  "data-delete-payment"
                );

              if (
                PAYMENT_METHODS.length <= 1
              ) {

                avisar(
                  "Debes conservar al menos un método de pago."
                );

                return;

              }

              var pay = payInfo(id);

              /* Un método de pago es también una cuenta con saldo. Igual que
                 al eliminarla desde Cuentas, no se borra si tiene registros:
                 antes se reasignaban en silencio a otra cuenta, lo que movía
                 dinero entre cuentas y dejaba huérfano su saldo inicial. */
              var vinculados =
                state.expenses.filter(function (x) { return x.paymentMethod === id; }).length +
                state.incomes.filter(function (x) { return x.paymentMethod === id; }).length +
                (state.transfers || []).filter(function (x) { return x.fromAccount === id || x.toAccount === id; }).length +
                (state.pendingPayments || []).filter(function (x) { return x.paymentMethod === id; }).length +
                (state.recurringExpenses || []).filter(function (x) { return x.paymentMethod === id; }).length +
                (state.debts || []).filter(function (x) { return x.paymentMethod === id; }).length;

              if (vinculados) {
                avisar(
                  pay.label + " tiene " + vinculados + " registro" + (vinculados === 1 ? "" : "s") + " asociado" + (vinculados === 1 ? "" : "s") +
                  ". Para dejar de verlo sin perder ese historial, ocúltalo desde Cuentas manteniéndolo presionado.",
                  "No se puede eliminar " + pay.label
                );
                return;
              }

              confirmar({
                titulo: "¿Eliminar " + pay.label + "?",
                mensaje: "No tiene movimientos asociados. Esta acción no se puede deshacer.",
                aceptar: "Eliminar",
                peligro: true
              }).then(function (ok) {
                if (!ok) return;
                PAYMENT_METHODS = PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
                INCOME_PAYMENT_METHODS = INCOME_PAYMENT_METHODS.filter(function (p) { return p.id !== id; });
                delete state.accountOpeningBalances[id];
                delete state.accountMetadata[id];
                rebuildIndexes();
                saveSettings();
                persist();
                preserveScroll(render);
              });

            }
          );

        }
      );

    attachDragHandlers();

  }

}

