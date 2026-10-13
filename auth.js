(function () {
  "use strict";

  var cfg = window.GastosSupabaseConfig || {};
  var client = null;
  var currentUser = null;
  var ready = false;
  var listeners = [];
  var configured = /^https:\/\/[^\s]+\.supabase\.co$/.test(cfg.url || "") && cfg.anonKey && cfg.anonKey.indexOf("TU_") !== 0;
  var pendingNewAccount = false;
  var saveTimer = null;
  var pendingPayload = null;

  function emit() { listeners.forEach(function (fn) { try { fn(currentUser); } catch (e) {} }); }
  function el(id) { return document.getElementById(id); }
  function showGate(message) { var g = el("auth-gate"); if (g) { g.style.display = "flex"; if (message) setMessage(message, true); } }
  function hideGate() { var g = el("auth-gate"); if (g) g.style.display = "none"; }

  function injectGate() {
    if (el("auth-gate")) return;
    var gate = document.createElement("div");
    gate.id = "auth-gate";
    gate.innerHTML = '<div class="auth-card">' +
      '<div class="auth-brand">Nexo</div>' +
      '<h1 id="auth-title">Inicia sesión</h1>' +
      '<p id="auth-subtitle">Crea una cuenta si quieres guardar tus datos en la nube y usarlos en otros dispositivos. También puedes continuar sin cuenta y usar la app localmente.</p>' +
      '<div id="auth-message" class="auth-message"></div>' +
      '<form id="auth-form" autocomplete="on">' +
      '<label>Correo electrónico<input id="auth-email" type="email" autocomplete="email" required></label>' +
      '<label>Contraseña<input id="auth-password" type="password" autocomplete="current-password" minlength="6" required></label>' +
      '<button class="auth-primary" id="auth-submit" type="submit">Iniciar sesión</button>' +
      '</form>' +
      '<button class="auth-link" id="auth-toggle" type="button">Crear una cuenta</button>' +
      '<button class="auth-link muted" id="auth-reset" type="button">Olvidé mi contraseña</button>' +
      '<button class="auth-link guest" id="auth-continue" type="button">Continuar sin cuenta</button>' +
      '<div id="auth-config-help" class="auth-config-help" style="display:none">Configura primero <b>supabase-config.js</b> con la URL y la clave anon de tu proyecto.</div><div id="auth-session" style="display:none"><p id="auth-session-email" class="auth-session-email"></p><button class="auth-link" id="auth-signout" type="button">Cerrar sesión</button></div>' +
      '</div>';
    document.getElementById("phone").appendChild(gate);

    var mode = "login";
    el("auth-toggle").addEventListener("click", function () {
      mode = mode === "login" ? "signup" : "login";
      el("auth-title").textContent = mode === "login" ? "Inicia sesión" : "Crea tu cuenta";
      el("auth-subtitle").textContent = mode === "login" ? "Tus datos financieros se guardan en tu cuenta." : "Tu información quedará separada de la de otros usuarios.";
      el("auth-submit").textContent = mode === "login" ? "Iniciar sesión" : "Crear cuenta";
      el("auth-toggle").textContent = mode === "login" ? "Crear una cuenta" : "Ya tengo una cuenta";
      el("auth-message").textContent = "";
    });
    el("auth-reset").addEventListener("click", resetPassword);
    el("auth-continue").addEventListener("click", function () { hideGate(); setMessage(""); });
    el("auth-signout").addEventListener("click", function () {
      if (!client) { hideGate(); return; }
      var btn = el("auth-signout"); if (btn) btn.disabled = true;
      client.auth.signOut().finally(function () { if (btn) btn.disabled = false; hideGate(); });
    });
    el("auth-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!client) return setMessage("La conexión con la base de datos aún no está configurada.", true);
      var email = el("auth-email").value.trim();
      var password = el("auth-password").value;
      setBusy(true);
      pendingNewAccount = mode === "signup";
      var action = mode === "login" ? client.auth.signInWithPassword({ email: email, password: password }) : client.auth.signUp({ email: email, password: password });
      action.then(function (res) {
        if (res.error) throw res.error;
        if (mode === "signup" && res.data && res.data.user && !res.data.session) {
          setMessage("Cuenta creada. Revisa tu correo para confirmar la cuenta.", false);
        } else if (mode === "signup") {
          setMessage("Cuenta creada correctamente.", false);
        }
      }).catch(function (err) { setMessage(err.message || "No se pudo completar la operación.", true); }).finally(function () { setBusy(false); });
    });
  }

  function updateSessionView() {
    var session = el("auth-session");
    var form = el("auth-form"), toggle = el("auth-toggle"), reset = el("auth-reset"), cont = el("auth-continue");
    var title = el("auth-title"), subtitle = el("auth-subtitle"), email = el("auth-session-email");
    if (!session) return;
    if (currentUser) {
      session.style.display = "block";
      if (form) form.style.display = "none";
      if (toggle) toggle.style.display = "none";
      if (reset) reset.style.display = "none";
      if (cont) cont.style.display = "none";
      if (title) title.textContent = "Tu cuenta";
      if (subtitle) subtitle.textContent = "Tu información está asociada a esta cuenta.";
      if (email) email.textContent = currentUser.email || "Cuenta activa";
    } else {
      session.style.display = "none";
      if (form) form.style.display = "";
      if (toggle) toggle.style.display = "";
      if (reset) reset.style.display = "";
      if (cont) cont.style.display = "";
    }
  }

  function setBusy(busy) { var b = el("auth-submit"); if (b) { b.disabled = busy; b.textContent = busy ? "Procesando…" : b.textContent; } }
  function setMessage(msg, error) { var m = el("auth-message"); if (m) { m.textContent = msg || ""; m.className = "auth-message" + (error ? " error" : " success"); } }

  function resetPassword() {
    if (!client) return setMessage("Configura Supabase primero.", true);
    var email = el("auth-email").value.trim();
    if (!email) return setMessage("Escribe tu correo para enviarte el enlace de recuperación.", true);
    client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
      .then(function (res) { if (res.error) throw res.error; setMessage("Te enviamos un enlace para restablecer tu contraseña.", false); })
      .catch(function (err) { setMessage(err.message || "No se pudo enviar el enlace.", true); });
  }

  function payloadFromApp() { return window.GastosAppBridge && window.GastosAppBridge.getPayload ? window.GastosAppBridge.getPayload() : null; }
  function loadPayloadIntoApp(payload) { if (window.GastosAppBridge && window.GastosAppBridge.loadPayload) window.GastosAppBridge.loadPayload(payload); }

  function fetchCloud() {
    return client.from("user_app_data").select("data").eq("user_id", currentUser.id).maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      return res.data && res.data.data ? res.data.data : null;
    });
  }

  function savePayload(payload) {
    if (!client || !currentUser || !payload) return Promise.resolve();
    pendingPayload = payload;
    if (saveTimer) clearTimeout(saveTimer);
    return new Promise(function (resolve) {
      saveTimer = setTimeout(function () {
        var dataToSave = pendingPayload;
        pendingPayload = null;
        client.from("user_app_data").upsert({ user_id: currentUser.id, data: dataToSave, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
          .then(function (res) {
            if (res.error) console.error("No se pudo sincronizar con la nube.", res.error);
            resolve(res);
          }).catch(function (err) { console.error("No se pudo sincronizar con la nube.", err); resolve({ error: err }); });
      }, 450);
    });
  }

  function mergeById(localItems, cloudItems) {
    var map = {};
    (Array.isArray(cloudItems) ? cloudItems : []).forEach(function (item) { if (item && item.id) map[item.id] = item; });
    (Array.isArray(localItems) ? localItems : []).forEach(function (item) { if (item && item.id && !map[item.id]) map[item.id] = item; });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  /* Combina lo local con lo de la nube: ante el mismo id gana la nube, y lo
     que solo existe en el dispositivo se conserva. Antes solo se combinaban
     movimientos, recurrentes y metas; las deudas, transferencias, pagos
     pendientes, saldos de cuentas y categorías locales se perdían. */
  function mergePayloads(localPayload, cloudPayload) {
    var local = localPayload || {}, cloud = cloudPayload || {};
    var merged = Object.assign({}, cloud);
    merged.version = Math.max(Number(local.version) || 0, Number(cloud.version) || 0);
    ["expenses", "incomes", "recurringExpenses", "savingsGoals", "transfers", "pendingPayments", "debts"].forEach(function (key) {
      merged[key] = mergeById(local[key], cloud[key]);
    });
    ["budgets", "accountOpeningBalances", "accountMetadata"].forEach(function (key) {
      merged[key] = Object.assign({}, local[key] || {}, cloud[key] || {});
    });
    var localSettings = local.settings || {}, cloudSettings = cloud.settings || {};
    merged.settings = Object.assign({}, localSettings, cloudSettings);
    ["categories", "paymentMethods", "incomeCategories", "incomePaymentMethods", "subcategories"].forEach(function (key) {
      merged.settings[key] = mergeById(localSettings[key], cloudSettings[key]);
    });
    return merged;
  }

  function afterLogin(user) {
    currentUser = user;
    updateSessionView();
    hideGate();
    return fetchCloud().then(function (cloud) {
      var localPayload = payloadFromApp();
      var hasLocal = localPayload && hasMeaningfulData(localPayload);
      var hasCloud = cloud && hasMeaningfulData(cloud);
      if (hasCloud && hasLocal) {
        var preguntar = window.NexoDialogo
          ? window.NexoDialogo.confirmar({
              titulo: "Esta cuenta ya tiene datos",
              mensaje: "Puedes usar solo los datos guardados en la cuenta o combinarlos con los de este dispositivo.",
              aceptar: "Usar los de la cuenta",
              cancelar: "Combinar ambos"
            })
          : Promise.resolve(window.confirm("Esta cuenta ya tiene datos guardados.\n\nAceptar: usar los datos de la cuenta.\nCancelar: combinar los datos locales con los de la cuenta."));
        return preguntar.then(function (useCloud) {
          if (useCloud) {
            loadPayloadIntoApp(cloud);
            return;
          }
          var merged = mergePayloads(localPayload, cloud);
          loadPayloadIntoApp(merged);
          return savePayload(merged);
        });
      }
      if (hasCloud) {
        loadPayloadIntoApp(cloud);
        return;
      }
      if (hasLocal) return savePayload(localPayload);
    }).then(function () {
      pendingNewAccount = false;
      if (window.GastosAppBridge && window.GastosAppBridge.render) window.GastosAppBridge.render();
      emit();
    }).catch(function (err) {
      console.error(err);
      // Nunca bloqueamos la aplicación si falla la nube: sigue disponible en modo local.
      hideGate();
      setMessage("No se pudo sincronizar la nube. Puedes seguir usando la app sin cuenta.", true);
      emit();
    });
  }

  function hasMeaningfulData(payload) {
    if (!payload) return false;
    return (Array.isArray(payload.expenses) && payload.expenses.length) ||
      (Array.isArray(payload.incomes) && payload.incomes.length) ||
      (Array.isArray(payload.recurringExpenses) && payload.recurringExpenses.length) ||
      (Array.isArray(payload.savingsGoals) && payload.savingsGoals.length) ||
      (payload.budgets && Object.keys(payload.budgets).length);
  }

  function signOut() { if (client) return client.auth.signOut(); return Promise.resolve(); }

  function init() {
    injectGate();
    if (!configured || !window.supabase || !window.supabase.createClient) {
      // La cuenta es opcional. Si Supabase no está configurado, la app funciona
      // completamente en modo local y no muestra una pantalla de bloqueo.
      hideGate();
      ready = true; emit(); return;
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey);
    client.auth.getSession().then(function (res) {
      if (res.data && res.data.session && res.data.session.user) return afterLogin(res.data.session.user);
      hideGate(); updateSessionView(); emit();
    }).catch(function (err) { showGate("No se pudo comprobar la sesión."); setMessage(err.message, true); });
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session && session.user) afterLogin(session.user);
      if (event === "SIGNED_OUT") { currentUser = null; updateSessionView(); hideGate(); emit(); }
    });
    ready = true;
  }

  window.GastosAuth = {
    init: init,
    getUser: function () { return currentUser; },
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    savePayload: savePayload,
    signOut: signOut,
    open: function () {
      injectGate();
      updateSessionView();
      var gate = el("auth-gate");
      if (gate) gate.style.display = "flex";
      var email = el("auth-email"); if (email) email.focus();
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
