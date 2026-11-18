import fs from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import YAML from 'yaml';

export const PACKAGE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const VERSION=JSON.parse(fs.readFileSync(join(PACKAGE_ROOT,'package.json'),'utf8')).version;
const RESOURCE_ROOT=join(PACKAGE_ROOT,'resources');
const META='github-issue-delivery';
const THINKING=new Set(['off','minimal','low','medium','high','xhigh','max']);
const digest=data=>createHash('sha256').update(data).digest('hex');
const read=path=>fs.existsSync(path)?fs.readFileSync(path,'utf8'):null;
function expandHome(path){return path.replace(/^(?:~|\$HOME|\$\{HOME\})(?=\/|$)/,homedir());}
export function suiteDirectory(agentDir=process.env.PI_CODING_AGENT_DIR || join(homedir(),'.pi','agent')){
 return resolve(expandHome(process.env.PI_AGENT_SUITE_DIR || join(agentDir,'agent-suite')));
}
function filesIn(directory,prefix=''){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>{
  const path=join(prefix,e.name);
  if(e.isSymbolicLink())throw Error('Resource symlinks are not supported: '+path);
  return e.isDirectory()?filesIn(join(directory,e.name),path):[path];
 });
}
function destination(suite,path){
 const target=resolve(suite,path);
 if(relative(suite,target).startsWith('..'+sep)||target===suite||isAbsolute(relative(suite,target)))throw Error('Unsafe resource path: '+path);
 let current=target;
 while(current!==suite){
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Refusing to replace a symlink: '+current);
  current=dirname(current);
 }
 return target;
}
function atomic(path,contents){
 fs.mkdirSync(dirname(path),{recursive:true});
 const temp=path+'.'+randomUUID()+'.tmp';
 try{fs.writeFileSync(temp,contents,{mode:0o600,flag:'wx'});fs.renameSync(temp,path);}
 finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function model(value,label){
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['id','thinking'].includes(k))||
  typeof value.id!=='string'||!/^\S+\/\S+$/.test(value.id)||
  (value.thinking!==undefined&&!THINKING.has(value.thinking)))throw Error('Invalid model settings: '+label);
 return value;
}
export function validateProfile(profile,ids){
 if(!profile||profile.version!==1||Object.keys(profile).some(k=>!['version','coordinator','stages'].includes(k))||
  !profile.stages||typeof profile.stages!=='object'||Array.isArray(profile.stages))throw Error('Invalid model profile');
 model(profile.coordinator,'coordinator');
 for(const [id,value] of Object.entries(profile.stages)){
  if(!ids.includes(id))throw Error('Unknown stage in model profile: '+id);
  model(value,id);
 }
 return profile;
}
function frontmatter(source,settings){
 const match=source.match(/^---\n([\s\S]*?)\n---\n/);
 if(!match)throw Error('Invalid agent frontmatter');
 const fm=YAML.parse(match[1]);
 if(settings)fm.model=settings;else delete fm.model;
 return '---\n'+YAML.stringify(fm,{lineWidth:0})+'---\n'+source.slice(match[0].length);
}
export function renderResources(suite,profile){
 const result={};
 for(const path of filesIn(RESOURCE_ROOT)){
  result[path]=fs.readFileSync(join(RESOURCE_ROOT,path),'utf8').replaceAll('@@WORKFLOW_DIR@@',join(suite,'workflow','workflows'));
 }
 const path='workflow/workflows/GitHubIssueDelivery.yaml';
 const workflow=YAML.parse(result[path]);
 validateProfile(profile,workflow.stages.map(s=>s.id));
 for(const stage of workflow.stages){
  const settings=profile.stages[stage.id];
  if(settings)stage.model=settings;else delete stage.model;
 }
 result[path]=YAML.stringify(workflow,{lineWidth:0});
 const agentPath='agent-selection/agents/';
 result[agentPath+'GitHubDelivery.md']=frontmatter(result[agentPath+'GitHubDelivery.md'],profile.coordinator);
 result[agentPath+'GitHubDeliveryReviewer.md']=frontmatter(result[agentPath+'GitHubDeliveryReviewer.md'],profile.stages.review);
 return result;
}
export function loadProfile(suite,selection){
 const saved=join(suite,META,'models.json');
 const source=selection?(['current','omlx'].includes(selection)?join(PACKAGE_ROOT,'profiles',selection+'.json'):resolve(selection)):
  fs.existsSync(saved)?saved:join(PACKAGE_ROOT,'profiles','current.json');
 return JSON.parse(fs.readFileSync(source,'utf8'));
}
function manifestAt(suite){
 const contents=read(join(suite,META,'manifest.json'));
 if(!contents)return {files:{}};
 const manifest=JSON.parse(contents);
 if(manifest.format!==1||!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))throw Error('Invalid installation manifest');
 return manifest;
}
export function installationStatus(suite){
 const manifest=manifestAt(suite);
 if(!manifest.version)return {installed:false,version:null,changed:[]};
 const changed=Object.entries(manifest.files).filter(([path,entry])=>{
  const contents=read(destination(suite,path));
  return contents===null||digest(contents)!==entry.hash;
 }).map(([path])=>path);
 return {installed:true,version:manifest.version,changed};
}
function withLock(suite,action){
 const lock=join(suite,META,'setup.lock');
 fs.mkdirSync(dirname(lock),{recursive:true});
 let fd;
 try{fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));}
 catch(error){if(error.code==='EEXIST')throw Error('Another setup is running (or a stale lock exists): '+lock);throw error;}
 try{return action();}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
