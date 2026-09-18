import {useState} from 'react';
import {Mic,Volume2,X} from 'lucide-react';
export default function VoiceCore({voice}){
 const [expanded,setExpanded]=useState(true);
 const stateText={idle:'Sleeping · wake word only',wake:'Wake phrase detected',listening:'Awake · listening',processing:'Processing command',speaking:'Assistant speaking'}[voice.status]||'Voice standby';
 if(!expanded)return <button className={`voice-mini ${voice.status} ${voice.awake?'awake':''}`} onClick={()=>setExpanded(true)}><i/>{voice.awake?'AWAKE':'VOICE'}</button>;
 return <div className={`voice-core-shell ${voice.status} ${voice.awake?'awake':'sleeping'}`}>
   <button className="voice-core-close" onClick={()=>setExpanded(false)} aria-label="Minimize voice assistant"><X size={14}/></button>
   <button className="voice-core-orb" onClick={voice.onOrbClick} aria-label="AgriGuard voice assistant">
     <span className="vc-ring r1"/><span className="vc-ring r2"/><span className="vc-ring r3"/><span className="vc-glass"/>
     <span className="vc-core"><Mic size={26}/></span>
     <span className="vc-bars"><i/><i/><i/><i/><i/></span>
   </button>
   <div className="voice-core-info"><b>{voice.awake?'AGRIGUARD · AWAKE':'MULTI-WAKE READY'}</b><span>{stateText}</span>{voice.assistant&&<p><Volume2 size={12}/>{voice.assistant}</p>}</div>
 </div>
}
