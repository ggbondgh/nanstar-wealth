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
      transactions: [],
      brokerage: null
    };
  }

  function instrumentKey(symbol, type = "") {
    const normalizedSymbol = normalizeSymbol(symbol || "");
    const normalizedType = String(type || "").trim() || "fund";
    return normalizedSymbol ? `${normalizedType || "fund"}:${normalizedSymbol}` : "";
  }

  function sameInstrument(leftSymbol, leftType, rightSymbol, rightType) {
    return instrumentKey(leftSymbol, leftType) === instrumentKey(rightSymbol, rightType);
  }

  function cacheLookupData(data, fallbackSymbol = "", fallbackType = "") {
    if (!data) return;
    const symbol = normalizeSymbol(data.code || fallbackSymbol || "");
    const type = String(data.type || fallbackType || "fund").trim();
    const key = instrumentKey(symbol, type);
    if (key) lookupBySymbol.set(key, data);
  }

  function lookupCacheKey(symbol, type, date = "", time = "") {
    return `${instrumentKey(symbol, type)}:${date || ""}:${time || ""}`;
  }

  function legacyPriceValue(symbol, type = "") {
    const key = instrumentKey(symbol, type);
    return (key && Number.isFinite(state.prices?.[key])) ? state.prices[key] : state.prices?.[symbol];
  }

  function legacyDayChangeValue(symbol, type = "") {
    const key = instrumentKey(symbol, type);
    return (key && Number.isFinite(state.dayChangePct?.[key])) ? state.dayChangePct[key] : state.dayChangePct?.[symbol];
  }

  function setInstrumentPrice(symbol, type, value) {
    const key = instrumentKey(symbol, type);
    if (key && Number.isFinite(value)) state.prices[key] = value;
  }

  function setInstrumentDayChange(symbol, type, value) {
    const key = instrumentKey(symbol, type);
    if (key && Number.isFinite(value)) state.dayChangePct[key] = value;
  }

  function normalizeInstrumentType(type, symbol = "", name = "") {
    const current = String(type || "").trim();
    if (current === "cash" || current === "crypto") return current;
    const text = `${symbol || ""} ${name || ""}`;
    const inferred = inferInstrumentType(symbol, name || "");
    if (name || !current) return inferred;
    if (current === "fund" || current === "etf" || current === "stock") return current;
    if (/基金|混合|债券|货币|指数|联接|连接|QDII|FOF|ETF/i.test(text)) return inferred;
    return inferred;
  }

  function normalizeTransactionInstrument(tx) {
    if (!tx) return false;
    let changed = false;
    const normalizedSymbol = normalizeSymbol(tx.symbol || "");
    if (normalizedSymbol && normalizedSymbol !== tx.symbol) {
      tx.symbol = normalizedSymbol;
      changed = true;
    }
    const inferredType = normalizeInstrumentType(tx.type, tx.symbol, tx.name);
    if (inferredType && tx.type !== inferredType) {
      tx.type = inferredType;
      changed = true;
    }
    return changed;
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
    wealthChartSummary: document.getElementById("wealthChartSummary"),
    allocationChart: document.getElementById("allocationChart"),
    allocationLegend: document.getElementById("allocationLegend"),
    brokerageSummary: document.getElementById("brokerageSummary"),
    brokeragePositions: document.getElementById("brokeragePositions"),
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
    instrumentChartMeta: document.getElementById("instrumentChartMeta"),
    instrumentChartStats: document.getElementById("instrumentChartStats"),
    instrumentTrendChart: document.getElementById("instrumentTrendChart"),
    instrumentChartAxisHint: document.getElementById("instrumentChartAxisHint"),
    instrumentTransactions: document.getElementById("instrumentTransactions"),
    instrumentChartRanges: document.getElementById("instrumentChartRanges"),
    drawer: document.getElementById("transactionDrawer"),
    backdrop: document.getElementById("drawerBackdrop"),
    form: document.getElementById("transactionForm"),
    toast: document.getElementById("toast"),
    fundUpdateTime: document.getElementById("fundUpdateTime"),
    fundRefreshButton: document.getElementById("fundRefreshButton"),
    fundImportButton: document.getElementById("fundImportButton"),
    fundFileInput: document.getElementById("fundFileInput"),
    fundGuruStats: document.getElementById("fundGuruStats"),
    fundGuruBody: document.getElementById("fundGuruBody"),
    fundSectorHolding: document.getElementById("fundSectorHolding"),
    fundSectorInflow: document.getElementById("fundSectorInflow"),
    fundSectorOutflow: document.getElementById("fundSectorOutflow"),
    fundTradeBody: document.getElementById("fundTradeBody"),
    fundHoldingBody: document.getElementById("fundHoldingBody"),
    fundHoldingSearch: document.getElementById("fundHoldingSearch"),
    fundEmpty: document.getElementById("fundEmpty"),
    fundEmptyImportButton: document.getElementById("fundEmptyImportButton")
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
  let fundData = null;
  let activeFundTab = "guru";
  let instrumentAreaSeriesApi = null;
  let instrumentCandlesSeriesApi = null;
  let wealthChartLabelApi = null;
  let wealthChartCrosshairCleanup = null;
  let analysisChartLabelApi = null;
  let analysisChartCrosshairCleanup = null;
  let instrumentChartLabelApi = null;
  let instrumentChartCrosshairCleanup = null;
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
    document.querySelectorAll(".segmented button[data-range]").forEach((button) => {
      button.addEventListener("click", () => {
        activeRange = button.dataset.range;
        syncWealthRangeButtons();
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
    document.getElementById("pasteImportTextButton").addEventListener("click", pasteImportText);
    document.getElementById("applyImportTextButton").addEventListener("click", applyImportPreview);
    document.getElementById("ocrImportButton").addEventListener("click", handleOcrImportPlaceholder);
    document.getElementById("syncTokenButton").addEventListener("click", configureSyncToken);
    document.getElementById("syncNowButton").addEventListener("click", () => syncCloudState({ forcePush: true }));
    document.getElementById("closeDrawerButton").addEventListener("click", closeDrawer);
    document.getElementById("closeInstrumentButton").addEventListener("click", closeInstrumentDrawer);
    document.getElementById("wealthChartReset").addEventListener("click", () => resetChartView(wealthChartApi));
    document.getElementById("analysisChartReset").addEventListener("click", () => resetChartView(analysisChartApi));
    document.getElementById("instrumentChartReset").addEventListener("click", () => resetChartView(instrumentChartApi));
    els.instrumentChartRanges.addEventListener("click", handleInstrumentRangeClick);
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
    document.getElementById("importFileInput").addEventListener("change", () => {
      if (document.getElementById("importFileInput").files?.length) parseImportFile();
    });
    document.getElementById("txType").addEventListener("change", () => {
      updateInputModeLabels();
      handleSymbolInput();
    });
    els.searchResults.addEventListener("click", handleSearchResultClick);
    document.getElementById("txInputMode").addEventListener("change", updateInputModeLabels);
    els.holdingsBody.addEventListener("click", handleHoldingsAction);
    els.topHoldingsBody.addEventListener("click", handleHoldingsAction);
    if (els.brokeragePositions) els.brokeragePositions.addEventListener("click", handleHoldingsAction);
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

    // Fund module bindings
    document.querySelectorAll(".fund-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { switchFundTab(this.dataset.fundTab); });
    });
    els.fundRefreshButton.addEventListener("click", loadFundDataFromFile);
    els.fundImportButton.addEventListener("click", function () { els.fundFileInput.click(); });
    els.fundEmptyImportButton.addEventListener("click", function () { els.fundFileInput.click(); });
    els.fundFileInput.addEventListener("change", function () {
      if (els.fundFileInput.files && els.fundFileInput.files.length) importFundExcel();
    });
    if (els.fundHoldingSearch) {
      els.fundHoldingSearch.addEventListener("input", function () { renderFundHoldingTable(); });
    }

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("txDate").value = today;
    document.getElementById("txTime").value = "15:01";
    ensureStateShape();
    syncWealthRangeButtons();
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

      if (options.forcePush) {
        if (remoteState) {
          const merged = mergeCloudState(remoteState);
          replaceState(merged);
          ensureStateShape();
          persist({ sync: false });
          render();
        }
        await pushCloudState();
        updateSyncStatus("已同步", remoteUpdatedAt || getSyncMeta().remoteUpdatedAt || "");
        return;
      }

      if (!remoteState && localStateSource === "stored") {
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
    merged.brokerage = pickNewestBrokerage(remote.brokerage, merged.brokerage);
    return merged;
  }

  function pickNewestBrokerage(remote, local) {
    if (!remote) return local || null;
    if (!local) return remote;
    const remoteTime = Date.parse(remote.updatedAt || "") || 0;
    const localTime = Date.parse(local.updatedAt || "") || 0;
    return remoteTime >= localTime ? remote : local;
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
      normalizeTransactionInstrument(tx);
      if (!tx.symbol || tx.type === "cash") return;
      instruments.set(instrumentKey(tx.symbol, tx.type), { symbol: tx.symbol, type: tx.type || "fund", name: tx.name || "" });
    });
    (state.watchlist || []).forEach((item) => {
      item.type = normalizeInstrumentType(item.type, item.symbol, item.name);
      if (!item.symbol || item.type === "cash") return;
      instruments.set(instrumentKey(item.symbol, item.type), { symbol: item.symbol, type: item.type || "fund", name: item.name || "" });
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
        setInstrumentPrice(item.symbol, item.type, latestPrice);
        updated = true;
      }
      if (Number.isFinite(data.estimatedChangePct)) {
        setInstrumentDayChange(item.symbol, item.type, data.estimatedChangePct / 100);
        updated = true;
      }
      cacheLookupData(data, item.symbol, item.type);
    }));

    await Promise.allSettled(state.transactions.map(async (tx) => {
      normalizeTransactionInstrument(tx);
      const needsHistoricalPrice = (tx.type === "fund" || tx.type === "etf")
        && tx.inputMode === "amount"
        && (isBuyAction(tx.action) || isSellAction(tx.action))
        && tx.symbol
        && (!number(tx.price) || number(tx.price) === 1);
      if (!needsHistoricalPrice) return;
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(tx.symbol)}?kind=${encodeURIComponent(tx.type)}&date=${encodeURIComponent(tx.date || "")}&time=${encodeURIComponent(tx.time || "")}`);
      const derivedPrice = Number.isFinite(data.priceOnDate)
        ? data.priceOnDate
        : Number.isFinite(data.nav)
          ? data.nav
          : Number.isFinite(data.estimatedNav)
            ? data.estimatedNav
            : null;
      if (Number.isFinite(derivedPrice)) {
        tx.price = derivedPrice;
        updated = true;
      }
      cacheLookupData(data, tx.symbol, tx.type);
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
    if (!state.brokerage || typeof state.brokerage !== "object" || Array.isArray(state.brokerage)) state.brokerage = null;
    let migrated = false;
    if (removeDemoSeedData()) migrated = true;
    state.transactions.forEach((tx) => {
      if (normalizeTransactionInstrument(tx)) migrated = true;
      if (!tx.status) {
        tx.status = "confirmed";
        migrated = true;
      }
      if (!tx.inputMode && tx.type === "fund" && tx.action === "buy" && number(tx.quantity) <= 1 && number(tx.price) > 100) {
        tx.inputMode = "amount";
        tx.quantity = number(tx.price);
        const currentPrice = legacyPriceValue(tx.symbol, tx.type) || 0;
        tx.price = currentPrice > 0 && currentPrice < 100 ? currentPrice : 1;
        tx.note = tx.note ? `${tx.note} · 已按金额模式修正` : "已按金额模式修正";
        migrated = true;
      }
      if (!tx.time && (tx.type === "fund" || tx.type === "etf")) {
        tx.time = "15:01";
        migrated = true;
      }
      const oldPrice = state.prices?.[tx.symbol];
      if (Number.isFinite(oldPrice)) {
        setInstrumentPrice(tx.symbol, tx.type, oldPrice);
        migrated = true;
      }
      const oldDayChange = state.dayChangePct?.[tx.symbol];
      if (Number.isFinite(oldDayChange)) {
        setInstrumentDayChange(tx.symbol, tx.type, oldDayChange);
        migrated = true;
      }
    });
    (state.watchlist || []).forEach((item) => {
      const nextType = normalizeInstrumentType(item.type, item.symbol, item.name);
      if (nextType && item.type !== nextType) {
        item.type = nextType;
        migrated = true;
      }
      const oldPrice = state.prices?.[item.symbol];
      if (Number.isFinite(oldPrice)) {
        setInstrumentPrice(item.symbol, item.type, oldPrice);
        migrated = true;
      }
      const oldDayChange = state.dayChangePct?.[item.symbol];
      if (Number.isFinite(oldDayChange)) {
        setInstrumentDayChange(item.symbol, item.type, oldDayChange);
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
    document.querySelectorAll(".view").forEach((panel) => {
      const isActive = panel.dataset.panel === view;
      panel.classList.toggle("active", isActive);
      // Re-trigger animation on view switch
      if (isActive) {
        panel.style.animation = 'none';
        panel.offsetHeight; // Force reflow
        panel.style.animation = '';
      }
    });
    const titles = {
      overview: "资产总览",
      holdings: "全部持仓",
      transactions: "交易流水",
      insights: "复盘与风险",
      funds: "基金达人实盘"
    };
    els.pageTitle.textContent = titles[view] || "资产总览";
    // Scroll to top smoothly when switching views
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === "funds") { loadFundDataFromFile(); }
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

  function finiteValue(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }

  function normalizeTinyMoney(value) {
    const parsed = finiteValue(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.abs(parsed) < 1 ? 0 : parsed;
  }

  function isBrokerageCashPosition(item) {
    const symbol = normalizeSymbol(item?.symbol || item?.code || "");
    const type = String(item?.type || "").trim().toLowerCase();
    const name = String(item?.name || "");
    return type === "cash" || symbol === "CASH" || symbol === "RMB" || /现金|资金|余额/.test(name);
  }

  function normalizeBrokeragePosition(item, accountLabel) {
    const symbol = normalizeSymbol(item.symbol || item.code || "");
    if (!symbol || isBrokerageCashPosition(item)) return null;
    const name = item.name || symbol;
    const type = normalizeInstrumentType(item.type, symbol, name);
    const quantity = number(item.quantity);
    const rawMarketValue = finiteValue(item.marketValue, quantity * finiteValue(item.lastPrice, item.price));
    const value = normalizeTinyMoney(rawMarketValue);
    const price = finiteValue(item.lastPrice, item.price, quantity ? value / quantity : NaN, legacyPriceValue(symbol, type), 0);
    const costPrice = finiteValue(item.costPrice);
    const costFromPrice = Number.isFinite(costPrice) ? costPrice * quantity : NaN;
    const cost = finiteValue(item.cost, item.costAmount, costFromPrice, value - number(item.pnl), value);
    const pnl = finiteValue(item.pnl, value - cost, 0);
    const avgCost = quantity ? cost / quantity : finiteValue(item.costPrice, 0);
    const pnlRate = Number.isFinite(finiteValue(item.pnlRate)) ? finiteValue(item.pnlRate) : (cost > 0 ? pnl / cost : 0);
    const dayChange = value * (finiteValue(item.dayChangePct, legacyDayChangeValue(symbol, type), 0) || 0);
    return {
      key: instrumentKey(symbol, type),
      symbol,
      name,
      type,
      account: accountLabel,
      currency: item.currency || "CNY",
      quantity,
      cost,
      price,
      value,
      pnl,
      pnlRate,
      avgCost,
      dayChange,
      realized: 0,
      source: "brokerage"
    };
  }

  function getBrokerageSnapshot() {
    const brokerage = state.brokerage;
    if (!brokerage || typeof brokerage !== "object") {
      return {
        brokerage: null,
        account: {},
        accountLabel: "国信",
        holdings: [],
        keys: new Set(),
        cashValue: 0,
        totalAsset: NaN,
        marketValue: NaN,
        pnl: 0,
        hasData: false
      };
    }

    const accounts = Array.isArray(brokerage.accounts) ? brokerage.accounts : [];
    const positions = Array.isArray(brokerage.positions) ? brokerage.positions : [];
    const account = accounts[0] || {};
    const accountLabel = `国信 ${brokerage.accountIdMasked || ""}`.trim();
    const holdings = positions
      .map((item) => normalizeBrokeragePosition(item, accountLabel))
      .filter(Boolean);
    const keys = new Set(holdings.map((item) => item.key));
    const positionMarketValue = holdings.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    const accountMarketValue = finiteValue(account.marketValue);
    const marketValue = Number.isFinite(accountMarketValue) && accountMarketValue >= 0 ? accountMarketValue : positionMarketValue;
    const accountTotalAsset = finiteValue(account.totalAsset);
    const totalAsset = Number.isFinite(accountTotalAsset) && accountTotalAsset >= marketValue
      ? accountTotalAsset
      : NaN;
    const explicitCash = finiteValue(account.availableCash, account.fetchableCash, account.cashBalance);
    const cashRowsValue = positions
      .filter(isBrokerageCashPosition)
      .reduce((sum, item) => sum + normalizeTinyMoney(finiteValue(item.marketValue, item.value, item.quantity, item.availableCash, 0)), 0);
    let cashValue = 0;
    if (Number.isFinite(totalAsset)) cashValue = Math.max(0, totalAsset - marketValue);
    else if (cashRowsValue > 0) cashValue = cashRowsValue;
    else if (Number.isFinite(explicitCash)) cashValue = Math.max(0, explicitCash);

    return {
      brokerage,
      account,
      accountLabel,
      holdings,
      keys,
      cashValue,
      totalAsset: Number.isFinite(totalAsset) ? totalAsset : marketValue + cashValue,
      marketValue,
      pnl: finiteValue(account.pnl, holdings.reduce((sum, item) => sum + item.pnl, 0), 0),
      hasData: Boolean(accounts.length || positions.length)
    };
  }

  function computePortfolio() {
    const brokerageSnapshot = getBrokerageSnapshot();
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
      normalizeTransactionInstrument(tx);
      const symbol = normalizeSymbol(tx.symbol);
      const key = instrumentKey(symbol, tx.type);

      if (key && brokerageSnapshot.keys.has(key)) return;

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
      if (!key) return;

      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          key,
          symbol,
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
        const price = legacyPriceValue(holding.symbol, holding.type) ?? 1;
        const value = holding.quantity * price * rate;
        const pnl = value - holding.cost + holding.realized;
        const pnlRate = holding.cost > 0 ? pnl / holding.cost : 0;
        const avgCost = holding.quantity > 0 ? holding.cost / holding.quantity / rate : 0;
        const dayChange = value * (legacyDayChangeValue(holding.symbol, holding.type) || 0);
        return { ...holding, price, value, pnl, pnlRate, avgCost, dayChange };
      });

    holdings.push(...brokerageSnapshot.holdings);
    cash += brokerageSnapshot.cashValue;

    const cashHolding = {
      symbol: "CASH",
      name: "可用现金",
      type: "cash",
      account: brokerageSnapshot.hasData ? brokerageSnapshot.accountLabel : "聚合",
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
    const inferredCapital = Math.max(0, totalValue - totalPnl);
    const capitalBase = Math.max(invested, inferredCapital, totalCost);
    const pnlRateBase = totalCost || capitalBase;

    holdings.forEach((holding) => {
      holding.weight = totalValue > 0 ? Math.max(0, holding.value) / totalValue : 0;
    });

    return {
      holdings: holdings.sort((a, b) => b.value - a.value),
      invested: capitalBase,
      totalValue,
      totalCost,
      totalPnl,
      realized,
      dividends,
      dayChange,
      dayChangeRate: totalValue ? dayChange / (totalValue - dayChange) : 0,
      totalPnlRate: pnlRateBase ? totalPnl / pnlRateBase : 0,
      cash: cashHolding
    };
  }

  function render() {
    const portfolio = computePortfolio();
    renderMetrics(portfolio);
    renderHoldings(portfolio);
    renderTransactions();
    renderRecent();
    renderBrokerage();
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
    els.cashWeight.textContent = `占组合 ${percent(portfolio.cash.weight)}`;
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
    const ownedKeys = new Set(portfolio.holdings.map((holding) => instrumentKey(holding.symbol, holding.type)));
    const watchOnly = getWatchOnlyRows(ownedKeys);
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

  function syncWealthRangeButtons() {
    document.querySelectorAll(".segmented button[data-range]").forEach((button) => {
      button.classList.toggle("active", (button.dataset.range || "3m") === activeRange);
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

  function transactionMatchesAnalysisType(tx, typeFilter = "all") {
    if (!typeFilter || typeFilter === "all") return true;
    if (typeFilter === "fund") return tx.type === "fund" || tx.type === "etf";
    return tx.type === typeFilter;
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

  function getWatchOnlyRows(ownedKeys) {
    return (state.watchlist || [])
      .filter((item) => !ownedKeys.has(instrumentKey(item.symbol, item.type)))
      .map((item) => {
        const price = legacyPriceValue(item.symbol, item.type) ?? 0;
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
    const canShowMarketDetail = holding.type !== "cash";
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          ${canShowMarketDetail ? `
            <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
              <strong>${escapeHtml(holding.symbol)}</strong>
              <span>${escapeHtml(holding.name)}${holding.watchOnly ? " · 自选" : ""}</span>
            </button>
          ` : `
            <div class="symbol-cell">
              <strong>${escapeHtml(holding.symbol)}</strong>
              <span>${escapeHtml(holding.name)}</span>
            </div>
          `}
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
            ${canShowMarketDetail ? `<button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>` : ""}
            ${holding.watchOnly ? `<button type="button" data-action="remove-watch" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">移除</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }

  function topHoldingRow(holding) {
    const canShowMarketDetail = holding.type !== "cash";
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          ${canShowMarketDetail ? `
            <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
              <strong>${escapeHtml(holding.symbol)}</strong>
              <span>${escapeHtml(holding.name)}</span>
            </button>
          ` : `
            <div class="symbol-cell">
              <strong>${escapeHtml(holding.symbol)}</strong>
              <span>${escapeHtml(holding.name)}</span>
            </div>
          `}
        </td>
        <td><span class="badge">${typeNames[holding.type] || holding.type}</span></td>
        <td>${money(holding.value)}</td>
        <td>${colorText(holding.pnl, moneySigned(holding.pnl))}</td>
        <td>${percent(holding.weight)}</td>
        <td>
          <div class="row-actions">
            ${canShowMarketDetail ? `<button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>` : ""}
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

  function renderBrokerage() {
    if (!els.brokerageSummary || !els.brokeragePositions) return;
    const brokerage = state.brokerage;
    if (!brokerage) {
      els.brokerageSummary.innerHTML = `
        <article class="summary-tile">
          <span>状态</span>
          <strong>未连接</strong>
        </article>
        <article class="summary-tile">
          <span>同步方式</span>
          <strong>本地桥接</strong>
        </article>
        <article class="summary-tile">
          <span>券商</span>
          <strong>国信证券</strong>
        </article>
        <article class="summary-tile">
          <span>快照时间</span>
          <strong>--</strong>
        </article>
      `;
      els.brokeragePositions.innerHTML = `<div class="brokerage-empty">还没有国信账户快照。运行本地同步脚本后，这里会显示资金、持仓、委托和成交记录。</div>`;
      return;
    }

    const snapshot = getBrokerageSnapshot();
    const positions = snapshot.holdings;
    const orders = Array.isArray(brokerage.orders) ? brokerage.orders : [];
    const deals = Array.isArray(brokerage.deals) ? brokerage.deals : [];
    const updatedAt = formatSnapshotTime(brokerage.updatedAt);

    els.brokerageSummary.innerHTML = [
      { label: "账户", value: brokerage.accountIdMasked || "--" },
      { label: "总资产", value: Number.isFinite(snapshot.totalAsset) ? money(snapshot.totalAsset) : "--" },
      { label: "可用现金", value: money(snapshot.cashValue) },
      { label: "证券市值", value: money(snapshot.marketValue) },
      { label: "持仓数", value: String(positions.length) },
      { label: "委托 / 成交", value: `${orders.length} / ${deals.length}` },
      { label: "更新时间", value: updatedAt || "--" },
      { label: "来源", value: brokerage.source || brokerage.provider || "local-bridge" }
    ].map((item) => `
      <article class="summary-tile">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `).join("");

    els.brokeragePositions.innerHTML = positions.length
      ? `
        <div class="table-wrap">
          <table class="brokerage-table">
            <thead>
              <tr>
                <th>代码 / 名称</th>
                <th>类型</th>
                <th>数量</th>
                <th>成本</th>
                <th>现价</th>
                <th>市值</th>
                <th>盈亏</th>
              </tr>
            </thead>
            <tbody>
              ${positions.slice(0, 8).map((item) => `
                <tr>
                  <td>
                    <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(item.symbol)}" data-type="${escapeHtml(item.type)}">
                      <strong>${escapeHtml(item.symbol || "--")}</strong>
                      <span>${escapeHtml(item.name || "")}</span>
                    </button>
                  </td>
                  <td>${escapeHtml(typeNames[item.type] || item.type || "--")}</td>
                  <td>${formatNumber(item.quantity)}</td>
                  <td>${money(item.avgCost)}</td>
                  <td>${money(item.price)}</td>
                  <td>${money(item.value)}</td>
                  <td>${colorText(number(item.pnl), moneySigned(number(item.pnl)))} <small>${escapeHtml(percent(item.pnlRate))}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="brokerage-empty">最新快照里没有国信持仓。</div>`;
  }

  function optionalMoney(value, currency = "CNY") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? money(parsed, currency) : "--";
  }

  function formatSnapshotTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-CN", { hour12: false });
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
    const timeline = getPortfolioTimeline(activeAnalysisType);
    const txRows = getSortedTransactions()
      .filter((tx) => (tx.status || "confirmed") === "confirmed")
      .filter((tx) => transactionMatchesAnalysisType(tx, activeAnalysisType));

    const contributors = computeAnalysisContributors(portfolio, activeAnalysisType);
    const visiblePoints = timeline
      .filter((point) => txRows.some((tx) => tx.date <= point.time))
      .filter((point) => (!rangeStartKey || point.time >= rangeStartKey) && point.time <= endKey)
      .map((point) => ({
        ...point,
        value: point.pnl
      }));
    const coveredDays = visiblePoints.filter((point) => !point.missingHistory || point.marketValue === 0).length;
    const maxDrawdown = computeMaxDrawdown(visiblePoints.map((point) => point.value));
    const latest = visiblePoints.length ? visiblePoints[visiblePoints.length - 1] : null;
    return {
      points: visiblePoints,
      contributors,
      totalPnl: visiblePoints.length ? visiblePoints[visiblePoints.length - 1].value : 0,
      startPnl: visiblePoints.length ? visiblePoints[0].value : 0,
      maxDrawdown,
      coverage: visiblePoints.length ? coveredDays / visiblePoints.length : 1,
      realizedPnl: latest?.realizedPnl || 0,
      unrealizedPnl: latest?.unrealizedPnl || 0,
      dividends: latest?.dividends || 0
    };
  }

  function computeMaxDrawdown(values) {
    let peak = -Infinity;
    let drawdown = 0;
    values.forEach((value) => {
      const current = number(value);
      if (!Number.isFinite(current)) return;
      peak = Math.max(peak, current);
      if (Number.isFinite(peak)) drawdown = Math.min(drawdown, current - peak);
    });
    return drawdown;
  }

  function estimateAnalysisPrice(item, dateKey) {
    const cached = analysisHistoryCache.get(historyCacheKey(item.symbol, item.type, dateKey));
    if (Number.isFinite(cached?.price) && cached.price > 0) return cached.price;
    const current = number(legacyPriceValue(item.symbol, item.type));
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
      { label: "浮动盈亏", value: moneySigned(data.unrealizedPnl), signed: data.unrealizedPnl },
      { label: "已实现盈亏", value: moneySigned(data.realizedPnl), signed: data.realizedPnl },
      { label: "分红现金流", value: moneySigned(data.dividends), signed: data.dividends },
      { label: "最佳单日", value: best ? `${best.time.slice(5)} · ${moneySigned(best.dailyPnl)}` : "--", signed: best?.dailyPnl || 0 },
      { label: "最差单日", value: worst ? `${worst.time.slice(5)} · ${moneySigned(worst.dailyPnl)}` : "--", signed: worst?.dailyPnl || 0 },
      { label: "最大回撤", value: moneySigned(data.maxDrawdown), signed: data.maxDrawdown },
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
    if (!points.length) {
      showInlineChartEmpty(els.analysisChart, "导入交易流水后生成盈亏曲线");
      return;
    }
    clearInlineChartEmpty(els.analysisChart);
    const data = points.map((point) => ({
      time: point.time,
      value: point.value,
      dailyPnl: point.dailyPnl,
      unrealizedPnl: point.unrealizedPnl,
      realizedPnl: point.realizedPnl,
      dividends: point.dividends,
      marketValue: point.marketValue,
      cost: point.cost,
      cash: point.cash
    }));
    analysisSeriesApi.setData(data);
    if (analysisChartApi) {
      applySeriesAutoscale(analysisSeriesApi);
      bindChartCrosshair(analysisChartApi, {
        container: els.analysisChart,
        formatPrice: (value) => moneySigned(value),
        formatTime: (time) => formatChartLabelTime(time),
        formatExtra: (point) => point ? `累计 ${moneySigned(point.value)} · 日变动 ${moneySigned(point.dailyPnl)} · 浮动 ${moneySigned(point.unrealizedPnl || 0)}` : "",
        series: analysisSeriesApi,
        setCleanup: (cleanup) => { analysisChartCrosshairCleanup = cleanup; },
        getCleanup: () => analysisChartCrosshairCleanup,
        setLabel: (label) => { analysisChartLabelApi = label; },
        pointMap: buildPointMap(data)
      });
      analysisChartApi.timeScale().fitContent();
    }
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
          rightOffset: 4,
          barSpacing: 7,
          minBarSpacing: 5,
          fixLeftEdge: true,
          fixRightEdge: true
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
      applySeriesAutoscale(analysisSeriesApi);
    }
    analysisChartApi.applyOptions({
      ...baseChartOptions(size.width, size.height),
      localization: { priceFormatter: (price) => moneySigned(price) }
    });
    setTimeScaleFormatters(analysisChartApi, {
      timeVisible: false,
      tick: (time) => formatChartLabelTime(time, { short: true })
    });
  }

  function renderAnalysisCalendar(points) {
    const windowed = sliceAnalysisCalendarPoints(points);
    if (!windowed.length) {
      els.analysisCalendar.innerHTML = `<div class="record-empty"><strong>暂无日历</strong><span>导入交易流水后生成盈亏热力。</span></div>`;
      return;
    }
    const weekdayHeads = ["一", "二", "三", "四", "五", "六", "日"]
      .map((day) => `<div class="calendar-head">${day}</div>`);
    const startDate = new Date(`${windowed[0].time}T00:00:00`);
    const offset = Number.isNaN(startDate.getTime()) ? 0 : (startDate.getDay() + 6) % 7;
    const blanks = Array.from({ length: offset }, () => `<div class="calendar-day blank" aria-hidden="true"></div>`);
    const days = [];
    let lastMonth = "";
    windowed.forEach((point) => {
      const month = point.time.slice(0, 7);
      if (month !== lastMonth) {
        days.push(`<div class="calendar-month">${escapeHtml(month)}</div>`);
        lastMonth = month;
      }
      const level = Math.min(4, Math.floor(Math.abs(point.dailyPnl) / 100) + (point.dailyPnl ? 1 : 0));
      const cls = point.dailyPnl > 0 ? "gain" : point.dailyPnl < 0 ? "loss" : "flat";
      days.push(`
        <div class="calendar-day ${cls} level-${level}" title="${escapeHtml(point.time)} ${escapeHtml(moneySigned(point.dailyPnl))}">
          <span>${escapeHtml(point.time.slice(5))}</span>
          <strong>${escapeHtml(shortSigned(point.dailyPnl))}</strong>
        </div>
      `);
    });
    els.analysisCalendar.innerHTML = [...weekdayHeads, ...blanks, ...days].join("");
  }

  function sliceAnalysisCalendarPoints(points) {
    const list = Array.isArray(points) ? points : [];
    if (activeAnalysisRange === "1m") return list.slice(-31);
    if (activeAnalysisRange === "1y") return list.slice(-186);
    if (activeAnalysisRange === "all") return list.slice(-365);
    return list.slice(-92);
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
        const key = historyCacheKey(symbol, type, dateKey);
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

  function historyCacheKey(symbol, type, dateKey) {
    return `${instrumentKey(symbol, type)}:${dateKey}`;
  }

  function getPortfolioTimeline(typeFilter = "all") {
    const now = new Date();
    const endKey = now.toISOString().slice(0, 10);
    const txRows = getSortedTransactions()
      .filter((tx) => (tx.status || "confirmed") === "confirmed")
      .filter((tx) => transactionMatchesAnalysisType(tx, typeFilter));
    const firstTxDate = txRows.find((tx) => tx.date)?.date || endKey;
    const simulationStart = new Date(`${firstTxDate}T00:00:00`);
    const txByDate = new Map();
    txRows.forEach((tx) => {
      if (!tx.date) return;
      if (!txByDate.has(tx.date)) txByDate.set(tx.date, []);
      txByDate.get(tx.date).push(tx);
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
        const fee = number(tx.fee) * rate;
        const shares = getTransactionShares(tx);
        const gross = getTransactionGross(tx) * rate;
        if (isCashInAction(tx.action)) {
          if (typeFilter !== "all") return;
          cash += gross;
          invested += gross;
          return;
        }
        if (isCashOutAction(tx.action)) {
          if (typeFilter !== "all") return;
          cash -= gross;
          invested -= gross;
          return;
        }
        if (isDividendAction(tx.action)) {
          cash += gross;
          dividends += gross;
          return;
        }
        normalizeTransactionInstrument(tx);
        const symbol = normalizeSymbol(tx.symbol);
        const key = instrumentKey(symbol, tx.type);
        if (!running.has(key)) {
          running.set(key, { symbol, name: tx.name || symbol, type: tx.type || "fund", quantity: 0, cost: 0, realized: 0 });
        }
        const item = running.get(key);
        item.name = tx.name || item.name;
        item.type = tx.type || item.type;
        if (isBuyAction(tx.action)) {
          item.quantity += shares;
          item.cost += gross + fee;
          if (typeFilter === "all") cash -= gross + fee;
        }
        if (isSellAction(tx.action)) {
          const avgCost = item.quantity > 0 ? item.cost / item.quantity : 0;
          const removedCost = Math.min(shares, item.quantity) * avgCost;
          const proceeds = gross - fee;
          item.quantity -= shares;
          item.cost -= removedCost;
          item.realized += proceeds - removedCost;
          realized += proceeds - removedCost;
          if (typeFilter === "all") cash += proceeds;
        }
      });

      const holdings = Array.from(running.values()).filter((item) => Math.abs(item.quantity) > 0.000001);
      const marketValue = holdings.reduce((sum, item) => sum + item.quantity * estimateAnalysisPrice(item, dateKey), 0);
      const cost = holdings.reduce((sum, item) => sum + item.cost, 0);
      const pnl = marketValue - cost + realized + dividends;
      const totalValue = marketValue + (typeFilter === "all" ? cash : 0);
      points.push({
        time: dateKey,
        value: roundMoney(totalValue),
        pnl: roundMoney(pnl),
        unrealizedPnl: roundMoney(marketValue - cost),
        realizedPnl: roundMoney(realized),
        dividends: roundMoney(dividends),
        marketValue: roundMoney(marketValue),
        cost: roundMoney(cost),
        invested: roundMoney(invested),
        cash: roundMoney(cash),
        dailyPnl: roundMoney(pnl - previousPnl),
        transactions: (txByDate.get(dateKey) || []).length,
        missingHistory: holdings.some((item) => !analysisHistoryCache.has(historyCacheKey(item.symbol, item.type, dateKey)))
      });
      previousPnl = pnl;
    }

    return points;
  }

  function drawWealthChart(portfolio) {
    ensureWealthChart();
    const points = buildWealthSeries(portfolio, activeRange);
    if (!points.length || (points.length === 1 && !points[0].value)) {
      renderWealthChartSummary([]);
      showInlineChartEmpty(els.wealthChart, "导入交易流水后生成资产曲线");
      return;
    }
    clearInlineChartEmpty(els.wealthChart);
    renderWealthChartSummary(points);
    const data = points.map((point) => ({
      time: point.time,
      value: point.value
    }));
    wealthSeriesApi.setData(data);
    applySeriesAutoscale(wealthSeriesApi);
    bindChartCrosshair(wealthChartApi, {
      container: els.wealthChart,
      formatPrice: (value) => shortMoney(value),
      formatTime: (time) => formatChartLabelTime(time),
      formatExtra: (point) => point ? `资产 ${shortMoney(point.value)}` : "",
      series: wealthSeriesApi,
      setCleanup: (cleanup) => { wealthChartCrosshairCleanup = cleanup; },
      getCleanup: () => wealthChartCrosshairCleanup,
      setLabel: (label) => { wealthChartLabelApi = label; },
      pointMap: buildPointMap(data)
    });
    if (wealthChartApi) wealthChartApi.timeScale().fitContent();
    const last = points[points.length - 1];
    els.totalValue.dataset.current = String(last?.value || portfolio.totalValue || 0);
  }

  function renderWealthChartSummary(points) {
    if (!els.wealthChartSummary) return;
    if (!Array.isArray(points) || !points.length) {
      els.wealthChartSummary.innerHTML = [
        { label: "区间变化", value: "--" },
        { label: "区间高点", value: "--" },
        { label: "区间低点", value: "--" },
        { label: "时间范围", value: "--" }
      ].map(summaryChip).join("");
      return;
    }
    if (points.length === 1) {
      const only = points[0];
      els.wealthChartSummary.innerHTML = [
        { label: "当前资产", value: shortMoney(only.value) },
        { label: "区间高点", value: shortMoney(only.value) },
        { label: "区间低点", value: shortMoney(only.value) },
        { label: "时间范围", value: `${formatChartLabelTime(only.time, { short: true })} · 1 天` }
      ].map(summaryChip).join("");
      return;
    }
    const first = points[0];
    const last = points[points.length - 1];
    const values = points.map((point) => number(point.value)).filter(Number.isFinite);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const change = number(last.value) - number(first.value);
    const changeRate = first.value ? change / number(first.value) : 0;
    els.wealthChartSummary.innerHTML = [
      { label: "区间变化", value: `${moneySigned(change)} · ${percentSigned(changeRate)}`, signed: change },
      { label: "区间高点", value: shortMoney(high) },
      { label: "区间低点", value: shortMoney(low) },
      { label: "时间范围", value: `${formatChartLabelTime(first.time, { short: true })} - ${formatChartLabelTime(last.time, { short: true })} · ${points.length} 天` }
    ].map(summaryChip).join("");
  }

  function summaryChip(item) {
    return `
      <article class="chart-summary-chip">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.signed === undefined ? escapeHtml(item.value) : colorText(item.signed, escapeHtml(item.value))}</strong>
      </article>
    `;
  }

  function buildWealthSeries(portfolio, range) {
    const days = range === "1m" ? 30 : range === "1y" ? 365 : 90;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - days + 1);
    const startKey = start.toISOString().slice(0, 10);
    const timeline = getPortfolioTimeline("all").filter((point) => range === "all" ? true : point.time >= startKey);
    if (timeline.length) return timeline.map((point) => ({ time: point.time, date: point.time.slice(5), value: point.value }));
    const today = now.toISOString().slice(0, 10);
    const brokerageDate = getBrokerageSnapshotDate() || today;
    const previous = new Date(`${brokerageDate}T00:00:00`);
    previous.setDate(previous.getDate() - 1);
    const previousKey = previous.toISOString().slice(0, 10);
    const currentValue = portfolio.totalValue || 0;
    if (!currentValue) return [{ time: today, date: today.slice(5), value: 0 }];
    return [
      { time: previousKey, date: previousKey.slice(5), value: currentValue, snapshotOnly: true },
      { time: brokerageDate, date: brokerageDate.slice(5), value: currentValue, snapshotOnly: true }
    ];
  }

  function getBrokerageSnapshotDate() {
    const value = state.brokerage?.updatedAt || state.brokerage?.fetchedAt;
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
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
          rightOffset: 4,
          barSpacing: 7,
          minBarSpacing: 5,
          fixLeftEdge: true,
          fixRightEdge: true
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
      applySeriesAutoscale(wealthSeriesApi);
    }
    wealthChartApi.applyOptions({
      ...baseChartOptions(size.width, size.height),
      localization: {
        priceFormatter: (price) => shortMoney(price)
      }
    });
    setTimeScaleFormatters(wealthChartApi, {
      timeVisible: false,
      tick: (time) => formatChartLabelTime(time, { short: true })
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
        entireTextOnly: true,
        alignLabels: true,
        ticksVisible: true,
        minimumWidth: 72,
        scaleMargins: { top: 0.2, bottom: 0.2 }
      },
      leftPriceScale: {
        visible: false,
        borderVisible: false
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

  function applySeriesAutoscale(series) {
    if (!series?.applyOptions) return;
    series.applyOptions({
      autoscaleInfoProvider: (original) => {
        const info = original();
        if (!info?.priceRange) return info;
        const min = Number(info.priceRange.minValue);
        const max = Number(info.priceRange.maxValue);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return info;
        const rawSpan = Math.abs(max - min);
        const padding = rawSpan > 0
          ? Math.max(rawSpan * 0.18, Math.abs(max) * 0.005, Math.abs(min) * 0.005, 1)
          : Math.max(Math.abs(max) * 0.05, 1);
        return {
          ...info,
          priceRange: {
            minValue: min - padding,
            maxValue: max + padding
          }
        };
      }
    });
  }

  function resetChartView(chart) {
    if (!chart?.timeScale) return;
    try {
      chart.timeScale().fitContent();
    } catch {
      // Chart runtime may be missing when a panel has not been rendered yet.
    }
  }

  function setTimeScaleFormatters(chart, options = {}) {
    if (!chart?.applyOptions) return;
    chart.applyOptions({
      timeScale: {
        timeVisible: Boolean(options.timeVisible),
        secondsVisible: false,
        tickMarkFormatter: options.tick || undefined
      }
    });
  }

  function bindChartCrosshair(chart, options = {}) {
    if (!chart || !options.container) return;
    const cleanupRef = options.getCleanup ? options.getCleanup() : null;
    if (cleanupRef) cleanupRef();
    const label = ensureChartLabel(options.container);
    const handleMove = (param) => {
      if (!param || !param.point) {
        label.hidden = true;
        return;
      }
      const hovered = mergeHoveredPoint(
        getPointFromMap(options.pointMap, param.time),
        getHoveredSeriesPoint(options.series, param.seriesData)
      );
      if (!hovered) {
        label.hidden = true;
        return;
      }
      const parts = [
        options.formatTime ? options.formatTime(hovered.time || hovered.date || "") : formatChartLabelTime(hovered.time || hovered.date || ""),
        options.formatPrice ? options.formatPrice(number(hovered.value ?? hovered.close ?? hovered.open)) : formatChartPrice(hovered.value ?? hovered.close ?? hovered.open)
      ];
      const extra = options.formatExtra ? options.formatExtra(hovered) : "";
      label.innerHTML = `
        <span>${escapeHtml(parts[0])}</span>
        <strong>${escapeHtml(parts[1])}</strong>
        ${extra ? `<small>${escapeHtml(extra)}</small>` : ""}
      `;
      label.hidden = false;
      positionChartLabel(label, options.container, param.point);
    };
    chart.subscribeCrosshairMove(handleMove);
    if (options.setCleanup) {
      options.setCleanup(() => {
        chart.unsubscribeCrosshairMove(handleMove);
        label.hidden = true;
      });
    }
    if (options.setLabel) options.setLabel(label);
  }

  function buildPointMap(points) {
    const map = new Map();
    (points || []).forEach((point) => {
      const key = chartTimeKey(point.time || point.date);
      if (key) map.set(key, point);
    });
    return map;
  }

  function getPointFromMap(map, time) {
    if (!map) return null;
    return map.get(chartTimeKey(time)) || null;
  }

  function ensureChartLabel(container) {
    let label = container.querySelector(".chart-tooltip");
    if (!label) {
      label = document.createElement("div");
      label.className = "chart-tooltip";
      container.appendChild(label);
    }
    return label;
  }

  function positionChartLabel(label, container, point) {
    const rect = container.getBoundingClientRect();
    const box = label.getBoundingClientRect();
    const width = box.width || 190;
    const height = box.height || 92;
    const x = Math.min(Math.max(point.x + 14, 12), Math.max(12, rect.width - width - 12));
    const y = Math.min(Math.max(point.y + 14, 12), Math.max(12, rect.height - height - 12));
    label.style.transform = `translate(${x}px, ${y}px)`;
  }

  function getHoveredSeriesPoint(series, seriesData) {
    if (!series || !seriesData) return null;
    if (typeof seriesData.get === "function") {
      const point = seriesData.get(series);
      if (point) return point;
    }
    return null;
  }

  function mergeHoveredPoint(mapped, seriesPoint) {
    if (!mapped) return seriesPoint || null;
    if (!seriesPoint) return mapped;
    return { ...mapped, ...seriesPoint };
  }

  function formatSignedPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
  }

  function buildInstrumentHoverSummary(point, options = {}) {
    if (!point) return "";
    const chartType = options.chartType || "line";
    const range = options.range || "daily";
    const stats = options.stats || {};
    const rows = [];
    const amount = number(point.amount);
    const volume = number(point.volume);

    if (chartType === "candlestick") {
      const change = Number.isFinite(point.change)
        ? point.change
        : (Number.isFinite(point.close) && Number.isFinite(point.open) ? point.close - point.open : null);
      const changePct = Number.isFinite(point.changePct)
        ? point.changePct
        : (Number.isFinite(change) && Number.isFinite(point.open) && point.open ? (change / point.open) * 100 : null);
      if (Number.isFinite(point.open)) rows.push(`开 ${formatChartPrice(point.open)}`);
      if (Number.isFinite(point.high)) rows.push(`高 ${formatChartPrice(point.high)}`);
      if (Number.isFinite(point.low)) rows.push(`低 ${formatChartPrice(point.low)}`);
      if (Number.isFinite(point.close)) rows.push(`收 ${formatChartPrice(point.close)}`);
      if (Number.isFinite(change)) rows.push(`涨跌 ${signedChartPrice(change)}`);
      if (Number.isFinite(changePct)) rows.push(`涨跌幅 ${formatSignedPercent(changePct)}`);
      if (Number.isFinite(volume)) rows.push(`量 ${formatCompactNumber(volume)}`);
      if (Number.isFinite(amount)) rows.push(`额 ${formatCompactNumber(amount)}`);
      return rows.join(" · ");
    }

    const value = number(point.value ?? point.close ?? point.open);
    const baseline = Number.isFinite(point.previousClose)
      ? point.previousClose
      : (range === "intraday"
        ? (Number.isFinite(stats.previousClose) ? stats.previousClose : stats.open)
        : stats.open);
    const change = Number.isFinite(point.change)
      ? point.change
      : (Number.isFinite(value) && Number.isFinite(baseline) ? value - baseline : null);
    const changePct = Number.isFinite(point.changePct)
      ? point.changePct
      : (Number.isFinite(change) && Number.isFinite(baseline) && baseline ? (change / baseline) * 100 : null);

    if (Number.isFinite(change)) rows.push(`涨跌 ${signedChartPrice(change)}`);
    if (Number.isFinite(changePct)) rows.push(`涨跌幅 ${formatSignedPercent(changePct)}`);
    if (Number.isFinite(baseline)) rows.push(range === "intraday" ? `昨收 ${formatChartPrice(baseline)}` : `开盘 ${formatChartPrice(baseline)}`);
    if (Number.isFinite(point.average)) rows.push(`均价 ${formatChartPrice(point.average)}`);
    if (Number.isFinite(point.high)) rows.push(`高 ${formatChartPrice(point.high)}`);
    if (Number.isFinite(point.low)) rows.push(`低 ${formatChartPrice(point.low)}`);
    if (Number.isFinite(volume)) rows.push(`量 ${formatCompactNumber(volume)}`);
    if (Number.isFinite(amount)) rows.push(`额 ${formatCompactNumber(amount)}`);
    return rows.join(" · ");
  }

  function chartTimeKey(value) {
    if (!value) return "";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;
    if (typeof value === "object" && value.year && value.month && value.day) {
      return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
    }
    return String(value);
  }

  function formatChartLabelTime(value, options = {}) {
    if (value && typeof value === "object" && value.year && value.month && value.day) {
      const text = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
      return options.short ? text.slice(5) : text;
    }
    const text = String(value || "").trim();
    if (!text) return "--";
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)) return options.short ? text.slice(11, 16) : text.slice(0, 16);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return options.short ? text.slice(5) : text;
    if (/^\d{10}$/.test(text)) {
      const date = new Date(Number(text) * 1000);
      if (!Number.isNaN(date.getTime())) {
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const mi = String(date.getMinutes()).padStart(2, "0");
        return options.short ? `${hh}:${mi}` : `${date.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
      }
    }
    return text;
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
    try {
      const buffer = await file.arrayBuffer();
      const candidates = [];
      let parseError = "";
      if (window.XLSX) {
        try {
          const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
          candidates.push({ rows, label: `文件：${file.name}` });
        } catch (error) {
          parseError = error.message || "Excel 解析失败";
        }
      }
      const textRows = extractImportRowsFromText(decodeImportBuffer(buffer));
      if (textRows.length) {
        candidates.push({ rows: textRows, label: `文件：${file.name}（文本/GBK 表格）` });
      }
      const best = selectBestImportCandidate(candidates);
      if (!best) {
        showImportPreview([], parseError || "文件解析失败，请确认是同花顺导出的 .xls/.xlsx/.csv。");
        return;
      }
      setImportPreview(best.rows, best.label);
    } catch (error) {
      showImportPreview([], error.message || "文件解析失败");
    } finally {
      input.value = "";
    }
  }

  function parseImportText() {
    const text = document.getElementById("importTextInput").value.trim();
    if (!text) {
      showToast("先粘贴交易流水文本");
      return;
    }
    setImportPreview(extractImportRowsFromText(text), "文本粘贴");
  }

  async function pasteImportText() {
    try {
      const text = await navigator.clipboard.readText();
      const normalized = String(text || "").trim();
      if (!normalized) {
        showToast("剪贴板里没有可识别的文本");
        return;
      }
      document.getElementById("importTextInput").value = normalized;
      setImportPreview(extractImportRowsFromText(normalized), "剪贴板");
    } catch (error) {
      showToast(error.message || "读取剪贴板失败");
    }
  }

  async function handleOcrImportPlaceholder() {
    try {
      await fetch("/api/ocr", { method: "POST", cache: "no-store" });
    } catch {
      // Local static-only previews may not have the placeholder endpoint.
    }
    showToast("截图 OCR 接口已预留，暂未启用；先用 Excel / CSV 或文本粘贴导入");
  }

  function setImportPreview(rows, sourceLabel) {
    const normalizedRows = normalizeImportRows(rows);
    const parsed = buildImportPreview(normalizedRows, sourceLabel);
    importPreviewData = parsed;
    importPreviewRows = parsed.rows;
    showImportPreview(parsed.rows, parsed.message);
  }

  function selectBestImportCandidate(candidates) {
    return (candidates || [])
      .map((candidate) => {
        const rows = normalizeImportRows(candidate.rows);
        if (!rows.length) return null;
        const parsed = buildImportPreview(rows, candidate.label);
        return {
          ...candidate,
          rows,
          parsed,
          score: scoreImportCandidate(rows, parsed)
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)[0] || null;
  }

  function scoreImportCandidate(rows, parsed) {
    const validCount = parsed?.meta?.validCount || 0;
    const rowCount = parsed?.rows?.length || 0;
    const mappedFields = parsed?.meta?.mappedFields || 0;
    const headerScore = parsed?.meta?.headerScore || 0;
    const mojibakePenalty = countMojibakeText(rows.flat().join(" ")) * 60;
    return validCount * 120 + mappedFields * 35 + headerScore * 20 - (rowCount - validCount) * 8 - mojibakePenalty;
  }

  function countMojibakeText(text) {
    return (String(text || "").match(/[\u00c0-\u00ff]{2,}|�/g) || []).length;
  }

  function parseDelimitedText(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.includes("\t")) return line.split("\t");
        if (line.includes(",")) return splitCsvLine(line);
        if (line.includes("|")) return line.split("|");
        return line.split(/\s+/).filter(Boolean);
      })
      .map((row) => row.map(cleanImportCell));
  }

  function extractImportRowsFromText(text) {
    const normalized = String(text || "").replace(/\u00a0/g, " ");
    if (/<table|<tr|<td|<th/i.test(normalized)) {
      const htmlRows = parseHtmlTableRows(normalized);
      if (htmlRows.length) return htmlRows;
    }
    return parseDelimitedText(normalized);
  }

  function parseHtmlTableRows(text) {
    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      return Array.from(doc.querySelectorAll("tr"))
        .map((row) => Array.from(row.querySelectorAll("th,td")).map((cell) => cleanImportCell(cell.textContent || "")))
        .filter((row) => row.some(Boolean));
    } catch {
      return [];
    }
  }

  function decodeImportBuffer(buffer) {
    const encodings = ["utf-8", "gb18030", "gbk", "gb2312"];
    let best = "";
    let bestScore = -Infinity;
    encodings.forEach((encoding) => {
      try {
        const text = new TextDecoder(encoding).decode(buffer);
        const score = scoreImportText(text);
        if (score > bestScore) {
          best = text;
          bestScore = score;
        }
      } catch {
        // Some browsers do not expose every legacy decoder.
      }
    });
    return best;
  }

  function scoreImportText(text) {
    const source = String(text || "");
    const headerHits = (source.match(/日期|时间|证券|基金|代码|名称|成交|买入|卖出|金额|份额|数量/g) || []).length;
    const replacementPenalty = (source.match(/\uFFFD/g) || []).length;
    return headerHits * 10 - replacementPenalty;
  }

  function cleanImportCell(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
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
    const headerScore = scoreImportHeaderRow(rows[headerIndex] || []);
    const hasHeader = headerScore >= 2;
    const headers = hasHeader ? (rows[headerIndex] || []) : [];
    const fieldMap = hasHeader ? mapImportHeaders(headers) : emptyImportFieldMap();
    const mappedFields = Object.values(fieldMap).filter((index) => Number.isInteger(index) && index >= 0).length;
    const dataRows = hasHeader ? rows.slice(headerIndex + 1) : rows;
    const previewRows = dataRows
      .map((row, index) => parseImportRow(row, headers, fieldMap, index))
      .filter(Boolean);
    const validCount = previewRows.filter((row) => row.valid && !row.ignored).length;
    const confidence = mappedFields >= 4 ? "强识别" : mappedFields >= 2 ? "中等识别" : "弱识别，请人工核对";
    return {
      rows: previewRows,
      message: `${sourceLabel} · ${confidence} · 识别 ${previewRows.length} 行，可导入 ${validCount} 行 · ${describeImportMapping(fieldMap, headers)}`,
      meta: {
        validCount,
        rowCount: previewRows.length,
        mappedFields,
        headerScore,
        hasHeader
      }
    };
  }

  function describeImportMapping(fieldMap, headers) {
    const labels = {
      date: "日期",
      time: "时间",
      symbol: "代码",
      name: "名称",
      action: "动作",
      price: "价格",
      quantity: "数量",
      amount: "金额",
      fee: "手续费",
      account: "账户"
    };
    const items = Object.entries(fieldMap)
      .filter(([, index]) => Number.isInteger(index) && index >= 0)
      .slice(0, 5)
      .map(([field, index]) => `${labels[field] || field}:${headers[index] || "-"}`);
    return items.length ? `字段映射 ${items.join(" / ")}` : "字段映射未识别";
  }

  function findImportHeaderIndex(rows) {
    let bestIndex = 0;
    let bestScore = -1;
    rows.slice(0, 12).forEach((row, index) => {
      const score = scoreImportHeaderRow(row);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function scoreImportHeaderRow(row) {
    const text = (row || []).join("|");
    return [
      /日期|时间/.test(text),
      /代码|证券|基金|产品/.test(text),
      /名称/.test(text),
      /买卖|业务|操作|方向|摘要/.test(text),
      /成交|发生|确认|申请|委托/.test(text),
      /金额|价格|均价|净值|数量|份额/.test(text)
    ].filter(Boolean).length;
  }

  function emptyImportFieldMap() {
    return {
      date: -1,
      time: -1,
      symbol: -1,
      name: -1,
      action: -1,
      status: -1,
      price: -1,
      quantity: -1,
      amount: -1,
      cashAmount: -1,
      fee: -1,
      fees: [],
      account: -1
    };
  }

  function mapImportHeaders(headers) {
    const normalized = headers.map(normalizeHeader);
    const pick = (...patterns) => normalized.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
    const feeIndexes = normalized
      .map((header, index) => (/手续费|佣金|印花税|经手费|过户费|费用|规费|其他费/.test(header) ? index : -1))
      .filter((index) => index >= 0);
    const fieldMap = {
      date: pick(/成交日期|交易日期|发生日期|业务日期|委托日期|申请日期|确认日期|日期/),
      time: pick(/成交时间|委托时间|时间/),
      symbol: pick(/证券代码|基金代码|股票代码|产品代码|代码/),
      name: pick(/证券名称|基金名称|股票名称|产品名称|名称/),
      action: pick(/买卖标志|买卖方向|买卖类别|委托类别|操作|方向|业务名称|业务类型|摘要/),
      status: pick(/成交状态|委托状态|交易状态|状态|结果/),
      price: pick(/成交均价|成交价格|成交价|确认净值|申请价格|委托价格|价格|净值/),
      quantity: pick(/成交数量|成交份额|确认份额|申请份额|发生数量|数量|份额/),
      amount: pick(/成交金额|确认金额|申请金额|清算金额|委托金额|成交额|本金/),
      cashAmount: pick(/发生金额|流水金额|资金发生额|资金变动|变动金额/),
      fee: pick(/手续费|佣金|印花税|经手费|过户费|费用|规费|其他费/),
      account: pick(/账户|股东账户|资金账号|资金账户|客户号/)
    };
    fieldMap.fees = feeIndexes;
    return fieldMap;
  }

  function parseImportRow(row, headers, fieldMap, index) {
    const cell = (field) => {
      const headerIndex = fieldMap[field];
      return headerIndex >= 0 ? String(row[headerIndex] ?? "").trim() : "";
    };
    const fallback = buildImportFallback(row);
    const symbol = normalizeImportSymbol(cell("symbol") || fallback.symbol);
    const name = cell("name") || fallback.name || symbol;
    const date = normalizeImportDate(cell("date") || fallback.date);
    const time = normalizeImportTime(cell("time") || fallback.time);
    const action = normalizeImportAction(cell("action") || fallback.action);
    const status = normalizeImportStatus(cell("status"));
    const price = parseImportNumber(cell("price") || fallback.price);
    const tradeAmount = parseImportNumber(cell("amount") || fallback.amount);
    const cashAmount = parseImportNumber(cell("cashAmount") || fallback.cashAmount);
    const quantity = parseImportNumber(cell("quantity") || fallback.quantity);
    const fee = parseImportFee(row, fieldMap, cell("fee") || fallback.fee);
    const type = inferInstrumentType(symbol, name);
    const cashFlowAction = isImportCashFlowAction(action);
    const dividendAction = action === "dividend" || action === "bonus";
    const amount = cashFlowAction || dividendAction ? (cashAmount || tradeAmount) : tradeAmount;
    const derivedPrice = price > 0 ? price : (amount > 0 && quantity > 0 && !cashFlowAction ? amount / quantity : 0);
    const inputMode = amount > 0 ? "amount" : "shares";
    const txQuantity = amount > 0 ? amount : quantity;
    const txPrice = derivedPrice > 0 ? derivedPrice : 1;
    const reasons = [];
    if (!date) reasons.push("缺少日期");
    if (!symbol && !cashFlowAction && !dividendAction) reasons.push("缺少代码");
    if (!action) reasons.push("缺少买卖方向");
    if (action === "ignore") reasons.push("非资金交易");
    if (!txQuantity) reasons.push("缺少金额或数量");
    if (inputMode === "shares" && !derivedPrice && !cashFlowAction && !dividendAction) reasons.push("缺少价格");
    if ((action === "buy" || action === "sell") && type === "stock" && !derivedPrice) reasons.push("股票交易缺少成交价");
    const finalSymbol = symbol || (cashFlowAction || dividendAction ? "CASH" : "");
    const finalName = name || (cashFlowAction || dividendAction ? actionNames[action] || "现金流水" : symbol);
    const tx = {
      id: "",
      date,
      time,
      action: action || "buy",
      status,
      symbol: finalSymbol,
      name: finalName,
      type: cashFlowAction || (dividendAction && !symbol) ? "cash" : type,
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
      ignored: action === "ignore",
      reason: reasons.join("；")
    };
  }

  function parseImportFee(row, fieldMap, fallbackValue = "") {
    const feeIndexes = Array.isArray(fieldMap.fees) ? fieldMap.fees : [];
    const sum = feeIndexes.reduce((total, index) => total + parseImportNumber(row[index]), 0);
    return sum || parseImportNumber(fallbackValue || "0");
  }

  function isImportCashFlowAction(action) {
    return action === "deposit" || action === "withdraw";
  }

  function buildImportFallback(row) {
    const joined = row.join(" ");
    const date = row.find((cell) => normalizeImportDate(cell)) || "";
    const time = row.find((cell) => normalizeImportTime(cell)) || "";
    const symbol = normalizeImportSymbol((joined.match(/(?:\b\d{6}\b|\b\d{6}\.[A-Z]{2,4}\b|\b(?:SH|SZ|OF|XSHG|XSHE)\d{6}\b)/i) || [])[0] || "");
    const action = row.find((cell) => normalizeImportAction(cell)) || "";
    const numberItems = extractImportNumberItems(row, { symbol });
    const price = pickFallbackPrice(numberItems);
    const quantity = pickFallbackQuantity(numberItems, price);
    const amount = pickFallbackAmount(numberItems, price, quantity);
    const cashAmount = pickFallbackCashAmount(numberItems, amount);
    const fee = pickFallbackFee(numberItems, price, quantity, amount);
    return {
      date,
      time,
      symbol,
      name: pickFallbackName(row, symbol),
      action,
      price,
      quantity,
      amount,
      cashAmount,
      fee
    };
  }

  function pickFallbackName(row, symbol) {
    const normalizedSymbol = normalizeImportSymbol(symbol);
    if (!normalizedSymbol) return "";
    const symbolIndex = row.findIndex((cell) => normalizeImportSymbol(cell) === normalizedSymbol);
    const candidates = row
      .map((cell, index) => ({ text: String(cell || "").trim(), index }))
      .filter((item) => item.text)
      .filter((item) => item.index !== symbolIndex)
      .filter((item) => !normalizeImportDate(item.text))
      .filter((item) => !normalizeImportTime(item.text))
      .filter((item) => !normalizeImportAction(item.text))
      .filter((item) => !isImportStatusText(item.text))
      .filter((item) => !isImportNumericOnly(item.text))
      .filter((item) => /[\u4e00-\u9fa5A-Za-z]/.test(item.text))
      .map((item) => item.text);
    return candidates[0] || "";
  }

  function isImportNumericOnly(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    const stripped = text.replace(/[,\s￥¥元份股.%+-]/g, "");
    return /^\d+(?:\.\d+)?$/.test(stripped);
  }

  function isImportStatusText(value) {
    return /已成交|成交|确认成功|撤单|废单|取消|已撤销|失败|未成交|作废|待确认|待成交|处理中|挂起|部分成交/.test(String(value || ""));
  }

  function extractImportNumberItems(row, options = {}) {
    const symbol = String(options.symbol || "");
    return row
      .map((cell, index) => {
        const text = String(cell || "").trim();
        const value = parseImportNumber(text);
        return { text, index, value };
      })
      .filter((item) => item.value > 0)
      .filter((item) => !normalizeImportDate(item.text))
      .filter((item) => !normalizeImportTime(item.text))
      .filter((item) => !(symbol && item.text.includes(symbol)))
      .filter((item) => isImportNumericOnly(item.text))
      .filter((item) => !/^\d{6}$/.test(item.text.replace(/\D/g, "")))
      .filter((item) => !/^\d{8}$/.test(item.text.replace(/\D/g, "")));
  }

  function pickFallbackPrice(items) {
    const explicit = items.find((item) => /价|净值|均价/.test(item.text) && item.value > 0 && item.value < 10000);
    if (explicit) return explicit.value;
    return items.find((item) => item.value > 0 && item.value < 1000 && !Number.isInteger(item.value))?.value
      || items.find((item) => item.value > 0 && item.value < 20)?.value
      || 0;
  }

  function pickFallbackQuantity(items, price) {
    const explicit = items.find((item) => /份|股|数量/.test(item.text) && item.value > 0);
    if (explicit) return explicit.value;
    return items
      .filter((item) => item.value >= 1)
      .filter((item) => !price || Math.abs(item.value - price) > 0.000001)
      .sort((a, b) => a.value - b.value)
      .find((item) => item.value >= 10 && item.value < 10000000)?.value || 0;
  }

  function pickFallbackAmount(items, price, quantity) {
    const explicit = items.find((item) => /金额|发生|成交|本金|清算/.test(item.text) && item.value > 0);
    if (explicit) return explicit.value;
    const derived = price > 0 && quantity > 0 ? price * quantity : 0;
    const candidates = items
      .filter((item) => item.value >= 100)
      .filter((item) => Math.abs(item.value - price) > 0.000001)
      .filter((item) => Math.abs(item.value - quantity) > 0.000001)
      .sort((a, b) => b.value - a.value);
    if (derived > 0) {
      const nearDerived = candidates.find((item) => Math.abs(item.value - derived) / derived < 0.08);
      if (nearDerived) return nearDerived.value;
    }
    return candidates[0]?.value || 0;
  }

  function pickFallbackCashAmount(items, amount) {
    const explicit = items.find((item) => /发生金额|流水金额|资金发生额|资金变动|变动金额/.test(item.text) && item.value > 0);
    if (explicit) return explicit.value;
    return amount || 0;
  }

  function pickFallbackFee(items, price, quantity, amount) {
    const explicit = items.find((item) => /佣金|印花税|过户费|手续费|费用|规费/.test(item.text) && item.value >= 0);
    if (explicit) return explicit.value;
    return items
      .filter((item) => item.value > 0 && item.value <= 100)
      .filter((item) => Math.abs(item.value - price) > 0.000001)
      .filter((item) => Math.abs(item.value - quantity) > 0.000001)
      .filter((item) => Math.abs(item.value - amount) > 0.000001)
      .sort((a, b) => a.index - b.index)
      .at(-1)?.value || 0;
  }

  function normalizeHeader(value) {
    return String(value || "").replace(/\s+/g, "").replace(/[()（）:：]/g, "");
  }

  function normalizeImportSymbol(value) {
    const text = String(value || "").trim().toUpperCase();
    if (!text) return "";
    const compact = text.replace(/\s+/g, "");
    const dotMatched = compact.match(/^(\d{6})\.(SH|SZ|OF|XSHE|XSHG)$/);
    if (dotMatched) return dotMatched[1];
    const prefixed = compact.match(/^(SH|SZ|OF|XSHG|XSHE)(\d{6})$/);
    if (prefixed) return prefixed[2];
    return compact.replace(/[^A-Z0-9.]/g, "");
  }

  function normalizeImportStatus(value) {
    const text = String(value || "").trim();
    if (!text) return "confirmed";
    if (/撤单|废单|取消|已撤销|失败|未成交|作废/.test(text)) return "failed";
    if (/待确认|待成交|处理中|挂起|部分成交|部分/.test(text)) return "pending";
    return "confirmed";
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
    if (/指定交易|签约/.test(text)) return "ignore";
    if (/申购|认购|买入|买进|买|定投|证券买入|基金申购/.test(text)) return "buy";
    if (/赎回|卖出|卖|证券卖出|基金赎回/.test(text)) return "sell";
    if (/红利税补扣|扣税|补扣/.test(text)) return "withdraw";
    if (/分红|红利入账|利息归本|结息/.test(text)) return "dividend";
    if (/银行转证券|划入|转入|入金|存入/.test(text)) return "deposit";
    if (/证券转银行|划出|转出|出金|取出/.test(text)) return "withdraw";
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
    if (/ETF/i.test(text) && /联接|连接/i.test(text)) return "fund";
    if (/ETF|LOF/i.test(text)) return "etf";
    if (/^\d{6}$/.test(symbol) && /^(510|511|512|513|515|516|517|518|588|159|162|163|164|165|166|168|169)/.test(symbol)) return "etf";
    if (/基金|混合|债券|货币|指数|QDII|FOF/.test(text)) return "fund";
    return /^\d{6}$/.test(symbol) ? "stock" : "fund";
  }

  function showImportPreview(rows, message = "") {
    const preview = document.getElementById("importPreview");
    const existing = new Set(state.transactions.map(transactionSignature));
    const seen = new Set();
    rows.forEach((row) => {
      if (!row?.tx || !row.valid || row.ignored) {
        row.duplicate = false;
        return;
      }
      const signature = transactionSignature(row.tx);
      row.duplicate = existing.has(signature) || seen.has(signature);
      seen.add(signature);
    });
    const importableRows = rows.filter((row) => row.valid && !row.ignored && !row.duplicate);
    const duplicateCount = rows.filter((row) => row.duplicate).length;
    document.getElementById("applyImportFileButton").disabled = !importableRows.length;
    document.getElementById("applyImportTextButton").disabled = !importableRows.length;
    if (!rows.length) {
      preview.innerHTML = `<div class="import-empty">${escapeHtml(message || "暂无预览")}</div>`;
      return;
    }
    preview.innerHTML = `
      <div class="import-preview-head">
        <strong>${escapeHtml(message)}</strong>
        <span>${importableRows.length}/${rows.length} 可新增${duplicateCount ? ` · ${duplicateCount} 重复` : ""}</span>
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
            <th>费用</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 80).map((row) => `
            <tr>
              <td><span class="status-pill ${row.valid && !row.ignored && !row.duplicate ? "confirmed" : "failed"}">${row.ignored ? "忽略" : (row.valid ? (row.duplicate ? "重复" : "可导入") : "跳过")}</span></td>
              <td>${escapeHtml(row.tx.date || "--")}</td>
              <td>${escapeHtml(actionNames[row.tx.action] || row.tx.action || "--")}</td>
              <td>${escapeHtml(row.tx.symbol || "--")}</td>
              <td>${escapeHtml(row.tx.name || "--")}</td>
              <td>${escapeHtml(row.tx.inputMode === "amount" ? money(row.tx.quantity, row.tx.currency) : formatNumber(row.tx.quantity))}</td>
              <td>${escapeHtml(formatChartPrice(row.tx.price))}</td>
              <td>${escapeHtml(money(row.tx.fee || 0, row.tx.currency))}</td>
              <td>${escapeHtml(row.ignored ? "非资金交易，已忽略" : (row.duplicate ? "已存在相同流水" : row.reason || "--"))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${rows.length > 80 ? `<p class="import-note">仅预览前 80 行，确认后会导入全部可识别行。</p>` : ""}
    `;
  }

  async function applyImportPreview() {
    const rows = importPreviewRows
      .filter((row) => row.valid && !row.ignored && !row.duplicate)
      .map((row) => ({ ...row.tx }));
    if (!rows.length) {
      showToast("没有可导入的交易行");
      return;
    }
    const existing = new Set(state.transactions.map(transactionSignature));
    let imported = 0;
    let skipped = 0;
    for (const tx of rows) {
      normalizeTransactionInstrument(tx);
      const signature = transactionSignature(tx);
      if (existing.has(signature)) {
        skipped += 1;
        continue;
      }
      await hydrateTransactionPrice(tx);
      state.transactions.push(tx);
      existing.add(signature);
      if (tx.symbol && tx.price > 0) setInstrumentPrice(tx.symbol, tx.type, tx.price);
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
      String(tx.type || "fund"),
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
    if (action === "remove-watch") removeWatchlist(symbol, type);
  }

  function handleTransactionAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "edit-tx") editTransaction(button.dataset.txId);
    if (action === "detail") openInstrumentDetail(button.dataset.symbol, button.dataset.type || "fund");
  }

  function removeWatchlist(symbol, type = "fund") {
    state.watchlist = (state.watchlist || []).filter((item) => !sameInstrument(item.symbol, item.type, symbol, type));
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
    const normalizedType = normalizeInstrumentType(type, symbol, "");
    const holding = portfolio.holdings.find((item) => sameInstrument(item.symbol, item.type, symbol, normalizedType))
      || getWatchOnlyRows(new Set()).find((item) => sameInstrument(item.symbol, item.type, symbol, normalizedType))
      || { symbol, name: symbol, type: normalizedType, currency: "CNY", value: 0, pnl: 0, weight: 0, quantity: 0, price: 0 };
    activeInstrumentDetail = {
      symbol: holding.symbol,
      type: holding.type || type,
      name: holding.name || symbol
    };
    els.instrumentTitle.textContent = `${holding.symbol} · ${holding.name}`;
    updateInstrumentRangeLabels(activeInstrumentDetail.type);
    els.instrumentChartTitle.textContent = `${getInstrumentRangeLabel("intraday", activeInstrumentDetail.type)}曲线`;
    if (els.instrumentChartMeta) {
      els.instrumentChartMeta.textContent = isMarketChartType(activeInstrumentDetail.type)
        ? "股票/ETF 默认展示分时和 K 线；录入和详情都优先走东方财富行情。"
        : "基金默认展示估值和净值趋势；数据源优先走东方财富基金净值。";
    }
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
      .filter((tx) => sameInstrument(tx.symbol, tx.type, symbol, activeInstrumentDetail.type))
      .slice()
      .reverse()
      .map((tx) => transactionRecordItem(tx, { compact: true }))
      .join("") || `<article class="record-empty"><strong>暂无交易</strong><span>这是自选关注标的，还没有买入流水。</span></article>`;
    els.instrumentStatus.textContent = "查询中";
    els.backdrop.hidden = false;
    els.instrumentDrawer.classList.add("open");
    els.instrumentDrawer.setAttribute("aria-hidden", "false");
    if (holding.type === "cash") {
      renderInstrumentChartStats(null, "intraday", "现金不展示行情图");
      showChartEmpty(els.instrumentTrendChart, "现金不展示行情曲线");
      els.instrumentStatus.textContent = "无需行情";
      setTimeout(resizeCharts, 120);
      return;
    }
    setInstrumentRange("intraday");
    setTimeout(resizeCharts, 220);
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
    const title = getInstrumentRangeLabel(range, type);
    els.instrumentChartTitle.textContent = `${title}曲线`;
    if (els.instrumentChartMeta) {
      els.instrumentChartMeta.textContent = isMarketChartType(type)
        ? `数据源：${range === "intraday" ? "东方财富分时" : "东方财富 K 线"} · 口径：${range === "intraday" ? "昨收基准" : "复权 K 线"}`
        : `数据源：东方财富基金净值 · 口径：${range === "intraday" ? "近期估值" : "净值趋势"}`;
    }
    els.instrumentStatus.textContent = "查询中";
    try {
      const data = await fetchJson(`/api/chart/${encodeURIComponent(symbol)}?kind=${encodeURIComponent(type)}&range=${encodeURIComponent(range)}`);
      if (requestId !== instrumentChartRequestId) return;
      els.instrumentStatus.textContent = data.points?.length ? "已更新" : "暂无数据";
      if (data.name) els.instrumentTitle.textContent = `${data.code} · ${data.name}`;
      renderInstrumentChartStats(data, range, "", type);
      renderInstrumentChartMeta(data, range, type);
      renderInstrumentAxisHint(data, range, type);
      renderInstrumentChart(els.instrumentTrendChart, data, range, { emptyText: `${name} 暂无 ${title} 数据` });
    } catch (error) {
      if (requestId !== instrumentChartRequestId) return;
      els.instrumentStatus.textContent = "查询失败";
      renderInstrumentChartStats(null, range, error.message || "查询失败", type);
      renderInstrumentChartMeta(null, range, type, error.message || "查询失败");
      renderInstrumentAxisHint(null, range, type);
      renderInstrumentChart(els.instrumentTrendChart, { points: [], chartType: "line" }, range, { emptyText: error.message || "查询失败" });
    }
  }

  function renderInstrumentChartMeta(data, range, type, errorText = "") {
    if (!els.instrumentChartMeta) return;
    if (errorText) {
      els.instrumentChartMeta.textContent = errorText;
      return;
    }
    const source = data?.source || "";
    const sourceText = {
      "eastmoney-trends": "东方财富分时",
      "eastmoney-kline": "东方财富 K 线",
      "eastmoney-fund-recent-nav": "东方财富近期净值",
      "eastmoney-fund-trend": "东方财富净值趋势",
      "eastmoney-quote": "东方财富行情",
      "eastmoney-fundgz": "天天基金估值"
    }[source] || source || "未知来源";
    const changePct = data?.stats?.changePct;
    const latestDate = data?.stats?.latestDate ? formatChartLabelTime(data.stats.latestDate) : "--";
    const extra = Number.isFinite(changePct) ? ` · 涨跌幅 ${changePct.toFixed(2)}%` : "";
    const period = range === "intraday" ? "分时" : getInstrumentRangeLabel(range, type);
    els.instrumentChartMeta.textContent = `${period} · ${sourceText}${extra} · 最新 ${latestDate}`;
  }

  function renderInstrumentAxisHint(data, range, type) {
    if (!els.instrumentChartAxisHint) return;
    const points = Array.isArray(data?.points) ? data.points : [];
    if (!points.length) {
      els.instrumentChartAxisHint.innerHTML = "";
      return;
    }
    const labels = range === "intraday" && isMarketChartType(type)
      ? ["09:30", "10:00", "10:30", "11:30/13:00", "14:00", "14:30", "15:00"]
      : sampleAxisLabels(points, range, type);
    els.instrumentChartAxisHint.style.gridTemplateColumns = `repeat(${Math.max(labels.length, 1)}, minmax(0, 1fr))`;
    els.instrumentChartAxisHint.innerHTML = labels
      .map((label) => `<span>${escapeHtml(label)}</span>`)
      .join("");
  }

  function sampleAxisLabels(points, range, type) {
    const rows = points
      .map((point) => point.date || point.time || "")
      .filter(Boolean);
    if (!rows.length) return [];
    const count = rows.length < 5 ? rows.length : 5;
    const labels = [];
    for (let index = 0; index < count; index += 1) {
      const position = count === 1 ? 0 : Math.round(index * (rows.length - 1) / (count - 1));
      const raw = rows[position];
      labels.push(formatAxisLabel(raw, range, type));
    }
    return labels.filter((label, index, all) => label && all.indexOf(label) === index);
  }

  function formatAxisLabel(raw, range, type) {
    const text = String(raw || "");
    if (!text) return "";
    if (range === "intraday" && isMarketChartType(type)) return text.slice(11, 16) || text;
    if (range === "monthly") return text.slice(0, 7);
    return formatChartLabelTime(text, { short: true });
  }

  function isFundLikeType(type) {
    return type === "fund";
  }

  function isMarketChartType(type) {
    return type === "stock" || type === "etf";
  }

  function getInstrumentRangeLabel(range, type) {
    if (range === "intraday" && isFundLikeType(type)) return "估值";
    return instrumentRangeLabels[range] || "行情";
  }

  function updateInstrumentRangeLabels(type) {
    els.instrumentChartRanges.querySelectorAll("button[data-instrument-range]").forEach((button) => {
      const range = button.dataset.instrumentRange || "daily";
      button.textContent = getInstrumentRangeLabel(range, type);
    });
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

    if (/^\d{6}$/.test(symbol)) {
      await searchInstrumentCandidates(symbol);
      return;
    }

    if (/^[A-Z.]{1,8}$/.test(symbol)) {
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
    const rankedResults = rankSearchResults(results);
    if (!rankedResults.length) {
      els.searchResults.hidden = false;
      els.searchResults.innerHTML = `<div class="search-result"><div><strong>${escapeHtml(errorText || "没有匹配结果")}</strong><span>换一个关键词或直接输入代码</span></div></div>`;
      return;
    }
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = rankedResults.map((item) => `
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

  function rankSearchResults(results) {
    const desiredType = document.getElementById("txType")?.value || "";
    const queryCode = normalizeImportSymbol(document.getElementById("txSymbol")?.value || document.getElementById("txName")?.value || "");
    const typeScore = (type) => {
      if (!desiredType || desiredType === "cash") return 0;
      if (type === desiredType) return 30;
      if (desiredType === "fund" && type === "etf") return 12;
      if (desiredType === "etf" && type === "fund") return 8;
      return 0;
    };
    return (results || []).slice().sort((left, right) => {
      const leftExact = queryCode && left.code === queryCode ? 10 : 0;
      const rightExact = queryCode && right.code === queryCode ? 10 : 0;
      const scoreDiff = (typeScore(right.type) + rightExact) - (typeScore(left.type) + leftExact);
      if (scoreDiff) return scoreDiff;
      return String(left.name || left.code || "").localeCompare(String(right.name || right.code || ""), "zh-Hans-CN");
    });
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
    lookupInstrument(button.dataset.code || "");
  }

  async function lookupInstrument(code) {
    const kind = normalizeInstrumentType(document.getElementById("txType").value, code, document.getElementById("txName").value || "");
    const date = document.getElementById("txDate").value;
    const time = document.getElementById("txTime").value;
    const cacheKey = lookupCacheKey(code, kind, date, time);
    showLookupPanel("查询中", code, []);
    try {
      const cached = lookupBySymbol.get(cacheKey);
      const data = cached || await fetchJson(`/api/instrument/${encodeURIComponent(code)}?kind=${encodeURIComponent(kind)}&date=${encodeURIComponent(date || "")}&time=${encodeURIComponent(time || "")}`);
      lookupBySymbol.set(cacheKey, data);
      cacheLookupData(data, code, kind);
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
    const isFund = data.type === "fund" || (data.type !== "etf" && (data.trend || []).length > 0);
    const stats = isFund
      ? [
          { label: "买入日净值", value: Number.isFinite(data.priceOnDate) ? `${data.priceOnDate.toFixed(4)}${data.priceDate ? ` · ${data.priceDate}` : ""}` : "--" },
          { label: "确认净值", value: Number.isFinite(data.nav) ? `${data.nav.toFixed(4)}${data.navDate ? ` · ${data.navDate}` : ""}` : "--" },
          { label: "估算净值", value: Number.isFinite(data.estimatedNav) ? data.estimatedNav.toFixed(4) : "--" },
          { label: "估算涨跌幅", value: Number.isFinite(data.estimatedChangePct) ? `${data.estimatedChangePct.toFixed(2)}%` : "--", signed: data.estimatedChangePct }
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

  function renderInstrumentChartStats(data, range, errorText = "", type = activeInstrumentDetail?.type || "") {
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
    const previousClose = data.stats?.previousClose;
    const changePct = data.stats?.changePct;
    const change = Number.isFinite(data.stats?.change)
      ? data.stats.change
      : Number.isFinite(latest) && Number.isFinite(previousClose)
        ? latest - previousClose
        : Number.isFinite(latest) && Number.isFinite(open)
          ? latest - open
          : null;
    const baselineLabel = range === "intraday" && Number.isFinite(previousClose) ? "昨收" : "开盘";
    const baselineValue = range === "intraday" && Number.isFinite(previousClose) ? previousClose : open;
    const latestDate = data.stats?.latestDate || "";
    const volume = data.stats?.volume;
    const amount = data.stats?.amount;
    const average = data.stats?.average;
    const fundLike = isFundLikeType(type || data.type);
    const baseLabel = fundLike ? "区间起点" : baselineLabel;
    const activityLabel = fundLike ? "样本点" : (range === "intraday" ? "均价" : "成交量");
    const activityValue = fundLike
      ? `${data.points.length} 个`
      : (range === "intraday" && Number.isFinite(average) ? formatChartPrice(average) : formatCompactNumber(volume));
    const stats = [
      { label: "最新", value: Number.isFinite(latest) ? formatChartPrice(latest) : "--" },
      { label: "涨跌幅", value: Number.isFinite(changePct) ? `${changePct.toFixed(2)}%` : "--", signed: changePct },
      { label: "涨跌", value: Number.isFinite(change) ? signedChartPrice(change) : "--", signed: change },
      { label: baseLabel, value: Number.isFinite(baselineValue) ? formatChartPrice(baselineValue) : "--" },
      { label: "最高", value: Number.isFinite(high) ? formatChartPrice(high) : "--" },
      { label: "最低", value: Number.isFinite(low) ? formatChartPrice(low) : "--" },
      { label: activityLabel, value: activityValue },
      { label: "时间", value: latestDate ? formatChartLabelTime(latestDate) : (Number.isFinite(amount) ? formatCompactNumber(amount) : "--") }
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
    const size = getChartSize(container, 560);
    const desiredType = chartType === "candlestick" ? "candlestick" : "line";
    const timeScaleOptions = instrumentTimeScaleOptions(range);
    const stats = payload?.stats || {};

    clearChartEmpty(container);

    if (instrumentChartApi && currentInstrumentChartType && currentInstrumentChartType !== desiredType) {
      resetInstrumentChart();
    }

    if (!instrumentChartApi) {
      instrumentChartApi = LightweightCharts.createChart(container, {
        ...baseChartOptions(size.width, size.height),
        timeScale: timeScaleOptions,
        localization: {
          priceFormatter: (price) => formatChartPrice(price)
        }
      });
    } else {
      instrumentChartApi.applyOptions({
        ...baseChartOptions(size.width, size.height),
        timeScale: timeScaleOptions,
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
          date: point.date || point.time || "",
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          change: point.change,
          changePct: point.changePct,
          volume: point.volume,
          amount: point.amount
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
        applySeriesAutoscale(instrumentCandlesSeriesApi);
      }
      instrumentCandlesSeriesApi.setData(candleData);
      setInstrumentPriceLine(instrumentCandlesSeriesApi, Number.isFinite(stats.open) ? stats.open : stats.latest, range);
      bindChartCrosshair(instrumentChartApi, {
        container,
        series: instrumentCandlesSeriesApi,
        formatPrice: (value) => formatChartPrice(value),
        formatTime: (time) => formatChartLabelTime(time),
        formatExtra: (point) => buildInstrumentHoverSummary(point, { chartType: "candlestick", range, stats }),
        setCleanup: (cleanup) => { instrumentChartCrosshairCleanup = cleanup; },
        getCleanup: () => instrumentChartCrosshairCleanup,
        setLabel: (label) => { instrumentChartLabelApi = label; },
        pointMap: buildPointMap(candleData)
      });
    } else {
      const lineData = points
        .map((point) => ({
          time: normalizeChartTime(point.time || point.date),
          date: point.date || point.time || "",
          value: number(point.value ?? point.close ?? point.open),
          average: number(point.average),
          high: number(point.high),
          low: number(point.low),
          changePct: point.changePct ?? point.equityReturn
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
        applySeriesAutoscale(instrumentAreaSeriesApi);
      }
      instrumentAreaSeriesApi.setData(lineData);
      setInstrumentPriceLine(instrumentAreaSeriesApi, Number.isFinite(stats.previousClose) ? stats.previousClose : stats.open, range);
      bindChartCrosshair(instrumentChartApi, {
        container,
        series: instrumentAreaSeriesApi,
        formatPrice: (value) => formatChartPrice(value),
        formatTime: (time) => formatChartLabelTime(time),
        formatExtra: (point) => buildInstrumentHoverSummary(point, { chartType: "line", range, stats }),
        setCleanup: (cleanup) => { instrumentChartCrosshairCleanup = cleanup; },
        getCleanup: () => instrumentChartCrosshairCleanup,
        setLabel: (label) => { instrumentChartLabelApi = label; },
        pointMap: buildPointMap(lineData)
      });
    }

    instrumentChartApi.timeScale().fitContent();
    currentInstrumentRange = range;
  }

  function setInstrumentPriceLine(series, price, range) {
    if (!series || typeof series.createPriceLine !== "function" || !Number.isFinite(price) || price <= 0) return;
    const lineStyle = window.LightweightCharts?.LineStyle?.Dashed ?? 2;
    if (series.__nanstarBaselineLine && typeof series.removePriceLine === "function") {
      try {
        series.removePriceLine(series.__nanstarBaselineLine);
      } catch {
        // Lightweight Charts may have already disposed the line during a series reset.
      }
    }
    series.__nanstarBaselineLine = series.createPriceLine({
      price,
      color: "rgba(148, 163, 184, 0.72)",
      lineWidth: 1,
      lineStyle,
      axisLabelVisible: true,
      title: range === "intraday" ? "昨收/基准" : "基准"
    });
  }

  function instrumentTimeScaleOptions(range) {
    return {
      borderVisible: false,
      timeVisible: range === "intraday",
      secondsVisible: false,
      rightOffset: range === "intraday" ? 8 : 10,
      barSpacing: range === "intraday" ? 3.6 : range === "monthly" ? 12 : range === "weekly" ? 10 : 8,
      minBarSpacing: range === "intraday" ? 1.8 : 4,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time) => formatChartLabelTime(time, { short: true })
    };
  }

  function resetInstrumentChart() {
    if (instrumentChartCrosshairCleanup) {
      instrumentChartCrosshairCleanup();
      instrumentChartCrosshairCleanup = null;
    }
    if (instrumentChartApi) instrumentChartApi.remove();
    instrumentChartApi = null;
    instrumentSeriesApi = null;
    instrumentAreaSeriesApi = null;
    instrumentCandlesSeriesApi = null;
    instrumentChartLabelApi = null;
    currentInstrumentChartType = null;
  }

  function showChartEmpty(container, message) {
    resetInstrumentChart();
    container.innerHTML = "";
    container.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  }

  function clearChartEmpty(container) {
    const empty = container.querySelector(".chart-empty");
    if (empty) empty.remove();
  }

  function showInlineChartEmpty(container, message) {
    clearInlineChartEmpty(container);
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function clearInlineChartEmpty(container) {
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
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    if (Math.abs(num) >= 1000) return num.toFixed(0);
    if (Math.abs(num) >= 100) return num.toFixed(2);
    if (Math.abs(num) >= 10) return num.toFixed(2);
    return num.toFixed(3);
  }

  function signedChartPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    const sign = num >= 0 ? "+" : "-";
    return `${sign}${formatChartPrice(Math.abs(num))}`;
  }

  function formatCompactNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    const abs = Math.abs(num);
    if (abs >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
    if (abs >= 10000) return `${(num / 10000).toFixed(2)}万`;
    return formatNumber(num);
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
    normalizeTransactionInstrument(tx);
    await hydrateTransactionPrice(tx);
    const matchedLookup = sameInstrument(latestLookup?.code, latestLookup?.type, tx.symbol, tx.type)
      ? latestLookup
      : lookupBySymbol.get(instrumentKey(tx.symbol, tx.type));

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

    const nextPrice = Number.isFinite(matchedLookup?.nav)
      ? matchedLookup.nav
      : Number.isFinite(matchedLookup?.estimatedNav)
        ? matchedLookup.estimatedNav
        : tx.price;
    setInstrumentPrice(tx.symbol, tx.type, nextPrice);
    const nextChange = Number.isFinite(matchedLookup?.estimatedChangePct)
      ? matchedLookup.estimatedChangePct / 100
      : (legacyDayChangeValue(tx.symbol, tx.type) || 0);
    setInstrumentDayChange(tx.symbol, tx.type, nextChange);
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
      cacheLookupData(data, tx.symbol, tx.type);
      if (Number.isFinite(data.priceOnDate)) tx.price = data.priceOnDate;
      else if (Number.isFinite(data.nav)) tx.price = data.nav;
      else if (Number.isFinite(data.estimatedNav)) tx.price = data.estimatedNav;
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
    if (Number.isFinite(lookup?.nav)) setInstrumentPrice(item.symbol, item.type, lookup.nav);
    else if (Number.isFinite(lookup?.estimatedNav)) setInstrumentPrice(item.symbol, item.type, lookup.estimatedNav);
    else if (Number.isFinite(lookup?.price)) setInstrumentPrice(item.symbol, item.type, lookup.price);
    if (Number.isFinite(lookup?.estimatedChangePct)) setInstrumentDayChange(item.symbol, item.type, lookup.estimatedChangePct / 100);
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

  // ====== Fund Guru Module ======

  function switchFundTab(tab) {
    activeFundTab = tab;
    document.querySelectorAll(".fund-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.fundTab === tab);
    });
    document.querySelectorAll(".fund-panel").forEach(function (p) {
      p.classList.toggle("active", p.dataset.fundPanel === tab);
    });
    renderFunds();
  }

  function loadFundDataFromFile() {
    els.fundRefreshButton.classList.add("loading");
    fetch("./output/fund_data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("No data");
        return res.json();
      })
      .then(function (data) {
        fundData = data;
        els.fundUpdateTime.textContent = "数据更新：" + (data.updateTime || "--");
        els.fundEmpty.hidden = true;
        renderFunds();
      })
      .catch(function () {
        fundData = null;
        els.fundUpdateTime.textContent = "数据来源：待生成（运行 scrape.py）";
      })
      .finally(function () {
        els.fundRefreshButton.classList.remove("loading");
        renderFunds();
      });
  }

  function importFundExcel() {
    var file = els.fundFileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(e.target.result, { type: "array" });
        var guruSheet = wb.Sheets["达人汇总"];
        var tradeSheet = wb.Sheets["交易明细"];
        var holdingSheet = wb.Sheets["持仓明细"];
        var sectorSheet = wb.Sheets["板块分布"];

        if (!guruSheet) { showToast("未找到'达人汇总'工作表"); return; }

        var guruJson = XLSX.utils.sheet_to_json(guruSheet, { header: 1 });
        var gurus = [];
        for (var i = 1; i < guruJson.length; i++) {
          var row = guruJson[i];
          if (!row[0]) continue;
          gurus.push({
            name: row[0],
            totalValue: row[1],
            returnRate: row[2],
            heavySector: row[3],
            heavyRatio: row[4],
            sectorCount: row[5],
            lastTrade: row[6]
          });
        }

        var trades = [];
        if (tradeSheet) {
          var tradeJson = XLSX.utils.sheet_to_json(tradeSheet, { header: 1 });
          var currentName = "";
          for (var j = 1; j < tradeJson.length; j++) {
            var tr = tradeJson[j];
            if (tr[0]) currentName = tr[0];
            if (!tr[3]) continue;
            trades.push({
              name: currentName,
              time: tr[1] || "",
              action: tr[2] || "",
              fundName: tr[3] || "",
              shares: tr[4],
              amount: tr[5],
              ratio: tr[6]
            });
          }
        }

        var holdings = [];
        if (holdingSheet) {
          var holdingJson = XLSX.utils.sheet_to_json(holdingSheet, { header: 1 });
          var hName = "";
          for (var k = 1; k < holdingJson.length; k++) {
            var hr = holdingJson[k];
            if (hr[0]) hName = hr[0];
            if (!hr[1]) continue;
            holdings.push({
              name: hName,
              fundName: hr[1],
              sector: hr[2] || "--",
              amount: hr[3],
              ratio: hr[4],
              profit: hr[5],
              profitRate: hr[6]
            });
          }
        }

        var sectors = { holding: [], inflow: [], outflow: [] };
        if (sectorSheet) {
          var secJson = XLSX.utils.sheet_to_json(sectorSheet, { header: 1 });
          // Parse sector distribution (simplified: rows 3-11 col A/B, D/E, G/H)
          for (var si = 3; si < Math.min(secJson.length, 12); si++) {
            var sr = secJson[si];
            if (sr[0] && sr[0] !== "其他") sectors.holding.push({ name: sr[0], ratio: number(sr[1]) });
            if (sr[3] && sr[3] !== "其他") sectors.inflow.push({ name: sr[3], ratio: number(sr[4]) });
            if (sr[6] && sr[6] !== "其他") sectors.outflow.push({ name: sr[6], ratio: number(sr[7]) });
          }
        }

        fundData = {
          updateTime: new Date().toISOString().slice(0, 16).replace("T", " "),
          gurus: gurus,
          trades: trades,
          holdings: holdings,
          sectors: sectors
        };
        els.fundUpdateTime.textContent = "数据更新：" + fundData.updateTime;
        els.fundEmpty.hidden = true;
        showToast("已导入 " + gurus.length + " 位达人数据");
        renderFunds();
      } catch (err) {
        showToast("Excel 解析失败：" + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    els.fundFileInput.value = "";
  }

  function renderFunds() {
    if (!fundData || !fundData.gurus) {
      els.fundEmpty.hidden = false;
      return;
    }
    els.fundEmpty.hidden = true;
    renderFundGuruTable();
    renderFundSectorView();
    renderFundTradeTable();
    renderFundHoldingTable();
  }

  function renderFundGuruTable() {
    var gurus = fundData.gurus;
    if (!gurus || !gurus.length) return;

    var sorted = gurus.slice().sort(function (a, b) { return number(b.totalValue) - number(a.totalValue); });

    // Stats
    var totalAsset = sorted.reduce(function (s, g) { return s + number(g.totalValue); }, 0);
    var avgReturn = sorted.reduce(function (s, g) { return s + number(g.returnRate); }, 0) / sorted.length;
    els.fundGuruStats.innerHTML =
      '<div class="fund-stat-card"><span class="stat-label">跟踪达人</span><span class="stat-value">' + sorted.length + ' 位</span></div>' +
      '<div class="fund-stat-card"><span class="stat-label">总持仓规模</span><span class="stat-value">' + shortMoney(totalAsset) + '</span></div>' +
      '<div class="fund-stat-card"><span class="stat-label">平均收益率</span><span class="stat-value ' + (avgReturn >= 0 ? 'guru-return-positive' : 'guru-return-negative') + '">' + percent(avgReturn) + '</span></div>';

    var html = "";
    sorted.forEach(function (guru, idx) {
      var rank = idx + 1;
      var rankClass = rank <= 3 ? " top3" : "";
      var retClass = number(guru.returnRate) >= 0 ? "guru-return-positive" : "guru-return-negative";
      var sector = guru.heavySector;
      var sectorClass = sector && sector !== "--" ? " primary" : "";
      html += "<tr>" +
        "<td><span class=\"fund-guru-rank" + rankClass + "\">" + rank + "</span></td>" +
        "<td><span class=\"fund-guru-name\">" + escapeHtml(guru.name) + "</span></td>" +
        "<td>" + money(number(guru.totalValue)) + "</td>" +
        "<td class=\"" + retClass + "\">" + percent(number(guru.returnRate)) + "</td>" +
        "<td><span class=\"fund-sector-tag" + sectorClass + "\">" + escapeHtml(String(sector || "--")) + "</span></td>" +
        "<td>" + (guru.heavyRatio != null ? percent(number(guru.heavyRatio)) : "--") + "</td>" +
        "<td>" + (guru.sectorCount || "--") + "</td>" +
        "<td>" + escapeHtml(String(guru.lastTrade || "--")) + "</td>" +
        "</tr>";
    });
    els.fundGuruBody.innerHTML = html;
  }

  function renderFundSectorView() {
    var sectors = fundData.sectors;
    if (!sectors) return;

    renderSectorList(els.fundSectorHolding, sectors.holding || [], "holding", "violet");
    renderSectorList(els.fundSectorInflow, sectors.inflow || [], "inflow", "red");
    renderSectorList(els.fundSectorOutflow, sectors.outflow || [], "outflow", "green");
  }

  function renderSectorList(el, items, type, color) {
    if (!el || !items.length) return;
    var maxRatio = items.reduce(function (m, i) { return Math.max(m, number(i.ratio)); }, 0);
    var html = "";
    items.forEach(function (item) {
      var pct = maxRatio > 0 ? (number(item.ratio) / maxRatio * 100).toFixed(0) : 0;
      html += "<div class=\"fund-sector-item\">" +
        "<span class=\"sector-name\">" + escapeHtml(item.name) + "</span>" +
        "<span class=\"sector-bar-wrap\"><span class=\"sector-bar-fill " + type + "\" style=\"width:" + pct + "%\"></span></span>" +
        "<span class=\"sector-val\">" + percent(number(item.ratio)) + "</span>" +
        "</div>";
    });
    el.innerHTML = html;
  }

  function renderFundTradeTable() {
    var trades = fundData.trades;
    if (!trades || !trades.length) { els.fundTradeBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">暂无今日交易数据</td></tr>'; return; }

    var html = "";
    trades.forEach(function (t) {
      var isBuy = t.action.indexOf("买入") !== -1 || t.action.indexOf("定投") !== -1;
      var isSell = t.action.indexOf("卖出") !== -1;
      var isConvert = t.action.indexOf("转换") !== -1;
      var badgeClass = isConvert ? "convert" : isSell ? "sell" : isBuy ? "buy" : "auto";
      var detail = t.amount ? money(number(t.amount)) : (t.shares ? number(t.shares).toFixed(0) + " 份" : "--");
      html += "<tr>" +
        "<td><span class=\"fund-guru-name\">" + escapeHtml(t.name) + "</span></td>" +
        "<td>" + escapeHtml(String(t.time || "--")) + "</td>" +
        "<td><span class=\"fund-action-badge " + badgeClass + "\">" + escapeHtml(t.action) + "</span></td>" +
        "<td>" + escapeHtml(String(t.fundName || "--")) + "</td>" +
        "<td>" + detail + "</td>" +
        "<td>" + (t.ratio != null ? (number(t.ratio) >= 1 ? t.ratio + "%" : percent(number(t.ratio))) : "--") + "</td>" +
        "</tr>";
    });
    els.fundTradeBody.innerHTML = html;
  }

  function renderFundHoldingTable() {
    var holdings = fundData.holdings;
    if (!holdings || !holdings.length) { els.fundHoldingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px">暂无持仓明细数据</td></tr>'; return; }

    var search = els.fundHoldingSearch ? els.fundHoldingSearch.value.trim().toLowerCase() : "";

    var filtered = holdings;
    if (search) {
      filtered = holdings.filter(function (h) {
        return h.name.toLowerCase().indexOf(search) !== -1 || h.fundName.toLowerCase().indexOf(search) !== -1;
      });
    }

    var html = "";
    filtered.forEach(function (h) {
      var retClass = number(h.profitRate) >= 0 ? "guru-return-positive" : "guru-return-negative";
      html += "<tr>" +
        "<td><span class=\"fund-guru-name\">" + escapeHtml(h.name) + "</span></td>" +
        "<td>" + escapeHtml(String(h.fundName || "--")) + "</td>" +
        "<td><span class=\"fund-sector-tag\">" + escapeHtml(String(h.sector || "--")) + "</span></td>" +
        "<td>" + money(number(h.amount)) + "</td>" +
        "<td>" + (h.ratio != null ? percent(number(h.ratio)) : "--") + "</td>" +
        "<td class=\"" + retClass + "\">" + moneySigned(number(h.profit)) + "</td>" +
        "<td class=\"" + retClass + "\">" + percent(number(h.profitRate)) + "</td>" +
        "</tr>";
    });
    els.fundHoldingBody.innerHTML = html;
  }

})();
