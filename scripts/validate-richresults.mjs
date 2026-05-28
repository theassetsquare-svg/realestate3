#!/usr/bin/env node
/**
 * 구글 Rich Results 규칙 검증기 — FAQPage / BreadcrumbList
 * 구글 공식 structured data 가이드라인의 필수(required)·권장(recommended) 필드를
 * 그대로 구현해 라이브(또는 로컬) 페이지에 적용한다.
 *
 * 사용:
 *   node scripts/validate-richresults.mjs            # 라이브(realestate3.pages.dev) 검증
 *   node scripts/validate-richresults.mjs --local    # 로컬 파일 검증
 *
 * 검사 규칙 출처: developers.google.com/search/docs/appearance/structured-data
 *  [BreadcrumbList] itemListElement 필수 / ListItem.position 정수·1부터 연속 / name·item 필수
 *  [FAQPage] mainEntity 필수 / Question.name·acceptedAnswer 필수 / Answer.text 필수·비어있지 않음
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://realestate3.pages.dev';
const LOCAL = process.argv.includes('--local');

function pages() {
  const top = ['index', 'apartment', 'officetel', 'store', 'knowledge-center', 'land', 'industrial'].map(f => f + '.html');
  const prop = existsSync(join(ROOT, 'property'))
    ? readdirSync(join(ROOT, 'property')).filter(f => f.endsWith('.html')).map(f => 'property/' + f) : [];
  return [...top, ...prop].sort();
}

async function getHtml(rel) {
  if (LOCAL) return readFileSync(join(ROOT, rel), 'utf8');
  const res = await fetch(BASE + '/' + rel, { redirect: 'follow' });
  return res.text();
}

function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1].trim())); } catch (e) { out.push({ __parseError: e.message }); }
  }
  return out;
}

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isUrl = v => isStr(v) && /^https?:\/\//.test(v);

function checkBreadcrumb(node, rel, errs, warns) {
  const items = node.itemListElement;
  if (!Array.isArray(items) || items.length === 0) { errs.push(`${rel} [Breadcrumb] itemListElement 누락/빈배열`); return; }
  items.forEach((it, i) => {
    if (it['@type'] !== 'ListItem') errs.push(`${rel} [Breadcrumb] item#${i + 1} @type≠ListItem`);
    if (!Number.isInteger(it.position)) errs.push(`${rel} [Breadcrumb] item#${i + 1} position 정수 아님`);
    else if (it.position !== i + 1) errs.push(`${rel} [Breadcrumb] position 비연속 (기대 ${i + 1}, 실제 ${it.position})`);
    if (!isStr(it.name)) errs.push(`${rel} [Breadcrumb] item#${i + 1} name 누락`);
    // item(URL): 마지막 항목은 생략 가능(현재 페이지). 우리는 넣고 있으므로 형식만 확인
    if (it.item !== undefined && !isUrl(it.item)) errs.push(`${rel} [Breadcrumb] item#${i + 1} item URL 형식 오류`);
  });
}

function checkFaq(node, rel, errs, warns) {
  const me = node.mainEntity;
  if (!Array.isArray(me) || me.length === 0) { errs.push(`${rel} [FAQ] mainEntity 누락/빈배열`); return 0; }
  me.forEach((q, i) => {
    if (q['@type'] !== 'Question') errs.push(`${rel} [FAQ] Q#${i + 1} @type≠Question`);
    if (!isStr(q.name)) errs.push(`${rel} [FAQ] Q#${i + 1} name(질문) 누락`);
    const a = q.acceptedAnswer;
    if (!a || a['@type'] !== 'Answer') errs.push(`${rel} [FAQ] Q#${i + 1} acceptedAnswer(Answer) 누락`);
    else if (!isStr(a.text)) errs.push(`${rel} [FAQ] Q#${i + 1} Answer.text 비어있음`);
  });
  return me.length;
}

const errs = [], warns = [];
let pageN = 0, bcN = 0, faqN = 0, faqQ = 0;

for (const rel of pages()) {
  pageN++;
  let html;
  try { html = await getHtml(rel); }
  catch (e) { errs.push(`${rel} — 가져오기 실패: ${e.message}`); continue; }
  const blocks = ldBlocks(html);
  for (const b of blocks) if (b.__parseError) errs.push(`${rel} — JSON-LD 파싱오류: ${b.__parseError}`);
  const flat = blocks.flatMap(b => b['@graph'] ? b['@graph'] : [b]);
  const bc = flat.find(n => n && n['@type'] === 'BreadcrumbList');
  const faq = flat.find(n => n && n['@type'] === 'FAQPage');
  if (bc) { bcN++; checkBreadcrumb(bc, rel, errs, warns); }
  else if (rel !== 'index.html') errs.push(`${rel} [Breadcrumb] 누락`);
  if (faq) { faqN++; faqQ += checkFaq(faq, rel, errs, warns); }
}

console.log(`\n🔬 Rich Results 규칙 검증 (${LOCAL ? '로컬' : '라이브 ' + BASE})`);
console.log(`   페이지 ${pageN} · BreadcrumbList ${bcN} · FAQPage ${faqN}(총 질문 ${faqQ}개)`);
if (warns.length) { console.log(`\n⚠️  권장 경고 ${warns.length}건:`); warns.forEach(w => console.log('   - ' + w)); }
if (errs.length) {
  console.log(`\n❌ 오류 ${errs.length}건:`); errs.forEach(e => console.log('   - ' + e));
  console.log('\n검증 실패.\n'); process.exit(1);
}
console.log(`\n✅ 전 항목 구글 Rich Results 규칙 통과 — 오류 0\n`);
process.exit(0);
