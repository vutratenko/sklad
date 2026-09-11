export const repository = 'https://github.com/vutratenko/sklad';
export const docs = `${repository}/blob/main/docs/README.md`;
export const installation = `${repository}#быстрый-старт`;
export const helm = `${repository}/blob/main/infra/helm/sklad/README.md`;

// Illustrative household data only; never represented as a live installation.
export const products = [
  {
    name: 'Томаты в собственном соку',
    short: 'Томаты',
    category: 'Консервы',
    unit: 'шт.',
    quantity: 12,
    location: 'Верхняя полка',
    kind: 'tomato',
    barcode: '4600000000015',
    description: '400 г'
  },
  {
    name: 'Говядина тушёная',
    short: 'Тушёнка',
    category: 'Консервы',
    unit: 'шт.',
    quantity: 6,
    location: 'Верхняя полка',
    kind: 'tin',
    barcode: '4600000000022',
    description: '325 г'
  },
  {
    name: 'Макароны',
    short: 'Макароны',
    category: 'Бакалея',
    unit: 'уп.',
    quantity: 4,
    location: 'Нижняя полка',
    kind: 'pasta',
    barcode: '4600000000039',
    description: '500 г'
  },
  {
    name: 'Гречневая крупа',
    short: 'Гречка',
    category: 'Бакалея',
    unit: 'уп.',
    quantity: 2,
    location: 'Нижняя полка',
    kind: 'grain',
    barcode: '4600000000046',
    description: '800 г'
  }
] as const;

export const movements = [
  {
    symbol: '+',
    name: 'Приход',
    product: 'Томаты в собственном соку',
    detail: 'Кладовка · Верхняя полка',
    quantity: '+4 шт.'
  },
  {
    symbol: '−',
    name: 'Расход',
    product: 'Говядина тушёная',
    detail: 'Кладовка · Верхняя полка',
    quantity: '−1 шт.'
  },
  {
    symbol: '→',
    name: 'Перемещение',
    product: 'Макароны',
    detail: 'Кладовка → Кухня',
    quantity: '2 уп.'
  },
  {
    symbol: '=',
    name: 'Корректировка',
    product: 'Гречневая крупа',
    detail: 'Кладовка · Нижняя полка',
    quantity: '+1 уп.'
  }
] as const;
