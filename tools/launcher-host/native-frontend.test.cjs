'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(prefs) {
  const calls = [], timers = new Map(); let next = 0;
  const bodyListeners = new Set();
  const root = { innerWidth: 1280, addEventListener() {}, removeEventListener() {},
    document: { body: { addEventListener(_name,fn){bodyListeners.add(fn);}, removeEventListener(_name,fn){bodyListeners.delete(fn);} } }, bodyListeners };
  const sdk = { key: { KEYMAP: { HOME:36, LAUNCHER:547, SOURCE:515, KEYPAD_INPUT:516, UP:38, DOWN:40, LEFT:37, RIGHT:39, ENTER:13, BACK:8 } },
    storage: { get:()=>prefs, set:(_key,value)=>calls.push(['save',value]) },
    apc: { CMDMETHOD: { KEY_INPUT_START:'input' } }, router: { isCurrentPathEqualTo:()=>true } };
  root._V_SDK_ = { vre: { SDK: function () { return sdk; } } };
  let notify;
  root.AlvidaaNativePlatform = () => ({ start(){calls.push(['start']);notify({apps:[
    {appId:'1',appName:'Netflix',img:'https://must-not-fetch/icon.png'},
    {appId:'2',appName:'Plex',img:'file:///local/icon.png'},
    {appId:'vidaa-home',appName:'Old browser home'}],sources:[{sourceId:0,name:'TV'},{sourceId:'HDMI1',name:'HDMI1'}],errors:[],waiting:false});},
    stop(){calls.push(['stop']);},refresh(){calls.push(['refresh']);},
    launchApp(id){calls.push(['launch',id]);}, changeSource(id){calls.push(['source',id]);},openSettings(){calls.push(['settings']);} });
  const create = root.AlvidaaNativePlatform;
  root.AlvidaaNativePlatform = (_sdk, callback) => { notify=callback; return create(); };
  const context = {self:root, setInterval(fn){let id=++next;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);},
    setTimeout(fn){let id=++next;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);} };
  vm.runInNewContext(fs.readFileSync(__dirname+'/free-my-tv-native.js','utf8'),context);
  const component = root.AlvidaaFreeMyTV(sdk), instance = component.data();
  instance.$route={query:{}};
  for(const [key,fn] of Object.entries(component.methods)) instance[key]=fn.bind(instance);
  return {root,sdk,context,component,instance,calls,timers};
}
test('offline frontend starts once, excludes browser Home and cleans up',()=>{
  const f=setup(); f.component.mounted.call(f.instance); f.component.activated.call(f.instance);
  assert.equal(f.calls.filter(c=>c[0]==='start').length,1);
  assert.equal(f.instance.apps.length,2); assert.equal(f.root.AlvidaaNativeActive,f.instance);
  f.component.deactivated.call(f.instance); assert.equal(f.timers.size,0); assert.equal(f.root.AlvidaaNativeActive,null);
  f.component.activated.call(f.instance); assert.equal(f.calls.filter(c=>c[0]==='start').length,2);
});
test('remote navigates apps, native settings and inputs; Back remains vendor-owned at Home',()=>{
  const f=setup(),v=f.instance,k=f.sdk.key.KEYMAP; v.start();
  assert.equal(v.handleKey(k.BACK),false); assert.equal(v.handleKey(999),false);
  v.handleKey(k.ENTER); assert.deepEqual(f.calls.at(-1),['launch','1']);
  v.handleKey(k.DOWN); assert.equal(v.view,'inputs'); v.handleKey(k.ENTER);
  assert.deepEqual(f.calls.at(-1),['source',0]);
  v.handleKey(k.BACK); v.handleKey(k.UP);
  v.index=3; v.handleKey(k.ENTER); assert.deepEqual(f.calls.at(-1),['settings']);
  v.$route.query={value:k.SOURCE}; v.routeFocus(); assert.equal(v.view,'inputs');
});
test('preferences persist theme, empty favorites and shelf reordering',()=>{
  const f=setup(),v=f.instance; v.start(); v.show('edit'); v.select();
  assert.equal(v.shelf()[0].appId,'2'); v.index=1; v.select(); assert.equal(v.shelf().length,0);
  v.index=0; v.select(); v.index=1; v.select();
  v.show('reorder'); v.select(); v.handleKey(f.sdk.key.KEYMAP.RIGHT);
  assert.equal(v.shelf()[0].appId,'2'); assert.equal(v.index,1);
  v.show('prefs'); v.index=1; v.select(); assert.equal(v.theme,'light');
  assert.ok(f.calls.some(c=>c[0]==='save'));
  const empty=setup({favorites:[],theme:'light'}); empty.instance.start();
  assert.equal(empty.instance.shelf().length,0); assert.equal(empty.instance.theme,'light');
});
test('renderer scales design and never loads remote icons/canvas/iframe',()=>{
  const f=setup(); f.instance.start();
  const tree=f.component.render.call(f.instance,(tag,data,children)=>({tag,data,children}));
  const flat=[]; function walk(n){if(!n||typeof n!=='object')return;flat.push(n);for(const c of n.children||[])walk(c);} walk(tree);
  assert.ok(flat.some(n=>n.data?.attrs?.['aria-label']==='Plex'));
  assert.equal(flat.filter(n=>n.tag==='img').length,0);
  assert.ok(flat.some(n=>n.data?.style?.backgroundImage==='url("file:///local/icon.png")'));
  assert.ok(!flat.some(n=>JSON.stringify(n.data?.style?.backgroundImage||'').includes('must-not-fetch')));
  assert.ok(!flat.some(n=>['canvas','iframe','script'].includes(n.tag)));
  assert.equal(f.instance.localIcon({img:'var/local/storeAppIcon/logo.png'}),'file:///hisenseUI/var/local/storeAppIcon/logo.png');
  assert.equal(f.instance.localIcon({img:'https://cdn.example/logo',presetImg:'file:///builtin.png'}),'file:///builtin.png');
  assert.equal(f.instance.localIcon({img:'http://127.0.0.1:8770/api/icon/1'}),'');
  f.sdk.i18n={t:key=>key==='LA0159'?'Media':key};
  assert.equal(f.instance.sourceName({rename:'LA0159',name:'Media'}),'Media');
  assert.equal(f.instance.sourceName({rename:'PlayStation',name:'HDMI3'}),'PlayStation');
});
test('entry replaces only main component, retains guards/pages/init/key groups and is idempotent',()=>{
  const f=setup();
  const guard=()=>{},init=()=>{},kids=()=>{},game=()=>{},originalKey=()=>{};
  const stock={route:[{path:'/Launcher',component:{old:true},beforeEnter:guard},{path:'/KidsLauncher',component:kids},{path:'/GameLauncher',component:game}],
    page:{kidsLauncherHome:kids,gameLauncherHome:game},init,key:{keydown:{groups:[{keys:[36,515],handler:originalKey}]}}};
  f.root._V_M_={launcher:()=>stock};
  vm.runInNewContext(fs.readFileSync(__dirname+'/native-entry.js','utf8'),f.context);
  const result=f.root._V_M_.launcher();
  assert.equal(result.route[0].component.name,'Launcher'); assert.equal(result.route[0].beforeEnter,guard);
  assert.equal(result.route[1].component,kids); assert.equal(result.page.gameLauncherHome,game); assert.equal(result.init,init);
  assert.equal(result.key.keydown.groups[0].handler,originalKey);
  assert.equal(f.root._V_M_.launcher(),result); assert.equal(result.key.keydown.groups.length,1);
});
test('long-press OK in All apps opens the context menu; hide and move persist',()=>{
  const f=setup(),v=f.instance,k=f.sdk.key.KEYMAP; v.start();
  const keyup=[...f.root.bodyListeners][1];
  v.show('apps');
  // Short press: key-down arms the timer, key-up resolves as a normal select.
  v.handleKey(k.ENTER);
  assert.ok(v._lp);
  keyup({keyCode:k.ENTER,stopPropagation(){}});
  assert.deepEqual(f.calls.at(-1),['launch','1']);
  assert.equal(v._lp,null);
  // Long press: the armed timer fires and opens the menu instead of launching.
  v.handleKey(k.ENTER);
  [...f.timers.values()].at(-1)();
  assert.ok(v.menu); assert.equal(v.menu.opts.length,3);
  v.menu.t=0; // skip the real-time anti-repeat debounce
  // Move: enters moving mode, arrows reorder the custom order and persist it.
  v.menu.sel=0; v.handleKey(k.ENTER);
  assert.equal(v.moving,true);
  v.handleKey(k.RIGHT);
  assert.deepEqual(v.appOrder,['2','1']); assert.equal(v.index,1);
  assert.deepEqual(v.visibleApps().map(a=>a.appId),['2','1']);
  v.handleKey(k.BACK); assert.equal(v.moving,false);
  // Hide: the focused app (now Netflix at index 1) leaves the grid, persisted.
  v.handleKey(k.ENTER); [...f.timers.values()].at(-1)();
  v.menu.t=0; v.menu.sel=2; v.handleKey(k.ENTER);
  assert.equal(v.menu,null);
  assert.equal(v.visibleApps().length,1);
  assert.ok(f.calls.some(c=>c[0]==='save'&&c[1].hidden&&c[1].hidden.includes('1')));
  // The menu swallows Back; hidden prefs survive a fresh load.
  v.handleKey(k.ENTER); [...f.timers.values()].at(-1)();
  v.handleKey(k.BACK); assert.equal(v.menu,null);
  const again=setup({hidden:['1'],appOrder:['1','2'],favorites:[],theme:'dark'});
  again.instance.start();
  assert.equal(again.instance.visibleApps().length,1);
  assert.deepEqual(again.instance.visibleApps().map(a=>a.appId),['2']);
});
test('bubbling Home keys precede defaults, pass unrelated keys and detach cleanly',()=>{
  const f=setup();f.instance.start();f.instance.start();assert.equal(f.root.bodyListeners.size,2);
  const handler=[...f.root.bodyListeners][0];let stopped=0;
  const send=keyCode=>handler({keyCode,stopPropagation(){stopped++;}});
  send(999);send(f.sdk.key.KEYMAP.SOURCE);send(f.sdk.key.KEYMAP.BACK);assert.equal(stopped,0);
  f.instance.show('prefs');send(f.sdk.key.KEYMAP.BACK);assert.equal(stopped,1);assert.equal(f.instance.view,'home');
  f.sdk.router.isCurrentPathEqualTo=()=>false;send(f.sdk.key.KEYMAP.DOWN);assert.equal(stopped,1);
  f.instance.stop();assert.equal(f.root.bodyListeners.size,0);
});
test('native focus announcements respect the vendor screen-reader setting and route',()=>{
  const f=setup(),spoken=[]; let enabled=false;
  f.sdk.tts={isEnable:()=>enabled,speak:text=>spoken.push(text)};f.instance.start();
  f.instance.announce();assert.equal(spoken.length,0);
  enabled=true;f.instance.announce();assert.equal(spoken.at(-1),'Netflix');
  f.instance.show('inputs');f.instance.announce();assert.equal(spoken.at(-1),'TV');
  f.sdk.router.isCurrentPathEqualTo=()=>false;f.instance.announce();assert.equal(spoken.length,2);
});

