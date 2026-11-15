import React,{useEffect,useRef,useState} from 'react';
import {Platform,Pressable,ScrollView,Text,View,type ViewStyle} from 'react-native';
import {router} from 'expo-router';
import {useTheme} from '@/theme/ThemeProvider';
import {detectCapabilities,readPointerBatch,type InputSample} from '@/features/canvas/engine/inputSample';
type Stroke={x:number;y:number}[];
type Live={sample:InputSample|null;pointerId:number;coalesced:number;altitude:number|null;azimuth:number|null;hover:boolean;hz:number;pressureValues:number[];barrel:boolean;eraser:boolean;pressure:boolean;tilt:boolean;unavailable:boolean};
const initial:Live={sample:null,pointerId:0,coalesced:0,altitude:null,azimuth:null,hover:false,hz:0,pressureValues:[],barrel:false,eraser:false,pressure:false,tilt:false,unavailable:false};
export default function PenTestScreen(){
 const {colors}=useTheme();
 const surfaceRef=useRef<any>(null);
 const [live,setLive]=useState<Live>(initial);
 const [strokes,setStrokes]=useState<Stroke[]>([]);
 const history=useRef<InputSample[]>([]);
 const active=useRef(new Map<number,Stroke>());
 const flags=useRef({barrel:false,eraser:false});
 const lastRender=useRef(0);
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const surface=surfaceRef.current as HTMLElement|null;
  if(!surface)return;
  surface.style.touchAction='none';
  const stop=(event:Event)=>event.preventDefault();
  const update=(event:PointerEvent,phase:'down'|'move'|'end')=>{
   if(phase==='down'){
    event.preventDefault();
    try{surface.setPointerCapture(event.pointerId)}catch{}
    active.current.set(event.pointerId,[]);
   }
   const batch=readPointerBatch(event,surface.getBoundingClientRect());
   const sample=batch.actual[batch.actual.length-1];
   if(!sample)return;
   flags.current.barrel ||=batch.barrelButton;
   flags.current.eraser ||=batch.eraser;
   history.current.push(...batch.actual);
   if(history.current.length>12000)history.current.splice(0,history.current.length-12000);
   const path=active.current.get(event.pointerId);
   if(path&&phase!=='end'){
    path.push(...batch.actual.map(p=>({x:p.x,y:p.y})));
    if(path.length>4000)path.splice(0,path.length-4000);
   }
   if(phase==='end'){
    if(path?.length)setStrokes(old=>[...old,path.slice()].slice(-80));
    active.current.delete(event.pointerId);
    try{if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId)}catch{}
   }
   const now=performance.now();
   if(phase==='move'&&now-lastRender.current<50)return;
   lastRender.current=now;
   const caps=detectCapabilities(history.current,flags.current.barrel,flags.current.eraser);
   const recent=history.current.filter(p=>p.t>=sample.t-3000&&p.pointerType==='pen');
   setLive({sample,pointerId:batch.pointerId,coalesced:batch.coalescedCount,altitude:batch.altitudeAngle,azimuth:batch.azimuthAngle,hover:batch.hover,hz:caps.hz,pressureValues:recent.slice(-100).map(p=>p.pressure),barrel:caps.barrelButton,eraser:caps.eraser,pressure:caps.pressure,tilt:caps.tilt,unavailable:caps.pressureUnavailable});
  };
  const down=(e:PointerEvent)=>update(e,'down');
  const move=(e:PointerEvent)=>update(e,'move');
  const end=(e:PointerEvent)=>update(e,'end');
  surface.addEventListener('pointerdown',down,{passive:false});
  surface.addEventListener('pointermove',move,{passive:false});
  surface.addEventListener('pointerup',end);
  surface.addEventListener('pointercancel',end);
  surface.addEventListener('lostpointercapture',end);
  surface.addEventListener('contextmenu',stop);
  return()=>{
   surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);
   surface.removeEventListener('pointerup',end);surface.removeEventListener('pointercancel',end);
   surface.removeEventListener('lostpointercapture',end);surface.removeEventListener('contextmenu',stop);
  };
 },[]);
 const clear=()=>{history.current=[];flags.current={barrel:false,eraser:false};active.current.clear();setStrokes([]);setLive(initial)};
 const s=live.sample;
 const text=(value:string)=><Text style={{color:colors.ink,fontSize:13}}>{value}</Text>;
 const panel=(name:string,value:string)=><View style={{backgroundColor:colors.surfaceRaised,padding:12,borderRadius:12,minWidth:130,flexGrow:1}}><Text style={{color:colors.muted,fontSize:12}}>{name}</Text><Text style={{color:colors.ink,fontSize:18,fontWeight:'600'}}>{value}</Text></View>;
 const graph=live.pressureValues;
 return <View style={{flex:1,backgroundColor:colors.background}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16}}>
   <Pressable onPress={()=>router.back()} accessibilityRole="button">{text('← Ayarlara dön')}</Pressable>
   <Text style={{color:colors.ink,fontSize:20,fontWeight:'700'}}>Kalem Test Alanı</Text>
   <Pressable onPress={clear} accessibilityRole="button">{text('Temizle')}</Pressable>
  </View>
  <ScrollView contentContainerStyle={{padding:16,gap:12}}>
   <Text style={{color:colors.muted}}>Kalemle, fareyle veya dokunarak aşağıdaki alanda çiz. Test çizgileri yalnızca bellektedir; hiçbir deftere veya SQLite verisine yazılmaz.</Text>
   <View ref={surfaceRef} style={{height:260,borderRadius:14,borderWidth:1,borderColor:colors.divider,backgroundColor:colors.surface,overflow:'hidden',touchAction:'none'} as ViewStyle}>
    {strokes.flatMap((path,j)=>path.slice(1).filter((_,i)=>i%2===0).map((p,i)=>{const from=path[i*2];if(!from)return null;const dx=p.x-from.x,dy=p.y-from.y,length=Math.hypot(dx,dy);return <View key={j+'-'+i} pointerEvents="none" style={{position:'absolute',left:from.x,top:from.y,width:length,height:2,backgroundColor:colors.accent,transform:[{translateX:dx/2},{translateY:dy/2},{rotate:Math.atan2(dy,dx)+'rad'}]}}/>}))}
    {s&&<View pointerEvents="none" style={{position:'absolute',left:s.x-5,top:s.y-5,width:10,height:10,borderRadius:5,backgroundColor:live.hover?'#F59E0B':colors.accent}}/>}
   </View>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
    {panel('Giriş türü',s?.pointerType??'—')}
    {panel('Basınç',s?s.pressure.toFixed(3):'—')}
    {panel('Eğim X / Y',s?`${s.tiltX}° / ${s.tiltY}°`:'—')}
    {panel('Twist',s?`${s.twist}°`:'—')}
    {panel('Buttons',s?`${s.buttons}`:'—')}
    {panel('Örnek / saniye',live.hz?`~${live.hz} Hz`:'—')}
    {panel('Coalesced',String(live.coalesced))}
    {panel('Pointer ID',String(live.pointerId||'—'))}
    {panel('Hover',live.hover?'Algılandı':'—')}
    {panel('Altitude / Azimuth',live.altitude===null?'—':`${live.altitude.toFixed(2)} / ${live.azimuth?.toFixed(2)??'—'} rad`)}
   </View>
   <Text style={{color:colors.ink,fontWeight:'700'}}>Basınç göstergesi</Text>
   <View style={{height:12,borderRadius:6,backgroundColor:colors.divider,overflow:'hidden'}}><View style={{width:`${Math.min(100,Math.max(0,(s?.pressure??0)*100))}%`,height:12,backgroundColor:colors.accent}}/></View>
   <Text style={{color:colors.ink,fontWeight:'700'}}>Son 3 saniye · basınç grafiği</Text>
   <View style={{height:90,flexDirection:'row',alignItems:'flex-end',gap:1,backgroundColor:colors.surfaceRaised,borderRadius:12,padding:8}}>
    {graph.map((p,i)=><View key={i} style={{flex:1,minWidth:1,height:Math.max(1,p*74),backgroundColor:colors.accent}}/>)}
   </View>
   <Text style={{color:colors.ink,fontWeight:'700'}}>Eğim göstergesi</Text>
   <View style={{width:90,height:90,borderRadius:45,borderWidth:1,borderColor:colors.divider,alignItems:'center',justifyContent:'center'}}>
    <View style={{width:14,height:14,borderRadius:7,backgroundColor:colors.accent,transform:[{translateX:(s?.tiltX??0)/2},{translateY:(s?.tiltY??0)/2}]}}/>
   </View>
   <Text style={{color:colors.ink,fontWeight:'700'}}>Sonuç özeti</Text>
   {text(`Basınç: ${live.pressure?'var':live.unavailable?'algılanmıyor':'henüz doğrulanmadı'} · Eğim: ${live.tilt?'var':'yok'} · Kalem düğmesi: ${live.barrel?'var':'yok'} · Silgi ucu: ${live.eraser?'var':'yok'} · Hız: ~${live.hz} Hz`)}
   <Text style={{color:colors.muted,fontSize:12}}>Basınç hep 0.5 veya 1.0 görünüyorsa Wacom, Huion veya XP-Pen sürücüsünde “Windows Ink'i kullan” seçeneğini kontrol et. Farede sabit basınç normaldir. Düğme ve silgi sonucu yalnızca testte kullanıldığında doğrulanır.</Text>
  </ScrollView>
 </View>;
}