export function install({suite=suiteDirectory(),profile:selection,adopt=false,dryRun=false}={}){
 suite=resolve(suite);
 const apply=()=>{
  const profile=loadProfile(suite,selection);
  const desired=renderResources(suite,profile);
  const old=manifestAt(suite);
  const conflicts=[];
  for(const [path,data] of Object.entries(desired)){
   const existing=read(destination(suite,path));
   if(existing!==null&&existing!==data&&(!old.files[path]||digest(existing)!==old.files[path].hash))conflicts.push(path);
  }
  if(conflicts.length&&!adopt)throw Error('Existing or locally edited files; no resources changed. Use --adopt to back them up first:\n'+conflicts.join('\n'));
  if(dryRun)return {version:VERSION,files:Object.keys(desired),conflicts,dryRun:true};
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
  const manifest={format:1,version:VERSION,files:{...old.files}};
  const rollback=[];
  try{
   for(const [path,data] of Object.entries(desired)){
    const target=destination(suite,path);
    const before=read(target);
    let originalBackup=old.files[path]?.originalBackup;
    if(before!==null&&(!old.files[path]||before!==data)){
     const backup=join(META,'backups',stamp,path);
     atomic(destination(suite,backup),before);
     if(!old.files[path])originalBackup=backup;
    }
    if(before!==data){rollback.push([target,before]);atomic(target,data);}
    manifest.files[path]={hash:digest(data),...(originalBackup?{originalBackup}:{})};
   }
   for(const [path,data] of [[join(META,'models.json'),JSON.stringify(profile,null,2)+'\n'],[join(META,'manifest.json'),JSON.stringify(manifest,null,2)+'\n']]){
    const target=destination(suite,path);rollback.push([target,read(target)]);atomic(target,data);
   }
  }catch(error){
   for(const [path,before] of rollback.reverse()){
    if(before===null)fs.rmSync(path,{force:true});else atomic(path,before);
   }
   throw error;
  }
  return {version:VERSION,files:Object.keys(desired),conflicts,dryRun:false};
 };
 return dryRun?apply():withLock(suite,apply);
}
export function uninstall({suite=suiteDirectory()}={}){
 suite=resolve(suite);
 return withLock(suite,()=>{
  const manifest=manifestAt(suite);
  const status=installationStatus(suite);
  if(status.changed.length)throw Error('Refusing to remove modified or missing managed files:\n'+status.changed.join('\n'));
  const known=new Set(filesIn(RESOURCE_ROOT));
  const entries=Object.entries(manifest.files);
  for(const [path,entry] of entries){
   if(!known.has(path))throw Error('Unrecognized managed path: '+path);
   destination(suite,path);
   if(entry.originalBackup){
    if(!entry.originalBackup.startsWith(join(META,'backups')+sep))throw Error('Invalid backup path');
    fs.readFileSync(destination(suite,entry.originalBackup),'utf8');
   }
  }
  for(const [path,entry] of entries){
   if(entry.originalBackup)atomic(destination(suite,path),fs.readFileSync(destination(suite,entry.originalBackup),'utf8'));
   else fs.unlinkSync(destination(suite,path));
  }
  fs.rmSync(join(suite,META,'manifest.json'),{force:true});
  // Keep model preferences, backups and issue-delivery artifacts for possible reuse.
  return {removed:entries.length};
 });
}
