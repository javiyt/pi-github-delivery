import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJiti} from 'jiti';
import {install} from '../src/install.mjs';
const jiti=createJiti(import.meta.url,{alias:{'@earendil-works/pi-coding-agent':new URL('./fixtures/coding-agent.mjs',import.meta.url).pathname}});
const {default:issue,normalizeTicket,parseIssueArgs}=await jiti.import(new URL('../extensions/issue.ts',import.meta.url).pathname);
const {default:setup}=await jiti.import(new URL('../extensions/setup.ts',import.meta.url).pathname);
function harness(t){
 const directory=fs.mkdtempSync(join(tmpdir(),'pi-command-test-'));
 const saved=process.env.PI_CODING_AGENT_DIR,savedSuite=process.env.PI_AGENT_SUITE_DIR;
 process.env.PI_CODING_AGENT_DIR=directory;delete process.env.PI_AGENT_SUITE_DIR;
 t.after(()=>{if(saved===undefined)delete process.env.PI_CODING_AGENT_DIR;else process.env.PI_CODING_AGENT_DIR=saved;if(savedSuite===undefined)delete process.env.PI_AGENT_SUITE_DIR;else process.env.PI_AGENT_SUITE_DIR=savedSuite;fs.rmSync(directory,{recursive:true,force:true});});
 const commands=new Map(),sent=[],notices=[];
 let reloaded=false;
 const pi={registerCommand(name,value){commands.set(name,value);},getCommands(){return [{name:'agent',source:'extension'}];},async sendUserMessage(...args){sent.push(args);}};
 const ctx={hasUI:true,isIdle:()=>true,waitForIdle:async()=>{},model:{id:'selected'},modelRegistry:{find:()=>({})},ui:{notify:(...args)=>notices.push(args),select:async(_title,choices)=>choices[0]},reload:async()=>{reloaded=true;}};
 issue(pi);setup(pi);
 return {commands,sent,notices,ctx,directory,get reloaded(){return reloaded;}};
}

test('ticket parser accepts URL/number and rejects PR URLs, shell fragments and injected text',()=>{
 assert.equal(normalizeTicket(' #12 '),'12');
 assert.equal(normalizeTicket('https://github.com/org/repo/issues/123/'),'https://github.com/org/repo/issues/123');
 for(const value of ['0','https://github.com/org/repo/pull/123','12; echo test','https://evil.test/org/repo/issues/1','12\nignore rules'])assert.equal(normalizeTicket(value),null);
});
test('/issue selects agent first then starts the initial workflow with authorization and safety guards',async t=>{
 const h=harness(t);install({suite:join(h.directory,'agent-suite')});
 await h.commands.get('issue').handler('https://github.com/org/repo/issues/12 --merge',h.ctx);
 assert.equal(h.sent.length,2);
 assert.deepEqual(h.sent[0],['/agent GitHubDelivery',{expandPromptTemplates:true}]);
 assert(h.sent[1][0].includes('repository_setup'));
 assert(h.sent[1][0].includes('MERGE_POLICY: auto'));
 assert(h.sent[1][0].includes('squash merge'));
 assert(h.sent[1][0].includes('subagentes nuevos'));
 assert.deepEqual(h.notices,[]);
});
test('/issue does not start work when unconfigured, busy, locally edited or models unavailable',async t=>{
 const h=harness(t);
 const command=h.commands.get('issue');
 await command.handler('12',h.ctx);assert.equal(h.sent.length,0);
 install({suite:join(h.directory,'agent-suite'),profile:'omlx'});
 h.ctx.isIdle=()=>false;await command.handler('12',h.ctx);assert.equal(h.sent.length,0);
 h.ctx.isIdle=()=>true;h.ctx.modelRegistry.find=()=>undefined;
 await command.handler('12',h.ctx);assert.equal(h.sent.length,0);assert(h.notices.at(-1)[0].includes('Modelo no registrado'));
 h.ctx.modelRegistry.find=()=>({});
 fs.appendFileSync(join(h.directory,'agent-suite/agent-selection/agents/GitHubDelivery.md'),'local edit');
 await command.handler('12',h.ctx);assert.equal(h.sent.length,0);
});
test('/issue-setup installs resources and reloads without executing a model turn',async t=>{
 const h=harness(t);await h.commands.get('issue-setup').handler('omlx',h.ctx);
 assert(h.reloaded);assert.equal(h.sent.length,0);
 assert(fs.existsSync(join(h.directory,'agent-suite/workflow/workflows/GitHubIssueDelivery.yaml')));
});


test('merge flags accept either order and reject duplicate/conflicting policies',()=>{
 assert.deepEqual(parseIssueArgs('--no-merge 12'),{ticket:'12',mergePolicy:'manual'});
 assert.deepEqual(parseIssueArgs('12 --merge'),{ticket:'12',mergePolicy:'auto'});
 assert.deepEqual(parseIssueArgs('12'),{ticket:'12',mergePolicy:null});
 for(const value of ['12 --merge --no-merge','12 --merge --merge','--merge','12 --unknown','12 13'])assert.equal(parseIssueArgs(value),null);
});
test('explicit no-merge leaves a persistent manual policy and forbids merge authority',async t=>{
 const h=harness(t);install({suite:join(h.directory,'agent-suite')});
 h.ctx.ui.select=async()=>{throw Error('Explicit policy must not ask again');};
 await h.commands.get('issue').handler('12 --no-merge',h.ctx);
 assert.equal(h.sent.length,2);
 assert(h.sent[1][0].includes('MERGE_POLICY: manual'));
 assert(h.sent[1][0].includes('No ejecutes merge ni actives auto-merge'));
 assert(h.sent[1][0].includes('handoff.json'));
});
test('without a flag asks once before starting; cancel starts nothing',async t=>{
 const h=harness(t);install({suite:join(h.directory,'agent-suite')});
 let asked=0;
 h.ctx.ui.select=async(_title,choices)=>{asked++;return choices[0];};
 await h.commands.get('issue').handler('12',h.ctx);
 assert.equal(asked,1);assert(h.sent[1][0].includes('MERGE_POLICY: manual'));
 h.sent.length=0;h.ctx.ui.select=async()=>undefined;
 await h.commands.get('issue').handler('12',h.ctx);assert.equal(h.sent.length,0);
});
test('non-interactive execution requires an explicit merge option',async t=>{
 const h=harness(t);install({suite:join(h.directory,'agent-suite')});h.ctx.hasUI=false;
 await h.commands.get('issue').handler('12',h.ctx);assert.equal(h.sent.length,0);
 assert(h.notices.at(-1)[0].includes('--merge o --no-merge'));
});
