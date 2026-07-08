import { movementFieldVisibility } from './movement-fields.js';
import { ISSUE_REASONS, OPERATION_TYPES } from './views/movements.js';

const UNCATEGORIZED = 'Без категории';

const OP_ICONS = {
  receipt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  issue: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  transfer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h11M12 5l3 3-3 3M19 16H8M11 19l-3-3 3-3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  adjustment: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l5.5-5.5M15.5 6.5 19 3m-3.5 3.5L11 11M5 19l2-2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="m14 4 2 2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
};

const defaultState = () => ({
  expanded: false,
  step: 'type',
  operationType: null,
  category: null,
  skuId: null,
  searchQuery: '',
});

let wizardState = defaultState();
let wizardOnSubmit = null;
let wizardSkus = [];
let wizardLocations = [];
let wizardStocks = [];

export function getWizardState() {
  return { ...wizardState };
}

export function setWizardState(patch) {
  wizardState = { ...wizardState, ...patch };
}

export function resetWizardState() {
  wizardState = defaultState();
}

export function renderMovementOpIconButtons({ skuId, action = 'stock-sku-op' } = {}) {
  return `
    <div class="movement-op-grid movement-op-grid-icons">
      ${OPERATION_TYPES.map((op) => `
        <button type="button" class="movement-op-btn movement-op-${escapeHtml(op.value)} movement-op-btn-icon-only" data-action="${escapeHtml(action)}" data-type="${escapeHtml(op.value)}" data-sku-id="${escapeHtml(skuId)}" aria-label="${escapeHtml(op.label)}" title="${escapeHtml(op.label)}">
          <span class="movement-op-icon">${OP_ICONS[op.value] || ''}</span>
        </button>
      `).join('')}
    </div>
  `;
}

