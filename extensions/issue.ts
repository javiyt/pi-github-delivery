import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {getAgentDir} from '@earendil-works/pi-coding-agent';
import {installationStatus,loadProfile,suiteDirectory,VERSION} from '../src/install.mjs';

export function normalizeTicket(input:string):string|null {
 const value=input.trim();
 if(/^#?[1-9]\d*$/.test(value))return value.replace(/^#/,'');
 if(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\/?$/i.test(value))return value.replace(/\/$/,'');
 return null;
}

export function parseIssueArgs(input:string):{ticket:string;mergePolicy:'auto'|'manual'|null}|null {
 const parts=input.trim().split(/\s+/).filter(Boolean);
 let ticket:string|null=null;
 let mergePolicy:'auto'|'manual'|null=null;
 for(const part of parts){
  if(part==='--merge'||part==='--no-merge'){
   if(mergePolicy!==null)return null;
   mergePolicy=part==='--merge'?'auto':'manual';
  }else{
   if(ticket!==null)return null;
   ticket=normalizeTicket(part);
   if(ticket===null)return null;
  }
 }
 return ticket?{ticket,mergePolicy}:null;
}

export default function issueCommand(pi:ExtensionAPI){
 if(Number(process.env.PI_SUBAGENT_DEPTH??0)>0)return;
 pi.registerCommand('issue',{
  description:'Implementar una issue: /issue URL [--merge|--no-merge]; sin opción pregunta al inicio',
  handler:async(args,ctx)=>{
   const parsed=parseIssueArgs(args);
   if(!parsed){ctx.ui.notify('Uso: /issue URL|NUMERO [--merge|--no-merge]','warning');return;}
   const {ticket}=parsed;
   if(!ctx.isIdle()){ctx.ui.notify('Espera a que termine la ejecución actual antes de iniciar otra issue.','warning');return;}
   try{
    const suite=suiteDirectory(getAgentDir());
    const status=installationStatus(suite);
    if(!status.installed||status.version!==VERSION){ctx.ui.notify('Ejecuta /issue-setup para instalar o actualizar el workflow; después repite /issue.','warning');return;}
    if(status.changed.length){ctx.ui.notify('Hay recursos modificados o ausentes. Revisa /issue-setup antes de ejecutar: '+status.changed.join(', '),'warning');return;}
    if(!pi.getCommands().some(c=>c.source==='extension'&&c.name==='agent')){
     ctx.ui.notify('Instala pi-agent-suite: pi install npm:pi-agent-suite; después reinicia Pi.','error');return;
    }
    const profile=loadProfile(suite);
    const models=[profile.coordinator,...Object.values(profile.stages)].filter(Boolean);
    for(const settings of models){
     const split=settings.id.indexOf('/');
     if(!ctx.modelRegistry.find(settings.id.slice(0,split),settings.id.slice(split+1))){
      ctx.ui.notify('Modelo no registrado en Pi: '+settings.id+'. Configura el proveedor/modelo o usa /issue-setup current.','error');return;
     }
    }
    if(!models.length&&!ctx.model){ctx.ui.notify('Selecciona un modelo con /model antes de ejecutar /issue.','warning');return;}
    let mergePolicy=parsed.mergePolicy;
    if(mergePolicy===null){
     if(!ctx.hasUI){ctx.ui.notify('Indica --merge o --no-merge para ejecutar sin selección interactiva.','warning');return;}
     const manual='Dejar la PR abierta (merge manual)';
     const auto='Hacer squash merge automáticamente';
     const choice=await ctx.ui.select('Cuando la PR pase revisión y CI, ¿qué debe hacer el workflow?',[manual,auto]);
     if(choice!==manual&&choice!==auto)return;
     mergePolicy=choice===auto?'auto':'manual';
    }
    const mergeInstruction=mergePolicy==='auto'
     ? 'MERGE_POLICY: auto. Se autoriza squash merge únicamente cuando todas las verificaciones, revisión independiente, CI y protecciones se cumplan.'
     : 'MERGE_POLICY: manual. Deja la PR abierta. No ejecutes merge ni actives auto-merge. Tras CI verde, pasa directamente al informe por la transición manual_merge_selected.';
    await ctx.waitForIdle();
    await pi.sendUserMessage('/agent GitHubDelivery',{expandPromptTemplates:true});
    await pi.sendUserMessage(
     `Usa el workflow GitHubIssueDelivery para implementar ${ticket} en el repositorio local actual. `+
     'Activa GitHubIssueDelivery desde su etapa inicial repository_setup antes de investigar, aunque hubiera otra ruta activa. '+
     'No omitas ninguna etapa. Delega el trabajo en subagentes nuevos; transmite el contexto mediante artefactos. '+
     'Comprueba primero que la issue corresponde al repositorio local y no hay otro subagente modificándolo. '+
     'Esta petición autoriza implementar y abrir o actualizar la PR. '+mergeInstruction+' Persiste mergePolicy en handoff.json antes de delegar. '+
     'Si hay un bloqueo, informa del estado real sin saltar controles.'
    );
   }catch(error){ctx.ui.notify('No se pudo iniciar /issue: '+String(error),'error');}
  }
 });
}
