// counter.js
import { resolveLocation, isLunchbox, getLocationKeys } from './classifier.js';

export function getCategories() {
  return [...getLocationKeys(), 'UNKNOWN'];
}

// Оставляем старую константу — на случай, если где-то ещё используется
export const CATEGORIES = ['ABK', 'MMA', 'OXD', 'SP1', 'SP2', 'WS1', 'WS2', 'LBX', 'UNKNOWN'];

export function emptyCounts() {
  return Object.fromEntries(getCategories().map((k) => [k, 0]));
}

export function countSheet(sheet) {
  const counts = emptyCounts();
  const unknownRaw = new Set();
  const loc = resolveLocation(sheet.rawLocation);

  for (const emp of sheet.employees) {
    if (isLunchbox(emp.rowText)) { counts.LBX++; continue; }
    if (loc.key === 'UNKNOWN') {
      counts.UNKNOWN++;
      if (loc.raw) unknownRaw.add(loc.raw);
    } else {
      counts[loc.key] = (counts[loc.key] || 0) + 1;
    }
  }
  return { counts, unknownRaw: [...unknownRaw] };
}

export function countWorkbook(sheets) {
  const day = { counts: emptyCounts(), unknownRaw: new Set() };
  const night = { counts: emptyCounts(), unknownRaw: new Set() };
  let rawLocation = null;
  let addressorDay = null;
  let addressorNight = null;

  for (const sheet of sheets) {
    if (!rawLocation && sheet.rawLocation) rawLocation = sheet.rawLocation;

    const target = sheet.isNight ? night : day;
    const { counts, unknownRaw } = countSheet(sheet);

    for (const key of getCategories()) {
      target.counts[key] = (target.counts[key] || 0) + (counts[key] || 0);
    }
    for (const r of unknownRaw) target.unknownRaw.add(r);

    if (sheet.addressor) {
      if (sheet.isNight && !addressorNight) addressorNight = sheet.addressor;
      if (!sheet.isNight && !addressorDay) addressorDay = sheet.addressor;
    }
  }

  return {
    day: { counts: day.counts, unknownRaw: [...day.unknownRaw] },
    night: { counts: night.counts, unknownRaw: [...night.unknownRaw] },
    rawLocation,
    addressorDay,
    addressorNight,
  };
}

export function sumResults(results) {
  const day = { counts: emptyCounts(), unknownRaw: new Set() };
  const night = { counts: emptyCounts(), unknownRaw: new Set() };

  for (const r of results) {
    for (const key of getCategories()) {
      day.counts[key] = (day.counts[key] || 0) + (r.day.counts[key] || 0);
      night.counts[key] = (night.counts[key] || 0) + (r.night.counts[key] || 0);
    }
    for (const u of r.day.unknownRaw) day.unknownRaw.add(u);
    for (const u of r.night.unknownRaw) night.unknownRaw.add(u);
  }

  return {
    day: { counts: day.counts, unknownRaw: [...day.unknownRaw] },
    night: { counts: night.counts, unknownRaw: [...night.unknownRaw] }
  };
}