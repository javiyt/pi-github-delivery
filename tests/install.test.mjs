import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import YAML from 'yaml';
import {install,uninstall,installationStatus,loadProfile,renderResources,validateProfile} from '../src/install.mjs';

function temp(t){const dir=fs.mkdtempSync(join(tmpdir(),'pi-delivery-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return join(dir,'suite with spaces');}
const wf='workflow/workflows/GitHubIssueDelivery.yaml';
const main='agent-selection/agents/GitHubDelivery.md';
const fm=text=>YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1]);

test('fresh current profile installs portable resources without touching Pi credentials',t=>{
 const suite=temp(t),result=install({suite});
 assert(result.files.length>=17);
 const workflow=YAML.parse(fs.readFileSync(join(suite,wf),'utf8'));
 assert.equal(workflow.stages.length,10);
 assert(workflow.stages.every(s=>s.model===undefined));
 assert(workflow.stages.every(s=>s.prompt.includes(join(suite,'workflow','workflows','rules','stages',s.id+'.md'))));
 assert.equal(fm(fs.readFileSync(join(suite,main),'utf8')).model,undefined);
 assert.deepEqual(installationStatus(suite).changed,[]);
 const rules=fs.readFileSync(join(suite,'workflow/workflows/rules/github-issue-coordinator.md'),'utf8');
 assert(!rules.includes('@@WORKFLOW_DIR@@'));
 assert(!rules.includes('/Users/'));
 const again=install({suite});
 assert.equal(again.files.length,result.files.length);
 const removed=uninstall({suite});
 assert.equal(removed.removed,result.files.length);
 assert.equal(installationStatus(suite).installed,false);
});

test('oMLX profile applies coordinator, Coder 30B implementation and GLM review consistently',t=>{
 const suite=temp(t);install({suite,profile:'omlx'});
 const workflow=YAML.parse(fs.readFileSync(join(suite,wf),'utf8'));
 const review=workflow.stages.find(s=>s.id==='review').model;
 assert.equal(workflow.stages.find(s=>s.id==='implement').model.id,'omlx/Qwen3-Coder-30B-A3B-Instruct-MLX-4bit');
 assert.equal(workflow.stages.find(s=>s.id==='implement').model.thinking,'off');
 assert.equal(review.id,'omlx/GLM-4.7-Flash-MLX-8bit');
 assert.deepEqual(review,fm(fs.readFileSync(join(suite,'agent-selection/agents/GitHubDeliveryReviewer.md'),'utf8')).model);
 install({suite}); // Retains the saved profile when no profile argument is supplied.
 assert.equal(loadProfile(suite).stages.implement.id,'omlx/Qwen3-Coder-30B-A3B-Instruct-MLX-4bit');
});

test('conflict preflight changes no resource; explicit adoption backs up and restores original files',t=>{
 const suite=temp(t),path=join(suite,main);
 fs.mkdirSync(dirname(path),{recursive:true});fs.writeFileSync(path,'original user agent');
 assert.throws(()=>install({suite}),/no resources changed/);
 assert.equal(fs.readFileSync(path,'utf8'),'original user agent');
 assert(!fs.existsSync(join(suite,wf)));
 install({suite,adopt:true});
 uninstall({suite});
 assert.equal(fs.readFileSync(path,'utf8'),'original user agent');
});

test('managed local edits block updates/uninstall; explicit adoption preserves backup evidence',t=>{
 const suite=temp(t);install({suite});
 const path=join(suite,main);fs.appendFileSync(path,'\nlocal edit\n');
 assert(installationStatus(suite).changed.includes(main));
 assert.throws(()=>install({suite}),/locally edited/);
 assert.throws(()=>uninstall({suite}),/modified/);
 install({suite,adopt:true});
 assert.deepEqual(installationStatus(suite).changed,[]);
 assert(fs.readdirSync(join(suite,'github-issue-delivery/backups')).length>0);
});

test('dry-run writes nothing and invalid profiles fail before resource mutation',t=>{
 const suite=temp(t);
 const result=install({suite,dryRun:true});assert(result.dryRun);assert(!fs.existsSync(suite));
 assert.throws(()=>validateProfile({version:1,coordinator:null,stages:{unknown:{id:'x/y'}}},['plan']),/Unknown stage/);
 assert.throws(()=>validateProfile({version:1,coordinator:{id:'bad'},stages:{}},['plan']),/Invalid model/);
 assert.throws(()=>validateProfile({version:1,coordinator:null,stages:{plan:{id:'x/y',thinking:'infinite'}}},['plan']),/Invalid model/);
});

test('destination symlinks cannot overwrite unrelated files',t=>{
 const suite=temp(t),outside=join(dirname(suite),'outside');
 fs.mkdirSync(outside);fs.mkdirSync(suite);fs.symlinkSync(outside,join(suite,'workflow'));
 assert.throws(()=>install({suite}),/symlink/);
 assert.deepEqual(fs.readdirSync(outside),[]);
});

test('installation lock prevents concurrent setup and leaves managed resources intact',t=>{
 const suite=temp(t);install({suite});
 const lock=join(suite,'github-issue-delivery/setup.lock');fs.writeFileSync(lock,'test');
 assert.throws(()=>install({suite}),/Another setup/);
 assert.deepEqual(installationStatus(suite).changed,[]);
});

test('matching unmanaged resources are restored on uninstall instead of being deleted',t=>{
 const suite=temp(t),desired=renderResources(suite,loadProfile(suite));
 const path=join(suite,main);fs.mkdirSync(dirname(path),{recursive:true});fs.writeFileSync(path,desired[main]);
 install({suite});uninstall({suite});
 assert.equal(fs.readFileSync(path,'utf8'),desired[main]);
});


test('CI has explicit guarded routes for automatic merge and manual handoff',t=>{
 const suite=temp(t);install({suite});
 const w=YAML.parse(fs.readFileSync(join(suite,wf),'utf8'));
 const routes=w.transitions.filter(t=>t.from==='ci'&&t.type==='advance');
 assert.equal(routes.length,2);
 assert.equal(routes.find(t=>t.to==='merge').grounds[0].id,'auto_merge_enabled');
 assert.equal(routes.find(t=>t.to==='report').grounds[0].id,'manual_merge_selected');
 assert(w.stages.find(s=>s.id==='merge').prompt.includes('mergePolicy is auto'));
});
