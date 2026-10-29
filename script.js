import { parseWorkbook } from './excel-parser.js';
import { countWorkbook, sumResults, getCategories } from './counter.js';




const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');

let processing = false;

/* ---------- Панели (Что нового и Справка) ---------- */
/* ---------- Панели (Что нового и Справка) ---------- */
(function initPanels() {
  const whatsNewBtn = document.getElementById('whatsNewBtn');
  const whatsNewPanel = document.getElementById('whatsNewPanel');
  const whatsNewClose = document.getElementById('whatsNewClose');

  const helpBtn = document.getElementById('helpBtn');
  const helpPanel = document.getElementById('helpPanel');
  const helpClose = document.getElementById('helpClose');

  // Функция для закрытия всех панелей
  function closeAll() {
    if (whatsNewPanel) whatsNewPanel.classList.add('hidden');
    if (helpPanel) helpPanel.classList.add('hidden');
  }

  // Настройка кнопки "Что нового"
  if (whatsNewBtn && whatsNewPanel) {
    whatsNewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = whatsNewPanel.classList.contains('hidden');
      closeAll();
      if (isHidden) whatsNewPanel.classList.remove('hidden');
    });
  }

  // Настройка кнопки "Справка"
  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = helpPanel.classList.contains('hidden');
      closeAll();
      if (isHidden) helpPanel.classList.remove('hidden');
    });
  }

  // Крестики закрытия
  if (whatsNewClose) whatsNewClose.addEventListener('click', closeAll);
  if (helpClose) helpClose.addEventListener('click', closeAll);

  // Клик вне панелей закрывает их
  document.addEventListener('click', (e) => {
    const inWhatsNew = whatsNewPanel && whatsNewPanel.contains(e.target);
    const inHelp = helpPanel && helpPanel.contains(e.target);
    const inBtnWhatsNew = whatsNewBtn && whatsNewBtn.contains(e.target);
    const inBtnHelp = helpBtn && helpBtn.contains(e.target);

    if (!inWhatsNew && !inHelp && !inBtnWhatsNew && !inBtnHelp) {
      closeAll();
    }
  });

  // Esc закрывает
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
})();


/* ---------- Состояние ---------- */
let lastResults = [];
let lastErrors = [];
let activeLocation = null; // { key, period } | null

/* ---------- Drag & drop ---------- */

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const files = [...(e.target.files ?? [])];
  if (files.length) handleFiles(files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('hover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('hover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = [...(e.dataTransfer?.files ?? [])]
    .filter((f) => /\.xlsx?$/i.test(f.name));
  if (files.length) handleFiles(files);
});

/* ---------- Обработка ---------- */
window.importedFiles = [];

async function handleFiles(files) {
  if (processing) return;
  processing = true;

  resultsEl.innerHTML = '';
  summaryEl.classList.add('hidden');
  summaryEl.innerHTML = '';

  const panel = document.getElementById('filterPanel');
  if (panel) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  activeLocation = null;
  lastResults = [];
  lastErrors = [];

  window.importedFiles = [];

  const total = files.length;
  showProgress(0, total);

  const results = [];
  const errors = [];

 for (let i = 0; i < files.length; i++) {
  const file = files[i];
  setDropzoneText(`${i + 1} из ${total}`, file.name);

  try {
    const buffer = await file.arrayBuffer();
    
    // Читаем файл ОДИН раз
    const workbook = XLSX.read(buffer, { type: 'array' });
    window.importedFiles.push({ name: file.name, workbook, buffer });

    // Передаем готовый workbook в парсер (он больше не читает файл заново)
    const { sheets } = parseWorkbook(workbook); 
    
    const counted = countWorkbook(sheets);
    results.push({ fileName: file.name, ...counted });
  } catch (err) {
    console.error('Ошибка при обработке', file.name, err);
    errors.push({ fileName: file.name, message: err.message });
  }

  setProgress(((i + 1) / total) * 100);
  await new Promise((r) => setTimeout(r, 0));
}
  hideProgress();
  statusEl.textContent = `Готово: ${results.length} из ${total} обработано${
    errors.length ? `, ошибок: ${errors.length}` : ''
  }`;

  if (results.length) {
    renderSummary(sumResults(results), results.length, results);
  }

  renderResults(results, errors);
  processing = false;
}

/* ---------- Прогресс ---------- */

function showProgress(done, total) {
  dropzone.classList.add('processing');
  setProgress(0);
  setDropzoneText(`0 из ${total}`, 'Подготовка…');
}

function setProgress(percent) {
  dropzone.style.setProperty('--progress', percent + '%');
}

function hideProgress() {
  dropzone.classList.remove('processing');
  dropzone.style.setProperty('--progress', '0%');
  setDropzoneText('Перетащите файлы сюда', 'или нажмите, чтобы выбрать');
}

function setDropzoneText(mainText, hintText) {
  const strong = dropzone.querySelector('.dropzone-inner strong');
  const hint = dropzone.querySelector('.dropzone-inner .gr');
  if (strong) strong.textContent = mainText;
  if (hint) hint.textContent = hintText;
}

/* ---------- Рендер: итог ---------- */

function renderSummary(sum, fileCount, results) {
  summaryEl.classList.remove('hidden');
  summaryEl.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = `Общий итог по ${fileCount} файлам`;
  summaryEl.append(h);

  const grid = document.createElement('div');
  grid.className = 'summary-grid';

  const dayFiles = countFilesByLocation(results, 'day');
  const nightFiles = countFilesByLocation(results, 'night');

  grid.append(
    renderSummaryTable('День', sum.day, dayFiles, { clickable: true, period: 'day' }),
    renderSummaryTable('Ночь', sum.night, nightFiles, { clickable: true, period: 'night' })
  );
  summaryEl.append(grid);
}

