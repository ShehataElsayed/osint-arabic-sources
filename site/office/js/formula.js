/* Osh Sheets formula engine: Excel-compatible tokenizer/parser/evaluator.
   Pure module (no DOM, no eval/new Function) so it runs under the site's strict CSP
   and in node unit tests. Function library: Formula.js (MIT), adapted to Excel ranges. */
import FJ from '../vendor/formulajs.bundle.mjs';

export const ERR = { NULL: '#NULL!', DIV0: '#DIV/0!', VALUE: '#VALUE!', REF: '#REF!', NAME: '#NAME?', NUM: '#NUM!', NA: '#N/A', CYCLE: '#CYCLE!' };
const isErr = v => v && typeof v === 'object' && v.__err;
export const isError = isErr;
const Err = c => ({ __err: c });

/* ---------- tokenizer ---------- */
const T = { NUM: 'num', STR: 'str', BOOL: 'bool', ERR: 'err', REF: 'ref', NAME: 'name', OP: 'op', LP: '(', RP: ')', SEP: ',', WS: 'ws' };
const COL = /[A-Z]/;
export function colToNum(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
export function numToCol(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
export function parseA1(ref) {
  const m = /^\$?([A-Za-z]{1,3})\$?([0-9]{1,7})$/.exec(ref);
  if (!m) return null;
  return { c: colToNum(m[1].toUpperCase()), r: parseInt(m[2], 10), absC: ref.includes('$') && ref.indexOf('$') < ref.search(/[0-9]/), absR: /\$[0-9]/.test(ref) };
}
export function a1(r, c) { return numToCol(c) + r; }

function tokenize(src) {
  const toks = []; let i = 0;
  const s = src.replace(/^[\s=]+/, '');
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') { let j = i + 1, out = ''; while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { out += '"'; j += 2; continue; } break; } out += s[j++]; } if (j >= s.length) throw Err(ERR.VALUE); toks.push({ t: T.STR, v: out }); i = j + 1; continue; }
    if (ch === "'") { let j = i + 1, out = ''; while (j < s.length && s[j] !== "'") out += s[j++]; toks.push({ t: T.NAME, v: out, quoted: true }); i = j + 1; continue; }
    if (/[0-9.]/.test(ch) && /\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] || ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(s.slice(i)); toks.push({ t: T.NUM, v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (ch === '#') { const m = /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!)/i.exec(s.slice(i)); if (m) { toks.push({ t: T.ERR, v: m[0].toUpperCase() }); i += m[0].length; continue; } throw Err(ERR.VALUE); }
    if ('+-*/^&%()=,:;'.includes(ch)) {
      if (ch === '(') toks.push({ t: T.LP }); else if (ch === ')') toks.push({ t: T.RP });
      else if (ch === ',' || ch === ';') toks.push({ t: T.SEP });
      else if (ch === ':') toks.push({ t: T.OP, v: ':' });
      else toks.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if (ch === '<' || ch === '>') { const two = s.slice(i, i + 2); if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: T.OP, v: two }); i += 2; } else { toks.push({ t: T.OP, v: ch }); i++; } continue; }
    if (ch === '!') { toks.push({ t: T.OP, v: '!' }); i++; continue; }
    if (/[A-Za-z_؀-ۿ]/.test(ch)) {
      const m = /^[$A-Za-z0-9_.؀-ۿ]+/.exec(s.slice(i)); let w = m[0];
      const up = w.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') { toks.push({ t: T.BOOL, v: up === 'TRUE' }); i += w.length; continue; }
      const cellm = /^\$?[A-Za-z]{1,3}\$?[0-9]+$/.test(w);
      if (cellm) { toks.push({ t: T.REF, v: w.toUpperCase() }); i += w.length; continue; }
      toks.push({ t: T.NAME, v: w }); i += w.length; continue;
    }
    if (ch === '$') { const m = /^\$[A-Za-z]{1,3}\$?[0-9]+/.exec(s.slice(i)); if (m) { toks.push({ t: T.REF, v: m[0].toUpperCase() }); i += m[0].length; continue; } throw Err(ERR.VALUE); }
    throw Err(ERR.VALUE);
  }
  return toks;
}

