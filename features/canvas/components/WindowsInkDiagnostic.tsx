import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {isTauri} from '@tauri-apps/api/core';
import {checkWindowsInkTurkish,type WindowsInkCapability} from '../engine/windowsInkCapability';

export function WindowsInkDiagnostic({colors}:{colors:{ink:string;muted:string;accent:string;onAccent:string;surfaceRaised:string}}){
 const [result,setResult]=useState<WindowsInkCapability|null>(null);
 const [loading,setLoading]=useState(false);
 if(typeof window==='undefined'||!isTauri())return null;
 const check=async()=>{
  if(loading)return;
  setLoading(true);
  setResult(null);
  try{setResult(await checkWindowsInkTurkish());}
  finally{setLoading(false);}
 };
 return <View style={{backgroundColor:colors.surfaceRaised,borderRadius:16,padding:16,gap:10}}>
  <Text style={{fontSize:16,fontWeight:'700',color:colors.ink}}>Windows Ink — Türkçe tanıyıcı</Text>
  <Text style={{fontSize:12,color:colors.muted}}>Yalnızca Windows'ta kurulu el yazısı tanıyıcılarını kontrol eder. El yazısı dönüştürme etkinleştirilmez.</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Türkçe tanıyıcıyı kontrol et" accessibilityState={{disabled:loading}} disabled={loading} onPress={()=>void check()} style={{alignSelf:'flex-start',backgroundColor:colors.accent,paddingHorizontal:16,paddingVertical:11,borderRadius:10}}>
   <Text style={{color:colors.onAccent,fontWeight:'700'}}>{loading?'Kontrol ediliyor…':'Tanıyıcıyı kontrol et'}</Text>
  </Pressable>
  {result&&<View style={{gap:6}}>
   <Text selectable style={{color:colors.ink,fontWeight:'700'}}>{result.available?'Türkçe tanıyıcı bulundu':'Türkçe tanıyıcı bulunamadı / doğrulanamadı'}</Text>
   <Text selectable style={{color:colors.muted,fontSize:12}}>Dil: {result.locale}</Text>
   {!!result.reason&&<Text selectable style={{color:colors.muted,fontSize:12}}>Açıklama: {result.reason}</Text>}
   <Text selectable style={{color:colors.muted,fontSize:12}}>Kurulu tanıyıcılar: {result.recognizers?.length?result.recognizers.join(', '):'Liste boş'}</Text>
  </View>}
 </View>;
}
