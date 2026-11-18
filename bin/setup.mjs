#!/usr/bin/env node
import {install,uninstall,suiteDirectory} from '../src/install.mjs';
const args=process.argv.slice(2);
const options={};
let removing=false;
try{
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--profile'||arg==='--suite-dir'){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value for '+arg);
   options[arg==='--profile'?'profile':'suite']=args[++i];
  }else if(arg==='--adopt')options.adopt=true;
  else if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--uninstall')removing=true;
  else if(arg==='--help'){
   console.log('Usage: pi-github-delivery-setup [--profile current|omlx|FILE] [--suite-dir DIR] [--adopt] [--dry-run] [--uninstall]');process.exit(0);
  }else throw Error('Unknown option: '+arg);
 }
 if(removing&&(options.dryRun||options.adopt||options.profile))throw Error('--uninstall cannot be combined with profile/adopt/dry-run');
 const result=removing?uninstall(options):install(options);
 console.log(JSON.stringify({suite:options.suite||suiteDirectory(),...result},null,2));
 if(!options.dryRun)console.log('Reload Pi before using /issue.');
}catch(error){console.error(error.message);process.exitCode=1;}
