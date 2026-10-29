import { parseWorkbook } from './excel-parser.js';

// Имя выводится как в исходном файле, без перестановки
function cleanName(name) {
  return name == null ? '' : String(name).trim();
}

// Дата или иной "не табельный" мусор: только цифры и разделители,
// и есть хотя бы одна точка, дефис, слэш или двоеточие (напр. 29.10.2026, 2026-10-29)
function isDateLike(value) {
  const v = String(value ?? '').trim();
  return /^[\d\s.\-\/:]+$/.test(v) && /[.\-\/:]/.test(v);
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Строит блок смены: массив строк { a: {html, cls}, b: {html, cls} }
// Колонка A = "Локация / Адресатор", колонка B = сотрудники.
// Никаких rowspan/colspan: у каждого значения своя ячейка.
function buildColumn(map, suffix) {
  const out = [];

  Array.from(map.keys()).sort().forEach(key => {
    const g = map.get(key);
    const n = Math.max(2, g.employees.length); // минимум 2 строки: локация + адресатор

    for (let i = 0; i < n; i++) {
      let a = { html: '', cls: `blk-${suffix}` };
      if (i === 0) a = { html: esc(g.loc), cls: `blk-${suffix}` };
      if (i === 1) a = { html: esc(g.addr), cls: `blk-${suffix}` };

      const emp = g.employees[i];
      const b = { html: emp !== undefined ? esc(emp) : '', cls: `emp-${suffix}` };

      out.push({ a, b });
    }
  });

  return out;
}

export function exportToExcel() {
  if (!window.importedFiles || !window.importedFiles.length) {
    alert('Сначала импортируйте файлы');
    return;
  }

  const dayMap = new Map();
  const nightMap = new Map();

  window.importedFiles.forEach(file => {
    const { sheets } = parseWorkbook(file.workbook);

    sheets.forEach(sheet => {
      const addr = sheet.addressor ? sheet.addressor.trim() : 'Без адресатора';
      const loc = sheet.rawLocation ? sheet.rawLocation.trim() : 'Без локации';

      if (!sheet.employees || !sheet.employees.length) return;

      const targetMap = sheet.isNight ? nightMap : dayMap;
      const key = `${loc}||${addr}`;

      if (!targetMap.has(key)) targetMap.set(key, { loc, addr, employees: [] });

      const group = targetMap.get(key);
      sheet.employees.forEach(emp => {
        const name = cleanName(emp.name);
        if (!name || isDateLike(name)) return; // пропускаем даты и пустые значения
        group.employees.push(name);
      });
    });
  });

  const colDay = buildColumn(dayMap, 'day');
  const colNight = buildColumn(nightMap, 'night');
  const maxRows = Math.max(colDay.length, colNight.length);
  const blank = (s) => ({ a: { html: '', cls: '' }, b: { html: '', cls: '' } });

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #999; padding: 6px 10px; mso-number-format: "\\@"; }
        .title-day   { background: #1F3A8A; color: white; font-weight: bold; text-align: center; font-size: 16px; }
        .title-night { background: #1F3A8A; color: white; font-weight: bold; text-align: center; font-size: 16px; }
        .head { background: #B4C7E7; font-weight: bold; text-align: center; }

        .blk-day   { background: #F8CBAD; color: #833C0B; }
        .emp-day   { background: #FEF9E7; text-align: right; }
        .blk-night { background: #B4A7D6; color: #20124D; }
        .emp-night { background: #F3F0F9; text-align: right; }

        .spacer { border: none; background: #ffffff; width: 40px; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th class="title-day">ДЕНЬ</th>
            <th class="title-day"></th>
            <th class="spacer"></th>
            <th class="title-night">НОЧЬ</th>
            <th class="title-night"></th>
          </tr>
          <tr>
            <th class="head">Объект / Адресатор</th>
            <th class="head">Сотрудники / ID</th>
            <th class="spacer"></th>
            <th class="head">Объект / Адресатор</th>
            <th class="head">Сотрудники / ID</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < maxRows; i++) {
    const d = colDay[i] || blank();
    const n = colNight[i] || blank();

    html += `
          <tr>
            <td class="${d.a.cls}">${d.a.html}</td>
            <td class="${d.b.cls}">${d.b.html}</td>
            <td class="spacer"></td>
            <td class="${n.a.cls}">${n.a.html}</td>
            <td class="${n.b.cls}">${n.b.html}</td>
          </tr>`;
  }

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Выгрузка_адресаторов_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exportBtn');
  if (btn) btn.addEventListener('click', exportToExcel);
});