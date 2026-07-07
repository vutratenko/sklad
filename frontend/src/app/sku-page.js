import {
  createSKU,
  deleteSKU,
  loadSKUs,
  updateSKU,
  uploadPhoto,
} from './views/catalog.js';
import { generateBatchSKUQRCodePDF } from './sku-label-pdf.js';

const pageState = {
  newSkuExpanded: false,
  qrPrintExpanded: false,
  selectedSkuId: null,
  qrCounts: {},
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function skuPhotoSrc(item) {
  return item?.photo_src || item?.photo_url || '';
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
  return renderCollapsiblePanel({
    id: 'sku-new-panel',
    title: 'Новый SKU',
    expanded: pageState.newSkuExpanded,
    bodyHtml: `
      <div class="form-row"><label>Название</label><input id="sku-name" placeholder="Томатная паста" /></div>
      <div class="form-row"><label>Категория</label><input id="sku-category" placeholder="консервы" /></div>
      <div class="form-row"><label>Единица</label><input id="sku-unit" placeholder="шт" value="шт" /></div>
      <div class="form-row"><label>Описание</label><input id="sku-desc" placeholder="400г" /></div>
      <button class="primary" id="sku-create">Создать SKU</button>
    `,
  });
}

function renderQrPrintPanel(items) {
  const rows = items.map((sku) => {
    const checked = (pageState.qrCounts[sku.id] || 0) > 0;
    const count = pageState.qrCounts[sku.id] || 1;
    const barcode = (sku.barcodes || [])[0] || '';
    return `
      <label class="sku-qr-row">
        <input type="checkbox" data-action="qr-toggle" data-id="${sku.id}"${checked ? ' checked' : ''}${barcode ? '' : ' disabled title="Нет штрихкода"'} />
        <span class="sku-qr-row-name">${escapeHtml(sku.name)}</span>
        <span class="meta sku-qr-row-code">${escapeHtml(barcode || 'нет кода')}</span>
        <input type="number" min="1" max="999" value="${count}" data-action="qr-count" data-id="${sku.id}"${checked ? '' : ' disabled'} />
      </label>
    `;
  }).join('');

  return renderCollapsiblePanel({
    id: 'sku-qr-panel',
    title: 'Печать QR кодов',
    expanded: pageState.qrPrintExpanded,
    bodyHtml: `
      <p class="sku-panel-hint">Выберите SKU и количество QR на странице. Размер QR — 2 см, под кодом название.</p>
      <div class="sku-qr-list">${rows || '<p class="empty">Нет SKU</p>'}</div>
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

export function renderSkuPage(items, { searchQuery = '' } = {}) {
  const selected = items.find((item) => item.id === pageState.selectedSkuId) || null;
  const list = items.map((sku) => renderSkuCard(sku)).join('');

  return `
    ${renderNewSkuPanel()}
    ${renderQrPrintPanel(items)}
    <div class="card">
      <div class="form-row"><label>Поиск</label><input id="sku-search" placeholder="название, категория или штрихкод" value="${escapeHtml(searchQuery)}" /></div>
    </div>
    ${selected ? renderSkuDetail(selected) : ''}
    ${list || '<p class="empty">Нет SKU</p>'}
  `;
}

export function bindSkuPage(root, { syncEngine, onRefresh }) {
  root.querySelectorAll('[data-action="toggle-panel"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      if (panelId === 'sku-new-panel') {
        pageState.newSkuExpanded = !pageState.newSkuExpanded;
      }
      if (panelId === 'sku-qr-panel') {
        pageState.qrPrintExpanded = !pageState.qrPrintExpanded;
      }
      onRefresh();
    });
  });

  root.querySelector('#sku-create')?.addEventListener('click', async () => {
    const name = document.getElementById('sku-name')?.value.trim();
    const category = document.getElementById('sku-category')?.value.trim();
    const unit = document.getElementById('sku-unit')?.value.trim() || 'шт';
    const description = document.getElementById('sku-desc')?.value.trim();
    if (!name) return;
    await createSKU({ name, category, unit, description });
    pageState.newSkuExpanded = false;
    await onRefresh();
  });

  const searchInput = root.querySelector('#sku-search') || document.getElementById('sku-search');
  searchInput?.addEventListener('input', async (e) => {
    await onRefresh(e.target.value.trim());
    const input = document.getElementById('sku-search');
    if (input) {
      input.value = e.target.value;
      input.focus();
    }
  });

  root.querySelectorAll('[data-action="open-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      pageState.selectedSkuId = btn.dataset.id;
      await onRefresh(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="close-sku-detail"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      pageState.selectedSkuId = null;
      await onRefresh(searchInput?.value.trim() || '');
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
      await onRefresh(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="edit-sku"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = prompt('Новое название SKU:');
      if (!name) return;
      await updateSKU(btn.dataset.id, { name });
      await onRefresh(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="upload-photo"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadPhoto(input.dataset.id, file);
        syncEngine.sync();
        await onRefresh(searchInput?.value.trim() || '');
      } catch (err) {
        alert(err.message);
      }
    });
  });

  root.querySelectorAll('[data-action="qr-toggle"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const skuId = input.dataset.id;
      if (input.checked) {
        pageState.qrCounts[skuId] = pageState.qrCounts[skuId] || 1;
      } else {
        delete pageState.qrCounts[skuId];
      }
      await onRefresh(searchInput?.value.trim() || '');
    });
  });

  root.querySelectorAll('[data-action="qr-count"]').forEach((input) => {
    input.addEventListener('input', () => {
      const skuId = input.dataset.id;
      const value = Math.max(1, Number(input.value) || 1);
      pageState.qrCounts[skuId] = value;
    });
  });

  root.querySelector('#sku-qr-print')?.addEventListener('click', async () => {
    const items = await loadSKUs(searchInput?.value.trim() || '');
    const entries = items
      .filter((sku) => (pageState.qrCounts[sku.id] || 0) > 0)
      .map((sku) => ({ sku, count: pageState.qrCounts[sku.id] }));
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
}
