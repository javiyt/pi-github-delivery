import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {install,uninstall,suiteDirectory} from '../src/install.mjs';

export default function setupCommand(pi:ExtensionAPI){
 if(Number(process.env.PI_SUBAGENT_DEPTH??0)>0)return;
 pi.registerCommand('issue-setup',{
  description:'Instalar/actualizar recursos: /issue-setup [current|omlx] [--adopt] [--dry-run] [--uninstall]',
  handler:async(args,ctx)=>{
   if(!ctx.isIdle()){ctx.ui.notify('Espera a que termine la ejecución antes de cambiar el workflow.','warning');return;}
   const options:{suite:string;profile?:string;adopt?:boolean;dryRun?:boolean}={suite:suiteDirectory(getAgentDir())};
   let removing=false;
   try{
    for(const arg of args.trim().split(/\s+/).filter(Boolean)){
     if(arg==='current'||arg==='omlx')options.profile=arg;
     else if(arg==='--adopt')options.adopt=true;
     else if(arg==='--dry-run')options.dryRun=true;
     else if(arg==='--uninstall')removing=true;
     else throw Error('Uso: /issue-setup [current|omlx] [--adopt] [--dry-run] [--uninstall]');
    }
    if(removing&&(options.adopt||options.dryRun||options.profile))throw Error('--uninstall no admite otros argumentos');
    if(removing){
     const result=uninstall(options);
     ctx.ui.notify(`Retirados ${result.removed} recursos. Se conservan los artefactos y copias de seguridad.`,'info');
    }else{
     const result=install(options);
     ctx.ui.notify(`${options.dryRun?'Comprobados':'Instalados'} ${result.files.length} recursos de GitHub Delivery ${result.version}.`,'info');
     if(options.dryRun)return;
    }
    await ctx.reload();
    return;
   }catch(error){ctx.ui.notify(String(error),'error');}
  }
 });
}
