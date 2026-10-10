/* 스크립트 로드 순서 검사 — 모듈 없이 전역을 나눠 쓰는 구조라서, 순서가 어긋나면 화면이 뜰 때 바로 깨져요.
   index.html 의 <script src> 순서를 그대로 읽어서 아래 세 가지를 확인해요.
   1) 같은 이름의 전역을 두 파일이 선언하지 않았나
   2) 스크립트가 처음 실행될 때(함수 바깥) 쓰는 전역이 그보다 뒤 파일 또는 뒤쪽 줄에서 선언되지 않았나(let/const/class 는 선언 전에 쓰면 오류)
   3) 어느 파일에서도 선언되지 않고 브라우저 기본 전역도 아닌 이름을 쓰지 않나(오타·빠진 선언)
   실행: npm run check:order */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const eslintScope = require('eslint-scope');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const order = [...html.matchAll(/<script[^>]+src="(js\/[^"]+)"/g)].map(m => m[1]);
/* Node 에도 있는 전역(Math·JSON 등)은 자동으로 통과하고, 브라우저에만 있는 것은 아래 목록에 적어요. 새 브라우저 API 를 쓰면 여기에 한 줄 더하세요 */
const BROWSER = new Set([
  'CSS', 'FileReader', 'Highlight', 'Image', 'InputEvent', 'MutationObserver', 'NodeFilter', 'Range', 'ResizeObserver', 'addEventListener', 'confirm', 'document', 'getSelection', 'innerHeight', 'innerWidth', 'localStorage', 'matchMedia', 'requestAnimationFrame', 'scrollBy', 'scrollTo', 'scrollY', 'sessionStorage', 'window',
]);
const known = n => n in globalThis || BROWSER.has(n);

const files = order.map(f => {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', ranges: true, locations: true });
  const scope = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' }).globalScope;
  return { f, scope };
});

const owner = new Map();
const problems = [];
files.forEach(({ f, scope }, idx) => {
  for (const v of scope.variables) {
    if (!v.defs.length) continue;
    if (owner.has(v.name)) problems.push(`중복 선언: ${v.name} (${owner.get(v.name).f}, ${f})`);
    else owner.set(v.name, { f, idx, v });
  }
});

files.forEach(({ f, scope }, idx) => {
  const refs = [...scope.through];
  for (const v of scope.variables) refs.push(...v.references);
  for (const r of refs) {
    const name = r.identifier.name;
    const o = owner.get(name);
    if (!o) {
      if (!known(name) && r.resolved === null) problems.push(`선언 없는 이름: ${name} (${f}:${r.identifier.loc.start.line})`);
      continue;
    }
    const topLevel = r.from.variableScope.type === 'global';
    if (!topLevel) continue; /* 함수 안에서 쓰는 건 호출될 때 평가돼서 괜찮아요 */
    const line = r.identifier.loc.start.line;
    if (o.idx > idx) problems.push(`로드 순서: ${f}:${line} 이(가) 처음 실행될 때 ${name} 을(를) 쓰는데, ${name} 은(는) 뒤에 로드되는 ${o.f} 에 있어요`);
    else if (o.idx === idx) {
      const def = o.v.defs[0];
      const isLexical = def.type === 'Variable' && def.parent.kind !== 'var' || def.type === 'ClassName';
      if (isLexical && def.name.loc.start.line > line) problems.push(`선언 전 사용: ${f}:${line} ${name}`);
    }
  }
});

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`확인 완료: 스크립트 ${order.length}개(${order.map(f => path.basename(f, '.js')).join(' → ')}), 전역 ${owner.size}개`);
