import { initRouter } from './app/router.js';
import { bindMovementWizard, categoryLabel, renderMovementOpIconButtons, renderMovementWizard, startWizardForSku } from './app/movement-wizard.js';
import { bindSkuPage, renderSkuPage } from './app/sku-page.js';
import { stockedCategories, stockedWarehouses } from './app/home.js';
import { isNavViewVisible } from './app/navigation.js';
import { isLocalPhotoUrl } from './app/photo-store.js';
import {
  createLocation,
  createWarehouse,
  deleteLocation,
  deleteWarehouse,
  loadLocations,
  loadWarehouses,
  updateLocation,
  updateWarehouse,
} from './app/views/topology.js';
import { loadSKUs, lookupScanCode } from './app/views/catalog.js';
import { loadSKUsView, loadStocksView, loadMovementsView, loadSyncQueue } from './app/views.js';
import { groupStocksBySku } from './app/views/stocks.js';
import { isCameraScanSupported, parseQrScanValue, startCameraScan } from './app/views/scan.js';
import { OPERATION_TYPES, submitMovement } from './app/views/movements.js';
import { DATA_UPDATED_EVENT, SyncEngine, db, discardSyncOp, retrySyncOp } from './infra/sync-engine.js';
import { ensureAuth, handleOAuthCallback, hasOAuthCallback, loadAuthConfig, logout, startLogin } from './infra/auth.js';

const main = document.getElementById('main');
const networkStatus = document.getElementById('network-status');
const syncStatus = document.getElementById('sync-status');
const userStatus = document.getElementById('user-status');
const mainNav = document.getElementById('main-nav');
const menuToggle = document.getElementById('menu-toggle');

let authConfig = null;
let currentUser = null;
let router = null;
let stopCameraScan = null;
let backendReachable = true;
let expandedStockSkuId = null;
let suppressDataUpdatedRefresh = false;

