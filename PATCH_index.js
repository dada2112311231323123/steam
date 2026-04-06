/**
 * ═══════════════════════════════════════════════════════════════════
 * ПАТЧ для index.html
 *
 * Заменить в <script> блоке следующие методы объекта Scanner:
 *   • toggle()   — теперь собирает конфиг из UI и отправляет на сервер
 *   • _getConfig() — новый метод, читает все поля конфига по режиму
 *
 * Также заменить метод SimPage.run() — теперь использует market_hash_name.
 * ═══════════════════════════════════════════════════════════════════
 *
 * ИНСТРУКЦИЯ:
 *   Найдите в index.html строку:
 *     async toggle() {
 *   (внутри объекта Scanner)
 *   и замените весь метод toggle() + reset() на код ниже.
 *
 *   Затем найдите:
 *     async reset() {
 *   и замените на версию ниже.
 */

// ═══ ЗАМЕНИТЬ В Scanner: toggle() и добавить _getConfig() ═══════════

  async toggle() {
    if (State.scanRunning) {
      const res = await API.post('/scan/stop').catch(() => ({ ok: false }));
      if (res.ok) Toast.show('Остановлено', 'info');
    } else {
      const cfg = Scanner._getConfig();
      const res = await API.post('/scan/start', { mode: State.scanMode, ...cfg })
        .catch(() => ({ ok: false }));
      if (res.ok) {
        Toast.show('Сканирование запущено · ' + State.scanMode, 'ok');
      } else {
        Toast.show(res.error || 'Сервер недоступен', 'err');
      }
    }
  },

  /**
   * Читает значения конфига из UI по текущему режиму сканера.
   * Вызывается перед /scan/start.
   */
  _getConfig() {
    const g    = id => { const el = document.getElementById(id); return el ? el.value : null; };
    const mode = State.scanMode;

    if (mode === 'quick') {
      return {
        typeFilter:  g('quick-type-filter'),
        eventFilter: g('quick-event-filter'),
        cacheSkip:   parseInt(g('quick-cache-skip'), 10) || 5,
      };
    }

    if (mode === 'deep') {
      return {
        typeFilter:  g('deep-type-filter'),
        orderDepth:  parseInt(g('deep-order-depth'), 10) || 10,
        delay:       parseInt(g('deep-delay'), 10) || 4000,
      };
    }

    if (mode === 'history') {
      // market_hash_name берём из readonly input (выбранный предмет)
      const itemInput = document.getElementById('scan-history-item');
      return {
        item:   itemInput ? itemInput.value : '',
        from:   g('scan-date-from'),
        to:     g('scan-date-to'),
        period: g('scan-period-preset'),
      };
    }

    if (mode === 'category') {
      // Собираем выбранные chips (.cat-chip.selected)
      const cats = [...document.querySelectorAll('#category-chips .cat-chip.selected')]
        .map(el => el.dataset.cat || el.textContent.trim().replace(/[🏷📦🔫🎁]/g, '').trim().toLowerCase());
      return {
        lang:     g('cat-lang'),
        maxItems: parseInt(g('cat-max-items'), 10) || 500,
        sort:     g('cat-sort'),
        cats,
      };
    }

    return {};
  },

// ═══ ЗАМЕНИТЬ В Scanner: reset() ════════════════════════════════════

  async reset() {
    await API.post('/scan/reset').catch(() => {});
    Toast.show('Очередь сброшена', 'info');
  },

// ═══ ДОБАВИТЬ data-cat атрибуты на .cat-chip в HTML ═════════════════
// Найти в HTML блок id="category-chips" и добавить data-cat:
//
//   <div class="cat-chip selected" id="cat-chip-sticker"
//        data-cat="sticker" onclick="Scanner.toggleCat(this,'sticker')">🏷 Наклейки</div>
//   <div class="cat-chip" id="cat-chip-capsule"
//        data-cat="capsule" onclick="Scanner.toggleCat(this,'capsule')">📦 Капсулы</div>
//   <div class="cat-chip" id="cat-chip-weapon"
//        data-cat="weapon"  onclick="Scanner.toggleCat(this,'weapon')">🔫 Оружие</div>
//   <div class="cat-chip" id="cat-chip-case"
//        data-cat="case"    onclick="Scanner.toggleCat(this,'case')">🎁 Кейсы</div>
//   ... и т.д.

// ═══ ЗАМЕНИТЬ SimPage.run() — передаёт market_hash_name ══════════════
// Найти в SimPage объекте метод run() и заменить на:

  async run() {
    const nameEl = document.getElementById('sim-item-name');
    const hashEl = document.getElementById('sim-item-hash');
    const name   = nameEl ? nameEl.textContent.trim() : '';
    const hash   = hashEl ? hashEl.textContent.trim() : '';

    if (!name || name === 'Нажмите для выбора предмета') {
      Toast.show('Сначала выберите предмет', 'warn');
      return;
    }

    // Используем market_hash_name если доступен, иначе name
    const item = (hash && hash !== 'market_hash_name') ? hash : name;

    document.getElementById('sim-status').textContent = '⟳ запрос...';
    document.getElementById('sim-status').style.color = 'var(--orange)';
    const body = document.getElementById('sim-console-body');
    body.innerHTML = `
      <div class="sim-log-sep">── запрос к Steam API ──────────────────────────</div>
      <div class="sim-log-line">
        <span class="sim-log-key">item</span>
        <span class="sim-log-val">${item}</span>
      </div>
      <div class="sim-log-line">
        <span class="sim-log-key">params</span>
        <span class="sim-log-val v-gold">[${[...this.activeParams].join(', ')}]</span>
      </div>`;

    try {
      const res = await API.post('/simulate', { item, params: [...this.activeParams] });
      this._renderResponse(res);
    } catch (e) {
      document.getElementById('sim-status').textContent = 'ошибка';
      document.getElementById('sim-status').style.color = 'var(--red)';
      body.innerHTML += `<div class="sim-log-line">
        <span class="sim-log-key">error</span>
        <span class="sim-log-val v-red">Сервер недоступен</span>
      </div>`;
    }
  },

// ═══ ТАКЖЕ: в ItemList.openPickerForScan() добавить запись item в поле ══
// Найти openPickerForScan() в ItemList и заменить на:

  openPickerForScan() {
    // Устанавливаем флаг — при выборе предмета из базы он запишется в поле сканера
    State._pickingForScan = true;
    Toast.show('Выберите предмет из базы данных', 'info');
    Navigation.go('database', document.querySelector('[data-page="database"]'));
  },

// ═══ ТАКЖЕ: в ItemDetail.open() добавить заполнение поля сканера ════════
// В методе open() ПОСЛЕ строки `State.selectedItemId = itemId;` добавить:
//
//   // Если открыт выбор предмета для сканера — записываем hash_name в поле
//   if (State._pickingForScan) {
//     const inp = document.getElementById('scan-history-item');
//     if (inp && cached) {
//       inp.value = cached.market_hash_name || cached.name;
//       State._pickingForScan = false;
//       Navigation.go('scanner', document.querySelector('[data-page="scanner"]'));
//       Toast.show('Предмет выбран: ' + (cached.market_hash_name || cached.name), 'ok');
//     }
//   }
