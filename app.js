const STORAGE_KEY = "frn-kpi-dashboard-draft-v2";
const KPI_OPTIONS = [
  { key: "overall", label: "Overall KPI" },
  { key: "performance", label: "Performance" },
  { key: "attendance", label: "Attendance" },
  { key: "qa", label: "QA Score" },
  { key: "transferRate", label: "Transfer Rate" },
  { key: "admits", label: "# of Admits" },
  { key: "aht", label: "AHT" }
];

const state = {
  data: null,
  selectedMonth: "",
  selectedTeam: "all",
  selectedAgent: "all",
  search: "",
  focusedKpi: "overall",
  charts: {}
};

const els = {
  lastRefresh: document.getElementById("last-refresh"),
  regenerateData: document.getElementById("regenerate-data"),
  monthSelect: document.getElementById("month-select"),
  teamSelect: document.getElementById("team-select"),
  agentSelect: document.getElementById("agent-select"),
  searchInput: document.getElementById("search-input"),
  focusButtons: document.getElementById("focus-buttons"),
  selectedMonthLabel: document.getElementById("selected-month-label"),
  comparisonMonthLabel: document.getElementById("comparison-month-label"),
  focusKpiLabel: document.getElementById("focus-kpi-label"),
  selectionSummary: document.getElementById("selection-summary"),
  dataStory: document.getElementById("data-story"),
  summaryCards: document.getElementById("summary-cards"),
  kpiMiniGrid: document.getElementById("kpi-mini-grid"),
  trendChart: document.getElementById("trend-chart"),
  trendCurrentScore: document.getElementById("trend-current-score"),
  trendPreviousScore: document.getElementById("trend-previous-score"),
  comparisonTitle: document.getElementById("comparison-title"),
  comparisonCopy: document.getElementById("comparison-copy"),
  metricDirection: document.getElementById("metric-direction"),
  comparisonGrid: document.getElementById("comparison-grid"),
  detailBody: document.getElementById("detail-body"),
  tableCount: document.getElementById("table-count"),
  distributionChart: document.getElementById("distribution-chart"),
  distributionLegend: document.getElementById("distribution-legend"),
  admitsChart: document.getElementById("admits-chart"),
  admitsChartScope: document.getElementById("admits-chart-scope"),
  leaderboard: document.getElementById("leaderboard"),
  leaderboardScope: document.getElementById("leaderboard-scope")
};

bootstrap();

function bootstrap() {
  loadDataset();
  mountEvents();
  populateControls();
  render();
}

function mountEvents() {
  els.regenerateData.addEventListener("click", regenerateDataset);
  els.monthSelect.addEventListener("change", () => {
    state.selectedMonth = els.monthSelect.value;
    render();
  });
  els.teamSelect.addEventListener("change", () => {
    state.selectedTeam = els.teamSelect.value;
    state.selectedAgent = "all";
    populateAgentSelect();
    render();
  });
  els.agentSelect.addEventListener("change", () => {
    state.selectedAgent = els.agentSelect.value;
    render();
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    render();
  });
}

function loadDataset() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.data = saved ? JSON.parse(saved) : buildDataset();
  if (!saved) persistDataset();
  state.selectedMonth = state.data.months[state.data.months.length - 1].key;
}

function regenerateDataset() {
  state.data = buildDataset();
  persistDataset();
  state.selectedMonth = state.data.months[state.data.months.length - 1].key;
  state.selectedTeam = "all";
  state.selectedAgent = "all";
  state.search = "";
  state.focusedKpi = "overall";
  els.searchInput.value = "";
  populateControls();
  render();
}

function persistDataset() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function populateControls() {
  populateMonthSelect();
  populateTeamSelect();
  populateAgentSelect();
  populateFocusButtons();
}

function populateMonthSelect() {
  els.monthSelect.innerHTML = state.data.months.map((month) => `<option value="${month.key}">${month.label}</option>`).join("");
  els.monthSelect.value = state.selectedMonth;
}

function populateTeamSelect() {
  els.teamSelect.innerHTML = ['<option value="all">All Teams</option>'].concat(state.data.teams.map((team) => `<option value="${team}">${team}</option>`)).join("");
  els.teamSelect.value = state.selectedTeam;
}

