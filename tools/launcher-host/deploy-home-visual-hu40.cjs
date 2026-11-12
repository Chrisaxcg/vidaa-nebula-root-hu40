'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert'),path=require('path');
const stage=__dirname, action=process.argv[2]||'install';
const base='/var/local/alvidaa',lock=base+'/home-visual.lock',cache='/var/local/hisenseUI/cobalt_home/.cache/cobalt';
const engine='/opt/hisenseUI/bin/hisenseUI',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const allowed=['/APPS/channelA/operation-ui/apps/launcher/js/app.js','/APPS/channelA/system-ui/apps/volume-bar/js/app.js','/APPS/channelA/system-ui/apps/volume-bar/js/367.js','/APPS/channelA/system-ui/apps/volume-bar/js/762.js','/APPS/channelA/hisenseUI/var/local/alvidaa-galaxy-v1.jpg','/APPS/channelA/hisenseUI/var/local/alvidaa-home-visual-v1.css'];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function engines(){return fs.readdirSync('/proc').filter(s=>/^\d+$/.test(s)).flatMap(s=>{try{if(fs.readlinkSync('/proc/'+s+'/exe')!==engine)return [];const status=fs.readFileSync('/proc/'+s+'/status','utf8');return [{pid:Number(s),born:fs.readFileSync('/proc/'+s+'/stat','utf8').split(') ')[1].split(' ')[19],credentials:status.split('\n').filter(x=>/^(Uid|Gid|Groups|CapEff):/.test(x)).join('\n')}];}catch(e){return [];}});}
function atomic(target,bytes,meta){const tmp=target+'.alvidaa-visual-new';assert(!fs.existsSync(tmp),'stale temporary target');fs.writeFileSync(tmp,bytes,{flag:'wx',mode:meta.mode&4095});fs.chownSync(tmp,meta.uid,meta.gid);fs.chmodSync(tmp,meta.mode&4095);const fd=fs.openSync(tmp,'r');fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(tmp,target);}
let state,dir,guardAdded=false,locked=false;
const rule=['OUTPUT','-m','owner','--uid-owner','304','-j','REJECT'];
function record(){fs.writeFileSync(dir+'/state.json',JSON.stringify(state,null,2),{mode:0o600});}
function guard(){try{cp.execFileSync('/usr/local/bin/iptables',['-C',...rule],{stdio:'ignore'});}catch(e){cp.execFileSync('/usr/local/bin/iptables',['-I','OUTPUT','1',...rule.slice(1)],{stdio:'pipe'});guardAdded=true;}}
async function stop(){const list=engines();assert(list.length<=1,'multiple UI processes');if(!list.length)return;const current=list[0];assert(current.credentials===state.context.original.credentials,'changed UI credentials');process.kill(current.pid,'SIGTERM');for(let i=0;i<40;i++){await wait(200);if(!engines().some(p=>p.pid===current.pid&&p.born===current.born))break;}await wait(1000);assert(engines().length===0,'UI did not stop cleanly');}
async function launch(){assert(engines().length===0,'UI already exists');const ctx=state.context;const child=cp.spawn(engine,ctx.args.slice(1),{cwd:ctx.cwd,env:ctx.env,detached:true,stdio:'ignore'});await new Promise((res,rej)=>{child.once('spawn',res);child.once('error',rej)});child.unref();await wait(4000);let list=engines();assert(list.length===1,'UI did not start');assert(list[0].credentials===ctx.original.credentials,'different UI identity');const current=list[0];await wait(3000);list=engines();assert(list.length===1&&list[0].pid===current.pid&&list[0].born===current.born,'UI failed stability check');state.pid=current.pid;}
function backupCaches(){state.caches=[];for(const name of ['compiled_js','uncompiled_js','css']){const p=cache+'/'+name;if(!fs.existsSync(p))continue;const meta=fs.statSync(p);const backup=dir+'/cache-'+name;fs.renameSync(p,backup);fs.mkdirSync(p,{mode:meta.mode&4095});fs.chownSync(p,meta.uid,meta.gid);state.caches.push({path:p,backup});record();}}
function restoreFiles(){for(const e of state.files){if(e.before===null){if(fs.existsSync(e.target)){assert(hash(fs.readFileSync(e.target))===e.after,'changed new asset');fs.unlinkSync(e.target);}}else{const current=hash(fs.readFileSync(e.target));assert(current===e.after||current===e.before,'concurrent target edit');atomic(e.target,fs.readFileSync(e.backup),e.meta);}}for(const c of state.caches||[]){if(fs.existsSync(c.backup)){if(fs.existsSync(c.path))fs.renameSync(c.path,dir+'/discard-'+path.basename(c.path)+'-'+Date.now());fs.renameSync(c.backup,c.path);}}}
async function main(){
 assert(process.getuid()===0);assert(['install','restore'].includes(action));
 if(action==='restore'){dir=process.argv[3];assert(dir&&dir.startsWith(base+'/home-visual-'));state=JSON.parse(fs.readFileSync(dir+'/state.json'));}
 else{
  const release=JSON.parse(fs.readFileSync(stage+'/release.json'));assert(release.length===6);
  const list=engines();assert(list.length===1);const current=list[0],proc='/proc/'+current.pid;
  const env={};for(const s of fs.readFileSync(proc+'/environ','utf8').split('\0')){const i=s.indexOf('=');if(i>0)env[s.slice(0,i)]=s.slice(i+1);}
  state={phase:'prepared',context:{original:current,env,cwd:fs.readlinkSync(proc+'/cwd'),args:fs.readFileSync(proc+'/cmdline','utf8').split('\0').filter(Boolean)},files:[]};
  assert(state.context.cwd==='/opt/hisenseUI');
  dir=base+'/home-visual-'+Date.now();fs.mkdirSync(dir,{mode:0o700});
  for(let i=0;i<release.length;i++){const e=release[i];assert(e.target===allowed[i]);assert(/^[a-z0-9.-]+$/.test(e.source));assert(hash(fs.readFileSync(stage+'/'+e.source))===e.after,'staged hash mismatch');
   if(e.before===null)assert(!fs.existsSync(e.target),'new asset already exists');else assert(hash(fs.readFileSync(e.target))===e.before,'live hash changed');
   const meta=fs.statSync(e.before===null?'/APPS/channelA/hisenseUI/var/local/alvidaa-bg.jpg':e.target);const entry={...e,meta:{uid:meta.uid,gid:meta.gid,mode:meta.mode},backup:dir+'/before-'+i};
   if(e.before!==null){fs.copyFileSync(e.target,entry.backup);fs.chmodSync(entry.backup,0o600);}state.files.push(entry);
  }record();fs.copyFileSync(__filename,dir+"/deploy.cjs");
 }
 fs.writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});locked=true;
 try{
  guard();
  await stop();state.phase='stopped';record();
  if(action==='restore')restoreFiles();else{backupCaches();for(const e of state.files)atomic(e.target,fs.readFileSync(stage+'/'+e.source),e.meta);}
  state.phase=action==='restore'?'restoring':'applied';record();await launch();state.phase=action==='restore'?'restored':'installed';record();
  console.log(JSON.stringify({phase:state.phase,pid:state.pid,backup:dir}));
 }catch(error){state.error=error.message;record();if(action==='install'&&state.phase!=='prepared'){try{await stop();restoreFiles();await launch();state.phase='rolled-back';record();}catch(recovery){state.recoveryError=recovery.message;record();}}throw error;}
 finally{if(guardAdded)cp.execFileSync('/usr/local/bin/iptables',['-D',...rule],{stdio:'ignore'});if(locked)fs.unlinkSync(lock);}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
