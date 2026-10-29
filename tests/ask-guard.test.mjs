import test from 'node:test'; import assert from 'node:assert/strict';
import { askResponseProblem, askProblemMessage } from '../site/ask-guard.js';

test('legacy fact-check shape from a stale worker is rejected, not rendered as an answer', () => {
  assert.equal(askResponseProblem({ results: [], factcheck_enabled: false }), 'bad_shape');
});

test('empty answer with no opened source is rejected', () => {
  assert.equal(askResponseProblem({ decision: 'answer', answer: '', sources: [] }), 'empty_answer');
  assert.equal(askResponseProblem({ decision: 'answer', answer: '   ', sources: [{ exists: false }] }), 'empty_answer');
});

test('real answers pass', () => {
  assert.equal(askResponseProblem({ decision: 'answer', answer: 'خلاصة موثقة [S1].', sources: [{ exists: true }] }), null);
  assert.equal(askResponseProblem({ decision: 'extractive', answer: '', sources: [{ exists: true }] }), null);
});

test('honest abstentions pass through untouched', () => {
  assert.equal(askResponseProblem({ decision: 'insufficient', insufficient_reason: 'generation_failed', sources: [] }), null);
});

test('garbage is rejected', () => {
  assert.equal(askResponseProblem(null), 'bad_shape');
  assert.equal(askResponseProblem([]), 'bad_shape');
  assert.equal(askResponseProblem('text'), 'bad_shape');
});

test('every problem has an honest Arabic message that does not blame the information', () => {
  for (const p of ['bad_shape', 'empty_answer']) {
    const msg = askProblemMessage(p);
    assert.ok(msg.includes('لا يعني غياب المعلومة'), p);
    assert.ok(!/صحيحة|موثوقة/.test(msg), p);
  }
});
