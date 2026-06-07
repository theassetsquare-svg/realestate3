#!/usr/bin/env node
/**
 * gen-og.mjs — og-default.png(1200×1200) 생성기 (provenance 기록용)
 *
 * 실행 전 준비(로컬 1회):
 *   npm i pureimage
 *   NanumGothic-Bold.ttf / NanumGothic-Regular.ttf 를 폰트 경로에 배치
 *     (https://github.com/google/fonts/tree/main/ofl/nanumgothic)
 *   FONT_DIR 환경변수로 폰트 폴더 지정 (기본: ./fonts)
 *
 *   node scripts/gen-og.mjs   →  og-default.png 재생성
 *
 * ※ CI 미실행(산출물 og-default.png 만 커밋). 한글 글리프 임베드로 두부(□) 없음.
 */
import * as PImage from 'pureimage';
import fs from 'node:fs';
import { join } from 'node:path';

const FONT_DIR = process.env.FONT_DIR || './fonts';
const B = PImage.registerFont(join(FONT_DIR, 'NanumGothic-Bold.ttf'), 'NB'); B.loadSync();
const R = PImage.registerFont(join(FONT_DIR, 'NanumGothic-Regular.ttf'), 'NR'); R.loadSync();

const W = 1200, H = 1200;
const img = PImage.make(W, H);
const c = img.getContext('2d');
c.fillStyle = '#16203c'; c.fillRect(0, 0, W, H);
c.fillStyle = '#e8b04b'; c.fillRect(0, 0, W, 16); c.fillRect(0, H - 16, W, 16);
c.fillStyle = '#e8b04b'; c.fillRect(W / 2 - 140, 470, 280, 8);
const center = (txt, font, y, color) => {
  c.font = font; c.fillStyle = color;
  c.fillText(txt, (W - c.measureText(txt).width) / 2, y);
};
center('2026 부동산분양', '46pt NR', 360, '#e8b04b');
center('더에셋스퀘어', '150pt NB', 640, '#ffffff');
center('전국 청약 현장 분석', '64pt NR', 770, '#cdd6ea');
center('아파트·오피스텔·상가·지식산업센터·토지·산업단지', '40pt NR', 900, '#9fb0d0');
center('theassetsquare.com', '38pt NR', 1080, '#e8b04b');
await PImage.encodePNGToStream(img, fs.createWriteStream('og-default.png'));
console.log('✅ og-default.png (1200×1200) 생성 완료');