function populateAgentSelect() {
  const rows = getCurrentMonthRows().filter((row) => state.selectedTeam === "all" || row.team === state.selectedTeam);
  els.agentSelect.innerHTML = ['<option value="all">All Agents</option>'].concat(rows.map((row) => row.agent).sort().map((agent) => `<option value="${agent}">${agent}</option>`)).join("");
  if (![...els.agentSelect.options].some((option) => option.value === state.selectedAgent)) state.selectedAgent = "all";
  els.agentSelect.value = state.selectedAgent;
}

function populateFocusButtons() {
  els.focusButtons.innerHTML = KPI_OPTIONS.map((item) => `<button class="score-chip${item.key === state.focusedKpi ? " active" : ""}" data-kpi="${item.key}" type="button">${item.label}</button>`).join("");
  els.focusButtons.querySelectorAll("[data-kpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusedKpi = button.getAttribute("data-kpi");
      populateFocusButtons();
      render();
    });
  });
}

function render() {
  const selectedMonth = getSelectedMonth();
  const previousMonth = getPreviousMonth(selectedMonth.key);
  const filteredRows = getFilteredRows(selectedMonth.rows);
  const previousRows = previousMonth ? getFilteredRows(previousMonth.rows, { allowMissingAgentFallback: true }) : [];
  const summary = summarizeRows(filteredRows);
  const previousSummary = summarizeRows(previousRows);

  populateAgentSelect();
  updateHeader(selectedMonth, previousMonth);
  renderSummaryCards(summary, previousSummary);
  renderMiniCharts();
  renderTrendChart();
  renderComparison(summary, previousSummary);
  renderDistributionChart(filteredRows);
  renderAdmitsChart(filteredRows);
  renderLeaderboard(filteredRows);
  renderDetailTable(filteredRows);
}

function updateHeader(selectedMonth, previousMonth) {
  const summaryLabel = state.selectedAgent !== "all" ? `${state.selectedAgent} in ${selectedMonth.label}` : state.selectedTeam !== "all" ? `${state.selectedTeam} in ${selectedMonth.label}` : `All teams overview for ${selectedMonth.label}`;
  els.lastRefresh.textContent = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  els.selectedMonthLabel.textContent = selectedMonth.label;
  els.comparisonMonthLabel.textContent = previousMonth ? previousMonth.label : "No prior month";
  els.focusKpiLabel.textContent = getKpiLabel(state.focusedKpi);
  els.selectionSummary.textContent = summaryLabel;
  els.dataStory.textContent = buildStory(selectedMonth, previousMonth);
}

function renderSummaryCards(summary, previousSummary) {
  const cards = [
    { title: "Transfer Rate", sub: `Avg score ${summarizeScore("transferRate", summary)} / 5`, value: formatPercent(summary.transferRate), delta: summary.transferRate - previousSummary.transferRate, metric: "transferRate" },
    { title: "# of Admits", sub: `Avg score ${summarizeScore("admits", summary)} / 5`, value: summary.admits.toFixed(1), delta: summary.admits - previousSummary.admits, metric: "admits" },
    { title: "AHT", sub: `Avg score ${summarizeScore("aht", summary)} / 5`, value: formatTimeFromSeconds(summary.ahtSeconds), delta: summary.ahtSeconds - previousSummary.ahtSeconds, metric: "aht" },
    { title: "Attendance", sub: `Avg score ${summary.attendanceScore.toFixed(2)} / 5`, value: formatPercent(summary.attendance), delta: summary.attendance - previousSummary.attendance, metric: "attendancePercent" },
    { title: "QA Score", sub: `Avg score ${summary.qaScore.toFixed(2)} / 5`, value: formatPercent(summary.qa), delta: summary.qa - previousSummary.qa, metric: "qaPercent" }
  ];

  els.summaryCards.innerHTML = cards.map((card) => `
    <article class="card panel">
      <div class="card-header"><div><h3>${card.title}</h3><span>${card.sub}</span></div></div>
      <strong>${card.value}</strong>
      <div class="delta ${getDeltaTone(card.metric, card.delta)}">${formatMetricDelta(card.metric, card.delta)}</div>
    </article>
  `).join("");
}

