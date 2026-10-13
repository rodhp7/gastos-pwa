/* =========================================================
   FLUJO DE CAJA Y PROYECCIONES
========================================================= */
function cashFlowSummary(year, month) {
  year = year == null ? new Date().getFullYear() : year;
  month = month == null ? new Date().getMonth() : month;
  var now = new Date();
  var current = year === now.getFullYear() && month === now.getMonth();
  var days = new Date(year, month + 1, 0).getDate();
  var start = new Date(year, month, 1);
  var end = new Date(year, month, days);
  var incomes = state.incomes.filter(function(i){
    var d=parseLocalDate(i.date); return !isNaN(d.getTime()) && d.getFullYear()===year && d.getMonth()===month;
  });
  var expenses = state.expenses.filter(function(e){
    var d=parseLocalDate(e.date); return !isNaN(d.getTime()) && d.getFullYear()===year && d.getMonth()===month;
  });
  var income = totalIncomes(incomes);
  var spent = totalExpenses(expenses);
  var from = current ? new Date(year, month, Math.min(days, now.getDate()+1)) : start;
  var recurring = recurringProjectedAmount(null, from, end);
  var projectedExpenses = spent + recurring;
  var projectedResult = income - projectedExpenses;
  var elapsed = current ? Math.max(1, now.getDate()) : days;
  var dailySpend = elapsed ? spent / elapsed : 0;
  var projectedByPace = current ? dailySpend * days : spent;
  var projectedAtClose = Math.max(projectedExpenses, projectedByPace + recurring);
  return { income:income, spent:spent, recurring:recurring, projectedExpenses:projectedExpenses,
    projectedResult:projectedResult, projectedAtClose:projectedAtClose, dailySpend:dailySpend,
    available: income - projectedAtClose, current:current };
}

function savingsGoalPlan(goal) {
  var target=Number(goal.target)||0, saved=Number(goal.saved)||0;
  var remaining=Math.max(0,target-saved);
  var deadline=goal.targetDate ? parseLocalDate(goal.targetDate) : null;
  if (!deadline || isNaN(deadline.getTime()) || remaining<=0) return {remaining:remaining, months:0, monthly:0, days:0, status:remaining<=0?'Completada':'Sin fecha objetivo'};
  var now=new Date();
  var months=Math.max(1,(deadline.getFullYear()-now.getFullYear())*12+(deadline.getMonth()-now.getMonth())+(deadline.getDate()>now.getDate()?1:0));
  var monthly=remaining/months;
  var days=Math.ceil((deadline-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
  return {remaining:remaining,months:months,monthly:monthly,days:days,status:days<0?'Atrasada':'En camino'};
}

