// Revenue model: the same numbers as EduSnap_Revenue_Model.xlsx, the report and the pitch deck.

const FEE = 49;          // Snap & Learn, rand per month
const FAMILY_FEE = 89;   // Family plan, rand per month
const SERVER_COST = 5;   // rand per user per month
const HOSTING = 150;     // rand per month
const FREE_PER_DAY = 5;
const PAID_PER_MONTH = 100;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Jan, Feb, Mar and Dec come from the group's plan; Apr to Nov are estimated steady growth.
const SUBSCRIBERS = [100, 250, 500, 583, 680, 794, 926, 1080, 1260, 1470, 1714, 2000];

const rows = SUBSCRIBERS.map((subs, i) => {
  const revenue = subs * FEE;
  const server = subs * SERVER_COST;
  return { month: MONTHS[i], subs, revenue, server, net: revenue - server - HOSTING };
});

const sum = (key) => rows.reduce((t, r) => t + r[key], 0);
const sortedRevenue = rows.map((r) => r.revenue).sort((a, b) => a - b);
const mid = Math.floor(sortedRevenue.length / 2);

const totals = { revenue: sum('revenue'), server: sum('server'), hosting: HOSTING * 12, net: sum('net') };
const stats = {
  mean: totals.revenue / rows.length,
  median: (sortedRevenue[mid - 1] + sortedRevenue[mid]) / 2,
  min: sortedRevenue[0],
  max: sortedRevenue[sortedRevenue.length - 1],
  range: sortedRevenue[sortedRevenue.length - 1] - sortedRevenue[0],
  margin: totals.net / totals.revenue,
  growth: SUBSCRIBERS[SUBSCRIBERS.length - 1] / SUBSCRIBERS[0],
};

module.exports = { FEE, FAMILY_FEE, SERVER_COST, HOSTING, FREE_PER_DAY, PAID_PER_MONTH, MONTHS, SUBSCRIBERS, rows, totals, stats };
