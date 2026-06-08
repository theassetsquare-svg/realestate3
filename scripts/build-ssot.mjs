#!/usr/bin/env node
/**
 * build-ssot.mjs — 기존 35개 상세 페이지의 "실데이터"를 SSOT(data/listings.json)로 추출.
 * 창작 0: 페이지에 이미 있는 값만 수집(현장명·지역·카테고리·summary 필드·상태·청약일).
 * 이 SSOT가 이후 청약홈 어댑터/동기화/자동종료의 단일 소스.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDIR = join(ROOT, 'property');
const BASE = 'https://realestate3.pages.dev';

function regionKey(s) {
  if (s.includes('서울')) { const m = s.match(/([가-힣]+구)/); return m ? '서울 ' + m[1] : '서울'; }
  const m = s.match(/([가-힣]+시)/); if (m) return m[1];
  const d = s.match(/부산|대전|대구|인천|울산|세종|경남|경북|전남|전북|충남|충북|강원|제주/);
  return d ? d[0] : '전국';
}
// 본문/요약에서 ISO 청약 종료일 추정(있을 때만). 없으면 null(창작 0)
function applyEnd(html) {
  // "4월 22일 당첨자 발표" 등 명시 일자 → 종료 신호. 연도+월+일 우선.
  const m = html.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일[^<]{0,12}(당첨자\s*발표|2순위|청약)/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  return null;
}

const listings = readdirSync(PDIR).filter(f => f.endsWith('.html')).sort().map(f => {
  const slug = basename(f, '.html');
  const html = readFileSync(join(PDIR, f), 'utf8');
  const name = (html.match(/<h1>([^<]+)<\/h1>/) || [, slug])[1].trim();
  const category = (html.match(/"position":2,"name":"([^"]+)"/) || [, ''])[1].trim();
  const addr = [...html.matchAll(/"address(?:Locality|Region)":"([^"]+)"/g)].map(m => m[1]).join(' ');
  const loc = (html.match(/<p class="loc">([^<]+)</) || [, ''])[1];
  const badge = (html.match(/<span class="badge badge-[a-z]+">([^<]+)<\/span>/) || [, ''])[1].trim();
  const fields = {};
  for (const m of html.matchAll(/<div class="summary-item"><strong>([^<]+)<\/strong><span>([^<]+)<\/span><\/div>/g))
    fields[m[1].trim()] = m[2].trim();
  const builder = fields['시공사'] || fields['시공'] || fields['시행'] || '';
  return {
    slug, url: `${BASE}/property/${slug}`, name, category,
    region: regionKey(addr + ' ' + loc),
    status: badge || null,
    price: fields['분양가'] || null,
    units: fields['세대수'] || fields['규모'] || null,
    area: fields['면적'] || null,
    moveIn: fields['입주예정'] || fields['입주'] || fields['입점'] || null,
    builder: builder || null,
    schedule: fields['분양시기'] || fields['본청약'] || fields['분양'] || null,
    applyEnd: applyEnd(html),
    source: 'site',          // 기존 수기 콘텐츠(어댑터 동기화 시 '청약홈'으로 갱신 가능)
    fields
  };
});

writeFileSync(join(ROOT, 'data', 'listings.json'), JSON.stringify(listings, null, 2) + '\n');
console.log(`✅ SSOT 생성: data/listings.json — ${listings.length}개 (실데이터만, 창작 0)`);
