// ==UserScript==
// @name TubeFree PO-token minter
// @version 1.2.1
// @match https://www.youtube.com/tv*
// @run-at document-start
// @grant none
// Mints a living-room PO token in-page (BotGuard att/get -> interpreter -> GenerateIT)
// and appends it as pot= to every videoplayback request so the server keeps
// serving media. NOT A WORKING FIX: the server rejected tokens in TV tests.
// ==/UserScript==
(() => {
  'use strict';
  if (window.__tfPotLoaded) return;
  // Keep this diagnostic opt-in. GVS still rejects the generated token on Odin.
  try {
    if (localStorage.getItem('tubefree-pot-experiment') !== 'on') return;
  } catch (e) { return; }
  window.__tfPotLoaded = true;

  const TAG = '[TF-POT]';
  const state = { token: null, minting: null, mintedAt: 0, ttlMs: 6 * 3600 * 1000 };
  const b64ToU8 = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const u8ToB64u = (u8) => { let bin = ''; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  async function mint() {
    if (!window.ytcfg || !ytcfg.data_) throw new Error('ytcfg not ready');
    const config = window.__tfPotConfig || {};
    if (!config.apiKey || !config.requestKey) throw new Error('experimental service configuration missing');
    const cver = ytcfg.data_.INNERTUBE_CLIENT_VERSION || '7.20261102.18.00';
    const att = await fetch('/youtubei/v1/att/get?prettyPrint=false', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'TVHTML5', clientVersion: cver, hl: 'es' } }, engagementType: 'ENGAGEMENT_TYPE_UNBOUND' }),
    }).then(r => r.json());
    const ch = att && att.bgChallenge;
    if (!ch || !ch.program) throw new Error('no bgChallenge');
    const iuRaw = ch.interpreterUrl && (ch.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue || ch.interpreterUrl);
    const iu = String(iuRaw).startsWith('http') ? String(iuRaw) : 'https:' + iuRaw;
    if (!window.__tfPotTT && window.trustedTypes && trustedTypes.createPolicy) {
      try { window.__tfPotTT = trustedTypes.createPolicy('tfpot', { createScriptURL: (s) => s }); } catch (e) { }
    }
    if (window.__tfPotTT) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = window.__tfPotTT.createScriptURL(iu); s.onload = res; s.onerror = () => rej(new Error('script load failed'));
        document.head.appendChild(s);
      });
    } else {
      const code = await fetch(iu).then(r => { if (!r.ok) throw new Error('interpreter http ' + r.status); return r.text(); });
      (0, eval)(code);
    }
    const gname = ch.globalName || 'trayride';
    const vm = window[gname];
    if (!vm || !vm.a) throw new Error('vm missing ' + gname);
    let vmFns = null;
    const vmSetupCallback = (a) => { vmFns = { asyncSnapshotFunction: a }; };
    const loggerFunctions = [() => { }, () => { }, () => { }, () => { }, () => { }];
    await vm.a(ch.program, vmSetupCallback, true, undefined, () => { }, [[], []], undefined, false, loggerFunctions);
    if (!vmFns || !vmFns.asyncSnapshotFunction) throw new Error('no asyncSnapshotFunction');
    const webPoSignalOutput = [];
    const snapshot = await new Promise((res, rej) => {
      try { vmFns.asyncSnapshotFunction(res, [undefined, undefined, webPoSignalOutput, undefined]); } catch (e) { rej(e); }
    });
    if (!snapshot) throw new Error('empty snapshot');
    const it = await fetch('https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT', {
      method: 'POST',
      headers: { 'content-type': 'application/json+protobuf', 'x-goog-api-key': config.apiKey, 'x-user-agent': 'grpc-web-javascript/0.1' },
      body: JSON.stringify([config.requestKey, snapshot]),
    }).then(r => r.json());
    const integrityToken = it && it[0];
    const fallback = it && it[3];
    const bind = (((ytcfg.data_.WEB_PLAYER_CONTEXT_CONFIGS || {}).WEB_PLAYER_CONTEXT_CONFIG_ID_LIVING_ROOM_WATCH || {}).livingRoomPoTokenId) || ytcfg.data_.LIVING_ROOM_PO_TOKEN_ID || '';
    if (integrityToken && webPoSignalOutput[0]) {
      const mintCb = await webPoSignalOutput[0](b64ToU8(integrityToken));
      const tokenBytes = await mintCb(new TextEncoder().encode(bind));
      return u8ToB64u(tokenBytes);
    }
    if (fallback) return fallback;
    throw new Error('GenerateIT returned no token');
  }

  async function ensureToken(force) {
    if (!force && state.token && (Date.now() - state.mintedAt) < state.ttlMs) return state.token;
    if (state.minting) return state.minting;
    state.minting = (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          const tok = await mint();
          state.token = tok; state.mintedAt = Date.now();
          console.log(TAG, 'minted');
          return tok;
        } catch (e) {
          console.log(TAG, 'mint attempt', i, 'failed:', String(e));
          await new Promise(r => setTimeout(r, 3000 * (i + 1)));
        }
      }
      return null;
    })();
    try { return await state.minting; } finally { state.minting = null; }
  }

  // SABR carries PO bytes inside VideoPlaybackAbrRequest.streamer_context
  // (field 19), StreamerContext.po_token (field 2), not just the URL.
  // Schema: LuanRT/googlevideo/protos/video_streaming/*.proto.
  // Preserve unknown fields byte-for-byte and fail open on malformed input.
  function pbFields(bytes) {
    let pos = 0;
    const read = () => {
      let n = 0, shift = 0;
      for (let i = 0; i < 10; i++) {
        if (pos >= bytes.length) throw new Error('truncated protobuf');
        const b = bytes[pos++];
        if (shift < 49) n += (b & 127) * Math.pow(2, shift);
        if (!(b & 128)) return n;
        shift += 7;
      }
      throw new Error('invalid varint');
    };
    const fields = [];
    while (pos < bytes.length) {
      const start = pos, tag = read(), field = Math.floor(tag / 8), wire = tag % 8;
      if (!field) throw new Error('zero field');
      let payload = pos;
      if (wire === 0) read();
      else if (wire === 1) pos += 8;
      else if (wire === 5) pos += 4;
      else if (wire === 2) { const len = read(); payload = pos; pos += len; }
      else throw new Error('unsupported wire');
      if (pos > bytes.length) throw new Error('truncated field');
      fields.push({field, wire, raw: bytes.subarray(start, pos), data: bytes.subarray(payload, pos)});
    }
    return fields;
  }
  function pbVarint(n) {
    const a = [];
    do { const b = n % 128; n = Math.floor(n / 128); a.push(b | (n ? 128 : 0)); } while (n);
    return Uint8Array.from(a);
  }
  function concatBytes(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const pbBytes = (field, data) => concatBytes([pbVarint(field * 8 + 2), pbVarint(data.length), data]);
  function patchSabr(body) {
    if (!state.token) return body;
    try {
      const bytes = new Uint8Array(body), fields = pbFields(bytes);
      if (!fields.some(f => f.field === 19 && f.wire === 2)) return body;
      const token = b64ToU8(state.token);
      const result = concatBytes(fields.map(f => {
        if (f.field !== 19 || f.wire !== 2) return f.raw;
        const context = pbFields(f.data).filter(c => c.field !== 2).map(c => c.raw);
        context.push(pbBytes(2, token));
        return pbBytes(19, concatBytes(context));
      }));
      state.patchedBodies = (state.patchedBodies || 0) + 1;
      return result;
    } catch (e) { console.log(TAG, 'SABR body unchanged:', String(e)); return body; }
  }

  const addPot = (u) => {
    if (typeof u !== 'string' || u.indexOf('videoplayback') < 0 || /[?&]pot=/.test(u) || !state.token) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'pot=' + encodeURIComponent(state.token);
  };
  const ofetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && (input.url || String(input));
      if (url && url.indexOf('videoplayback') >= 0 && !/[?&]pot=/.test(url) && state.token) {
        try {
          // Request.body is a ReadableStream even when the original POST used
          // bytes. Reusing that stream turns SABR into a streaming upload and
          // forces a CORS preflight. Buffer a clone; preserve the caller's body
          // and pass through unchanged if cloning fails.
          const request = input instanceof Request && !init ? input.clone()
            : new Request(input instanceof Request ? input.clone() : input, init);
          return request.clone().arrayBuffer().then(body => {
            let replacement;
            try { replacement = new Request(addPot(request.url), {
              method: request.method, headers: request.headers,
              body: /^(GET|HEAD)$/i.test(request.method) ? undefined : patchSabr(body),
              credentials: request.credentials, mode: request.mode,
              redirect: request.redirect, referrer: request.referrer,
              referrerPolicy: request.referrerPolicy, cache: request.cache,
              integrity: request.integrity, keepalive: request.keepalive,
              signal: request.signal
            }); } catch (e) { return ofetch.call(this, input, init); }
            return ofetch.call(this, replacement);
          }, () => ofetch.call(this, input, init));
        } catch (e) { console.log(TAG, 'req-fail:', String(e)); }
      }
    } catch (e) { }
    return ofetch.call(this, input, init);
  };
  const oopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    try { u = addPot(u); } catch (e) { }
    return oopen.apply(this, [m, u].concat([].slice.call(arguments, 2)));
  };

  window.__tfPotRefresh = () => ensureToken(true);
  window.__tfPotStatus = () => ({version: '1.2.1', ready: !!state.token,
    mintedAt: state.mintedAt, patchedBodies: state.patchedBodies || 0});

  // kick off once ytcfg exists; retry on a timer until first mint succeeds
  const kick = () => {
    if (window.ytcfg && ytcfg.data_) { ensureToken(false); return true; }
    return false;
  };
  if (!kick()) {
    const t = setInterval(() => { if (kick()) clearInterval(t); }, 2000);
  }
  // periodic refresh
  setInterval(() => { if (window.ytcfg && ytcfg.data_) ensureToken(false); }, 3600 * 1000);
  console.log(TAG, 'hook active');
})();
