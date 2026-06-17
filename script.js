(function () {
  const storageKey = "nanstar-wealth-v1";
  const syncMetaKey = "nanstar-wealth-sync-meta";
  const syncTokenKey = "nanstar-wealth-sync-token";
  const themeKey = "nanstar-wealth-theme";
  const palette = ["#34d399", "#60a5fa", "#f59e0b", "#fb7185", "#a78bfa", "#22d3ee", "#f97316"];
  const typeNames = {
    stock: "股票",
    fund: "基金",
    etf: "ETF",
    cash: "现金",
    crypto: "加密"
  };
  const actionNames = {
    buy: "买入",
    sell: "卖出",
    auto: "定投",
    bonus: "活动",
    dividend: "分红",
    deposit: "转入",
    withdraw: "转出"
  };
  const statusNames = {
    confirmed: "确认成功",
    pending: "进行中",
    failed: "失败",
    canceled: "已撤销"
  };
  const demoSeedTransactionIds = new Set(["tx-001", "tx-002", "tx-003", "tx-004", "tx-005", "tx-006", "tx-007"]);
  const fx = {
    CNY: 1,
    USD: 7.22,
    HKD: 0.92
  };
  const instrumentRangeLabels = {
    intraday: "分时",
    daily: "日K",
    weekly: "周K",
    monthly: "月K"
  };
  const chartColors = {
    green: "#34d399",
    red: "#fb7185",
    blue: "#60a5fa",
    amber: "#f59e0b",
    grid: "rgba(148, 163, 184, 0.16)",
    text: "#e2e8f0"
  };

  function createEmptyState() {
    return {
      prices: {},
      dayChangePct: {},
      watchlist: [],
      transactions: []
    };
  }

  const els = {
    pageTitle: document.getElementById("pageTitle"),
    totalValue: document.getElementById("totalValue"),
    totalCost: document.getElementById("totalCost"),
    totalPnl: document.getElementById("totalPnl"),
    totalPnlRate: document.getElementById("totalPnlRate"),
    dayChange: document.getElementById("dayChange"),
    dayChangeRate: document.getElementById("dayChangeRate"),
    cashValue: document.getElementById("cashValue"),
    cashWeight: document.getElementById("cashWeight"),
    wealthChart: document.getElementById("wealthChart"),
    allocationChart: document.getElementById("allocationChart"),
    allocationLegend: document.getElementById("allocationLegend"),
    topHoldingsBody: document.getElementById("topHoldingsBody"),
    holdingsBody: document.getElementById("holdingsBody"),
    transactionsBody: document.getElementById("transactionsBody"),
    transactionSummary: document.getElementById("transactionSummary"),
    transactionFilters: document.getElementById("transactionFilters"),
    transactionRecordList: document.getElementById("transactionRecordList"),
    recentTransactions: document.getElementById("recentTransactions"),
    analysisRangeFilters: document.getElementById("analysisRangeFilters"),
    analysisTypeFilters: document.getElementById("analysisTypeFilters"),
    analysisSummary: document.getElementById("analysisSummary"),
    analysisChart: document.getElementById("analysisChart"),
    analysisCalendar: document.getElementById("analysisCalendar"),
    analysisContributors: document.getElementById("analysisContributors"),
    riskList: document.getElementById("riskList"),
    noteList: document.getElementById("noteList"),
    syncStatusText: document.getElementById("syncStatusText"),
    syncLastText: document.getElementById("syncLastText"),
    transactionDrawerEyebrow: document.getElementById("transactionDrawerEyebrow"),
    transactionDrawerTitle: document.getElementById("transactionDrawerTitle"),
    saveTransactionButton: document.getElementById("saveTransactionButton"),
    searchResults: document.getElementById("instrumentSearchResults"),
    lookupPanel: document.getElementById("lookupPanel"),
    lookupTitle: document.getElementById("lookupTitle"),
    lookupStatus: document.getElementById("lookupStatus"),
    lookupStats: document.getElementById("lookupStats"),
    fundTrendChart: document.getElementById("fundTrendChart"),
    instrumentDrawer: document.getElementById("instrumentDrawer"),
    instrumentTitle: document.getElementById("instrumentTitle"),
    instrumentSummary: document.getElementById("instrumentSummary"),
    instrumentStatus: document.getElementById("instrumentStatus"),
    instrumentChartTitle: document.getElementById("instrumentChartTitle"),
    instrumentChartStats: document.getElementById("instrumentChartStats"),
    instrumentTrendChart: document.getElementById("instrumentTrendChart"),
    instrumentTransactions: document.getElementById("instrumentTransactions"),
    instrumentChartRanges: document.getElementById("instrumentChartRanges"),
    drawer: document.getElementById("transactionDrawer"),
    backdrop: document.getElementById("drawerBackdrop"),
    form: document.getElementById("transactionForm"),
    toast: document.getElementById("toast")
  };

  let localStateSource = "sample";
  const state = loadState();
  let activeType = "all";
  let activeRange = "3m";
  let activeTransactionFilter = "all";
  let activeAnalysisRange = "3m";
  let activeAnalysisType = "all";
  let latestLookup = null;
  let cloudSyncReady = false;
  let cloudSyncTimer = null;
  let cloudSyncInFlight = false;
  let cloudSyncQueued = false;
  let cloudSyncNoticeShown = false;
  let cloudSyncPoller = null;
  const lookupBySymbol = new Map();
  let activeInstrumentDetail = null;
  let wealthChartApi = null;
  let wealthSeriesApi = null;
  let analysisChartApi = null;
  let analysisSeriesApi = null;
  let instrumentChartApi = null;
  let instrumentSeriesApi = null;
  let instrumentAreaSeriesApi = null;
  let instrumentCandlesSeriesApi = null;
  let currentInstrumentChartType = null;
  let currentInstrumentRange = "intraday";
  let instrumentChartRequestId = 0;
  const analysisHistoryCache = new Map();
  let analysisHistoryInFlight = false;
  let analysisHistoryQueued = false;
  let analysisHistoryRefreshPending = false;
  let importPreviewData = null;
  let importPreviewRows = [];

  init();

  function init() {
    applyTheme(localStorage.getItem(themeKey) || "dark");
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    document.querySelectorAll("[data-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.jump));
    });
    document.querySelectorAll(".segmented button").forEach((button) => {
      button.addEventListener("click", () => {
        activeRange = button.dataset.range;
        document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
        drawWealthChart(computePortfolio());
      });
    });
    document.querySelectorAll("#assetFilters button").forEach((button) => {
      button.addEventListener("click", () => {
        activeType = button.dataset.type;
        document.querySelectorAll("#assetFilters button").forEach((item) => item.classList.toggle("active", item === button));
        renderHoldings(computePortfolio());
      });
    });

    document.getElementById("themeToggle").addEventListener("click", () => {
      const next = document.body.classList.contains("theme-light") ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(themeKey, next);
      render();
    });
    document.getElementById("openTransactionButton").addEventListener("click", openDrawer);
    document.getElementById("openTransactionButton2").addEventListener("click", openDrawer);
    document.getElementById("openWatchlistButton").addEventListener("click", openWatchlistDrawer);
    document.getElementById("openImportButton").addEventListener("click", openImportDrawer);
    document.getElementById("closeImportButton").addEventListener("click", closeImportDrawer);
    document.getElementById("parseImportFileButton").addEventListener("click", parseImportFile);
    document.getElementById("applyImportFileButton").addEventListener("click", applyImportPreview);
    document.getElementById("parseImportTextButton").addEventListener("click", parseImportText);
    document.getElementById("applyImportTextButton").addEventListener("click", applyImportPreview);
    document.getElementById("ocrImportButton").addEventListener("click", () => showToast("OCR 会在交易导入格式稳定后接入"));
    document.getElementById("syncTokenButton").addEventListener("click", configureSyncToken);
    document.getElementById("syncNowButton").addEventListener("click", () => syncCloudState({ forcePush: true }));
    document.getElementById("closeDrawerButton").addEventListener("click", closeDrawer);
    document.getElementById("closeInstrumentButton").addEventListener("click", closeInstrumentDrawer);
    els.instrumentChartRanges.addEventListener("click", handleInstrumentRangeClick);
    els.instrumentChartRanges.querySelectorAll("button[data-instrument-range]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeInstrumentRange(button.dataset.instrumentRange || "daily");
      });
    });
    els.backdrop.addEventListener("click", () => {
      if (els.instrumentDrawer.classList.contains("open")) closeInstrumentDrawer();
      else if (document.getElementById("importDrawer").classList.contains("open")) closeImportDrawer();
      else closeDrawer();
    });
    document.getElementById("resetButton").addEventListener("click", clearAllData);
    document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
    els.form.addEventListener("submit", saveTransaction);
    document.getElementById("txSymbol").addEventListener("input", debounce(handleSymbolInput, 420));
    document.getElementById("txSymbol").addEventListener("blur", handleSymbolInput);
    document.getElementById("txName").addEventListener("input", debounce(handleNameSearchInput, 420));
    document.getElementById("txDate").addEventListener("change", handleSymbolInput);
    document.getElementById("txTime").addEventListener("change", handleSymbolInput);
    document.getElementById("txType").addEventListener("change", () => {
      updateInputModeLabels();
      handleSymbolInput();
    });
    els.searchResults.addEventListener("click", handleSearchResultClick);
    document.getElementById("txInputMode").addEventListener("change", updateInputModeLabels);
    els.holdingsBody.addEventListener("click", handleHoldingsAction);
    els.topHoldingsBody.addEventListener("click", handleHoldingsAction);
    els.transactionsBody.addEventListener("click", handleTransactionAction);
    els.transactionRecordList.addEventListener("click", handleTransactionAction);
    els.transactionFilters.addEventListener("click", handleTransactionFilterClick);
    els.instrumentTransactions.addEventListener("click", handleTransactionAction);
    els.analysisContributors.addEventListener("click", handleHoldingsAction);
    els.analysisRangeFilters.addEventListener("click", handleAnalysisRangeClick);
    els.analysisTypeFilters.addEventListener("click", handleAnalysisTypeClick);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncCloudState();
    });

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("txDate").value = today;
    document.getElementById("txTime").value = "15:01";
    ensureStateShape();
    updateInputModeLabels();
    render();
    syncCloudState().finally(() => refreshMarketData());
    cloudSyncPoller = setInterval(() => syncCloudState(), 15000);
    window.addEventListener("resize", debounce(() => {
      resizeCharts();
    }, 160));
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        localStateSource = "stored";
        return JSON.parse(stored);
      }
    } catch {
      // Ignore broken local data and fall back to the bundled sample.
    }
    return createEmptyState();
  }

  function persist(options = {}) {
    localStorage.setItem(storageKey, JSON.stringify(state));
    const meta = getSyncMeta();
    meta.localUpdatedAt = new Date().toISOString();
    if (options.sync !== false) {
      meta.dirty = true;
      setSyncMeta(meta);
      scheduleCloudSave();
      return;
    }
    setSyncMeta(meta);
  }

  function getSyncMeta() {
    try {
      return JSON.parse(localStorage.getItem(syncMetaKey) || "{}") || {};
    } catch {
      return {};
    }
  }

  function setSyncMeta(meta) {
    localStorage.setItem(syncMetaKey, JSON.stringify(meta || {}));
  }

  function cloudHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem(syncTokenKey);
    if (token) headers["x-nanstar-sync-token"] = token;
    return headers;
  }

  function configureSyncToken() {
    const current = localStorage.getItem(syncTokenKey) || "";
    const next = window.prompt("输入 NanStar Wealth 云端同步口令。留空会清除本机口令。", current);
    if (next === null) return;
    const token = next.trim();
    if (token) {
      localStorage.setItem(syncTokenKey, token);
      cloudSyncReady = true;
      showToast("同步口令已保存");
      syncCloudState().finally(() => scheduleCloudSave(0));
      return;
    }
    localStorage.removeItem(syncTokenKey);
    cloudSyncReady = false;
    showToast("已清除同步口令");
  }

  async function syncCloudState(options = {}) {
    try {
      updateSyncStatus("同步中");
      const response = await fetch("/api/state", { cache: "no-store", headers: cloudHeaders() });
      if (response.status === 401 || response.status === 403 || response.status === 503) return;
      if (!response.ok) throw new Error(`云端同步失败 ${response.status}`);
      const data = await response.json();
      cloudSyncReady = true;
      const remoteState = data.state;
      const remoteUpdatedAt = data.updatedAt || "";
      const meta = getSyncMeta();

      if (options.forcePush || (!remoteState && localStateSource === "stored")) {
        await pushCloudState();
        updateSyncStatus("已同步", remoteUpdatedAt || getSyncMeta().remoteUpdatedAt || "");
        return;
      }

      if (remoteState && (!meta.remoteUpdatedAt || remoteUpdatedAt !== meta.remoteUpdatedAt || meta.dirty === false)) {
        const merged = mergeCloudState(remoteState);
        const changed = JSON.stringify(merged) !== JSON.stringify(remoteState);
        replaceState(merged);
        ensureStateShape();
        persist({ sync: false });
        setSyncMeta({ ...getSyncMeta(), remoteUpdatedAt, dirty: false });
        render();
        updateSyncStatus("已同步", remoteUpdatedAt);
        if (changed || meta.dirty) scheduleCloudSave(0);
        if (!cloudSyncNoticeShown) {
          showToast("已从云端同步数据");
          cloudSyncNoticeShown = true;
        }
        return;
      }

      updateSyncStatus(cloudSyncReady ? "已连接" : "未连接", remoteUpdatedAt || getSyncMeta().remoteUpdatedAt || "");
    } catch {
      // Keep local-first behavior when the cloud endpoint is unavailable.
      updateSyncStatus("未连接");
    }
  }

  function mergeCloudState(remoteState) {
    const merged = JSON.parse(JSON.stringify(state));
    const remote = JSON.parse(JSON.stringify(remoteState || {}));
    merged.prices = { ...(remote.prices || {}), ...(merged.prices || {}) };
    merged.dayChangePct = { ...(remote.dayChangePct || {}), ...(merged.dayChangePct || {}) };
    merged.watchlist = mergeBySymbol(remote.watchlist || [], merged.watchlist || []);
    merged.transactions = mergeById(remote.transactions || [], merged.transactions || []);
    return merged;
  }

  function mergeBySymbol(a, b) {
    const map = new Map();
    [...a, ...b].forEach((item) => {
      if (!item?.symbol) return;
      map.set(item.symbol, item);
    });
    return Array.from(map.values());
  }

  function mergeById(a, b) {
    const map = new Map();
    [...a, ...b].forEach((item) => {
      if (!item?.id) return;
      map.set(item.id, item);
    });
    return Array.from(map.values()).sort((left, right) => `${left.date || ""} ${left.time || ""}`.localeCompare(`${right.date || ""} ${right.time || ""}`));
  }

  function replaceState(nextState) {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, JSON.parse(JSON.stringify(nextState || createEmptyState())));
  }

  function scheduleCloudSave(delay = 900) {
    if (!cloudSyncReady) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => pushCloudState(), delay);
  }

  async function pushCloudState() {
    if (cloudSyncInFlight) {
      cloudSyncQueued = true;
      return;
    }
    cloudSyncInFlight = true;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: cloudHeaders(),
        body: JSON.stringify({ state })
      });
      if (response.status === 401 || response.status === 403 || response.status === 503) return;
      if (!response.ok) throw new Error(`云端保存失败 ${response.status}`);
      const data = await response.json();
      setSyncMeta({ ...getSyncMeta(), remoteUpdatedAt: data.updatedAt || "", dirty: false });
      updateSyncStatus("已上传", data.updatedAt || "");
      if (!cloudSyncNoticeShown) {
        showToast("云端同步已开启");
        cloudSyncNoticeShown = true;
      }
    } catch {
      const meta = getSyncMeta();
      meta.dirty = true;
      setSyncMeta(meta);
    } finally {
      cloudSyncInFlight = false;
      if (cloudSyncQueued) {
        cloudSyncQueued = false;
        scheduleCloudSave(500);
      }
    }
  }

  function updateSyncStatus(status, updatedAt = "") {
    if (els.syncStatusText) els.syncStatusText.textContent = status || "未连接";
    if (els.syncLastText) els.syncLastText.textContent = updatedAt ? formatSyncTime(updatedAt) : "--";
  }

  function formatSyncTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "--");
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  async function refreshMarketData() {
    const instruments = new Map();
    state.transactions.forEach((tx) => {
      if (!tx.symbol || tx.type === "cash") return;
      instruments.set(tx.symbol, { symbol: tx.symbol, type: tx.type || "fund" });
    });
    (state.watchlist || []).forEach((item) => {
      if (!item.symbol || item.type === "cash") return;
      instruments.set(item.symbol, { symbol: item.symbol, type: item.type || "fund" });
    });
    if (!instruments.size) return;

    let updated = false;
    await Promise.allSettled(Array.from(instruments.values()).map(async (item) => {
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(item.symbol)}?kind=${encodeURIComponent(item.type)}`);
      const latestPrice = Number.isFinite(data.nav)
        ? data.nav
        : Number.isFinite(data.price)
          ? data.price
          : Number.isFinite(data.estimatedNav)
            ? data.estimatedNav
            : null;
      if (Number.isFinite(latestPrice)) {
        state.prices[item.symbol] = latestPrice;
        updated = true;
      }
      if (Number.isFinite(data.estimatedChangePct)) {
        state.dayChangePct[item.symbol] = data.estimatedChangePct / 100;
        updated = true;
      }
      lookupBySymbol.set(item.symbol, data);
    }));

    await Promise.allSettled(state.transactions.map(async (tx) => {
      const needsHistoricalPrice = (tx.type === "fund" || tx.type === "etf")
        && tx.inputMode === "amount"
        && (isBuyAction(tx.action) || isSellAction(tx.action))
        && tx.symbol
        && (!number(tx.price) || number(tx.price) === 1);
      if (!needsHistoricalPrice) return;
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(tx.symbol)}?kind=${encodeURIComponent(tx.type)}&date=${encodeURIComponent(tx.date || "")}&time=${encodeURIComponent(tx.time || "")}`);
      if (Number.isFinite(data.priceOnDate)) {
        tx.price = data.priceOnDate;
        updated = true;
      }
      lookupBySymbol.set(tx.symbol, data);
    }));

    if (updated) {
      persist({ sync: false });
      render();
    }
  }

  function ensureStateShape() {
    if (!Array.isArray(state.watchlist)) state.watchlist = [];
    if (!state.prices) state.prices = {};
    if (!state.dayChangePct) state.dayChangePct = {};
    if (!Array.isArray(state.transactions)) state.transactions = [];
    let migrated = false;
    if (removeDemoSeedData()) migrated = true;
    state.transactions.forEach((tx) => {
      if (!tx.status) {
        tx.status = "confirmed";
        migrated = true;
      }
      if (!tx.inputMode && tx.type === "fund" && tx.action === "buy" && number(tx.quantity) <= 1 && number(tx.price) > 100) {
        tx.inputMode = "amount";
        tx.quantity = number(tx.price);
        const currentPrice = state.prices?.[tx.symbol] || 0;
        tx.price = currentPrice > 0 && currentPrice < 100 ? currentPrice : 1;
        tx.note = tx.note ? `${tx.note} · 已按金额模式修正` : "已按金额模式修正";
        migrated = true;
      }
      if (!tx.time && (tx.type === "fund" || tx.type === "etf")) {
        tx.time = "15:01";
        migrated = true;
      }
    });
    if (migrated) persist();
  }

  function removeDemoSeedData() {
    let changed = false;
    const beforeTransactions = state.transactions.length;
    state.transactions = state.transactions.filter((tx) => !demoSeedTransactionIds.has(tx.id));
    if (state.transactions.length !== beforeTransactions) changed = true;

    ["AAPL", "NVDA", "510300", "000001.OF"].forEach((symbol) => {
      if (Object.hasOwn(state.prices, symbol)) {
        delete state.prices[symbol];
        changed = true;
      }
      if (Object.hasOwn(state.dayChangePct, symbol)) {
        delete state.dayChangePct[symbol];
        changed = true;
      }
    });

    const beforeWatchlist = state.watchlist.length;
    state.watchlist = state.watchlist.filter((item) => item.symbol !== "002611" || item.note !== "黄金基金观察");
    if (state.watchlist.length !== beforeWatchlist) changed = true;
    return changed;
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
  }

  function switchView(view) {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
    const titles = {
      overview: "资产总览",
      holdings: "全部持仓",
      transactions: "交易流水",
      insights: "复盘与风险"
    };
    els.pageTitle.textContent = titles[view] || "资产总览";
  }

  function isBuyAction(action) {
    return action === "buy" || action === "auto";
  }

  function isSellAction(action) {
    return action === "sell";
  }

  function isDividendAction(action) {
    return action === "dividend" || action === "bonus";
  }

  function isCashInAction(action) {
    return action === "deposit";
  }

  function isCashOutAction(action) {
    return action === "withdraw";
  }

  function computePortfolio() {
    const holdingsMap = new Map();
    let cash = 0;
    let realized = 0;
    let dividends = 0;
    let invested = 0;

    getSortedTransactions().forEach((tx) => {
      if ((tx.status || "confirmed") !== "confirmed") return;
      const rate = fx[tx.currency] || 1;
      const price = number(tx.price);
      const fee = number(tx.fee);
      const quantity = getTransactionShares(tx);
      const gross = getTransactionGross(tx) * rate;
      const signedFee = fee * rate;
      const key = tx.symbol.toUpperCase();

      if (isCashInAction(tx.action)) {
        cash += gross;
        invested += gross;
        return;
      }
      if (isCashOutAction(tx.action)) {
        cash -= gross;
        invested -= gross;
        return;
      }
      if (isDividendAction(tx.action)) {
        cash += gross;
        dividends += gross;
        return;
      }

      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          symbol: key,
          name: tx.name,
          type: tx.type,
          account: tx.account,
          currency: tx.currency,
          quantity: 0,
          cost: 0,
          realized: 0
        });
      }
      const holding = holdingsMap.get(key);
      holding.name = tx.name || holding.name;
      holding.type = tx.type || holding.type;
      holding.account = tx.account || holding.account;
      holding.currency = tx.currency || holding.currency;

      if (isBuyAction(tx.action)) {
        holding.quantity += quantity;
        holding.cost += gross + signedFee;
        cash -= gross + signedFee;
      }

      if (isSellAction(tx.action)) {
        const avgCost = holding.quantity > 0 ? holding.cost / holding.quantity : 0;
        const removedCost = Math.min(quantity, holding.quantity) * avgCost;
        const proceeds = gross - signedFee;
        holding.quantity -= quantity;
        holding.cost -= removedCost;
        holding.realized += proceeds - removedCost;
        realized += proceeds - removedCost;
        cash += proceeds;
      }
    });

    const holdings = Array.from(holdingsMap.values())
      .filter((holding) => Math.abs(holding.quantity) > 0.000001)
      .map((holding) => {
        const rate = fx[holding.currency] || 1;
        const price = state.prices[holding.symbol] ?? 1;
        const value = holding.quantity * price * rate;
        const pnl = value - holding.cost + holding.realized;
        const pnlRate = holding.cost > 0 ? pnl / holding.cost : 0;
        const avgCost = holding.quantity > 0 ? holding.cost / holding.quantity / rate : 0;
        const dayChange = value * (state.dayChangePct[holding.symbol] || 0);
        return { ...holding, price, value, pnl, pnlRate, avgCost, dayChange };
      });

    const cashHolding = {
      symbol: "CASH",
      name: "可用现金",
      type: "cash",
      account: "聚合",
      currency: "CNY",
      quantity: cash,
      cost: cash,
      price: 1,
      value: cash,
      pnl: 0,
      pnlRate: 0,
      avgCost: 1,
      dayChange: 0,
      realized: 0
    };
    holdings.push(cashHolding);

    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const totalCost = holdings.reduce((sum, holding) => sum + (holding.type === "cash" ? 0 : holding.cost), 0);
    const unrealized = holdings.reduce((sum, holding) => sum + (holding.type === "cash" ? 0 : holding.value - holding.cost), 0);
    const totalPnl = unrealized + realized + dividends;
    const dayChange = holdings.reduce((sum, holding) => sum + holding.dayChange, 0);

    holdings.forEach((holding) => {
      holding.weight = totalValue > 0 ? holding.value / totalValue : 0;
    });

    return {
      holdings: holdings.sort((a, b) => b.value - a.value),
      invested,
      totalValue,
      totalCost,
      totalPnl,
      realized,
      dividends,
      dayChange,
      dayChangeRate: totalValue ? dayChange / (totalValue - dayChange) : 0,
      totalPnlRate: invested ? totalPnl / invested : 0,
      cash: cashHolding
    };
  }

  function render() {
    const portfolio = computePortfolio();
    renderMetrics(portfolio);
    renderHoldings(portfolio);
    renderTransactions();
    renderRecent();
    renderAnalysis(portfolio);
    renderRisk(portfolio);
    renderNotes();
    drawWealthChart(portfolio);
    drawAllocationChart(portfolio);
  }

  function renderMetrics(portfolio) {
    els.totalValue.textContent = money(portfolio.totalValue);
    els.totalCost.textContent = `累计转入 ${money(portfolio.invested)}`;
    els.totalPnl.innerHTML = colorText(portfolio.totalPnl, moneySigned(portfolio.totalPnl));
    els.totalPnlRate.innerHTML = colorText(portfolio.totalPnlRate, percentSigned(portfolio.totalPnlRate));
    els.dayChange.innerHTML = colorText(portfolio.dayChange, moneySigned(portfolio.dayChange));
    els.dayChangeRate.innerHTML = colorText(portfolio.dayChangeRate, percentSigned(portfolio.dayChangeRate));
    els.cashValue.textContent = money(portfolio.cash.value);
    els.cashWeight.textContent = `${percent(portfolio.cash.weight)} of portfolio`;
  }

  function getTransactionGross(tx) {
    const rawQuantity = number(tx.quantity);
    const price = number(tx.price);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action) || isCashInAction(tx.action) || isCashOutAction(tx.action) || isDividendAction(tx.action))) {
      return rawQuantity;
    }
    return rawQuantity * price;
  }

  function getTransactionShares(tx) {
    const rawQuantity = number(tx.quantity);
    const price = number(tx.price);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action))) {
      return price > 0 ? rawQuantity / price : 0;
    }
    return rawQuantity;
  }

  function formatTransactionQuantity(tx) {
    const shares = getTransactionShares(tx);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action))) {
      return `${money(number(tx.quantity), tx.currency)} / ${formatNumber(shares)}份`;
    }
    return formatNumber(number(tx.quantity));
  }

  function renderHoldings(portfolio) {
    const ownedSymbols = new Set(portfolio.holdings.map((holding) => holding.symbol));
    const watchOnly = getWatchOnlyRows(ownedSymbols);
    const combined = [...portfolio.holdings, ...watchOnly];
    const filtered = combined.filter((holding) => activeType === "all" || holding.type === activeType);
    els.holdingsBody.innerHTML = filtered.map(holdingRow).join("");
    els.topHoldingsBody.innerHTML = portfolio.holdings.slice(0, 5).map(topHoldingRow).join("");
  }

  function handleTransactionFilterClick(event) {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    activeTransactionFilter = button.dataset.filter || "all";
    syncTransactionFilterButtons();
    renderTransactions();
  }

  function handleAnalysisRangeClick(event) {
    const button = event.target.closest("button[data-analysis-range]");
    if (!button) return;
    activeAnalysisRange = button.dataset.analysisRange || "3m";
    syncAnalysisFilters();
    renderAnalysis(computePortfolio());
  }

  function handleAnalysisTypeClick(event) {
    const button = event.target.closest("button[data-analysis-type]");
    if (!button) return;
    activeAnalysisType = button.dataset.analysisType || "all";
    syncAnalysisFilters();
    renderAnalysis(computePortfolio());
  }

  function syncAnalysisFilters() {
    els.analysisRangeFilters.querySelectorAll("button[data-analysis-range]").forEach((button) => {
      button.classList.toggle("active", (button.dataset.analysisRange || "3m") === activeAnalysisRange);
    });
    els.analysisTypeFilters.querySelectorAll("button[data-analysis-type]").forEach((button) => {
      button.classList.toggle("active", (button.dataset.analysisType || "all") === activeAnalysisType);
    });
  }

  function syncTransactionFilterButtons() {
    if (!els.transactionFilters) return;
    els.transactionFilters.querySelectorAll("button[data-filter]").forEach((button) => {
      button.classList.toggle("active", (button.dataset.filter || "all") === activeTransactionFilter);
    });
  }

  function getFilteredTransactions() {
    return getSortedTransactions().filter((tx) => transactionMatchesFilter(tx, activeTransactionFilter));
  }

  function transactionMatchesFilter(tx, filter) {
    const status = tx.status || "confirmed";
    if (!filter || filter === "all") return true;
    if (filter === "pending") return status === "pending";
    return tx.action === filter;
  }

  function transactionStatusClass(status) {
    return status || "confirmed";
  }

  function transactionActionClass(action) {
    return `action-${action || "buy"}`;
  }

  function transactionActionLabel(action) {
    return actionNames[action] || action || "";
  }

  function transactionActionGlyph(action) {
    const label = transactionActionLabel(action);
    return label.length > 2 ? label.slice(0, 2) : label;
  }

  function renderTransactionSummary(transactions) {
    if (!els.transactionSummary) return;
    const rows = transactions || [];
    const all = getSortedTransactions();
    const confirmed = all.filter((tx) => (tx.status || "confirmed") === "confirmed");
    const pending = all.filter((tx) => (tx.status || "confirmed") === "pending");
    const visibleAmount = rows.reduce((sum, tx) => sum + getTransactionGross(tx), 0);
    const activeLabel = activeTransactionFilter === "all" ? "全部记录" : (activeTransactionFilter === "pending" ? "进行中" : (actionNames[activeTransactionFilter] || activeTransactionFilter));
    els.transactionSummary.innerHTML = [
      { label: "当前筛选", value: activeLabel },
      { label: "显示记录", value: `${rows.length} 条` },
      { label: "进行中", value: `${pending.length} 条` },
      { label: "显示金额", value: money(visibleAmount) }
    ].map((item) => `
      <article class="summary-tile">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `).join("");
  }

  function renderTransactionRecords(transactions) {
    if (!els.transactionRecordList) return;
    const rows = (transactions || []).slice().reverse();
    els.transactionRecordList.innerHTML = rows.length
      ? rows.map((tx) => transactionRecordItem(tx)).join("")
      : `<article class="record-empty"><strong>暂无匹配记录</strong><span>先新增一笔交易，或切换筛选条件。</span></article>`;
  }

  function transactionRecordItem(tx, options = {}) {
    const status = tx.status || "confirmed";
    const compact = Boolean(options.compact);
    const includeActions = options.includeActions !== false;
    return `
      <article class="record-item ${transactionActionClass(tx.action)} ${compact ? "compact" : ""}" data-tx-id="${escapeHtml(tx.id)}">
        <div class="record-icon ${transactionActionClass(tx.action)}">${escapeHtml(transactionActionGlyph(tx.action))}</div>
        <div class="record-body">
          <div class="record-head">
            <div class="record-title">
              <strong>${escapeHtml(tx.name || tx.symbol)}</strong>
              <span>${escapeHtml(tx.symbol)} · ${escapeHtml(formatTransactionDateTime(tx))}</span>
            </div>
            <div class="record-meta">
              <span class="record-amount">${money(getTransactionGross(tx), tx.currency)}</span>
              <span class="status-pill ${transactionStatusClass(status)}">${escapeHtml(statusNames[status] || status)}</span>
            </div>
          </div>
          <div class="record-sub">
            <span>${escapeHtml(transactionActionLabel(tx.action))} · ${escapeHtml(formatTransactionQuantity(tx))}</span>
            <span>${escapeHtml(tx.account || "")}</span>
          </div>
          ${tx.note ? `<div class="record-note">${escapeHtml(tx.note)}</div>` : ""}
        </div>
        ${includeActions ? `
          <div class="record-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">详情</button>
            <button type="button" data-action="edit-tx" data-tx-id="${escapeHtml(tx.id)}">编辑</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function getWatchOnlyRows(ownedSymbols) {
    return (state.watchlist || [])
      .filter((item) => !ownedSymbols.has(item.symbol))
      .map((item) => {
        const price = state.prices[item.symbol] ?? 0;
        return {
          ...item,
          account: "自选",
          quantity: 0,
          avgCost: 0,
          price,
          value: 0,
          pnl: 0,
          pnlRate: 0,
          weight: 0,
          watchOnly: true
        };
      });
  }

  function holdingRow(holding) {
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <span>${escapeHtml(holding.name)}${holding.watchOnly ? " · 自选" : ""}</span>
          </button>
        </td>
        <td>${escapeHtml(holding.account)}</td>
        <td>${holding.watchOnly ? "--" : formatNumber(holding.quantity)}</td>
        <td>${holding.watchOnly ? "--" : money(holding.avgCost, holding.currency)}</td>
        <td>${money(holding.price, holding.currency)}</td>
        <td>${holding.watchOnly ? "--" : money(holding.value)}</td>
        <td>${holding.watchOnly ? "--" : colorText(holding.pnl, `${moneySigned(holding.pnl)} · ${percentSigned(holding.pnlRate)}`)}</td>
        <td>${holding.watchOnly ? "自选" : percent(holding.weight)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>
            ${holding.watchOnly ? `<button type="button" data-action="remove-watch" data-symbol="${escapeHtml(holding.symbol)}">移除</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }

  function topHoldingRow(holding) {
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <span>${escapeHtml(holding.name)}</span>
          </button>
        </td>
        <td><span class="badge">${typeNames[holding.type] || holding.type}</span></td>
        <td>${money(holding.value)}</td>
        <td>${colorText(holding.pnl, moneySigned(holding.pnl))}</td>
        <td>${percent(holding.weight)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTransactions() {
    const transactions = getFilteredTransactions();
    renderTransactionSummary(transactions);
    renderTransactionRecords(transactions);
    syncTransactionFilterButtons();
    els.transactionsBody.innerHTML = transactions
      .slice()
      .reverse()
      .map((tx) => {
        const amount = getTransactionGross(tx);
        return `
          <tr data-tx-id="${escapeHtml(tx.id)}">
            <td>${escapeHtml(formatTransactionDateTime(tx))}</td>
            <td><span class="badge">${actionNames[tx.action] || tx.action}</span></td>
            <td>
              <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">
                <strong>${escapeHtml(tx.symbol)}</strong>
                <span>${escapeHtml(tx.name)}</span>
              </button>
            </td>
            <td>${formatTransactionQuantity(tx)}</td>
            <td>${money(number(tx.price), tx.currency)}</td>
            <td>${money(amount, tx.currency)}</td>
            <td><span class="status-pill ${transactionStatusClass(tx.status || "confirmed")}">${escapeHtml(statusNames[tx.status || "confirmed"] || tx.status || "")}</span></td>
            <td>${escapeHtml(tx.note || "")}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="edit-tx" data-tx-id="${escapeHtml(tx.id)}">编辑</button>
                <button type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">详情</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderRecent() {
    els.recentTransactions.innerHTML = getSortedTransactions()
      .slice()
      .reverse()
      .slice(0, 5)
      .map((tx) => {
        const amount = getTransactionGross(tx);
        return `
          <article class="activity-item">
            <strong>${escapeHtml(formatTransactionDateTime(tx))} · ${transactionActionLabel(tx.action)} ${escapeHtml(tx.symbol)}</strong>
            <span>${escapeHtml(tx.name)} · ${money(amount, tx.currency)} · ${escapeHtml(statusNames[tx.status || "confirmed"] || tx.status || "")}</span>
          </article>
        `;
      })
      .join("");
  }

  function renderRisk(portfolio) {
    const nonCash = portfolio.holdings.filter((item) => item.type !== "cash");
    const largest = nonCash[0];
    const stockWeight = nonCash.filter((item) => item.type === "stock").reduce((sum, item) => sum + item.weight, 0);
    const fundWeight = nonCash.filter((item) => item.type === "fund" || item.type === "etf").reduce((sum, item) => sum + item.weight, 0);
    const risks = [
      {
        title: largest ? `最大单一持仓：${largest.symbol}` : "暂无风险",
        body: largest ? `${largest.name} 当前仓位 ${percent(largest.weight)}，超过 25% 时建议重点复盘。` : "还没有录入持仓。"
      },
      {
        title: "权益资产占比",
        body: `股票 ${percent(stockWeight)}，基金/ETF ${percent(fundWeight)}，现金 ${percent(portfolio.cash.weight)}。`
      },
      {
        title: "数据完整性",
        body: "交易流水是收益计算的基础，真实使用时应优先支持券商 CSV 导入和手动校验。"
      }
    ];

    els.riskList.innerHTML = risks
      .map((risk) => `
        <article class="risk-item">
          <strong>${escapeHtml(risk.title)}</strong>
          <span>${escapeHtml(risk.body)}</span>
        </article>
      `)
      .join("");
  }

  function renderNotes() {
    const notes = getSortedTransactions()
      .filter((tx) => tx.note)
      .slice()
      .reverse()
      .slice(0, 6);

    els.noteList.innerHTML = notes
      .map((tx) => `
        <article class="note-item">
          <strong>${escapeHtml(formatTransactionDateTime(tx))} · ${escapeHtml(tx.symbol)} · ${transactionActionLabel(tx.action)}</strong>
          <span>${escapeHtml(tx.note)}</span>
        </article>
      `)
      .join("");
  }

  function renderAnalysis(portfolio) {
    if (!els.analysisChart) return;
    syncAnalysisFilters();
    const data = buildAnalysisData(portfolio);
    renderAnalysisSummary(data);
    drawAnalysisChart(data.points);
    renderAnalysisCalendar(data.points);
    renderAnalysisContributors(data.contributors);
    primeAnalysisHistory(portfolio, activeAnalysisType);
  }

  function buildAnalysisData(portfolio) {
    const now = new Date();
    const days = activeAnalysisRange === "1m" ? 31 : activeAnalysisRange === "1y" ? 366 : 92;
    const start = new Date(now);
    start.setDate(now.getDate() - days + 1);
    const rangeStartKey = activeAnalysisRange === "all" ? "" : start.toISOString().slice(0, 10);
    const endKey = now.toISOString().slice(0, 10);
    const txRows = getSortedTransactions()
      .filter((tx) => (tx.status || "confirmed") === "confirmed")
      .filter((tx) => activeAnalysisType === "all" || tx.type === activeAnalysisType || (activeAnalysisType === "fund" && tx.type === "etf"));
    const firstTxDate = txRows.find((tx) => tx.date)?.date || endKey;
    const simulationStart = new Date(`${firstTxDate}T00:00:00`);

    const txByDate = new Map();
    txRows.forEach((tx) => {
      const key = tx.date || "";
      if (!key) return;
      if (!txByDate.has(key)) txByDate.set(key, []);
      txByDate.get(key).push(tx);
    });

    const points = [];
    const running = new Map();
    let cash = 0;
    let realized = 0;
    let dividends = 0;
    let invested = 0;
    let previousPnl = 0;

    for (let cursor = simulationStart; cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = cursor.toISOString().slice(0, 10);
      (txByDate.get(dateKey) || []).forEach((tx) => {
        const rate = fx[tx.currency] || 1;
        const price = number(tx.price);
        const fee = number(tx.fee) * rate;
        const shares = getTransactionShares(tx);
        const gross = getTransactionGross(tx) * rate;
        if (isCashInAction(tx.action)) {
          cash += gross;
          invested += gross;
          return;
        }
        if (isCashOutAction(tx.action)) {
          cash -= gross;
          invested -= gross;
          return;
        }
        if (isDividendAction(tx.action)) {
          cash += gross;
          dividends += gross;
          return;
        }
        const symbol = normalizeSymbol(tx.symbol);
        if (!running.has(symbol)) {
          running.set(symbol, { symbol, name: tx.name || symbol, type: tx.type || "fund", quantity: 0, cost: 0, realized: 0 });
        }
        const item = running.get(symbol);
        item.name = tx.name || item.name;
        item.type = tx.type || item.type;
        if (isBuyAction(tx.action)) {
          item.quantity += shares;
          item.cost += gross + fee;
          cash -= gross + fee;
        }
        if (isSellAction(tx.action)) {
          const avgCost = item.quantity > 0 ? item.cost / item.quantity : 0;
          const removedCost = Math.min(shares, item.quantity) * avgCost;
          const proceeds = gross - fee;
          item.quantity -= shares;
          item.cost -= removedCost;
          item.realized += proceeds - removedCost;
          realized += proceeds - removedCost;
          cash += proceeds;
        }
      });

      const holdings = Array.from(running.values()).filter((item) => Math.abs(item.quantity) > 0.000001);
      const marketValue = holdings.reduce((sum, item) => sum + item.quantity * estimateAnalysisPrice(item, dateKey), 0);
      const cost = holdings.reduce((sum, item) => sum + item.cost, 0);
      const pnl = marketValue - cost + realized + dividends;
      points.push({
        time: dateKey,
        value: roundMoney(pnl),
        marketValue: roundMoney(marketValue),
        cost: roundMoney(cost),
        invested: roundMoney(invested),
        cash: roundMoney(cash),
        dailyPnl: roundMoney(pnl - previousPnl),
        transactions: (txByDate.get(dateKey) || []).length,
        missingHistory: holdings.some((item) => !analysisHistoryCache.has(historyCacheKey(item.symbol, dateKey)))
      });
      previousPnl = pnl;
    }

    const contributors = computeAnalysisContributors(portfolio, activeAnalysisType);
    const visiblePoints = points.filter((point) => (!rangeStartKey || point.time >= rangeStartKey) && point.time <= endKey);
    const coveredDays = visiblePoints.filter((point) => !point.missingHistory || point.marketValue === 0).length;
    return {
      points: visiblePoints,
      contributors,
      totalPnl: visiblePoints.length ? visiblePoints[visiblePoints.length - 1].value : 0,
      startPnl: visiblePoints.length ? visiblePoints[0].value : 0,
      coverage: visiblePoints.length ? coveredDays / visiblePoints.length : 1
    };
  }

  function estimateAnalysisPrice(item, dateKey) {
    const cached = analysisHistoryCache.get(historyCacheKey(item.symbol, dateKey));
    if (Number.isFinite(cached?.price) && cached.price > 0) return cached.price;
    const current = number(state.prices?.[item.symbol]);
    if (current > 0) return current;
    return item.quantity > 0 ? item.cost / item.quantity : 0;
  }

  function computeAnalysisContributors(portfolio, typeFilter) {
    return portfolio.holdings
      .filter((holding) => holding.type !== "cash")
      .filter((holding) => typeFilter === "all" || holding.type === typeFilter || (typeFilter === "fund" && holding.type === "etf"))
      .map((holding) => ({
        symbol: holding.symbol,
        name: holding.name,
        type: holding.type,
        pnl: holding.pnl,
        pnlRate: holding.pnlRate,
        value: holding.value,
        weight: holding.weight
      }))
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }

  function renderAnalysisSummary(data) {
    const latest = data.points[data.points.length - 1];
    const best = maxBy(data.points, (point) => point.dailyPnl);
    const worst = minBy(data.points, (point) => point.dailyPnl);
    const periodChange = latest ? latest.value - data.startPnl : 0;
    els.analysisSummary.innerHTML = [
      { label: "当前累计盈亏", value: moneySigned(data.totalPnl), signed: data.totalPnl },
      { label: "区间变化", value: moneySigned(periodChange), signed: periodChange },
      { label: "最佳单日", value: best ? `${best.time.slice(5)} · ${moneySigned(best.dailyPnl)}` : "--", signed: best?.dailyPnl || 0 },
      { label: "行情覆盖", value: `${percent(data.coverage)}${data.coverage < 1 ? " · 部分兜底" : ""}` }
    ].map((item) => `
      <article class="summary-tile">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.signed === undefined ? escapeHtml(item.value) : colorText(item.signed, escapeHtml(item.value))}</strong>
      </article>
    `).join("");
  }

  function drawAnalysisChart(points) {
    ensureAnalysisChart();
    if (!analysisSeriesApi) return;
    const data = points.map((point) => ({ time: point.time, value: point.value }));
    analysisSeriesApi.setData(data);
    if (analysisChartApi) analysisChartApi.timeScale().fitContent();
  }

  function ensureAnalysisChart() {
    if (!window.LightweightCharts || !els.analysisChart) return;
    const size = getChartSize(els.analysisChart, 360);
    if (!analysisChartApi) {
      analysisChartApi = LightweightCharts.createChart(els.analysisChart, {
        ...baseChartOptions(size.width, size.height),
        localization: { priceFormatter: (price) => moneySigned(price) },
        timeScale: {
          borderVisible: false,
          timeVisible: false,
          rightOffset: 6,
          barSpacing: 7
        }
      });
      analysisSeriesApi = analysisChartApi.addSeries(LightweightCharts.AreaSeries, {
        lineColor: chartColors.blue,
        topColor: "rgba(96, 165, 250, 0.28)",
        bottomColor: "rgba(96, 165, 250, 0.02)",
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (price) => moneySigned(price) }
      });
    }
    analysisChartApi.applyOptions({
      ...baseChartOptions(size.width, size.height),
      localization: { priceFormatter: (price) => moneySigned(price) }
    });
  }

  function renderAnalysisCalendar(points) {
    const recent = points.slice(-42);
    if (!recent.length) {
      els.analysisCalendar.innerHTML = `<div class="record-empty"><strong>暂无日历</strong><span>导入交易流水后生成盈亏热力。</span></div>`;
      return;
    }
    els.analysisCalendar.innerHTML = recent.map((point) => {
      const level = Math.min(4, Math.floor(Math.abs(point.dailyPnl) / 100) + (point.dailyPnl ? 1 : 0));
      const cls = point.dailyPnl > 0 ? "gain" : point.dailyPnl < 0 ? "loss" : "flat";
      return `
        <div class="calendar-day ${cls} level-${level}" title="${escapeHtml(point.time)} ${escapeHtml(moneySigned(point.dailyPnl))}">
          <span>${escapeHtml(point.time.slice(8))}</span>
          <strong>${escapeHtml(shortSigned(point.dailyPnl))}</strong>
        </div>
      `;
    }).join("");
  }

  function renderAnalysisContributors(rows) {
    els.analysisContributors.innerHTML = rows.length
      ? rows.slice(0, 8).map((item) => `
        <article class="contribution-item">
          <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(item.symbol)}" data-type="${escapeHtml(item.type)}">
            <strong>${escapeHtml(item.symbol)} · ${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(typeNames[item.type] || item.type)} · 仓位 ${escapeHtml(percent(item.weight))}</span>
          </button>
          <div>
            <strong>${colorText(item.pnl, moneySigned(item.pnl))}</strong>
            <span>${colorText(item.pnlRate, percentSigned(item.pnlRate))}</span>
          </div>
        </article>
      `).join("")
      : `<article class="record-empty"><strong>暂无贡献</strong><span>当前模块还没有持仓或交易。</span></article>`;
  }

  async function primeAnalysisHistory(portfolio, typeFilter) {
    if (analysisHistoryInFlight) {
      analysisHistoryQueued = true;
      return;
    }
    const holdings = portfolio.holdings
      .filter((holding) => holding.type !== "cash")
      .filter((holding) => typeFilter === "all" || holding.type === typeFilter || (typeFilter === "fund" && holding.type === "etf"))
      .slice(0, 12)
      .filter((holding) => !analysisHistoryCache.has(analysisHistoryLoadedKey(holding.symbol, holding.type)));
    if (!holdings.length) return;

    analysisHistoryInFlight = true;
    try {
      const results = await Promise.allSettled(holdings.map((holding) => fetchAnalysisHistory(holding.symbol, holding.type)));
      const changed = results.some((result) => result.status === "fulfilled" && result.value?.changed);
      if (analysisHistoryQueued || changed) {
        analysisHistoryQueued = false;
        analysisHistoryRefreshPending = true;
      }
    } finally {
      analysisHistoryInFlight = false;
      if (analysisHistoryRefreshPending) {
        analysisHistoryRefreshPending = false;
        renderAnalysis(computePortfolio());
      }
    }
  }

  async function fetchAnalysisHistory(symbol, type) {
    const loadedKey = analysisHistoryLoadedKey(symbol, type);
    if (analysisHistoryCache.has(loadedKey)) return analysisHistoryCache.get(loadedKey);
    try {
      let changed = false;
      const range = activeAnalysisRange === "1m" ? "daily" : activeAnalysisRange === "1y" || activeAnalysisRange === "all" ? "weekly" : "daily";
      const data = await fetchJson(`/api/chart/${encodeURIComponent(symbol)}?kind=${encodeURIComponent(type || "fund")}&range=${encodeURIComponent(range)}`);
      const points = Array.isArray(data.points) ? data.points : [];
      points.forEach((point) => {
        const dateKey = point.date || (point.time ? String(point.time).slice(0, 10) : "");
        const price = number(point.value ?? point.close ?? point.open);
        const key = historyCacheKey(symbol, dateKey);
        if (dateKey && price > 0 && !analysisHistoryCache.has(key)) {
          analysisHistoryCache.set(key, { price, source: data.source || "" });
          changed = true;
        }
      });
      const result = { loaded: true, count: points.length, changed };
      analysisHistoryCache.set(loadedKey, result);
      return result;
    } catch {
      const result = { loaded: false, changed: false };
      analysisHistoryCache.set(loadedKey, result);
      return result;
    }
  }

  function analysisHistoryLoadedKey(symbol, type) {
    return `${normalizeSymbol(symbol)}:${type || "fund"}:loaded`;
  }

  function historyCacheKey(symbol, dateKey) {
    return `${normalizeSymbol(symbol)}:${dateKey}`;
  }

  function drawWealthChart(portfolio) {
    ensureWealthChart();
    const points = buildWealthSeries(portfolio, activeRange);
    wealthSeriesApi.setData(points.map((point) => ({
      time: point.time,
      value: point.value
    })));
    const last = points[points.length - 1];
    els.totalValue.dataset.current = String(last?.value || portfolio.totalValue || 0);
  }

  function buildWealthSeries(portfolio, range) {
    const days = range === "1m" ? 30 : range === "1y" ? 365 : 90;
    const now = new Date();
    const points = [];
    const base = portfolio.totalValue || 1;
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      const progress = (days - index) / days;
      const wave = Math.sin(progress * Math.PI * 4) * 0.025 + Math.cos(progress * Math.PI * 2.2) * 0.018;
      const slope = (progress - 1) * -0.07;
      const value = base * (1 + slope + wave);
      points.push({
        time: date.toISOString().slice(0, 10),
        date: date.toISOString().slice(5, 10),
        value
      });
    }
    points[points.length - 1].value = base;
    return points;
  }

  function ensureWealthChart() {
    if (!window.LightweightCharts || !els.wealthChart) return;
    const size = getChartSize(els.wealthChart, 320);
    if (!wealthChartApi) {
      wealthChartApi = LightweightCharts.createChart(els.wealthChart, {
        ...baseChartOptions(size.width, size.height),
        localization: {
          priceFormatter: (price) => shortMoney(price)
        },
        timeScale: {
          borderVisible: false,
          timeVisible: false,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing: 8
        }
      });
      wealthSeriesApi = wealthChartApi.addSeries(LightweightCharts.AreaSeries, {
        lineColor: chartColors.green,
        topColor: "rgba(52, 211, 153, 0.28)",
        bottomColor: "rgba(52, 211, 153, 0.02)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: {
          type: "custom",
          formatter: (price) => shortMoney(price)
        }
      });
    }
    wealthChartApi.applyOptions({
      ...baseChartOptions(size.width, size.height),
      localization: {
        priceFormatter: (price) => shortMoney(price)
      }
    });
  }

  function baseChartOptions(width, height) {
    return {
      width,
      height,
      autoSize: false,
      layout: {
        background: { type: LightweightCharts.ColorType.Solid, color: "transparent" },
        textColor: getMutedColor(),
        fontSize: 12,
        fontFamily: "Segoe UI, system-ui, sans-serif"
      },
      grid: {
        vertLines: { color: chartColors.grid },
        horzLines: { color: chartColors.grid }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: "rgba(226, 232, 240, 0.42)", width: 1, labelVisible: true },
        horzLine: { color: "rgba(226, 232, 240, 0.42)", width: 1, labelVisible: true }
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.16, bottom: 0.14 }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    };
  }

  function getChartSize(element, fallbackHeight) {
    const rect = element.getBoundingClientRect();
    return {
      width: Math.max(320, Math.floor(rect.width || element.clientWidth || 640)),
      height: Math.max(240, Math.floor(rect.height || fallbackHeight))
    };
  }

  function drawAllocationChart(portfolio) {
    const canvas = els.allocationChart;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 260 * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 260, 260);

    const grouped = groupByType(portfolio.holdings);
    const total = grouped.reduce((sum, item) => sum + item.value, 0) || 1;
    let angle = -Math.PI / 2;

    grouped.forEach((item, index) => {
      const slice = (item.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(130, 130);
      ctx.arc(130, 130, 102, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = palette[index % palette.length];
      ctx.fill();
      angle += slice;
    });

    ctx.beginPath();
    ctx.arc(130, 130, 58, 0, Math.PI * 2);
    ctx.fillStyle = getSurfaceColor();
    ctx.fill();

    ctx.fillStyle = getTextColor();
    ctx.font = "800 20px Cascadia Mono, Consolas";
    ctx.textAlign = "center";
    ctx.fillText(percent(1 - portfolio.cash.weight), 130, 126);
    ctx.fillStyle = getMutedColor();
    ctx.font = "12px Segoe UI";
    ctx.fillText("权益仓位", 130, 148);
    ctx.textAlign = "left";

    els.allocationLegend.innerHTML = grouped
      .map((item, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${palette[index % palette.length]}"></span>
          <span>${typeNames[item.type] || item.type}</span>
          <strong>${percent(item.value / total)}</strong>
        </div>
      `)
      .join("");
  }

  function groupByType(holdings) {
    const map = new Map();
    holdings.forEach((holding) => {
      const current = map.get(holding.type) || { type: holding.type, value: 0 };
      current.value += Math.max(0, holding.value);
      map.set(holding.type, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }

  function openDrawer() {
    resetTransactionForm();
    setTransactionDrawerMode("transaction");
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    document.getElementById("txDate").focus();
  }

  function openWatchlistDrawer() {
    els.form.reset();
    els.form.dataset.mode = "watchlist";
    delete els.form.dataset.editId;
    document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = "15:01";
    document.getElementById("txAction").value = "buy";
    document.getElementById("txStatus").value = "confirmed";
    document.getElementById("txInputMode").value = "amount";
    document.getElementById("txQuantity").value = "0";
    document.getElementById("txPrice").value = "1";
    document.getElementById("txFee").value = "0";
    document.getElementById("txAccount").value = "自选";
    updateInputModeLabels();
    setTransactionDrawerMode("watchlist");
    hideLookupPanel();
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    showToast("输入代码后保存为自选");
    document.getElementById("txSymbol").focus();
  }

  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    closeInstrumentDrawer();
    setTimeout(() => {
      if (!els.drawer.classList.contains("open") && !document.getElementById("importDrawer").classList.contains("open")) els.backdrop.hidden = true;
    }, 180);
  }

  function openImportDrawer() {
    closeInstrumentDrawer();
    els.backdrop.hidden = false;
    const drawer = document.getElementById("importDrawer");
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  }

  function closeImportDrawer() {
    const drawer = document.getElementById("importDrawer");
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      if (!drawer.classList.contains("open") && !els.drawer.classList.contains("open") && !els.instrumentDrawer.classList.contains("open")) {
        els.backdrop.hidden = true;
      }
    }, 180);
  }

  async function parseImportFile() {
    const input = document.getElementById("importFileInput");
    const file = input.files?.[0];
    if (!file) {
      showToast("先选择同花顺导出的 Excel 或 CSV 文件");
      return;
    }
    if (!window.XLSX) {
      showImportPreview([], "Excel 解析库未加载，请刷新页面后重试。");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      setImportPreview(rows, `文件：${file.name}`);
    } catch (error) {
      showImportPreview([], error.message || "文件解析失败");
    }
  }

  function parseImportText() {
    const text = document.getElementById("importTextInput").value.trim();
    if (!text) {
      showToast("先粘贴交易流水文本");
      return;
    }
    setImportPreview(parseDelimitedText(text), "文本粘贴");
  }

  function setImportPreview(rows, sourceLabel) {
    const normalizedRows = normalizeImportRows(rows);
    const parsed = buildImportPreview(normalizedRows, sourceLabel);
    importPreviewData = parsed;
    importPreviewRows = parsed.rows;
    showImportPreview(parsed.rows, parsed.message);
  }

  function parseDelimitedText(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.includes("\t")) return line.split("\t");
        if (line.includes(",")) return splitCsvLine(line);
        return line.split(/\s{2,}|\s(?=\d{6}\b)/).filter(Boolean);
      });
  }

  function splitCsvLine(line) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  function normalizeImportRows(rows) {
    return (rows || [])
      .map((row) => Array.from(row || []).map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));
  }

  function buildImportPreview(rows, sourceLabel = "导入数据") {
    if (!rows.length) return { rows: [], message: "没有识别到可用表格行。" };
    const headerIndex = findImportHeaderIndex(rows);
    const headers = rows[headerIndex] || [];
    const fieldMap = mapImportHeaders(headers);
    const dataRows = rows.slice(headerIndex + 1);
    const previewRows = dataRows
      .map((row, index) => parseImportRow(row, headers, fieldMap, index))
      .filter(Boolean);
    const validCount = previewRows.filter((row) => row.valid).length;
    return {
      rows: previewRows,
      message: `${sourceLabel} · 识别 ${previewRows.length} 行，可导入 ${validCount} 行`
    };
  }

  function findImportHeaderIndex(rows) {
    let bestIndex = 0;
    let bestScore = -1;
    rows.slice(0, 12).forEach((row, index) => {
      const text = row.join("|");
      const score = [
        /日期|时间/.test(text),
        /代码|证券/.test(text),
        /名称/.test(text),
        /买卖|业务|操作/.test(text),
        /成交|发生|金额|价格|数量/.test(text)
      ].filter(Boolean).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function mapImportHeaders(headers) {
    const normalized = headers.map(normalizeHeader);
    const pick = (...patterns) => normalized.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
    return {
      date: pick(/成交日期|交易日期|发生日期|日期/),
      time: pick(/成交时间|委托时间|时间/),
      symbol: pick(/证券代码|基金代码|代码|产品代码/),
      name: pick(/证券名称|基金名称|名称|产品名称/),
      action: pick(/买卖标志|买卖方向|操作|业务名称|业务类型|摘要/),
      price: pick(/成交价格|成交价|价格|净值/),
      quantity: pick(/成交数量|成交份额|发生数量|数量|份额/),
      amount: pick(/成交金额|发生金额|清算金额|金额|本金/),
      fee: pick(/手续费|佣金|费用|规费|过户费/),
      account: pick(/账户|股东账户|资金账号/)
    };
  }

  function parseImportRow(row, headers, fieldMap, index) {
    const cell = (field) => {
      const headerIndex = fieldMap[field];
      return headerIndex >= 0 ? String(row[headerIndex] ?? "").trim() : "";
    };
    const fallback = buildImportFallback(row);
    const symbol = normalizeSymbol(cell("symbol") || fallback.symbol);
    const name = cell("name") || fallback.name || symbol;
    const date = normalizeImportDate(cell("date") || fallback.date);
    const time = normalizeImportTime(cell("time") || fallback.time);
    const action = normalizeImportAction(cell("action") || fallback.action);
    const price = parseImportNumber(cell("price") || fallback.price);
    const amount = parseImportNumber(cell("amount") || fallback.amount);
    const quantity = parseImportNumber(cell("quantity") || fallback.quantity);
    const fee = parseImportNumber(cell("fee") || "0");
    const type = inferInstrumentType(symbol, name);
    const derivedPrice = price > 0 ? price : (amount > 0 && quantity > 0 ? amount / quantity : 0);
    const inputMode = amount > 0 ? "amount" : "shares";
    const txQuantity = amount > 0 ? amount : quantity;
    const txPrice = derivedPrice > 0 ? derivedPrice : 1;
    const reasons = [];
    if (!date) reasons.push("缺少日期");
    if (!symbol) reasons.push("缺少代码");
    if (!action) reasons.push("缺少买卖方向");
    if (!txQuantity) reasons.push("缺少金额或数量");
    if (inputMode === "shares" && !derivedPrice) reasons.push("缺少价格");
    if ((action === "buy" || action === "sell") && type === "stock" && !derivedPrice) reasons.push("股票交易缺少成交价");
    const tx = {
      id: "",
      date,
      time,
      action: action || "buy",
      status: "confirmed",
      symbol,
      name,
      type,
      account: cell("account") || "同花顺导入",
      inputMode,
      quantity: txQuantity,
      price: txPrice,
      fee,
      currency: "CNY",
      note: "同花顺/券商流水导入"
    };
    tx.id = `import-${hashString(transactionSignature(tx))}`;
    return {
      rowIndex: index + 1,
      raw: row,
      tx,
      valid: reasons.length === 0,
      reason: reasons.join("；")
    };
  }

  function buildImportFallback(row) {
    const joined = row.join(" ");
    const date = row.find((cell) => normalizeImportDate(cell)) || "";
    const time = row.find((cell) => normalizeImportTime(cell)) || "";
    const symbol = (joined.match(/\b\d{6}\b/) || [])[0] || "";
    const action = row.find((cell) => normalizeImportAction(cell)) || "";
    const numbers = row.map(parseImportNumber).filter((value) => value > 0);
    return {
      date,
      time,
      symbol,
      name: "",
      action,
      price: numbers.find((value) => value > 0 && value < 10000) || 0,
      quantity: numbers.find((value) => value >= 100) || 0,
      amount: numbers.find((value) => value >= 1000) || 0
    };
  }

  function normalizeHeader(value) {
    return String(value || "").replace(/\s+/g, "").replace(/[()（）:：]/g, "");
  }

  function normalizeImportDate(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    const matched = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (!matched) return "";
    return `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`;
  }

  function normalizeImportTime(value) {
    const text = String(value || "").trim();
    const matched = text.match(/(\d{1,2})[:：](\d{2})/);
    if (!matched) return "";
    return `${matched[1].padStart(2, "0")}:${matched[2]}`;
  }

  function normalizeImportAction(value) {
    const text = String(value || "").trim();
    if (/申购|认购|买入|买|定投/.test(text)) return "buy";
    if (/赎回|卖出|卖/.test(text)) return "sell";
    if (/分红|红利/.test(text)) return "dividend";
    if (/转入|入金|存入/.test(text)) return "deposit";
    if (/转出|出金|取出/.test(text)) return "withdraw";
    return "";
  }

  function parseImportNumber(value) {
    const text = String(value ?? "").replace(/,/g, "").replace(/[￥¥元份股]/g, "").trim();
    const matched = text.match(/-?\d+(?:\.\d+)?/);
    if (!matched) return 0;
    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
  }

  function inferInstrumentType(symbol, name = "") {
    const text = `${symbol} ${name}`;
    if (/ETF|LOF|510|159|588|512/.test(text)) return "etf";
    if (/基金|混合|债券|货币|指数|QDII|FOF/.test(text)) return "fund";
    return /^\d{6}$/.test(symbol) ? "stock" : "fund";
  }

  function showImportPreview(rows, message = "") {
    const preview = document.getElementById("importFilePreview");
    const validRows = rows.filter((row) => row.valid);
    document.getElementById("applyImportFileButton").disabled = !validRows.length;
    document.getElementById("applyImportTextButton").disabled = !validRows.length;
    if (!rows.length) {
      preview.innerHTML = `<div class="import-empty">${escapeHtml(message || "暂无预览")}</div>`;
      return;
    }
    preview.innerHTML = `
      <div class="import-preview-head">
        <strong>${escapeHtml(message)}</strong>
        <span>${validRows.length}/${rows.length} 可导入</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>日期</th>
            <th>动作</th>
            <th>代码</th>
            <th>名称</th>
            <th>金额/份额</th>
            <th>价格</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 80).map((row) => `
            <tr>
              <td><span class="status-pill ${row.valid ? "confirmed" : "failed"}">${row.valid ? "可导入" : "跳过"}</span></td>
              <td>${escapeHtml(row.tx.date || "--")}</td>
              <td>${escapeHtml(actionNames[row.tx.action] || row.tx.action || "--")}</td>
              <td>${escapeHtml(row.tx.symbol || "--")}</td>
              <td>${escapeHtml(row.tx.name || "--")}</td>
              <td>${escapeHtml(row.tx.inputMode === "amount" ? money(row.tx.quantity, row.tx.currency) : formatNumber(row.tx.quantity))}</td>
              <td>${escapeHtml(formatChartPrice(row.tx.price))}</td>
              <td>${escapeHtml(row.reason || "--")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${rows.length > 80 ? `<p class="import-note">仅预览前 80 行，确认后会导入全部可识别行。</p>` : ""}
    `;
  }

  async function applyImportPreview() {
    const rows = importPreviewRows.filter((row) => row.valid).map((row) => ({ ...row.tx }));
    if (!rows.length) {
      showToast("没有可导入的交易行");
      return;
    }
    const existing = new Set(state.transactions.map(transactionSignature));
    let imported = 0;
    let skipped = 0;
    for (const tx of rows) {
      const signature = transactionSignature(tx);
      if (existing.has(signature)) {
        skipped += 1;
        continue;
      }
      await hydrateTransactionPrice(tx);
      state.transactions.push(tx);
      existing.add(signature);
      if (tx.symbol && tx.price > 0) state.prices[tx.symbol] = tx.price;
      imported += 1;
    }
    if (!imported) {
      showToast(`没有新增流水，已跳过 ${skipped} 条重复记录`);
      return;
    }
    persist();
    render();
    closeImportDrawer();
    refreshMarketData();
    showToast(`已导入 ${imported} 条交易流水${skipped ? `，跳过 ${skipped} 条重复` : ""}`);
  }

  function transactionSignature(tx) {
    return [
      tx.date || "",
      tx.time || "",
      tx.action || "",
      normalizeSymbol(tx.symbol || ""),
      tx.inputMode || "",
      number(tx.quantity).toFixed(4),
      number(tx.price).toFixed(4),
      number(tx.fee).toFixed(2)
    ].join("|");
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function closeInstrumentDrawer() {
    els.instrumentDrawer.classList.remove("open");
    els.instrumentDrawer.setAttribute("aria-hidden", "true");
    activeInstrumentDetail = null;
    els.instrumentStatus.textContent = "待查询";
    if (!els.drawer.classList.contains("open")) {
      setTimeout(() => {
        if (!els.instrumentDrawer.classList.contains("open") && !els.drawer.classList.contains("open") && !document.getElementById("importDrawer").classList.contains("open")) els.backdrop.hidden = true;
      }, 180);
    }
  }

  function updateInputModeLabels() {
    const mode = document.getElementById("txInputMode").value;
    const type = document.getElementById("txType").value;
    const label = document.getElementById("txQuantityLabel");
    const priceLabel = document.getElementById("txPriceLabel");
    label.textContent = mode === "amount" ? "金额" : "份额";
    priceLabel.textContent = (type === "fund" || type === "etf") ? "买入净值" : "价格";
  }

  function handleHoldingsAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const symbol = button.dataset.symbol;
    const type = button.dataset.type || "fund";
    if (action === "detail") openInstrumentDetail(symbol, type);
    if (action === "remove-watch") removeWatchlist(symbol);
  }

  function handleTransactionAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "edit-tx") editTransaction(button.dataset.txId);
    if (action === "detail") openInstrumentDetail(button.dataset.symbol, button.dataset.type || "fund");
  }

  function removeWatchlist(symbol) {
    state.watchlist = (state.watchlist || []).filter((item) => item.symbol !== symbol);
    persist();
    render();
    showToast("已移除自选");
  }

  function editTransaction(txId) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx) return;
    closeInstrumentDrawer();
    els.form.dataset.mode = "transaction";
    els.form.dataset.editId = txId;
    setTransactionDrawerMode("edit");
    document.getElementById("txDate").value = tx.date || new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = tx.time || "15:01";
    document.getElementById("txAction").value = tx.action || "buy";
    document.getElementById("txStatus").value = tx.status || "confirmed";
    document.getElementById("txSymbol").value = tx.symbol || "";
    document.getElementById("txName").value = tx.name || "";
    document.getElementById("txType").value = tx.type || "fund";
    document.getElementById("txAccount").value = tx.account || "主账户";
    document.getElementById("txInputMode").value = tx.inputMode || "shares";
    document.getElementById("txQuantity").value = String(number(tx.quantity));
    document.getElementById("txPrice").value = String(number(tx.price));
    document.getElementById("txFee").value = String(number(tx.fee));
    document.getElementById("txCurrency").value = tx.currency || "CNY";
    document.getElementById("txNote").value = tx.note || "";
    updateInputModeLabels();
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    handleSymbolInput();
  }

  function setTransactionDrawerMode(mode) {
    if (mode === "edit") {
      els.transactionDrawerEyebrow.textContent = "Edit Transaction";
      els.transactionDrawerTitle.textContent = "编辑交易";
      els.saveTransactionButton.textContent = "更新交易";
      return;
    }
    if (mode === "watchlist") {
      els.transactionDrawerEyebrow.textContent = "Watchlist";
      els.transactionDrawerTitle.textContent = "添加自选";
      els.saveTransactionButton.textContent = "保存自选";
      return;
    }
    els.transactionDrawerEyebrow.textContent = "New Transaction";
    els.transactionDrawerTitle.textContent = "新增交易";
    els.saveTransactionButton.textContent = "保存交易";
  }

  async function openInstrumentDetail(symbol, type = "fund") {
    const portfolio = computePortfolio();
    const holding = portfolio.holdings.find((item) => item.symbol === symbol)
      || getWatchOnlyRows(new Set()).find((item) => item.symbol === symbol)
      || { symbol, name: symbol, type, currency: "CNY", value: 0, pnl: 0, weight: 0, quantity: 0, price: 0 };
    activeInstrumentDetail = {
      symbol: holding.symbol,
      type: holding.type || type,
      name: holding.name || symbol
    };
    els.instrumentTitle.textContent = `${holding.symbol} · ${holding.name}`;
    els.instrumentChartTitle.textContent = `${instrumentRangeLabels.intraday}行情`;
    els.instrumentSummary.innerHTML = [
      { label: "市值", value: holding.value ? money(holding.value) : "自选关注" },
      { label: "持有份额", value: holding.quantity ? formatNumber(holding.quantity) : "--" },
      { label: "盈亏", value: holding.value ? `${moneySigned(holding.pnl)} · ${percentSigned(holding.pnlRate)}` : "--", signed: holding.pnl }
    ].map((item) => `
      <div class="summary-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.signed === undefined ? escapeHtml(item.value) : colorText(item.signed, escapeHtml(item.value))}</strong>
      </div>
    `).join("");
    els.instrumentTransactions.innerHTML = state.transactions
      .filter((tx) => tx.symbol === symbol)
      .slice()
      .reverse()
      .map((tx) => transactionRecordItem(tx, { compact: true }))
      .join("") || `<article class="record-empty"><strong>暂无交易</strong><span>这是自选关注标的，还没有买入流水。</span></article>`;
    els.instrumentStatus.textContent = "查询中";
    els.backdrop.hidden = false;
    els.instrumentDrawer.classList.add("open");
    els.instrumentDrawer.setAttribute("aria-hidden", "false");
    setInstrumentRange("intraday");
    await loadInstrumentChart("intraday");
  }

  function handleInstrumentRangeClick(event) {
    const button = event.target.closest("button[data-instrument-range]");
    if (!button || !activeInstrumentDetail) return;
    event.preventDefault();
    changeInstrumentRange(button.dataset.instrumentRange || "daily");
  }

  function changeInstrumentRange(range) {
    if (!activeInstrumentDetail) return;
    setInstrumentRange(range);
    loadInstrumentChart(range);
  }

  function setInstrumentRange(range) {
    currentInstrumentRange = range;
    document.querySelectorAll("#instrumentChartRanges button").forEach((item) => {
      item.classList.toggle("active", item.dataset.instrumentRange === range);
    });
  }

  async function loadInstrumentChart(range = "daily") {
    if (!activeInstrumentDetail) return;
    const requestId = ++instrumentChartRequestId;
    const { symbol, type, name } = activeInstrumentDetail;
    const title = instrumentRangeLabels[range] || "行情";
    els.instrumentChartTitle.textContent = `${title}曲线`;
    els.instrumentStatus.textContent = "查询中";
    try {
      const data = await fetchJson(`/api/chart/${encodeURIComponent(symbol)}?kind=${encodeURIComponent(type)}&range=${encodeURIComponent(range)}`);
      if (requestId !== instrumentChartRequestId) return;
      els.instrumentStatus.textContent = data.points?.length ? "已更新" : "暂无数据";
      if (data.name) els.instrumentTitle.textContent = `${data.code} · ${data.name}`;
      renderInstrumentChartStats(data, range);
      renderInstrumentChart(els.instrumentTrendChart, data, range, { emptyText: `${name} 暂无 ${title} 数据` });
    } catch (error) {
      if (requestId !== instrumentChartRequestId) return;
      els.instrumentStatus.textContent = "查询失败";
      renderInstrumentChartStats(null, range, error.message || "查询失败");
      renderInstrumentChart(els.instrumentTrendChart, { points: [], chartType: "line" }, range, { emptyText: error.message || "查询失败" });
    }
  }

  async function handleSymbolInput() {
    const symbolInput = document.getElementById("txSymbol");
    const symbol = normalizeSymbol(symbolInput.value);
    if (symbol !== symbolInput.value) symbolInput.value = symbol;

    if (!symbol) {
      latestLookup = null;
      hideLookupPanel();
      return;
    }

    if (/^\d{6}$/.test(symbol) || /^[A-Z.]{1,8}$/.test(symbol)) {
      await lookupInstrument(symbol);
      return;
    }

    await searchInstrumentCandidates(symbol);
  }

  async function handleNameSearchInput() {
    const query = document.getElementById("txName").value.trim();
    if (!query) {
      hideSearchResults();
      return;
    }
    await searchInstrumentCandidates(query);
  }

  async function searchInstrumentCandidates(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      hideSearchResults();
      return;
    }
    try {
      const data = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data.results || []);
    } catch (error) {
      renderSearchResults([], error.message || "搜索失败");
    }
  }

  function renderSearchResults(results, errorText = "") {
    if (!results.length) {
      els.searchResults.hidden = false;
      els.searchResults.innerHTML = `<div class="search-result"><div><strong>${escapeHtml(errorText || "没有匹配结果")}</strong><span>换一个关键词或直接输入代码</span></div></div>`;
      return;
    }
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = results.map((item) => `
      <button class="search-result" type="button"
        data-code="${escapeHtml(item.code)}"
        data-name="${escapeHtml(item.name)}"
        data-type="${escapeHtml(item.type || "fund")}"
        data-currency="${escapeHtml(item.currency || "CNY")}">
        <div>
          <strong>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.subtitle || item.source || "")}</span>
        </div>
        <small>${escapeHtml(typeNames[item.type] || item.type || "")}</small>
      </button>
    `).join("");
  }

  function hideSearchResults() {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
  }

  function handleSearchResultClick(event) {
    const button = event.target.closest(".search-result[data-code]");
    if (!button) return;
    document.getElementById("txSymbol").value = button.dataset.code || "";
    document.getElementById("txName").value = button.dataset.name || "";
    document.getElementById("txType").value = button.dataset.type || "fund";
    document.getElementById("txCurrency").value = button.dataset.currency || "CNY";
    hideSearchResults();
    handleSymbolInput();
  }

  async function lookupInstrument(code) {
    const kind = document.getElementById("txType").value;
    const date = document.getElementById("txDate").value;
    const time = document.getElementById("txTime").value;
    const cacheKey = `${kind}:${code}:${date || ""}:${time || ""}`;
    showLookupPanel("查询中", code, []);
    try {
      const cached = lookupBySymbol.get(cacheKey);
      const data = cached || await fetchJson(`/api/instrument/${encodeURIComponent(code)}?kind=${encodeURIComponent(kind)}&date=${encodeURIComponent(date || "")}&time=${encodeURIComponent(time || "")}`);
      lookupBySymbol.set(cacheKey, data);
      lookupBySymbol.set(code, data);
      latestLookup = data;
      applyLookupToForm(data);
      renderLookup(data);
      hideSearchResults();
      showToast(`已匹配 ${data.name}`);
    } catch (error) {
      latestLookup = null;
      showLookupPanel("未匹配", code, [{ label: "错误", value: error.message || "查询失败" }]);
    }
  }

  function applyLookupToForm(data) {
    const nameInput = document.getElementById("txName");
    const typeInput = document.getElementById("txType");
    const priceInput = document.getElementById("txPrice");
    const currencyInput = document.getElementById("txCurrency");

    nameInput.value = data.name || data.code;
    typeInput.value = data.type || "fund";
    currencyInput.value = data.currency || "CNY";
    if (Number.isFinite(data.priceOnDate)) priceInput.value = String(data.priceOnDate);
    else if (Number.isFinite(data.estimatedNav)) priceInput.value = String(data.estimatedNav);
    else if (Number.isFinite(data.nav)) priceInput.value = String(data.nav);
    else if (Number.isFinite(data.price)) priceInput.value = String(data.price);
  }

  function renderLookup(data) {
    const isFund = data.type === "fund" || data.type === "etf" || (data.trend || []).length > 0;
    const stats = isFund
      ? [
      { label: "买入日净值", value: Number.isFinite(data.priceOnDate) ? `${data.priceOnDate.toFixed(4)}${data.priceDate ? ` · ${data.priceDate}` : ""}` : "--" },
          { label: "确认净值", value: Number.isFinite(data.nav) ? `${data.nav.toFixed(4)}${data.navDate ? ` · ${data.navDate}` : ""}` : "--" },
          { label: "估算净值", value: Number.isFinite(data.estimatedNav) ? data.estimatedNav.toFixed(4) : "--" },
          { label: "估算涨跌", value: Number.isFinite(data.estimatedChangePct) ? `${data.estimatedChangePct.toFixed(2)}%` : "--", signed: data.estimatedChangePct }
        ]
      : [
          { label: "最新价", value: Number.isFinite(data.price) ? data.price.toFixed(2) : "--" },
          { label: "昨收", value: Number.isFinite(data.previousClose) ? data.previousClose.toFixed(2) : "--" },
          { label: "涨跌幅", value: Number.isFinite(data.estimatedChangePct) ? `${data.estimatedChangePct.toFixed(2)}%` : "--", signed: data.estimatedChangePct },
          { label: "币种", value: data.currency || "--" }
        ];

    showLookupPanel("已匹配", `${data.code} · ${data.name}`, stats);
    drawFundTrendChart(data.trend || []);
  }

  function renderInstrumentChartStats(data, range, errorText = "") {
    if (!els.instrumentChartStats) return;
    if (errorText) {
      els.instrumentChartStats.innerHTML = `<div class="lookup-stat"><span>状态</span><strong>${escapeHtml(errorText)}</strong></div>`;
      return;
    }
    if (!data || !Array.isArray(data.points) || !data.points.length) {
      els.instrumentChartStats.innerHTML = `<div class="lookup-stat"><span>状态</span><strong>暂无数据</strong></div>`;
      return;
    }
    const latest = data.stats?.latest;
    const open = data.stats?.open;
    const high = data.stats?.high;
    const low = data.stats?.low;
    const changePct = data.stats?.changePct;
    const change = Number.isFinite(data.stats?.change)
      ? data.stats.change
      : Number.isFinite(latest) && Number.isFinite(open)
        ? latest - open
        : null;
    const stats = [
      { label: "最新", value: Number.isFinite(latest) ? formatChartPrice(latest) : "--" },
      { label: "涨跌", value: Number.isFinite(change) ? `${moneySigned(change)}${Number.isFinite(changePct) ? ` · ${percentSigned(changePct / 100)}` : ""}` : "--", signed: change },
      { label: "最高", value: Number.isFinite(high) ? formatChartPrice(high) : "--" },
      { label: "最低", value: Number.isFinite(low) ? formatChartPrice(low) : "--" }
    ];
    els.instrumentChartStats.innerHTML = stats
      .map((stat) => `
        <div class="lookup-stat">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${stat.signed === undefined ? escapeHtml(stat.value) : colorText(stat.signed, escapeHtml(stat.value))}</strong>
        </div>
      `)
      .join("");
  }

  function showLookupPanel(status, title, stats) {
    els.lookupPanel.hidden = false;
    els.lookupStatus.textContent = status;
    els.lookupTitle.textContent = title || "基金信息";
    els.lookupStats.innerHTML = stats
      .map((stat) => `
        <div class="lookup-stat">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${stat.signed === undefined ? escapeHtml(stat.value) : colorText(stat.signed, escapeHtml(stat.value))}</strong>
        </div>
      `)
      .join("");
    if (!stats.length) drawFundTrendChart([]);
  }

  function hideLookupPanel() {
    els.lookupPanel.hidden = true;
    els.lookupTitle.textContent = "基金信息";
    els.lookupStatus.textContent = "待查询";
    els.lookupStats.innerHTML = "";
    drawFundTrendChart([]);
  }

  function drawFundTrendChart(trend) {
    drawLineChart(els.fundTrendChart, trend, { height: 180, emptyText: "输入 6 位基金代码后显示净值曲线" });
  }

  function drawLineChart(canvas, trend, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(360, Math.floor((rect.width || 500) * dpr));
    const chartHeight = options.height || 180;
    const height = Math.floor(chartHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    ctx.scale(dpr, dpr);

    const cssWidth = width / dpr;
    const cssHeight = height / dpr;
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const points = trend.slice(-260);
    if (points.length < 2) {
      ctx.fillStyle = getMutedColor();
      ctx.font = "12px Segoe UI";
      ctx.fillText(options.emptyText || "暂无曲线数据", 12, 28);
      return;
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = { top: 16, right: 12, bottom: 24, left: 44 };
    const x = (index) => padding.left + (index / (points.length - 1)) * (cssWidth - padding.left - padding.right);
    const y = (value) => padding.top + (1 - (value - min) / (max - min || 1)) * (cssHeight - padding.top - padding.bottom);

    ctx.strokeStyle = getLineColor();
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i += 1) {
      const gy = padding.top + (i / 3) * (cssHeight - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(cssWidth - padding.right, gy);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, cssHeight - padding.bottom);
    gradient.addColorStop(0, "rgba(96, 165, 250, 0.28)");
    gradient.addColorStop(1, "rgba(96, 165, 250, 0)");
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(x(points.length - 1), cssHeight - padding.bottom);
    ctx.lineTo(x(0), cssHeight - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Segoe UI";
    ctx.fillText(max.toFixed(4), 6, padding.top + 4);
    ctx.fillText(min.toFixed(4), 6, cssHeight - padding.bottom + 4);
    ctx.fillText(points[0].date.slice(5), padding.left, cssHeight - 6);
    ctx.textAlign = "right";
    ctx.fillText(points[points.length - 1].date.slice(5), cssWidth - padding.right, cssHeight - 6);
    ctx.textAlign = "left";
  }

  function renderInstrumentChart(container, payload, range, options = {}) {
    if (!container || !window.LightweightCharts) return;
    const points = Array.isArray(payload?.points) ? payload.points : [];
    const chartType = payload?.chartType || "line";
    const size = getChartSize(container, 480);
    const desiredType = chartType === "candlestick" ? "candlestick" : "line";

    clearChartEmpty(container);

    if (instrumentChartApi && currentInstrumentChartType && currentInstrumentChartType !== desiredType) {
      resetInstrumentChart();
    }

    if (!instrumentChartApi) {
      instrumentChartApi = LightweightCharts.createChart(container, {
        ...baseChartOptions(size.width, size.height),
        timeScale: {
          borderVisible: false,
          timeVisible: range === "intraday",
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: range === "intraday" ? 4 : 8
        },
        localization: {
          priceFormatter: (price) => formatChartPrice(price)
        }
      });
    } else {
      instrumentChartApi.applyOptions({
        ...baseChartOptions(size.width, size.height),
        timeScale: {
          borderVisible: false,
          timeVisible: range === "intraday",
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: range === "intraday" ? 4 : 8
        },
        localization: {
          priceFormatter: (price) => formatChartPrice(price)
        }
      });
    }

    currentInstrumentChartType = desiredType;
    if (!points.length) {
      showChartEmpty(container, options.emptyText || "暂无图表数据");
      return;
    }

    if (desiredType === "candlestick") {
      const candleData = points
        .filter((point) => [point.open, point.high, point.low, point.close].every(Number.isFinite))
        .map((point) => ({
          time: normalizeChartTime(point.date || point.time),
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close
        }));
      if (!candleData.length) {
        showChartEmpty(container, options.emptyText || "暂无 K 线数据");
        return;
      }
      if (!instrumentCandlesSeriesApi) {
        instrumentCandlesSeriesApi = instrumentChartApi.addSeries(LightweightCharts.CandlestickSeries, {
          upColor: "#ef4444",
          downColor: "#22c55e",
          wickUpColor: "#ef4444",
          wickDownColor: "#22c55e",
          borderVisible: false,
          priceFormat: { type: "price", precision: 3, minMove: 0.001 }
        });
        instrumentSeriesApi = instrumentCandlesSeriesApi;
      }
      instrumentCandlesSeriesApi.setData(candleData);
    } else {
      const lineData = points
        .map((point) => ({
          time: normalizeChartTime(point.time || point.date),
          value: number(point.value ?? point.close ?? point.open)
        }))
        .filter((point) => point.time && Number.isFinite(point.value));
      if (!lineData.length) {
        showChartEmpty(container, options.emptyText || "暂无曲线数据");
        return;
      }
      if (!instrumentAreaSeriesApi) {
        instrumentAreaSeriesApi = instrumentChartApi.addSeries(LightweightCharts.AreaSeries, {
          lineColor: chartColors.green,
          topColor: "rgba(52, 211, 153, 0.24)",
          bottomColor: "rgba(52, 211, 153, 0.02)",
          lineWidth: 2,
          priceLineVisible: false,
          priceFormat: { type: "price", precision: 3, minMove: 0.001 }
        });
        instrumentSeriesApi = instrumentAreaSeriesApi;
      }
      instrumentAreaSeriesApi.setData(lineData);
    }

    instrumentChartApi.timeScale().fitContent();
    currentInstrumentRange = range;
  }

  function resetInstrumentChart() {
    if (instrumentChartApi) instrumentChartApi.remove();
    instrumentChartApi = null;
    instrumentSeriesApi = null;
    instrumentAreaSeriesApi = null;
    instrumentCandlesSeriesApi = null;
    currentInstrumentChartType = null;
  }

  function showChartEmpty(container, message) {
    resetInstrumentChart();
    container.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  }

  function clearChartEmpty(container) {
    const empty = container.querySelector(".chart-empty");
    if (empty) empty.remove();
  }

  function normalizeChartTime(rawValue) {
    const text = String(rawValue || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)) {
      const [datePart, timePart] = text.split(/\s+/);
      const date = new Date(`${datePart}T${timePart}:00+08:00`);
      return Math.floor(date.getTime() / 1000);
    }
    return text;
  }

  function resizeCharts() {
    if (wealthChartApi && els.wealthChart) {
      const size = getChartSize(els.wealthChart, 320);
      wealthChartApi.resize(size.width, size.height);
      wealthChartApi.timeScale().fitContent();
    }
    if (analysisChartApi && els.analysisChart) {
      const size = getChartSize(els.analysisChart, 360);
      analysisChartApi.resize(size.width, size.height);
      analysisChartApi.timeScale().fitContent();
    }
    if (instrumentChartApi && els.instrumentTrendChart && els.instrumentDrawer.classList.contains("open")) {
      const size = getChartSize(els.instrumentTrendChart, 480);
      instrumentChartApi.resize(size.width, size.height);
      instrumentChartApi.timeScale().fitContent();
    }
  }

  function formatChartPrice(value) {
    const num = number(value);
    if (!Number.isFinite(num)) return "--";
    if (Math.abs(num) >= 1000) return num.toFixed(0);
    if (Math.abs(num) >= 100) return num.toFixed(2);
    if (Math.abs(num) >= 10) return num.toFixed(2);
    return num.toFixed(3);
  }

  function formatChartLabel(point) {
    if (!point) return "";
    if (point.time) return point.time.slice(11, 16) || point.time;
    if (point.date) return point.date.slice(5);
    return "";
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
    return data;
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase();
  }

  async function saveTransaction(event) {
    event.preventDefault();
    const formData = new FormData(els.form);
    const mode = els.form.dataset.mode || "transaction";
    const tx = {
      id: els.form.dataset.editId || `tx-${Date.now()}`,
      date: String(formData.get("date")),
      time: String(formData.get("time") || ""),
      action: String(formData.get("action")),
      status: String(formData.get("status") || "confirmed"),
      symbol: String(formData.get("symbol")).trim().toUpperCase(),
      name: String(formData.get("name")).trim(),
      type: String(formData.get("type")),
      account: String(formData.get("account")).trim(),
      inputMode: String(formData.get("inputMode") || "shares"),
      quantity: number(formData.get("quantity")),
      price: number(formData.get("price")),
      fee: number(formData.get("fee")),
      currency: String(formData.get("currency")),
      note: String(formData.get("note")).trim()
    };
    await hydrateTransactionPrice(tx);
    const matchedLookup = latestLookup?.code === tx.symbol ? latestLookup : lookupBySymbol.get(tx.symbol);

    if (mode === "watchlist") {
      addWatchlistItem(tx, matchedLookup);
      resetTransactionForm();
      closeDrawer();
      render();
      showToast("已添加自选");
      return;
    }

    const editIndex = state.transactions.findIndex((item) => item.id === tx.id);
    if (editIndex >= 0) state.transactions[editIndex] = tx;
    else state.transactions.push(tx);

    state.prices[tx.symbol] = Number.isFinite(matchedLookup?.nav)
      ? matchedLookup.nav
      : Number.isFinite(matchedLookup?.estimatedNav)
        ? matchedLookup.estimatedNav
        : tx.price;
    state.dayChangePct[tx.symbol] = Number.isFinite(matchedLookup?.estimatedChangePct)
      ? matchedLookup.estimatedChangePct / 100
      : (state.dayChangePct[tx.symbol] || 0);
    persist();
    resetTransactionForm();
    closeDrawer();
    render();
    showToast(editIndex >= 0 ? "交易已更新" : "交易已保存");
  }

  async function hydrateTransactionPrice(tx) {
    const shouldHydrate = (tx.type === "fund" || tx.type === "etf")
      && tx.inputMode === "amount"
      && (isBuyAction(tx.action) || isSellAction(tx.action))
      && tx.symbol
      && (!number(tx.price) || number(tx.price) === 1);
    if (!shouldHydrate) return;
    try {
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(tx.symbol)}?kind=${encodeURIComponent(tx.type)}&date=${encodeURIComponent(tx.date || "")}&time=${encodeURIComponent(tx.time || "")}`);
      latestLookup = data;
      if (Number.isFinite(data.priceOnDate)) tx.price = data.priceOnDate;
      else if (Number.isFinite(data.nav)) tx.price = data.nav;
    } catch {
      // Keep the manually entered price when historical lookup is unavailable.
    }
  }

  function addWatchlistItem(tx, lookup) {
    const item = {
      symbol: tx.symbol,
      name: lookup?.name || tx.name || tx.symbol,
      type: lookup?.type || tx.type || "fund",
      currency: lookup?.currency || tx.currency || "CNY",
      note: tx.note
    };
    state.watchlist = (state.watchlist || []).filter((existing) => existing.symbol !== item.symbol);
    state.watchlist.push(item);
    if (Number.isFinite(lookup?.nav)) state.prices[item.symbol] = lookup.nav;
    else if (Number.isFinite(lookup?.estimatedNav)) state.prices[item.symbol] = lookup.estimatedNav;
    else if (Number.isFinite(lookup?.price)) state.prices[item.symbol] = lookup.price;
    if (Number.isFinite(lookup?.estimatedChangePct)) state.dayChangePct[item.symbol] = lookup.estimatedChangePct / 100;
    persist();
  }

  function resetTransactionForm() {
    els.form.reset();
    els.form.dataset.mode = "transaction";
    delete els.form.dataset.editId;
    latestLookup = null;
    hideLookupPanel();
    hideSearchResults();
    document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = "15:01";
    document.getElementById("txStatus").value = "confirmed";
    document.getElementById("txInputMode").value = "amount";
    document.getElementById("txQuantity").value = "2000";
    document.getElementById("txPrice").value = "1";
    document.getElementById("txFee").value = "0";
    document.getElementById("txAccount").value = "主账户";
    updateInputModeLabels();
  }

  function clearAllData() {
    const confirmed = window.confirm("确认清空所有本地和云端资产数据？这个操作会保留同步口令，但会删除交易、自选和价格缓存。");
    if (!confirmed) return;
    localStorage.removeItem(storageKey);
    const next = createEmptyState();
    state.prices = next.prices;
    state.dayChangePct = next.dayChangePct;
    state.transactions = next.transactions;
    state.watchlist = next.watchlist;
    persist();
    render();
    showToast("已清空数据");
  }

  function exportCsv() {
    const header = ["date", "time", "action", "status", "symbol", "name", "type", "account", "quantity", "price", "fee", "currency", "note"];
    const rows = state.transactions.map((tx) => header.map((key) => csvCell(tx[key])).join(","));
    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nanstar-wealth-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV 已导出");
  }

  function getSortedTransactions() {
    return state.transactions.slice().sort((a, b) => {
      const left = `${a.date || ""} ${a.time || ""}`;
      const right = `${b.date || ""} ${b.time || ""}`;
      return left.localeCompare(right);
    });
  }

  function formatTransactionDateTime(tx) {
    if (!tx) return "";
    return tx.time ? `${tx.date} ${tx.time}` : tx.date;
  }

  function colorText(value, text) {
    const cls = value >= 0 ? "positive" : "negative";
    return `<span class="${cls}">${text}</span>`;
  }

  function money(value, currency = "CNY") {
    const symbol = currency === "USD" ? "$" : currency === "HKD" ? "HK$" : "¥";
    return `${symbol}${formatNumber(value, 2)}`;
  }

  function shortMoney(value) {
    if (Math.abs(value) >= 10000) return `¥${formatNumber(value / 10000, 1)}万`;
    return money(value);
  }

  function moneySigned(value) {
    const sign = value >= 0 ? "+" : "-";
    return `${sign}${money(Math.abs(value))}`;
  }

  function shortSigned(value) {
    const sign = value >= 0 ? "+" : "-";
    const abs = Math.abs(number(value));
    if (abs >= 10000) return `${sign}¥${formatNumber(abs / 10000, 1)}万`;
    if (abs >= 1000) return `${sign}¥${formatNumber(abs / 1000, 1)}k`;
    return `${sign}¥${formatNumber(abs, 0)}`;
  }

  function percent(value) {
    return `${(number(value) * 100).toFixed(1)}%`;
  }

  function percentSigned(value) {
    const sign = value >= 0 ? "+" : "-";
    return `${sign}${percent(Math.abs(value))}`;
  }

  function formatNumber(value, digits = 2) {
    return Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round(number(value) * 100) / 100;
  }

  function maxBy(rows, getValue) {
    return rows.reduce((best, row) => (!best || getValue(row) > getValue(best) ? row : best), null);
  }

  function minBy(rows, getValue) {
    return rows.reduce((best, row) => (!best || getValue(row) < getValue(best) ? row : best), null);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  }

  function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function getTextColor() {
    return getCssVar("--text") || "#f8fafc";
  }

  function getMutedColor() {
    return getCssVar("--muted") || "#94a3b8";
  }

  function getLineColor() {
    return getCssVar("--line") || "rgba(148, 163, 184, 0.18)";
  }

  function getSurfaceColor() {
    return getCssVar("--surface") || "#161b22";
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();
