import {controlPump} from '../api';
import {useCallback,useEffect,useRef,useState} from 'react';
import {systemSummary} from '../utils/system';

// Multi-phrase wake detector. General speech recognition often transcribes
// "AgriGuard" as "Agri Guard", "aggregate", "agree guard" or "agriculture".
// We therefore combine safe aliases with fuzzy matching, but require a greeting
// prefix for the fuzzy path to reduce accidental wake-ups during conversation.
const WAKE_PHRASES=[
  'hey agriguard','hey agri guard','hello agriguard','hello agri guard','okay agriguard','ok agriguard',
  'hey system','hello system','okay system','ok system',
  'hey assistant','hello assistant','okay assistant','ok assistant',
  'hey farm assistant','hello farm assistant','hey farming assistant',
  'hey smart farm','hello smart farm'
];
const WAKE_ALIASES=[
  'hey aggregate','hello aggregate','okay aggregate','ok aggregate',
  'hey agree guard','hello agree guard','hey agree card','hey aggie guard',
  'hey agriculture','hello agriculture','hey agricultural','hey agri card','hey agri god'
];
const normalize=(value='')=>value.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/-/g,' ').replace(/\s+/g,' ').trim();
const levenshtein=(a,b)=>{const m=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const old=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return m[b.length]};
const similarity=(a,b)=>{a=normalize(a);b=normalize(b);return 1-levenshtein(a,b)/Math.max(a.length,b.length,1)};
const findWakePhrase=(value='')=>{
  const text=normalize(value);
  const all=[...WAKE_PHRASES,...WAKE_ALIASES];
  for(const phrase of all){const i=text.indexOf(phrase);if(i>=0)return {matched:phrase,index:i,length:phrase.length,score:1}}
  // Fuzzy wake detection only for utterances beginning with a greeting.
  if(!/^(hey|hello|okay|ok)\b/.test(text))return null;
  const words=text.split(' ');let best=null;
  for(let n=2;n<=Math.min(4,words.length);n++){
    const candidate=words.slice(0,n).join(' ');
    for(const phrase of WAKE_PHRASES){const score=similarity(candidate,phrase);if(score>=0.72&&(!best||score>best.score))best={matched:candidate,index:0,length:candidate.length,score}}
  }
  return best;
};
const hasWakeWord=(value='')=>Boolean(findWakePhrase(value));
const removeWakeWord=(value='')=>{const text=normalize(value);const hit=findWakePhrase(text);if(!hit)return text;return `${text.slice(0,hit.index)} ${text.slice(hit.index+hit.length)}`.replace(/\s+/g,' ').trim()};
const SLEEP_COMMAND_REGEX=/^(?:go to sleep|sleep|sleep now|you can sleep|stand by|standby|enter standby|sleep mode|stop listening|pause listening|pause voice|quiet mode|be quiet|that's all|thats all|i'm done|im done|done for now)$/i;
const ROUTES={dashboard:['dashboard','command center','command centre','home'],twin:['digital twin','farm twin','twin'],zones:['zones','crop zones','crops'],irrigation:['irrigation','water control','pump control'],climate:['environment','climate','temperature','humidity'],analytics:['analytics','analysis','trends'],alerts:['alerts','activity','events'],assistant:['assistant','voice ai','voice assistant'],settings:['system','settings','hardware']};

