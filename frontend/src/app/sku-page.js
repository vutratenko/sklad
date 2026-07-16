import {
  createSKU,
  deleteSKU,
  loadSKUs,
  updateSKU,
  uploadPhoto,
} from './views/catalog.js';
import { generateBatchSKUQRCodePDF } from './sku-label-pdf.js';
import { isLocalPhotoUrl } from './photo-store.js';

const pageState = {
  newSkuExpanded: false,
  qrPrintExpanded: false,
  selectedSkuId: null,
  qrCounts: {},
  qrSearchQuery: '',
  newSkuDraft: {
    name: '',
    category: '',
    unit: 'шт',
    description: '',
  },
};

export function skuQrCodes(sku) {
  return (sku?.barcodes || []).map((code) => String(code).trim()).filter(Boolean);
}

export function filterSkusForQrSearch(skus, query, selectedIds = new Set()) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  return (skus || [])
    .filter((sku) => !selectedIds.has(sku.id))
    .filter((sku) => {
      const name = (sku.name || '').toLowerCase();
      const codes = skuQrCodes(sku).map((code) => code.toLowerCase());
      return name.includes(needle) || codes.some((code) => code.includes(needle));
    })
    .slice(0, 8);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function skuPhotoSrc(item) {
  if (item?.photo_src) return item.photo_src;
  if (item?.photo_url && !isLocalPhotoUrl(item.photo_url)) return item.photo_url;
  return '';
}

