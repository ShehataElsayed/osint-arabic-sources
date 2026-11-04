import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalFormula, parseFormula, colToNum, numToCol, parseA1, isError, ERR } from '../site/office/js/formula.js';

/* grid-backed resolver from a plain object {"1,1": value} (r,c 1-based) */
function grid(cells) {
  return {
    cell: (sheet, r, c) => sheet ? '' : (cells[r + ',' + c] ?? ''),
    range: (sheet, r1, c1, r2, c2) => { const out = []; for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(cells[r + ',' + c] ?? ''); out.push(row); } return out; }
  };
}
const g = grid({ '1,1': 10, '2,1': 20, '3,1': 30, '1,2': 'تفاح', '2,2': 'برتقال', '1,3': 5, '2,3': 7 });

test('A1 helpers', () => {
  assert.equal(colToNum('A'), 1); assert.equal(colToNum('AA'), 27); assert.equal(numToCol(28), 'AB');
  assert.deepEqual(parseA1('$B$12').c, 2); assert.equal(parseA1('C7').r, 7); assert.equal(parseA1('1A'), null);
});

test('arithmetic and precedence', () => {
  assert.equal(evalFormula('=1+2*3', g), 7);
  assert.equal(evalFormula('=(1+2)*3', g), 9);
  assert.equal(evalFormula('=2^3^2', g), 512);
  assert.equal(evalFormula('=-2^2', g), 4, 'unary minus binds tighter than ^ (Excel semantics)');
  assert.equal(evalFormula('=10%', g), 0.1);
  assert.equal(evalFormula('=A1+A2', g), 30);
  assert.equal(evalFormula('=A1&" كيلو"', g), '10 كيلو');
});

test('division by zero and error propagation', () => {
  assert.throws(() => evalFormula('=1/0', g), e => e.__err === ERR.DIV0);
  assert.equal(evalFormula('=IFERROR(1/0,"خطأ")', g), 'خطأ');
});

test('comparisons and IF', () => {
  assert.equal(evalFormula('=A1>5', g), true);
  assert.equal(evalFormula('=IF(A1>5,"كبير","صغير")', g), 'كبير');
  assert.equal(evalFormula('=B1=B2', g), false);
  assert.equal(evalFormula('=A1<>10', g), false);
});

test('ranges with aggregating functions', () => {
  assert.equal(evalFormula('=SUM(A1:A3)', g), 60);
  assert.equal(evalFormula('=AVERAGE(A1:A3)', g), 20);
  assert.equal(evalFormula('=MAX(A1:A3)', g), 30);
  assert.equal(evalFormula('=COUNT(A1:A3)', g), 3);
  assert.equal(evalFormula('=SUM(C1:C2,A1)', g), 22);
});

test('lookup and text functions', () => {
  assert.equal(evalFormula('=VLOOKUP(20,A1:B3,2,0)', g), 'برتقال');
  assert.equal(evalFormula('=CONCAT(B1,"-",B2)', g), 'تفاح-برتقال');
  assert.equal(evalFormula('=LEN("مرحبا")', g), 5);
  assert.equal(evalFormula('=UPPER("abc")', g), 'ABC');
});

test('booleans: AND/OR evaluate every argument like Excel', () => {
  assert.equal(evalFormula('=AND(A1>0,A2>0)', g), true);
  assert.equal(evalFormula('=OR(A1>100,A2>0)', g), true);
  assert.throws(() => evalFormula('=AND(TRUE,1/0)', g), e => e.__err === ERR.DIV0, 'AND/OR propagate errors (no short-circuit, Excel semantics)');
  assert.equal(evalFormula('=IF(FALSE,1/0,"سليم")', g), 'سليم', 'IF is lazy and skips the dead branch');
});

test('sheet-qualified and absolute refs', () => {
  const R = grid({ '1,1': 4 });
  assert.equal(evalFormula('=ورقة2!A1', R), '', 'missing sheet resolves empty through resolver');
  assert.equal(evalFormula('=$A$1*2', R), 8);
  const ast = parseFormula('=SUM(Sheet2!A1:B2)');
  assert.equal(ast.k, 'call');
});

test('unknown function and bad syntax', () => {
  assert.throws(() => evalFormula('=NOSUCHFN(1)', g), e => e.__err === ERR.NAME);
  assert.throws(() => evalFormula('=1+', g));
  assert.throws(() => evalFormula('=A1:', g));
});

test('empty cells coerce to zero', () => {
  assert.equal(evalFormula('=Z9+1', g), 1);
  assert.equal(evalFormula('=Z9&""', g), '');
});
