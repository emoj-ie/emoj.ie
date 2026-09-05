import assert from 'node:assert/strict';
import test from 'node:test';

import { nodeVersionSatisfies, parseVersionTuple } from '../utils/ci/run-local-ci.mjs';

test('parseVersionTuple rejects trailing garbage', () => {
  assert.equal(parseVersionTuple('22garbage'), null);
  assert.equal(parseVersionTuple('v22.1.0-extra'), null);
});

test('nodeVersionSatisfies fails closed on malformed comparator targets', () => {
  assert.equal(nodeVersionSatisfies('22.0.0', '>=22garbage'), false);
  assert.equal(nodeVersionSatisfies('22.0.0', '>=22 || >=22garbage'), true);
  assert.equal(nodeVersionSatisfies('22.0.0', '>=22garbage || >=23'), false);
});
