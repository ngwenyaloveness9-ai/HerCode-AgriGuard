import {useEffect,useRef,useState} from 'react';
const blank={connected:false,firebaseConnected:false,temperature:0,humidity:0,reservoir:0,reservoirDistance:-1,reservoirLow:false,pumpOn:false,zones:[{id:'A',name:'Zone A',crop:'Macadamia',moisture:0,raw:0},{id:'B',name:'Zone B',crop:'Macadamia',moisture:0,raw:0},{id:'C',name:'Zone C',crop:'Citrus',moisture:0,raw:0}]};
export default function useLiveData(){
 const [data,setData]=useState(blank),[error,setError]=useState(''),[loading,setLoading]=useState(true); const retry=useRef(null);
 useEffect(()=>{let es; const connect=()=>{es=new EventSource('/api/events');es.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='telemetry'){setData(m.data);setLoading(false);setError('')}}catch{}};es.onerror=()=>{setError('Realtime link reconnecting…');es.close();retry.current=setTimeout(connect,1500)}};fetch('/api/state').then(r=>r.json()).then(x=>{if(x.data)setData(x.data);setLoading(false);if(!x.ok)setError(x.error||'Firebase unavailable')}).catch(e=>{setLoading(false);setError(e.message)});connect();return()=>{es?.close();clearTimeout(retry.current)}},[]);return{data,setData,error,loading};
}
