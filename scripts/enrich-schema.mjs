#!/usr/bin/env node
/**
 * 더에셋스퀘어 서브사이트 — 구조화데이터(JSON-LD) 자동 주입기
 * 의존성 없음(Node 내장만). 실행: `node scripts/enrich-schema.mjs`
 *
 * 하는 일 (idempotent — 몇 번 돌려도 안전, 24h 자동화 안전):
 *  1) 모든 페이지(홈 제외)에 BreadcrumbList JSON-LD 주입 — 화면의 breadcrumb를 그대로 미러링
 *  2) FAQ(.faq-item)가 있는 상세페이지에 FAQPage JSON-LD 주입 — 화면 Q&A를 그대로 미러링
 *  주입 블록은 <!-- auto-schema:TYPE --> 마커로 감싸 재실행 시 교체(중복 방지).
 *
 * 구글 정책 준수: 구조화데이터는 반드시 "사용자에게 보이는 콘텐츠"와 일치해야 함.
 * 따라서 텍스트를 새로 지어내지 않고 HTML에서 직접 추출한다.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://realestate3.pages.dev';

const CAT_NAME = {
  'apartment.html': '아파트분양', 'officetel.html': '오피스텔분양', 'store.html': '상가분양',
  'knowledge-center.html': '지식산업센터분양', 'land.html': '토지분양', 'industrial.html': '산업단지분양',
};

/** HTML 엔티티 디코드 + 태그 제거 → 순수 텍스트 */
function plainText(s) {
  return s.replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function htmlFiles() {
  const out = [];
  for (const f of readdirSync(ROOT)) if (f.endsWith('.html') && f !== '404.html') out.push(join(ROOT, f));
  const pdir = join(ROOT, 'property');
  if (existsSync(pdir)) for (const f of readdirSync(pdir)) if (f.endsWith('.html')) out.push(join(pdir, f));
  return out.sort();
}

const pick = (h, re) => { const m = h.match(re); return m ? m[1].trim() : null; };

/** 화면 breadcrumb 파싱 → [{name, url}]. <nav class="bc"> / <div class="bc"> 두 구조 모두 지원 */
function parseBreadcrumb(html, pageUrl) {
  const m = html.match(/<(nav|div) class="[^"]*\bbc\b[^"]*">([\s\S]*?)<\/\1>/i);
  if (!m) return null;
  const inner = m[2];
  const items = [];
  const linkRe = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm, lastEnd = 0;
  while ((lm = linkRe.exec(inner))) {
    let url = lm[1].trim();
    const name = plainText(lm[2]);
    lastEnd = lm.index + lm[0].length;
    if (!name) continue;
    if (url.startsWith('/')) url = BASE + url;
    items.push({ name, url });
  }
  // 현재 페이지: 마지막 <a> 이후의 텍스트(평문) — 구분자(›, >, »)는 제거
  let current = plainText(inner.slice(lastEnd)).replace(/^[›>»\s]+/, '').replace(/[›>»\s]+$/, '').trim();
  if (current) items.push({ name: current, url: pageUrl });
  return items.length >= 2 ? items : null;
}

function breadcrumbLD(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
    })),
  };
}

/** FAQ 추출: .faq-q / .faq-a-inner 쌍 */
function parseFaqs(html) {
  // 질문은 <div class="faq-q"> 또는 <button class="faq-q"> 두 마크업 모두 지원
  const qs = [...html.matchAll(/class="faq-q"[^>]*>([\s\S]*?)<\/(?:div|button)>/gi)].map(m => plainText(m[1]));
  const as = [...html.matchAll(/class="faq-a-inner"[^>]*>([\s\S]*?)<\/div>/gi)].map(m => plainText(m[1]));
  const n = Math.min(qs.length, as.length);
  const out = [];
  for (let i = 0; i < n; i++) if (qs[i] && as[i]) out.push({ q: qs[i], a: as[i] });
  return out;
}

function faqLD(faqs) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** 마커로 감싼 JSON-LD 블록을 </head> 앞에 주입(있으면 교체) */
function injectLD(html, type, obj) {
  const block = `<!-- auto-schema:${type} -->\n<script type="application/ld+json">\n${JSON.stringify(obj)}\n</script>\n<!-- /auto-schema:${type} -->`;
  const re = new RegExp(`<!-- auto-schema:${type} -->[\\s\\S]*?<!-- /auto-schema:${type} -->\\n?`, 'i');
  if (re.test(html)) return html.replace(re, block + '\n');
  return html.replace(/<\/head>/i, block + '\n</head>');
}

let changed = 0, faqCount = 0, bcCount = 0;
for (const file of htmlFiles()) {
  const rel = relative(ROOT, file);
  const name = basename(file);
  let html = readFileSync(file, 'utf8');
  const before = html;
  const canonical = pick(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i) || (BASE + '/' + rel);

  // 1) BreadcrumbList — 홈(index.html) 제외
  if (name !== 'index.html') {
    let items = parseBreadcrumb(html, canonical);
    if (!items && CAT_NAME[name]) {
      // 카테고리 페이지에 시각 breadcrumb가 없으면 홈>카테고리로 구성
      items = [{ name: '홈', url: BASE + '/' }, { name: CAT_NAME[name], url: canonical }];
    }
    if (items) { html = injectLD(html, 'breadcrumb', breadcrumbLD(items)); bcCount++; }
  }

  // 2) FAQPage — FAQ 블록이 있을 때만
  const faqs = parseFaqs(html);
  if (faqs.length >= 2) { html = injectLD(html, 'faq', faqLD(faqs)); faqCount++; }

  if (html !== before) { writeFileSync(file, html); changed++; }
}

console.log(`\n🏗️  구조화데이터 주입 완료`);
console.log(`   • 변경된 파일: ${changed}개`);
console.log(`   • BreadcrumbList 주입: ${bcCount}개`);
console.log(`   • FAQPage 주입: ${faqCount}개\n`);
