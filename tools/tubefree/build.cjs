'use strict';
const fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const [input, output] = process.argv.slice(2);
assert(input && output, 'Usage: node build.cjs upstream/dist/userScript.js /tmp/zz_tizentube.user.js');
const info = JSON.parse(fs.readFileSync(path.join(__dirname, 'upstream.json')));
const original = fs.readFileSync(input, 'utf8').trim();
assert.equal(crypto.createHash('sha256').update(original).digest('hex'), info.bundleOriginalTrimmedSha256, 'Unexpected original upstream bundle');
// The local wrapper escaped two literal NUL bytes; retain that exact normalization.
const bundle = original.replace(/\x00/g, '\\0');
assert.equal(crypto.createHash('sha256').update(bundle).digest('hex'), info.bundleTrimmedSha256, 'Unexpected upstream bundle: stop and verify version/provenance');
const template = fs.readFileSync(path.join(__dirname, 'adapter.user.js.in'), 'utf8');
const marker = '/* __TIZENTUBE_UPSTREAM_BUNDLE__ */';
assert.equal(template.split(marker).length, 2);
const candidate = template.replace(marker, () => bundle);
new vm.Script(candidate);
fs.writeFileSync(output, candidate, {flag: 'wx', mode: 0o600});
console.log('Built experimental TubeFree wrapper; playback remains unverified.');