/* ---------- parser → AST ---------- */
export function parseFormula(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos], next = () => toks[pos++];
  function parseExpr() { return parseComparison(); }
  function parseComparison() {
    let left = parseConcat();
    while (peek() && peek().t === T.OP && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const op = next().v; left = { k: 'cmp', op, l: left, r: parseConcat() }; }
    return left;
  }
  function parseConcat() { let left = parseAdd(); while (peek() && peek().t === T.OP && peek().v === '&') { next(); left = { k: 'bin', op: '&', l: left, r: parseAdd() }; } return left; }
  function parseAdd() { let left = parseMul(); while (peek() && peek().t === T.OP && (peek().v === '+' || peek().v === '-')) { const op = next().v; left = { k: 'bin', op, l: left, r: parseMul() }; } return left; }
  function parseMul() { let left = parsePow(); while (peek() && peek().t === T.OP && (peek().v === '*' || peek().v === '/')) { const op = next().v; left = { k: 'bin', op, l: left, r: parsePow() }; } return left; }
  function parsePow() { const base = parseUnary(); if (peek() && peek().t === T.OP && peek().v === '^') { next(); return { k: 'bin', op: '^', l: base, r: parsePow() }; } return base; }
  function parseUnary() { if (peek() && peek().t === T.OP && (peek().v === '-' || peek().v === '+')) { const op = next().v; return { k: 'un', op, e: parseUnary() }; } return parsePostfix(); }
  function parsePostfix() { let e = parsePrimary(); while (peek() && peek().t === T.OP && peek().v === '%') { next(); e = { k: 'pct', e }; } return e; }
  function parsePrimary() {
    const tk = next();
    if (!tk) throw Err(ERR.VALUE);
    if (tk.t === T.NUM) return { k: 'num', v: tk.v };
    if (tk.t === T.STR) return { k: 'str', v: tk.v };
    if (tk.t === T.BOOL) return { k: 'bool', v: tk.v };
    if (tk.t === T.ERR) return { k: 'err', v: tk.v };
    if (tk.t === T.LP) { const e = parseExpr(); if (!peek() || next().t !== T.RP) throw Err(ERR.VALUE); return e; }
    if (tk.t === T.REF || tk.t === T.NAME) {
      let sheet = null, first = tk;
      if (peek() && peek().t === T.OP && peek().v === '!') { next(); sheet = tk.v; first = next(); if (!first || (first.t !== T.REF && first.t !== T.NAME)) throw Err(ERR.REF); }
      if (first.t === T.NAME && peek() && peek().t === T.LP) {
        next();
        const args = [];
        if (peek() && peek().t === T.RP) { next(); return { k: 'call', name: first.v.toUpperCase(), args }; }
        while (true) { args.push(parseExpr()); const p = next(); if (!p) throw Err(ERR.VALUE); if (p.t === T.RP) break; if (p.t !== T.SEP) throw Err(ERR.VALUE); }
        return { k: 'call', name: first.v.toUpperCase(), args };
      }
      if (first.t !== T.REF) { if (sheet) throw Err(ERR.REF); throw Err(ERR.NAME); }
      const a = parseA1(first.v); if (!a) throw Err(ERR.REF);
      if (peek() && peek().t === T.OP && peek().v === ':') {
        next(); let sheet2 = null, tk2 = next();
        if (tk2 && (tk2.t === T.NAME) && peek() && peek().t === T.OP && peek().v === '!') { next(); sheet2 = tk2.v; tk2 = next(); }
        if (!tk2 || tk2.t !== T.REF) throw Err(ERR.REF);
        const b = parseA1(tk2.v); if (!b) throw Err(ERR.REF);
        return { k: 'range', sheet, a, b };
      }
      return { k: 'cell', sheet, ...a };
    }
    throw Err(ERR.VALUE);
  }
  const ast = parseExpr();
  if (pos < toks.length) throw Err(ERR.VALUE);
  return ast;
}

