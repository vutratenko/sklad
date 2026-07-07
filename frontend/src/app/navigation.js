const AUTH_ONLY_VIEWS = new Set(['login']);

export function isNavViewVisible(view, authenticated) {
  if (authenticated) {
    return !AUTH_ONLY_VIEWS.has(view);
  }
  return AUTH_ONLY_VIEWS.has(view);
}

export function visibleNavViews(views, authenticated) {
  return views.filter((view) => isNavViewVisible(view, authenticated));
}
