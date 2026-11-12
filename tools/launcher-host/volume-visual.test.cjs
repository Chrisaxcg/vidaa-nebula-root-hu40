'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const state={arc:false,connected:true,supported:true,cec:38};
  const root={innerWidth:1280,modeljs:{isBizSupported:()=>state.supported},_V_SDK_:{biz:{
    volume:{MODELJS_DEFINE:{ARC_DEV:2},getMainVolumeDev:()=>({value:state.arc?2:0}),getMainVolumeState:()=>({value:15})},
    sound:{MODEJS_DEFINE:{AUDIO_SPEAKER_ARC:2},getAudioSpeaker:()=>({value:state.arc?2:0}),getArcDevExist:()=>({value:state.connected?1:0}),getEZPlayCECVolumeState:()=>({value:state.cec})}
  }}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/volume-visual.js','utf8'),{self:root});
  function draw(props={},directional=false,muted=false){
    const tree=root.AlvidaaVolumeVisual.render.call(props,(tag,data,children)=>({tag,data,children}),directional,muted);
    return JSON.stringify(tree);
  }
  return {root,state,draw};
}
test('ARC never presents the TV volume as a soundbar percentage',()=>{
  const f=fixture();f.state.arc=true;
  for(const currVolume of [0,15,38,100,127,NaN]){const view=f.draw({kind:'ARC',currVolume,isPlus:true},true);assert.ok(view.includes('Barra HDMI'));assert.ok(!view.includes(' %'));}
  f.root.AlvidaaCecPercentEnabled=true;
  assert.ok(f.draw({kind:'ARC',currVolume:15},true).includes('38 %'));
  for(const cec of [-1,127,255,NaN,Infinity,'38',null]){f.state.cec=cec;assert.ok(!f.draw({kind:'ARC'},true).includes(' %'));}
  f.state.cec=38;f.state.connected=false;assert.ok(!f.draw({kind:'ARC'},true).includes(' %'));
  f.state.connected=true;f.state.supported=false;assert.ok(!f.draw({kind:'ARC'},true).includes(' %'));
});
test('numeric output accepts zero, mute hides levels and unavailable services degrade safely',()=>{
  const f=fixture();assert.ok(f.draw({currVolume:0}).includes('0 %'));
  assert.ok(f.draw({currVolume:100}).includes('100 %'));
  const mute=f.draw({currVolume:38},false,true);assert.ok(mute.includes('Silencio'));assert.ok(!mute.includes('38 %'));
  assert.ok(!f.draw({currVolume:38,icon:'v-ic-bluetooth'},true).includes(' %'));
  delete f.root._V_SDK_;assert.doesNotThrow(()=>f.draw({currVolume:15}));
});
