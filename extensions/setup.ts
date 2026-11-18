import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {install,uninstall,suiteDirectory,selectModelProfile} from '../src/install.mjs';

export function parseSetupArgs(args:string):{options:{suite?:string;profile?:string;adopt?:boolean;dryRun?:boolean};removing:boolean;select:boolean}{
 const options:{suite?:string;profile?:string;adopt?:boolean;dryRun?:boolean}={};
 let removing=false,select=false;
 for(const arg of args.trim().split(/\s+/).filter(Boolean)){
  if(arg==='current'||arg==='omlx')options.profile=arg;
  else if(arg==='--adopt')options.adopt=true;
  else if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--select')select=true;
  else if(arg==='--uninstall')removing=true;
  else throw Error('Usage: /issue-setup [current|omlx] [--select] [--adopt] [--dry-run] [--uninstall]');
 }
 if(removing&&(options.adopt||options.dryRun||options.profile||select))throw Error('--uninstall cannot be combined with other arguments');
 if(select&&(options.dryRun||options.adopt||options.profile))throw Error('--select cannot be combined with a profile, --adopt or --dry-run');
 return {options,removing,select};
}

export default function setupCommand(pi:ExtensionAPI){
 if(Number(process.env.PI_SUBAGENT_DEPTH??0)>0)return;
 pi.registerCommand('issue-setup',{
  description:'Install/update resources: /issue-setup [current|omlx] [--select] [--adopt] [--dry-run] [--uninstall]',
  handler:async(args,ctx)=>{
   if(!ctx.isIdle()){ctx.ui.notify('Wait for the current run to finish before changing the workflow.','warning');return;}
   let removing=false,select=false;
   const options:{suite:string;profile?:string|object;adopt?:boolean;dryRun?:boolean}={suite:suiteDirectory(getAgentDir())};
   try{
    const parsed=parseSetupArgs(args);
    removing=parsed.removing;select=parsed.select;
    Object.assign(options,parsed.options);
    if(removing){
     const result=uninstall(options);
     ctx.ui.notify(`Removed ${result.removed} resources. Artifacts and backups have been preserved.`,'info');
    }else if(select){
     if(!ctx.hasUI){ctx.ui.notify('--select requires an interactive Pi session; use --profile from the CLI instead.','error');return;}
     const current=ctx.model?{id:ctx.model.id}:null;
     const models=ctx.modelRegistry.getAvailable()
      .filter(m=>m.type==='chat'||m.type===undefined)
      .map(m=>({id:`${m.provider}/${m.id}`,reasoning:!!m.reasoning,thinkingLevelMap:m.thinkingLevelMap,contextWindow:m.contextWindow}));
     const prompt={
      select:(title:string,choices:string[])=>ctx.ui.select(title,choices),
      input:(title:string,placeholder?:string)=>ctx.ui.input(title,placeholder),
      notify:(message:string,type?:'info'|'warning'|'error')=>ctx.ui.notify(message,type??'info')
     };
     const profile=await selectModelProfile(prompt,current,models);
     if(profile===undefined){ctx.ui.notify('Model selection canceled; no changes.','info');return;}
     const result=install({suite:options.suite,profile});
     const ids=new Set([profile.coordinator?.id,...Object.values(profile.stages).map(s=>s.id)]);
     const summary=Object.keys(profile.stages).length===0
      ?current?`current model (${current.id}) for every stage`:'current model for every stage':
      ids.size===1?[...ids][0]+' for every role':`${ids.size} models across ${1+Object.keys(profile.stages).length} roles`;
     ctx.ui.notify(`Configured models: ${summary}. Installed ${result.files.length} resources for GitHub Delivery ${result.version}.`,'info');
    }else{
     const result=install(options);
     ctx.ui.notify(`${options.dryRun?'Checked':'Installed'} ${result.files.length} resources for GitHub Delivery ${result.version}.`,'info');
     if(options.dryRun)return;
    }
    await ctx.reload();
    return;
   }catch(error){ctx.ui.notify(String(error),'error');}
  }
 });
}
