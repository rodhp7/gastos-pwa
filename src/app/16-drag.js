/* =========================================================
   MAYÚSCULA INICIAL
========================================================= */

/* Solo pone en mayúscula la inicial. Antes pasaba el resto a minúsculas y
   las siglas se estropeaban al editar: "BCP" quedaba "Bcp", "BBVA" "Bbva". */
function capitalizeName(text) {
  text = String(text).trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* =========================
   ARRASTRE: MOUSE · TOUCH · PEN
========================= */

function dragArray(type) {
  return type === "category" ? CATEGORIES :
         type === "payment" ? PAYMENT_METHODS : null;
}

function dragItemSelector(type) {
  return type === "category"
    ? '.settings-category-group[data-drag-type="category"]'
    : '.settings-item[data-drag-type="' + type + '"]';
}

function dragItems(type) {
  return Array.from(document.querySelectorAll(
    dragItemSelector(type)
  ));
}

function dragEndButton(type) {
  return document.getElementById(
    type === "category" ? "add-category-btn" : "add-payment-btn"
  );
}

function resetDragState() {
  Object.assign(dragState, {
    active:false, type:null, id:null, element:null, placeholder:null,
    otherItems:null,
    pointerId:null, pointerType:null, handle:null,
    startX:0, startY:0, currentX:0, currentY:0,
    grabOffsetX:0, grabOffsetY:0, originalRect:null,
    originalParent:null, originalNextSibling:null, startIndex:-1
  });
}

function movePlaceholder(y) {
  var p = dragState.placeholder;
  if (!p) return;

  var before = dragState.otherItems.find(function (el) {
      var r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });

  var end = dragEndButton(dragState.type);

  if (before) {
    if (p.nextElementSibling !== before) before.parentNode.insertBefore(p, before);
  } else if (end && end.previousElementSibling !== p) {
    end.parentNode.insertBefore(p, end);
  }
}

function startDrag(e) {
  if (dragState.active || state.screen !== "configuracion") return;
  if (e.pointerType === "mouse" && e.button !== 0) return;

  var handle = e.currentTarget;

  /* Reordenar solo puede comenzar desde el asa. */
  if (!handle || handle.dataset.dragHandle !== "true") return;

  var dragType = handle.dataset.dragType;

  var item = dragType === "category"
    ? handle.closest(".settings-category-group")
    : handle.closest(".settings-item");
  if (!item) return;

  e.preventDefault();

  var r = item.getBoundingClientRect();
  var type = item.dataset.dragType;
  var id = item.dataset.dragId;
  var arr = dragArray(type);

  var p = document.createElement("div");
  p.className = "settings-item drag-placeholder";
  p.style.height = r.height + "px";
  p.style.marginBottom = getComputedStyle(item).marginBottom;
  p.setAttribute("aria-hidden", "true");
  item.parentNode.insertBefore(p, item);

  Object.assign(dragState, {
    active:true, type:type, id:id, element:item, placeholder:p,
    otherItems:dragItems(type).filter(function (x) { return x !== item; }),
    pointerId:e.pointerId, pointerType:e.pointerType, handle:handle,
    startX:e.clientX, startY:e.clientY,
    currentX:e.clientX, currentY:e.clientY,
    grabOffsetX:e.clientX-r.left, grabOffsetY:e.clientY-r.top,
    originalRect:r, originalParent:item.parentNode,
    originalNextSibling:item.nextSibling,
    startIndex:arr ? arr.findIndex(function (x) { return x.id === id; }) : -1
  });

  Object.assign(item.style, {
    position:"fixed", left:r.left+"px", top:r.top+"px",
    width:r.width+"px", height:r.height+"px", margin:"0"
  });

  item.classList.add("dragging");
  handle.classList.add("dragging-handle");
  document.body.classList.add("dragging-settings");

  if (navigator.vibrate && e.pointerType !== "mouse") navigator.vibrate(25);
}

function moveDrag(e) {
  if (!dragState.active || e.pointerId !== dragState.pointerId) return;
  e.preventDefault();

  var x = e.clientX - dragState.grabOffsetX;
  var y = e.clientY - dragState.grabOffsetY;

  dragState.currentX = e.clientX;
  dragState.currentY = e.clientY;

  dragState.element.style.setProperty("--drag-x", x - dragState.originalRect.left + "px");
  dragState.element.style.setProperty("--drag-y", y - dragState.originalRect.top + "px");
  movePlaceholder(e.clientY);
}

function syncDragArray(type) {
  var arr = dragArray(type);
  if (!arr) return;

  var ids = dragItems(type).map(function (el) { return el.dataset.dragId; });
  var ordered = ids.map(function (id) {
    return arr.find(function (x) { return x.id === id; });
  }).filter(Boolean);

  if (ordered.length === arr.length) {
    arr.splice.apply(arr, [0, arr.length].concat(ordered));
  }
}

function finishDrag(cancel) {
  if (!dragState.active) return;

  var el = dragState.element;
  var p = dragState.placeholder;
  var type = dragState.type;
  var pointerType = dragState.pointerType;

  if (cancel) {
    var items = dragItems(type).filter(function (x) { return x !== el; });
    var target = items[dragState.startIndex] || dragEndButton(type);
    if (target && target.parentNode) target.parentNode.insertBefore(el, target);
    else if (dragState.originalParent) dragState.originalParent.appendChild(el);
  } else if (p && p.parentNode) {
    p.parentNode.insertBefore(el, p);
  }

  el.classList.remove("dragging");
  if (dragState.handle) dragState.handle.classList.remove("dragging-handle");
  document.body.classList.remove("dragging-settings");

  Object.assign(el.style, {
    position:"", left:"", top:"", width:"", height:"", margin:""
  });
  el.style.setProperty("--drag-x", "0px");
  el.style.setProperty("--drag-y", "0px");

  if (p) p.remove();

  if (!cancel) {
    syncDragArray(type);
    /* persist() además de saveSettings(): las listas también viajan dentro
       de los datos principales, que son los que se leen al arrancar. Solo
       con saveSettings() el nuevo orden se perdía al recargar. */
    saveSettings();
    persist();
    if (navigator.vibrate && pointerType !== "mouse") navigator.vibrate(15);
  }

  resetDragState();
}

function attachDragHandlers() {
  if (state.screen !== "configuracion") return;

  document.querySelectorAll("[data-drag-handle='true']").forEach(function (handle) {
    handle.addEventListener("pointerdown", startDrag, { passive:false });
    handle.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
}

document.addEventListener("pointermove", function (e) {
  if (dragState.active) moveDrag(e);
}, { passive:false });

document.addEventListener("pointerup", function (e) {
  if (dragState.active && e.pointerId === dragState.pointerId) {
    e.preventDefault();
    finishDrag(false);
  }
}, { passive:false });

document.addEventListener("pointercancel", function (e) {
  if (dragState.active && e.pointerId === dragState.pointerId) {
    e.preventDefault();
    finishDrag(true);
  }
}, { passive:false });

window.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && dragState.active) finishDrag(true);
});

