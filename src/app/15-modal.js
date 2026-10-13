/* =========================================================
   MODAL
========================================================= */

// Modal genérico para flujos que no usan el editor de categorías.
// Las pantallas de metas y gastos recurrentes lo utilizan para abrir
// formularios propios sin depender de state.modal.
function openModal(content) {
  closeModal();
  var root = document.createElement("div");
  root.id = "generic-modal-root";
  root.className = "modal-overlay";
  root.innerHTML = '<div class="modal generic-modal">' + content + '</div>';
  document.body.appendChild(root);
  root.addEventListener("click", function (event) {
    if (event.target === root) closeModal();
  });
}

function closeModal() {
  var root = document.getElementById("generic-modal-root");
  if (root) root.remove();
}

function renderModal() {

  var existing =
    document.getElementById(
      "modal-root"
    );

  if (existing) {

    existing.remove();

  }

  if (!state.modal) {

    return;

  }

  var type =
    state.modal.type;

  var isCategory = type === "category" || type === "incomeCategory";
  var isIncome = type === "incomeCategory" || type === "incomePayment";
  var isIncomeCategory = type === "incomeCategory";
  var isPayment = type === "payment" || type === "incomePayment";
  var isSubcategory = type === "subcategory";

  var editing =
    state.modal.editing;

  var title = isSubcategory
    ? (editing ? "Editar Subcategoría" : "Nueva Subcategoría")
    : editing ?
      (isIncomeCategory ? "Editar Categoría de Ingreso" : type === "incomePayment" ? "Editar Método de Ingreso" : isCategory ? "Editar Categoría" : "Editar Método de Pago") :
      (isIncomeCategory ? "Nueva Categoría de Ingreso" : type === "incomePayment" ? "Nuevo Método de Ingreso" : isCategory ? "Nueva Categoría" : "Nuevo Método de Pago");

  var current =
    editing
      ? (
          isSubcategory ? SUBCATEGORIES.find(function(s){ return s.id === state.modal.id; }) :
          isIncomeCategory ? INCOME_CATEGORIES.find(function(c){ return c.id === state.modal.id; }) :
          type === "incomePayment" ? INCOME_PAYMENT_METHODS.find(function(p){ return p.id === state.modal.id; }) :
          isCategory ? CATEGORIES.find(function(c){ return c.id === state.modal.id; }) :
          PAYMENT_METHODS.find(function(p){ return p.id === state.modal.id; })
        )
      : null;

  /* Selector de categoría principal (solo subcategorías): lista combinada
     de categorías de gasto e ingreso, con clave compuesta "kind|id". */
  var categoryOptions = isSubcategory
    ? CATEGORIES.map(function (c) {
        return { id: "expense|" + c.id, label: c.label + " · Gasto", icon: c.icon, color: c.color };
      }).concat(INCOME_CATEGORIES.map(function (c) {
        return { id: "income|" + c.id, label: c.label + " · Ingreso", icon: c.icon || "income", color: c.color };
      }))
    : [];

  var defaultCategoryKey = current ? (current.kind + "|" + current.categoryId) : (categoryOptions[0] ? categoryOptions[0].id : "");
  var selectedCategoryKey = state.modal.categoryKey || defaultCategoryKey;

  var categoryPicker = isSubcategory
    ? '<p class="modal-label">Categoría principal</p>' +
      renderPickerDropdown("modal-subcategory-category", "", categoryOptions, selectedCategoryKey, "Selecciona una categoría", false)
    : "";

  var selectedIcon =
    current
      ? current.icon
      : isIncomeCategory
        ? "income"
        : "more";

  var selectedColor =
    current
      ? current.color
      : AVAILABLE_COLORS[0].color;

  var iconPicker = "";

  if (isCategory) {

    iconPicker =
      '' +
      '<div class="icon-picker">'

      + AVAILABLE_ICONS.map(
        function (name) {

          return (

            '<button class="icon-option ' +
              (
                selectedIcon === name
                  ? "selected"
                  : ""
              ) +
              '" data-select-icon="' +
                name +
              '">' +

              icon(
                name,
                22
              ) +

            '</button>'

          );

        }
      ).join("")

      + '</div>';

  }

  var colorPicker =
    '<div class="color-picker">'

    + AVAILABLE_COLORS.map(
      function (item) {

        return (

          '<button class="color-option ' +
            (
              selectedColor ===
              item.color
                ? "selected"
                : ""
            ) +
            '" ' +
            'data-select-color="' +
              item.color +
            '" ' +
            'data-select-soft="' +
              item.soft +
            '" ' +
            'style="background:' +
              item.color +
            '">' +

          '</button>'

        );

      }
    ).join("")

    + '</div>';

  var presetPicker = "";

  if (isPayment && !editing) {

    presetPicker =

      '<p class="modal-label">' +
        "Sugerencias · bancos y billeteras del Perú" +
      '</p>' +

      '<div class="icon-picker" id="modal-bank-presets" style="' +
        'grid-template-columns:repeat(3,1fr);' +
        'margin-bottom:16px' +
      '">' +

      PERU_FINANCE_PRESETS.map(function (p) {

        return (

          '<button type="button" class="icon-option"' +
            ' data-preset-label="' + escapeHtml(p.label) + '"' +
            ' data-preset-color="' + p.color + '"' +
            ' data-preset-icon="' + escapeHtml(p.icon || "") + '"' +
            ' style="' +
              'height:auto;' +
              'padding:8px 4px;' +
              'flex-direction:column;' +
              'gap:4px;' +
              'font-size:10px;' +
              'font-weight:500;' +
              'line-height:1.15;' +
              'text-align:center' +
            '">' +

            marcaHtml(p, 13, "marca-sm") +

            '<span>' + escapeHtml(p.label) + '</span>' +

          '</button>'

        );

      }).join("") +

      '</div>' +

      '<input type="hidden" id="modal-preset-icon" value="" />';

  }

  var root =
    document.createElement(
      "div"
    );

  root.id =
    "modal-root";

  root.className =
    "modal-overlay";

  root.innerHTML =

    '<div class="modal">' +

      '<p class="modal-title">' +
        title +
      '</p>' +

      categoryPicker +

      presetPicker +

      '<p class="modal-label">' +
        "Nombre" +
      '</p>' +

      '<input ' +
        'id="modal-name" ' +
        'class="field-input" ' +
        'type="text" ' +
        'maxlength="30" ' +
        'placeholder="' +
          (
            isSubcategory
              ? "Ej. Supermercado"
              : isIncomeCategory
                ? "Ej. Freelance"
                : type === "incomePayment"
                  ? "Ej. Plin"
                  : isCategory
                    ? "Ej. Mascotas"
                    : "Ej. Tarjeta de crédito"
          ) +
        '" ' +
        'value="' +
          escapeHtml(
            current
              ? current.label
              : ""
          ) +
        '"' +
      '/>' +

      (
        isCategory

          ? (
              '<p class="modal-label">' +
                "Icono" +
              '</p>' +

              '<div id="modal-icons">' +
                iconPicker +
              '</div>'
            )

          : ""
      ) +

      /* El color solo se pide para métodos de pago, donde tiñe su insignia.
         Las categorías se muestran en un único tono neutro y elegirles un
         color era un paso sin efecto visible. */
      (
        !isPayment
          ? ""
          : (
              '<p class="modal-label">' +
                "Color" +
              '</p>' +

              '<div id="modal-colors">' +
                colorPicker +
              '</div>'
            )
      ) +

      '<div class="modal-buttons">' +

        '<button class="secondary-btn"' +
          ' id="modal-cancel">' +

          "Cancelar" +

        '</button>' +

        '<button class="primary-btn"' +
          ' id="modal-save">' +

          "Guardar" +

        '</button>' +

      '</div>' +

    '</div>';

  document.body.appendChild(root);

  attachModalHandlers();

}