export default function useVoiceAssistant(data,setData,log,setPage){
  const [status,setStatus]=useState('idle');
  const [label,setLabel]=useState('STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT');
  const [awake,setAwake]=useState(false);
  const [wakeArmed,setWakeArmed]=useState(true);
  const [transcript,setTranscript]=useState('');
  const [assistant,setAssistant]=useState('AgriGuard voice core starting…');

  const recognitionRef=useRef(null),mountedRef=useRef(false),runningRef=useRef(false),shouldListenRef=useRef(true);
  const speakingRef=useRef(false),processingRef=useRef(false),awaitingCommandRef=useRef(false),acknowledgingRef=useRef(false),awakeRef=useRef(false);
  const restartTimerRef=useRef(null),speechResolveRef=useRef(null),pendingCommandRef=useRef(''),lastProcessedRef=useRef(''),lastProcessedAtRef=useRef(0),handleTranscriptRef=useRef(null),startupDoneRef=useRef(false);

  const setAwakeState=useCallback(v=>{awakeRef.current=v;if(mountedRef.current)setAwake(v)},[]);
  const clearRestart=useCallback(()=>{if(restartTimerRef.current)clearTimeout(restartTimerRef.current);restartTimerRef.current=null},[]);
  const stopRecognition=useCallback(()=>{clearRestart();try{recognitionRef.current?.abort()}catch{}runningRef.current=false},[clearRestart]);
  const startRecognition=useCallback(()=>{if(!mountedRef.current||!recognitionRef.current||!shouldListenRef.current||speakingRef.current||processingRef.current||runningRef.current)return false;try{recognitionRef.current.start();return true}catch{return false}},[]);
  const armWakeRecognition=useCallback((delay=120)=>{if(!mountedRef.current)return;shouldListenRef.current=true;processingRef.current=false;awaitingCommandRef.current=false;acknowledgingRef.current=false;pendingCommandRef.current='';clearRestart();restartTimerRef.current=setTimeout(()=>{restartTimerRef.current=null;if(!mountedRef.current||speakingRef.current||processingRef.current||runningRef.current)return;if(!startRecognition())restartTimerRef.current=setTimeout(()=>{restartTimerRef.current=null;if(mountedRef.current&&!speakingRef.current&&!processingRef.current&&!runningRef.current)startRecognition()},250)},delay)},[clearRestart,startRecognition]);

  const finishSpeech=useCallback(()=>{speakingRef.current=false;const resolve=speechResolveRef.current;speechResolveRef.current=null;if(mountedRef.current&&!processingRef.current){setStatus(awakeRef.current?'listening':'idle');setLabel(awakeRef.current?'AWAKE — LISTENING FOR COMMAND':'STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT')}if(resolve)resolve()},[]);
  const voiceSay=useCallback(message=>{if(!mountedRef.current||!message)return Promise.resolve();stopRecognition();speakingRef.current=true;setStatus('speaking');setLabel('ASSISTANT SPEAKING');setAssistant(message);if(!('speechSynthesis'in window)){finishSpeech();return Promise.resolve()}return new Promise(resolve=>{speechResolveRef.current=resolve;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang='en-US';u.rate=1.08;u.pitch=1;u.volume=1;const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>/en[-_]ZA/i.test(v.lang)&&/google|microsoft/i.test(v.name))||voices.find(v=>/en-US/i.test(v.lang)&&/google|microsoft|zira|samantha/i.test(v.name))||voices.find(v=>/^en/i.test(v.lang))||null;u.onend=finishSpeech;u.onerror=finishSpeech;try{window.speechSynthesis.speak(u)}catch{finishSpeech()}})},[finishSpeech,stopRecognition]);
  const completeCommand=useCallback(()=>{processingRef.current=false;awaitingCommandRef.current=true;acknowledgingRef.current=false;pendingCommandRef.current='';setStatus('listening');setLabel('AWAKE — LISTENING FOR COMMAND');shouldListenRef.current=true;if(!startRecognition())armWakeRecognition(160)},[armWakeRecognition,startRecognition]);

  const processCommand=useCallback(async spoken=>{const q=normalize(removeWakeWord(spoken));if(!q||processingRef.current||speakingRef.current)return;processingRef.current=true;awaitingCommandRef.current=false;stopRecognition();setTranscript(spoken);setStatus('processing');setLabel('PROCESSING COMMAND');log(`Voice: “${spoken}”`);
    try{
      if(SLEEP_COMMAND_REGEX.test(q)){await voiceSay('Understood. I will sleep now. Say Hey AgriGuard whenever you need me again.');setAwakeState(false);processingRef.current=false;awaitingCommandRef.current=false;setStatus('idle');setLabel('STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT');armWakeRecognition(160);return}
      for(const [page,names] of Object.entries(ROUTES)){for(const name of names){const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(q===name||new RegExp(`(?:open|show|go to|launch|take me to|navigate to|display|switch to|bring up)\\s+(?:the\\s+)?${esc}`).test(q)){setPage(page);await voiceSay(`Opening ${names[0]}.`);completeCommand();return}}}
      if(/system status|overall status|status update|full status|how is everything|system health|overview|read the overview/.test(q)){await voiceSay(systemSummary(data));completeCommand();return}
      if(/^(hello|hi|good morning|good afternoon|good evening|how are you)/.test(q)){await voiceSay('Hello. AgriGuard is online and ready to assist with farm monitoring and control.');completeCommand();return}
      if(/help|what can you do|commands|capabilities/.test(q)){await voiceSay('I can report the complete system status, soil moisture for Zones A, B and C, temperature, humidity, reservoir level, irrigation status and live sensor values. I can control the physical irrigation pump, identify warnings, and navigate the dashboard.');completeCommand();return}
      if(/who are you|what are you|your name/.test(q)){await voiceSay('I am AgriGuard AI, the voice interface for the smart agribusiness and climate defence system.');completeCommand();return}
      if(/temperature|how hot|heat/.test(q)){await voiceSay(`Current temperature is ${data.temperature.toFixed(1)} degrees Celsius. ${data.temperature>=35?'The heat threshold is active.':'Temperature telemetry is available from the DHT11 sensor.'}`);completeCommand();return}
      if(/humidity/.test(q)){await voiceSay(`Current relative humidity is ${data.humidity} percent.`);completeCommand();return}
      if(/reservoir|water level|tank level/.test(q)){await voiceSay(`Reservoir level is ${data.reservoir} percent. ${data.reservoir<=20?'Low-water pump protection is active.':'Water level is sufficient for irrigation.'}`);completeCommand();return}
      if(/zone a|zone b|zone c/.test(q)){const id=q.includes('zone a')?'A':q.includes('zone b')?'B':'C';const z=data.zones.find(x=>x.id===id);await voiceSay(`Zone ${id}, ${z.crop}. Soil moisture is ${z.moisture} percent. ${z.moisture<30?'The zone is dry and requires irrigation.':z.moisture>70?'The zone is wet.':'Moisture is in the normal range.'}`);completeCommand();return}
      if(/dry zone|which zone.*dry|needs water|need irrigation/.test(q)){const dry=data.zones.filter(z=>z.moisture<30);await voiceSay(dry.length?`${dry.map(z=>`Zone ${z.id}`).join(' and ')} ${dry.length>1?'are':'is'} below the 30 percent moisture threshold.`:'No zone is currently below the 30 percent moisture threshold.');completeCommand();return}
      if((/pump|irrigation/.test(q))&&/on|start|activate|run/.test(q)){if(data.reservoir<=20){await voiceSay('Pump command blocked. Reservoir level is below the 20 percent safety threshold.');completeCommand();return}await controlPump(true,'voice');log('Voice control: pump ON command sent to ESP32');await voiceSay('Pump on command sent to the ESP32. I will confirm the live state from Firebase.');completeCommand();return}
      if((/pump|irrigation/.test(q))&&/off|stop|deactivate/.test(q)){await controlPump(false,'voice');log('Voice control: pump OFF command sent to ESP32');await voiceSay('Pump off command sent to the ESP32.');completeCommand();return}
      if(/warning|alert|problem|attention/.test(q)){const warnings=[];const dry=data.zones.filter(z=>z.moisture<30);if(dry.length)warnings.push(`${dry.map(z=>`Zone ${z.id}`).join(' and ')} soil moisture low`);if(data.reservoir<=20)warnings.push('reservoir low');if(data.temperature>=35)warnings.push('high temperature');await voiceSay(warnings.length?`Current warnings are ${warnings.join(', ')}.`:'There are no critical warnings.');completeCommand();return}
      await voiceSay('I did not understand that command. I am still listening. Please try system status, Zone B moisture, reservoir level, pump on, or open analytics.');completeCommand();
    }catch(e){console.error('Voice command error',e);processingRef.current=false;await voiceSay('I could not complete that command. I am still awake and listening. Please try again.');completeCommand()}
  },[armWakeRecognition,completeCommand,data,log,setAwakeState,setData,setPage,stopRecognition,voiceSay]);

  const handleTranscript=useCallback((transcript,isFinal)=>{const normalized=normalize(transcript);if(!normalized||!mountedRef.current||speakingRef.current||processingRef.current)return;setTranscript(transcript);const wakeDetected=hasWakeWord(normalized);const command=wakeDetected?removeWakeWord(normalized):normalized;
    if(!awakeRef.current){if(!wakeDetected)return;if(command&&!isFinal)pendingCommandRef.current=command;if(!isFinal)return;const finalCommand=command||pendingCommandRef.current;pendingCommandRef.current='';if(acknowledgingRef.current)return;acknowledgingRef.current=true;setAwakeState(true);setStatus('wake');setLabel('WAKE PHRASE DETECTED');void voiceSay('Wake phrase detected. AgriGuard is awake and listening for your command.').then(()=>{if(!mountedRef.current)return;acknowledgingRef.current=false;awaitingCommandRef.current=true;shouldListenRef.current=true;setStatus('listening');setLabel('AWAKE — LISTENING FOR COMMAND');if(finalCommand){lastProcessedRef.current=finalCommand;lastProcessedAtRef.current=Date.now();void processCommand(finalCommand)}else if(!startRecognition())armWakeRecognition(160)});return}
    if(acknowledgingRef.current)return;if(awaitingCommandRef.current&&isFinal){const now=Date.now();if(normalized===lastProcessedRef.current&&now-lastProcessedAtRef.current<1800)return;lastProcessedRef.current=normalized;lastProcessedAtRef.current=now;void processCommand(normalized)}
  },[armWakeRecognition,processCommand,setAwakeState,startRecognition,voiceSay]);
  handleTranscriptRef.current=handleTranscript;

  useEffect(()=>{mountedRef.current=true;shouldListenRef.current=true;setWakeArmed(true);const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){setLabel('VOICE NOT SUPPORTED — USE CHROME OR EDGE');setAssistant('This browser does not provide the Web Speech recognition API. Use Chrome or Edge.');return()=>{mountedRef.current=false}}
    const r=new Recognition();r.continuous=true;r.interimResults=true;r.lang='en-US';r.maxAlternatives=3;
    r.onstart=()=>{runningRef.current=true;if(!speakingRef.current&&!processingRef.current){setStatus(awakeRef.current?'listening':'idle');setLabel(awakeRef.current?'AWAKE — LISTENING FOR COMMAND':'STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT')}};
    r.onresult=e=>{if(!mountedRef.current||speakingRef.current||processingRef.current)return;for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i];for(let a=0;a<Math.min(result.length,3);a++){const t=result[a]?.transcript?.trim();if(t&&hasWakeWord(t)){handleTranscriptRef.current?.(t,result.isFinal);break}if(a===0&&t)handleTranscriptRef.current?.(t,result.isFinal)}if(processingRef.current)break}};
    r.onerror=e=>{runningRef.current=false;if(!mountedRef.current)return;if(e.error==='not-allowed'||e.error==='service-not-allowed'){shouldListenRef.current=false;setStatus('idle');setLabel('MICROPHONE PERMISSION REQUIRED');setAssistant('Allow microphone permission for this site once. Browser security does not allow a web page to bypass that permission.');return}if(e.error==='audio-capture')setLabel('MICROPHONE UNAVAILABLE');else if(e.error==='network')setLabel(awakeRef.current?'VOICE NETWORK ERROR — RETRYING':'VOICE STANDBY — RETRYING');if(shouldListenRef.current&&!speakingRef.current&&!processingRef.current){clearRestart();restartTimerRef.current=setTimeout(()=>{restartTimerRef.current=null;startRecognition()},e.error==='network'?1200:300)}};
    r.onend=()=>{runningRef.current=false;if(mountedRef.current&&shouldListenRef.current&&!speakingRef.current&&!processingRef.current){clearRestart();restartTimerRef.current=setTimeout(()=>{restartTimerRef.current=null;startRecognition()},300)}};
    recognitionRef.current=r;window.speechSynthesis?.getVoices();startRecognition();
    return()=>{mountedRef.current=false;shouldListenRef.current=false;clearRestart();try{r.abort()}catch{}window.speechSynthesis?.cancel();if(speechResolveRef.current)speechResolveRef.current();speechResolveRef.current=null}
  },[clearRestart,startRecognition]);

  // Startup briefing: same lifecycle pattern as JumpStart's post-login overview.
  useEffect(()=>{if(startupDoneRef.current||!data.firebaseConnected)return;startupDoneRef.current=true;const timer=setTimeout(()=>{if(!mountedRef.current)return;const overview=`Welcome to AgriGuard. Live Firebase telemetry is connected. ${systemSummary(data)} Say Hey AgriGuard, Hey System, or Hey Assistant whenever you need assistance.`;void voiceSay(overview).finally(()=>{if(!mountedRef.current)return;setAwakeState(false);setStatus('idle');setLabel('STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT');armWakeRecognition(180)})},450);return()=>clearTimeout(timer)},[data.firebaseConnected]);

  const restartWake=useCallback(()=>{shouldListenRef.current=true;setWakeArmed(true);setAwakeState(false);setStatus('idle');setLabel('STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT');setAssistant('Wake listener re-armed. Say “Hey AgriGuard”, “Hey System”, or “Hey Assistant”.');armWakeRecognition(80)},[armWakeRecognition,setAwakeState]);
  const listen=useCallback(()=>{shouldListenRef.current=true;setAwakeState(true);awaitingCommandRef.current=true;setStatus('listening');setLabel('AWAKE — LISTENING FOR COMMAND');if(!startRecognition())armWakeRecognition(80)},[armWakeRecognition,setAwakeState,startRecognition]);
  const onOrbClick=useCallback(()=>{if(speakingRef.current){window.speechSynthesis?.cancel();finishSpeech();armWakeRecognition(120);return}if(!awakeRef.current)listen();else{setAwakeState(false);awaitingCommandRef.current=false;setStatus('idle');setLabel('STANDBY — SAY HEY AGRIGUARD, HEY SYSTEM OR HEY ASSISTANT');armWakeRecognition(100)}},[armWakeRecognition,finishSpeech,listen,setAwakeState]);
  return{status,label,awake,listening:status==='listening'||status==='wake',wakeArmed,transcript,assistant,speak:voiceSay,command:processCommand,listen,toggleWake:restartWake,onOrbClick};
}
