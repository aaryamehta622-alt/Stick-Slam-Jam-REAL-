import { useSaveStatus } from '@/hooks/use-progress';
import { flushProgress } from '@/game/progress';
export function SaveStatus(){
  const status=useSaveStatus(),warning=['pending','unavailable','corrupt'].includes(status.kind);
  return <div className={`save-status ${warning?'save-warning':''}`}>
    <span className="save-status-dot"/><span role="status">{status.message}</span>
    {warning&&<button onClick={()=>void flushProgress()}>Retry save</button>}
    <details><summary>About local saves</summary><p>Classes, coins, rewards, equipment and preferences save automatically in this browser on this website. Refreshing or closing a normal tab keeps them. Clearing site storage, private browsing, another device or another website address can remove or separate progress. Export a backup to keep a copy. Cloud sync is not connected.</p></details>
  </div>;
}
