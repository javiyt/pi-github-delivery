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
  description:'Implement an issue: /issue URL [--merge|--no-merge]; prompts at startup if omitted',
  handler:async(args,ctx)=>{
   const parsed=parseIssueArgs(args);
   if(!parsed){ctx.ui.notify('Usage: /issue URL|NUMBER [--merge|--no-merge]','warning');return;}
   const {ticket}=parsed;
   if(!ctx.isIdle()){ctx.ui.notify('Wait for the current run to finish before starting another issue.','warning');return;}
   try{
    const suite=suiteDirectory(getAgentDir());
    const status=installationStatus(suite);
    if(!status.installed||status.version!==VERSION){ctx.ui.notify('Run /issue-setup to install or update the workflow, then run /issue again.','warning');return;}
    if(status.changed.length){ctx.ui.notify('Resources have been modified or are missing. Review /issue-setup before continuing: '+status.changed.join(', '),'warning');return;}
    if(!pi.getCommands().some(c=>c.source==='extension'&&c.name==='agent')){
     ctx.ui.notify('Install pi-agent-suite with pi install npm:pi-agent-suite, then restart Pi.','error');return;
    }
    const profile=loadProfile(suite);
    const models=[profile.coordinator,...Object.values(profile.stages)].filter(Boolean);
    for(const settings of models){
     const split=settings.id.indexOf('/');
     if(!ctx.modelRegistry.find(settings.id.slice(0,split),settings.id.slice(split+1))){
      ctx.ui.notify('Model not registered in Pi: '+settings.id+'. Configure the provider/model or use /issue-setup current.','error');return;
     }
    }
    if(!models.length&&!ctx.model){ctx.ui.notify('Select a model with /model before running /issue.','warning');return;}
    let mergePolicy=parsed.mergePolicy;
    if(mergePolicy===null){
     if(!ctx.hasUI){ctx.ui.notify('Specify --merge or --no-merge when running without interactive selection.','warning');return;}
     const manual='Leave the PR open for manual merge';
     const auto='Squash merge automatically';
     const choice=await ctx.ui.select('What should the workflow do after the PR passes review and CI?',[manual,auto]);
     if(choice!==manual&&choice!==auto)return;
     mergePolicy=choice===auto?'auto':'manual';
    }
    const mergeInstruction=mergePolicy==='auto'
     ? 'MERGE_POLICY: auto. Squash merge is authorized only after all validation, independent review, CI and repository protection requirements pass.'
     : 'MERGE_POLICY: manual. Leave the PR open. Do not merge or enable auto-merge. After CI passes, move directly to the report using the manual_merge_selected transition.';
    await ctx.waitForIdle();
    await pi.sendUserMessage('/agent GitHubDelivery',{expandPromptTemplates:true});
    await pi.sendUserMessage(
     `Use the GitHubIssueDelivery workflow to implement ${ticket} in the current local repository. `+
     'Activate GitHubIssueDelivery at its initial repository_setup stage before investigating, even if another route was active. '+
     'Do not skip required stages. Delegate work to fresh subagent sessions and pass context through artifacts. '+
     'First verify that the issue matches the local repository and no other subagent is modifying it. '+
     'This request authorizes implementation and opening or updating the PR. '+mergeInstruction+' Persist mergePolicy in handoff.json before delegating. '+
     'If blocked, report the actual state without bypassing any safeguards.'
    );
   }catch(error){ctx.ui.notify('Could not start /issue: '+String(error),'error');}
  }
 });
}
