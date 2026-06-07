#!/usr/bin/env node
/**
 * related-links.mjs — 상세 페이지 "관련 분양 현장" 크로스링크 자동 주입 (멱등)
 *
 * 콘텐츠 막다른길(상세→상세 아웃링크 0) 해소 + 같은 지역·유형 회유로 체류↑.
 * 각 상세에 같은 카테고리·지역 우선 4곳을 마커 사이에 주입. 내부링크=같은 탭.
 *   node scripts/related-links.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDIR = join(ROOT, 'property');

function regionKey(s) {
  if (s.includes('서울')) { const m = s.match(/([가-힣]+구)/); return m ? m[1] : '서울'; }
  const m = s.match(/([가-힣]+시)/); if (m) return m[1];
  const d = s.match(/부산|대전|대구|인천|울산|세종|경남|경북|전남|전북|충남|충북|강원|제주/);
  return d ? d[0] : '전국';
}

// 1) 데이터 수집
const props = readdirSync(PDIR).filter(f => f.endsWith('.html')).sort().map(f => {
  const slug = basename(f, '.html');
  const html = readFileSync(join(PDIR, f), 'utf8');
  const name = (html.match(/<h1>([^<]+)<\/h1>/) || [, slug])[1].trim();
  const cat = (html.match(/"position":2,"name":"([^"]+)"/) || [, ''])[1].trim();
  const addr = [...html.matchAll(/"address(?:Locality|Region)":"([^"]+)"/g)].map(m => m[1]).join(' ');
  const loc = (html.match(/<p class="loc">([^<]+)</) || [, ''])[1];
  return { slug, name, cat, region: regionKey(addr + ' ' + loc), html, file: join(PDIR, f) };
});

// 2) 관련도 랭킹: 같은카테고리&지역 > 같은카테고리 > 같은지역 > 나머지(slug순)
function related(p) {
  const score = q => (q.cat === p.cat ? 2 : 0) + (q.region === p.region ? 1 : 0);
  return props.filter(q => q.slug !== p.slug)
    .map(q => ({ q, s: score(q) }))
    .sort((a, b) => b.s - a.s || a.q.slug.localeCompare(b.q.slug))
    .slice(0, 4).map(x => x.q);
}

// 3) 주입 (마커 멱등)
const START = '<!-- auto:related -->', END = '<!-- /auto:related -->';
let changed = 0;
for (const p of props) {
  const items = related(p);
  const cards = items.map(r =>
    `<a href="/property/${r.slug}" style="display:block;padding:.875rem 1rem;border:1px solid var(--g200);border-radius:10px;text-decoration:none;color:inherit;min-height:44px">` +
    `<strong style="display:block;color:var(--navy)">${r.name}</strong>` +
    `<span style="font-size:.8125rem;color:var(--g500)">${r.region} · ${r.cat}</span></a>`
  ).join('');
  const block = `${START}\n<div class="wrap"><section class="detail-sec"><h2>관련 분양 현장</h2>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">${cards}</div></section></div>\n${END}`;

  let html = p.html;
  const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (re.test(html)) html = html.replace(re, block);
  else html = html.replace('</main>', block + '\n</main>');

  if (html !== p.html) { writeFileSync(p.file, html); changed++; }
}
console.log(`✅ related-links: ${props.length}개 상세 처리, ${changed}개 갱신`);
