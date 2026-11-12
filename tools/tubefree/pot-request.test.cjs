const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname+'/zz_pot.user.js','utf8');
const hook = source.slice(source.indexOf('  function pbFields'),source.indexOf('  window.__tfPotRefresh'));
function setup() {
  const calls=[];
  function XHR() {}
  XHR.prototype.open=function(){};
  const window={fetch:async (input,init)=>{calls.push({input,init});return 'ok';}};
  vm.runInNewContext(hook,{window,XMLHttpRequest:XHR,Request,console,
    b64ToU8:s=>new Uint8Array(Buffer.from(s,'base64url')),
    state:{token:'dGVzdA'},TAG:'test'});
  return {window,calls};
}
test('SABR binary POST remains intact and original Request remains reusable',async()=>{
  const {window,calls}=setup();
  const bytes=Uint8Array.from([0,255,128,1,10]);
  const original=new Request('https://media.googlevideo.com/videoplayback?a=1',{
    method:'POST',body:bytes,headers:{'content-type':'application/octet-stream'},
    credentials:'include',cache:'no-store',referrerPolicy:'origin'
  });
  assert.equal(await window.fetch(original),'ok');
  assert.equal(original.bodyUsed,false);
  const req=calls[0].input;
  assert.equal(new URL(req.url).searchParams.get('pot'),'dGVzdA');
  assert.equal(new URL(req.url).searchParams.get('a'),'1');
  assert.deepEqual(new Uint8Array(await req.arrayBuffer()),bytes);
  assert.equal(req.credentials,'include');
  assert.equal(req.cache,'no-store');
  assert.equal(req.referrerPolicy,'origin');
});
test('SABR token is replaced inside field 19/2 while other fields stay intact',async()=>{
  const {window,calls}=setup();
  // Outer field 1 scalar; field 19 contains field 1, old token 2, cookie 3.
  const bytes=Uint8Array.from([8,7,154,1,8,8,9,18,1,99,26,1,42,176,1,12]);
  await window.fetch(new Request('https://media.googlevideo.com/videoplayback',{
    method:'POST',body:bytes
  }));
  assert.deepEqual(new Uint8Array(await calls[0].input.arrayBuffer()),
    Uint8Array.from([8,7,154,1,11,8,9,26,1,42,18,4,116,101,115,116,176,1,12]));
});
test('unrelated requests and existing PO tokens pass unchanged',async()=>{
  const {window,calls}=setup();
  const unrelated=new Request('https://www.youtube.com/youtubei/v1/player');
  await window.fetch(unrelated);
  assert.equal(calls[0].input,unrelated);
  const existing='https://media.googlevideo.com/videoplayback?pot=existing';
  await window.fetch(existing);
  assert.equal(calls[1].input,existing);
});
test('string URL plus binary init receives the same SABR repair',async()=>{
  const {window,calls}=setup();
  await window.fetch('https://media.googlevideo.com/videoplayback',{
    method:'POST',body:Uint8Array.from([154,1,2,8,9])
  });
  assert.deepEqual(new Uint8Array(await calls[0].input.arrayBuffer()),
    Uint8Array.from([154,1,8,8,9,18,4,116,101,115,116]));
});