function renderCollapsiblePanel({ id, title, expanded, bodyHtml }) {
  return `
    <div class="card sku-panel-card" id="${id}">
      <button type="button" class="sku-panel-toggle" data-action="toggle-panel" data-panel="${id}" aria-expanded="${expanded ? 'true' : 'false'}">
        <span>${escapeHtml(title)}</span>
        <span class="sku-panel-chevron" aria-hidden="true"></span>
      </button>
      <div class="sku-panel-body"${expanded ? '' : ' hidden'}>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderNewSkuPanel() {
  const draft = pageState.newSkuDraft;
  return renderCollapsiblePanel({
    id: 'sku-new-panel',
    title: 'Новый SKU',
    expanded: pageState.newSkuExpanded,
    bodyHtml: `
      <div class="form-row"><label>Название</label><input id="sku-name" placeholder="Томатная паста" value="${escapeHtml(draft.name)}" autocomplete="off" /></div>
      <div class="form-row"><label>Категория</label><input id="sku-category" placeholder="консервы" value="${escapeHtml(draft.category)}" autocomplete="off" /></div>
      <div class="form-row"><label>Единица</label><input id="sku-unit" placeholder="шт" value="${escapeHtml(draft.unit || 'шт')}" autocomplete="off" /></div>
      <div class="form-row"><label>Описание</label><input id="sku-desc" placeholder="400г" value="${escapeHtml(draft.description)}" autocomplete="off" /></div>
      <button class="primary" id="sku-create">Создать SKU</button>
    `,
  });
}

function renderQrSelectedRows(allSkus) {
  const byId = Object.fromEntries((allSkus || []).map((sku) => [sku.id, sku]));
  const selectedIds = Object.keys(pageState.qrCounts);
  if (!selectedIds.length) {
    return '<p class="empty">Добавьте SKU через поиск</p>';
  }

  return selectedIds.map((skuId) => {
    const sku = byId[skuId];
    if (!sku) return '';
    const count = pageState.qrCounts[skuId] || 1;
    const barcode = (sku.barcodes || [])[0] || '';
    return `
      <div class="sku-qr-row">
        <span class="sku-qr-row-name">${escapeHtml(sku.name)}</span>
        <span class="meta sku-qr-row-code">${escapeHtml(barcode || 'нет кода')}</span>
        <input type="number" min="1" max="999" value="${count}" data-action="qr-count" data-id="${sku.id}" />
        <button type="button" class="nav-btn" data-action="qr-remove" data-id="${sku.id}" aria-label="Удалить">×</button>
      </div>
    `;
  }).join('');
}

function renderQrSearchSuggestions(allSkus) {
  const selectedIds = new Set(Object.keys(pageState.qrCounts));
  const matches = filterSkusForQrSearch(allSkus, pageState.qrSearchQuery, selectedIds);
  if (!pageState.qrSearchQuery.trim()) return '';
  if (!matches.length) {
    return '<div class="sku-qr-suggest-empty meta">Ничего не найдено</div>';
  }

  return `
    <div class="sku-qr-suggest-list" role="listbox">
      ${matches.map((sku) => {
        const qrCode = skuQrCodes(sku)[0] || 'нет кода';
        return `
        <button type="button" class="sku-qr-suggest-item" data-action="qr-pick" data-id="${sku.id}">
          <span class="sku-qr-suggest-name">${escapeHtml(sku.name)}</span>
          <span class="meta">${escapeHtml(qrCode)}</span>
        </button>
      `;
      }).join('')}
    </div>
  `;
}

function renderQrPrintPanel(allSkus) {
  return renderCollapsiblePanel({
    id: 'sku-qr-panel',
    title: 'Печать QR кодов',
    expanded: pageState.qrPrintExpanded,
    bodyHtml: `
      <p class="sku-panel-hint">Найдите SKU по названию или QR-коду, добавьте в список и укажите количество QR. Размер QR — 2 см, под кодом название.</p>
      <div class="form-row sku-qr-search-wrap">
        <label for="sku-qr-search">Поиск SKU</label>
        <input id="sku-qr-search" type="search" autocomplete="off" placeholder="название или QR-код" value="${escapeHtml(pageState.qrSearchQuery)}" />
        ${renderQrSearchSuggestions(allSkus)}
      </div>
      <div class="sku-qr-list">${renderQrSelectedRows(allSkus)}</div>
      <button class="primary" id="sku-qr-print" type="button">Печать</button>
    `,
  });
}

function renderSkuDetail(sku) {
  const barcodes = (sku.barcodes || []).length
    ? sku.barcodes.map((code) => `<div class="meta">${escapeHtml(code)}</div>`).join('')
    : '<div class="meta">не назначен</div>';

  return `
    <div class="card sku-detail-card" id="sku-detail">
      <div class="sku-row">
        ${skuPhotoSrc(sku) ? `<img class="sku-photo sku-photo-large" src="${escapeHtml(skuPhotoSrc(sku))}" alt="" />` : '<div class="sku-photo sku-photo-large sku-photo-empty">нет фото</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(sku.name)}</h3>
          <div class="meta">Категория: ${escapeHtml(sku.category || '—')}</div>
          <div class="meta">Единица: ${escapeHtml(sku.unit || 'шт')}</div>
          <div class="meta">Статус: ${sku.is_active === false ? 'неактивен' : 'активен'}</div>
          ${sku.description ? `<div class="meta">Описание: ${escapeHtml(sku.description)}</div>` : ''}
          <div class="meta">ID: ${escapeHtml(sku.id)}</div>
          <div class="meta">Штрихкоды:</div>
          ${barcodes}
          ${sku.photo_pending ? '<div class="meta"><span class="badge">фото ожидает синхронизации</span></div>' : ''}
        </div>
      </div>
      <div class="sku-detail-actions">
        <button class="nav-btn" data-action="edit-sku" data-id="${sku.id}">Изменить</button>
        <button class="nav-btn" data-action="del-sku" data-id="${sku.id}">Удалить</button>
        <label class="nav-btn" style="cursor:pointer">
          Фото
          <input type="file" accept="image/*" hidden data-action="upload-photo" data-id="${sku.id}" />
        </label>
        <button class="nav-btn" data-action="close-sku-detail" type="button">Закрыть</button>
      </div>
    </div>
  `;
}

function renderSkuCard(sku) {
  const selected = pageState.selectedSkuId === sku.id;
  return `
    <button type="button" class="card sku-card sku-card-clickable${selected ? ' sku-card-selected' : ''}" data-action="open-sku" data-id="${sku.id}">
      <div class="sku-row">
        ${skuPhotoSrc(sku) ? `<img class="sku-photo" src="${escapeHtml(skuPhotoSrc(sku))}" alt="" />` : '<div class="sku-photo sku-photo-empty">нет фото</div>'}
        <div class="sku-info">
          <h3>${escapeHtml(sku.name)}</h3>
          <div class="meta">${escapeHtml(sku.category || '')} · ${escapeHtml(sku.unit)} · ${sku.is_active === false ? 'неактивен' : 'активен'}</div>
          ${sku.description ? `<div class="meta">${escapeHtml(sku.description)}</div>` : ''}
          <div class="meta">Штрихкод: ${escapeHtml((sku.barcodes || [])[0] || 'не назначен')}</div>
        </div>
      </div>
    </button>
  `;
}

export function renderSkuPage(items, { searchQuery = '', allSkus = [] } = {}) {
  return `
    ${renderNewSkuPanel()}
    ${renderQrPrintPanel(allSkus)}
    <div class="card">
      <div class="form-row"><label>Поиск</label><input id="sku-search" placeholder="название, категория или штрихкод" value="${escapeHtml(searchQuery)}" autocomplete="off" /></div>
    </div>
    <div id="sku-results">${renderSkuResults(items)}</div>
  `;
}

export function renderSkuResults(items) {
  const selected = items.find((item) => item.id === pageState.selectedSkuId) || null;
  const list = items.map((sku) => renderSkuCard(sku)).join('');
  return `
    ${selected ? renderSkuDetail(selected) : ''}
    ${list || '<p class="empty">Нет SKU</p>'}
  `;
}

function captureNewSkuDraftFromDom() {
  pageState.newSkuDraft = {
    name: document.getElementById('sku-name')?.value ?? pageState.newSkuDraft.name,
    category: document.getElementById('sku-category')?.value ?? pageState.newSkuDraft.category,
    unit: document.getElementById('sku-unit')?.value || pageState.newSkuDraft.unit || 'шт',
    description: document.getElementById('sku-desc')?.value ?? pageState.newSkuDraft.description,
  };
}

function clearNewSkuDraft() {
  pageState.newSkuDraft = {
    name: '',
    category: '',
    unit: 'шт',
    description: '',
  };
}

function restoreFocus(activeId) {
  if (!activeId) return;
  const el = document.getElementById(activeId);
  el?.focus();
}

function togglePanelExpanded(panelId) {
  if (panelId === 'sku-new-panel') {
    pageState.newSkuExpanded = !pageState.newSkuExpanded;
  }
  if (panelId === 'sku-qr-panel') {
    pageState.qrPrintExpanded = !pageState.qrPrintExpanded;
  }
  const panel = document.getElementById(panelId);
  const body = panel?.querySelector('.sku-panel-body');
  const toggle = panel?.querySelector('[data-action="toggle-panel"]');
  const expanded = panelId === 'sku-new-panel' ? pageState.newSkuExpanded : pageState.qrPrintExpanded;
  if (body) body.hidden = !expanded;
  toggle?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

export function bindSkuResultHandlers(root, { syncEngine, searchInput, refreshResults }) {
  root.querySelectorAll('[data-action="open-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      pageState.selectedSkuId = btn.dataset.id;
      await refreshResults(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="close-sku-detail"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      pageState.selectedSkuId = null;
      await refreshResults(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="del-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить SKU?')) return;
      await deleteSKU(btn.dataset.id);
      if (pageState.selectedSkuId === btn.dataset.id) {
        pageState.selectedSkuId = null;
      }
      delete pageState.qrCounts[btn.dataset.id];
      await refreshResults(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="edit-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = prompt('Новое название SKU:');
      if (!name) return;
      await updateSKU(btn.dataset.id, { name });
      await refreshResults(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="upload-photo"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadPhoto(input.dataset.id, file);
        syncEngine.sync();
        await refreshResults(searchInput?.value.trim() || '');
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

export function bindSkuPage(root, { syncEngine, onRefresh, onRefreshResults }) {
  const refreshResults = onRefreshResults || onRefresh;

  root.querySelectorAll('[data-action="toggle-panel"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      captureNewSkuDraftFromDom();
      togglePanelExpanded(btn.dataset.panel);
    });
  });

  ['sku-name', 'sku-category', 'sku-unit', 'sku-desc'].forEach((id) => {
    root.querySelector(`#${id}`)?.addEventListener('input', () => {
      captureNewSkuDraftFromDom();
    });
  });

  root.querySelector('#sku-create')?.addEventListener('click', async () => {
    captureNewSkuDraftFromDom();
    const { name, category, unit, description } = pageState.newSkuDraft;
    if (!name.trim()) return;
    await createSKU({
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim() || 'шт',
      description: description.trim(),
    });
    pageState.newSkuExpanded = false;
    clearNewSkuDraft();
    await onRefresh();
  });

  const searchInput = root.querySelector('#sku-search');
  searchInput?.addEventListener('input', async (e) => {
    await refreshResults(e.target.value.trim());
    const input = document.getElementById('sku-search');
    if (input) {
      input.value = e.target.value;
      input.focus();
    }
  });

  const qrSearchInput = root.querySelector('#sku-qr-search');
  qrSearchInput?.addEventListener('input', async (e) => {
    const activeId = document.activeElement?.id;
    pageState.qrSearchQuery = e.target.value;
    captureNewSkuDraftFromDom();
    await onRefresh(searchInput?.value.trim() || '');
    restoreFocus(activeId);
    const input = document.getElementById('sku-qr-search');
    if (input) {
      input.value = pageState.qrSearchQuery;
      input.focus();
    }
  });

  root.querySelectorAll('[data-action="qr-pick"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const skuId = btn.dataset.id;
      if (!skuId) return;
      pageState.qrCounts[skuId] = pageState.qrCounts[skuId] || 1;
      pageState.qrSearchQuery = '';
      captureNewSkuDraftFromDom();
      await onRefresh(searchInput?.value.trim() || '');
      document.getElementById('sku-qr-search')?.focus();
    });
  });

  root.querySelectorAll('[data-action="qr-remove"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      delete pageState.qrCounts[btn.dataset.id];
      captureNewSkuDraftFromDom();
      await onRefresh(searchInput?.value.trim() || '');
    });
  });

  bindSkuResultHandlers(root, { syncEngine, searchInput, refreshResults });

  root.querySelectorAll('[data-action="qr-count"]').forEach((input) => {
    input.addEventListener('input', () => {
      const skuId = input.dataset.id;
      const value = Math.max(1, Number(input.value) || 1);
      pageState.qrCounts[skuId] = value;
    });
  });

  root.querySelector('#sku-qr-print')?.addEventListener('click', async () => {
    const allItems = await loadSKUs('');
    const byId = Object.fromEntries(allItems.map((sku) => [sku.id, sku]));
    const entries = Object.entries(pageState.qrCounts)
      .filter(([, count]) => count > 0)
      .map(([skuId, count]) => ({ sku: byId[skuId], count }))
      .filter((entry) => entry.sku);
    try {
      await generateBatchSKUQRCodePDF(entries);
    } catch (err) {
      alert(err.message);
    }
  });
}

export function resetSkuPageStateForTests() {
  pageState.newSkuExpanded = false;
  pageState.qrPrintExpanded = false;
  pageState.selectedSkuId = null;
  pageState.qrCounts = {};
  pageState.qrSearchQuery = '';
  pageState.newSkuDraft = {
    name: '',
    category: '',
    unit: 'шт',
    description: '',
  };
}
