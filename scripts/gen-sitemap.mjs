#!/usr/bin/env node
/**
 * gen-sitemap.mjs — 전 페이지 sitemap.xml 재생성(클린 URL + lastmod). 404 제외.
 * lastmod: GATE_TODAY | 시스템 날짜.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://realestate3.pages.dev';
const today = process.env.GATE_TODAY || new Date().toISOString().slice(0, 10);

const cats = ['apartment', 'officetel', 'store', 'knowledge-center', 'land', 'industrial'];
const props = readdirSync(join(ROOT, 'property')).filter(f => f.endsWith('.html')).map(f => basename(f, '.html')).sort();

const urls = [
  { loc: `${BASE}/`, pr: '1.0' },
  ...cats.map(c => ({ loc: `${BASE}/${c}`, pr: '0.8' })),
  ...props.map(s => ({ loc: `${BASE}/property/${s}`, pr: '0.7' })),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pr}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), xml);
console.log(`✅ sitemap: ${urls.length} URL (lastmod ${today})`);
