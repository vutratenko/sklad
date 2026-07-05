const routes = {
  home: { title: 'Главная', path: '/' },
  stocks: { title: 'Запасы', path: '/stocks' },
  movements: { title: 'Движения', path: '/movements' },
  warehouses: { title: 'Склады', path: '/warehouses' },
  skus: { title: 'SKU', path: '/skus' },
  scan: { title: 'Скан', path: '/scan' },
  sync: { title: 'Sync', path: '/sync' },
  login: { title: 'Вход', path: '/login' },
  oauthCallback: { title: 'OAuth', path: '/oauth/callback' },
};

export function initRouter(onRoute) {
  function currentRoute() {
    const path = window.location.pathname || '/';
    return Object.values(routes).find((r) => r.path === path) || routes.home;
  }

  function navigate(path) {
    window.history.pushState({}, '', path);
    onRoute(currentRoute());
  }

  window.addEventListener('popstate', () => onRoute(currentRoute()));

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      const route = routes[view] || routes.home;
      navigate(route.path);
    });
  });

  onRoute(currentRoute());
  return { navigate, routes };
}

export { routes };
