#!/usr/bin/env node
/**
 * gen-listing.mjs — sync-report.json의 신규(청약홈) 현장 → 클린 상세페이지 생성
 *
 * 게이트 준수 템플릿: og PNG·canonical clean·JSON-LD url clean·name=h1·BreadcrumbList·
 *   본진 0홉 CTA·내부링크 같은탭·무료0·과장0·AI사람0. 실데이터 필드만(창작 0).
 *   분양가/청약일은 출처(청약홈) 표기, 미상 필드는 "공고 기준 확정"으로 헤지.
 * 관련현장/FAQ스키마는 related-links·enrich-schema가 후속 주입.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://realestate3.pages.dev';
const CATPATH = { '아파트': 'apartment', '오피스텔': 'officetel', '상가': 'store', '지식산업센터': 'knowledge-center', '토지': 'land', '산업단지': 'industrial' };
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const reportPath = join(ROOT, 'data', 'sync-report.json');
if (!existsSync(reportPath)) { console.log('sync-report 없음 — 신규 0'); process.exit(0); }
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const listings = JSON.parse(readFileSync(join(ROOT, 'data', 'listings.json'), 'utf8'));

let created = 0;
for (const n of report.new || []) {
  const slug = n.slug; const pf = join(ROOT, 'property', `${slug}.html`);
  if (existsSync(pf)) continue;
  const cat = n.category || '아파트'; const catp = CATPATH[cat] || 'apartment';
  const url = `${BASE}/property/${slug}`;
  const badge = n.applyEnd ? '<span class="badge badge-selling">분양중</span>' : '<span class="badge badge-upcoming">분양예정</span>';
  const price = n.price ? `${esc(n.price)} <span style="font-size:.8125rem;color:var(--g500)">(출처: 청약홈)</span>` : '공고 기준 확정';
  const sched = n.schedule ? `${esc(n.schedule)} <span style="font-size:.8125rem;color:var(--g500)">(출처: 청약홈)</span>` : '공고 기준 확정';
  const title = `${esc(n.name)} — ${esc(n.region)} ${cat}분양 청약 정보`;
  const desc = `${esc(n.name)} ${esc(n.region)} ${cat}분양 정보. ${n.units ? esc(n.units) + ' · ' : ''}청약 일정과 분양가를 청약홈 실데이터로 정리했습니다.`;
  const intro = `${esc(n.name)}은(는) ${esc(n.region)}에 공급되는 ${cat} 분양 현장입니다. ` +
    `${n.builder ? '시공은 ' + esc(n.builder) + '이며, ' : ''}${n.units ? '공급 규모는 ' + esc(n.units) + '입니다. ' : ''}` +
    `청약 일정과 분양가 등 세부 조건은 청약홈 입주자모집공고를 기준으로 확정·공개되며, 공고 내용을 확인 후 청약하시기 바랍니다.`;
  const ld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: n.name, description: desc, url, address: { '@type': 'PostalAddress', addressRegion: n.region } };

  const html = `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="ko_KR">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<meta property="og:image" content="${BASE}/og-default.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="1200">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#1a2340">
</head><body>
<header class="hd"><div class="hd-inner"><a href="/" class="logo">더에셋<span>스퀘어</span></a><a href="https://theassetsquare.com/" class="hd-cta" target="_blank" rel="noopener">AI 분양상담 →</a></div></header>
<nav class="nav"><div class="nav-inner"><a href="/">전체</a><a href="/apartment">아파트</a><a href="/officetel">오피스텔</a><a href="/store">상가</a><a href="/knowledge-center">지식산업센터</a><a href="/land">토지</a><a href="/industrial">산업단지</a></div></nav>
<main>
<div class="wrap"><div class="bc"><a href="/">홈</a> &gt; <a href="/${catp}">${cat}</a> &gt; <span>${esc(n.name)}</span></div></div>
<section class="detail-hero"><div class="placeholder" style="background:linear-gradient(135deg,#0d1b2a,#1b3a5c)">${esc(n.name)}</div>
<div class="detail-overlay">${badge}<h1>${esc(n.name)}</h1><p class="loc">${esc(n.region)} · ${cat}</p></div></section>
<div class="wrap">
<div class="summary-grid">
<div class="summary-item"><strong>위치</strong><span>${esc(n.region)}</span></div>
<div class="summary-item"><strong>유형</strong><span>${cat}</span></div>
<div class="summary-item"><strong>분양가</strong><span>${price}</span></div>
<div class="summary-item"><strong>세대수</strong><span>${esc(n.units) || '공고 기준'}</span></div>
<div class="summary-item"><strong>시공사</strong><span>${esc(n.builder) || '공고 기준'}</span></div>
<div class="summary-item"><strong>청약</strong><span>${sched}</span></div>
</div>
<section class="detail-sec"><h2>${esc(n.name)} 분양 정보</h2><div class="detail-text"><p>${intro}</p></div></section>
<div class="ai-cta"><h3>이 현장 맞춤 분석이 필요하신가요?</h3><p>청약 전략과 자금 계획을 AI가 정리해 드립니다.</p><a href="https://theassetsquare.com/" class="btn-ai" target="_blank" rel="noopener">🤖 AI 분양상담 받기 →</a></div>
<a href="/${catp}" style="display:inline-flex;align-items:center;gap:.375rem;font-size:.875rem;font-weight:600;color:var(--g500);padding:.5rem 0;min-height:44px">← ${cat} 목록으로</a>
</div>
</main>
<footer class="ft"><div class="wrap"><div class="brand">더에셋스퀘어</div><p>분양 청약 현장 전문 분석</p><p class="mt-2"><a href="https://theassetsquare.com/" target="_blank" rel="noopener">메인 사이트</a></p><p class="mt-1">&copy; 2026 더에셋스퀘어</p></div></footer>
<div class="bottom-phone"><a href="https://theassetsquare.com/" target="_blank" rel="noopener">📞 분양 상담 받기 →</a><span class="email">theassetsquare@gmail.com</span></div>
<div class="bottom-main"><a href="https://theassetsquare.com/" target="_blank" rel="noopener">더에셋스퀘어에서 더 보기 →</a></div>
<script defer src="/main.js"></script>
</body></html>
`;
  writeFileSync(pf, html);
  if (!listings.find(l => l.slug === slug)) listings.push({ ...n, url, status: badge.includes('selling') ? '분양중' : '분양예정' });
  created++;
}
writeFileSync(join(ROOT, 'data', 'listings.json'), JSON.stringify(listings, null, 2) + '\n');
console.log(`✅ gen-listing: 신규 ${created}개 생성`);