/* =========================================================
   EVENTOS DEL MODAL
========================================================= */

function saveCurrentModal() {
  var modal = state.modal || {};
  if (!modal.type) return;

        var name =
          document
            .getElementById(
              "modal-name"
            )
            .value
            .trim();

        if (!name) {

          avisar(
            "Ingresa un nombre."
          );

          return;

        }

        var selectedColor =
          document.querySelector(
            ".color-option.selected"
          );

        var color =
          selectedColor
            ? selectedColor.getAttribute(
                "data-select-color"
              )
            : AVAILABLE_COLORS[0].color;

        var soft =
          selectedColor
            ? selectedColor.getAttribute(
                "data-select-soft"
              )
            : AVAILABLE_COLORS[0].soft;

        if (modal.type === "subcategory") {

          var catKey =
            state.modal.categoryKey ||
            (CATEGORIES[0] ? "expense|" + CATEGORIES[0].id : null);

          if (!catKey) {
            avisar("Crea primero una categoría.");
            return;
          }

          var keyParts = catKey.split("|");
          var subKind = keyParts[0];
          var subCategoryId = keyParts[1];

          if (modal.editing) {
            var sub = SUBCATEGORIES.find(function (s) { return s.id === modal.id; });
            if (sub) {
              sub.label = capitalizeName(name);
              sub.kind = subKind;
              sub.categoryId = subCategoryId;
            }
          } else {
            SUBCATEGORIES.push({
              id: slugify(name) + "-" + Date.now(),
              label: capitalizeName(name),
              kind: subKind,
              categoryId: subCategoryId,
            });
          }

        } else if (modal.type === "incomeCategory") {
          var selectedIncomeIcon = document.querySelector(".icon-option.selected");
          var incomeIconName =
            selectedIncomeIcon
              ? selectedIncomeIcon.getAttribute("data-select-icon")
              : "income";
          var incomeCat = modal.editing ? INCOME_CATEGORIES.find(function(c){ return c.id === modal.id; }) : null;
          if (incomeCat) { incomeCat.label = capitalizeName(name); incomeCat.icon = incomeIconName; }
          else INCOME_CATEGORIES.push({ id: slugify(name) + "-" + Date.now(), label: capitalizeName(name), icon: incomeIconName, color: color, soft: soft });
        } else if (modal.type === "incomePayment") {
          var incomePay = modal.editing ? INCOME_PAYMENT_METHODS.find(function(p){ return p.id === modal.id; }) : null;
          if (incomePay) {
            incomePay.label = capitalizeName(name);
            incomePay.color = color;
            restoreFixedFinanceLogo(incomePay);
          } else {
            var incomePresetIcon = document.getElementById("modal-preset-icon");
            var newIncomePay = { id: slugify(name) + "-" + Date.now(), label: capitalizeName(name), color: color, icon: incomePresetIcon ? incomePresetIcon.value : "" };
            INCOME_PAYMENT_METHODS.push(newIncomePay);
          }
        } else if (modal.type === "category") {

          var selectedIcon =
            document.querySelector(
              ".icon-option.selected"
            );

          var iconName =
            selectedIcon
              ? selectedIcon.getAttribute(
                  "data-select-icon"
                )
              : "more";

          if (modal.editing) {

            var cat =
              CATEGORIES.find(
                function (c) {
                  return c.id ===
                    modal.id;
                }
              );

            if (cat) {

              cat.label = capitalizeName(name);
              cat.icon = iconName;

            }

          } else {

            var id =
              slugify(name) +
              "-" +
              Date.now();

            CATEGORIES.push({

              id: id,

              label:
                capitalizeName(name),

              color: color,

              soft: soft,

              icon: iconName

            });

            state.budgets[id] = 0;

          }

        } else {

          if (modal.editing) {

            var pay =
              PAYMENT_METHODS.find(
                function (p) {
                  return p.id ===
                    modal.id;
                }
              );

            if (pay) {

              pay.label =
                capitalizeName(name);

              pay.color =
                color;

              restoreFixedFinanceLogo(pay);

            }

          } else {

            var paymentId =
              slugify(name) +
              "-" +
              Date.now();

            var presetIconValue =
              document.getElementById("modal-preset-icon");

            var newPay = {

              id: paymentId,

              label:
                capitalizeName(name),

              color: color,

              icon: presetIconValue ? presetIconValue.value : ""

            };

            PAYMENT_METHODS.push(newPay);

          }

        }

        saveSettings();

        persist();

        state.modal = null;

        render();


}