/* ---------- evaluator ---------- */
/* resolver: { cell(sheet, r, c) -> raw value, range(sheet, r1, c1, r2, c2) -> 2D array } */
export function evaluate(ast, resolver, state) {
  state = state || { depth: 0 };
  if (++state.depth > 250) throw Err(ERR.CYCLE);
  try { return ev(ast, resolver, state); } finally { state.depth--; }
}
function num(v) {
  if (isErr(v)) throw v;
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(String(v).replace(/[٬,\s]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (Number.isNaN(n)) throw Err(ERR.VALUE);
  return n;
}
function str(v) { if (isErr(v)) throw v; if (v == null) return ''; if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; return String(v); }
function bool(v) { if (isErr(v)) throw v; if (typeof v === 'boolean') return v; if (typeof v === 'number') return v !== 0; const s = String(v).toUpperCase(); if (s === 'TRUE') return true; if (s === 'FALSE') return false; if (s === '') return false; throw Err(ERR.VALUE); }
function ev(node, R, S) {
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'err': throw Err(node.v);
    case 'cell': return R.cell(node.sheet || null, node.r, node.c);
    case 'range': { const { a, b } = node; return R.range(node.sheet || null, Math.min(a.r, b.r), Math.min(a.c, b.c), Math.max(a.r, b.r), Math.max(a.c, b.c)); }
    case 'pct': return num(ev(node.e, R, S)) / 100;
    case 'un': { const v = num(ev(node.e, R, S)); return node.op === '-' ? -v : v; }
    case 'bin': {
      if (node.op === '&') return str(ev(node.l, R, S)) + str(ev(node.r, R, S));
      const l = num(ev(node.l, R, S)), r = num(ev(node.r, R, S));
      switch (node.op) {
        case '+': return l + r; case '-': return l - r; case '*': return l * r;
        case '/': if (r === 0) throw Err(ERR.DIV0); return l / r;
        case '^': { const p = Math.pow(l, r); if (Number.isNaN(p)) throw Err(ERR.NUM); return p; }
      } break;
    }
    case 'cmp': {
      const l = ev(node.l, R, S), r = ev(node.r, R, S);
      if (isErr(l)) throw l; if (isErr(r)) throw r;
      const bothNum = (typeof l === 'number' || l == null || l === '' || typeof l === 'boolean') && (typeof r === 'number' || r == null || r === '' || typeof r === 'boolean');
      let c;
      if (bothNum) c = num(l) - num(r);
      else c = str(l).toLowerCase().localeCompare(str(r).toLowerCase(), 'ar');
      switch (node.op) { case '=': return c === 0; case '<>': return c !== 0; case '<': return c < 0; case '>': return c > 0; case '<=': return c <= 0; case '>=': return c >= 0; }
      break;
    }
    case 'call': return callFn(node, R, S);
  }
  throw Err(ERR.VALUE);
}
const LAZY = new Set(['IF', 'IFERROR', 'IFNA', 'CHOOSE', 'AND', 'OR', 'SWITCH', 'IFS']);
function callFn(node, R, S) {
  const name = node.name;
  const fj = FJ[name];
  if (!fj) throw Err(ERR.NAME);
  if (name === 'IF') {
    const cond = bool(ev(node.args[0], R, S));
    if (cond) return node.args[1] ? ev(node.args[1], R, S) : true;
    return node.args[2] ? ev(node.args[2], R, S) : false;
  }
  if (name === 'IFERROR') { try { const v = ev(node.args[0], R, S); return isErr(v) ? ev(node.args[1], R, S) : v; } catch (e) { if (isErr(e)) return ev(node.args[1], R, S); throw e; } }
  if (name === 'IFNA') { try { const v = ev(node.args[0], R, S); return isErr(v) && v.__err === ERR.NA ? ev(node.args[1], R, S) : v; } catch (e) { if (isErr(e) && e.__err === ERR.NA) return ev(node.args[1], R, S); throw e; } }
  if (name === 'CHOOSE') { const i = num(ev(node.args[0], R, S)); if (i < 1 || i > node.args.length - 1) throw Err(ERR.VALUE); return ev(node.args[i], R, S); }
  if (name === 'AND') { for (const a of node.args) { const v = ev(a, R, S); const vals = Array.isArray(v) ? v.flat(Infinity) : [v]; if (!vals.every(x => bool(x))) return false; } return true; }
  if (name === 'OR') { for (const a of node.args) { const v = ev(a, R, S); const vals = Array.isArray(v) ? v.flat(Infinity) : [v]; if (vals.some(x => bool(x))) return true; } return false; }
  const args = node.args.map(a => {
    const v = ev(a, R, S);
    if (isErr(v)) throw v;
    return v;
  });
  try {
    const out = fj(...args);
    if (out && typeof out === 'object' && out instanceof Error) throw Err(mapFjErr(out));
    if (typeof out === 'number' && Number.isNaN(out)) throw Err(ERR.NUM);
    return out === undefined ? null : out;
  } catch (e) {
    if (isErr(e)) throw e;
    throw Err(mapFjErr(e));
  }
}
function mapFjErr(e) { const m = String(e && e.message || ''); if (m.includes('#')) return m; return ERR.VALUE; }

/* Convenience: evaluate source text against resolver */
export function evalFormula(src, resolver) {
  if (typeof src !== 'string' || !src.trim()) return '';
  const ast = parseFormula(src);
  return evaluate(ast, resolver);
}