function renderMiniCharts() {
  const currentSummary = summarizeRows(getFilteredRows(getSelectedMonth().rows));
  const previousMonth = getPreviousMonth(getSelectedMonth().key);
  const previousSummary = previousMonth ? summarizeRows(getFilteredRows(previousMonth.rows, { allowMissingAgentFallback: true })) : summarizeRows([]);
  const key = focusedMiniKey();
  const currentValue = getMiniMetricValue(currentSummary, key);
  const previousValue = getMiniMetricValue(previousSummary, key);
  const delta = currentValue - previousValue;

  els.kpiMiniGrid.innerHTML = `
    <article class="mini-chart-card panel">
      <div class="mini-chart-head">
        <div><h4>Focused KPI Trend: ${getKpiLabel(key === "attendancePercent" ? "attendance" : key === "qaPercent" ? "qa" : key)}</h4><p>Uses the selected KPI chip above. Hover to inspect monthly values.</p></div>
        <div class="mini-chart-meta">
          <strong>${formatMiniMetric(key, currentValue)}</strong>
          <span class="${getDeltaTone(key, delta)}">${formatMetricDelta(key, delta)}</span>
        </div>
      </div>
      <canvas class="mini-canvas" data-mini-kpi="${key}" width="1280" height="170"></canvas>
    </article>
  `;

  const canvas = els.kpiMiniGrid.querySelector("[data-mini-kpi]");
  const series = state.data.months.map((month) => {
    const summary = summarizeRows(getFilteredRows(month.rows, { allowMissingAgentFallback: true }));
    return { monthKey: month.key, label: month.shortLabel, value: getMiniMetricValue(summary, key) };
  });

  upsertChart("mini-focus", canvas, {
    type: "line",
    data: {
      labels: series.map((item) => item.label),
      datasets: [{
        label: getKpiLabel(key === "attendancePercent" ? "attendance" : key === "qaPercent" ? "qa" : key),
        data: series.map((item) => item.value),
        borderColor: "#15629e",
        backgroundColor: "rgba(21,98,158,.14)",
        pointBackgroundColor: series.map((item) => item.monthKey === getSelectedMonth().key ? "#1f255d" : "#5da9df"),
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: series.map((item) => item.monthKey === getSelectedMonth().key ? 5 : 3),
        tension: .35,
        fill: true,
        borderWidth: 2.5
      }]
    },
    options: buildMiniChartOptions(key)
  });
}

function renderTrendChart() {
  const trend = state.data.months.map((month) => ({
    key: month.key,
    label: month.shortLabel,
    score: summarizeRows(getFilteredRows(month.rows, { allowMissingAgentFallback: true })).overallScore
  }));
  const currentIndex = trend.findIndex((item) => item.key === getSelectedMonth().key);
  const previousScore = currentIndex > 0 ? trend[currentIndex - 1].score : 0;
  const currentScore = currentIndex >= 0 ? trend[currentIndex].score : 0;

  els.trendCurrentScore.textContent = currentScore ? currentScore.toFixed(2) : "-";
  els.trendPreviousScore.textContent = previousScore ? previousScore.toFixed(2) : "-";

  upsertChart("trend", els.trendChart, {
    type: "line",
    data: {
      labels: trend.map((item) => item.label),
      datasets: [{
        label: "Weighted KPI Score",
        data: trend.map((item) => item.score),
        borderColor: "#15629e",
        backgroundColor: "rgba(21,98,158,.16)",
        pointBackgroundColor: trend.map((item) => item.key === getSelectedMonth().key ? "#1f255d" : "#5da9df"),
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: trend.map((item) => item.key === getSelectedMonth().key ? 6 : 4),
        borderWidth: 3,
        tension: .35,
        fill: true
      }]
    },
    options: buildChartOptions({ min: 1, max: 5, valueLabel: "Weighted KPI Score", tooltipFormatter: (value) => value.toFixed(2) })
  });
}

function renderComparison(summary, previousSummary) {
  const currentValue = getSummaryMetric(summary, state.focusedKpi);
  const previousValue = getSummaryMetric(previousSummary, state.focusedKpi);
  const currentInfo = formatMetric(state.focusedKpi, currentValue);
  const previousInfo = formatMetric(state.focusedKpi, previousValue);
  const maxValue = getMetricVisualMax(state.focusedKpi, currentValue, previousValue);
  const delta = currentValue - previousValue;

  els.comparisonTitle.textContent = `${getKpiLabel(state.focusedKpi)} Comparison`;
  els.comparisonCopy.textContent = `${currentInfo.copy} versus the previous month in the current filter context.`;
  els.metricDirection.textContent = delta === 0 ? "Flat versus previous month" : `${delta > 0 ? "Up" : "Down"} ${formatSigned(delta, state.focusedKpi)}`;

  els.comparisonGrid.innerHTML = [
    { title: "Current Month", info: currentInfo, value: currentValue },
    { title: "Previous Month", info: previousInfo, value: previousValue }
  ].map((item) => `
    <div class="compare-box">
      <span>${item.title}</span>
      <strong>${item.info.display}</strong>
      <div class="pill-note">${item.info.subtext}</div>
      <div class="compare-bar"><span style="width:${Math.max(6, (item.value / maxValue) * 100)}%"></span></div>
    </div>
  `).join("");
}