function attachModalHandlers() {

  if (!document.documentElement.dataset.nexoModalDelegatedV2) {
    document.documentElement.dataset.nexoModalDelegatedV2 = "1";
    document.addEventListener("click", function (event) {
      var cancel = event.target.closest ? event.target.closest("#modal-cancel") : null;
      if (cancel) {
        event.preventDefault();
        state.modal = null;
        render();
        return;
      }
      var save = event.target.closest ? event.target.closest("#modal-save") : null;
      if (save) {
        event.preventDefault();
        saveCurrentModal();
      }
    });
  }

  var modal = state.modal || {};
  var isSubcategory = modal.type === "subcategory";
  var isIncomeCategory = modal.type === "incomeCategory";
  var isCategory = modal.type === "category" || isIncomeCategory;
  var editing = !!modal.editing;

  /* Modal buttons are handled through a single delegated listener installed below. */

  document
    .querySelectorAll(
      "[data-select-icon]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            document
              .querySelectorAll(
                "[data-select-icon]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            btn.classList.add(
              "selected"
            );
            if (state.modal && (state.modal.type === "subcategory" || state.modal.type === "category")) {
              state.modal.iconManuallySelected = true;
            }

          }
        );

      }
    );

  document
    .querySelectorAll(
      "[data-select-color]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            document
              .querySelectorAll(
                "[data-select-color]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            btn.classList.add(
              "selected"
            );

          }
        );

      }
    );

  document
    .querySelectorAll(
      "[data-preset-label]"
    )
    .forEach(
      function (btn) {

        btn.addEventListener(
          "click",
          function () {

            var nameInput =
              document.getElementById(
                "modal-name"
              );

            if (nameInput) {

              nameInput.value =
                btn.getAttribute(
                  "data-preset-label"
                );

            }

            var presetIconInput =
              document.getElementById(
                "modal-preset-icon"
              );

            if (presetIconInput) {

              presetIconInput.value =
                btn.getAttribute(
                  "data-preset-icon"
                ) || "";

            }

            var color =
              btn.getAttribute(
                "data-preset-color"
              );

            var soft =
              lightenColor(color, 0.85);

            var picker =
              document.querySelector(
                "#modal-colors .color-picker"
              );

            if (!picker) {
              return;
            }

            var swatch =
              picker.querySelector(
                '[data-select-color="' +
                color +
                '"]'
              );

            if (!swatch) {

              swatch =
                document.createElement(
                  "button"
                );

              swatch.className =
                "color-option";

              swatch.setAttribute(
                "data-select-color",
                color
              );

              swatch.setAttribute(
                "data-select-soft",
                soft
              );

              swatch.style.background =
                color;

              swatch.addEventListener(
                "click",
                function () {

                  document
                    .querySelectorAll(
                      "[data-select-color]"
                    )
                    .forEach(
                      function (b) {
                        b.classList.remove(
                          "selected"
                        );
                      }
                    );

                  swatch.classList.add(
                    "selected"
                  );

                }
              );

              picker.insertBefore(
                swatch,
                picker.firstChild
              );

            }

            document
              .querySelectorAll(
                "[data-select-color]"
              )
              .forEach(
                function (b) {
                  b.classList.remove(
                    "selected"
                  );
                }
              );

            swatch.classList.add(
              "selected"
            );

          }
        );

      }
    );

  attachChartFilterToggleHandlers();

  document.querySelectorAll("[data-modal-subcategory-category]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.modal.categoryKey = btn.getAttribute("data-modal-subcategory-category");
      renderModal();
    });
  });

}

