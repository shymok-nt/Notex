/** Read-only Windows Ink tr-TR availability probe.
 * Does not activate handwriting recognition, start workers or mutate notes.
 */
import {invoke,isTauri} from '@tauri-apps/api/core';

export type WindowsInkCapability={
 available:boolean;
 locale:'tr-TR';
 recognizers?:string[];
 reason?:string|null;
};

export async function checkWindowsInkTurkish():Promise<WindowsInkCapability>{
 if(typeof window==='undefined'||!isTauri()){
  return {available:false,locale:'tr-TR',reason:'Windows Tauri uygulaması gerekli'};
 }
 try{
  const result=await invoke<WindowsInkCapability>('notex_windows_ink_capability');
  if(!result||result.locale!=='tr-TR'||result.available!==true){
   return {available:false,locale:'tr-TR',recognizers:Array.isArray(result?.recognizers)?result.recognizers:[],reason:result?.reason??'Türkçe tanıyıcı doğrulanamadı'};
  }
  return {available:true,locale:'tr-TR',recognizers:Array.isArray(result.recognizers)?result.recognizers:[]};
 }catch(error){
  return {available:false,locale:'tr-TR',reason:String(error)};
 }
}