function renderDistributionChart(rows) {
  const labels = ["1", "2", "3", "4", "5"];
  const counts = [1, 2, 3, 4, 5].map((score) => rows.filter((row) => getRowScore(row, state.focusedKpi) === score).length);
  const colors = ["#c64954", "#cf8a27", "#9bb7d4", "#5fa5da", "#1f255d"];

  upsertChart("distribution", els.distributionChart, {
    type: "bar",
    data: { labels, datasets: [{ label: `${getKpiLabel(state.focusedKpi)} score distribution`, data: counts, backgroundColor: colors, borderRadius: 10 }] },
    options: buildChartOptions({ valueLabel: "Agents", tooltipFormatter: (value, label) => `${value} agent(s) in score ${label}` })
  });

  els.distributionLegend.innerHTML = labels.map((label, index) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${colors[index]}"></i> Score ${label}</span>`).join("");
}

function renderAdmitsChart(rows) {
  const ranked = [...rows].sort((a, b) => b.admits - a.admits).slice(0, 10);
  els.admitsChartScope.textContent = state.selectedAgent !== "all" ? `${state.selectedAgent} selected` : state.selectedTeam !== "all" ? `${state.selectedTeam} team` : "All teams";

  upsertChart("admits", els.admitsChart, {
    type: "bar",
    data: {
      labels: ranked.map((row) => row.agent),
      datasets: [{ label: "# of Admits", data: ranked.map((row) => row.admits), backgroundColor: ranked.map((row) => row.agent === state.selectedAgent ? "#1f255d" : "#5da9df"), borderRadius: 10 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      onClick: (_, elements, chart) => {
        if (!elements.length) return;
        state.selectedAgent = chart.data.labels[elements[0].index];
        els.agentSelect.value = state.selectedAgent;
        render();
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(12,23,48,.96)",
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => items[0].label,
            label: (context) => `${context.raw} admits`
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#5a728f", font: { family: "Manrope", size: 11 } }, grid: { color: "#dde8f5" } },
        y: { ticks: { color: "#2b4362", font: { family: "Manrope", size: 11, weight: "700" } }, grid: { display: false } }
      }
    }
  });
}

function renderLeaderboard(rows) {
  const topRows = [...rows].sort((a, b) => b.overallScore - a.overallScore).slice(0, 6);
  els.leaderboardScope.textContent = state.selectedAgent !== "all" ? state.selectedAgent : state.selectedTeam !== "all" ? state.selectedTeam : "All teams";
  if (!topRows.length) {
    els.leaderboard.innerHTML = '<div class="empty-state">No agents match the current filter.</div>';
    return;
  }

  els.leaderboard.innerHTML = topRows.map((row, index) => `
    <button class="leader-item${row.agent === state.selectedAgent ? " active" : ""}" data-agent="${row.agent}" type="button">
      <div><small>#${index + 1} ${row.team}</small><strong>${row.agent}</strong><span>${formatPercent(row.transferRate)} transfer | ${row.admits} admits | ${formatTimeFromSeconds(row.ahtSeconds)} AHT</span></div>
      <strong>${row.overallScore.toFixed(2)}</strong>
    </button>
  `).join("");

  els.leaderboard.querySelectorAll("[data-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedAgent = button.getAttribute("data-agent");
      els.agentSelect.value = state.selectedAgent;
      render();
    });
  });
}

