#!/usr/bin/env node
import {createInterface} from 'node:readline/promises';
import fs from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {install,uninstall,suiteDirectory,selectModelProfile} from '../src/install.mjs';

function agentDir(){
 return process.env.PI_CODING_AGENT_DIR||join(homedir(),'.pi','agent');
}
function discoverModels(agentDir){
 const raw=fs.existsSync(join(agentDir,'models.json'))?fs.readFileSync(join(agentDir,'models.json'),'utf8'):null;
 if(!raw)return [];
 const providers=JSON.parse(raw)?.providers??{};
 const found=[];
 for(const [provider,config] of Object.entries(providers)){
  for(const entry of config?.models??[]){
   const type=entry?.type??'chat';
   if(type==='image'||type==='classifier'||(Array.isArray(type)&&!type.includes('chat')))continue;
   const reasoning=entry?.reasoning===true||entry?.reasoning==='auto';
   found.push({id:`${provider}/${entry.id}`,name:entry?.name??entry.id,reasoning,
    contextWindow:typeof entry?.contextWindow==='number'?entry.contextWindow:undefined,
    thinkingLevelMap:entry?.thinkingLevelMap});
  }
 }
 return found;
}
function promptFromStdin(){
 const rl=createInterface({input:process.stdin,output:process.stdout});
 return {
  async select(title,options){
   console.log('\n'+title);
   options.forEach((option,i)=>console.log(`  ${i+1}) ${option}`));
   for(;;){
    const answer=(await rl.question(`Choice [1-${options.length}]: `)).trim();
    if(answer==='')return options[0];
    const index=Number(answer)-1;
    if(Number.isInteger(index)&&index>=0&&index<options.length)return options[index];
    console.log('Enter a number between 1 and '+options.length);
   }
  },
  async input(title,placeholder){
   return (await rl.question(`${title} [${placeholder}]: `));
  },
  close:()=>rl.close()
 };
}
const args=process.argv.slice(2);
const options={};
let removing=false,selecting=false;
try{
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--profile'||arg==='--suite-dir'){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value for '+arg);
   options[arg==='--profile'?'profile':'suite']=args[++i];
  }else if(arg==='--adopt')options.adopt=true;
  else if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--select')selecting=true;
  else if(arg==='--uninstall')removing=true;
  else if(arg==='--help'){
   console.log('Usage: pi-github-delivery-setup [--profile current|omlx|FILE] [--suite-dir DIR] [--select] [--adopt] [--dry-run] [--uninstall]\n\n  --select interactively chooses the model and thinking level for every workflow stage');
   process.exit(0);
  }else throw Error('Unknown option: '+arg);
 }
 if(removing&&(options.dryRun||options.adopt||options.profile||selecting))throw Error('--uninstall cannot be combined with other arguments');
 if(selecting&&(options.dryRun||options.adopt||options.profile))throw Error('--select cannot be combined with a profile, --adopt or --dry-run');
 let interactiveProfile;
 if(selecting){
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('--select requires an interactive terminal');
  const prompt=promptFromStdin();
  interactiveProfile=await selectModelProfile(prompt,null,discoverModels(agentDir()));
  prompt.close();
  if(interactiveProfile===undefined){console.log('Selection canceled; no changes.');process.exit(0);}
  options.profile=interactiveProfile;
 }
 const result=removing?uninstall(options):install(options);
 console.log(JSON.stringify({suite:options.suite||suiteDirectory(),...result},null,2));
 if(interactiveProfile)console.log('Saved profile: coordinator '+(interactiveProfile.coordinator?.id??'current')+'; '+Object.keys(interactiveProfile.stages).length+' stages configured.');
 if(!options.dryRun)console.log('Reload Pi before using /issue.');
}catch(error){console.error(error.message);process.exitCode=1;}
