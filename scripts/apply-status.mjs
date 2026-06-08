#!/usr/bin/env node
/**
 * apply-status.mjs — SSOT status → 상세/카드 badge 반영(자동종료 실현) + 출처 표기(B4)
 *
 *  - status 매핑: 분양예정→badge-upcoming / 분양중·청약중→badge-selling / 청약 마감·마감→badge-closing
 *  - 상세 hero badge + 카테고리/홈 카드 badge를 slug 단위로 갱신(멱등)
 *  - B4: source='청약홈' & applyEnd 있으면 상세에 "출처: 청약홈(YYYY-MM-DD)" 주석블록 주입(없으면 미주입=창작 0)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listings = JSON.parse(readFileSync(join(ROOT, 'data', 'listings.json'), 'utf8'));

const MAP = {
  '분양예정': ['badge-upcoming', '분양예정'],
  '분양중': ['badge-selling', '분양중'],
  '청약중': ['badge-selling', '분양중'],
  '청약 마감': ['badge-closing', '청약 마감'],
  '마감': ['badge-closing', '청약 마감'],
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rootHtml = ['index.html', 'apartment.html', 'officetel.html', 'store.html',
  'knowledge-center.html', 'land.html', 'industrial.html'].filter(f => existsSync(join(ROOT, f)));

let changed = 0;
for (const l of listings) {
  const m = MAP[l.status]; if (!m) continue;
  const [cls, txt] = m;
  const newBadge = `<span class="badge ${cls}">${txt}</span>`;

  // 1) 상세 hero badge (detail-overlay 내 첫 badge)
  const pf = join(ROOT, 'property', `${l.slug}.html`);
  if (existsSync(pf)) {
    let html = readFileSync(pf, 'utf8'), before = html;
    html = html.replace(/(<div class="detail-overlay">\s*)<span class="badge badge-[a-z]+">[^<]*<\/span>/,
      `$1${newBadge}`);
    // B4 출처 주석(청약홈 실데이터일 때만)
    const SRC = '<!-- src:auto -->', SE = '<!-- /src:auto -->';
    const re = new RegExp(esc(SRC) + '[\\s\\S]*?' + esc(SE));
    if (l.source === '청약홈' && l.applyEnd) {
      const note = `${SRC}<p class="src-note" style="font-size:.8125rem;color:var(--g500);margin:.5rem 0">출처: 청약홈(한국부동산원) · 청약 마감일 ${l.applyEnd} 기준</p>${SE}`;
      html = re.test(html) ? html.replace(re, note)
        : html.replace(/(<\/div>\s*<section class="detail-sec">)/, `<div class="wrap">${note}</div>$1`);
    } else if (re.test(html)) html = html.replace(re, '');
    if (html !== before) { writeFileSync(pf, html); changed++; }
  }

  // 2) 카드 badge (홈/카테고리) — 해당 slug 카드 블록 내 첫 badge
  for (const rf of rootHtml) {
    const p = join(ROOT, rf);
    let html = readFileSync(p, 'utf8'), before = html;
    const cardRe = new RegExp(`(href="/property/${esc(l.slug)}"[\\s\\S]{0,400}?)<span class="badge badge-[a-z]+">[^<]*</span>`);
    html = html.replace(cardRe, `$1${newBadge}`);
    if (html !== before) { writeFileSync(p, html); changed++; }
  }
}
console.log(`✅ apply-status: ${changed}개 위치 갱신(멱등)`);
