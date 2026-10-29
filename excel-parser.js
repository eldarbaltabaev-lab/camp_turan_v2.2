// XLSX приходит из <script> в index.html (глобальная переменная)

const ADDRESSOR_MARKERS = [
  /представител[ьяи].*?клиент/i,
  /представител[ьяи].*?representative/i,
  /client\s*representative/i,
  /клиент.*?представител/i,
];

/** Стоп-слова в столбце с именем — это должность, а не сотрудник. */
const NON_EMPLOYEE_PATTERNS = [
  /coffee[\s-]*lady/i,
  /кофе[\s-]*леди/i,
  /кофеледи/i,
  /cleaning[\s-]*lady/i,
  /клининг[\s-]*леди/i,
  /горничн/i,
  /раздач/i,
  /\bcleaning\b/i,
  /\bcoffee\b/i,
];

/** Стоп-названия компании-подрядчика в столбце G (индекс 6). */
const CONTRACTOR_PATTERNS = [
  /eurasia\s*support\s*services/i,
  /eurasia\s*ss\b/i,
  /eurasian\s*service\s*solutions/i,
  /eurasia\s*service\s*solutions/i,
  /\beuss\b/i,
];

export function parseWorkbook(wb) {
  const sheets = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: '',
    });

    const isNight = /night|ночь/i.test(sheetName);
    const rawLocation = findRawLocation(rows);
    const employees = findEmployees(rows);
    const addressor = readAddressor(ws);

    sheets.push({ name: sheetName, isNight, rawLocation, employees, addressor });
  }

  return { sheets };
}

function readAddressor(ws) {
  if (!ws || !ws['!ref']) return null;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const MAX_SCAN_ROW = Math.min(range.e.r, 40);

  for (let r = 0; r <= MAX_SCAN_ROW; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v == null) continue;

      const text = String(cell.v).trim();
      if (!text) continue;

      if (ADDRESSOR_MARKERS.some((re) => re.test(text))) {
        // 1) Справа в той же строке — первая непустая
        for (let k = c + 1; k <= range.e.c; k++) {
          const right = ws[XLSX.utils.encode_cell({ r, c: k })];
          if (!right || right.v == null) continue;

          const s = String(right.v).trim();
          if (!s) continue;
          if (ADDRESSOR_MARKERS.some((re) => re.test(s))) continue;

          return s;
        }

        // 2) Значение в самой подписи через двоеточие
        const afterColon = text.split(/[:：]/)[1];
        if (afterColon && afterColon.trim()) return afterColon.trim();

        // 3) Слева от подписи
        for (let k = c - 1; k >= 0; k--) {
          const left = ws[XLSX.utils.encode_cell({ r, c: k })];
          if (!left || left.v == null) continue;
          const s = String(left.v).trim();
          if (s && !ADDRESSOR_MARKERS.some((re) => re.test(s))) return s;
        }

        return null;
      }
    }
  }

  return null;
}

function findRawLocation(rows) {
  const MAX_COL = 25;

  for (const row of rows) {
    const limit = Math.min(row.length, MAX_COL);
    for (let c = 0; c < limit; c++) {
      const cell = String(row[c] ?? '');
      const idx = cell.search(/НАЗВАНИЕ\s*ОБЪЕКТА/i);
      if (idx === -1) continue;

      // 1) Значение в той же ячейке слева от подписи
      const leftInCell = cell.slice(0, idx).trim();
      if (leftInCell) return leftInCell;

      // 2) Справа от подписи в той же ячейке (после двоеточия)
      const afterColon = cell.slice(idx).split(/[:：]/).slice(1).join(':').trim();
      if (afterColon) return afterColon;

      // 3) Первое непустое справа в строке
      for (let k = c + 1; k < row.length; k++) {
        const right = String(row[k] ?? '').trim();
        if (right) return right;
      }

      // 4) Первое непустое слева в строке
      for (let k = c - 1; k >= 0; k--) {
        const left = String(row[k] ?? '').trim();
        if (left) return left;
      }
    }
  }
  return null;
}

function findEmployees(rows) {
  const MAX_COL = 10;
  const CONTRACTOR_COL = 6;
  let headerRow = -1;
  let nameCol = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const limit = Math.min(row.length, MAX_COL);
    for (let c = 0; c < limit; c++) {
      const cell = String(row[c] ?? '');
      if (/Ф\.?\s*И\.?\s*О\.?|Name\s*&\s*Surname/i.test(cell)) {
        headerRow = r;
        nameCol = c;
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) return [];

  const employees = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const nameCell = String(row[nameCol] ?? '').trim();

    // Столбец с табельным номером — следующий за именем
    const idCell = String(row[nameCol + 1] ?? '').trim();

    if (!nameCell && !idCell) continue;

    // Итоговая строка (Total)
    if (/^\d+([.,]\d+)?$/.test(nameCell) && !idCell) break;

    // Табельный номер — только цифры. Точка, дефис, слэш, буквы (дата, "FLS" и т.п.)
    // значат, что это не табельный номер.
    const isTabNumber = /^\d+$/.test(idCell);

    let finalName = '';

    if (isTabNumber) {
      finalName = idCell;
    } else {
      // Не табельный номер — берём фамилию и имя как есть
      if (!nameCell) continue;
      if (NON_EMPLOYEE_PATTERNS.some((re) => re.test(nameCell))) continue;
      const contractor = String(row[CONTRACTOR_COL] ?? '').trim();
      if (CONTRACTOR_PATTERNS.some((re) => re.test(contractor))) continue;
      finalName = nameCell;
    }

    // Нужно для счётчика ланчбоксов
    const rowText = row
      .slice(0, MAX_COL)
      .map((v) => String(v ?? ''))
      .join(' ');

    employees.push({ name: finalName, rowText });
  }

  return employees;
}