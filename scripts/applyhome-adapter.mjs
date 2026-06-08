#!/usr/bin/env node
/**
 * applyhome-adapter.mjs — 청약홈(한국부동산원) 분양정보 → SSOT 스키마 어댑터
 *
 * 공공데이터포털(data.go.kr) "청약홈 분양정보 조회 서비스" 실연동.
 *   - APT 분양정보:   ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail
 *   - 오피스텔/도시형 등: getUrbanTypeAndOfftelLttotPblancDetail
 * 인증키: 환경변수 DATA_GO_KR_KEY (본진이 쓰는 data.go.kr 키 재사용 가능).
 *
 * 키 없으면 빈 배열 반환(파이프라인이 기존 SSOT 유지 — 창작 0).
 * 출력: SSOT 스키마 배열 [{name,region,category,price,units,...,applyEnd,source:'청약홈',sourceName,sourceDate}]
 *
 * 단독 실행: DATA_GO_KR_KEY=xxx node scripts/applyhome-adapter.mjs
 */
const KEY = process.env.DATA_GO_KR_KEY;
const BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1';

const ENDPOINTS = [
  { path: 'getAPTLttotPblancDetail', category: '아파트' },
  { path: 'getUrbanTypeAndOfftelLttotPblancDetail', category: '오피스텔' },
];

function regionKey(s = '') {
  if (s.includes('서울')) { const m = s.match(/([가-힣]+구)/); return m ? '서울 ' + m[1] : '서울'; }
  const m = s.match(/([가-힣]+시)/); if (m) return m[1];
  const d = s.match(/부산|대전|대구|인천|울산|세종|경남|경북|전남|전북|충남|충북|강원|제주/);
  return d ? d[0] : '전국';
}
const iso = d => (d && /^\d{8}$/.test(d)) ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
  : (d && /^\d{4}-\d{2}-\d{2}/.test(d)) ? d.slice(0,10) : null;

async function fetchPage(ep, page) {
  const u = `${BASE}/${ep.path}?page=${page}&perPage=100&serviceKey=${encodeURIComponent(KEY)}`;
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${ep.path} HTTP ${r.status}`);
  return r.json();
}

function mapRow(row, category) {
  // 청약홈 응답 필드명(가변) — 안전 매핑
  const name = row.HOUSE_NM || row.PBLANC_NM || row.BSNS_MBY_NM;
  if (!name) return null;
  const addr = row.HSSPLY_ADRES || row.RCRIT_PBLANC_ADRES || '';
  const end = iso(row.RCEPT_ENDDE || row.SUBSCRPT_RCEPT_ENDDE || row.GNRL_RNK1_CRSPAREA_RCPTDE);
  const begin = iso(row.RCEPT_BGNDE || row.SUBSCRPT_RCEPT_BEGINDE);
  return {
    name: name.trim(),
    region: regionKey(addr),
    category,
    price: row.SUPLY_AMOUNT || row.LTTOT_TOP_AMOUNT || null,  // 최고분양가(있을 때만)
    units: row.TOT_SUPLY_HSHLDCO ? `${row.TOT_SUPLY_HSHLDCO}세대` : null,
    builder: row.CNSTRCT_ENTRPS_NM || row.BSNS_MBY_NM || null,
    moveIn: iso(row.MVN_PREARNGE_YM) || row.MVN_PREARNGE_YM || null,
    schedule: begin ? `${begin} 청약` : null,
    applyEnd: end,                 // ★자동종료 기준일
    source: '청약홈',
    sourceName: '청약홈(한국부동산원)',
    sourceUrl: 'https://www.applyhome.co.kr/',
    pblancNo: row.PBLANC_NO || row.HOUSE_MANAGE_NO || null,
  };
}

export async function fetchApplyhome() {
  if (!KEY) { console.error('⚠ DATA_GO_KR_KEY 미설정 → 청약홈 동기화 건너뜀(기존 SSOT 유지)'); return []; }
  const out = [];
  for (const ep of ENDPOINTS) {
    for (let page = 1; page <= 5; page++) {
      let j; try { j = await fetchPage(ep, page); } catch (e) { console.error('청약홈 오류:', e.message); break; }
      const rows = j.data || [];
      for (const row of rows) { const m = mapRow(row, ep.category); if (m) out.push(m); }
      if (rows.length < 100) break;
    }
  }
  console.error(`청약홈 수집: ${out.length}건`);
  return out;
}

// 단독 실행 시 stdout으로 JSON
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchApplyhome().then(a => console.log(JSON.stringify(a, null, 2)));
}