export function startWizardForSku(root, { skus, locations, stocks, skuId, operationType }) {
  const sku = skus.find((item) => item.id === skuId);
  if (!sku || !root) return;

  wizardState = {
    ...defaultState(),
    expanded: true,
    step: 'details',
    operationType: operationType || 'receipt',
    category: categoryLabel(sku.category),
    skuId: sku.id,
    searchQuery: '',
  };
  rerenderWizard(root, skus, locations, stocks);
  root.closest('.movement-wizard-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function categoryLabel(category) {
  return category || UNCATEGORIZED;
}

export function collectCategories(skus) {
  const categories = new Set();
  for (const sku of skus) {
    if (sku.is_active === false) continue;
    categories.add(categoryLabel(sku.category));
  }
  return [...categories].sort((a, b) => {
    if (a === UNCATEGORIZED) return -1;
    if (b === UNCATEGORIZED) return 1;
    return a.localeCompare(b, 'ru', { sensitivity: 'base' });
  });
}

export function filterSkusByCategory(skus, category) {
  return skus
    .filter((sku) => sku.is_active !== false)
    .filter((sku) => categoryLabel(sku.category) === category)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function searchSkus(skus, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return skus
    .filter((sku) => sku.is_active !== false)
    .filter((sku) =>
      (sku.name || '').toLowerCase().includes(needle)
      || categoryLabel(sku.category).toLowerCase().includes(needle)
      || (sku.barcodes || []).some((code) => code.toLowerCase().includes(needle))
    )
    .slice(0, 8);
}

export function fromLocationsNeedStockFilter(operationType, adjustmentDirection = 'increase') {
  if (operationType === 'issue' || operationType === 'transfer') return true;
  if (operationType === 'adjustment' && adjustmentDirection === 'decrease') return true;
  return false;
}

export function locationsWithSkuStock(stocks, locations, skuId) {
  if (!skuId) return [];

  const quantityByLocation = new Map();
  for (const stock of stocks) {
    if (stock.sku_id !== skuId || !stock.location_id) continue;
    const qty = Number(stock.quantity || 0);
    if (qty <= 0) continue;
    quantityByLocation.set(
      stock.location_id,
      (quantityByLocation.get(stock.location_id) || 0) + qty,
    );
  }

  return locations
    .filter((loc) => quantityByLocation.has(loc.id))
    .map((loc) => ({ ...loc, stockQuantity: quantityByLocation.get(loc.id) }))
    .sort((a, b) => {
      const byWarehouse = (a.warehouse_name || '').localeCompare(b.warehouse_name || '', 'ru', { sensitivity: 'base' });
      if (byWarehouse !== 0) return byWarehouse;
      return (a.name || '').localeCompare(b.name || '', 'ru', { sensitivity: 'base' });
    });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function operationLabel(type) {
  return OPERATION_TYPES.find((item) => item.value === type)?.label || type;
}

function renderSkuPhoto(sku) {
  const src = sku.photo_src || sku.photo_url;
  if (src) {
    return `<img class="pick-photo" src="${escapeHtml(src)}" alt="" />`;
  }
  return '<div class="pick-photo pick-photo-empty">—</div>';
}

function renderLocationOptions(locations, { withQuantity = false } = {}) {
  return locations
    .map((loc) => {
      const label = `${loc.warehouse_name} / ${loc.name}`;
      const qtySuffix = withQuantity && loc.stockQuantity != null ? ` (${loc.stockQuantity} шт)` : '';
      return `<option value="${escapeHtml(loc.id)}">${escapeHtml(label)}${escapeHtml(qtySuffix)}</option>`;
    })
    .join('');
}

function resolveFromLocations(stocks, locations, skuId, operationType, adjustmentDirection) {
  if (fromLocationsNeedStockFilter(operationType, adjustmentDirection)) {
    return locationsWithSkuStock(stocks, locations, skuId);
  }
  return locations;
}

function renderReasonOptions() {
  return ISSUE_REASONS
    .map((reason) => `<option value="${escapeHtml(reason.value)}">${escapeHtml(reason.label)}</option>`)
    .join('');
}

function renderTypeStep() {
  const buttons = OPERATION_TYPES.map((op) => `
    <button type="button" class="movement-op-btn movement-op-${escapeHtml(op.value)}" data-action="wizard-pick-type" data-type="${escapeHtml(op.value)}">
      <span class="movement-op-icon">${OP_ICONS[op.value] || ''}</span>
      <span class="movement-op-label">${escapeHtml(op.label)}</span>
    </button>
  `).join('');

  return `
    <div class="movement-wizard-step" data-wizard-step="type">
      <p class="movement-wizard-hint">Выберите тип операции</p>
      <div class="movement-op-grid">${buttons}</div>
    </div>
  `;
}

function renderSearchBar(skus) {
  const suggestions = searchSkus(skus, wizardState.searchQuery);
  const list = suggestions.length
    ? `<div class="wizard-suggest-list" role="listbox">
        ${suggestions.map((sku) => `
          <button type="button" class="wizard-suggest-item" role="option" data-action="wizard-pick-sku" data-sku-id="${escapeHtml(sku.id)}">
            <span>${escapeHtml(sku.name)}</span>
            <span class="meta">${escapeHtml(categoryLabel(sku.category))}</span>
          </button>
        `).join('')}
      </div>`
    : '';

  return `
    <div class="wizard-search">
      <label class="wizard-search-label" for="wizard-sku-search">Поиск SKU</label>
      <input id="wizard-sku-search" type="search" placeholder="Название, категория или штрихкод" value="${escapeHtml(wizardState.searchQuery)}" autocomplete="off" />
      ${list}
    </div>
  `;
}

function renderCategoryStep(skus) {
  const categories = collectCategories(skus);
  const items = categories.map((category) => `
    <button type="button" class="pick-item pick-category" data-action="wizard-pick-category" data-category="${escapeHtml(category)}">
      <span class="pick-title">${escapeHtml(category)}</span>
      <span class="pick-meta">${filterSkusByCategory(skus, category).length} SKU</span>
    </button>
  `).join('');

  return `
    <div class="movement-wizard-step" data-wizard-step="category">
      <div class="movement-wizard-toolbar">
        <button type="button" class="nav-btn" data-action="wizard-back">Назад</button>
        <span class="movement-wizard-step-title">${escapeHtml(operationLabel(wizardState.operationType))}</span>
      </div>
      ${renderSearchBar(skus)}
      <div class="pick-list pick-list-categories">${items || '<p class="empty">Нет категорий</p>'}</div>
    </div>
  `;
}

function renderSkuStep(skus) {
  const items = filterSkusByCategory(skus, wizardState.category).map((sku) => `
    <button type="button" class="pick-item pick-sku" data-action="wizard-pick-sku" data-sku-id="${escapeHtml(sku.id)}">
      ${renderSkuPhoto(sku)}
      <span class="pick-title">${escapeHtml(sku.name)}</span>
    </button>
  `).join('');

  return `
    <div class="movement-wizard-step" data-wizard-step="sku">
      <div class="movement-wizard-toolbar">
        <button type="button" class="nav-btn" data-action="wizard-back">Назад</button>
        <span class="movement-wizard-step-title">${escapeHtml(wizardState.category || '')}</span>
      </div>
      ${renderSearchBar(skus)}
      <div class="pick-list pick-list-skus">${items || '<p class="empty">Нет SKU в категории</p>'}</div>
    </div>
  `;
}

function renderDetailsStep(skus, locations, stocks) {
  const sku = skus.find((item) => item.id === wizardState.skuId);
  if (!sku) return '';

  const type = wizardState.operationType || 'receipt';
  const visibility = movementFieldVisibility(type, 'increase');
  const fromLocations = resolveFromLocations(stocks, locations, sku.id, type, 'increase');
  const fromOptions = renderLocationOptions(fromLocations, {
    withQuantity: fromLocationsNeedStockFilter(type, 'increase'),
  });
  const toOptions = renderLocationOptions(locations);

  return `
    <div class="movement-wizard-step" data-wizard-step="details">
      <div class="movement-wizard-toolbar">
        <button type="button" class="nav-btn" data-action="wizard-back">Назад</button>
        <span class="movement-wizard-step-title">${escapeHtml(operationLabel(type))}</span>
      </div>
      <div class="wizard-details-card">
        <div class="sku-row">
          ${(sku.photo_src || sku.photo_url) ? `<img class="sku-photo" src="${escapeHtml(sku.photo_src || sku.photo_url)}" alt="" />` : '<div class="sku-photo sku-photo-empty">—</div>'}
          <div class="sku-info">
            <h4>${escapeHtml(sku.name)}</h4>
            <div class="meta">${escapeHtml(categoryLabel(sku.category))} · ${escapeHtml(sku.unit || 'шт')}</div>
          </div>
        </div>
        <input type="hidden" id="mv-type" value="${escapeHtml(type)}" />
        <input type="hidden" id="mv-sku" value="${escapeHtml(sku.id)}" />
        <div class="form-row" id="mv-reason-row"${visibility.reason ? '' : ' hidden'}>
          <label>Причина расхода</label>
          <select id="mv-reason">${renderReasonOptions()}</select>
        </div>
        <div class="form-row" id="mv-adj-row"${visibility.adjustment ? '' : ' hidden'}>
          <label>Корректировка</label>
          <select id="mv-adj-dir">
            <option value="increase">Увеличить</option>
            <option value="decrease">Уменьшить</option>
          </select>
        </div>
        <div class="form-row">
          <label>Количество</label>
          <input id="mv-qty" type="number" min="1" value="1" />
        </div>
        <div class="form-row" id="mv-from-row"${visibility.from ? '' : ' hidden'}>
          <label>Откуда</label>
          <select id="mv-from"><option value="">—</option>${fromOptions}</select>
        </div>
        <div class="form-row" id="mv-to-row"${visibility.to ? '' : ' hidden'}>
          <label>Куда</label>
          <select id="mv-to"><option value="">—</option>${toOptions}</select>
        </div>
        <button class="primary" id="mv-submit" type="button">Провести</button>
        <div id="mv-result" class="meta movement-wizard-result"></div>
      </div>
    </div>
  `;
}

function renderActiveStep(skus, locations, stocks) {
  if (!wizardState.expanded) return '';
  if (wizardState.step === 'type') return renderTypeStep();
  if (wizardState.step === 'category') return renderCategoryStep(skus);
  if (wizardState.step === 'sku') return renderSkuStep(skus);
  if (wizardState.step === 'details') return renderDetailsStep(skus, locations, stocks);
  return '';
}

export function renderMovementWizard(skus, locations, stocks = []) {
  return `
    <div class="movement-wizard" id="movement-wizard">
      <button type="button" class="movement-wizard-toggle" id="movement-wizard-toggle" aria-expanded="${wizardState.expanded ? 'true' : 'false'}">
        <span>Новое движение</span>
        <span class="movement-wizard-chevron" aria-hidden="true"></span>
      </button>
      <div class="movement-wizard-body"${wizardState.expanded ? '' : ' hidden'}>
        ${renderActiveStep(skus, locations, stocks)}
      </div>
    </div>
  `;
}

function updateFromLocationOptions(root, stocks, locations) {
  const type = wizardState.operationType || 'receipt';
  const adjustmentDirection = root.querySelector('#mv-adj-dir')?.value || 'increase';
  const fromSelect = root.querySelector('#mv-from');
  if (!fromSelect) return;

  const fromLocations = resolveFromLocations(stocks, locations, wizardState.skuId, type, adjustmentDirection);
  const selected = fromSelect.value;
  fromSelect.innerHTML = `<option value="">—</option>${renderLocationOptions(fromLocations, {
    withQuantity: fromLocationsNeedStockFilter(type, adjustmentDirection),
  })}`;
  if (selected && fromLocations.some((loc) => loc.id === selected)) {
    fromSelect.value = selected;
  }
}

function updateDetailsVisibility(root, stocks, locations) {
  const type = wizardState.operationType || 'receipt';
  const adjustmentDirection = root.querySelector('#mv-adj-dir')?.value || 'increase';
  const visibility = movementFieldVisibility(type, adjustmentDirection);
  root.querySelector('#mv-reason-row')?.toggleAttribute('hidden', !visibility.reason);
  root.querySelector('#mv-adj-row')?.toggleAttribute('hidden', !visibility.adjustment);
  root.querySelector('#mv-from-row')?.toggleAttribute('hidden', !visibility.from);
  root.querySelector('#mv-to-row')?.toggleAttribute('hidden', !visibility.to);
  updateFromLocationOptions(root, stocks, locations);
}

function rerenderWizard(root, skus, locations, stocks = wizardStocks) {
  const body = root.querySelector('.movement-wizard-body');
  const toggle = root.querySelector('#movement-wizard-toggle');
  if (!body || !toggle) return;
  toggle.setAttribute('aria-expanded', wizardState.expanded ? 'true' : 'false');
  body.hidden = !wizardState.expanded;
  body.innerHTML = renderActiveStep(skus, locations, stocks);
  bindWizardStepHandlers(root, skus, locations, stocks);
}

export function bindMovementWizard(root, { skus, locations, stocks = [], onSubmit, initialSkuId }) {
  wizardOnSubmit = onSubmit;
  wizardSkus = skus;
  wizardLocations = locations;
  wizardStocks = stocks;

  if (initialSkuId && !wizardState.skuId) {
    const sku = skus.find((item) => item.id === initialSkuId);
    if (sku) {
      wizardState = {
        ...defaultState(),
        expanded: true,
        step: 'details',
        operationType: 'receipt',
        category: categoryLabel(sku.category),
        skuId: sku.id,
      };
    }
  }

  if (!root.dataset.bound) {
    root.dataset.bound = 'true';
    root.querySelector('#movement-wizard-toggle')?.addEventListener('click', () => {
      wizardState.expanded = !wizardState.expanded;
      rerenderWizard(root, wizardSkus, wizardLocations, wizardStocks);
    });
  }

  rerenderWizard(root, skus, locations, stocks);
}

function bindWizardStepHandlers(root, skus, locations, stocks = wizardStocks) {
  const onSubmit = wizardOnSubmit;
  root.querySelectorAll('[data-action="wizard-pick-type"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizardState.operationType = btn.dataset.type;
      wizardState.step = 'category';
      wizardState.category = null;
      wizardState.skuId = null;
      wizardState.searchQuery = '';
      rerenderWizard(root, skus, locations, stocks);
    });
  });

  root.querySelectorAll('[data-action="wizard-pick-category"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizardState.category = btn.dataset.category;
      wizardState.step = 'sku';
      wizardState.skuId = null;
      wizardState.searchQuery = '';
      rerenderWizard(root, skus, locations, stocks);
    });
  });

  root.querySelectorAll('[data-action="wizard-pick-sku"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sku = skus.find((item) => item.id === btn.dataset.skuId);
      wizardState.skuId = btn.dataset.skuId;
      wizardState.category = categoryLabel(sku?.category);
      wizardState.step = 'details';
      wizardState.searchQuery = '';
      rerenderWizard(root, skus, locations, stocks);
    });
  });

  root.querySelectorAll('[data-action="wizard-back"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (wizardState.step === 'details') {
        wizardState.step = 'sku';
        wizardState.skuId = null;
      } else if (wizardState.step === 'sku') {
        wizardState.step = 'category';
        wizardState.category = null;
      } else if (wizardState.step === 'category') {
        wizardState.step = 'type';
        wizardState.operationType = null;
      }
      wizardState.searchQuery = '';
      rerenderWizard(root, skus, locations, stocks);
    });
  });

  const searchInput = root.querySelector('#wizard-sku-search');
  searchInput?.addEventListener('input', (event) => {
    wizardState.searchQuery = event.target.value;
    const step = root.querySelector('.movement-wizard-step');
    const stepName = step?.dataset.wizardStep;
    if (stepName === 'category' || stepName === 'sku') {
      const searchHost = root.querySelector('.wizard-search');
      if (searchHost) {
        const suggestions = searchSkus(skus, wizardState.searchQuery);
        const list = suggestions.length
          ? `<div class="wizard-suggest-list" role="listbox">
              ${suggestions.map((sku) => `
                <button type="button" class="wizard-suggest-item" role="option" data-action="wizard-pick-sku" data-sku-id="${escapeHtml(sku.id)}">
                  <span>${escapeHtml(sku.name)}</span>
                  <span class="meta">${escapeHtml(categoryLabel(sku.category))}</span>
                </button>
              `).join('')}
            </div>`
          : '';
        searchHost.querySelector('.wizard-suggest-list')?.remove();
        if (list) searchHost.insertAdjacentHTML('beforeend', list);
        searchHost.querySelectorAll('[data-action="wizard-pick-sku"]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const sku = skus.find((item) => item.id === btn.dataset.skuId);
            wizardState.skuId = btn.dataset.skuId;
            wizardState.category = categoryLabel(sku?.category);
            wizardState.step = 'details';
            wizardState.searchQuery = '';
            rerenderWizard(root, skus, locations, stocks);
          });
        });
      }
    }
  });

  root.querySelector('#mv-adj-dir')?.addEventListener('change', () => updateDetailsVisibility(root, stocks, locations));
  root.querySelector('#mv-submit')?.addEventListener('click', async () => {
    if (!onSubmit) return;
    const resultEl = root.querySelector('#mv-result');
    const type = wizardState.operationType;
    const skuId = wizardState.skuId;
    const qty = parseInt(root.querySelector('#mv-qty')?.value, 10);
    if (!skuId || !qty || qty <= 0) {
      if (resultEl) resultEl.textContent = 'Выберите SKU и количество';
      return;
    }
    const data = {
      operation_type: type,
      sku_id: skuId,
      quantity: qty,
      reason_code: type === 'issue' ? root.querySelector('#mv-reason')?.value : '',
    };
    const adjustmentDirection = root.querySelector('#mv-adj-dir')?.value || 'increase';
    const adjustmentLocation = root.querySelector('#mv-from')?.value || undefined;
    if (type === 'receipt' || type === 'transfer') {
      data.to_location_id = root.querySelector('#mv-to')?.value || undefined;
    }
    if (type === 'issue' || type === 'transfer') {
      data.from_location_id = root.querySelector('#mv-from')?.value || undefined;
    }
    if (type === 'adjustment' && adjustmentDirection === 'increase') {
      data.to_location_id = adjustmentLocation;
    }
    if (type === 'adjustment' && adjustmentDirection === 'decrease') {
      data.from_location_id = adjustmentLocation;
    }
    if ((type === 'receipt' || type === 'transfer') && !data.to_location_id) {
      if (resultEl) resultEl.textContent = 'Укажите место назначения';
      return;
    }
    if ((type === 'issue' || type === 'transfer') && !data.from_location_id) {
      if (resultEl) resultEl.textContent = 'Укажите место отгрузки';
      return;
    }
    if (type === 'adjustment' && !adjustmentLocation) {
      if (resultEl) resultEl.textContent = 'Укажите место корректировки';
      return;
    }
    try {
      await onSubmit(data, resultEl);
      resetWizardState();
      rerenderWizard(root, skus, locations, stocks);
    } catch (err) {
      if (resultEl) resultEl.textContent = err.message;
    }
  });
}
