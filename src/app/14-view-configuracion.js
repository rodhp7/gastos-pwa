/* =========================================================
   CONFIGURACIÓN
   Apariencia, personalización (categorías y métodos), cuenta y datos.
   Cada lista es plana y crece con su contenido: antes vivía dentro de un
   recuadro con scroll propio —un scroll dentro del scroll de la página— que
   cortaba la última fila, y cada elemento era una tarjeta dentro de otra.
========================================================= */

function renderConfiguracion() {
  function categoryGroupHtml(cat, kind) {
    var key = kind + "|" + cat.id;
    var subs = subcategoriesFor(kind, cat.id);
    var expanded = !!state.settingsExpandedCategories[key];

    var dragHandle = kind === "expense"
      ? '<div class="drag-handle" data-drag-handle="true" data-drag-type="category" data-drag-id="' + cat.id + '" title="Arrastrar para ordenar">' +
          icon("grip", 18) +
        '</div>'
      : "";

    var editAttr = kind === "income" ? "data-edit-income-category" : "data-edit-category";
    var deleteAttr = kind === "income" ? "data-delete-income-category" : "data-delete-category";

    var subCountLabel = subs.length
      ? subs.length + " subcategoría" + (subs.length === 1 ? "" : "s")
      : "Sin subcategorías";

    var subRows = subs.map(function (sub) {
      var menuId = "sub-" + kind + "-" + cat.id + "-" + sub.id;
      var iconData = subcategoryIconData(sub);
      return '<div class="settings-item settings-subitem">' +
          '<div class="settings-icon settings-subicon" aria-hidden="true">' + iconOrEmoji(iconData.iconEmoji, iconData.icon || "more", 15, "currentColor") + '</div>' +
          '<div class="settings-info"><div class="settings-name">' + escapeHtml(sub.label) + '</div></div>' +
          itemMenuHtml(menuId, "data-edit-subcategory", escapeHtml(sub.id), "data-delete-subcategory", escapeHtml(sub.id)) +
        '</div>';
    }).join("");

    return '<div class="settings-category-group' + (expanded ? ' expanded' : '') + '"' +
        ' data-category-key="' + key + '"' +
        (kind === "expense" ? ' data-drag-type="category" data-drag-id="' + cat.id + '"' : '') +
      '>' +
        '<div class="settings-item settings-category-item">' +
          dragHandle +
          '<div class="settings-icon">' + iconOrEmoji(cat.iconEmoji, cat.icon || (kind === "income" ? "income" : "more"), 18, "currentColor") + '</div>' +
          '<div class="settings-info">' +
            '<div class="settings-name">' + escapeHtml(cat.label) + '</div>' +
            '<div class="settings-type">' + subCountLabel + '</div>' +
          '</div>' +
          '<button type="button" class="icon-btn settings-category-toggle" data-category-toggle="' + key + '" aria-expanded="' + (expanded ? "true" : "false") + '" aria-label="Ver subcategorías de ' + escapeHtml(cat.label) + '">' +
            icon("chevronDown", 18) +
          '</button>' +
          itemMenuHtml(kind + "-cat-" + cat.id, editAttr, cat.id, deleteAttr, cat.id) +
        '</div>' +
        '<div class="settings-subcategory-panel" data-subcategory-panel="' + key + '"' + (expanded ? "" : " hidden") + '>' +
          subRows +
          '<button type="button" class="settings-add-row settings-add-sub" data-add-subcategory-for="' + key + '">' + icon("plus", 16, "currentColor") + 'Añadir subcategoría</button>' +
        '</div>' +
      '</div>';
  }

  function paymentRowHtml(pay, draggable, editAttr, deleteAttr, menuPrefix) {
    return '<div class="settings-item"' + (draggable ? ' data-drag-type="payment" data-drag-id="' + pay.id + '"' : '') + '>' +
        (draggable
          ? '<div class="drag-handle" data-drag-handle="true" data-drag-type="payment" data-drag-id="' + pay.id + '" title="Arrastrar para ordenar">' + icon("grip", 18) + '</div>'
          : '') +
        paymentBadgeHtml(pay) +
        '<div class="settings-info"><div class="settings-name">' + escapeHtml(pay.label) + '</div></div>' +
        itemMenuHtml(menuPrefix + pay.id, editAttr, pay.id, deleteAttr, pay.id) +
      '</div>';
  }

  /* Sección plegable. El botón "Añadir" es la última fila de la misma lista:
     el arrastre para ordenar usa ese botón como tope del final. */
  function accordion(id, title, count, rows, addId, addLabel) {
    var isOpen = state.settingsOpenSection === id;
    return '<section class="settings-accordion' + (isOpen ? ' is-open' : '') + '">' +
        '<button type="button" class="settings-accordion-toggle" data-settings-section="' + id + '" aria-expanded="' + (isOpen ? "true" : "false") + '">' +
          '<span>' + title + '</span>' +
          '<span class="settings-accordion-count">' + count + '</span>' +
          '<span class="settings-accordion-chevron" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="settings-accordion-panel" data-settings-panel="' + id + '"' + (isOpen ? "" : " hidden") + '>' +
          rows +
          '<button type="button" class="settings-add-row" id="' + addId + '">' + icon("plus", 16, "currentColor") + addLabel + '</button>' +
        '</div>' +
      '</section>';
  }

  function linkRowHtml(attrs, iconName, title, detail) {
    return '<button type="button" class="settings-link" ' + attrs + '>' +
        '<span class="settings-link-icon">' + icon(iconName, 18, "currentColor") + '</span>' +
        '<span class="settings-link-body"><strong>' + title + '</strong><small>' + detail + '</small></span>' +
        icon("chevronRight", 18, "currentColor") +
      '</button>';
  }

  var user = window.GastosAuth && window.GastosAuth.getUser ? window.GastosAuth.getUser() : null;

  return '<div class="analysis-page settings-page">' +
      '<p class="analysis-kicker">Ajustes</p>' +
      '<h2 class="analysis-title settings-title">Configuración</h2>' +

      '<p class="section-label">Apariencia</p>' +
      temaSelectorHtml() +

      '<p class="section-label">Personalización</p>' +
      accordion("expense-categories", "Categorías de gastos", CATEGORIES.length,
        CATEGORIES.map(function (cat) { return categoryGroupHtml(cat, "expense"); }).join(""),
        "add-category-btn", "Añadir categoría") +
      accordion("payment-methods", "Métodos de pago", PAYMENT_METHODS.length,
        PAYMENT_METHODS.map(function (pay) { return paymentRowHtml(pay, true, "data-edit-payment", "data-delete-payment", "pay-"); }).join(""),
        "add-payment-btn", "Añadir método de pago") +
      accordion("income-categories", "Categorías de ingresos", INCOME_CATEGORIES.length,
        INCOME_CATEGORIES.map(function (cat) { return categoryGroupHtml(cat, "income"); }).join(""),
        "add-income-category-btn", "Añadir categoría de ingreso") +
      accordion("income-sources", "Fuentes de ingresos", INCOME_PAYMENT_METHODS.length,
        INCOME_PAYMENT_METHODS.map(function (pay) { return paymentRowHtml(pay, false, "data-edit-income-payment", "data-delete-income-payment", "income-pay-"); }).join(""),
        "add-income-payment-btn", "Añadir fuente de ingreso") +

      '<p class="section-label">Cuenta</p>' +
      '<div class="tx-list settings-links">' +
        linkRowHtml("data-account-open", "user",
          user ? escapeHtml(user.email || "Cuenta conectada") : "Cuenta y sincronización",
          user ? "Sincronizando con la nube" : "Guarda tus datos en la nube y úsalos en varios dispositivos") +
      '</div>' +

      '<p class="section-label">Datos y respaldo</p>' +
      '<div class="tx-list settings-links">' +
        linkRowHtml('id="export-data-btn"', "download", "Exportar copia", "Descarga un archivo con todos tus datos") +
        linkRowHtml('id="import-data-btn"', "upload", "Importar copia", "Reemplaza tus datos por los de un archivo") +
        '<div class="settings-backup">' +
          '<span class="settings-link-icon">' + icon("refresh", 18, "currentColor") + '</span>' +
          '<div class="settings-link-body">' +
            '<strong>Copias automáticas</strong>' +
            '<small>Nexo guarda hasta 5 copias en este dispositivo, una por día.</small>' +
            '<div class="settings-backup-controls">' +
              '<select id="local-backup-select" aria-label="Copia automática"></select>' +
              '<button type="button" class="secondary-btn" id="restore-local-backup-btn">Restaurar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<input type="file" id="import-data-file" accept=".json,application/json" hidden>' +

      '<button type="button" class="settings-danger-link" id="clear-movements-btn">Borrar todos los movimientos</button>' +
    '</div>';
}
