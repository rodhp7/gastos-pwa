(function (global) {

"use strict";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isDateOnlyString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getTime());

  if (isDateOnlyString(value)) {
    var parts = value.split("-").map(Number);
    var local = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(local.getTime()) ? null : local;
  }

  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function localDateKey(value) {
  var d = parseLocalDate(value);
  if (!d) d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function normalizeDate(value) {
  if (value instanceof Date) return localDateKey(value);
  if (isDateOnlyString(value)) return parseLocalDate(value) ? value : localDateKey(new Date());
  if (typeof value !== "string" || !value.trim()) return localDateKey(new Date());
  var parsed = parseLocalDate(value);
  return parsed ? localDateKey(parsed) : localDateKey(new Date());
}

function monthKey(value) {
  var d = parseLocalDate(value);
  if (!d) d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}

function formatMovementDateTime(value) {
  var d = parseLocalDate(value);
  if (!d) d = new Date();

  var dateText = d.toLocaleDateString("es-PE", {
    day: "numeric", month: "short", year: "numeric"
  });

  if (isDateOnlyString(value)) return dateText;

  return dateText + " · " + d.toLocaleTimeString("es-PE", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
}

global.GastosDateUtils = {
  isDateOnlyString: isDateOnlyString,
  parseLocalDate: parseLocalDate,
  localDateKey: localDateKey,
  normalizeDate: normalizeDate,
  monthKey: monthKey,
  formatMovementDateTime: formatMovementDateTime
};

})(window);
