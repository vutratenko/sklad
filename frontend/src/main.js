import { initRouter } from './app/router.js';
import { movementFieldVisibility } from './app/movement-fields.js';
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
import {
  createSKU,
  deleteSKU,
  loadSKUs,
  updateSKU,
  uploadPhoto,
} from './app/views/catalog.js';
import { loadSKUsView, loadStocksView, loadMovementsView, loadSyncQueue, lookupBarcode } from './app/views.js';
import { generateSKUQRCodePDF } from './app/sku-label-pdf.js';
import { startCameraScan } from './app/views/scan.js';
import { ISSUE_REASONS, OPERATION_TYPES, submitMovement } from './app/views/movements.js';
import { SyncEngine, discardSyncOp, retrySyncOp } from './infra/sync-engine.js';
import { ensureAuth, handleOAuthCallback, hasOAuthCallback, loadAuthConfig, logout, startLogin } from './infra/auth.js';

const main = document.getElementById('main');
const networkStatus = document.getElementById('network-status');
const syncStatus = document.getElementById('sync-status');
const userStatus = document.getElementById('user-status');

let authConfig = null;
let currentUser = null;
let router = null;
let stopCameraScan = null;

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

async function refreshStocksPage(filters = {}) {
  const [stocks, skus, locations, warehouses] = await Promise.all([
    loadStocksView(filters),
    loadSKUs('', true),
    loadAllLocations(),
    loadWarehouses(true),
  ]);
  main.innerHTML = renderStocksPage(stocks, skus, locations, warehouses, filters);
  bindStocksHandlers(filters);
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
  if (!navigator.onLine || !currentUser) return;
  const routePath = window.location.pathname || '/';
  void syncEngine.refreshLocalData().then(async () => {
    if ((window.location.pathname || '/') !== routePath) return;
    await renderCurrent();
  }).catch(() => {});
}

