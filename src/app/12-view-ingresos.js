/* =========================================================
   INGRESOS
========================================================= */
function renderIngresos() {
  var editingIncome = state.editingType === "income" && !!state.editingId;
  var monthTotal = totalIncomes(currentMonthIncomes());

  if (!state.incomeDraft) {
    state.incomeDraft = { amount: "", note: "", category: null, subcategory: null, paymentMethod: null };
  }

  var d = state.incomeDraft;
  var amountValue = escapeHtml(d.amount || "");
  var noteValue = escapeHtml(d.note || "");



  var categoryButtons = INCOME_CATEGORIES.map(function (cat) {
    var selected = d.category === cat.id;

    return (
      '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
        ' data-income-category="' + cat.id + '" aria-pressed="' + selected + '">' +
        icon((cat && cat.icon) || 'income', 15, 'currentColor') +
        escapeHtml(cat.label) +
      '</button>'
    );
  }).join("");

  var incomeSubcats = d.category ? subcategoriesFor("income", d.category) : [];
  var incomeSubcategoryPicker = incomeSubcats.length
    ? '<p class="section-label js-section-top">Subcategoría</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px" id="income-subcategory-group">' +
      incomeSubcats.map(function (sub) {
        var selected = d.subcategory === sub.id;
        var iconData = subcategoryIconData(sub);
        return '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '" data-income-subcategory="' + escapeHtml(sub.id) + '" aria-pressed="' + selected + '">' +
          iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + escapeHtml(sub.label) + '</button>';
      }).join("") +
      '</div>'
    : "";

  var paymentButtons = visiblePaymentMethods(INCOME_PAYMENT_METHODS).map(function (pay) {
    var selected = d.paymentMethod === pay.id;

    return (
      '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
        ' data-income-payment="' + pay.id + '" aria-pressed="' + selected + '">' +
        marcaHtml(pay, 12, "marca-xs") +
        '<span>' +
          escapeHtml(pay.label) +
        '</span>' +
      '</button>'
    );
  }).join("");

  return '<div style="padding:20px 20px 12px">' +
    '<div style="' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:space-between;' +
      'margin-bottom:20px' +
    '">' +
      '<button class="icon-btn" id="cancel-income">' +
        icon("x", 20) +
      '</button>' +
      '<p style="' +
        'font-size:15px;' +
        'font-weight:600;' +
        'margin:0' +
      '">' +
        (editingIncome ? "Editar Ingreso" : "Nuevo Ingreso") +
      '</p>' +
      '<span style="width:28px"></span>' +
    '</div>' +

    '<div style="' +
      'text-align:center;' +
      'margin-bottom:20px' +
    '">' +
      '<p style="' +
        'font-size:13px;' +
        'color:var(--text-muted);' +
        'margin:0 0 4px' +
      '">' +
        "Monto" +
      '</p>' +
      '<div style="' +
        'display:flex;' +
        'align-items:baseline;' +
        'justify-content:center;' +
        'gap:4px' +
      '">' +
        '<span class="disp" style="' +
          'font-size:20px;' +
          'color:var(--text-muted)' +
        '">' +
          "S/" +
        '</span>' +
        '<input ' +
          'type="number" ' +
          'inputmode="decimal" ' +
          'placeholder="0.00" ' +
          'id="income-amount-input" ' +
          'class="disp" ' +
          'value="' + amountValue + '" ' +
          'style="' +
            'border:none;' +
            'background:none;' +
            'font-size:38px;' +
            'font-weight:600;' +
            'width:160px;' +
            'text-align:center;' +
            'color:var(--ink)' +
          '"' +
        '/>' +
      '</div>' +
      '<p class="error-text" id="income-error" style="display:none">' +
        "Ingresa un monto válido." +
      '</p>' +
    '</div>' +

    '<p class="section-label">' +
      "Categoría" +
    '</p>' +
    '<div style="' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:8px;' +
      'margin-bottom:6px' +
      '" id="income-category-group">' +
      categoryButtons +
    '</div>' +
    '<p class="error-text" id="income-category-error" style="display:none">' +
      "Elige una categoría." +
    '</p>' +

    incomeSubcategoryPicker +

    '<p class="section-label" class="js-section-top">' +
      "Fuente de ingreso" +
    '</p>' +
    '<div style="' +
      'display:flex;' +
      'flex-wrap:wrap;' +
      'gap:8px;' +
      'margin-bottom:6px' +
      '" id="income-payment-group">' +
      paymentButtons +
    '</div>' +
    '<p class="error-text" id="income-payment-error" style="display:none">' +
      "Elige una fuente de ingreso." +
    '</p>' +

    '<input ' +
      'type="text" ' +
      'placeholder="Nota (opcional)" ' +
      'id="income-note-input" ' +
      'class="field-input" ' +
      'maxlength="80" ' +
      'value="' + noteValue + '" ' +
      'style="margin-top:14px;margin-bottom:18px"' +
    '/>' +

    '<button class="primary-btn" id="save-income-btn">' +
      (editingIncome ? "Guardar Cambios" : "Guardar Ingreso") +
    '</button>' +
  '</div>';
}