function renderDetailTable(rows) {
  els.tableCount.textContent = `${rows.length} agents shown`;
  if (!rows.length) {
    els.detailBody.innerHTML = '<tr><td colspan="9" class="empty-state">No data for the current filter.</td></tr>';
    return;
  }

  els.detailBody.innerHTML = [...rows].sort((a, b) => b.overallScore - a.overallScore).map((row) => `
    <tr>
      <td>${row.agent}</td>
      <td>${row.team}</td>
      <td>${formatPercent(row.transferRate)} <span class="${scoreClass(row.transferRateScore)}">${row.transferRateScore}</span></td>
      <td>${row.admits} <span class="${scoreClass(row.admitsScore)}">${row.admitsScore}</span></td>
      <td>${formatTimeFromSeconds(row.ahtSeconds)} <span class="${scoreClass(row.ahtScore)}">${row.ahtScore}</span></td>
      <td>${formatPercent(row.attendance)} <span class="${scoreClass(row.attendanceScore)}">${row.attendanceScore}</span></td>
      <td>${formatPercent(row.qa)} <span class="${scoreClass(row.qaScore)}">${row.qaScore}</span></td>
      <td><span class="${scoreClass(row.performanceScore)}">${row.performanceScore.toFixed(2)}</span></td>
      <td><span class="${scoreClass(row.overallScore)}">${row.overallScore.toFixed(2)}</span></td>
    </tr>
  `).join("");
}

function getSelectedMonth() {
  return state.data.months.find((month) => month.key === state.selectedMonth) || state.data.months[state.data.months.length - 1];
}

function getCurrentMonthRows() {
  return getSelectedMonth().rows;
}

function getPreviousMonth(monthKey) {
  const index = state.data.months.findIndex((month) => month.key === monthKey);
  return index > 0 ? state.data.months[index - 1] : null;
}

function getFilteredRows(rows, options = {}) {
  let nextRows = rows;
  if (state.selectedTeam !== "all") nextRows = nextRows.filter((row) => row.team === state.selectedTeam);
  if (state.selectedAgent !== "all") {
    nextRows = nextRows.filter((row) => row.agent === state.selectedAgent);
    if (!nextRows.length && options.allowMissingAgentFallback) nextRows = rows.filter((row) => state.selectedTeam === "all" || row.team === state.selectedTeam);
  }
  if (state.search) nextRows = nextRows.filter((row) => row.agent.toLowerCase().includes(state.search));
  return nextRows;
}

function summarizeRows(rows) {
  if (!rows.length) return { count: 0, overallScore: 0, performanceScore: 0, attendanceScore: 0, qaScore: 0, transferRate: 0, admits: 0, ahtSeconds: 0, attendance: 0, qa: 0 };

  const total = rows.reduce((acc, row) => {
    acc.overallScore += row.overallScore;
    acc.performanceScore += row.performanceScore;
    acc.attendanceScore += row.attendanceScore;
    acc.qaScore += row.qaScore;
    acc.transferRate += row.transferRate;
    acc.admits += row.admits;
    acc.ahtSeconds += row.ahtSeconds;
    acc.attendance += row.attendance;
    acc.qa += row.qa;
    return acc;
  }, { overallScore: 0, performanceScore: 0, attendanceScore: 0, qaScore: 0, transferRate: 0, admits: 0, ahtSeconds: 0, attendance: 0, qa: 0 });

  return {
    count: rows.length,
    overallScore: total.overallScore / rows.length,
    performanceScore: total.performanceScore / rows.length,
    attendanceScore: total.attendanceScore / rows.length,
    qaScore: total.qaScore / rows.length,
    transferRate: total.transferRate / rows.length,
    admits: total.admits / rows.length,
    ahtSeconds: total.ahtSeconds / rows.length,
    attendance: total.attendance / rows.length,
    qa: total.qa / rows.length
  };
}

function getSummaryMetric(summary, key) {
  switch (key) {
    case "performance": return summary.performanceScore;
    case "attendance": return summary.attendanceScore;
    case "qa": return summary.qaScore;
    case "transferRate": return summary.transferRate;
    case "admits": return summary.admits;
    case "aht": return summary.ahtSeconds;
    default: return summary.overallScore;
  }
}

function getMiniMetricValue(summary, key) {
  switch (key) {
    case "attendancePercent": return summary.attendance;
    case "qaPercent": return summary.qa;
    default: return getSummaryMetric(summary, key);
  }
}

function focusedMiniKey() {
  switch (state.focusedKpi) {
    case "attendance": return "attendancePercent";
    case "qa": return "qaPercent";
    default: return state.focusedKpi;
  }
}