function updateNetworkStatus() {
  const online = navigator.onLine;
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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

function renderStocksPage(stocks, skus, locations, warehouses, filters = {}) {
  const stockList = stocks.map((s) => `
    <div class="card">
      <div class="sku-row">
        ${s.photo_url ? `<img class="sku-photo" src="${escapeHtml(s.photo_url)}" alt="" />` : '<div class="sku-photo sku-photo-empty">—</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(s.sku_name || 'SKU')}</h3>
          <div class="meta">
            ${s.quantity} ${escapeHtml(s.unit || 'шт')} · ${escapeHtml(s.warehouse || '')} / ${escapeHtml(s.location || '')}
          </div>
          ${s.lot_code ? `<div class="meta">Партия: ${escapeHtml(s.lot_code)}${s.expiry_date ? ` · до ${formatDate(s.expiry_date)}` : ''}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  const skuOptions = skus
    .filter((s) => s.is_active !== false)
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');
  const whOptions = warehouses
    .map((w) => `<option value="${w.id}"${filters.warehouse_id === w.id ? ' selected' : ''}>${escapeHtml(w.name)}</option>`)
    .join('');
  const locSource = filters.warehouse_id
    ? locations.filter((l) => l.warehouse_id === filters.warehouse_id)
    : locations;
  const locOptions = locSource
    .map((l) => `<option value="${l.id}"${filters.location_id === l.id ? ' selected' : ''}>${escapeHtml(l.warehouse_name)} / ${escapeHtml(l.name)}</option>`)
    .join('');
  const opOptions = OPERATION_TYPES.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  const reasonOptions = ISSUE_REASONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('');

  return `
    <div class="card">
      <h3>Новое движение</h3>
      <div class="form-row"><label>Тип</label><select id="mv-type">${opOptions}</select></div>
      <div class="form-row" id="mv-reason-row" hidden><label>Причина расхода</label><select id="mv-reason">${reasonOptions}</select></div>
      <div class="form-row" id="mv-adj-row" hidden><label>Корректировка</label>
        <select id="mv-adj-dir"><option value="increase">Увеличить</option><option value="decrease">Уменьшить</option></select>
      </div>
      <div class="form-row"><label>SKU</label><select id="mv-sku"><option value="">— выберите —</option>${skuOptions}</select></div>
      <div class="form-row"><label>Количество</label><input id="mv-qty" type="number" min="1" value="1" /></div>
      <div class="form-row" id="mv-from-row" hidden><label>Откуда</label><select id="mv-from"><option value="">—</option>${locOptions}</select></div>
      <div class="form-row" id="mv-to-row"><label>Куда</label><select id="mv-to"><option value="">—</option>${locOptions}</select></div>
      <button class="primary" id="mv-submit">Провести</button>
      <div id="mv-result" class="meta" style="margin-top:0.5rem"></div>
    </div>
    <div class="card">
      <h3>Остатки</h3>
      <div class="form-row"><label>Поиск</label><input id="stock-search" placeholder="название SKU" value="${escapeHtml(filters.q || '')}" /></div>
      <div class="form-row"><label>Склад</label><select id="stock-filter-wh"><option value="">Все склады</option>${whOptions}</select></div>
      <div class="form-row"><label>Место</label><select id="stock-filter-loc"><option value="">Все места</option>${locOptions}</select></div>
    </div>
    ${stockList || '<p class="empty">Нет запасов</p>'}
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

function updateMovementFields() {
  const type = document.getElementById('mv-type')?.value || 'receipt';
  const adjustmentDirection = document.getElementById('mv-adj-dir')?.value || 'increase';
  const reasonRow = document.getElementById('mv-reason-row');
  const fromRow = document.getElementById('mv-from-row');
  const toRow = document.getElementById('mv-to-row');
  const adjRow = document.getElementById('mv-adj-row');
  if (!reasonRow) return;

  const visibility = movementFieldVisibility(type, adjustmentDirection);
  reasonRow.hidden = !visibility.reason;
  adjRow.hidden = !visibility.adjustment;
  fromRow.hidden = !visibility.from;
  toRow.hidden = !visibility.to;
}

function bindStocksHandlers(initialFilters = {}) {
  updateMovementFields();
  document.getElementById('mv-type')?.addEventListener('change', updateMovementFields);
  document.getElementById('mv-adj-dir')?.addEventListener('change', updateMovementFields);

  const applyStockFilters = async () => {
    await refreshStocksPage(getStockFiltersFromDOM());
  };

  document.getElementById('stock-search')?.addEventListener('input', applyStockFilters);
  document.getElementById('stock-filter-wh')?.addEventListener('change', async () => {
    const filters = getStockFiltersFromDOM();
    filters.location_id = '';
    await refreshStocksPage(filters);
  });
  document.getElementById('stock-filter-loc')?.addEventListener('change', applyStockFilters);

  if (initialFilters.sku_id) {
    const mvSku = document.getElementById('mv-sku');
    if (mvSku) mvSku.value = initialFilters.sku_id;
  }

  document.getElementById('mv-submit')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('mv-result');
    const type = document.getElementById('mv-type').value;
    const skuId = document.getElementById('mv-sku').value;
    const qty = parseInt(document.getElementById('mv-qty').value, 10);
    if (!skuId || !qty || qty <= 0) {
      resultEl.textContent = 'Выберите SKU и количество';
      return;
    }
    const data = {
      operation_type: type,
      sku_id: skuId,
      quantity: qty,
      reason_code: type === 'issue' ? document.getElementById('mv-reason').value : '',
    };
    const adjustmentDirection = document.getElementById('mv-adj-dir').value;
    const adjustmentLocation = document.getElementById('mv-from').value || undefined;
    if (type === 'receipt' || type === 'transfer') {
      data.to_location_id = document.getElementById('mv-to').value || undefined;
    }
    if (type === 'issue' || type === 'transfer') {
      data.from_location_id = document.getElementById('mv-from').value || undefined;
    }
    if (type === 'adjustment' && adjustmentDirection === 'increase') {
      data.to_location_id = adjustmentLocation;
    }
    if (type === 'adjustment' && adjustmentDirection === 'decrease') {
      data.from_location_id = adjustmentLocation;
    }
    if ((type === 'receipt' || type === 'transfer') && !data.to_location_id) {
      resultEl.textContent = 'Укажите место назначения';
      return;
    }
    if ((type === 'issue' || type === 'transfer') && !data.from_location_id) {
      resultEl.textContent = 'Укажите место отгрузки';
      return;
    }
    if (type === 'adjustment' && !adjustmentLocation) {
      resultEl.textContent = 'Укажите место корректировки';
      return;
    }
    try {
      const res = await submitMovement(data);
      if (res.queued) {
        resultEl.textContent = 'Операция в очереди (offline). Синхронизация при подключении.';
        syncEngine.sync();
      } else {
        resultEl.textContent = 'Движение проведено';
      }
      const [stocks, skus, locations, warehouses] = await Promise.all([
        loadStocksView(),
        loadSKUs('', true),
        loadAllLocations(),
        loadWarehouses(true),
      ]);
      main.innerHTML = renderStocksPage(stocks, skus, locations, warehouses);
      bindStocksHandlers();
    } catch (err) {
      resultEl.textContent = err.message;
    }
  });
}

function bindMovementsHandlers() {
  const applyFilters = async () => {
    await refreshMovementsPage(getMovementFiltersFromDOM());
  };

  document.getElementById('mv-filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('mv-filter-sku')?.addEventListener('change', applyFilters);
}

function renderSKUs(items) {
  const list = items.map((s) => `
    <div class="card sku-card" data-sku-id="${s.id}">
      <div class="sku-row">
        ${s.photo_url ? `<img class="sku-photo" src="${escapeHtml(s.photo_url)}" alt="" />` : '<div class="sku-photo sku-photo-empty">нет фото</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(s.name)}</h3>
          <div class="meta">${escapeHtml(s.category || '')} · ${escapeHtml(s.unit)} · ${s.is_active === false ? 'неактивен' : 'активен'}</div>
          ${s.description ? `<div class="meta">${escapeHtml(s.description)}</div>` : ''}
          <div class="meta">Штрихкод: ${escapeHtml((s.barcodes || [])[0] || 'не назначен')}</div>
        </div>
      </div>
      <div class="form-row" style="flex-direction:row;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
        <button class="nav-btn" data-action="edit-sku" data-id="${s.id}">Изменить</button>
        <button class="nav-btn" data-action="del-sku" data-id="${s.id}">Удалить</button>
        <button class="nav-btn" data-action="print-sku-qr" data-id="${s.id}">PDF QR</button>
        <label class="nav-btn" style="cursor:pointer">
          Фото
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-action="upload-photo" data-id="${s.id}" />
        </label>
      </div>
    </div>
  `).join('');

  return `
    <div class="card">
      <h3>Новый SKU</h3>
      <div class="form-row"><label>Название</label><input id="sku-name" placeholder="Томатная паста" /></div>
      <div class="form-row"><label>Категория</label><input id="sku-category" placeholder="консервы" /></div>
      <div class="form-row"><label>Единица</label><input id="sku-unit" placeholder="шт" value="шт" /></div>
      <div class="form-row"><label>Описание</label><input id="sku-desc" placeholder="400г" /></div>
      <button class="primary" id="sku-create">Создать SKU</button>
    </div>
    <div class="card">
      <div class="form-row"><label>Поиск</label><input id="sku-search" placeholder="название, категория или штрихкод" /></div>
    </div>
    ${list || '<p class="empty">Нет SKU</p>'}
  `;
}

function bindSKUHandlers() {
  document.getElementById('sku-create')?.addEventListener('click', async () => {
    const name = document.getElementById('sku-name').value.trim();
    const category = document.getElementById('sku-category').value.trim();
    const unit = document.getElementById('sku-unit').value.trim() || 'шт';
    const description = document.getElementById('sku-desc').value.trim();
    if (!name) return;
    await createSKU({ name, category, unit, description });
    main.innerHTML = renderSKUs(await loadSKUs());
    bindSKUHandlers();
  });

  document.getElementById('sku-search')?.addEventListener('input', async (e) => {
    main.innerHTML = renderSKUs(await loadSKUs(e.target.value.trim()));
    bindSKUHandlers();
    document.getElementById('sku-search').value = e.target.value;
    document.getElementById('sku-search')?.focus();
  });

  main.querySelectorAll('[data-action="del-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить SKU?')) return;
      await deleteSKU(btn.dataset.id);
      main.innerHTML = renderSKUs(await loadSKUs());
      bindSKUHandlers();
    });
  });

  main.querySelectorAll('[data-action="edit-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = prompt('Новое название SKU:');
      if (!name) return;
      await updateSKU(btn.dataset.id, { name });
      main.innerHTML = renderSKUs(await loadSKUs());
      bindSKUHandlers();
    });
  });

  main.querySelectorAll('[data-action="upload-photo"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadPhoto(input.dataset.id, file);
        main.innerHTML = renderSKUs(await loadSKUs());
        bindSKUHandlers();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  main.querySelectorAll('[data-action="print-sku-qr"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const items = await loadSKUs();
      const sku = items.find((s) => s.id === btn.dataset.id);
      if (!sku) return;
      try {
        await generateSKUQRCodePDF(sku);
      } catch (err) {
        alert(err.message);
      }
    });
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
        ${sku.photo_url ? `<img class="sku-photo" src="${escapeHtml(sku.photo_url)}" alt="" />` : '<div class="sku-photo sku-photo-empty">—</div>'}
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
  const cameraSupported = 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  return `
    <div class="card">
      <h3>Сканирование штрихкода</h3>
      <div class="meta">Работает offline по локальному кэшу (ADR-003)</div>
      <div class="form-row">
        <label>Штрихкод</label>
        <input id="barcode-input" placeholder="Введите или отсканируйте" autofocus />
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="primary" id="barcode-search">Найти</button>
        ${cameraSupported ? '<button class="nav-btn" id="barcode-camera">Камера</button>' : ''}
        <button class="nav-btn" id="barcode-camera-stop" hidden>Стоп</button>
      </div>
      <video id="scan-video" class="scan-video" playsinline hidden></video>
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
      <div class="form-row"><label>Код</label><input id="wh-code" placeholder="kitchen" /></div>
      <div class="form-row"><label>Название</label><input id="wh-name" placeholder="Кухня" /></div>
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

function renderHome() {
  let authInfo = 'Nextcloud OIDC: используйте кнопку «Войти».';
  if (currentUser) {
    authInfo = 'Вы вошли через Nextcloud OIDC.';
  } else if (authConfig?.dev_bypass) {
    authInfo = 'Режим разработки: auth bypass активен (ADR-007).';
  }
  return `
    <div class="card">
      <h3>Sklad WMS</h3>
      <div class="meta">${authInfo}</div>
      ${currentUser ? `<div class="meta">Пользователь: ${escapeHtml(currentUser.name || currentUser.id)}</div>` : ''}
    </div>
  `;
}

function renderLocationsPanel(warehouseId, locs) {
  const items = locs.map((l) => `
    <div class="card" style="margin-top:0.5rem">
      <strong>${escapeHtml(l.name)}</strong> (${escapeHtml(l.code)})
      <div class="meta">${l.is_active === false ? 'неактивно' : 'активно'}</div>
      <div style="margin-top:0.25rem">
        <button class="nav-btn" data-action="edit-loc" data-id="${l.id}" data-wh="${warehouseId}">Изменить</button>
        <button class="nav-btn" data-action="del-loc" data-id="${l.id}" data-wh="${warehouseId}">Удалить</button>
      </div>
    </div>
  `).join('');
  return `
    <h4>Места хранения</h4>
    <div class="form-row"><input id="loc-code-${warehouseId}" placeholder="shelf-1" /></div>
    <div class="form-row"><input id="loc-name-${warehouseId}" placeholder="Полка 1" /></div>
    <button class="primary" data-action="create-loc" data-wh="${warehouseId}">Добавить место</button>
    ${items || '<p class="empty">Нет мест</p>'}
  `;
}

function bindLocationHandlers(warehouseId) {
  main.querySelector(`[data-action="create-loc"][data-wh="${warehouseId}"]`)?.addEventListener('click', async (e) => {
    const wh = e.target.dataset.wh;
    const code = document.getElementById(`loc-code-${wh}`).value.trim();
    const name = document.getElementById(`loc-name-${wh}`).value.trim();
    if (!code || !name) return;
    await createLocation(wh, { code, name });
    const panel = document.getElementById(`locs-${wh}`);
    panel.innerHTML = renderLocationsPanel(wh, await loadLocations(wh));
    bindLocationHandlers(wh);
  });

  main.querySelectorAll(`#locs-${warehouseId} [data-action="del-loc"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteLocation(btn.dataset.id);
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
      main.innerHTML = renderHome();
    } else if (route.path === '/stocks') {
      const pending = readPendingFilters('sklad_stock_filters');
      await refreshStocksPage(pending);
      refreshDataInBackground(async () => refreshStocksPage(getStockFiltersFromDOM()));
    } else if (route.path === '/movements') {
      const pending = readPendingFilters('sklad_movement_filters');
      await refreshMovementsPage(pending);
      refreshDataInBackground(async () => refreshMovementsPage(getMovementFiltersFromDOM()));
    } else if (route.path === '/skus') {
      main.innerHTML = renderSKUs(await loadSKUsView());
      bindSKUHandlers();
      refreshDataInBackground(async () => {
        const q = document.getElementById('sku-search')?.value.trim() || '';
        main.innerHTML = renderSKUs(await loadSKUsView(q));
        bindSKUHandlers();
        const input = document.getElementById('sku-search');
        if (input) input.value = q;
      });
    } else if (route.path === '/scan') {
      main.innerHTML = renderScan();
      bindScanHandlers();
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
      window.history.pushState({}, '', '/login');
      renderRoute({ path: '/login' });
    });
  }
}

function bindScanHandlers() {
  const input = document.getElementById('barcode-input');
  const resultEl = document.getElementById('scan-result');
  const video = document.getElementById('scan-video');
  const stopBtn = document.getElementById('barcode-camera-stop');
  const cameraBtn = document.getElementById('barcode-camera');

  async function doSearch() {
    const barcode = input.value.trim();
    if (!barcode) return;
    resultEl.innerHTML = '<p class="meta">Поиск...</p>';
    try {
      const resp = await lookupBarcode(barcode);
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

  cameraBtn?.addEventListener('click', async () => {
    try {
      video.hidden = false;
      stopBtn.hidden = false;
      stopCameraScan = await startCameraScan((code) => {
        input.value = code;
        stopBtn.hidden = true;
        video.hidden = true;
        doSearch();
      }, video);
    } catch (err) {
      resultEl.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
    }
  });

  stopBtn?.addEventListener('click', () => {
    stopCameraScan?.();
    stopCameraScan = null;
    stopBtn.hidden = true;
    video.hidden = true;
  });
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

const syncEngine = new SyncEngine(({ pending, conflicts }) => {
  const label = conflicts > 0 ? `sync: ${pending}+${conflicts}!` : `sync: ${pending}`;
  syncStatus.textContent = label;
  syncStatus.classList.toggle('pending', pending > 0 || conflicts > 0);
});

async function bootstrap() {
  authConfig = await loadAuthConfig();
  try {
    currentUser = await ensureAuth();
  } catch {
    currentUser = null;
  }
  updateUserStatus();
  router = initRouter(renderRoute);
  syncEngine.sync();
  setInterval(() => syncEngine.sync(), 30000);
}

bootstrap();

export { logout };
