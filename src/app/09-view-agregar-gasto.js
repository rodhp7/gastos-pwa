/* =========================================================
   AGREGAR GASTO
========================================================= */

function renderAdd() {
  var editing = state.editingType === "expense" && !!state.editingId;
  var monthTotal = currentMonthExpenses().reduce(function (sum, e) {
    return sum + Number(e.amount || 0);
  }, 0);


  if (!state.addDraft) {

    state.addDraft = {
      amount: "",
      note: "",
      category: null,
      subcategory: null,
      paymentMethod: null
    };

  }

  var d =
    state.addDraft;

  var amountValue =
    escapeHtml(
      d.amount || ""
    );

  var noteValue =
    escapeHtml(
      d.note || ""
    );

  var catChips =
    CATEGORIES.map(function (cat) {

      var selected =
        d.category === cat.id;

      return (

        '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
          ' data-cat="' + cat.id + '" aria-pressed="' + selected + '">' +

          icon(cat.icon, 15, 'currentColor') +

          escapeHtml(cat.label) +

        '</button>'

      );

    }).join("");

  var addSubcats = d.category ? subcategoriesFor("expense", d.category) : [];
  var subcategoryPicker = addSubcats.length
    ? '<p class="section-label js-section-top">Subcategoría</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px" id="subcategory-group">' +
      addSubcats.map(function (sub) {
        var selected = d.subcategory === sub.id;
        var iconData = subcategoryIconData(sub);
        return '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '" data-add-subcategory="' + escapeHtml(sub.id) + '" aria-pressed="' + selected + '">' +
          iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + escapeHtml(sub.label) + '</button>';
      }).join("") +
      '</div>'
    : "";

  var payButtons =
    visiblePaymentMethods(PAYMENT_METHODS).map(function (pay) {

      var selected =
        d.paymentMethod === pay.id;

      return (

        /* La selección se marca igual que en categorías. Con el color de la
           entidad como borde, elegir BBVA (azul marino) en tema oscuro no
           se distinguía de no elegir nada. */
        '<button type="button" class="cat-chip' + (selected ? ' is-selected' : '') + '"' +
          ' data-pay="' + pay.id + '" aria-pressed="' + selected + '">' +

          marcaHtml(pay, 12, "marca-xs") +

          '<span>' +
            escapeHtml(pay.label) +
          '</span>' +

        '</button>'

      );

    }).join("");


  return (

    '<div style="padding:20px 20px 12px">' +

      '<div style="' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:space-between;' +
        'margin-bottom:20px' +
      '">' +

        '<button class="icon-btn" id="cancel-add">' +

          icon("x", 20) +

        '</button>' +

        '<div style="display:flex;align-items:center;gap:8px">' +
          '<p style="font-size:15px;font-weight:600;margin:0">' + (editing ? "Editar Gasto" : "Nuevo Gasto") + '</p>' +
          '<button type="button" class="secondary-btn" id="open-recurring-from-expenses" style="width:auto;padding:8px 10px;font-size:11px">↻ Recurrentes</button>' +
        '</div>' +
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
            'id="amount-input" ' +
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

        '<p class="error-text" id="amount-error" style="display:none">' +
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
        '" id="cat-group">' +

        catChips +

      '</div>' +

      '<p class="error-text" id="cat-error" style="display:none">' +
        "Elige una categoría." +
      '</p>' +

      subcategoryPicker +

      '<p class="section-label" class="js-section-top">' +
        "Método de pago" +
      '</p>' +

      '<div style="' +
        'display:flex;' +
        'flex-wrap:wrap;' +
        'gap:8px;' +
        'margin-bottom:6px' +
        '" id="pay-group">' +

        payButtons +

      '</div>' +

      '<p class="error-text" id="pay-error" style="display:none">' +
        "Elige un método de pago." +
      '</p>' +

      '<input ' +
        'type="text" ' +
        'placeholder="Nota (opcional)" ' +
        'id="note-input" ' +
        'class="field-input" ' +
        'value="' + noteValue + '" ' +
        'style="margin-top:14px;margin-bottom:18px"' +
      '/>' +

      '<button class="primary-btn" id="save-expense-btn">' +
        (editing ? "Guardar Cambios" : "Guardar Gasto") +
      '</button>' +

    '</div>'

  );

}