function formatMetric(key, value) {
  switch (key) {
    case "transferRate": return { display: formatPercent(value), subtext: "Average transfer rate", copy: "Transfer rate average" };
    case "admits": return { display: value.toFixed(1), subtext: "Average admits", copy: "Admits average" };
    case "aht": return { display: formatTimeFromSeconds(value), subtext: "Average handle time", copy: "AHT average" };
    case "attendance": return { display: value.toFixed(2), subtext: "Average KPI score", copy: "Attendance KPI score" };
    case "qa": return { display: value.toFixed(2), subtext: "Average KPI score", copy: "QA KPI score" };
    case "performance": return { display: value.toFixed(2), subtext: "Average KPI score", copy: "Performance KPI score" };
    default: return { display: value.toFixed(2), subtext: "Weighted final KPI score", copy: "Overall KPI score" };
  }
}

function getMetricVisualMax(key, currentValue, previousValue) {
  const maxValue = Math.max(currentValue, previousValue, 1);
  switch (key) {
    case "transferRate": return Math.max(maxValue, 16);
    case "admits": return Math.max(maxValue, 14);
    case "aht": return Math.max(maxValue, 260);
    default: return 5;
  }
}

function getRowScore(row, key) {
  switch (key) {
    case "performance": return Math.round(row.performanceScore);
    case "attendance": return row.attendanceScore;
    case "qa": return row.qaScore;
    case "transferRate": return row.transferRateScore;
    case "admits": return row.admitsScore;
    case "aht": return row.ahtScore;
    default: return Math.round(row.overallScore);
  }
}

function buildStory(selectedMonth, previousMonth) {
  const scope = state.selectedAgent !== "all" ? state.selectedAgent : state.selectedTeam !== "all" ? state.selectedTeam : "all teams";
  return `Viewing ${scope} for ${selectedMonth.label}. ${previousMonth ? `Benchmarking against ${previousMonth.label}.` : "No earlier month available yet."}`;
}

function getKpiLabel(key) {
  return KPI_OPTIONS.find((item) => item.key === key)?.label || "Overall KPI";
}

function summarizeScore(metricKey, summary) {
  switch (metricKey) {
    case "transferRate": return scoreTransferRate(summary.transferRate).toFixed(2);
    case "admits": return scoreAdmits(summary.admits).toFixed(2);
    case "aht": return scoreAht(summary.ahtSeconds).toFixed(2);
    default: return "0.00";
  }
}

function formatMiniMetric(key, value) {
  switch (key) {
    case "transferRate":
    case "attendancePercent":
    case "qaPercent":
      return formatPercent(value);
    case "admits":
      return value.toFixed(1);
    case "aht":
      return formatTimeFromSeconds(value);
    default:
      return String(value);
  }
}

function formatMetricDelta(metric, value) {
  if (Number.isNaN(value)) return "No previous month";
  if (value === 0) return "No change";
  switch (metric) {
    case "transferRate":
    case "attendancePercent":
    case "qaPercent":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)} pts vs prev`;
    case "admits":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)} vs prev`;
    case "aht":
      return `${value > 0 ? "+" : "-"}${formatTimeFromSeconds(Math.abs(value))} vs prev`;
    default:
      return `${value > 0 ? "+" : ""}${value.toFixed(2)} vs prev`;
  }
}

