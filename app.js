const STORAGE_KEY = "pocketfolio-prototype-v1";
const starterData = {
  initialAssets: { actual: { KRW: 3668900, USD: 1635.6 }, virtual: { KRW: 3668900, USD: 1635.6 } },
  actualCash: { KRW: 1250000, USD: 850 },
  virtualCash: { KRW: 1250000, USD: 850 },
  exchangeRate: 1400,
  comparisonStartDate: today(),
  positions: [
    { id: "a1", mode: "actual", symbol: "005930", name: "삼성전자", currency: "KRW", qty: 18, avgPrice: 71200, price: 74800 },
    { id: "a2", mode: "actual", symbol: "035420", name: "NAVER", currency: "KRW", qty: 5, avgPrice: 207000, price: 214500 },
    { id: "a3", mode: "actual", symbol: "AAPL", name: "Apple", currency: "USD", qty: 4, avgPrice: 188, price: 196.4 },
    { id: "v1", mode: "virtual", symbol: "005930", name: "삼성전자", currency: "KRW", qty: 18, avgPrice: 74800, price: 74800 },
    { id: "v2", mode: "virtual", symbol: "035420", name: "NAVER", currency: "KRW", qty: 5, avgPrice: 214500, price: 214500 },
    { id: "v3", mode: "virtual", symbol: "AAPL", name: "Apple", currency: "USD", qty: 4, avgPrice: 196.4, price: 196.4 }
  ],
  news: [
    { symbol: "005930", name: "삼성전자", title: "반도체 업황 회복 기대, 투자자는 무엇을 볼까요?", body: "실적 발표와 메모리 수요 흐름을 함께 확인해 보세요. 이 문장은 예시 메모예요.", date: "오늘", source: "직접 입력한 예시" },
    { symbol: "AAPL", name: "Apple", title: "신제품 발표 이후 시장의 관심이 모이고 있어요", body: "매출 비중과 시장 반응을 살펴보고, 기대와 실제 결과를 구분해 보세요.", date: "어제", source: "직접 입력한 예시" },
    { symbol: "NVDA", name: "NVIDIA", title: "AI 반도체 수요 관련 소식을 기록해 보세요", body: "기사의 날짜와 출처를 함께 적어두면 나중에 되돌아보기 쉬워요.", date: "11월 18일", source: "직접 입력한 예시" }
  ],
  journal: [
    { title: "삼성전자를 조금 더 지켜보기로", text: "반도체 소식이 좋아 보여도 한 번에 많이 사기보다 다음 실적까지 이유를 기록해두자.", symbol: "005930", date: "2026-11-19", tag: "매매 생각" },
    { title: "가상 계좌에서 NVIDIA 매수", text: "AI 수요 기대가 이미 가격에 반영됐는지 다음 주에 다시 확인하기.", symbol: "NVDA", date: "2026-11-17", tag: "가상 매수" },
    { title: "나의 투자 원칙", text: "잘 모르는 소식 하나만 듣고 바로 거래하지 않기. 먼저 기록하고 하루 뒤에 다시 읽기.", symbol: "", date: "2026-11-14", tag: "배운 점" }
  ],
  trades: []
};

let data = loadData();
let modalMode = "";
let toastTimer;
let setupHoldingRowSequence = 0;
let undoConfirmId = null;
let allocationMode = "actual";
let newsDirectoryHandle = null;
let newsSyncTimer = null;
let newsSearch = "";
let newsCategory = "all";

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.positions)) {
      const loaded = { ...structuredClone(starterData), ...saved };
      loaded.actualCash = { ...starterData.actualCash, ...saved.actualCash };
      loaded.virtualCash = { ...starterData.virtualCash, ...saved.virtualCash };
      loaded.initialAssets = saved.initialAssets || deriveInitialAssets(loaded);
      loaded.exchangeRate = Number(saved.exchangeRate) > 0 ? Number(saved.exchangeRate) : starterData.exchangeRate;
      loaded.comparisonStartDate = saved.comparisonStartDate || today();
      loaded.snapshots = Array.isArray(saved.snapshots) ? saved.snapshots : [];
      if (!loaded.snapshots.some((item) => item.baseline)) loaded.snapshots.unshift(createBaselineSnapshot(loaded));
      return loaded;
    }
  } catch (error) {
    console.warn("저장된 기록을 불러오지 못했습니다.", error);
  }
  const initial = structuredClone(starterData);
  initial.snapshots = [createBaselineSnapshot(initial)];
  return initial;
}

function deriveInitialAssets(source) {
  const result = { actual: {}, virtual: {} };
  for (const mode of ["actual", "virtual"]) {
    const cash = mode === "actual" ? source.actualCash : source.virtualCash;
    for (const currency of ["KRW", "USD"]) {
      const cost = source.positions.filter((item) => item.mode === mode && item.currency === currency).reduce((sum, item) => sum + item.qty * item.avgPrice, 0);
      result[mode][currency] = (cash[currency] || 0) + cost;
    }
  }
  return result;
}

