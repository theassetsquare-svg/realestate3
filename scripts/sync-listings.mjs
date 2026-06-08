#!/usr/bin/env node
/**
 * sync-listings.mjs — 청약홈 어댑터 → SSOT 병합 + ★만료 청약 자동종료
 *
 *  1) 어댑터 수집(키 없으면 빈 배열 → 기존 SSOT 유지)
 *  2) 병합: 기존 매칭(현장명) → 실데이터(분양가·청약일·시공사·applyEnd·출처) 갱신 / 신규 → NEW 목록
 *  3) ★자동종료: applyEnd < 오늘 → status '청약 마감' / applyEnd >= 오늘 → '분양중' / 미상 → 기존 유지
 *  4) 180일 경과 → archive 플래그
 *  결과: data/listings.json 갱신 + data/sync-report.json(new/closed)
 *  기준일: GATE_TODAY(YYYY-MM-DD) | 시스템 날짜
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchApplyhome } from './applyhome-adapter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SSOT = join(ROOT, 'data', 'listings.json');
const today = process.env.GATE_TODAY || new Date().toISOString().slice(0, 10);
const todayN = Date.parse(today);

const slugify = s => s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();

const listings = JSON.parse(readFileSync(SSOT, 'utf8'));
const byName = new Map(listings.map(l => [norm(l.name), l]));

const fetched = await fetchApplyhome();
const report = { new: [], closed: [], updated: [], date: today };

// 2) 병합
for (const f of fetched) {
  const ex = byName.get(norm(f.name));
  if (ex) {
    for (const k of ['price', 'units', 'builder', 'moveIn', 'schedule', 'applyEnd']) if (f[k]) ex[k] = f[k];
    ex.source = '청약홈'; ex.sourceName = f.sourceName; ex.sourceUrl = f.sourceUrl;
    report.updated.push(ex.slug);
  } else {
    report.new.push({ ...f, slug: slugify(f.name) }); // 신규 → gen-listing이 페이지 생성
  }
}

// 3) 자동종료 + 4) 아카이브
for (const l of listings) {
  if (l.applyEnd && Date.parse(l.applyEnd)) {
    const end = Date.parse(l.applyEnd);
    if (end < todayN) {
      if (l.status !== '청약 마감') { l.status = '청약 마감'; report.closed.push(l.slug); }
      if (todayN - end > 180 * 864e5) l.archived = true;
    } else {
      l.status = '분양중';
    }
  }
}

writeFileSync(SSOT, JSON.stringify(listings, null, 2) + '\n');
writeFileSync(join(ROOT, 'data', 'sync-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`✅ sync: 갱신 ${report.updated.length} · 신규 ${report.new.length} · 자동종료 ${report.closed.length} (기준일 ${today})`);
