/** Isolated Windows Ink test pad. Never reads or writes notebook content. */
import {useRef,useState} from 'react';
import {router} from 'expo-router';
import {Pressable,SafeAreaView,ScrollView,Text,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {useTheme} from '@/theme/ThemeProvider';
import {preprocessInk} from '@/features/canvas/engine/inkPreprocessor';
import {inputFromInkLine} from '@/features/canvas/engine/inkRecognizer';
import type {StrokeElement} from '@/features/canvas/types';

type Recognition={status:string;reason?:string;words?:{candidates:string[]}[];engine?:string};
type Sample={x:number;y:number;pressure:number};
const pathOf=(samples:Sample[])=>samples.map((p,i)=>`${i===0?'M':'L'}${p.x} ${p.y}`).join(' ');
export default function InkTestScreen(){
 const {colors}=useTheme();
 const [strokes,setStrokes]=useState<Sample[][]>([]);
 const active=useRef<Sample[]>([]);
 const [live,setLive]=useState<Sample[]>([]);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Recognition|null>(null);
 const [groups,setGroups]=useState(0);
 const enabled=typeof window!=='undefined'&&isTauri();
 const getPoint=(event:any):Sample=>({x:event.nativeEvent.locationX,y:event.nativeEvent.locationY,pressure:0.5});
 const finish=()=>{
  if(!active.current.length)return;
  // Snapshot the finished stroke before resetting the mutable ref.
  // React may execute the functional state updater after this handler exits.
  const completed=active.current.map(point=>({...point}));
  active.current=[];
  setStrokes(prev=>[...prev,completed]);
  setLive([]);
  setResult(null);
 };
 const recognize=async()=>{
  if(busy||!strokes.length)return;
  setBusy(true);setResult(null);
  try{
   const now=new Date().toISOString();
   const elements:StrokeElement[]=strokes.map((samples,index)=>({
    id:`test-${index}`,type:'stroke',tool:'pen',z:index,createdAt:now,
    color:'#111111',width:3,opacity:1,points:samples.flatMap(p=>[p.x,p.y,p.pressure]),
    bbox:[Math.min(...samples.map(p=>p.x)),Math.min(...samples.map(p=>p.y)),
      Math.max(...samples.map(p=>p.x)),Math.max(...samples.map(p=>p.y))]
   }));
   const doc=preprocessInk(elements);
   setGroups(doc.lines.length);
   if(!doc.lines.length){setResult({status:'unrecognized',reason:'İşlenebilir çizgi yok'});return;}
   const words:{candidates:string[]}[]=[];
   for(const line of doc.lines){
    const input=inputFromInkLine(line);
    const response=await invoke<Recognition>('notex_windows_ink_recognize_test',{input});
    if(response.status!=='recognized'){setResult(response);return;}
    words.push(...(response.words??[]));
   }
   setResult({status:'recognized',engine:'windows-ink-tr-TR',words});
  }catch(error){setResult({status:'error',reason:String(error)});}
  finally{setBusy(false);}
 };
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
  <ScrollView contentContainerStyle={{padding:20,gap:14}}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={{color:colors.accent}}>← Ayarlara dön</Text></Pressable>
   <Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Windows Ink — test alanı</Text>
   <Text style={{color:colors.muted}}>Buraya Türkçe kelimeler yaz. Sonuçlar yalnızca bu ekranda gösterilir; notların değiştirilmez. Çizgiler uygulama kapatıldığında saklanmaz.</Text>
   {!enabled&&<Text style={{color:colors.muted}}>Bu test yalnızca Windows Tauri uygulamasında çalışır.</Text>}
   <View style={{height:260,backgroundColor:'#fff',borderRadius:12,overflow:'hidden',borderWidth:1,borderColor:'#ddd'}}
    onStartShouldSetResponder={()=>enabled}
    onMoveShouldSetResponder={()=>enabled}
    onResponderGrant={event=>{const point=getPoint(event);active.current=[point];setLive([point]);}}
    onResponderMove={event=>{if(!active.current.length)return;const point=getPoint(event);active.current.push(point);setLive([...active.current]);}}
    onResponderRelease={finish} onResponderTerminate={finish}>
    <Svg width="100%" height="100%" pointerEvents="none">
     {strokes.map((samples,i)=><Path key={i} d={pathOf(samples)} stroke="#171717" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
     <Path d={pathOf(live)} stroke="#171717" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
   </View>
   <View style={{flexDirection:'row',gap:10}}>
    <Pressable accessibilityRole="button" disabled={!enabled||busy||!strokes.length} onPress={()=>void recognize()} style={{padding:12,borderRadius:10,backgroundColor:colors.accent,opacity:!enabled||busy||!strokes.length?0.5:1}}>
     <Text style={{color:colors.onAccent,fontWeight:'700'}}>{busy?'Tanınıyor…':'Türkçe yazıyı tanı'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>{active.current=[];setStrokes([]);setLive([]);setResult(null);setGroups(0);}} style={{padding:12,borderRadius:10,backgroundColor:colors.surfaceRaised}}>
     <Text style={{color:colors.ink}}>Temizle</Text>
    </Pressable>
   </View>
   <Text style={{color:colors.muted}}>Çizgi sayısı: {strokes.length}</Text>
   {result&&<View style={{backgroundColor:colors.surfaceRaised,borderRadius:12,padding:14,gap:8}}>
    <Text selectable style={{color:colors.ink,fontWeight:'700'}}>Durum: {result.status} · Satır: {groups}</Text>
    {!!result.reason&&<Text selectable style={{color:colors.ink}}>{result.reason}</Text>}
    {result.words?.map((word,index)=><Text selectable key={index} style={{color:colors.ink}}>Kelime {index+1}: {word.candidates.join(' / ')||'Sonuç yok'}</Text>)}
    {result.status==='recognized'&&!result.words?.length&&<Text style={{color:colors.muted}}>Tanıyıcı metin döndürmedi.</Text>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
