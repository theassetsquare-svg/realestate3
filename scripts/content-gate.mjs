#!/usr/bin/env node
/**
 * content-gate.mjs — 절대규칙/품질 게이트 (재발 방지)
 *
 * 빌드/배포 전 모든 HTML을 스캔해 아래를 차단한다.
 *   1) "무료" / "체험"            (절대규칙 #27)
 *   2) 과장·FOMO·미검증 최상급     (놓치면 후회, 100% 전문가, 역대 최고/역대급, 상승률 1위, 완판, 로또 …)
 *   3) AI=사람 표현               (전문가가 직접 방문/직접 분석, 발로 뛰 …)
 *   4) 미검증 시세차익 추정        (수억원 시세차익, 차익 확정/내재, 억 단위 차익 …)
 *   5) 종료 청약을 "예정"으로 표시 (오늘 기준 과거 연·월을 분양예정/청약중/당첨자 발표 예정으로 표기)
 *
 * 위반 발견 시 비0 종료 → CI 빨강 → 배포 차단 + Issue 알림.
 * 날짜 기준: 환경변수 GATE_TODAY(YYYY-MM-DD) 우선, 없으면 시스템 날짜.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// 스캔 대상 HTML 수집 (루트 + property/)
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

// 오늘 날짜 (CI 실측). GATE_TODAY로 테스트 주입 가능.
const todayStr = process.env.GATE_TODAY || new Date().toISOString().slice(0, 10);
const [tY, tM] = todayStr.split('-').map(Number);
const todayNum = tY * 12 + tM; // 연·월 비교용

// 1~4) 단순 금칙어 (정규식). 일부는 합법 문맥 예외 처리.
const BANNED = [
  { re: /무료/g, msg: '"무료" 사용(절대규칙 #27)' },
  { re: /체험/g, msg: '"체험" 사용(절대규칙 #27)' },
  { re: /놓치면\s*후회/g, msg: 'FOMO "놓치면 후회"' },
  { re: /놓치지\s*마/g, msg: 'FOMO "놓치지 마"' },
  { re: /마감\s*임박/g, msg: 'FOMO "마감 임박"(범용)' },
  { re: /100%\s*전문가/g, msg: '과장 "100% 전문가"' },
  { re: /역대\s*최고/g, msg: '미검증 최상급 "역대 최고"' },
  { re: /역대급/g, msg: '미검증 최상급 "역대급"' },
  { re: /상승률\s*1위/g, msg: '미검증 최상급 "상승률 1위"' },
  { re: /최고가를\s*갱신/g, msg: '미검증 최상급 "최고가를 갱신"' },
  { re: /완판/g, msg: '과장 "완판"' },
  { re: /로또/g, msg: '과장 "로또"' },
  { re: /이정표를\s*세운/g, msg: '과장 "이정표를 세운"' },
  { re: /전문가가\s*직접\s*(분석|현장|방문)/g, msg: 'AI=사람 "전문가가 직접 분석/방문"' },
  { re: /현장을\s*방문하고/g, msg: 'AI=사람 "현장을 방문하고"' },
  { re: /발로\s*뛰/g, msg: 'AI=사람 "발로 뛰"' },
  { re: /수억원\s*(의)?\s*(시세\s*)?차익/g, msg: '미검증 시세차익 "수억원 차익"' },
  { re: /차익이\s*확정/g, msg: '시세차익 단정 "차익이 확정"' },
  { re: /차익이\s*내재/g, msg: '시세차익 단정 "차익이 내재"' },
  { re: /억\s*단위\s*(시세\s*)?차익/g, msg: '미검증 시세차익 "억 단위 차익"' },
  { re: /선착순\s*마감/g, msg: '다크패턴 "선착순 마감"' },
  { re: /곧\s*마감/g, msg: '다크패턴 "곧 마감"' },
  { re: /남은\s*시간/g, msg: '다크패턴 카운트다운 "남은 시간"' },
  { re: /단\s*\d+\s*자리/g, msg: '다크패턴 재고긴박 "단 N자리"' },
];

// 합법 예외: "일몰 시점을 놓치면"(세제 일몰 안내) 은 FOMO 아님 → 임시 마스킹
function maskLegit(text) {
  return text
    .replace(/일몰\s*시점을\s*놓치면/g, '일몰_세제안내')
    .replace(/입주\s*후\s*시세\s*차익을\s*기대/g, '입주후_시세차익_기대'); // 분양가상한제 일반 설명(헤지)
}

// 5) 날짜 인지 stale: "YYYY년 M월 … (분양예정|분양 예정|분양이 예정|청약중|당첨자 발표가 예정|본청약 …)"
const STALE_YM = /(\d{4})년\s*(\d{1,2})월[^<]{0,18}?(분양예정|분양\s*예정|분양이\s*예정|청약\s*중|청약중|당첨자\s*발표가\s*예정|본청약\s*예정)/g;
// 연도 없는 월 + 미래표현: "M월 분양예정 / M월 청약중"
const STALE_M = /(?<!\d)(\d{1,2})월\s*(분양예정|청약중)/g;

let violations = 0;
const files = htmlFiles(ROOT).sort();
const pages = {}; // rel -> raw (크롤용)

for (const f of files) {
  const rel = f.replace(ROOT + '/', '');
  const raw = readFileSync(f, 'utf8');
  pages[rel] = raw;
  const text = maskLegit(raw);

  for (const { re, msg } of BANNED) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const ctx = text.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).replace(/\s+/g, ' ');
      console.error(`🔴 ${rel}: ${msg} … "${ctx}"`);
      violations++;
    }
  }

  STALE_YM.lastIndex = 0;
  let s;
  while ((s = STALE_YM.exec(text))) {
    const y = Number(s[1]), mo = Number(s[2]);
    if (y * 12 + mo < todayNum) {
      console.error(`🔴 ${rel}: 종료/지난 일정 "예정" 표기 (${y}년 ${mo}월, 오늘 ${todayStr}) … "${s[0].replace(/\s+/g, ' ')}"`);
      violations++;
    }
  }
  STALE_M.lastIndex = 0;
  while ((s = STALE_M.exec(text))) {
    const mo = Number(s[1]);
    if (mo >= 1 && mo <= 12 && mo < tM) {
      console.error(`🔴 ${rel}: 지난 월 "예정/청약중" 표기 (${mo}월 < 현재 ${tM}월) … "${s[0]}"`);
      violations++;
    }
  }

  // B) og:image — favicon/SVG 금지, 실 래스터(png/jpg/webp)만 허용
  for (const im of raw.matchAll(/og:image"\s+content="([^"]+)"/g)) {
    const u = im[1];
    if (/favicon/i.test(u) || /\.svg(\?|$)/i.test(u)) { console.error(`🔴 ${rel}: og:image가 favicon/SVG (${u})`); violations++; }
    else if (!/\.(png|jpe?g|webp)(\?|$)/i.test(u)) { console.error(`🔴 ${rel}: og:image가 실 래스터 아님 (${u})`); violations++; }
  }

  // C) JSON-LD url = .html (이중 URL) 금지 — 클린만
  for (const j of raw.matchAll(/"url":"(https:\/\/[^"]+\.html)"/g)) {
    console.error(`🔴 ${rel}: JSON-LD url에 .html (이중URL) … "${j[1]}"`);
    violations++;
  }

  // E) 엔티티 정합 — RealEstateListing name = h1
  const nm = raw.match(/"@type":"RealEstateListing","name":"([^"]+)"/);
  const h1 = raw.match(/<h1>([^<]+)<\/h1>/);
  if (nm && h1 && nm[1].trim() !== h1[1].trim()) {
    console.error(`🔴 ${rel}: 엔티티 불일치 name="${nm[1]}" ≠ h1="${h1[1]}"`);
    violations++;
  }

  // C) 내부링크 새탭 금지 — href="/..."(내부)에 target="_blank" 있으면 차단(본진 외부링크만 허용)
  for (const a of raw.matchAll(/<a\s+href="(\/[^"]*)"[^>]*target="_blank"/g)) {
    console.error(`🔴 ${rel}: 내부링크 새탭(_blank) … href="${a[1]}"`);
    violations++;
  }
  // B) 본진 0홉 — theassetsquare.com 링크 최소 1개
  if (!/href="https:\/\/theassetsquare\.com\//.test(raw)) {
    console.error(`🔴 ${rel}: 본진(theassetsquare.com) 링크 없음(0홉 CTA 누락)`);
    violations++;
  }
}

// A) 고아·콘텐츠 막다른길 — property 상세 크롤
const propRels = Object.keys(pages).filter(r => r.startsWith('property/'));
for (const rel of propRels) {
  const slug = rel.replace('property/', '').replace('.html', '');
  // 막다른길: 자기 제외 상세→상세 아웃링크 < 3
  const outs = new Set([...pages[rel].matchAll(/href="\/property\/([a-z0-9-]+)"/g)].map(m => m[1]).filter(s => s !== slug));
  if (outs.size < 3) { console.error(`🔴 ${rel}: 콘텐츠 막다른길(상세→상세 아웃링크 ${outs.size}<3)`); violations++; }
  // 고아: 타 페이지 inbound 0
  let inbound = 0;
  for (const [r2, h2] of Object.entries(pages)) {
    if (r2 === rel) continue;
    if (new RegExp(`href="/property/${slug}"`).test(h2)) { inbound++; break; }
  }
  if (!inbound) { console.error(`🔴 ${rel}: 고아(inbound 0)`); violations++; }
}

// A) soft-404 — _redirects catch-all이 200으로 홈을 반환하면 안 됨(진짜 404 필요)
try {
  const rd = readFileSync(join(ROOT, '_redirects'), 'utf8');
  if (/\/\*\s+\/index\.html\s+200/.test(rd)) {
    console.error('🔴 _redirects: catch-all "/* /index.html 200" = soft-404. "/* /404.html 404" 로 변경 필요');
    violations++;
  }
  if (!/\b404\b/.test(rd)) {
    console.error('🔴 _redirects: 404 처리 규칙 없음(존재하지 않는 경로 404 반환 필요)');
    violations++;
  }
} catch { console.error('🔴 _redirects 파일 없음'); violations++; }

// D) 카테고리 거짓 지역 — title 선두 지역이 카드 위치에 없으면 차단(전국/수도권 등 일반어는 허용)
const GENERIC = ['전국', '수도권', '경기', '서울', '인천', '지방', '광역'];
const CAT_KW = ['아파트분양', '오피스텔분양', '상가분양', '지식산업센터분양', '토지분양', '산업단지분양'];
for (const cf of ['apartment', 'officetel', 'store', 'knowledge-center', 'land', 'industrial']) {
  const p = join(ROOT, cf + '.html');
  let html; try { html = readFileSync(p, 'utf8'); } catch { continue; }
  const tt = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const kw = CAT_KW.find(k => tt.includes(k));
  if (!kw) continue;
  const region = tt.slice(0, tt.indexOf(kw)).trim().replace(/\s+/g, ' ');
  if (!region || GENERIC.some(g => region.includes(g))) continue; // 일반어 허용
  const locs = [...html.matchAll(/card-loc">([^<]+)</g)].map(m => m[1]).join(' ');
  if (!locs.includes(region)) {
    console.error(`🔴 ${cf}.html: 카테고리 거짓 지역 title="${region}…" 가 카드 위치에 없음 (실제: ${locs.slice(0,80)}…)`);
    violations++;
  }
}

if (violations) {
  console.error(`\n❌ content-gate 실패: ${violations}건 위반 (${files.length}개 파일 스캔, 기준일 ${todayStr})`);
  process.exit(1);
}
console.log(`✅ content-gate 통과: 위반 0 (${files.length}개 HTML 스캔, 기준일 ${todayStr})`);
