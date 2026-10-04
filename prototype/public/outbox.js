export const retryable=status=>!status||status===408||status===429||status>=500;
export function scheduleRetry(job,error,now=Date.now(),random=Math.random){
 const attempts=(job.attempts||0)+1;
 return {...job,attempts,status:retryable(error.status)?'awaiting-retry':'needs-review',lastError:error.message,nextAttemptAt:retryable(error.status)?now+Math.min(300000,2000*2**Math.min(attempts-1,8))*(.8+random()*.4):null};
}
export function recordSyncStates(state){const received=state.shared?.snapshot?.lots||[];return (state.lots||[]).filter(l=>l.farmerId===state.session.account?.id).map(l=>({id:l.id,status:state.shared?.review?'needs-review':received.some(x=>JSON.stringify(x)===JSON.stringify(l))?'received-by-service':state.shared?.pendingOperation?.lots.some(x=>x.id===l.id)?'queued-for-submission':'saved-on-phone'}));}
