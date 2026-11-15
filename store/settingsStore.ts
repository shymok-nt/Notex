import { create } from 'zustand';
import {defaultBrush,type BrushSnapshot,type PressurePreset} from '@/features/canvas/engine/penEngineV2';
import { Alert } from 'react-native';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { ThemeMode } from '@/theme/ThemeProvider';
import type { PageTemplate,PaperColor } from '@/types/notebook';
export type PenSettings={stylusOnly:boolean;pressureEnabled:boolean;pressureSensitivity:number;fingerDraw:boolean;palmRejection:boolean;stabilization:number;pressurePreset:PressurePreset;tiltEnabled:boolean;sideButton:'eraser'|'lasso'|'hand'|'none';hoverEnabled:boolean;brushSlots:BrushSnapshot[]};
const defaultPenSettings=():PenSettings=>({stylusOnly:false,pressureEnabled:true,pressureSensitivity:1,fingerDraw:true,palmRejection:true,stabilization:35,pressurePreset:'normal',tiltEnabled:true,sideButton:'eraser',hoverEnabled:true,brushSlots:['fountain','fountain','ballpoint','pencil','highlighter','calligraphy'].map((id,i)=>({...defaultBrush(id as BrushSnapshot['id']),size:i===0?2:i===1?5:defaultBrush(id as BrushSnapshot['id']).size}))});
type State={penSettings:PenSettings;setPenSettings:(next:Partial<PenSettings>)=>Promise<void>;theme:ThemeMode;defaultTemplate:PageTemplate;defaultPaperColor:PaperColor;recentSearches:string[]; hydrate:()=>Promise<void>;setTheme:(v:ThemeMode)=>Promise<void>;setDefaultTemplate:(v:PageTemplate)=>Promise<void>;setDefaultPaperColor:(v:PaperColor)=>Promise<void>;addSearch:(v:string)=>Promise<void>;clearSearches:()=>Promise<void>};
const safe=async(key:string,value:string)=>{try{await settingsRepository.set(key,value);return true}catch{Alert.alert('Hata','Ayar kaydedilemedi.');return false}};
export const useSettingsStore=create<State>((set,get)=>({
 penSettings:defaultPenSettings(),theme:'system',defaultTemplate:'çizgili',defaultPaperColor:'beyaz',recentSearches:[],
 hydrate:async()=>{const [theme,template,paper,searches,penRaw ]=await Promise.all(['theme','defaultTemplate','defaultPaperColor','recentSearches','penSettings'].map(k=>settingsRepository.get(k)));let recentSearches:string[]=[];try{recentSearches=JSON.parse(searches??'[]')}catch{}let penSettings:PenSettings=defaultPenSettings();try{const parsed=JSON.parse(penRaw??'{}');penSettings={...defaultPenSettings(),...parsed,stylusOnly:parsed.stylusOnly===true,pressureEnabled:parsed.pressureEnabled!==false,pressureSensitivity:typeof parsed.pressureSensitivity==='number'?Math.max(0.3,Math.min(2,parsed.pressureSensitivity)):1,fingerDraw:parsed.fingerDraw!==false,stabilization:typeof parsed.stabilization==='number'?Math.max(0,Math.min(100,parsed.stabilization)):35,brushSlots:Array.isArray(parsed.brushSlots)&&parsed.brushSlots.length>=3&&parsed.brushSlots.length<=6?parsed.brushSlots:defaultPenSettings().brushSlots}}catch{}set({penSettings,theme:theme==='light'||theme==='dark'?theme:'system',defaultTemplate:(['boş','çizgili','kareli','noktalı'].includes(template??'')?template:'çizgili') as PageTemplate,defaultPaperColor:paper==='krem'?'krem':'beyaz',recentSearches:Array.isArray(recentSearches)?recentSearches:[]})},
 setPenSettings:async next=>{const penSettings={...get().penSettings,...next};if(await safe('penSettings',JSON.stringify(penSettings)))set({penSettings})},
 setTheme:async v=>{if(await safe('theme',v))set({theme:v})},
 setDefaultTemplate:async v=>{if(await safe('defaultTemplate',v))set({defaultTemplate:v})},
 setDefaultPaperColor:async v=>{if(await safe('defaultPaperColor',v))set({defaultPaperColor:v})},
 addSearch:async value=>{value=value.trim();if(!value)return;const recentSearches=[value,...get().recentSearches.filter(x=>x.toLocaleLowerCase('tr-TR')!==value.toLocaleLowerCase('tr-TR'))].slice(0,8);if(await safe('recentSearches',JSON.stringify(recentSearches)))set({recentSearches})},
 clearSearches:async()=>{if(await safe('recentSearches','[]'))set({recentSearches:[]})}
}));
