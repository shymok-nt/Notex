import React,{useRef,useState} from 'react';
import {Platform,Pressable,SafeAreaView,ScrollView,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useTheme} from '@/theme/ThemeProvider';
import {detectPressure,normalizeSample,type InputSample} from '@/features/canvas/engine/penEngineV2';

/** Isolated diagnostics: no pageStore, SQLite or notebook writes. */
export default function PenDiagnostics(){
 const {colors}=useTheme();
 const [sample,setSample]=useState<InputSample|null>(null);
 const [count,setCount]=useState(0);
 const [hz,setHz]=useState(0);
 const [variable,setVariable]=useState(false);
 const history=useRef<InputSample[]>([]);
 const onPointer=(event:any)=>{
  const native=event.nativeEvent??event;
  const kind=native.pointerType==='pen'?'pen':native.pointerType==='touch'?'touch':native.pointerType==='mouse'?'mouse':'unknown';
  const next=normalizeSample({x:native.clientX??native.pageX??0,y:native.clientY??native.pageY??0,
   pressure:native.pressure??.5,tiltX:native.tiltX??0,tiltY:native.tiltY??0,
   twist:native.twist??0,t:native.timeStamp??Date.now(),buttons:native.buttons??0,pointerType:kind});
  const list=[...history.current.slice(-119),next];history.current=list;
  setSample(next);setCount(list.length);
  if(list.length>1){const elapsed=list[list.length-1].t-list[0].t;setHz(elapsed>0?Math.round((list.length-1)*1000/elapsed):0);}
  setVariable(detectPressure(list));
 };
 const line=(name:string,value:string|number)=><View style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:7}}><Text style={{color:colors.muted}}>{name}</Text><Text style={{color:colors.ink,fontWeight:'600'}}>{value}</Text></View>;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
  <ScrollView contentContainerStyle={{padding:20,gap:12}}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={{color:colors.accent}}>‹ Geri</Text></Pressable>
   <Text style={{fontSize:24,fontWeight:'700',color:colors.ink}}>Kalemi test et</Text>
   <Text style={{color:colors.muted}}>Bu alan test amaçlıdır. Defterine veya veritabanına hiçbir çizgi kaydedilmez.</Text>
   <View {...({onPointerDown:onPointer,onPointerMove:onPointer,onPointerUp:onPointer,onPointerCancel:()=>history.current=[]} as any)}
    style={{height:260,borderRadius:18,borderWidth:1,borderColor:colors.accent,backgroundColor:colors.surfaceRaised,justifyContent:'center',alignItems:'center',touchAction:'none'} as any}>
    <Text style={{color:colors.ink}}>Kalemi bu alanda hareket ettir</Text>
   </View>
   {line('Platform',Platform.OS)}
   {line('Giriş',sample?.pointerType??'Bekleniyor')}
   {line('Basınç',sample?.pressure.toFixed(3)??'—')}
   {line('Tilt X / Y',sample?`${sample.tiltX}° / ${sample.tiltY}°`:'—')}
   {line('Twist',sample?.twist??'—')}
   {line('Düğmeler',sample?.buttons??'—')}
   {line('Örnek hızı',`${hz} Hz`)}
   {line('Örnek sayısı',count)}
   {line('Değişken basınç',variable?'Algılandı':'Henüz algılanmadı')}
   <Text style={{color:colors.muted,fontSize:12}}>Windows'ta basınç hep 0.5 veya 1.0 görünüyorsa kalem sürücüsünü ve Windows Ink ayarlarını kontrol et. Tarayıcı ve cihaz bazı alanları desteklemeyebilir.</Text>
  </ScrollView>
 </SafeAreaView>;
}
