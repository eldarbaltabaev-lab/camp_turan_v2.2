// classifier.js

/* ============================================================
   ВСТРОЕННЫЕ ЛОКАЦИИ (базовые правила, менять осторожно)
   ============================================================ */

   export const BUILTIN_LOCATION_MAP = [
    { key: 'ABK', patterns: [/abk/i, /а[-\s]?б[-\s]?к/i, /карьер/i] },
    { key: 'MMA', patterns: [/mma/i, /мма/i, /supply\s*chain\s*management/i] },
    { key: 'OXD', patterns: [/oxd/i, /оксд/i, /оксидн/i] },
    { key: 'SP1', patterns: [/sp[\s\-–—]*1/i, /сф[\s\-–—]*1/i] },
    { key: 'SP2', patterns: [/sp[\s\-–—]*2/i, /сф[\s\-–—]*2/i] },
    {
      key: 'WS1',
      patterns: [
        /ws[\s\-–—]*1/i,
        /воркшоп[\s\-–—]*1/i,
        /workshop[\s\-–—]*1/i,
        /akt[\s\-–—]*1/i,
        /акт[\s\-–—]*1/i
      ]
    },
    {
      key: 'WS2',
      patterns: [
        /ws[\s\-–—]*2/i,
        /воркшоп[\s\-–—]*2/i,
        /workshop[\s\-–—]*2/i,
        /akt[\s\-–—]*2/i,
        /акт[\s\-–—]*2/i,
        /служба\s*планирования/i
      ]
    },
    {
      key: 'LBX',
      patterns: [
        /laboratory/i,
        /лаборатор/i,
        /(?:^|[^a-z])pab(?:[^a-z]|$)/i,
        /(?:^|[^а-яё])паб(?:[^а-яё]|$)/i,
        /завод\s*1[\s\-–—]*офис\s*электрики/i,
        /завод\s*2[\s\-–—]*офис\s*электрики/i,
        /офис\s*службы\s*кранов/i,
        /самовывоз\s*туран/i,
        /ж\.?\s*д\.?\s*отдел/i,
        /тархан/i,
        /зал\s*ожидания/i,
        /карьер\s*каменный/i,
        /кпп\s*№?\s*1/i,
        /медный\s*ангар/i,
        /насосн/i,
        /ps[\s\-–—]*3/i,
        /диетическое/i
      ]
    }
  ];
  
  export const BUILTIN_LUNCHBOX_PATTERNS = [
    /ланч\s*бокс/i,
    /ланчбокс/i,
    /lunch\s*box/i,
    /lunchbox/i,
    /\blbx\b/i,
    /\bлбх\b/i,
    /диет/i,
    /diet/i,
    /ланч/i
  ];
  
  /* ============================================================
     СБОРКА АКТУАЛЬНОЙ КАРТЫ (встроенные + пользовательские)
     ============================================================ */
  
  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  function wordsToRegexps(words) {
    return (words || [])
      .map((w) => String(w).trim())
      .filter(Boolean)
      .map((w) => new RegExp(escapeRegex(w), 'i'));
  }
  
  let _cachedMap = null;
  let _cachedLunchbox = null;
  let _cachedVersion = -1;
  
  function currentVersion() {
    return (typeof window !== 'undefined' && window.KeywordSettings)
      ? window.KeywordSettings.getVersion()
      : -1;
  }
  
  function refreshCacheIfNeeded() {
    const v = currentVersion();
    if (v !== _cachedVersion) {
      _cachedMap = null;
      _cachedLunchbox = null;
      _cachedVersion = v;
    }
  }
  
  export function getLocationMap() {
    refreshCacheIfNeeded();
    if (_cachedMap) return _cachedMap;
  
    const map = BUILTIN_LOCATION_MAP.map((entry) => ({
      key: entry.key,
      patterns: [...entry.patterns],
      builtin: true
    }));
  
    if (typeof window !== 'undefined' && window.KeywordSettings) {
      // доп. слова к встроенным
      const extra = window.KeywordSettings.getExtraWords();
      for (const entry of map) {
        const words = extra[entry.key];
        if (Array.isArray(words) && words.length) {
          entry.patterns.push(...wordsToRegexps(words));
        }
      }
  
      // пользовательские локации
      const custom = window.KeywordSettings.getCustomLocations();
      for (const c of custom) {
        if (!c.key) continue;
        map.push({
          key: c.key,
          patterns: wordsToRegexps(c.words),
          builtin: false
        });
      }
    }
  
    _cachedMap = map;
    return map;
  }
  
  export function getLunchboxPatterns() {
    refreshCacheIfNeeded();
    if (_cachedLunchbox) return _cachedLunchbox;
  
    const patterns = [...BUILTIN_LUNCHBOX_PATTERNS];
  
    if (typeof window !== 'undefined' && window.KeywordSettings) {
      const custom = window.KeywordSettings.getCustomLunchboxPatterns();
      patterns.push(...wordsToRegexps(custom));
    }
  
    _cachedLunchbox = patterns;
    return patterns;
  }
  
  export function getLocationKeys() {
    return getLocationMap().map((e) => e.key);
  }
  
  /* ============================================================
     ПУБЛИЧНЫЕ ФУНКЦИИ
     ============================================================ */
  
  export function resolveLocation(raw) {
    if (!raw) return { key: 'UNKNOWN', raw: null };
    const s = String(raw);
    for (const { key, patterns } of getLocationMap()) {
      if (patterns.some((re) => re.test(s))) return { key, raw: s };
    }
    return { key: 'UNKNOWN', raw: s };
  }
  
  export function isLunchbox(rowText) {
    const s = String(rowText ?? '');
    return getLunchboxPatterns().some((re) => re.test(s));
  }