async function checkBackendReachability() {
  try {
    const res = await fetch('/api/v1/health', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    backendReachable = !!res.ok;
  } catch {
    backendReachable = false;
  }
}

function readPendingFilters(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return {};
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getStockFiltersFromDOM() {
  return {
    q: document.getElementById('stock-search')?.value.trim() || '',
    warehouse_id: document.getElementById('stock-filter-wh')?.value || '',
    location_id: document.getElementById('stock-filter-loc')?.value || '',
    category: document.getElementById('stock-filter-category')?.value || '',
  };
}

function getMovementFiltersFromDOM() {
  const filters = {};
  const type = document.getElementById('mv-filter-type')?.value;
  const skuId = document.getElementById('mv-filter-sku')?.value;
  if (type) filters.operation_type = type;
  if (skuId) filters.sku_id = skuId;
  return filters;
}

async function filterStocksForPage(filters, skus) {
  let stocks = await loadStocksView(filters);
  if (filters.category) {
    const skuIds = new Set(
      skus
        .filter((sku) => categoryLabel(sku.category) === filters.category)
        .map((sku) => sku.id),
    );
    stocks = stocks.filter((stock) => skuIds.has(stock.sku_id));
  }
  return stocks;
}

async function refreshStocksPage(filters = {}) {
  const [wizardStocks, skus, locations, warehouses] = await Promise.all([
    loadStocksView({}),
    loadSKUs('', true),
    loadAllLocations(),
    loadWarehouses(true),
  ]);
  const stocks = await filterStocksForPage(filters, skus);
  main.innerHTML = renderStocksPage(stocks, skus, locations, warehouses, filters, wizardStocks);
  bindStocksHandlers({ filters, skus, locations, stocks, wizardStocks });
}

async function refreshStockListOnly({ skus, locations, wizardStocks }) {
  const filters = getStockFiltersFromDOM();
  const stocks = await filterStocksForPage(filters, skus);
  const list = document.getElementById('stock-list');
  if (!list) {
    await refreshStocksPage(filters);
    return;
  }
  list.innerHTML = renderStockSkuCards(stocks, skus);
  bindStockCardHandlers({ skus, locations, stocks, wizardStocks });
}

async function refreshMovementsPage(filters = {}) {
  const [items, skus] = await Promise.all([
    loadMovementsView(filters),
    loadSKUs('', true),
  ]);
  main.innerHTML = renderMovementsPage(items, skus, filters);
  bindMovementsHandlers();
}

function refreshDataInBackground(renderCurrent) {
  if (!currentUser) return;
  const routePath = window.location.pathname || '/';
  suppressDataUpdatedRefresh = true;
  void syncEngine.refreshLocalData().then(async () => {
    if ((window.location.pathname || '/') !== routePath) return;
    await renderCurrent();
  }).catch(() => {}).finally(() => {
    suppressDataUpdatedRefresh = false;
  });
}

async function refreshCurrentViewAfterDataUpdate() {
  if (suppressDataUpdatedRefresh || !isAuthenticated()) return;
  const routePath = window.location.pathname || '/';
  try {
    if (routePath === '/warehouses') {
      main.innerHTML = renderWarehouses(await loadWarehouses());
      bindWarehouseHandlers();
    } else if (routePath === '/') {
      await refreshHomePage();
    } else if (routePath === '/stocks') {
      await refreshStocksPage(getStockFiltersFromDOM());
    } else if (routePath === '/movements') {
      await refreshMovementsPage(getMovementFiltersFromDOM());
    } else if (routePath === '/skus') {
      await refreshSkuPage();
    } else if (routePath === '/sync') {
      main.innerHTML = renderSyncPanel(await loadSyncQueue());
      bindSyncHandlers();
    }
  } catch {
    // Keep the current screen if a background refresh races with navigation or offline state.
  }
}

function updateNetworkStatus() {
  const online = navigator.onLine && backendReachable;
  globalThis.__skladBackendOnline = online;
  networkStatus.textContent = online ? 'online' : 'offline';
  networkStatus.classList.toggle('offline', !online);
}

function updateUserStatus() {
  if (!userStatus) return;
  if (currentUser) {
    userStatus.textContent = currentUser.name || currentUser.email || currentUser.id;
  } else if (authConfig?.dev_bypass) {
    userStatus.textContent = 'dev mode';
  } else {
    userStatus.textContent = 'guest';
  }
}

function isAuthenticated() {
  return Boolean(currentUser || authConfig?.dev_bypass);
}

function setMobileMenuOpen(open) {
  if (!mainNav || !menuToggle) return;
  mainNav.dataset.open = open ? 'true' : 'false';
  menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
}

function updateNavigationVisibility() {
  const authenticated = isAuthenticated();
  document.querySelectorAll('.nav .nav-btn[data-view]').forEach((btn) => {
    btn.hidden = !isNavViewVisible(btn.dataset.view, authenticated);
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function skuPhotoSrc(item, fallback = '') {
  if (item?.photo_src) return item.photo_src;
  if (item?.photo_url && !isLocalPhotoUrl(item.photo_url)) return item.photo_url;
  return fallback;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

const OP_LABELS = Object.fromEntries(OPERATION_TYPES.map((o) => [o.value, o.label]));

async function loadAllLocations() {
  const warehouses = await loadWarehouses(true);
  const all = [];
  for (const w of warehouses) {
    const locs = await loadLocations(w.id, true);
    for (const l of locs) {
      all.push({ ...l, warehouse_name: w.name });
    }
  }
  return all;
}

function renderStockSkuCards(stocks, skus) {
  const skuById = Object.fromEntries(skus.map((sku) => [sku.id, sku]));
  const grouped = groupStocksBySku(stocks, skus);
  const stockList = grouped.map((entry) => {
    const photoSrc = skuPhotoSrc(skuById[entry.sku_id]);
    const expanded = expandedStockSkuId === entry.sku_id;
    const warehouseLines = entry.warehouses.map((warehouse) => `
      <span class="stock-wh-chip">${escapeHtml(warehouse.name)}: ${warehouse.quantity}</span>
    `).join('');
    return `
    <div class="card stock-sku-card${expanded ? ' stock-sku-card-expanded' : ''}" data-action="stock-sku-toggle" data-sku-id="${escapeHtml(entry.sku_id)}" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}">
      <div class="sku-row">
        ${photoSrc ? `<img class="sku-photo" src="${escapeHtml(photoSrc)}" alt="" />` : '<div class="sku-photo sku-photo-empty">—</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(entry.sku_name)}</h3>
          <div class="meta stock-sku-total">${entry.totalQty} ${escapeHtml(entry.unit)}</div>
          <div class="stock-wh-list">${warehouseLines}</div>
        </div>
      </div>
      ${expanded ? `
        <div class="stock-sku-actions">
          ${renderMovementOpIconButtons({ skuId: entry.sku_id })}
        </div>
      ` : ''}
    </div>
  `;
  }).join('');
  return stockList || '<p class="empty">Нет запасов</p>';
}

function renderStocksPage(stocks, skus, locations, warehouses, filters = {}, wizardStocks = stocks) {
  const whOptions = warehouses
    .map((w) => `<option value="${w.id}"${filters.warehouse_id === w.id ? ' selected' : ''}>${escapeHtml(w.name)}</option>`)
    .join('');
  const locSource = filters.warehouse_id
    ? locations.filter((l) => l.warehouse_id === filters.warehouse_id)
    : locations;
  const locOptions = locSource
    .map((l) => `<option value="${l.id}"${filters.location_id === l.id ? ' selected' : ''}>${escapeHtml(l.warehouse_name)} / ${escapeHtml(l.name)}</option>`)
    .join('');
  const categoryFilter = filters.category
    ? `<div class="stock-active-filter">
        <span>Категория: <strong>${escapeHtml(filters.category)}</strong></span>
        <button type="button" class="nav-btn" id="stock-clear-category">Сбросить</button>
      </div>`
    : '';

  return `
    <div class="card movement-wizard-card">
      ${renderMovementWizard(skus, locations, wizardStocks)}
    </div>
    <div class="card">
      <h3>Остатки</h3>
      <input type="hidden" id="stock-filter-category" value="${escapeHtml(filters.category || '')}" />
      ${categoryFilter}
      <div class="form-row"><label>Поиск</label><input id="stock-search" placeholder="название SKU" value="${escapeHtml(filters.q || '')}" autocomplete="off" /></div>
      <div class="form-row"><label>Склад</label><select id="stock-filter-wh"><option value="">Все склады</option>${whOptions}</select></div>
      <div class="form-row"><label>Место</label><select id="stock-filter-loc"><option value="">Все места</option>${locOptions}</select></div>
    </div>
    <div id="stock-list">${renderStockSkuCards(stocks, skus)}</div>
  `;
}

function renderMovementsPage(items, skus, filters = {}) {
  const filterOptions = ['', ...OPERATION_TYPES.map((o) => o.value)]
    .map((v) => `<option value="${v}"${filters.operation_type === v ? ' selected' : ''}>${v ? OP_LABELS[v] : 'Все типы'}</option>`)
    .join('');
  const skuOptions = skus
    .filter((s) => s.is_active !== false)
    .map((s) => `<option value="${s.id}"${filters.sku_id === s.id ? ' selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
  const list = items.map((m) => `
    <div class="card">
      <h3>${escapeHtml(OP_LABELS[m.operation_type] || m.operation_type)}: ${escapeHtml(m.sku_name)}</h3>
      <div class="meta">${m.quantity} шт · ${formatDate(m.occurred_at)}</div>
      ${m.reason_code ? `<div class="meta">Причина: ${escapeHtml(m.reason_code)}</div>` : ''}
    </div>
  `).join('');
  return `
    <div class="card">
      <h3>Журнал движений</h3>
      <div class="form-row"><label>Тип операции</label><select id="mv-filter-type">${filterOptions}</select></div>
      <div class="form-row"><label>SKU</label><select id="mv-filter-sku"><option value="">Все SKU</option>${skuOptions}</select></div>
    </div>
    ${list || '<p class="empty">Нет движений</p>'}
  `;
}

async function submitStockMovement(data, resultEl) {
  const res = await submitMovement(data);
  if (res.queued) {
    if (resultEl) resultEl.textContent = 'Операция в очереди (offline). Синхронизация при подключении.';
    syncEngine.sync();
  } else if (resultEl) {
    resultEl.textContent = 'Движение проведено';
  }
  const filters = getStockFiltersFromDOM();
  const [rawStocks, skus, locations, warehouses] = await Promise.all([
    loadStocksView(filters),
    loadSKUs('', true),
    loadAllLocations(),
    loadWarehouses(true),
  ]);
  let stocks = rawStocks;
  if (filters.category) {
    const skuIds = new Set(
      skus
        .filter((sku) => categoryLabel(sku.category) === filters.category)
        .map((sku) => sku.id),
    );
    stocks = stocks.filter((stock) => skuIds.has(stock.sku_id));
  }
  main.innerHTML = renderStocksPage(stocks, skus, locations, warehouses, filters, rawStocks);
  bindStocksHandlers({ filters, skus, locations, stocks, wizardStocks: rawStocks });
}

function bindStockCardHandlers({ skus = [], locations = [], stocks = [], wizardStocks = stocks } = {}) {
  main.querySelectorAll('#stock-list [data-action="stock-sku-toggle"]').forEach((card) => {
    const toggleCard = async () => {
      const skuId = card.dataset.skuId;
      expandedStockSkuId = expandedStockSkuId === skuId ? null : skuId;
      await refreshStockListOnly({ skus, locations, wizardStocks });
    };
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="stock-sku-op"]')) return;
      void toggleCard();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void toggleCard();
      }
    });
  });

  main.querySelectorAll('#stock-list [data-action="stock-sku-op"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const wizardRoot = document.getElementById('movement-wizard');
      if (!wizardRoot) return;
      startWizardForSku(wizardRoot, {
        skus,
        locations,
        stocks: wizardStocks,
        skuId: btn.dataset.skuId,
        operationType: btn.dataset.type,
      });
    });
  });
}

function bindStocksHandlers({
  filters: initialFilters = {},
  skus = [],
  locations = [],
  stocks = [],
  wizardStocks = stocks,
} = {}) {
  const wizardRoot = document.getElementById('movement-wizard');
  if (wizardRoot) {
    bindMovementWizard(wizardRoot, {
      skus,
      locations,
      stocks: wizardStocks,
      initialSkuId: initialFilters.sku_id,
      onSubmit: submitStockMovement,
    });
  }

  document.getElementById('stock-search')?.addEventListener('input', () => {
    void refreshStockListOnly({ skus, locations, wizardStocks });
  });
  document.getElementById('stock-filter-wh')?.addEventListener('change', async () => {
    const filters = getStockFiltersFromDOM();
    filters.location_id = '';
    await refreshStocksPage(filters);
  });
  document.getElementById('stock-filter-loc')?.addEventListener('change', async () => {
    await refreshStocksPage(getStockFiltersFromDOM());
  });
  document.getElementById('stock-clear-category')?.addEventListener('click', async () => {
    const filters = getStockFiltersFromDOM();
    filters.category = '';
    expandedStockSkuId = null;
    await refreshStocksPage(filters);
  });

  bindStockCardHandlers({ skus, locations, stocks, wizardStocks });
}

function bindMovementsHandlers() {
  const applyFilters = async () => {
    await refreshMovementsPage(getMovementFiltersFromDOM());
  };

  document.getElementById('mv-filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('mv-filter-sku')?.addEventListener('change', applyFilters);
}

async function refreshHomePage() {
  const [stocks, warehouses, skus] = await Promise.all([
    loadStocksView(),
    loadWarehouses(true),
    loadSKUs('', true),
  ]);
  main.innerHTML = renderHome(
    stockedWarehouses(stocks, warehouses),
    stockedCategories(stocks, skus),
  );
  bindHomeHandlers();
}

async function refreshSkuPage(searchQuery) {
  const q = typeof searchQuery === 'string'
    ? searchQuery
    : (document.getElementById('sku-search')?.value.trim() ?? '');
  const [items, allSkus] = await Promise.all([loadSKUsView(q), db.getCachedSKUs()]);
  main.innerHTML = renderSkuPage(items, { searchQuery: q, allSkus });
  bindSkuPage(main, {
    syncEngine,
    onRefresh: refreshSkuPage,
  });
}

function renderScanResult(resp) {
  const { sku, stocks, source } = resp;
  const stocksHtml = (stocks || []).length
    ? stocks.map((s) => `
        <div class="meta">${s.quantity} ${escapeHtml(s.unit || sku.unit || 'шт')} · ${escapeHtml(s.warehouse || '')} / ${escapeHtml(s.location || '')}</div>
      `).join('')
    : '<p class="meta">Нет остатков</p>';
  return `
    <div class="card">
      ${source === 'cache' ? '<span class="badge">из кэша</span> ' : ''}
      <div class="sku-row">
        ${skuPhotoSrc(sku) ? `<img class="sku-photo" src="${escapeHtml(skuPhotoSrc(sku))}" alt="" />` : '<div class="sku-photo sku-photo-empty">—</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(sku.name)}</h3>
          <div class="meta">${escapeHtml(sku.category || '')} · ${escapeHtml(sku.unit || 'шт')}</div>
          <div class="meta">Штрихкод: ${escapeHtml(resp.barcode)}</div>
        </div>
      </div>
      <h4 style="margin-top:0.75rem">Остатки</h4>
      ${stocksHtml}
      <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="nav-btn" data-action="scan-go-stocks" data-sku-id="${sku.id}">Запасы</button>
        <button class="nav-btn" data-action="scan-go-movements" data-sku-id="${sku.id}">Движения</button>
      </div>
    </div>
  `;
}

function renderScan() {
  const cameraSupported = isCameraScanSupported();
  return `
    <div class="card">
      <h3>Сканирование</h3>
      <div class="meta">Работает offline по локальному кэшу (ADR-003)</div>
      <div class="scan-camera-actions">
        <button type="button" class="nav-btn" id="qr-camera"${cameraSupported ? '' : ' disabled title="Камера доступна только по HTTPS"'}>Сканировать QR</button>
        <button type="button" class="nav-btn" id="qr-camera-stop" hidden>Стоп</button>
      </div>
      <video id="scan-video" class="scan-video" playsinline hidden></video>
      <div class="form-row">
        <label>Код или ID SKU</label>
        <input id="barcode-input" placeholder="Введите или отсканируйте QR" autofocus />
      </div>
      <button class="primary" id="barcode-search">Найти</button>
      <div id="scan-result" style="margin-top:1rem"></div>
    </div>
  `;
}

function renderSyncPanel({ ops, cursor }) {
  const header = `
    <div class="card">
      <h3>Синхронизация</h3>
      <div class="meta">Курсор сервера: ${cursor}</div>
      <div class="meta">${navigator.onLine ? 'online' : 'offline — операции в очереди'}</div>
      <button class="primary" id="sync-now" ${navigator.onLine ? '' : 'disabled'}>Синхронизировать сейчас</button>
    </div>`;

  if (!ops.length) {
    return `${header}<p class="empty">Нет операций в очереди</p>`;
  }

  const list = ops.map((op) => {
    const payload = op.payload || {};
    const line = payload.lines?.[0];
    const summary = payload.operation_type
      ? `${OP_LABELS[payload.operation_type] || payload.operation_type}${line ? `, ${line.quantity} шт` : ''}`
      : op.entityType === 'sku_photo'
        ? `фото SKU ${payload.sku_id || ''}`
        : '';
    const statusLabel = {
      pending: 'ожидает',
      retry_wait: 'повтор',
      conflict: 'конфликт',
      failed: 'ошибка',
    }[op.status] || op.status;
    const canAct = op.status === 'conflict' || op.status === 'failed';
    return `
      <div class="card" data-op-id="${escapeHtml(op.opId)}">
        <h3>${escapeHtml(op.entityType)} / ${escapeHtml(op.action)}</h3>
        <div class="meta">${escapeHtml(summary)}</div>
        <div class="meta">статус: ${escapeHtml(statusLabel)}${op.errorCode ? ` · ${escapeHtml(op.errorCode)}` : ''}</div>
        ${op.lastError ? `<div class="meta sync-error">${escapeHtml(op.lastError)}</div>` : ''}
        ${op.status === 'conflict' ? '<div class="meta">Сервер отклонил операцию. Обновите данные и повторите или отмените.</div>' : ''}
        ${canAct ? `
          <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="nav-btn" data-action="sync-retry" data-id="${escapeHtml(op.opId)}">Повторить</button>
            <button class="nav-btn" data-action="sync-discard" data-id="${escapeHtml(op.opId)}">Принять серверное состояние</button>
          </div>` : ''}
      </div>`;
  }).join('');

  return header + list;
}

function bindSyncHandlers() {
  document.getElementById('sync-now')?.addEventListener('click', async () => {
    await syncEngine.sync();
    const data = await loadSyncQueue();
    main.innerHTML = renderSyncPanel(data);
    bindSyncHandlers();
  });

  main.querySelectorAll('[data-action="sync-retry"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await retrySyncOp(btn.dataset.id);
      await syncEngine.sync();
      const data = await loadSyncQueue();
      main.innerHTML = renderSyncPanel(data);
      bindSyncHandlers();
    });
  });

  main.querySelectorAll('[data-action="sync-discard"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await discardSyncOp(btn.dataset.id, syncEngine);
      const data = await loadSyncQueue();
      main.innerHTML = renderSyncPanel(data);
      bindSyncHandlers();
    });
  });
}

function renderWarehouses(warehouses) {
  const list = warehouses.map((w) => `
    <div class="card" data-warehouse-id="${w.id}">
      <h3>${escapeHtml(w.name)} <span class="meta">(${escapeHtml(w.code)})</span></h3>
      <div class="meta">${w.is_active === false ? 'неактивен' : 'активен'}</div>
      <div class="form-row" style="flex-direction:row;gap:0.5rem;margin-top:0.5rem">
        <button class="nav-btn" data-action="edit-wh" data-id="${w.id}">Изменить</button>
        <button class="nav-btn" data-action="del-wh" data-id="${w.id}">Удалить</button>
        <button class="nav-btn" data-action="show-locs" data-id="${w.id}">Места</button>
      </div>
      <div id="locs-${w.id}" class="locations-panel" hidden></div>
    </div>
  `).join('');

  return `
    <div class="card">
      <h3>Новый склад</h3>
      <div class="form-row">
        <label for="wh-code">Код</label>
        <input id="wh-code" placeholder="kitchen" autocomplete="off" />
        <div class="meta">Короткий уникальный идентификатор склада</div>
      </div>
      <div class="form-row">
        <label for="wh-name">Название</label>
        <input id="wh-name" placeholder="Кухня" autocomplete="off" />
        <div class="meta">Человекочитаемое имя склада</div>
      </div>
      <button class="primary" id="wh-create">Создать склад</button>
    </div>
    ${list || '<p class="empty">Нет складов</p>'}
  `;
}

function bindWarehouseHandlers() {
  document.getElementById('wh-create')?.addEventListener('click', async () => {
    const code = document.getElementById('wh-code').value.trim();
    const name = document.getElementById('wh-name').value.trim();
    if (!code || !name) return;
    await createWarehouse({ code, name });
    main.innerHTML = renderWarehouses(await loadWarehouses());
    bindWarehouseHandlers();
  });

  main.querySelectorAll('[data-action="del-wh"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteWarehouse(btn.dataset.id);
      main.innerHTML = renderWarehouses(await loadWarehouses());
      bindWarehouseHandlers();
    });
  });

  main.querySelectorAll('[data-action="edit-wh"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = prompt('Новое название склада:');
      if (!name) return;
      await updateWarehouse(btn.dataset.id, { name });
      main.innerHTML = renderWarehouses(await loadWarehouses());
      bindWarehouseHandlers();
    });
  });

  main.querySelectorAll('[data-action="show-locs"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const panel = document.getElementById(`locs-${btn.dataset.id}`);
      if (!panel.hidden) {
        panel.hidden = true;
        return;
      }
      const locs = await loadLocations(btn.dataset.id);
      panel.innerHTML = renderLocationsPanel(btn.dataset.id, locs);
      panel.hidden = false;
      bindLocationHandlers(btn.dataset.id);
    });
  });
}

function renderHome(warehouseChips = [], categoryChips = []) {
  const chips = warehouseChips.map((warehouse) => `
    <a class="chip-link" href="/stocks" data-action="home-stock-wh" data-warehouse-id="${escapeHtml(warehouse.id)}">
      <span class="chip-label">${escapeHtml(warehouse.name)}</span>
      <span class="chip-count">${warehouse.skuCount} SKU</span>
    </a>
  `).join('');
  const categoryItems = categoryChips.map((category) => `
    <a class="chip-link" href="/stocks" data-action="home-stock-cat" data-category="${escapeHtml(category.name)}">
      <span class="chip-label">${escapeHtml(category.name)}</span>
      <span class="chip-count">${category.skuCount} SKU · ${category.unitCount} шт</span>
    </a>
  `).join('');
  return `
    <a class="home-scan-btn" href="/scan" data-action="home-scan-qr">
      <span class="home-scan-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2m10-16h2a1 1 0 0 1 1 1v2m0 10v2a1 1 0 0 1-1 1h-2M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </span>
      <span class="home-scan-label">Сканировать QR</span>
    </a>
    <div class="card">
      <h3>Склады с остатками</h3>
      ${chips ? `<div class="chip-list">${chips}</div>` : '<p class="empty">Нет складов с остатками</p>'}
    </div>
    <div class="card">
      <h3>Категории</h3>
      ${categoryItems ? `<div class="chip-list">${categoryItems}</div>` : '<p class="empty">Нет категорий с остатками</p>'}
    </div>
  `;
}

function bindHomeHandlers() {
  main.querySelectorAll('[data-action="home-stock-wh"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      sessionStorage.setItem('sklad_stock_filters', JSON.stringify({ warehouse_id: link.dataset.warehouseId }));
      router?.navigate('/stocks');
    });
  });

  main.querySelectorAll('[data-action="home-stock-cat"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      sessionStorage.setItem('sklad_stock_filters', JSON.stringify({ category: link.dataset.category }));
      router?.navigate('/stocks');
    });
  });

  main.querySelector('[data-action="home-scan-qr"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    sessionStorage.setItem('sklad_scan_autostart', '1');
    router?.navigate('/scan');
  });
}

function renderLocationsPanel(warehouseId, locs) {
  const activeLocs = locs.filter((l) => l.is_active !== false);
  const items = activeLocs.map((l) => `
    <div class="card" style="margin-top:0.5rem">
      <strong>${escapeHtml(l.name)}</strong> <span class="meta">код: ${escapeHtml(l.code)}</span>
      <div style="margin-top:0.25rem">
        <button class="nav-btn" data-action="edit-loc" data-id="${l.id}" data-wh="${warehouseId}">Изменить</button>
        <button class="nav-btn" data-action="del-loc" data-id="${l.id}" data-wh="${warehouseId}">Удалить</button>
      </div>
    </div>
  `).join('');
  return `
    <h4>Места хранения</h4>
    <div class="form-row">
      <label for="loc-code-${warehouseId}">Код</label>
      <input id="loc-code-${warehouseId}" placeholder="box-1" autocomplete="off" />
      <div class="meta">Короткий уникальный идентификатор места на этом складе</div>
    </div>
    <div class="form-row">
      <label for="loc-name-${warehouseId}">Название</label>
      <input id="loc-name-${warehouseId}" placeholder="Косметический ящик" autocomplete="off" />
      <div class="meta">Человекочитаемое имя, которое видно в списках и остатках</div>
    </div>
    <button class="primary" data-action="create-loc" data-wh="${warehouseId}">Добавить место</button>
    ${items || '<p class="empty">Нет мест</p>'}
  `;
}

function bindLocationHandlers(warehouseId) {
  main.querySelector(`[data-action="create-loc"][data-wh="${warehouseId}"]`)?.addEventListener('click', async (e) => {
    const wh = e.target.dataset.wh;
    const code = document.getElementById(`loc-code-${wh}`).value.trim();
    const name = document.getElementById(`loc-name-${wh}`).value.trim();
    if (!code || !name) {
      window.alert('Укажите код и название места');
      return;
    }
    try {
      await createLocation(wh, { code, name });
    } catch (err) {
      window.alert(err?.message || 'Не удалось создать место');
      return;
    }
    const panel = document.getElementById(`locs-${wh}`);
    panel.innerHTML = renderLocationsPanel(wh, await loadLocations(wh));
    bindLocationHandlers(wh);
  });

  main.querySelectorAll(`#locs-${warehouseId} [data-action="del-loc"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await deleteLocation(btn.dataset.id);
      } catch (err) {
        window.alert(err?.message || 'Не удалось удалить место');
        return;
      }
      const panel = document.getElementById(`locs-${btn.dataset.wh}`);
      panel.innerHTML = renderLocationsPanel(btn.dataset.wh, await loadLocations(btn.dataset.wh));
      bindLocationHandlers(btn.dataset.wh);
    });
  });

  main.querySelectorAll(`#locs-${warehouseId} [data-action="edit-loc"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = prompt('Новое название места:');
      if (!name) return;
      await updateLocation(btn.dataset.id, { name });
      const panel = document.getElementById(`locs-${btn.dataset.wh}`);
      panel.innerHTML = renderLocationsPanel(btn.dataset.wh, await loadLocations(btn.dataset.wh));
      bindLocationHandlers(btn.dataset.wh);
    });
  });
}

function renderLogin() {
  if (currentUser) {
    return `
      <div class="card">
        <h3>Вы вошли</h3>
        <div class="meta">${escapeHtml(currentUser.name || currentUser.email || currentUser.id)}</div>
        <button class="primary" id="logout">Выйти</button>
      </div>`;
  }
  if (authConfig?.dev_bypass) {
    return `
      <div class="card">
        <h3>Dev bypass</h3>
        <div class="meta">Аутентификация отключена для локальной разработки.</div>
        <button class="primary" id="login-dev">Продолжить</button>
      </div>`;
  }
  return `
    <div class="card">
      <h3>Вход через Nextcloud</h3>
      <div class="meta">OAuth2 Authorization Code + PKCE</div>
      <button class="primary" id="login-oidc">Войти</button>
    </div>`;
}

function renderOAuthCallback() {
  return '<p class="empty">Обработка входа...</p>';
}

async function renderRoute(route) {
  updateNavigationVisibility();
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', routesMatch(btn.dataset.view, route.path));
  });

  if (route.path === '/oauth/callback' || hasOAuthCallback()) {
    main.innerHTML = renderOAuthCallback();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    try {
      await handleOAuthCallback(code);
      currentUser = await ensureAuth();
      updateUserStatus();
      updateNavigationVisibility();
      window.history.replaceState({}, '', '/');
      return renderRoute({ path: '/' });
    } catch (err) {
      main.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
    }
    return;
  }

  const publicRoute = route.path === '/' || route.path === '/login' || route.path === '/oauth/callback';
  if (!publicRoute && !currentUser && !authConfig?.dev_bypass) {
    main.innerHTML = renderLogin();
    bindLoginHandlers();
    return;
  }

  try {
    if (route.path === '/login') {
      main.innerHTML = renderLogin();
      bindLoginHandlers();
      return;
    }

    if (route.path === '/warehouses') {
      main.innerHTML = renderWarehouses(await loadWarehouses());
      bindWarehouseHandlers();
      refreshDataInBackground(async () => {
        main.innerHTML = renderWarehouses(await loadWarehouses());
        bindWarehouseHandlers();
      });
    } else if (route.path === '/') {
      await refreshHomePage();
      refreshDataInBackground(refreshHomePage);
    } else if (route.path === '/stocks') {
      const pending = readPendingFilters('sklad_stock_filters');
      if (Object.keys(pending).length) expandedStockSkuId = null;
      await refreshStocksPage(pending);
      refreshDataInBackground(async () => refreshStocksPage(getStockFiltersFromDOM()));
    } else if (route.path === '/movements') {
      const pending = readPendingFilters('sklad_movement_filters');
      await refreshMovementsPage(pending);
      refreshDataInBackground(async () => refreshMovementsPage(getMovementFiltersFromDOM()));
    } else if (route.path === '/skus') {
      await refreshSkuPage();
      refreshDataInBackground(refreshSkuPage);
    } else if (route.path === '/scan') {
      const autostart = sessionStorage.getItem('sklad_scan_autostart') === '1';
      if (autostart) sessionStorage.removeItem('sklad_scan_autostart');
      main.innerHTML = renderScan();
      bindScanHandlers({ autostart });
    } else if (route.path === '/sync') {
      main.innerHTML = renderSyncPanel(await loadSyncQueue());
      bindSyncHandlers();
    }
  } catch (err) {
    main.innerHTML = `<p class="empty">${escapeHtml(err.message || 'Не удалось открыть вкладку')}</p>`;
  }
}

function routesMatch(view, path) {
  const map = { home: '/', stocks: '/stocks', movements: '/movements', warehouses: '/warehouses', skus: '/skus', scan: '/scan', sync: '/sync', login: '/login' };
  return map[view] === path;
}

function bindLoginHandlers() {
  const devBtn = document.getElementById('login-dev');
  if (devBtn) {
    devBtn.addEventListener('click', async () => {
      currentUser = await ensureAuth();
      updateUserStatus();
      updateNavigationVisibility();
      window.history.pushState({}, '', '/');
      renderRoute({ path: '/' });
    });
  }
  const oidcBtn = document.getElementById('login-oidc');
  if (oidcBtn) {
    oidcBtn.addEventListener('click', () => startLogin());
  }
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      currentUser = null;
      updateUserStatus();
      updateNavigationVisibility();
      window.history.pushState({}, '', '/login');
      renderRoute({ path: '/login' });
    });
  }
}

function bindScanHandlers({ autostart = false } = {}) {
  const input = document.getElementById('barcode-input');
  const resultEl = document.getElementById('scan-result');
  const video = document.getElementById('scan-video');
  const stopBtn = document.getElementById('qr-camera-stop');
  const cameraBtn = document.getElementById('qr-camera');

  async function doSearch() {
    const barcode = input.value.trim();
    if (!barcode) return;
    resultEl.innerHTML = '<p class="meta">Поиск...</p>';
    try {
      const resp = await lookupScanCode(barcode);
      resultEl.innerHTML = renderScanResult(resp);
      resultEl.querySelector('[data-action="scan-go-stocks"]')?.addEventListener('click', (e) => {
        sessionStorage.setItem('sklad_stock_filters', JSON.stringify({ sku_id: e.target.dataset.skuId }));
        router?.navigate('/stocks');
      });
      resultEl.querySelector('[data-action="scan-go-movements"]')?.addEventListener('click', (e) => {
        sessionStorage.setItem('sklad_movement_filters', JSON.stringify({ sku_id: e.target.dataset.skuId }));
        router?.navigate('/movements');
      });
    } catch (err) {
      resultEl.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
    }
  }

  document.getElementById('barcode-search')?.addEventListener('click', doSearch);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  cameraBtn?.addEventListener('click', () => {
    void startQrScan();
  });

  stopBtn?.addEventListener('click', () => {
    stopCameraScan?.();
    stopCameraScan = null;
    stopBtn.hidden = true;
    video.hidden = true;
  });

  async function startQrScan() {
    try {
      resultEl.innerHTML = '';
      video.hidden = false;
      stopBtn.hidden = false;
      stopCameraScan = await startCameraScan((code) => {
        input.value = parseQrScanValue(code);
        stopBtn.hidden = true;
        video.hidden = true;
      }, video, { formats: ['qr_code'] });
    } catch (err) {
      resultEl.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
    }
  }

  if (autostart && cameraBtn && !cameraBtn.disabled) {
    void startQrScan();
  }
}

window.addEventListener('online', async () => {
  await checkBackendReachability();
  updateNetworkStatus();
  try {
    currentUser = await ensureAuth() || currentUser;
  } catch {
    // keep cached session
  }
  updateUserStatus();
  updateNavigationVisibility();
  syncEngine.sync();
});

window.addEventListener('offline', () => {
  backendReachable = false;
  updateNetworkStatus();
});
globalThis.__skladBackendOnline = false;

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    setMobileMenuOpen(mainNav?.dataset.open !== 'true');
  });
}

if (mainNav) {
  mainNav.addEventListener('click', (event) => {
    if (event.target.closest('.nav-btn[data-view]')) {
      setMobileMenuOpen(false);
    }
  });
}

const syncEngine = new SyncEngine(({ pending, conflicts }) => {
  const label = conflicts > 0 ? `sync: ${pending}+${conflicts}!` : `sync: ${pending}`;
  syncStatus.textContent = label;
  syncStatus.classList.toggle('pending', pending > 0 || conflicts > 0);
});

window.addEventListener(DATA_UPDATED_EVENT, () => {
  void refreshCurrentViewAfterDataUpdate();
});

async function bootstrap() {
  try {
    authConfig = await loadAuthConfig();
  } catch {
    authConfig = null;
  }
  await checkBackendReachability();
  updateNetworkStatus();
  currentUser = await ensureAuth();
  updateUserStatus();
  updateNavigationVisibility();
  router = initRouter(renderRoute);
  syncEngine.sync();
  setInterval(() => syncEngine.sync(), 30000);
  setInterval(async () => {
    await checkBackendReachability();
    updateNetworkStatus();
  }, 15000);
}

bootstrap();

export { logout };
