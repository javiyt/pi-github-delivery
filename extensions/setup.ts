import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {install,uninstall,suiteDirectory} from '../src/install.mjs';

export default function setupCommand(pi:ExtensionAPI){
 if(Number(process.env.PI_SUBAGENT_DEPTH??0)>0)return;
 pi.registerCommand('issue-setup',{
  description:'Install/update resources: /issue-setup [current|omlx] [--adopt] [--dry-run] [--uninstall]',
  handler:async(args,ctx)=>{
   if(!ctx.isIdle()){ctx.ui.notify('Wait for the current run to finish before changing the workflow.','warning');return;}
   const options:{suite:string;profile?:string;adopt?:boolean;dryRun?:boolean}={suite:suiteDirectory(getAgentDir())};
   let removing=false;
   try{
    for(const arg of args.trim().split(/\s+/).filter(Boolean)){
     if(arg==='current'||arg==='omlx')options.profile=arg;
     else if(arg==='--adopt')options.adopt=true;
     else if(arg==='--dry-run')options.dryRun=true;
     else if(arg==='--uninstall')removing=true;
     else throw Error('Usage: /issue-setup [current|omlx] [--adopt] [--dry-run] [--uninstall]');
    }
    if(removing&&(options.adopt||options.dryRun||options.profile))throw Error('--uninstall cannot be combined with other arguments');
    if(removing){
     const result=uninstall(options);
     ctx.ui.notify(`Removed ${result.removed} resources. Artifacts and backups have been preserved.`,'info');
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