function getDeltaTone(metric, value) {
  if (value === 0) return "flat";
  if (metric === "aht") return value < 0 ? "up" : "down";
  return value > 0 ? "up" : "down";
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatTimeFromSeconds(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function formatSigned(value, key) {
  if (key === "transferRate") return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  if (key === "aht") return `${value > 0 ? "+" : "-"}${formatTimeFromSeconds(Math.abs(value))}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function scoreClass(score) {
  if (score >= 4.5) return "tag good";
  if (score >= 3) return "tag";
  if (score >= 2) return "tag warn";
  return "tag bad";
}

function upsertChart(key, canvas, config) {
  if (!canvas || typeof Chart === "undefined") return;
  state.charts[key]?.destroy();
  state.charts[key] = new Chart(canvas.getContext("2d"), config);
}

function buildChartOptions({ min, max, valueLabel, tooltipFormatter } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(12,23,48,.96)",
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `${valueLabel || context.dataset.label}: ${tooltipFormatter ? tooltipFormatter(context.raw, context.label) : context.raw}`
        }
      }
    },
    scales: {
      x: { ticks: { color: "#5a728f", font: { family: "Manrope", size: 11 } }, grid: { display: false } },
      y: { min, max, beginAtZero: min === undefined, ticks: { color: "#5a728f", font: { family: "Manrope", size: 11 } }, grid: { color: "#dde8f5" } }
    }
  };
}

function buildMiniChartOptions(key) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(12,23,48,.96)",
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => formatMiniMetric(key, context.raw)
        }
      }
    },
    scales: {
      x: { ticks: { color: "#5a728f", font: { family: "Manrope", size: 10 }, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { display: false }, grid: { color: "#e3edf8", drawTicks: false } }
    }
  };
}

function buildDataset() {
  const teams = ["North Star", "Blue Wing", "Recovery Ops", "Premier Queue"];
  const names = [
    "Aly Reyes", "Ben Flores", "Carla Santos", "Dane Molina", "Ella Cruz", "Faith Ramos",
    "Gio Navarro", "Hana Lopez", "Ivan Sy", "Jade Mercado", "Kyle Bautista", "Lia Salazar",
    "Mika Torres", "Nico Dela Cruz", "Owen Garcia", "Paula Lim", "Quin Velasco", "Rae David",
    "Sean Castro", "Tina Gomez", "Uma Villanueva", "Vince Perez", "Wen Alonzo", "Ysa Romero"
  ];
  const months = [];
  const startDate = new Date("2025-09-01T00:00:00");
  let cursor = 0;

  for (let monthOffset = 0; monthOffset < 8; monthOffset += 1) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(startDate.getMonth() + monthOffset);
    const monthKey = monthDate.toISOString().slice(0, 7);
    const label = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
    const shortLabel = monthDate.toLocaleString("en-US", { month: "short" });
    const rows = [];

    teams.forEach((team, teamIndex) => {
      for (let member = 0; member < 6; member += 1) {
        const agent = names[cursor % names.length];
        cursor += 1;
        rows.push(buildRow({
          agent,
          team,
          transferRate: clamp(2.1 + teamIndex * 1.1 + monthOffset * 0.55 + randomBetween(-1.5, 2.5), 1.2, 16.4),
          admits: clamp(2 + teamIndex + monthOffset * 0.6 + randomBetween(-2, 5), 0, 16),
          ahtSeconds: clamp(240 - monthOffset * 8 - teamIndex * 4 + randomBetween(-35, 30), 92, 265),
          attendance: clamp(91 + monthOffset * 0.7 + teamIndex * 0.4 + randomBetween(-3.5, 4), 86, 100),
          qa: clamp(95.1 + monthOffset * 0.32 + teamIndex * 0.15 + randomBetween(-1.8, 1.9), 92.5, 100)
        }));
      }
    });

    months.push({ key: monthKey, label, shortLabel, rows });
  }

  return { generatedAt: new Date().toISOString(), teams, months };
}

function buildRow({ agent, team, transferRate, admits, ahtSeconds, attendance, qa }) {
  const transferRateScore = scoreTransferRate(transferRate);
  const admitsScore = scoreAdmits(admits);
  const ahtScore = scoreAht(ahtSeconds);
  const attendanceScore = scoreAttendance(attendance);
  const qaScore = scoreQa(qa);
  const performanceScore = (transferRateScore + admitsScore + ahtScore) / 3;
  const overallScore = performanceScore * 0.5 + attendanceScore * 0.25 + qaScore * 0.25;

  return {
    agent,
    team,
    transferRate: roundTo(transferRate, 1),
    admits: Math.round(admits),
    ahtSeconds: Math.round(ahtSeconds),
    attendance: roundTo(attendance, 1),
    qa: roundTo(qa, 1),
    transferRateScore,
    admitsScore,
    ahtScore,
    attendanceScore,
    qaScore,
    performanceScore: roundTo(performanceScore, 2),
    overallScore: roundTo(overallScore, 2)
  };
}

function scoreTransferRate(value) {
  if (value < 3) return 1;
  if (value < 7.5) return 2;
  if (value < 10.5) return 3;
  if (value < 15) return 4;
  return 5;
}

function scoreAdmits(value) {
  if (value <= 0) return 1;
  if (value <= 1) return 2;
  if (value <= 5) return 3;
  if (value <= 13) return 4;
  return 5;
}

function scoreAht(value) {
  if (value > 249) return 1;
  if (value > 212) return 2;
  if (value > 176) return 3;
  if (value > 104) return 4;
  return 5;
}

function scoreAttendance(value) {
  if (value < 90) return 1;
  if (value <= 94) return 2;
  if (value < 100) return 3;
  return 5;
}

function scoreQa(value) {
  if (value < 95) return 1;
  if (value < 98) return 2;
  if (value < 99) return 3;
  if (value < 100) return 4;
  return 5;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, digits) {
  return Number(value.toFixed(digits));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
