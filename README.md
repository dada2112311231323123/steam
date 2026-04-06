# CS2 MARKET TERMINAL — Backend

## Структура проекта

```
cs2-terminal/
│
├── server.js                   ← точка входа, Express + WS
├── package.json
│
├── public/
│   └── index.html              ← СКОПИРОВАТЬ ТВОЙ index.html СЮДА
│
├── routes/
│   ├── items.js                ← CRUD предметов
│   ├── scan.js                 ← управление сканером
│   ├── simulate.js             ← одиночный запрос к Steam API
│   ├── settings.js             ← настройки
│   └── cache.js                ← кэш
│
├── services/
│   ├── db.js                   ← JSON-база данных (чтение/запись файлов)
│   ├── steamApi.js             ← все HTTP-запросы к Steam Market
│   └── scanner.js              ← движок сканера, очередь, WS-эвенты
│
├── data/
│   ├── items.json              ← база предметов
│   ├── settings.json           ← настройки пользователя
│   ├── history.json            ← история цен (pricehistory)
│   └── scan_state.json         ← состояние сканера (для перезапуска)
│
└── PATCH_index.js              ← изменения, которые нужно внести в index.html
```

---

## Установка и запуск

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать index.html в папку public/
mkdir -p public
cp /путь/к/твоему/index.html public/index.html

# 3. Внести патчи из PATCH_index.js в public/index.html

# 4. Запустить сервер
npm start
# или для разработки с авто-перезапуском:
npm run dev

# 5. Открыть в браузере
# http://localhost:3000
```

---

## API Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/ping | проверка сервера |
| GET | /api/items | список предметов (фильтры: search, type, limit) |
| GET | /api/items/stats | KPI: total, scanned, avgPrice, totalValue |
| GET | /api/items/:id | один предмет (полные данные) |
| POST | /api/items | добавить предмет { market_hash_name } |
| POST | /api/items/import | импорт массива предметов |
| DELETE | /api/items/:id | удалить предмет |
| GET | /api/export/items | скачать базу как JSON |
| GET | /api/scan/status | статус сканера |
| POST | /api/scan/start | запустить { mode, ...config } |
| POST | /api/scan/stop | остановить |
| POST | /api/scan/reset | сбросить очередь |
| POST | /api/simulate | одиночный запрос { item, params[] } |
| GET | /api/settings | загрузить настройки |
| POST | /api/settings | сохранить настройки |
| GET | /api/cache/stats | статистика кэша |
| DELETE | /api/cache | очистить кэш |

---

## WebSocket Events (сервер → клиент)

| Тип | Поля | Когда |
|-----|------|-------|
| `scan:status` | running, done, total, queue, errors, mode | каждый шаг, старт/стоп |
| `scan:log` | logType (ok/err/info/warn), text | каждое событие лога |
| `scan:item` | name, price, volume | предмет успешно отсканирован |
| `scan:current` | name | начало скана предмета |

---

## Режимы сканера — что отправляет UI на /api/scan/start

### Quick Sweep
```json
{
  "mode": "quick",
  "typeFilter": "Sticker",
  "eventFilter": "Paris 2023",
  "cacheSkip": 5
}
```

### Deep Scan
```json
{
  "mode": "deep",
  "typeFilter": "Все типы",
  "orderDepth": 10,
  "delay": 4000
}
```

### 1 Item History
```json
{
  "mode": "history",
  "item": "Sticker | s1mple | Paris 2023",
  "from": "2023-01-01",
  "to": "2023-12-31",
  "period": "1y"
}
```

### Category Fetch
```json
{
  "mode": "category",
  "lang": "english",
  "maxItems": 500,
  "sort": "По популярности",
  "cats": ["sticker", "capsule"]
}
```

---

## Simulate — маппинг параметров

| UI checkbox ID | activeParams ключ | Ответ сервера |
|----------------|-------------------|---------------|
| sim-chk-price_now | price_now | lowest_price |
| sim-chk-price_median | price_median | median_price |
| sim-chk-price_avg | price_avg | average_price |
| sim-chk-price_day | price_day | price_day (null) |
| sim-chk-price_week | price_week | price_week (null) |
| sim-chk-vol_24h | vol_24h | volume |
| sim-chk-vol_7d | vol_7d | volume_7d (null) |
| sim-chk-vol_30d | vol_30d | volume_30d (null) |
| sim-chk-buy_order | buy_order | highest_buy_order |
| sim-chk-sell_order | sell_order | lowest_sell_order |
| sim-chk-orderbook | orderbook | orderbook {buy[], sell[]} |
| sim-chk-hist_full | history_full | ← не делает запрос |
| sim-chk-hist_range | history_range | ← не делает запрос |

---

## Патч index.html — что менять

Открой `PATCH_index.js` — там пошагово описано:

1. **Scanner.toggle()** — теперь собирает конфиг из UI и отправляет на сервер
2. **Scanner._getConfig()** — новый метод, читает поля по режиму
3. **Scanner.reset()** — без изменений логики, оставить как есть
4. **SimPage.run()** — правильно берёт `market_hash_name` вместо `name`
5. **cat-chip** элементы — добавить `data-cat="sticker"` атрибуты
6. **ItemList.openPickerForScan()** — устанавливает флаг `_pickingForScan`
7. **ItemDetail.open()** — при флаге записывает hash в поле сканера

---

## Заметки по Steam API

- **priceoverview** — публичный, не требует авторизации
- **itemordershistogram** — публичный, но сначала нужно получить `item_nameid` со страницы листинга (один доп. запрос на предмет в Deep Scan)
- **pricehistory** — требует cookie `steamLoginSecure` (добавить в Настройки → API Key)
- **search/render** — публичный, возвращает JSON с `norender=1`

### Rate limiting
По умолчанию минимальная задержка 2000 мс. Steam блокирует IP при < 1500 мс.
Deep Scan делает 2 запроса на предмет: рекомендуется задержка 4000+ мс.