function countFilesByLocation(results, period) {
  const counts = {};
  for (const r of results) {
    const data = r[period];
    if (!data) continue;
    for (const key of getCategories()) {
      if ((data.counts[key] || 0) > 0) {
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  return counts;
}

function renderSummaryTable(title, data, fileCounts = {}, opts = {}) {
  const wrap = document.createElement('div');

  const h = document.createElement('h3');
  h.textContent = title;
  wrap.append(h);

  const table = document.createElement('table');
  table.className = 'counts';
  if (opts.clickable) table.classList.add('clickable');

  const tbody = document.createElement('tbody');
  for (const key of getCategories()) {
    const value = data.counts[key];
    if (key === 'UNKNOWN' && value === 0) continue;

    const filesCount = fileCounts[key] || 0;
    const filesText = filesCount ? `${filesCount} ${pluralFiles(filesCount)}` : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="key-cell">${key}</td>
      <td class="files-cell">${filesText}</td>
      <td class="value-cell">${value}</td>
    `;
    if (key === 'LBX') tr.classList.add('lbx');
    if (key === 'UNKNOWN') tr.classList.add('unknown');

    if (opts.clickable) {
      tr.dataset.key = key;
      tr.dataset.period = opts.period;
      tr.addEventListener('click', () => toggleLocationFilter(key, opts.period));
    }

    tbody.append(tr);
  }

  table.append(tbody);
  wrap.append(table);

  return wrap;
}

function pluralFiles(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'файл';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'файла';
  return 'файлов';
}

/* ---------- Рендер: карточки файлов + фильтр ---------- */

function renderResults(results, errors) {
  lastResults = results;
  lastErrors = errors;
  activeLocation = null;

  applyFilter();
}

function toggleLocationFilter(key, period) {
  if (
    activeLocation &&
    activeLocation.key === key &&
    activeLocation.period === period
  ) {
    activeLocation = null;
  } else {
    activeLocation = { key, period };
  }

  highlightActiveLocation();
  applyFilter();
}

function highlightActiveLocation() {
  document.querySelectorAll('#summary table.counts tr').forEach((tr) => {
    tr.classList.remove('selected');
  });
  if (!activeLocation) return;

  document.querySelectorAll('#summary table.counts tr').forEach((tr) => {
    if (
      tr.dataset.key === activeLocation.key &&
      tr.dataset.period === activeLocation.period
    ) {
      tr.classList.add('selected');
    }
  });
}

function renderFilterPanel() {
  const panel = document.getElementById('filterPanel');
  if (!panel) return;

  if (!activeLocation) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');

  const label = activeLocation.period === 'day' ? 'День' : 'Ночь';
  panel.innerHTML = `
    <div class="filter-banner">
      <span>
        Показаны файлы с локацией
        <b>${activeLocation.key}</b> (${label})
      </span>
      <button id="filterClear" class="btn btn-secondary">Сбросить</button>
    </div>
  `;

  panel.querySelector('#filterClear').addEventListener('click', () => {
    activeLocation = null;
    highlightActiveLocation();
    applyFilter();
  });
}

function applyFilter() {
  resultsEl.innerHTML = '';

  let filtered = lastResults;

  if (activeLocation) {
    const { key, period } = activeLocation;
    filtered = lastResults.filter((r) => {
      const p = r[period];
      return p && (p.counts[key] || 0) > 0;
    });
  }

  renderFilterPanel();

  for (const r of filtered) {
    resultsEl.append(renderFileCard(r));
  }

  if (lastErrors.length && !activeLocation) {
    resultsEl.append(renderErrors(lastErrors));
  }
}

/* ---------- Рендер: карточка файла ---------- */

function renderFileCard(r) {
  const card = document.createElement('section');
  card.className = 'card file-card';

  const title = document.createElement('h3');
  title.className = 'file-title';
  title.textContent = r.fileName;
  card.append(title);

  const loc = document.createElement('div');
  loc.className = 'sheet-loc';
  loc.textContent = `Локация в файле: ${r.rawLocation ?? '—'}`;
  card.append(loc);

  const addrText = formatAddressor(r.addressorDay, r.addressorNight);
  if (addrText) {
    const addr = document.createElement('div');
    addr.className = 'sheet-loc sheet-addr';
    addr.textContent = addrText;
    card.append(addr);
  }

  const grid = document.createElement('div');
  grid.className = 'file-grid';
  grid.append(
    renderSummaryTable('День', r.day),
    renderSummaryTable('Ночь', r.night)
  );
  card.append(grid);

  return card;
}

function formatAddressor(day, night) {
  const d = (day || '').trim();
  const n = (night || '').trim();

  if (!d && !n) return null;
  if (d && n && d === n) return `Адресатор: ${d}`;
  if (d && !n) return `Адресатор: ${d}`;
  if (!d && n) return `Адресатор: ${n}`;
  return `Адресатор — День: ${d} / Ночь: ${n}`;
}

function renderErrors(errors) {
  const card = document.createElement('section');
  card.className = 'card error-card';

  const h = document.createElement('h3');
  h.textContent = `Ошибки (${errors.length})`;
  card.append(h);

  const ul = document.createElement('ul');
  for (const e of errors) {
    const li = document.createElement('li');
    li.textContent = `${e.fileName}: ${e.message}`;
    ul.append(li);
  }
  card.append(ul);

  return card;
}