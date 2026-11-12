'use strict';
// Pinned HU40 firmware only. Replace render functions, never controller code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const STOCK_HASH = '06a9d5c0d3f401ee23ff99c5d890cbf2b66490dc13aa3a09c2916fd05024e18f'; // SHA-256
const MUTE_HASHES = new Set(['9c368a273677174086a2fbc016672746d10b0026b0d94d36eba888e9761d49e4', '55baf55fe7b76926b07ccd6e598a416c81d2bfec59ae7ec72751531dc89a4a7b']); // SHA-256
function buildMute(stock) {
  assert.ok(MUTE_HASHES.has(crypto.createHash('sha256').update(stock).digest('hex')), 'wrong mute chunk firmware');
  const original = '(function(){return this._self._c,this._m(0)})';
  assert.ok(String(stock).includes(original));
  const result = String(stock).replace(original, '(function(){return self.AlvidaaVolumeVisual.render.call(this,this.$createElement,false,true)})');
  new vm.Script(result);
  return result;
}
function build(stock, options = {}) {
  assert.equal(crypto.createHash('sha256').update(stock).digest('hex'), STOCK_HASH, 'wrong volume-bar firmware');
  let candidate = String(stock);
  const spans = [];
  for (const [component, directional] of [['E', false], ['_', true], ['V', false], ['A', true]]) {
    const marker = '(0,g.Z)(' + component + ',(function(){';
    const begin = candidate.indexOf(marker);
    assert.ok(begin >= 0 && candidate.indexOf(marker, begin + 1) < 0, 'ambiguous volume render');
    const start = begin + marker.length;
    const end = candidate.indexOf('}),[],!1,null,', start);
    assert.ok(end > start, 'missing render end');
    spans.push({ component, body: candidate.slice(start, end) });
    candidate = candidate.slice(0, start) + 'return self.AlvidaaVolumeVisual.render.call(this,this.$createElement,' + directional + ',false)' + candidate.slice(end);
  }
  const helper = fs.readFileSync(path.join(__dirname, 'volume-visual.js'), 'utf8');
  const config = options.cecReportedPercent ? 'self.AlvidaaCecPercentEnabled = true;\n' : '';
  const result = config + helper + '\n;\n' + candidate;
  new vm.Script(result);
  return { result, spans };
}
if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  assert.ok(input && output, 'Usage: build-volume-visual.cjs private-stock.js private-output.js');
  const dest = path.resolve(output);
  assert.ok(dest.startsWith('/tmp/') || dest.startsWith(path.resolve(__dirname, '../../firmware') + path.sep), 'vendor-containing output must stay private');
  fs.writeFileSync(dest, build(fs.readFileSync(input), { cecReportedPercent: process.argv.includes('--cec-reported-percent') }).result, { mode: 0o600 });
  fs.chmodSync(dest, 0o600);
  console.log('Built presentation-only volume candidate');
}
module.exports = { build, buildMute, STOCK_HASH };
