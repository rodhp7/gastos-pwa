(function (global) {

"use strict";

var DEFAULT_CATEGORIES = [

  {
    id: "alimentacion",
    label: "Alimentación",
    color: "#1D9E75",
    soft: "#E1F5EE",
    icon: "shopping-cart"
  },

  {
    id: "transporte",
    label: "Transporte",
    color: "#D85A30",
    soft: "#FAECE7",
    icon: "bus"
  },

  {
    id: "servicios",
    label: "Servicios",
    color: "#BA7517",
    soft: "#FAEEDA",
    icon: "zap"
  },

  {
    id: "entretenimiento",
    label: "Entretenimiento",
    color: "#378ADD",
    soft: "#E6F1FB",
    icon: "film"
  },

  {
    id: "otros",
    label: "Otros",
    color: "#888780",
    soft: "#F1EFE8",
    icon: "more"
  }

];

var DEFAULT_PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo", color: "#0F6E56", icon: "cash" },
  { id: "yape", label: "Yape", color: "#742384", icon: "wallet" },
  { id: "plin", label: "Plin", color: "#00A99D", icon: "wallet" },
  { id: "bcp", label: "BCP", color: "#0F6E56", icon: "bank" },
  { id: "bbva", label: "BBVA", color: "#072146", icon: "bank" },
  { id: "interbank", label: "Interbank", color: "#00A651", icon: "bank" },
  { id: "prexpe", label: "Prexpe", color: "#111111", icon: "card" }
];

var PERU_FINANCE_PRESETS = [

  { id: "yape", label: "Yape", color: "#742384", icon: "wallet" },
  { id: "plin", label: "Plin", color: "#00A99D", icon: "wallet" },
  { id: "tunki", label: "Tunki", color: "#FF6B00", icon: "wallet" },
  { id: "lukita", label: "Lukita", color: "#6236FF", icon: "wallet" },
  { id: "billetera-bim", label: "Billetera BIM", color: "#8C1D40", icon: "wallet" },

  { id: "bcp", label: "BCP", color: "#002A54", icon: "bank" },
  { id: "interbank", label: "Interbank", color: "#00A551", icon: "bank" },
  { id: "bbva", label: "BBVA", color: "#004481", icon: "bank" },
  { id: "scotiabank", label: "Scotiabank", color: "#EC111A", icon: "bank" },
  { id: "banco-nacion", label: "Banco de la Nación", color: "#D52B1E", icon: "bank" },
  { id: "banbif", label: "BanBif", color: "#F58220", icon: "bank" },
  { id: "pichincha", label: "Pichincha", color: "#FFCC00", icon: "bank" },
  { id: "mibanco", label: "Mibanco", color: "#E30613", icon: "bank" },
  { id: "banco-falabella", label: "Banco Falabella", color: "#6DBE45", icon: "bank" },
  { id: "banco-ripley", label: "Banco Ripley", color: "#E4032E", icon: "bank" },
  { id: "compartamos", label: "Compartamos Financiera", color: "#00A19A", icon: "bank" },

  { id: "caja-piura", label: "Caja Piura", color: "#0072BC", icon: "bank" },
  { id: "caja-arequipa", label: "Caja Arequipa", color: "#00954C", icon: "bank" },
  { id: "caja-huancayo", label: "Caja Huancayo", color: "#EF7D00", icon: "bank" },
  { id: "caja-trujillo", label: "Caja Trujillo", color: "#C8102E", icon: "bank" },
  { id: "caja-cusco", label: "Caja Cusco", color: "#003DA5", icon: "bank" }

];

var DEFAULT_INCOME_CATEGORIES = [
  { id: "sueldo", label: "Sueldo", color: "#0F6E56", soft: "#E1F5EE", icon: "briefcase" },
  { id: "trabajo-extra", label: "Trabajo extra", color: "#185FA5", soft: "#E8F1FA", icon: "zap" },
  { id: "regalo", label: "Regalo", color: "#9C36B5", soft: "#F3E8F7", icon: "gift" },
  { id: "ventas", label: "Ventas", color: "#BA7517", soft: "#FAEEDA", icon: "store" },
  { id: "freelance", label: "Freelance", color: "#378ADD", soft: "#E6F1FB", icon: "briefcase" },
  { id: "bono", label: "Bono", color: "#D4537E", soft: "#FCE8EF", icon: "award" },
  { id: "devolucion", label: "Devolución", color: "#00A99D", soft: "#E0F7F5", icon: "refresh" },
  { id: "inversiones", label: "Inversiones", color: "#742384", soft: "#F3E5F5", icon: "trending-up" },
  { id: "prestamo", label: "Préstamo", color: "#888780", soft: "#F1EFE8", icon: "handshake" },
  { id: "otros-ingresos", label: "Otros", color: "#888780", soft: "#F1EFE8", icon: "coins" }
];

var DEFAULT_BUDGETS = {

  alimentacion: 800,
  transporte: 300,
  servicios: 450,
  entretenimiento: 400,
  otros: 200

};

var DEFAULT_SUBCATEGORIES = [
{id:"alimentacion-supermercado",label:"Supermercado",kind:"expense",categoryId:"alimentacion",icon:"shopping-cart"},
{id:"alimentacion-restaurantes",label:"Restaurantes",kind:"expense",categoryId:"alimentacion",icon:"store"},
{id:"alimentacion-cafes",label:"Cafés y snacks",kind:"expense",categoryId:"alimentacion",icon:"heart"},
{id:"transporte-combustible",label:"Combustible",kind:"expense",categoryId:"transporte",icon:"car"},
{id:"transporte-taxi",label:"Taxi / apps",kind:"expense",categoryId:"transporte",icon:"car"},
{id:"transporte-publico",label:"Transporte público",kind:"expense",categoryId:"transporte",icon:"bus"},
{id:"servicios-hogar",label:"Hogar",kind:"expense",categoryId:"servicios",icon:"home"},
{id:"servicios-internet",label:"Internet",kind:"expense",categoryId:"servicios",icon:"zap"},
{id:"servicios-telefono",label:"Teléfono",kind:"expense",categoryId:"servicios",icon:"briefcase"},
{id:"entretenimiento-streaming",label:"Streaming",kind:"expense",categoryId:"entretenimiento",icon:"film"},
{id:"entretenimiento-salidas",label:"Salidas",kind:"expense",categoryId:"entretenimiento",icon:"game"},
{id:"otros-compras",label:"Compras",kind:"expense",categoryId:"otros",icon:"shopping-cart"},
{id:"otros-personal",label:"Personal",kind:"expense",categoryId:"otros",icon:"heart"}
];

global.GastosConfig = {
  DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS: DEFAULT_PAYMENT_METHODS,
  PERU_FINANCE_PRESETS: PERU_FINANCE_PRESETS,
  DEFAULT_INCOME_CATEGORIES: DEFAULT_INCOME_CATEGORIES,
  DEFAULT_BUDGETS: DEFAULT_BUDGETS,
  DEFAULT_SUBCATEGORIES: DEFAULT_SUBCATEGORIES
};

})(window);
