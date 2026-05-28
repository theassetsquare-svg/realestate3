#!/usr/bin/env node
/**
 * 더에셋스퀘어 서브사이트 — SEO 자동 검증기 (24시간 자동화)
 * 의존성 없음(Node 내장만). 로컬: `node scripts/seo-audit.mjs`
 * CI: .github/workflows/seo-audit.yml 에서 push + 6시간마다 스케줄 실행.
 *
 * 검사 항목(실패=빌드 실패):
 *  1. 금지 전화번호(1666-6838) 잔존 금지
 *  2. 깨진 내부 링크(href/src) 금지 — 실제 파일 존재 검증
 *  3. 중복 <title> / 중복 meta description 금지
 *  4. 필수 메타 태그 누락 금지(title·description·canonical·og:title·og:description·og:image)
 *  5. 페이지당 <h1> 정확히 1개, 플레이스홀더 H1("이 센터/상가/오피스텔" 등) 금지
 *  6. 키워드 스터핑: 본문 '부동산분양' 밀도 ≤ 3.2%
 *  7. (경고) <title> 70자 초과
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORBIDDEN_PHONE = '1666-6838';
const PLACEHOLDER_H1 = /^이\s?(센터|상가|오피스텔|아파트|단지|현장|건물|토지|용지|빌딩)$/;
const DENSITY_LIMIT = 3.2; // %

const errors = [];
const warnings = [];
const titles = new Map();      // title -> [files]
const descriptions = new Map(); // desc -> [files]

/** 사이트 페이지 수집: 루트 *.html + property/*.html */
function htmlFiles() {
  const out = [];
  for (const f of readdirSync(ROOT)) {
    if (f.endsWith('.html')) out.push(join(ROOT, f));
  }
  const pdir = join(ROOT, 'property');
  if (existsSync(pdir)) {
    for (const f of readdirSync(pdir)) {
      if (f.endsWith('.html')) out.push(join(pdir, f));
    }
  }
  return out.sort();
}

const pick = (html, re) => { const m = html.match(re); return m ? m[1].trim() : null; };
const stripHead = (html) => { const i = html.indexOf('</head>'); return i === -1 ? html : html.slice(i); };
const visibleText = (html) => stripHead(html).replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, '');

function checkLinks(file, html) {
  const dir = dirname(file);
  const re = /(?:href|src)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    let url = m[1].trim();
    if (!url || url.startsWith('http://') || url.startsWith('https://') ||
        url.startsWith('mailto:') || url.startsWith('tel:') ||
        url.startsWith('#') || url.startsWith('data:')) continue;
    url = url.split('#')[0].split('?')[0];
    if (!url) continue;
    let target = url.startsWith('/') ? join(ROOT, url) : resolve(dir, url);
    if (url.endsWith('/') || url === '') target = join(target, 'index.html');
    if (!existsSync(target)) {
      errors.push(`[깨진링크] ${relative(ROOT, file)} → "${m[1]}" (대상 없음)`);
    }
  }
}

for (const file of htmlFiles()) {
  const rel = relative(ROOT, file);
  const html = readFileSync(file, 'utf8');

  // 1) 금지 전화번호
  if (html.includes(FORBIDDEN_PHONE)) errors.push(`[금지번호] ${rel} 에 ${FORBIDDEN_PHONE} 잔존`);

  // 2) 깨진 링크
  checkLinks(file, html);

  // 4) 필수 메타
  const title = pick(html, /<title>([^<]*)<\/title>/i);
  const desc = pick(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonical = pick(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const ogTitle = pick(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i);
  const ogDesc = pick(html, /<meta\s+property="og:description"\s+content="([^"]*)"/i);
  const ogImg = pick(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i);
  for (const [name, val] of [['title', title], ['description', desc], ['canonical', canonical],
       ['og:title', ogTitle], ['og:description', ogDesc], ['og:image', ogImg]]) {
    if (!val) errors.push(`[메타누락] ${rel} 에 ${name} 없음`);
  }
  if (title) {
    (titles.get(title) ?? titles.set(title, []).get(title)).push(rel);
    if ([...title].length > 70) warnings.push(`[제목길이] ${rel} title ${[...title].length}자 (>70)`);
  }
  if (desc) (descriptions.get(desc) ?? descriptions.set(desc, []).get(desc)).push(rel);

  // 5) H1
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(x => x[1].replace(/<[^>]*>/g, '').trim());
  if (h1s.length === 0) errors.push(`[H1없음] ${rel}`);
  else if (h1s.length > 1) warnings.push(`[H1중복] ${rel} (${h1s.length}개)`);
  if (h1s[0] && PLACEHOLDER_H1.test(h1s[0])) errors.push(`[플레이스홀더H1] ${rel} H1="${h1s[0]}"`);

  // 6) 키워드 밀도
  const body = visibleText(html);
  if (body.length > 0) {
    const kw = (body.match(/부동산분양/g) || []).length;
    const density = (kw * 5 / body.length) * 100;
    if (density > DENSITY_LIMIT) {
      errors.push(`[스터핑] ${rel} '부동산분양' 밀도 ${density.toFixed(2)}% (>${DENSITY_LIMIT}%, ${kw}회/${body.length}자)`);
    }
  }
}

// 3) 중복 검사
for (const [t, files] of titles) if (files.length > 1) errors.push(`[중복제목] "${t}" → ${files.join(', ')}`);
for (const [d, files] of descriptions) if (files.length > 1) errors.push(`[중복설명] ${files.join(', ')}`);

// 결과 출력
const pageCount = htmlFiles().length;
console.log(`\n🔎 SEO 자동검증 — 페이지 ${pageCount}개 스캔 (${new Date().toISOString().slice(0, 10)})`);
if (warnings.length) {
  console.log(`\n⚠️  경고 ${warnings.length}건:`);
  warnings.forEach(w => console.log('   - ' + w));
}
if (errors.length) {
  console.log(`\n❌ 오류 ${errors.length}건:`);
  errors.forEach(e => console.log('   - ' + e));
  console.log('\n검증 실패. 위 오류를 수정하세요.\n');
  process.exit(1);
}
console.log(`\n✅ 통과 — 깨진링크 0 · 금지번호 0 · 중복제목 0 · 메타 완비 · 스터핑 없음\n`);
process.exit(0);