function renderNodes(f) {
  const all=[];
  const tree=f.component.render.call(f.instance,(tag,data,children)=>({tag,data,children}));
  function visit(n){if(!n||typeof n!=='object')return;all.push(n);for(const c of n.children||[])visit(c);}
  visit(tree);return all;
}
test('visual grid keeps layout slots stable while focus moves neighbors, within the 720p safe area',()=>{
  const f=setup(),v=f.instance;v.start();v.show('apps');
  for(const count of [0,1,24,25,37]){
    v.apps=Array.from({length:count},(_,i)=>({appId:String(i),appName:i<2?'Same name':'Application '+i}));
    for(let index=0;index<Math.max(count,1);index++){
      v.index=index;
      const cards=renderNodes(f).filter(n=>n.data?.attrs?.['data-app-id']!==undefined);
      assert.equal(new Set(cards.map(n=>n.data.key)).size,cards.length,'app IDs must disambiguate duplicate names');
      for(const n of cards){const s=n.data.style;
        assert.ok(parseFloat(s.left)>=48);assert.ok(parseFloat(s.left)+parseFloat(s.width)<=1232);
        assert.ok(parseFloat(s.top)+parseFloat(s.height)<=650);
        const motion=s.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\) scale\(([-.\d]+)\)/);
        assert.ok(motion);
        const dx=Number(motion[1]),dy=Number(motion[2]),grow=Number(motion[3]);
        const x=parseFloat(s.left)+dx-parseFloat(s.width)*(grow-1)/2;
        const y=parseFloat(s.top)+dy-parseFloat(s.height)*(grow-1)/2;
        assert.ok(x>=48&&x+parseFloat(s.width)*grow<=1232,'animated card must fit horizontally');
        assert.ok(y>=170&&y+parseFloat(s.height)*grow<=650,'animated card must fit vertically');
        assert.ok(n.children.some(c=>c.children?.includes(n.data.attrs['aria-label'])),'icon cards also have visible names');
      }
    }
  }
  v.index=0;const before=renderNodes(f).filter(n=>n.data?.attrs?.['data-app-id']!==undefined);
  v.index=9;const after=renderNodes(f).filter(n=>n.data?.attrs?.['data-app-id']!==undefined);
  assert.deepEqual(after.map(n=>[n.data.key,n.data.style.left,n.data.style.top,n.data.style.width,n.data.style.height]),before.map(n=>[n.data.key,n.data.style.left,n.data.style.top,n.data.style.width,n.data.style.height]));
  assert.notDeepEqual(after.map(n=>n.data.style.transform),before.map(n=>n.data.style.transform),'focus must visibly move the surrounding cards');
  assert.equal(f.calls.filter(c=>c[0]==='save').length,0,'rendering must not mutate preferences');
});
test('galaxy pauses on a covered route, visibility loss and component deactivation',()=>{
  const f=setup(),v=f.instance,listeners=new Set();
  f.root.document.addEventListener=(_name,fn)=>listeners.add(fn);
  f.root.document.removeEventListener=(_name,fn)=>listeners.delete(fn);
  f.component.mounted.call(v);f.component.activated.call(v);assert.equal(listeners.size,1);
  const state=()=>renderNodes(f).find(n=>n.data?.class==='fmtv-galaxy').data.style.animationPlayState;
  assert.equal(state(),'running');
  f.root.document.hidden=true;[...listeners][0]();assert.equal(state(),'paused');
  f.root.document.hidden=false;[...listeners][0]();f.sdk.router.isCurrentPathEqualTo=()=>false;assert.equal(state(),'paused');
  f.sdk.router.isCurrentPathEqualTo=()=>true;v.menu={sel:0,opts:[{label:'Mover',act:'move'}]};assert.equal(state(),'paused');v.menu=null;
  f.component.deactivated.call(v);assert.equal(state(),'paused');assert.equal(listeners.size,0);assert.equal(f.timers.size,0);
  f.component.activated.call(v);assert.equal(state(),'running');assert.equal(listeners.size,1);
  f.component.beforeDestroy.call(v);assert.equal(listeners.size,0);
});
test('native stylesheet loads once, is released and ignores ambiguous motion preferences',()=>{
  const f=setup(),v=f.instance,nodes=[];
  const head={appendChild(el){el.parentNode=head;nodes.push(el);},removeChild(el){nodes.splice(nodes.indexOf(el),1);el.parentNode=null;}};
  f.root.document.head=head;f.root.document.createElement=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
  f.component.mounted.call(v);f.component.activated.call(v);assert.equal(nodes.length,1);
  assert.equal(nodes[0].attrs.href,'file:///hisenseUI/var/local/alvidaa-home-visual-v1.css');
  f.root.matchMedia=()=>({matches:true});assert.equal(v.reducedMotion(),false);
  f.root.matchMedia=q=>({matches:q==='(prefers-reduced-motion: reduce)'});assert.equal(v.reducedMotion(),true);
  const galaxy=renderNodes(f).find(n=>n.data?.class==='fmtv-galaxy');assert.equal(galaxy.data.style.animation,'none');
  f.component.deactivated.call(v);assert.equal(nodes.length,0);
  f.component.activated.call(v);assert.equal(nodes.length,1);
  f.component.beforeDestroy.call(v);assert.equal(nodes.length,0);
});
