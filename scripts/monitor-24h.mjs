/**
 * 24h 자동 모니터 — realestate3
 *  1. 라이브 헬스체크: sitemap 전 URL 200 응답 검증 (실패 = CRITICAL)
 *  2. GSC 색인 점검: 주요 페이지 색인 상태 (정보)
 *  3. Core Web Vitals: PageSpeed Insights 모바일/PC 점수 (낮으면 경고)
 * CRITICAL 발견 시 monitor-report.md 작성 + exit 1 → 워크플로가 GitHub Issue 생성(소유자 메일 발송)
 */
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SITE = 'https://realestate3.pages.dev';
const critical = [];   // 사이트 다운/404 등 → 메일
const warn = [];       // CWV 낮음 등
const info = [];       // 색인 현황 등

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function gscToken() {
  const raw = process.env.GSC_SA_KEY;
  if (!raw) return null;
  try {
    const key = JSON.parse(raw);
    const n = Math.floor(Date.now() / 1000);
    const h = b64({ alg: 'RS256', typ: 'JWT' });
    const c = b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: n, exp: n + 3600 });
    const s = crypto.createSign('RSA-SHA256'); s.update(`${h}.${c}`);
    const jwt = `${h}.${c}.${s.sign(key.private_key).toString('base64url')}`;
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
    return (await r.json()).access_token || null;
  } catch (e) { warn.push(`GSC 인증 실패: ${e.message}`); return null; }
}

// 1) 라이브 헬스체크 (sitemap 전 URL)
async function healthCheck() {
  let urls = [];
  try {
    const sm = await (await fetch(`${SITE}/sitemap.xml`)).text();
    urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  } catch (e) { critical.push(`sitemap.xml 로드 실패: ${e.message}`); return; }
  if (!urls.length) { critical.push('sitemap.xml에 URL이 없음'); return; }
  let ok = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: 'manual' });
      if (r.status === 200) ok++;
      else if (r.status >= 300 && r.status < 400) critical.push(`리다이렉트(색인저해): ${u} → ${r.status} ${r.headers.get('location') || ''}`);
      else critical.push(`비정상 응답: ${u} → HTTP ${r.status}`);
    } catch (e) { critical.push(`접속 실패: ${u} (${e.message})`); }
  }
  info.push(`헬스체크: ${ok}/${urls.length} 페이지 정상(200)`);
}

// 2) GSC 색인 점검 (주요 페이지)
async function indexCheck(token) {
  if (!token) { info.push('GSC 색인점검 건너뜀(GSC_SA_KEY 없음)'); return; }
  const sample = ['/', '/apartment', '/officetel', '/property/lacleche-xi-the-fine'];
  let indexed = 0, unknown = 0;
  for (const p of sample) {
    try {
      const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: SITE + p, siteUrl: SITE + '/' }) });
      const j = await r.json();
      const st = j.inspectionResult?.indexStatusResult?.coverageState || '?';
      if (/indexed/i.test(st)) indexed++; else if (/unknown/i.test(st)) unknown++;
      info.push(`색인 ${p} → ${st}`);
    } catch (e) { /* ignore */ }
  }
  if (unknown >= sample.length - 1) info.push('⚠️ 대부분 미색인 — 신규 사이트면 정상(크롤 대기), 지속되면 색인요청 필요');
}

// 3) Core Web Vitals (PSI)
async function cwvCheck() {
  const key = process.env.PSI_API_KEY ? `&key=${process.env.PSI_API_KEY}` : '';
  for (const strat of ['mobile', 'desktop']) {
    try {
      const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(SITE + '/')}&strategy=${strat}&category=performance${key}`);
      const j = await r.json();
      const score = Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
      if (score) {
        info.push(`Core Web Vitals(${strat}): ${score}점`);
        if (score < 80) warn.push(`성능 낮음 ${strat}: ${score}점 (목표 90+)`);
      }
    } catch (e) { /* PSI 레이트리밋 무시 */ }
  }
}

const token = await gscToken();
await healthCheck();
await indexCheck(token);
await cwvCheck();

const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
let md = `# realestate3 24h 모니터 리포트 (${now} UTC)\n\n`;
if (critical.length) { md += `## 🔴 CRITICAL (${critical.length})\n` + critical.map(x => `- ${x}`).join('\n') + '\n\n'; }
if (warn.length) { md += `## 🟡 경고 (${warn.length})\n` + warn.map(x => `- ${x}`).join('\n') + '\n\n'; }
md += `## ℹ️ 현황\n` + info.map(x => `- ${x}`).join('\n') + '\n';
writeFileSync('monitor-report.md', md);

console.log(md);
if (critical.length) {
  console.log(`::error::CRITICAL ${critical.length}건 발견 — 알림 발송`);
  process.exit(1);
}
console.log('✅ CRITICAL 없음');
