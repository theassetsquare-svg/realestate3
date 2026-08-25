import fs from 'node:fs';
import path from 'node:path';
const DIR = path.resolve('D:/naver-watch/repos/realestate3/tools/night/content');
const APPLY = process.argv.includes('--apply');
const TAIL = {
  4: ['자리를 뜰 수 있는 상태로 오면 두 층이 온전히 내 것이 됩니다. 그러지 못하면 절반만 쓰고 나옵니다.'],
  6: ['시계를 맞추는 일은 마음을 다잡는 일보다 훨씬 쉽습니다. 그래서 이 방법이 오래갑니다.'],
  7: ['오가는 길이 편한 계절에는 홀에 도착하기 전에 이미 기분이 좋아져 있습니다. 그 상태로 들어가면 그날이 다릅니다.'],
  9: ['늦은 시각의 이동은 미리 본 사람과 안 본 사람의 차이가 가장 크게 벌어지는 대목입니다.'],
  10: ['격식을 갖추려다 오히려 겉도는 것보다, 편하게 입고 자연스럽게 섞이는 편이 그날을 낫게 만듭니다.'],
  20: ['들고 갈지 두고 갈지 고민이 될 때는 그것 없이 자리를 뜰 수 있는지 한 번 물어보면 답이 나옵니다.'],
  26: ['같은 자리를 두고 사람마다 평이 갈리는 것은 본 것이 달라서가 아니라 들고 간 기대가 달라서입니다.'],
  27: ['목록에서 하나를 고르는 것과 그 주소를 지도에 넣어 보는 것 사이에는 하룻밤만큼의 차이가 있습니다.'],
  28: ['짧은 목록은 잘 지켜지고, 잘 지켜지는 것만이 실제로 준비라고 부를 만합니다.'],
  31: ['같은 인원이 오래 머무는 밤과 짧게 스쳐 가는 밤은 사람 수가 같아도 전혀 다른 공간이 됩니다.'],
  32: ['한 번 거절당했다고 관심이 없는 것으로 결론 내면 다음 기회가 통째로 사라집니다.'],
  33: ['새로 나올 말이 남았는지를 살피는 편이 시계를 보는 것보다 그날을 정확하게 읽어 줍니다.'],
  38: ['짧게라도 자주 얼굴을 비추는 쪽이 한 번에 오래 앉아 있는 쪽보다 훨씬 빨리 익숙해집니다.'],
  39: ['날씨를 이유로 삼기 시작하면 어느 계절에도 이유가 하나씩 생깁니다. 날짜가 그 고리를 끊어 줍니다.'],
  40: ['먼저 자리를 잡아 둔 일정 주위로 나머지가 배치됩니다. 순서를 바꾸는 것만으로 결과가 달라집니다.'],
};
let n = 0;
for (const no of Object.keys(TAIL).map(Number).sort((a, b) => a - b)) {
  const p = path.join(DIR, `${no}.mjs`);
  let src = fs.readFileSync(p, 'utf8');
  const idx = src.lastIndexOf('      ],\n');
  if (idx < 0) { console.log('구역 끝 못 찾음', no); continue; }
  const add = TAIL[no].map((t) => `        ${JSON.stringify(t).replace(/"/g, "'")},\n`).join('');
  src = src.slice(0, idx) + add + src.slice(idx);
  if (APPLY) fs.writeFileSync(p, src, 'utf8');
  n++;
}
console.log('문단 덧붙임', n, APPLY ? '저장함' : '(--apply 필요)');
