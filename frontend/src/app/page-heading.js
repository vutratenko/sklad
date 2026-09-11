function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

export function renderPageHeading({ eyebrow = '', title = '' } = {}) {
  return `
    <header class="page-heading">
      <p class="page-heading-eyebrow">${escapeHtml(eyebrow)}</p>
      <h2 class="page-heading-title">${escapeHtml(title)}</h2>
    </header>
  `;
}
