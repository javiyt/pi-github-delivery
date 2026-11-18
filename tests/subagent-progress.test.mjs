import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

// Transpile with jiti and isolate the UI API; no model or host installation required.
const require=createRequire(import.meta.url);
const {createJiti}=require('jiti');
const jiti=createJiti(import.meta.url,{alias:{'@earendil-works/pi-tui':new URL('./fixtures/tui.mjs',import.meta.url).pathname}});
const {default:extension,visibleText,clean,channelDirectory}=await jiti.import(new URL('../extensions/subagent-progress.ts',import.meta.url).pathname);
const pause=()=>new Promise(r=>setTimeout(r,720));

function harness(session,childRoot,hasUI=true){
 const saved={...process.env};
 if(childRoot){
  process.env.PI_SUBAGENT_DEPTH='1';
  process.env.PI_SUBAGENT_ROOT_SESSION_ID=childRoot;
  process.env.PI_SUBAGENT_AGENT_ID='GitHubDeliveryWorker';
 } else {
  delete process.env.PI_SUBAGENT_DEPTH;
  delete process.env.PI_SUBAGENT_ROOT_SESSION_ID;
 }
 const handlers=new Map(),commands=new Map();
 let lines=[];
 const ctx={hasUI,model:{provider:'omlx',id:'test-model'},
  sessionManager:{getSessionId:()=>session},
  ui:{setWidget(_key,widget){lines=widget?widget({}, {fg:(_color,s)=>s}).render(90):[];},notify(){}}};
 // Deliberately expose no sendMessage/sendUserMessage/appendEntry/context mutation APIs.
 const pi={on(name,handler){handlers.set(name,handler);},registerCommand(name,command){commands.set(name,command);}};
 extension(pi);
 const emit=(name,event={})=>handlers.get(name)?.(event,ctx);
 emit('session_start');
 process.env=saved;
 return {emit,commands,ctx,handlers,get lines(){return lines;}};
}

test('text extraction excludes thinking, tool arguments and terminal controls',()=>{
 assert.equal(visibleText({content:[{type:'thinking',thinking:'private'},{type:'toolCall',arguments:{secret:'x'}},{type:'text',text:'visible'}]}),'visible');
 assert.equal(clean('\x1b[31mhello\x1b[0m\x07'),'hello');
 assert.equal(clean('Bearer abc123 ghp_abc123'),'Bearer [redacted] [redacted]');
 assert.equal(visibleText({content:[{type:'text',text:'a'.repeat(8000)}]}).length,6000);
});

test('live tool output reaches only its root widget, without conversation APIs',async()=>{
 const root=randomUUID(),otherRoot=randomUUID();
 const main=harness(root),other=harness(otherRoot),worker=harness(randomUUID(),root);
 try{
  worker.emit('message_update',{message:{role:'assistant',content:[{type:'thinking',thinking:'never display'},{type:'text',text:'Examining implementation'}]}});
  await pause();
  assert(main.lines.join('\n').includes('Examining implementation'));
  assert(!main.lines.join('\n').includes('never display'));
  assert.deepEqual(other.lines,[]);
  worker.emit('tool_execution_start',{toolName:'bash',args:{command:'echo secret-token'}});
  worker.emit('tool_execution_update',{toolName:'bash',partialResult:{content:[{type:'text',text:'tests 4/10'}]}});
  await pause();
  assert(main.lines.join('\n').includes('tests 4/10'));
  assert(!main.lines.join('\n').includes('secret-token'));
  worker.emit('tool_execution_end',{toolName:'bash',isError:true,result:{content:[{type:'text',text:'test failure evidence'}]}});
  await pause();
  assert(main.lines.join('\n').includes('Error · bash'));
  await main.commands.get('subagent-progress').handler('off',main.ctx);
  assert.deepEqual(main.lines,[]);
  await main.commands.get('subagent-progress').handler('on',main.ctx);
  assert(main.lines.join('\n').includes('test failure evidence'));
  worker.emit('message_end',{message:{role:'assistant',stopReason:'aborted',content:[]}});
  worker.emit('agent_end');
  await pause();
  assert(main.lines[0].includes('✗'));
  assert(main.lines[0].includes('Interrumpido'));
  const dir=channelDirectory(root);
  for(const name of fs.readdirSync(dir)) assert.equal(fs.statSync(dir+'/'+name).mode & 0o777,0o600);
  assert.equal(fs.statSync(dir).mode & 0o777,0o700);
  assert(!main.handlers.has('context'));
  assert(!worker.handlers.has('context'));
 } finally{
  worker.emit('session_shutdown');
  main.emit('session_shutdown');
  other.emit('session_shutdown');
 }
 assert(!fs.existsSync(channelDirectory(root)));
});

test('corrupt and oversized sidecars do not interrupt the UI',async()=>{
 const root=randomUUID(),main=harness(root);
 try{
  const directory=channelDirectory(root);
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  fs.writeFileSync(directory+'/'+'a'.repeat(32)+'.json','not-json');
  fs.writeFileSync(directory+'/'+'b'.repeat(32)+'.json','x'.repeat(25000));
  await pause();
  assert.deepEqual(main.lines,[]);
 } finally {main.emit('session_shutdown');}
});


test('print-mode roots start no widget, command toggles do not create model activity',async()=>{
 const main=harness(randomUUID(),undefined,false);
 try {
  await main.commands.get('subagent-progress').handler('on',main.ctx);
  assert.deepEqual(main.lines,[]);
 } finally {main.emit('session_shutdown');}
});
