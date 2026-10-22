import { useRef, useState } from 'react';
import { exportProgress, importProgress } from '@/game/rewards';
export function SaveTools({ onImport }: { onImport: () => void }) {
  const input=useRef<HTMLInputElement>(null),[message,setMessage]=useState('');
  return <div className="save-tools"><div><strong>TAKE YOUR PROGRESS WITH YOU.</strong><p>Back up rewards before moving to a new domain or device.</p></div><div className="flex flex-wrap gap-2">
    <button onClick={()=>{const url=URL.createObjectURL(new Blob([exportProgress()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='stick-slam-jam-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export save</button>
    <button onClick={()=>input.current?.click()}>Import save</button>
    <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Import Stick Slam Jam save backup" onChange={async e=>{const file=e.target.files?.[0],field=e.currentTarget;if(!file)return;try{if(file.size>100000)throw new Error('Save file is too large.');await importProgress(await file.text());setMessage('Backup merged and saved. Existing purchases and unlocks were kept.');onImport();}catch(err){setMessage(err instanceof Error?err.message:'Unable to read this save.');}field.value='';}}/>
  </div><span role="status">{message}</span></div>;
}
