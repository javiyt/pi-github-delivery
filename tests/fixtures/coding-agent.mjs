export function getAgentDir(){return process.env.PI_CODING_AGENT_DIR;}
export const fixtureModels=[
 {provider:'test',id:'small',name:'Small',reasoning:true,contextWindow:32768,thinkingLevelMap:{off:'off',low:'low',medium:null,high:'high'}},
 {provider:'test',id:'big',name:'Big',reasoning:false,contextWindow:131072,thinkingLevelMap:{off:'off'}}
];