function createBaselineSnapshot(source) {
  return {
    id: "baseline",
    baseline: true,
    date: source.comparisonStartDate || today(),
    exchangeRate: source.exchangeRate,
    actual: { ...(source.initialAssets?.actual || { KRW: 0, USD: 0 }) },
    virtual: { ...(source.initialAssets?.virtual || { KRW: 0, USD: 0 }) }
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value, currency) {
  const digits = currency === "KRW" ? 0 : 2;
  const amount = new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return currency === "KRW" ? `₩${amount}` : `$${amount}`;
}

function portfolioValue(mode, currency) {
  const cash = mode === "actual" ? data.actualCash : data.virtualCash;
  const holdings = data.positions.filter((item) => item.mode === mode && item.currency === currency).reduce((sum, item) => sum + item.qty * item.price, 0);
  return (cash[currency] || 0) + holdings;
}

function portfolioReturn(mode, currency) {
  const startingAmount = data.initialAssets[mode]?.[currency] || 0;
  const currentAmount = portfolioValue(mode, currency);
  return startingAmount ? ((currentAmount - startingAmount) / startingAmount) * 100 : 0;
}

function render() {
  renderSummary();
  renderComparisons();
  renderAllocation();
  renderHoldings();
  renderSnapshots();
  renderNews();
  renderJournal();
}

function renderSummary() {
  for (const currency of ["KRW", "USD"]) {
    const actual = portfolioValue("actual", currency);
    const virtual = portfolioValue("virtual", currency);
    const actualHoldings = data.positions.filter((item) => item.mode === "actual" && item.currency === currency).reduce((sum, item) => sum + item.qty * item.price, 0);
    const virtualHoldings = data.positions.filter((item) => item.mode === "virtual" && item.currency === currency).reduce((sum, item) => sum + item.qty * item.price, 0);
    document.getElementById(`actual-${currency.toLowerCase()}`).textContent = money(actual, currency);
    document.getElementById(`virtual-${currency.toLowerCase()}`).textContent = money(virtual, currency);
    document.getElementById(`actual-${currency.toLowerCase()}-detail`).innerHTML = `<span>시작 ${money(data.initialAssets.actual[currency] || 0, currency)}</span><span>예수금 ${money(data.actualCash[currency] || 0, currency)}</span><span>보유 평가액 ${money(actualHoldings, currency)}</span>`;
    document.getElementById(`virtual-${currency.toLowerCase()}-detail`).innerHTML = `<span>시작 ${money(data.initialAssets.virtual[currency] || 0, currency)}</span><span>예수금 ${money(data.virtualCash[currency] || 0, currency)}</span><span>보유 평가액 ${money(virtualHoldings, currency)}</span>`;
  }
  document.getElementById("exchange-rate").value = data.exchangeRate;
}

function renderComparisons() {
  const container = document.getElementById("comparison-cards");
  const startDate = new Date(`${data.comparisonStartDate}T12:00:00`);
  const formatDate = (date) => new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
  document.getElementById("comparison-period").textContent = `시작 ${formatDate(startDate)} · 월별 기록 ${Math.max(0, (data.snapshots || []).filter((item) => !item.baseline).length)}회`;
  container.innerHTML = ["actual", "virtual"].map((mode) => {
    const isActual = mode === "actual";
    const krw = portfolioValue(mode, "KRW");
    const usd = portfolioValue(mode, "USD");
    const krwReturn = portfolioReturn(mode, "KRW");
    const usdReturn = portfolioReturn(mode, "USD");
    const krwInvested = data.positions.filter((item) => item.mode === mode && item.currency === "KRW").reduce((sum, item) => sum + item.qty * item.price, 0);
    const usdInvested = data.positions.filter((item) => item.mode === mode && item.currency === "USD").reduce((sum, item) => sum + item.qty * item.price, 0);
    const krwShare = krw ? Math.round((krwInvested / krw) * 100) : 0;
    const usdShare = usd ? Math.round((usdInvested / usd) * 100) : 0;
    const convertedTotal = krw + usd * data.exchangeRate;
    return `<article class="compare-card"><div class="compare-head"><span class="portfolio-label"><span class="portfolio-symbol ${isActual ? "real" : "paper"}">${isActual ? "실" : "가"}</span>${isActual ? "실제 포트폴리오" : "가상 포트폴리오"}</span><span class="portfolio-tag">${isActual ? "내가 보유 중" : "연습 계좌"}</span></div><div class="compare-total"><strong>${money(krw, "KRW")}</strong><span class="return-pill ${krwReturn >= 0 ? "positive" : "negative"}">원화 ${signed(krwReturn)}%</span></div><div class="currency-line"><span>달러 ${money(usd, "USD")}</span><span>달러 수익률 ${signed(usdReturn)}%</span></div><div class="converted-total">총자산 원화 환산 <strong>${money(convertedTotal, "KRW")}</strong></div><div class="mini-bars"><div class="allocation-track"><span class="krw-bar" style="width:${krwShare}%"></span></div><div class="allocation-track"><span class="usd-bar" style="width:${usdShare}%"></span></div></div><div class="compare-foot"><span>원화 종목 투자 ${krwShare}%</span><span>환율 ₩${new Intl.NumberFormat("ko-KR").format(data.exchangeRate)} 적용</span><span>달러 종목 투자 ${usdShare}%</span></div></article>`;
  }).join("");
}

function signed(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function renderAllocation() {
  const cash = allocationMode === "actual" ? data.actualCash : data.virtualCash;
  const portfolioTotal = portfolioValue(allocationMode, "KRW") + portfolioValue(allocationMode, "USD") * data.exchangeRate;
  const entries = [];
  for (const currency of ["KRW", "USD"]) {
    if ((cash[currency] || 0) > 0) entries.push({
      key: `cash-${currency}`,
      name: currency === "KRW" ? "원화 예수금" : "달러 예수금",
      symbol: currency,
      currency,
      value: cash[currency] * (currency === "USD" ? data.exchangeRate : 1),
      nativeValue: cash[currency],
      cash: true
    });
  }
  for (const item of data.positions.filter((position) => position.mode === allocationMode && position.qty > 0)) {
    entries.push({
      key: `${item.currency}:${item.symbol}`,
      name: item.name,
      symbol: item.symbol,
      currency: item.currency,
      value: item.qty * item.price * (item.currency === "USD" ? data.exchangeRate : 1),
      nativeValue: item.qty * item.price,
      qty: item.qty
    });
  }
  entries.sort((left, right) => right.value - left.value);
  const top = entries[0];
  const topShare = portfolioTotal > 0 && top ? (top.value / portfolioTotal) * 100 : 0;
  const invested = entries.filter((entry) => !entry.cash).reduce((sum, entry) => sum + entry.value, 0);
  const cashValue = entries.filter((entry) => entry.cash).reduce((sum, entry) => sum + entry.value, 0);
  document.getElementById("actual-allocation-tab").classList.toggle("active", allocationMode === "actual");
  document.getElementById("virtual-allocation-tab").classList.toggle("active", allocationMode === "virtual");
  document.getElementById("actual-allocation-tab").setAttribute("aria-selected", String(allocationMode === "actual"));
  document.getElementById("virtual-allocation-tab").setAttribute("aria-selected", String(allocationMode === "virtual"));
  document.getElementById("allocation-summary").innerHTML = `<div><span>총자산 · 원화 환산</span><strong>${money(portfolioTotal, "KRW")}</strong></div><div><span>종목 평가액</span><strong>${money(invested, "KRW")}</strong></div><div><span>현금 비중</span><strong>${portfolioTotal ? `${((cashValue / portfolioTotal) * 100).toFixed(1)}%` : "0.0%"}</strong></div><div class="concentration-note ${topShare >= 50 ? "high" : topShare >= 30 ? "watch" : "balanced"}"><span>${top ? `${escapeHtml(top.name)} 비중` : "가장 큰 비중"}</span><strong>${top ? `${topShare.toFixed(1)}%` : "0.0%"}</strong><small>${topShare >= 50 ? "한 종목·자산에 비중이 크게 모여 있어요." : topShare >= 30 ? "가장 큰 단일 비중을 확인해 보세요." : "단일 비중 30% 미만"}</small></div>`;
  const segments = entries.map((entry, index) => {
    const share = portfolioTotal > 0 ? (entry.value / portfolioTotal) * 100 : 0;
    const description = `${entry.name}${entry.cash ? " · 현금" : ` · ${entry.symbol} ${entry.qty}주`} · ${money(entry.nativeValue, entry.currency)} · 원화 환산 ${money(entry.value, "KRW")} · 전체의 ${share.toFixed(1)}%`;
    return `<span class="mix-segment mix-color-${index % 6}" style="width:${share}%" title="${escapeAttr(description)}" data-tooltip="${escapeAttr(description)}" tabindex="0" role="img" aria-label="${escapeAttr(description)}"></span>`;
  }).join("");
  document.getElementById("allocation-list").innerHTML = entries.length ? `<div class="allocation-overview"><div class="allocation-overview-label"><strong>전체 자산 비중</strong><span>막대 한 칸은 전체 자산의 비율이에요.</span></div><div class="allocation-stacked-bar" role="img" aria-label="${entries.map((entry) => `${entry.name} ${portfolioTotal ? ((entry.value / portfolioTotal) * 100).toFixed(1) : "0.0"}%`).join(", ")}">${segments}</div><div class="allocation-column-labels"><span>자산</span><span>포트폴리오 비중</span><span>평가액</span></div></div>${entries.map((entry, index) => {
    const share = portfolioTotal > 0 ? (entry.value / portfolioTotal) * 100 : 0;
    return `<div class="allocation-row"><div class="allocation-name"><span class="allocation-mark ${entry.cash ? "cash" : "stock"} mix-color-${index % 6}">${escapeHtml(entry.cash ? (entry.currency === "KRW" ? "₩" : "＄") : entry.symbol.slice(0, 2))}</span><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.cash ? "현금" : `${escapeHtml(entry.symbol)} · ${entry.qty}주`}</small></span></div><div class="allocation-bar-cell"><div class="allocation-bar-track"><span class="allocation-bar mix-color-${index % 6}" style="width:${Math.min(100, share)}%"></span></div><strong class="allocation-share-label">${share.toFixed(1)}%</strong></div><div class="allocation-amount"><strong>${money(entry.nativeValue, entry.currency)}</strong><small>원화 환산 ${money(entry.value, "KRW")}</small></div></div>`;
  }).join("")}` : `<div class="snapshot-empty">아직 입력된 예수금이나 보유 종목이 없어요.</div>`;
}

function renderHoldings() {
  const body = document.getElementById("holdings-body");
  const symbols = [...new Set(data.positions.map((item) => `${item.currency}:${item.symbol}`))];
  document.getElementById("empty-holdings").classList.toggle("hidden", symbols.length > 0);
  body.innerHTML = symbols.map((key) => {
    const [, symbol] = key.split(":");
    const actual = data.positions.find((item) => item.mode === "actual" && `${item.currency}:${item.symbol}` === key);
    const virtual = data.positions.find((item) => item.mode === "virtual" && `${item.currency}:${item.symbol}` === key);
    const stock = actual || virtual;
    const actualValue = actual ? actual.qty * actual.price : 0;
    const virtualValue = virtual ? virtual.qty * virtual.price : 0;
    const max = Math.max(actualValue, virtualValue, 1);
    const share = Math.round((Math.min(actualValue, virtualValue) / max) * 100);
    return `<tr data-symbol="${escapeAttr(stock.symbol)}" data-currency="${stock.currency}" title="눌러서 현재가 수정"><td><div class="stock-name"><span class="stock-logo">${escapeHtml(stock.symbol.slice(0, 2))}</span><span><strong>${escapeHtml(stock.name)}</strong><small>${escapeHtml(stock.symbol)}</small></span></div></td><td><span class="currency-cell">${stock.currency}</span></td><td><span class="price-cell">${money(stock.price, stock.currency)}</span></td><td><span class="qty-cell">${actual ? `${actual.qty}주 · ${money(actualValue, actual.currency)}` : "—"}</span></td><td><span class="qty-cell">${virtual ? `${virtual.qty}주 · ${money(virtualValue, virtual.currency)}` : "—"}</span></td><td class="compare-cell">${actual && virtual ? `<div class="compare-track"><span style="width:${share}%"></span></div><span class="compare-label">차이 ${money(Math.abs(actualValue - virtualValue), stock.currency)} · 비율 ${share}%</span>` : `<span class="compare-label">한쪽 포트폴리오에만 있어요</span>`}</td></tr>`;
  }).join("");
}

function snapshotTotal(snapshot, mode) {
  return (snapshot[mode]?.KRW || 0) + (snapshot[mode]?.USD || 0) * snapshot.exchangeRate;
}

function renderSnapshots() {
  const snapshots = [...(data.snapshots || [])].sort((left, right) => left.date.localeCompare(right.date));
  const baseline = snapshots.find((item) => item.baseline) || createBaselineSnapshot(data);
  const baselineActual = snapshotTotal(baseline, "actual");
  const baselineVirtual = snapshotTotal(baseline, "virtual");
  const points = [baseline, ...snapshots.filter((item) => !item.baseline).slice(-11)].map((item) => ({
    ...item,
    actualChange: baselineActual ? ((snapshotTotal(item, "actual") - baselineActual) / baselineActual) * 100 : 0,
    virtualChange: baselineVirtual ? ((snapshotTotal(item, "virtual") - baselineVirtual) / baselineVirtual) * 100 : 0
  }));
  document.getElementById("snapshot-rate-label").textContent = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(data.exchangeRate);
  document.getElementById("snapshot-chart").innerHTML = renderSnapshotChart(points);
  const records = snapshots.filter((item) => !item.baseline).slice().reverse();
  document.getElementById("snapshot-list").innerHTML = records.length ? `<div class="snapshot-table-wrap"><table class="snapshot-table"><thead><tr><th>기록일</th><th>실제 자산</th><th>가상 자산</th><th>실제 변화</th><th>가상 변화</th><th>저장 환율</th></tr></thead><tbody>${records.slice(0, 12).map((item) => {
    const actual = snapshotTotal(item, "actual");
    const virtual = snapshotTotal(item, "virtual");
    const actualChange = baselineActual ? ((actual - baselineActual) / baselineActual) * 100 : 0;
    const virtualChange = baselineVirtual ? ((virtual - baselineVirtual) / baselineVirtual) * 100 : 0;
    return `<tr><td>${escapeHtml(formatSnapshotDate(item.date))}${item.date.slice(0, 7) === today().slice(0, 7) ? `<span class="this-month-chip">이번 달</span>` : ""}</td><td>${money(actual, "KRW")}</td><td>${money(virtual, "KRW")}</td><td class="${actualChange >= 0 ? "snapshot-up" : "snapshot-down"}">${signed(actualChange)}%</td><td class="${virtualChange >= 0 ? "snapshot-up" : "snapshot-down"}">${signed(virtualChange)}%</td><td>₩${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(item.exchangeRate)}</td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="snapshot-empty">시작 기준점만 저장되어 있어요. 종목 가격을 직접 입력하고 이번 달 기록을 저장하면 변화가 여기에 쌓입니다.</div>`;
}

function formatSnapshotDate(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateText : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function renderSnapshotChart(points) {
  if (!points.length) return `<div class="snapshot-empty">시작 자산을 입력하면 비교 그래프가 표시됩니다.</div>`;
  if (points.length === 1) return `<div class="snapshot-chart-empty"><span class="chart-baseline-dot"></span><span>시작 기준점 · 다음 달 기록부터 자산 변화 그래프가 그려져요.</span></div>`;
  const width = 640;
  const height = 210;
  const left = 48;
  const right = 18;
  const top = 16;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = points.flatMap((point) => [point.actualChange, point.virtualChange]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const spread = maxValue - minValue || 1;
  const padding = spread * 0.16;
  const low = minValue - padding;
  const high = maxValue + padding;
  const x = (index) => left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => top + ((high - value) / (high - low)) * plotHeight;
  const actualLine = points.map((point, index) => `${x(index)},${y(point.actualChange)}`).join(" ");
  const virtualLine = points.map((point, index) => `${x(index)},${y(point.virtualChange)}`).join(" ");
  const grid = [0, 0.5, 1].map((fraction) => {
    const value = high - (high - low) * fraction;
    const gridY = top + plotHeight * fraction;
    return `<line x1="${left}" y1="${gridY}" x2="${width - right}" y2="${gridY}" class="chart-grid"/><text x="${left - 8}" y="${gridY + 3}" text-anchor="end" class="chart-axis-label">${signed(value)}%</text>`;
  }).join("");
  const labels = points.map((point, index) => index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2) ? `<text x="${x(index)}" y="${height - 10}" text-anchor="middle" class="chart-axis-label">${escapeHtml(point.baseline ? "시작" : point.date.slice(2, 7).replace("-", "/"))}</text>` : "").join("");
  const dots = points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.actualChange)}" r="3.5" class="chart-dot actual-dot"><title>실제 ${escapeHtml(formatSnapshotDate(point.date))}: ${signed(point.actualChange)}%</title></circle><circle cx="${x(index)}" cy="${y(point.virtualChange)}" r="3.5" class="chart-dot virtual-dot"><title>가상 ${escapeHtml(formatSnapshotDate(point.date))}: ${signed(point.virtualChange)}%</title></circle>`).join("");
  return `<div class="chart-legend"><span><i class="legend-dot actual"></i> 실제</span><span><i class="legend-dot virtual"></i> 가상</span><small>시작 자산 대비 원화 환산 변화율</small></div><svg class="snapshot-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="시작 시점부터 실제와 가상 포트폴리오의 자산 변화율 그래프">${grid}<polyline points="${actualLine}" class="chart-line actual-line"/><polyline points="${virtualLine}" class="chart-line virtual-line"/>${dots}${labels}</svg>`;
}

