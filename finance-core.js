(function(){
"use strict";

function safeArray(value){ return Array.isArray(value) ? value : []; }
function normalizeAmount(value){ var n=Number(value); return isFinite(n) && n>=0 ? Math.round(n*100)/100 : 0; }
function makeId(prefix){ var random=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36); return String(prefix||"id")+"-"+random; }
function totalIncomes(list){ return (list||[]).reduce(function(sum,e){ return sum+Number(e.amount||0); },0); }
function totalExpenses(list){ return (list||[]).reduce(function(sum,e){ return sum+Number(e.amount||0); },0); }
function availableYears(expenses,incomes,parseLocalDate){ var years={}; years[new Date().getFullYear()]=true; (expenses||[]).concat(incomes||[]).forEach(function(item){ var d=parseLocalDate(item.date); if(!isNaN(d.getTime())) years[d.getFullYear()]=true; }); return Object.keys(years).map(Number).sort(function(a,b){return b-a;}); }
function monthNameFor(year,monthIndex){ var text=new Intl.DateTimeFormat("es-PE",{month:"long"}).format(new Date(year,monthIndex,1)); return text.charAt(0).toUpperCase()+text.slice(1); }
function monthlySummaryForYear(year,expenses,incomes,parseLocalDate){ var months=[]; for(var i=0;i<12;i++){months.push({key:year+"-"+String(i+1).padStart(2,"0"),month:i,label:monthNameFor(year,i),incomes:0,expenses:0,incomeCount:0,expenseCount:0,balance:0});} (expenses||[]).forEach(function(item){var d=parseLocalDate(item.date);if(!isNaN(d.getTime())&&d.getFullYear()===year){months[d.getMonth()].expenses+=Number(item.amount||0);months[d.getMonth()].expenseCount+=1;}}); (incomes||[]).forEach(function(item){var d=parseLocalDate(item.date);if(!isNaN(d.getTime())&&d.getFullYear()===year){months[d.getMonth()].incomes+=Number(item.amount||0);months[d.getMonth()].incomeCount+=1;}}); months.forEach(function(month){month.balance=month.incomes-month.expenses;}); return months; }
function spentByCategory(expenses,categories){ var map={}; (categories||[]).forEach(function(c){map[c.id]=0;}); (expenses||[]).forEach(function(e){map[e.category]=(map[e.category]||0)+Number(e.amount);}); return map; }
function incomeByCategory(incomes,categories){ var map={}; (categories||[]).forEach(function(c){map[c.id]=0;}); (incomes||[]).forEach(function(e){map[e.category]=(map[e.category]||0)+Number(e.amount);}); return map; }
function analysisMonthItems(year,month,expenses,incomes,parseLocalDate){ return {expenses:(expenses||[]).filter(function(item){var d=parseLocalDate(item.date);return !isNaN(d.getTime())&&d.getFullYear()===year&&d.getMonth()===month;}),incomes:(incomes||[]).filter(function(item){var d=parseLocalDate(item.date);return !isNaN(d.getTime())&&d.getFullYear()===year&&d.getMonth()===month;})}; }
window.GastosFinanceCore={safeArray:safeArray,normalizeAmount:normalizeAmount,makeId:makeId,totalIncomes:totalIncomes,totalExpenses:totalExpenses,availableYears:availableYears,monthNameFor:monthNameFor,monthlySummaryForYear:monthlySummaryForYear,spentByCategory:spentByCategory,incomeByCategory:incomeByCategory,analysisMonthItems:analysisMonthItems};
})();
