#!/usr/bin/env node
/**
 * indexnow.mjs — IndexNow 일괄 제출(Bing·Yandex·Seznam 등 IndexNow 참여 엔진)
 * sitemap.xml의 전 URL을 제출. 키파일: /<KEY>.txt (사이트 루트 정적 제공).
 * ※ 네이버는 IndexNow 미참여 → 사이트맵 등록/GSC·서치어드바이저 경로 별도(워크플로 주석 참고).
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'realestate3.pages.dev';
const KEY = 'a3f9c1e7b24d4f8a9e6c0b5d2f7a1c84';

const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urls.length) { console.error('sitemap URL 없음'); process.exit(0); }

const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };
try {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
  });
  console.log(`IndexNow 제출: ${urls.length}개 URL → HTTP ${r.status}`);
  if (![200, 202].includes(r.status)) process.exitCode = 0; // 비치명(다음 주기 재시도)
} catch (e) { console.error('IndexNow 오류(비치명):', e.message); }