function saveMonthlySnapshot(overwrite = false) {
  const date = today();
  const month = date.slice(0, 7);
  const existingIndex = data.snapshots.findIndex((item) => !item.baseline && item.date.slice(0, 7) === month);
  if (existingIndex >= 0 && !overwrite) {
    const confirmation = document.getElementById("snapshot-confirm");
    confirmation.innerHTML = `<span>${month.replace("-", "년 ")}월 기록이 이미 있어요. 현재 가격으로 덮어쓸까요?</span><div><button class="button button-quiet" data-snapshot-action="cancel">취소</button><button class="button button-dark" data-snapshot-action="overwrite">이번 달 기록 업데이트</button></div>`;
    confirmation.classList.remove("hidden");
    return;
  }
  const snapshot = {
    id: `snapshot-${month}`,
    date,
    exchangeRate: data.exchangeRate,
    actual: { KRW: portfolioValue("actual", "KRW"), USD: portfolioValue("actual", "USD") },
    virtual: { KRW: portfolioValue("virtual", "KRW"), USD: portfolioValue("virtual", "USD") }
  };
  if (existingIndex >= 0) data.snapshots[existingIndex] = snapshot;
  else data.snapshots.push(snapshot);
  data.snapshots.sort((left, right) => left.date.localeCompare(right.date));
  document.getElementById("snapshot-confirm").classList.add("hidden");
  persist();
  render();
  showToast(existingIndex >= 0 ? "이번 달 자산 기록을 업데이트했어요." : "이번 달 자산을 기록했어요.");
}

