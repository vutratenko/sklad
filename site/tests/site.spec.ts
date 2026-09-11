import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { siteUrl } from '../site.config.js';

for (const width of [1440, 1280, 1024, 768, 390, 375]) {
  test(`layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith('http://127.0.0.1') && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Всё на своих\s*местах\./);
    await expect(page.locator('.hero-description')).toHaveText(/лежит\.\s+Домашние/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const overflowing = await page
      .locator('main h1, main h2, main h3, main button')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.textContent)
      );
    expect(overflowing).toEqual([]);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))
      }))
    ).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/sklad-${width}.png`, fullPage: true });
  });
}

test('catalog search, shelf filter and all demo views work', async ({ page }) => {
  await page.goto('./');
  const demo = page.getByRole('figure', { name: 'Интерактивная схема интерфейса Sklad' });
  await page.getByRole('searchbox').fill('томаты');
  await expect(demo.locator('.product-row')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('combobox').selectOption('Нижняя полка');
  await expect(demo.locator('.product-row')).toHaveCount(2);
  await page.getByRole('searchbox').fill('нет такого товара');
  await expect(demo.getByText(/Ничего не найдено/)).toBeVisible();
  await demo.getByRole('button', { name: 'SKU', exact: true }).click();
  await expect(demo.getByText('4600000000015', { exact: true })).toBeVisible();
  await demo.getByRole('button', { name: 'Склады', exact: true }).click();
  await expect(demo.getByText('Шкаф у окна', { exact: true })).toBeVisible();
  await demo.getByRole('button', { name: 'Движения', exact: true }).click();
  await expect(demo.getByText('Корректировка', { exact: true })).toBeVisible();
});

test('scanner example and offline queue respond to user actions', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Посмотреть, как это работает' }).click();
  await expect(page.getByText('Найдено в каталоге', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить демонстрацию' }).click();
  await expect(page.getByText('Наведите камеру на код', { exact: true })).toBeVisible();
  const network = page.getByRole('switch', { name: 'Режим без сети в демонстрации' });
  await network.click();
  await expect(network).toBeChecked();
  await page.getByRole('button', { name: 'Списать 1 шт.' }).click();
  await page.getByRole('button', { name: 'Списать 1 шт.' }).click();
  await expect(page.getByText(/Сохранено на устройстве. В очереди: 2/)).toBeVisible();
  await network.click();
  await expect(page.getByText('Все изменения отправлены на сервер. Операций: 2.')).toBeVisible();
});

test('mobile navigation closes on selection and Escape, with keyboard focus restored', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  const toggle = page.getByRole('button', { name: 'Открыть меню' });
  await toggle.click();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Возможности' })
    .click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#features$/);
});

test('terminal copies runnable commands and reports clipboard failures', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: 'Скопировать команды запуска' }).click();
  await expect(page.getByText('Команды скопированы', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'git clone https://github.com/vutratenko/sklad.git\ncd sklad\nmake up'
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('denied'))
    });
  });
  await page.getByRole('button', { name: 'Скопировать команды запуска' }).click();
  await expect(page.getByText('Выделите и скопируйте команды вручную')).toBeVisible();
});

test('static content, metadata, assets and sitemap use the Pages URL', async ({
  browser,
  request,
  baseURL
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: 'Простой внутри.' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', siteUrl.href);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${siteUrl.href}og.png`
  );
  const robots = await request.get('robots.txt');
  expect(await robots.text()).toContain(`${siteUrl.href}sitemap.xml`);
  const sitemap = await request.get('sitemap.xml');
  expect(await sitemap.text()).toContain(`<loc>${siteUrl.href}</loc>`);
  for (const asset of ['favicon.svg', 'og.png']) {
    const response = await request.get(asset);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/');
  }
  await context.close();
});

test('reduced motion disables the scanner animation and smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  expect(
    await page.locator('.scan-line').evaluate((element) => getComputedStyle(element).animationName)
  ).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'auto'
  );
});
