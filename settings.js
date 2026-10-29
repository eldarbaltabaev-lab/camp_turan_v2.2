// settings.js

(function () {
  const PRINT_KEY    = 'print-settings-v1';
  const KEYWORDS_KEY = 'keyword-settings-v1';

  /* ============================================================
     НАСТРОЙКИ ПЕЧАТИ
     ============================================================ */

  const PRINT_DEFAULTS = {
    borderColor: '#999999',
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 12,
    titleSize: 14,
    padY: 6,
    padX: 10,
    margin: 10,
    pageSize: 'A4 portrait'
  };

  function loadPrint() {
    try {
      const raw = localStorage.getItem(PRINT_KEY);
      if (!raw) return { ...PRINT_DEFAULTS };
      return { ...PRINT_DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...PRINT_DEFAULTS };
    }
  }

  function savePrint(partial) {
    const next = { ...loadPrint(), ...partial };
    try { localStorage.setItem(PRINT_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function resetPrint() {
    localStorage.removeItem(PRINT_KEY);
    return { ...PRINT_DEFAULTS };
  }

  function getCss() {
    const s = loadPrint();
    return `
      @page { size: ${s.pageSize}; margin: ${s.margin}mm; }
      table { border-collapse: collapse; width: 100%; font-size: ${s.fontSize}px; }
      td, th {
        border: ${s.borderWidth}px ${s.borderStyle} ${s.borderColor};
        padding: ${s.padY}px ${s.padX}px;
      }
      h3 { font-size: ${s.titleSize}px; margin: 0 0 6px; }
    `;
  }

  /* ============================================================
     КЛЮЧЕВЫЕ СЛОВА (ЛОКАЦИИ)
     ============================================================ */

  const KEYWORDS_DEFAULTS = {
    version: 1,
    customLocations: [],        // [{ key: 'NEW', words: ['foo', 'bar'] }]
    extraWords: {},             // { ABK: ['допслово1', 'допслово2'] }
    customLunchboxPatterns: []  // ['новоеслово', 'ещё одно']
  };

  function loadKeywords() {
    try {
      const raw = localStorage.getItem(KEYWORDS_KEY);
      if (!raw) return { ...KEYWORDS_DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...KEYWORDS_DEFAULTS, ...parsed };
    } catch {
      return { ...KEYWORDS_DEFAULTS };
    }
  }

  function saveKeywords(partial) {
    const current = loadKeywords();
    const next = {
      ...current,
      ...partial,
      version: (current.version || 0) + 1
    };
    try { localStorage.setItem(KEYWORDS_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function resetKeywords() {
    localStorage.removeItem(KEYWORDS_KEY);
    return { ...KEYWORDS_DEFAULTS };
  }

  // ---- Свои локации ----
  function getCustomLocations() {
    return loadKeywords().customLocations || [];
  }

  function addCustomLocation(key, words) {
    const list = [...getCustomLocations()];
    list.push({
      key: String(key || '').toUpperCase().trim(),
      words: (words || []).slice()
    });
    return saveKeywords({ customLocations: list });
  }

  function updateCustomLocation(index, key, words) {
    const list = [...getCustomLocations()];
    if (!list[index]) return loadKeywords();
    list[index] = {
      key: String(key || '').toUpperCase().trim(),
      words: (words || []).slice()
    };
    return saveKeywords({ customLocations: list });
  }

  function removeCustomLocation(index) {
    const list = [...getCustomLocations()];
    list.splice(index, 1);
    return saveKeywords({ customLocations: list });
  }

  // ---- Доп. слова к встроенным локациям ----
  function getExtraWords() {
    return loadKeywords().extraWords || {};
  }

  function setExtraWords(key, words) {
    const extra = { ...getExtraWords() };
    if (words && words.length) extra[key] = words.slice();
    else delete extra[key];
    return saveKeywords({ extraWords: extra });
  }

  // ---- Метки ланчбокса ----
  function getCustomLunchboxPatterns() {
    return loadKeywords().customLunchboxPatterns || [];
  }

  function addLunchboxPatterns(words) {
    const list = [...getCustomLunchboxPatterns()];
    for (const w of (words || [])) {
      const trimmed = String(w).trim();
      if (trimmed && !list.includes(trimmed)) list.push(trimmed);
    }
    return saveKeywords({ customLunchboxPatterns: list });
  }

  function removeLunchboxPattern(word) {
    const list = getCustomLunchboxPatterns().filter((w) => w !== word);
    return saveKeywords({ customLunchboxPatterns: list });
  }

  function getVersion() {
    return loadKeywords().version || 0;
  }

  /* ============================================================
     ЭКСПОРТ
     ============================================================ */

  window.PrintSettings = {
    DEFAULTS: PRINT_DEFAULTS,
    load: loadPrint,
    save: savePrint,
    reset: resetPrint,
    getCss
  };

  window.KeywordSettings = {
    getCustomLocations,
    addCustomLocation,
    updateCustomLocation,
    removeCustomLocation,
    getExtraWords,
    setExtraWords,
    getCustomLunchboxPatterns,
    addLunchboxPatterns,
    removeLunchboxPattern,
    getVersion,
    reset: resetKeywords
  };
})();
/* ---------- Логика переключения темы (работает на всех страницах) ---------- */
function initTheme() {
  const saved = localStorage.getItem('site-theme') || 'dark';
  document.documentElement.dataset.theme = saved;

  // Ищем кнопку на странице
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Устанавливаем правильную иконку при загрузке
  btn.textContent = saved === 'dark' ? '☀️' : '🌙';

  // Обработчик клика
  btn.addEventListener('click', () => {
    const current = document.body.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.dataset.theme = next;
    localStorage.setItem('site-theme', next);
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

// Запускаем после загрузки HTML
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
/* ---------- Логика переключения темы (безопасная) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Получаем текущую тему (теперь она хранится в теге <html>, а не <body>)
  let currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  // Ставим правильную иконку
  btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

  // Обработчик клика
  btn.addEventListener('click', () => {
    // Меняем тему на противоположную
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Применяем к тегу <html>
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Сохраняем в память
    localStorage.setItem('site-theme', currentTheme);
    
    // Меняем иконку
    btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  });
});