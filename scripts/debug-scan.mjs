#!/usr/bin/env node
/**
 * 전 페이지 버그/디버깅 스캐너 — SEO 외 결함을 잡는다.
 * 실행: node scripts/debug-scan.mjs
 *
 * 검사:
 *  A. <div>/<section> 태그 균형(열림=닫힘)
 *  B. 페이지 내 중복 id 속성
 *  C. target="_blank" 인데 rel 에 noopener 없음 (보안/성능)
 *  D. 죽은 앵커: href="" 또는 href="#" (콘텐츠 없는 링크)
 *  E. <img> alt 누락
 *  F. 필수 head 요소: lang/charset/viewport
 *  G. 인코딩 깨짐(mojibake: U+FFFD)
 *  H. 키워드 스터핑 재확인: '부동산분양' 밀도(경고 ≥2.8% / 오류 >3.2%)
 *  I. faq-q 가 <button> 인데 type 속성 누락(암묵적 submit 방지)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [], warns = [];

function files() {
  const out = [];
  for (const f of readdirSync(ROOT)) if (f.endsWith('.html')) out.push(join(ROOT, f));
  const p = join(ROOT, 'property');
  if (existsSync(p)) for (const f of readdirSync(p)) if (f.endsWith('.html')) out.push(join(p, f));
  return out.sort();
}

const stripHead = h => { const i = h.indexOf('</head>'); return i < 0 ? h : h.slice(i); };
const visText = h => stripHead(h).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, '');

function tagBalance(html, tag, rel) {
  const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (open !== close) errors.push(`[태그불균형] ${rel} <${tag}> 열림 ${open} ≠ 닫힘 ${close}`);
}

for (const file of files()) {
  const rel = relative(ROOT, file);
  const html = readFileSync(file, 'utf8');

  // A. 태그 균형
  tagBalance(html, 'div', rel);
  tagBalance(html, 'section', rel);

  // B. 중복 id
  const ids = [...html.matchAll(/\sid="([^"]+)"/gi)].map(m => m[1]);
  const seen = {}, dup = new Set();
  ids.forEach(id => { if (seen[id]) dup.add(id); seen[id] = 1; });
  if (dup.size) errors.push(`[중복id] ${rel} → ${[...dup].join(', ')}`);

  // C. target=_blank rel 누락
  for (const m of html.matchAll(/<a\s+([^>]*?)>/gi)) {
    const attrs = m[1];
    if (/target\s*=\s*"_blank"/i.test(attrs) && !/rel\s*=\s*"[^"]*noopener/i.test(attrs)) {
      errors.push(`[rel누락] ${rel} target=_blank 인데 rel=noopener 없음 → ${m[0].slice(0, 70)}…`);
      break; // 페이지당 1건만 보고
    }
  }

  // D. 죽은 앵커
  const dead = [...html.matchAll(/<a\s+[^>]*href="(#?)"/gi)].length;
  if (dead) warns.push(`[죽은앵커] ${rel} href="" 또는 href="#" ${dead}건`);

  // E. img alt 누락
  for (const m of html.matchAll(/<img\s+([^>]*)>/gi)) {
    if (!/\balt\s*=/i.test(m[1])) { warns.push(`[alt누락] ${rel} <img> alt 없음`); break; }
  }

  // F. 필수 head
  if (!/<html[^>]*\blang=/i.test(html)) errors.push(`[lang누락] ${rel} <html lang> 없음`);
  if (!/<meta[^>]*charset=/i.test(html)) errors.push(`[charset누락] ${rel}`);
  if (!/<meta[^>]*name="viewport"/i.test(html)) errors.push(`[viewport누락] ${rel}`);

  // G. 인코딩 깨짐
  if (html.includes('�')) errors.push(`[인코딩깨짐] ${rel} U+FFFD 포함`);

  // H. 스터핑 재확인
  const body = visText(html);
  if (body.length) {
    const kw = (body.match(/부동산분양/g) || []).length;
    const d = kw * 5 / body.length * 100;
    if (d > 3.2) errors.push(`[스터핑] ${rel} '부동산분양' ${d.toFixed(2)}% (>3.2%)`);
    else if (d >= 2.8) warns.push(`[스터핑주의] ${rel} '부동산분양' ${d.toFixed(2)}% (2.8~3.2%)`);
  }

  // I. faq-q button type 누락
  for (const m of html.matchAll(/<button\s+([^>]*class="faq-q"[^>]*)>/gi)) {
    if (!/\btype\s*=/i.test(m[1])) { warns.push(`[button-type] ${rel} faq-q <button> type 속성 없음(암묵적 submit)`); break; }
  }
}

console.log(`\n🐞 디버그 스캔 — 페이지 ${files().length}개`);
if (warns.length) { console.log(`\n⚠️  경고 ${warns.length}건:`); warns.forEach(w => console.log('   - ' + w)); }
if (errors.length) { console.log(`\n❌ 오류 ${errors.length}건:`); errors.forEach(e => console.log('   - ' + e)); process.exit(1); }
console.log(`\n✅ 치명 버그 0 — 태그균형·id고유·보안rel·head필수·인코딩·스터핑 모두 정상\n`);
process.exit(0);
