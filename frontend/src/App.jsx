import {useState} from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ZonesPage from './pages/ZonesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AssistantPage from './pages/AssistantPage';
import SystemPage from './pages/SystemPage';
import ClimatePage from './pages/ClimatePage';
import IrrigationPage from './pages/IrrigationPage';
import DigitalTwinPage from './pages/DigitalTwinPage';
import AlertsPage from './pages/AlertsPage';
import useVoiceAssistant from './hooks/useVoiceAssistant';
import useLiveData from './hooks/useLiveData';
import VoiceCore from './components/VoiceCore';
import {clock} from './utils/system';

export default function App(){
  const [page,setPage]=useState('dashboard');
  const {data,setData,error,loading}=useLiveData();
  const [logs,setLogs]=useState([{time:clock(),text:'AgriGuard Nexus connected to LIVE Firebase telemetry'}]);
  const log=text=>setLogs(x=>[{time:clock(),text},...x].slice(0,20));
  const voice=useVoiceAssistant(data,setData,log,setPage);
  const pages={
    dashboard:<DashboardPage data={data} logs={logs} voice={voice}/> , twin:<DigitalTwinPage data={data}/> , zones:<ZonesPage data={data}/> ,
    irrigation:<IrrigationPage data={data} setData={setData} log={log}/> , climate:<ClimatePage data={data} setData={setData} log={log}/> ,
    analytics:<AnalyticsPage data={data}/> , alerts:<AlertsPage data={data} logs={logs}/> , assistant:<AssistantPage voice={voice} data={data}/> ,
    settings:<SystemPage data={data} error={error} loading={loading}/>
  };
  return <div className="app"><Header voice={voice} data={data}/>{error&&<div className="live-error">⚠ {error}</div>}<div className="shell"><Sidebar page={page} setPage={setPage}/><main className="content">{pages[page]}</main></div><VoiceCore voice={voice}/><footer>AgriGuard Nexus • Sense → Analyse → Act → Verify → Visualise <span>LIVE MODE • FIREBASE RTDB</span></footer></div>
}
