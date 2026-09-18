export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const clock=()=>new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
export const moistureStatus=v=>v<30?'DRY':v>70?'WET':'NORMAL';
export const systemSummary=d=>{const dry=d.zones.filter(z=>z.moisture<30).map(z=>`Zone ${z.id}`);return `AgriGuard live system status. Temperature ${Number(d.temperature||0).toFixed(1)} degrees Celsius. Humidity ${d.humidity||0} percent. Reservoir ${d.reservoir||0} percent. ${dry.length?dry.join(' and ')+' are estimated dry from the calibrated soil sensor readings.':'No zone is currently below the configured dry threshold.'} The water pump is ${d.pumpOn?'on':'off'}.`;};
