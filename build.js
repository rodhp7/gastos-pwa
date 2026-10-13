#!/usr/bin/env node
/**
 * build.js
 * ------------------------------------------------------------------
 * Reensambla app.js a partir de los módulos fuente en src/app/.
 *
 * Por qué existe:
 *   app.js original era un único archivo de ~7500 líneas con toda la
 *   lógica dentro de un mismo closure IIFE. Se dividió en módulos por
 *   sección (src/app/*.js, listados abajo) para que el código sea más
 *   fácil de ubicar y mantener, PERO todas las funciones y variables
 *   (state, CATEGORIES, render(), persist(), etc.) siguen dependiendo
 *   del mismo scope compartido: no son módulos ES independientes.
 *
 *   Por eso este script simplemente concatena los archivos, en el
 *   orden exacto listado abajo, envueltos en el mismo IIFE
 *   "(function(){ 'use strict'; ... })();" que tenía el app.js
 *   original. El resultado es byte-idéntico en comportamiento al
 *   app.js monolítico: mismo scope, mismo orden de declaración,
 *   mismas referencias cruzadas.
 *
 * Uso:
 *   node build.js
 *
 * Esto reescribe app.js. index.html sigue cargando app.js sin cambios.
 * ------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src", "app");
const OUTPUT = path.join(__dirname, "app.js");

// Orden exacto de ensamblado (coincide con las secciones originales).
const MODULES = [
  "00-config-icons-state.js",
  "01-utils.js",
  "02-storage.js",
  "03-calculations.js",
  "04-render-core.js",
  "05-action-menu.js",
  "05b-dialogo.js",
  "06-movement-rows.js",
  "07-cashflow.js",
  "08-view-inicio.js",
  "08a-view-cuentas.js",
  "08b-view-pendientes.js",
  "08c-view-deudas.js",
  "09-view-agregar-gasto.js",
  "10-view-movimientos.js",
  "11-view-calendario.js",
  "12-view-ingresos.js",
  "13-view-presupuestos.js",
  "14-view-configuracion.js",
  "15-modal.js",
  "16-drag.js",
  "17-screen-events.js",
  "18-navigation.js",
  "19-bootstrap.js",
  "20-service-worker.js",
  "21-pwa-install.js",
  "23-tema.js",
];

function build() {
  const missing = MODULES.filter((m) => !fs.existsSync(path.join(SRC_DIR, m)));
  if (missing.length) {
    console.error("Faltan módulos fuente:", missing.join(", "));
    process.exit(1);
  }

  const header = '(function () {\n\n"use strict";\n\n';
  const footer = "\n})();\n";

  const body = MODULES.map((m) =>
    fs.readFileSync(path.join(SRC_DIR, m), "utf8")
  ).join("");

  const output = header + body + footer;
  fs.writeFileSync(OUTPUT, output, "utf8");
  console.log(
    `app.js generado a partir de ${MODULES.length} módulos (${output.split("\n").length} líneas).`
  );
}

build();