function renderNews() {
  const list = document.getElementById("news-list");
  const search = newsSearch.trim().toLocaleLowerCase();
  const entries = data.news.filter((item) => {
    const matchesSearch = !search || [item.symbol, item.name, item.title, item.body, item.category].some((part) => String(part || "").toLocaleLowerCase().includes(search));
    return matchesSearch && (newsCategory === "all" || getNewsCategory(item) === newsCategory);
  }).sort((left, right) => {
    const leftDate = /^\d{4}-\d{2}-\d{2}$/.test(left.date || "") ? Date.parse(`${left.date}T12:00:00`) : 0;
    const rightDate = /^\d{4}-\d{2}-\d{2}$/.test(right.date || "") ? Date.parse(`${right.date}T12:00:00`) : 0;
    return rightDate - leftDate;
  });
  const importedCount = data.news.filter((item) => item.imported).length;
  document.getElementById("news-library-count").textContent = `${importedCount}개 가져옴 · 예시 포함`;
  const categories = [...new Set(data.news.map(getNewsCategory))].sort();
  const categorySelect = document.getElementById("news-category");
  categorySelect.innerHTML = `<option value="all">모든 분류</option>${categories.map((category) => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join("")}`;
  categorySelect.value = categories.includes(newsCategory) ? newsCategory : "all";
  const groups = new Map();
  for (const item of entries) {
    const key = item.symbol || item.name || "기타 소식";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  list.innerHTML = [...groups.entries()].map(([key, items]) => {
    const first = items[0];
    return `<details class="stock-library-group"><summary><span class="stock-library-symbol">${escapeHtml((first.symbol || first.name || "소식").slice(0, 5))}</span><span class="stock-library-info"><strong>${escapeHtml(first.name || "종목 소식")}</strong><small>${escapeHtml(first.symbol || "종목 코드 미지정")}</small></span><span class="stock-library-count">${items.length}개 요약</span><span class="stock-library-chevron" aria-hidden="true">⌄</span></summary><div class="stock-library-documents">${items.map((item) => `<details class="news-entry"><summary><span class="news-entry-heading"><strong>${escapeHtml(item.title)}</strong><span class="news-meta"><span class="news-category">${escapeHtml(getNewsCategory(item))}</span><time>${escapeHtml(item.date || "날짜 미지정")}</time></span></span><span class="news-caption">${escapeHtml(item.source || (item.imported ? item.fileName || "가져온 문서" : "직접 입력한 예시"))}</span></summary><div class="news-document"><pre>${escapeHtml(item.body || "내용이 비어 있어요.")}</pre>${item.url ? `<p class="news-source-url">문서에 적힌 링크: ${escapeHtml(item.url)}</p>` : ""}</div></details>`).join("")}</div></details>`;
  }).join("") || `<div class="journal-empty">검색 결과가 없어요. 다른 종목이나 분류를 선택해 보세요.</div>`;
}

function getNewsCategory(item) {
  return item.category || (item.imported ? "기타" : item.source === "내가 작성" ? "직접 메모" : "예시");
}

function getNewsId(item) {
  return item.id || item.originId || `news:${item.symbol || ""}:${item.date || ""}:${item.title || ""}:${item.source || ""}`;
}

function addNewsImportControls() {
  const list = document.getElementById("news-list");
  const countBadge = document.querySelector(".news-card .demo-badge");
  countBadge.id = "news-library-count";
  const controls = document.createElement("div");
  controls.className = "news-library-controls";
  controls.innerHTML = `<div class="news-import-tabs" role="tablist" aria-label="뉴스 가져오기 방식"><button class="news-mode active" id="manual-mode" role="tab" aria-selected="true">수동 모드</button><button class="news-mode" id="automatic-mode" role="tab" aria-selected="false">자동 모드</button></div>
    <div class="news-import-panel" id="manual-panel"><div class="mode-intro"><strong>요약을 직접 작성하거나, 저장된 문서 폴더를 필요할 때 불러와요.</strong><span>크론잡 없이 쓸 수 있고, 폴더 불러오기는 버튼을 눌렀을 때만 실행돼요.</span></div><div class="manual-actions"><label class="button button-dark import-button" for="news-folder-input">문서 폴더 불러오기<input id="news-folder-input" type="file" webkitdirectory directory multiple accept=".md,.markdown,.txt,text/plain"></label></div><span class="import-status" id="manual-status">뉴스요약/종목이름/날짜_종목이름_요약.md · 폴더 전체를 한 번에 읽어요.</span><details class="setup-guide"><summary>수동 모드 문서 규격 보기</summary>${newsDocumentGuide()}</details></div>
    <div class="news-import-panel hidden" id="automatic-panel"><div class="mode-intro"><strong>크론잡이 저장한 문서를 선택한 폴더에서 자동으로 찾아요.</strong><span>표준 문서 구조를 사용하고, 이 탭이 열려 있는 동안 20초마다 변경을 확인해요.</span></div><div class="auto-actions"><button class="button button-dark" id="choose-news-folder">뉴스 폴더 연결</button><button class="button button-outline" id="scan-news-folder" disabled>지금 확인</button></div><span class="import-status" id="automatic-status">연결할 뉴스요약 폴더를 선택해 주세요.</span><details class="setup-guide"><summary>자동 모드 설정 가이드</summary><p>크론잡의 출력 폴더를 아래처럼 정해두면 종목별로 자동 정리돼요.</p><pre>뉴스요약/\n├─ NVIDIA/\n│  └─ 2026-11-20_NVIDIA_요약.md\n└─ 삼성전자/\n   └─ 2026-11-20_삼성전자_요약.md</pre>${newsDocumentGuide()}</details></div>
    <div class="library-tools"><label class="search-field"><span aria-hidden="true">⌕</span><input id="news-search" type="search" placeholder="종목, 제목, 내용 검색" aria-label="종목 소식 검색"></label><select id="news-category" aria-label="분류 필터"><option value="all">모든 분류</option></select></div>`;
  list.before(controls);
  document.getElementById("manual-mode").addEventListener("click", () => setNewsMode("manual"));
  document.getElementById("automatic-mode").addEventListener("click", () => setNewsMode("automatic"));
  document.getElementById("news-folder-input").addEventListener("change", (event) => {
    const files = [...event.target.files].map((file) => ({ file, path: file.webkitRelativePath }));
    importNewsFiles(files, "manual");
    event.target.value = "";
  });
  document.getElementById("news-search").addEventListener("input", (event) => { newsSearch = event.target.value; renderNews(); });
  document.getElementById("news-category").addEventListener("change", (event) => { newsCategory = event.target.value; renderNews(); });
  document.getElementById("choose-news-folder").addEventListener("click", chooseNewsFolder);
  document.getElementById("scan-news-folder").addEventListener("click", resumeNewsFolder);
  renderNews();
}

function newsDocumentGuide() {
  return `<ol><li>문서를 <code>뉴스요약/종목이름/날짜_종목이름_요약.md</code> 경로에 저장해요.</li><li>앞부분의 메타정보에 종목 코드·이름·날짜·분류·출처를 적어요.</li><li>요약은 제목을 <code># 한눈에 보기</code>로 시작하고, 아래에 핵심 내용을 써요.</li></ol><pre>---\nsymbol: NVDA\nname: NVIDIA\ndate: 2026-11-20\ncategory: 실적\nsource: 뉴스 출처\n---\n\n# 한눈에 보기\n요약 내용을 여기에 작성해요.\n\n# 주요 내용\n- 핵심 사실과 수치\n\n# 확인할 점\n- 다음 실적 발표 일정</pre><p>지원 형식은 MD, Markdown, TXT예요. 문서당 250KB, 최대 60개까지 읽으며 내용은 브라우저에만 저장해요. Markdown이나 링크는 실행하지 않고 글자로 표시합니다.</p>`;
}

function setNewsMode(mode) {
  document.getElementById("manual-mode").classList.toggle("active", mode === "manual");
  document.getElementById("automatic-mode").classList.toggle("active", mode === "automatic");
  document.getElementById("manual-mode").setAttribute("aria-selected", String(mode === "manual"));
  document.getElementById("automatic-mode").setAttribute("aria-selected", String(mode === "automatic"));
  document.getElementById("manual-panel").classList.toggle("hidden", mode !== "manual");
  document.getElementById("automatic-panel").classList.toggle("hidden", mode !== "automatic");
  if (mode === "manual") clearInterval(newsSyncTimer);
  if (mode === "automatic") {
    if (!window.showDirectoryPicker) setAutomaticStatus("이 브라우저에서는 자동 폴더 읽기를 지원하지 않아요. 수동 모드의 문서 폴더 불러오기를 이용해 주세요.");
    else if (newsDirectoryHandle) resumeNewsFolder();
  }
}

function setAutomaticStatus(message) {
  const status = document.getElementById("automatic-status");
  if (status) status.textContent = message;
}

function openDirectoryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pocketfolio-news", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveNewsFolderHandle(handle) {
  const db = await openDirectoryDatabase();
  await new Promise((resolve, reject) => {
    const request = db.transaction("handles", "readwrite").objectStore("handles").put(handle, "news-folder");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function loadNewsFolderHandle() {
  const db = await openDirectoryDatabase();
  const handle = await new Promise((resolve, reject) => {
    const request = db.transaction("handles").objectStore("handles").get("news-folder");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

async function chooseNewsFolder() {
  if (!window.showDirectoryPicker) {
    setAutomaticStatus("자동 폴더 읽기는 지원되지 않는 브라우저예요. 수동 가져오기를 선택해 주세요.");
    return;
  }
  try {
    newsDirectoryHandle = await window.showDirectoryPicker({ mode: "read" });
    await saveNewsFolderHandle(newsDirectoryHandle);
    const permission = await newsDirectoryHandle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      setAutomaticStatus("폴더 읽기 권한이 허용되지 않았어요. 권한을 허용하거나 수동 가져오기를 이용해 주세요.");
      return;
    }
    document.getElementById("scan-news-folder").disabled = false;
    await scanNewsFolder(true);
    clearInterval(newsSyncTimer);
    newsSyncTimer = setInterval(() => scanNewsFolder(false), 20000);
  } catch (error) {
    if (error.name === "AbortError") setAutomaticStatus("폴더 선택을 취소했어요. 테스트하려면 ‘뉴스 폴더 연결’을 다시 눌러 압축을 푼 뉴스요약 폴더를 선택해 주세요.");
    else setAutomaticStatus("폴더를 열지 못했어요. 브라우저 권한을 확인하거나 수동 모드에서 문서 폴더를 불러와 주세요.");
  }
}

async function scanNewsFolder(showResult) {
  if (!newsDirectoryHandle) return;
  try {
    const permission = await newsDirectoryHandle.queryPermission({ mode: "read" });
    if (permission !== "granted") {
      document.getElementById("scan-news-folder").disabled = false;
      setAutomaticStatus("폴더 권한이 필요해요. ‘지금 확인’을 눌러 권한을 다시 허용해 주세요.");
      return;
    }
    const files = [];
    await collectNewsFiles(newsDirectoryHandle, newsDirectoryHandle.name, 0, files);
    const imported = await importNewsFiles(files, "automatic", false);
    if (showResult || imported) setAutomaticStatus(`${newsDirectoryHandle.name} 폴더 확인 완료 · ${files.length}개 파일 중 ${imported}개 새로 읽음`);
  } catch (error) {
    setAutomaticStatus("폴더를 읽지 못했어요. 권한을 다시 확인해 주세요.");
  }
}

async function resumeNewsFolder() {
  if (!newsDirectoryHandle) return chooseNewsFolder();
  try {
    const permission = await newsDirectoryHandle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      setAutomaticStatus("폴더 읽기 권한이 허용되지 않았어요. 폴더를 다시 선택하거나 수동 가져오기를 이용해 주세요.");
      return;
    }
    await scanNewsFolder(true);
    clearInterval(newsSyncTimer);
    newsSyncTimer = setInterval(() => scanNewsFolder(false), 20000);
  } catch (error) {
    setAutomaticStatus("폴더를 확인하지 못했어요. 다시 선택하거나 수동 가져오기를 이용해 주세요.");
  }
}

async function collectNewsFiles(directory, prefix, depth, files) {
  if (depth > 4 || files.length >= 200) return;
  for await (const [name, handle] of directory.entries()) {
    if (name.startsWith(".")) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") await collectNewsFiles(handle, path, depth + 1, files);
    else if (/\.(md|markdown|txt)$/i.test(name)) files.push({ file: await handle.getFile(), path });
    if (files.length >= 200) break;
  }
}

async function importNewsFiles(fileEntries, mode, showResult = true) {
  let imported = 0;
  let rejected = 0;
  for (const entry of fileEntries) {
    const file = entry.file || entry;
    const path = entry.path || file.webkitRelativePath || file.name;
    if (!/\.(md|markdown|txt)$/i.test(file.name) || file.size > 250 * 1024) {
      rejected++;
      continue;
    }
    const originId = `file:${path}`;
    const index = data.news.findIndex((existing) => existing.originId === originId);
    if (index >= 0 && data.news[index].lastModified === file.lastModified && data.news[index].fileSize === file.size) continue;
    if (index < 0 && data.news.filter((existing) => existing.imported).length >= 60) {
      rejected++;
      continue;
    }
    try {
      const text = await file.text();
      const item = parseNewsDocument(text, file.name, path);
      item.lastModified = file.lastModified;
      if (index >= 0) {
        data.news[index] = item;
      } else data.news.unshift(item);
      imported++;
    } catch (error) {
      rejected++;
    }
  }
  if (imported) {
    persist();
    renderNews();
  }
  const status = mode === "manual" ? document.getElementById("manual-status") : document.getElementById("automatic-status");
  if (mode === "manual" && showResult) status.textContent = `${imported}개 파일을 읽었어요${rejected ? ` · ${rejected}개는 형식이나 크기를 확인해 주세요` : ""}`;
  if (showResult && imported) showToast(`${imported}개 소식 문서를 서재에 추가했어요.`);
  if (rejected && mode === "automatic") setAutomaticStatus(`가져온 문서 ${imported}개 · 형식 또는 크기 제한으로 건너뜀 ${rejected}개`);
  return imported;
}

function parseNewsDocument(text, fileName, path) {
  let content = text.replace(/^\uFEFF/, "");
  const metadata = {};
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (frontmatter) {
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const match = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
      if (match && ["symbol", "name", "date", "category", "source", "title", "url"].includes(match[1])) metadata[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
    content = content.slice(frontmatter[0].length);
  }
  const heading = content.match(/^\s*#\s+(.+)$/m);
  const pathParts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const stockFolder = pathParts.length > 2 ? pathParts[pathParts.length - 2] : "";
  const dateMatch = fileName.match(/20\d{2}[-_]?\d{2}[-_]?\d{2}/)?.[0];
  const normalizedDate = metadata.date || (dateMatch ? dateMatch.replaceAll("_", "-").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : "날짜 미지정");
  const nameFromFile = fileName.replace(/\.(md|markdown|txt)$/i, "").replace(/20\d{2}[-_]?\d{2}[-_]?\d{2}[_-]?/g, "").replace(/(종목뉴스|요약파일|요약|summary|news)/gi, "").replace(/[_-]+/g, " ").trim();
  const inferredPosition = data.positions.find((item) => [nameFromFile, stockFolder].some((name) => name && (name.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()) || name.toUpperCase().includes(item.symbol))));
  const symbol = (metadata.symbol || stockFolder.match(/\b[A-Z]{1,5}\b/)?.[0] || nameFromFile.match(/\b[A-Z]{1,5}\b/)?.[0] || inferredPosition?.symbol || "").toUpperCase();
  const position = data.positions.find((item) => item.symbol === symbol);
  const name = metadata.name || position?.name || inferredPosition?.name || stockFolder || nameFromFile || "종목 소식";
  const usefulHeading = heading && !/^(한눈에 보기|요약|뉴스 요약|주요 내용)$/i.test(heading[1].trim()) ? heading[1].trim() : "";
  const safeContent = content.trim().slice(0, 8000);
  return {
    imported: true,
    originId: `file:${path}`,
    fileName,
    fileSize: new Blob([text]).size,
    lastModified: 0,
    symbol,
    name,
    date: normalizedDate,
    category: metadata.category || "기타",
    source: metadata.source || `가져온 파일 · ${fileName}`,
    title: metadata.title || usefulHeading || `${name} · ${normalizedDate} 요약`,
    body: safeContent,
    url: metadata.url || ""
  };
}

async function restoreNewsFolder() {
  if (!window.showDirectoryPicker || !window.indexedDB) return;
  try {
    newsDirectoryHandle = await loadNewsFolderHandle();
    if (!newsDirectoryHandle) return;
    if (await newsDirectoryHandle.queryPermission({ mode: "read" }) !== "granted") {
      setAutomaticStatus("저장된 폴더 권한이 만료됐어요. ‘지금 확인’을 눌러 다시 허용해 주세요.");
      document.getElementById("scan-news-folder").disabled = false;
      return;
    }
    document.getElementById("scan-news-folder").disabled = false;
    setAutomaticStatus(`${newsDirectoryHandle.name} 폴더 연결됨 · 이 탭을 열어둔 동안 20초마다 확인`);
  } catch (error) {
    newsDirectoryHandle = null;
  }
}

function renderJournal() {
  const list = document.getElementById("journal-list");
  document.getElementById("journal-count").textContent = `${data.journal.length}개`;
  const latestTrade = data.trades[0];
  const undoArea = document.getElementById("undo-trade-area");
  if (!latestTrade) {
    undoConfirmId = null;
    undoArea.innerHTML = "";
  } else if (undoConfirmId === latestTrade.id) {
    undoArea.innerHTML = `<div class="undo-confirm" role="status"><span>최근 가상 거래 ‘${escapeHtml(latestTrade.title)}’를 되돌릴까요?</span><div><button class="button button-quiet" data-undo-action="cancel">취소</button><button class="button undo-accept" data-undo-action="confirm" ${latestTrade.undoState ? "" : "disabled"}>거래 되돌리기</button></div></div>`;
  } else {
    undoArea.innerHTML = `<div class="undo-latest"><span>${latestTrade.undoState ? `최근 가상 거래: ${escapeHtml(latestTrade.title)}` : "이전 버전 거래는 되돌릴 수 없어요."}</span><button class="undo-link" data-undo-action="request" ${latestTrade.undoState ? "" : "disabled"}>되돌리기</button></div>`;
  }
  list.innerHTML = data.journal.slice(0, 4).map((item) => {
    const date = new Date(`${item.date}T12:00:00`);
    const dateLabel = Number.isNaN(date.getTime()) ? "기록" : `${date.getMonth() + 1}/${date.getDate()}`;
    const linkedNews = data.news.find((news) => getNewsId(news) === item.relatedNewsId);
    const linkedNewsMarkup = linkedNews ? `<details class="journal-linked-news"><summary>참고한 소식: ${escapeHtml(linkedNews.title)}</summary><div><span>${escapeHtml(linkedNews.name || linkedNews.symbol || "종목 소식")} · ${escapeHtml(linkedNews.date || "날짜 미지정")} · ${escapeHtml(getNewsCategory(linkedNews))}</span><p>${escapeHtml(linkedNews.body || "요약 내용이 비어 있어요.")}</p></div></details>` : "";
    return `<article class="journal-item"><div class="journal-date">${dateLabel}<br>기록</div><div class="journal-content"><div class="journal-title">${escapeHtml(item.title)}</div><div class="journal-text">${escapeHtml(item.text)}</div><span class="journal-tag">${escapeHtml(item.tag || (item.symbol ? item.symbol : "메모"))}</span>${linkedNewsMarkup}</div></article>`;
  }).join("") || `<div class="journal-empty">첫 투자 기록을 남겨보세요.</div>`;
}

function undoLatestTrade() {
  const trade = data.trades[0];
  if (!trade?.undoState || trade.id !== undoConfirmId) return;
  data.virtualCash = { ...trade.undoState.cash };
  data.positions = [
    ...data.positions.filter((item) => item.mode !== "virtual"),
    ...structuredClone(trade.undoState.positions)
  ];
  data.trades.shift();
  data.journal = data.journal.filter((item) => item.tradeId !== trade.id);
  undoConfirmId = null;
  persist();
  render();
  showToast("가장 최근 가상 거래를 되돌렸어요.");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function field(label, name, type = "text", options = {}) {
  const id = options.id || name;
  const hint = options.hint ? `<span class="field-hint">${options.hint}</span>` : "";
  if (options.select) return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${name}" ${options.required === false ? "" : "required"}>${options.select.map(([value, title]) => `<option value="${value}">${title}</option>`).join("")}</select>${hint}</div>`;
  if (type === "textarea") return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" name="${name}" ${options.required === false ? "" : "required"} placeholder="${options.placeholder || ""}"></textarea>${hint}</div>`;
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${name}" type="${type}" ${options.required === false ? "" : "required"} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.step ? `step="${options.step}"` : ""} placeholder="${options.placeholder || ""}" value="${options.value ?? ""}">${hint}</div>`;
}

function openModal(mode, values = {}) {
  modalMode = mode;
  const title = { account: "실제 자산과 시작점 입력", trade: "가상 매매", price: "현재가 수정", news: "종목 소식 메모", note: "투자 기록 남기기" }[mode];
  const fields = document.getElementById("modal-fields");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-kicker").textContent = mode === "trade" ? "PRACTICE TRADE" : mode === "account" ? "PORTFOLIO SETUP" : mode === "news" ? "NEWS NOTES" : "MY JOURNAL";
  document.getElementById("modal-submit").textContent = mode === "trade" ? "가상 매수 실행" : mode === "price" ? "현재가 저장" : mode === "account" ? "같은 출발점으로 시작" : "기록 저장하기";
  if (mode === "account") {
    fields.innerHTML = `<p class="setup-lead">실제 계좌의 예수금과 보유 종목을 입력하면, 가상 포트폴리오도 같은 구성과 금액으로 시작해요.</p><div class="form-grid">${field("원화 예수금 (KRW)", "cashKRW", "number", { min: 0, step: "any", value: data.actualCash.KRW })}${field("달러 예수금 (USD)", "cashUSD", "number", { min: 0, step: "any", value: data.actualCash.USD })}</div><div class="setup-holdings-heading"><div><strong>실제 보유 종목</strong><span>수량 × 현재가로 평가금액을 계산해요.</span></div><button type="button" class="button button-outline" id="add-setup-holding">+ 종목 추가</button></div><div class="setup-holdings-list" id="setup-holdings-list">${data.positions.filter((item) => item.mode === "actual").map((item) => setupHoldingRow(item)).join("")}</div><label class="reset-practice-check"><input type="checkbox" name="resetVirtual" required><span>저장하면 가상 포트폴리오를 위 실제 자산과 같은 출발점으로 다시 맞춥니다. 기존 가상 거래와 구성이 초기화됩니다.</span></label><div class="form-help">시작 자산은 예수금과 입력한 모든 종목의 현재 평가금액을 더해 자동 계산합니다. 이 금액이 월별 자산 변화의 기준점이 됩니다.</div>`;
    document.getElementById("add-setup-holding").addEventListener("click", () => {
      document.getElementById("setup-holdings-list").insertAdjacentHTML("beforeend", setupHoldingRow());
    });
    document.getElementById("setup-holdings-list").addEventListener("click", (event) => {
      if (event.target.closest(".remove-setup-holding")) event.target.closest(".setup-holding-row").remove();
    });
  } else if (mode === "trade") {
    fields.innerHTML = `<div class="field"><label>거래 종류</label><div class="trade-toggle"><label><input type="radio" name="side" value="buy" checked><span>가상 매수</span></label><label><input type="radio" name="side" value="sell"><span>가상 매도</span></label></div></div>${field("보유 종목 선택", "stock", "text", { select: [["", "종목을 선택해 주세요"]] })}<div class="trade-stock-hint" id="trade-stock-hint">종목을 선택하면 통화, 현재가, 가상 보유 수량을 보여드려요.</div><div class="form-grid">${field("수량 (주)", "qty", "number", { min: 0.000001, step: "any", placeholder: "1" })}${field("주당 거래 가격", "price", "number", { min: 0.000001, step: "any", placeholder: "종목 선택 후 자동 입력" })}</div>${field("참고한 종목 소식 (선택)", "relatedNewsId", "text", { select: [["", "소식 연결 안 함 (선택 사항)"]], required: false })}<div class="related-news-hint" id="related-news-hint">소식 연결 없이도 거래할 수 있어요. 연결한 소식은 거래 기록에 함께 저장됩니다.</div>${field("이 거래를 고민한 이유", "reason", "textarea", { placeholder: "예: 어떤 정보나 생각을 바탕으로 결정했나요?" })}<div class="form-help">거래 금액만큼 예수금과 보유 평가액이 서로 이동하므로, 참고 현재가와 같은 가격으로 거래하면 총자산은 유지돼요. 이후 현재가를 수정하면 자산과 수익률이 변합니다.</div>`;
    updateTradeStockOptions(fields);
    updateRelatedNewsOptions(fields);
    fields.addEventListener("change", (event) => {
      if (event.target.name === "side") {
        updateTradeStockOptions(fields);
        updateRelatedNewsOptions(fields);
        document.getElementById("modal-submit").textContent = event.target.value === "buy" ? "가상 매수 실행" : "가상 매도 실행";
      }
      if (event.target.name === "stock") {
        const [currency, symbol] = event.target.value.split(":");
        const stock = data.positions.find((item) => item.currency === currency && item.symbol === symbol);
        fields.querySelector('[name="price"]').value = stock?.price ?? "";
        updateTradeStockHint(fields);
        updateRelatedNewsOptions(fields);
      }
      if (event.target.name === "relatedNewsId") updateRelatedNewsHint(fields);
      if (event.target.name === "qty" || event.target.name === "price") updateTradeStockHint(fields);
    });
  } else if (mode === "price") {
    fields.innerHTML = `<input type="hidden" name="symbol" value="${escapeAttr(values.symbol)}"><input type="hidden" name="currency" value="${escapeAttr(values.currency)}"><div class="form-help">${escapeHtml(values.name)} (${escapeHtml(values.symbol)})의 참고 가격을 수정해요. 입력한 가격은 실제 시세가 아닙니다.</div>${field(`현재가 (${values.currency})`, "price", "number", { min: 0.000001, step: "any", value: values.price })}`;
  } else if (mode === "news") {
    const stockOptions = [["", "종목 선택 (선택 사항)"], ...[...new Map(data.positions.map((item) => [item.symbol, [item.symbol, `${item.name} (${item.symbol})`]])).values()]];
    const categoryOptions = ["실적", "제품·사업", "산업·시장", "규제·정책", "기타"].map((category) => [category, category]);
    fields.innerHTML = `<div class="form-grid">${field("관련 종목", "symbol", "text", { select: stockOptions, required: false })}${field("분류", "category", "text", { select: categoryOptions })}</div><div class="form-grid">${field("요약 날짜", "date", "date", { value: today() })}${field("출처", "source", "text", { required: false, placeholder: "기사나 뉴스레터 이름" })}</div>${field("소식 제목", "title", "text", { placeholder: "핵심 내용을 한 줄로 적어주세요" })}${field("뉴스 요약", "body", "textarea", { placeholder: "무슨 일이 있었나요? 투자자가 알아둘 점과 출처를 적어보세요." })}`;
  } else {
    const stockOptions = [["", "종목 선택 (선택 사항)"], ...[...new Map(data.positions.map((item) => [item.symbol, [item.symbol, `${item.name} (${item.symbol})`]])).values()]];
    fields.innerHTML = `${field("기록 제목", "title", "text", { placeholder: "오늘의 매매 생각이나 배운 점" })}${field("관련 종목", "symbol", "text", { select: stockOptions, required: false })}${field("나의 생각", "text", "textarea", { placeholder: "왜 이런 선택을 했나요? 나중의 나에게 남길 말을 써보세요." })}`;
  }
  document.getElementById("modal-backdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  fields.querySelector("input, select, textarea")?.focus();
}

function setupHoldingRow(item = {}) {
  const rowId = `setup-holding-${++setupHoldingRowSequence}`;
  const currencies = [["KRW", "원화 · KRW"], ["USD", "달러 · USD"]];
  return `<div class="setup-holding-row"><div class="setup-row-fields">${field("종목명", "holdingName", "text", { id: `${rowId}-name`, required: false, placeholder: "예: 삼성전자", value: item.name || "" })}${field("종목 코드", "holdingSymbol", "text", { id: `${rowId}-symbol`, required: false, placeholder: "예: 005930", value: item.symbol || "" })}<div class="field"><label for="${rowId}-currency">통화</label><select id="${rowId}-currency" name="holdingCurrency">${currencies.map(([value, title]) => `<option value="${value}" ${value === (item.currency || "KRW") ? "selected" : ""}>${title}</option>`).join("")}</select></div>${field("수량 (주)", "holdingQty", "number", { id: `${rowId}-qty`, required: false, min: 0.000001, step: "any", placeholder: "0", value: item.qty ?? "" })}${field("현재가", "holdingPrice", "number", { id: `${rowId}-price`, required: false, min: 0.000001, step: "any", placeholder: "0", value: item.price ?? "" })}</div><button type="button" class="remove-setup-holding" aria-label="종목 삭제">삭제</button></div>`;
}

function getTradeStockList(side) {
  const unique = new Map();
  for (const item of data.positions) {
    if (item.mode === "virtual" && item.qty > 0) unique.set(`${item.currency}:${item.symbol}`, item);
    if (side === "buy" && item.mode === "actual") unique.set(`${item.currency}:${item.symbol}`, item);
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

function updateTradeStockOptions(fields) {
  const side = fields.querySelector('[name="side"]:checked').value;
  const select = fields.querySelector('[name="stock"]');
  const previous = select.value;
  const stocks = getTradeStockList(side);
  select.innerHTML = `<option value="">${stocks.length ? "종목을 선택해 주세요" : side === "sell" ? "매도할 가상 보유 종목이 없어요" : "먼저 실제 보유 종목을 입력해 주세요"}</option>${stocks.map((item) => {
    const key = `${item.currency}:${item.symbol}`;
    const virtual = data.positions.find((position) => position.mode === "virtual" && `${position.currency}:${position.symbol}` === key);
    const suffix = side === "sell" ? ` · 가상 보유 ${virtual?.qty || 0}주` : ` · ${money(item.price, item.currency)}`;
    return `<option value="${escapeAttr(key)}">${escapeHtml(item.name)} (${escapeHtml(item.symbol)})${escapeHtml(suffix)}</option>`;
  }).join("")}`;
  select.value = stocks.some((item) => `${item.currency}:${item.symbol}` === previous) ? previous : "";
  if (select.value) updateTradeStockHint(fields);
  else document.getElementById("trade-stock-hint").textContent = side === "sell" ? "매도할 수 있는 가상 보유 종목이 없어요." : "실제 포트폴리오에 등록된 종목 중에서 선택해 주세요.";
}

function updateTradeStockHint(fields) {
  const stockKey = fields.querySelector('[name="stock"]').value;
  const side = fields.querySelector('[name="side"]:checked').value;
  const hint = document.getElementById("trade-stock-hint");
  const stock = getTradeStockList(side).find((item) => `${item.currency}:${item.symbol}` === stockKey);
  if (!stock) {
    hint.textContent = "종목을 선택하면 통화, 현재가, 가상 보유 수량을 보여드려요.";
    return;
  }
  const virtual = data.positions.find((item) => item.mode === "virtual" && `${item.currency}:${item.symbol}` === stockKey);
  const qty = Number(fields.querySelector('[name="qty"]').value || 0);
  const price = Number(fields.querySelector('[name="price"]').value || stock.price);
  const amount = qty * price;
  const cash = data.virtualCash[stock.currency] || 0;
  const valuationChange = side === "buy" ? (stock.price - price) * qty : (price - stock.price) * qty;
  const balance = side === "buy" ? `예수금 ${money(cash, stock.currency)}${qty ? ` · 거래 금액 ${money(amount, stock.currency)} · 참고가 평가 변화 ${valuationChange >= 0 ? "+" : "−"}${money(Math.abs(valuationChange), stock.currency)}${amount > cash ? " · 예수금 부족" : ""}` : ""}` : `가상 보유 ${virtual?.qty || 0}주${qty ? ` · 매도 후 예수금 ${money(cash + amount, stock.currency)} · 참고가 대비 실현 차이 ${valuationChange >= 0 ? "+" : "−"}${money(Math.abs(valuationChange), stock.currency)}${qty > (virtual?.qty || 0) ? " · 보유 수량 부족" : ""}` : ""}`;
  hint.textContent = `${stock.name} (${stock.symbol}) · ${stock.currency} · 참고 현재가 ${money(stock.price, stock.currency)} · ${balance}`;
  fields.querySelector('[name="price"]').placeholder = String(stock.price);
}

function updateRelatedNewsOptions(fields) {
  const select = fields.querySelector('[name="relatedNewsId"]');
  if (!select) return;
  const stockKey = fields.querySelector('[name="stock"]').value;
  const [, symbol = ""] = stockKey.split(":");
  const previous = select.value;
  const options = data.news
    .filter((item) => !symbol || !item.symbol || item.symbol === symbol)
    .slice()
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  select.innerHTML = `<option value="">${options.length ? "연결할 소식 선택 (선택 사항)" : "관련 종목 소식이 없어요"}</option>${options.map((item) => `<option value="${escapeAttr(getNewsId(item))}">${escapeHtml(item.date || "날짜 미지정")} · ${escapeHtml(item.title)}</option>`).join("")}`;
  select.value = options.some((item) => getNewsId(item) === previous) ? previous : "";
  updateRelatedNewsHint(fields);
}

function updateRelatedNewsHint(fields) {
  const selectedId = fields.querySelector('[name="relatedNewsId"]').value;
  const news = data.news.find((item) => getNewsId(item) === selectedId);
  document.getElementById("related-news-hint").textContent = news
    ? `${news.name || news.symbol || "종목 소식"} · ${news.date || "날짜 미지정"} · ${getNewsCategory(news)} 소식을 거래 이유와 함께 기록합니다.`
    : "선택한 소식은 거래 기록에 함께 저장돼요.";
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.body.style.overflow = "";
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function handleSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const value = Object.fromEntries(form.entries());
  if (modalMode === "account") {
    const cash = { KRW: Number(value.cashKRW), USD: Number(value.cashUSD) };
    if (Object.values(cash).some((amount) => !Number.isFinite(amount) || amount < 0)) return showToast("예수금은 0 이상으로 입력해 주세요.", true);
    const rows = [...document.querySelectorAll(".setup-holding-row")];
    const actualPositions = [];
    const seen = new Set();
    for (const row of rows) {
      const name = row.querySelector('[name="holdingName"]').value.trim();
      const symbol = row.querySelector('[name="holdingSymbol"]').value.trim().toUpperCase();
      const currency = row.querySelector('[name="holdingCurrency"]').value;
      const qty = Number(row.querySelector('[name="holdingQty"]').value);
      const price = Number(row.querySelector('[name="holdingPrice"]').value);
      if (![name, symbol, row.querySelector('[name="holdingQty"]').value, row.querySelector('[name="holdingPrice"]').value].some((part) => part.trim())) continue;
      if (!name || !symbol || !Number.isFinite(qty * price) || qty <= 0 || price <= 0) return showToast("각 종목의 이름, 코드, 수량, 현재가를 확인해 주세요.", true);
      const key = `${currency}:${symbol}`;
      if (seen.has(key)) return showToast("같은 종목은 한 줄에 한 번만 입력해 주세요.", true);
      seen.add(key);
      actualPositions.push({ id: crypto.randomUUID(), mode: "actual", symbol, name, currency, qty, avgPrice: price, price });
    }
    data.actualCash = { ...cash };
    data.virtualCash = { ...cash };
    data.positions = [
      ...actualPositions,
      ...actualPositions.map((item) => ({ ...item, id: crypto.randomUUID(), mode: "virtual" }))
    ];
    const startingAssets = { KRW: cash.KRW, USD: cash.USD };
    actualPositions.forEach((item) => { startingAssets[item.currency] += item.qty * item.price; });
    data.initialAssets = { actual: { ...startingAssets }, virtual: { ...startingAssets } };
    data.comparisonStartDate = today();
    data.snapshots = [createBaselineSnapshot(data)];
    data.trades = [];
    data.journal = data.journal.filter((item) => !["가상 매수", "가상 매도"].includes(item.tag));
  } else if (modalMode === "trade") {
    const qty = Number(value.qty);
    const price = Number(value.price);
    const [currency, symbol] = String(value.stock || "").split(":");
    const stock = data.positions.find((item) => item.mode === "actual" && item.currency === currency && item.symbol === symbol)
      || data.positions.find((item) => item.mode === "virtual" && item.currency === currency && item.symbol === symbol);
    if (!stock) return showToast("거래할 종목을 목록에서 선택해 주세요.", true);
    if (!Number.isFinite(qty * price) || qty <= 0 || price <= 0) return showToast("수량과 가격을 확인해 주세요.", true);
    const existing = data.positions.find((item) => item.mode === "virtual" && item.symbol === symbol && item.currency === currency);
    const cash = data.virtualCash[currency] || 0;
    const total = qty * price;
    const undoState = {
      cash: { ...data.virtualCash },
      positions: structuredClone(data.positions.filter((item) => item.mode === "virtual"))
    };
    if (value.side === "buy") {
      if (cash + 1e-9 < total) return showToast(`예수금이 부족해요. 현재 ${money(cash, currency)}까지 매수할 수 있어요.`, true);
      data.virtualCash[currency] = Math.max(0, cash - total);
      if (existing) {
        existing.avgPrice = ((existing.avgPrice * existing.qty) + total) / (existing.qty + qty);
        existing.qty += qty;
      } else {
        data.positions.push({ id: crypto.randomUUID(), mode: "virtual", symbol, name: stock.name, currency, qty, avgPrice: price, price: stock.price });
      }
    } else {
      if (!existing || existing.qty < qty) return showToast("가상 계좌의 보유 수량을 확인해 주세요.", true);
      existing.qty -= qty;
      data.virtualCash[currency] = cash + total;
      if (!existing.qty) data.positions = data.positions.filter((item) => item !== existing);
    }
    const tradeId = crypto.randomUUID();
    const referenceChange = value.side === "buy" ? (stock.price - price) * qty : (price - stock.price) * qty;
    const relatedNewsId = value.relatedNewsId || "";
    data.trades.unshift({ id: tradeId, tradeId, relatedNewsId, title: `${stock.name} 가상 ${value.side === "buy" ? "매수" : "매도"}`, text: `${qty}주를 ${money(price, currency)}에 ${value.side === "buy" ? "매수" : "매도"}했어요. 참고 현재가 ${money(stock.price, currency)} 기준 평가 차이 ${referenceChange >= 0 ? "+" : "−"}${money(Math.abs(referenceChange), currency)}. ${value.reason.trim()}`, symbol, date: today(), tag: value.side === "buy" ? "가상 매수" : "가상 매도", undoState });
    data.journal.unshift(data.trades[0]);
  } else if (modalMode === "price") {
    data.positions.filter((item) => item.symbol === value.symbol && item.currency === value.currency).forEach((item) => { item.price = Number(value.price); });
  } else if (modalMode === "news") {
    const stock = data.positions.find((item) => item.symbol === value.symbol);
    data.news.unshift({ symbol: value.symbol || "", name: stock?.name || "종목 메모", title: value.title.trim(), body: value.body.trim(), date: value.date || today(), category: value.category, source: value.source.trim() || "직접 작성", imported: false });
  } else if (modalMode === "note") {
    const stock = data.positions.find((item) => item.symbol === value.symbol);
    data.journal.unshift({ title: value.title.trim(), text: value.text.trim(), symbol: value.symbol, date: today(), tag: stock?.name || "나의 기록" });
  }
  persist();
  render();
  closeModal();
  showToast(modalMode === "account" ? "실제와 가상 포트폴리오를 같은 출발점으로 맞췄어요." : "기록을 저장했어요.");
}

document.getElementById("today-label").textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
document.getElementById("open-trade").addEventListener("click", () => openModal("trade"));
document.getElementById("open-trade-inline").addEventListener("click", () => openModal("trade"));
document.getElementById("open-account").addEventListener("click", () => openModal("account"));
document.getElementById("open-holding").addEventListener("click", () => openModal("account"));
document.getElementById("open-news").addEventListener("click", () => openModal("news"));
document.getElementById("open-note").addEventListener("click", () => openModal("note"));
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
const modalBackdrop = document.getElementById("modal-backdrop");
let backdropPointerStarted = false;
modalBackdrop.addEventListener("pointerdown", (event) => {
  backdropPointerStarted = event.target === modalBackdrop;
});
modalBackdrop.addEventListener("pointerup", (event) => {
  if (event.target !== modalBackdrop) backdropPointerStarted = false;
});
modalBackdrop.addEventListener("pointercancel", () => { backdropPointerStarted = false; });
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop && backdropPointerStarted) closeModal();
  backdropPointerStarted = false;
});
document.getElementById("modal-form").addEventListener("submit", handleSubmit);
document.getElementById("save-snapshot").addEventListener("click", () => saveMonthlySnapshot());
const allocationBar = document.getElementById("allocation-list");
const allocationTooltip = document.getElementById("allocation-tooltip");
function showAllocationTooltip(segment, x, y) {
  allocationTooltip.textContent = segment.dataset.tooltip;
  allocationTooltip.classList.add("visible");
  allocationTooltip.setAttribute("aria-hidden", "false");
  const bounds = allocationTooltip.getBoundingClientRect();
  const safeX = Math.min(Math.max(x, bounds.width / 2 + 10), window.innerWidth - bounds.width / 2 - 10);
  const safeY = Math.max(y - 12, bounds.height + 18);
  allocationTooltip.style.left = `${safeX}px`;
  allocationTooltip.style.top = `${safeY}px`;
}
function hideAllocationTooltip() {
  allocationTooltip.classList.remove("visible");
  allocationTooltip.setAttribute("aria-hidden", "true");
}
allocationBar.addEventListener("pointerover", (event) => {
  const segment = event.target.closest(".mix-segment");
  if (segment) showAllocationTooltip(segment, event.clientX, event.clientY);
});
allocationBar.addEventListener("pointermove", (event) => {
  const segment = event.target.closest(".mix-segment");
  if (segment) showAllocationTooltip(segment, event.clientX, event.clientY);
});
allocationBar.addEventListener("pointerleave", hideAllocationTooltip);
allocationBar.addEventListener("focusin", (event) => {
  const segment = event.target.closest(".mix-segment");
  if (segment) {
    const bounds = segment.getBoundingClientRect();
    showAllocationTooltip(segment, bounds.left + bounds.width / 2, bounds.top);
  }
});
allocationBar.addEventListener("focusout", hideAllocationTooltip);
document.querySelectorAll(".allocation-tab").forEach((tab) => tab.addEventListener("click", () => {
  allocationMode = tab.dataset.mode;
  renderAllocation();
}));
document.getElementById("snapshot-confirm").addEventListener("click", (event) => {
  const action = event.target.closest("[data-snapshot-action]")?.dataset.snapshotAction;
  if (action === "cancel") document.getElementById("snapshot-confirm").classList.add("hidden");
  if (action === "overwrite") saveMonthlySnapshot(true);
});
document.getElementById("undo-trade-area").addEventListener("click", (event) => {
  const action = event.target.closest("[data-undo-action]")?.dataset.undoAction;
  const latestTrade = data.trades[0];
  if (!latestTrade) return;
  if (action === "request" && latestTrade.undoState) {
    undoConfirmId = latestTrade.id;
    renderJournal();
  } else if (action === "cancel") {
    undoConfirmId = null;
    renderJournal();
  } else if (action === "confirm") undoLatestTrade();
});
document.getElementById("exchange-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const rate = Number(new FormData(event.currentTarget).get("exchangeRate"));
  if (!Number.isFinite(rate) || rate <= 0) return showToast("환율은 0보다 큰 값으로 입력해 주세요.", true);
  data.exchangeRate = rate;
  persist();
  render();
  showToast("입력한 환율을 적용했어요.");
});
document.getElementById("holdings-body").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-symbol]");
  if (!row) return;
  const stock = data.positions.find((item) => item.symbol === row.dataset.symbol && item.currency === row.dataset.currency);
  if (stock) openModal("price", stock);
});
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
}));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
addNewsImportControls();
restoreNewsFolder();
render();
