import {createContext,useEffect,useRef,type PropsWithChildren} from 'react';
import {useFonts} from '@shopify/react-native-skia';
import {Inter_400Regular,Inter_700Bold} from '@expo-google-fonts/inter';
import {SpaceGrotesk_500Medium,SpaceGrotesk_700Bold} from '@expo-google-fonts/space-grotesk';
import {perfNow} from '@/features/canvas/engine/performance';

const fontSources={Inter:[Inter_400Regular],InterBold:[Inter_700Bold],SpaceGrotesk:[SpaceGrotesk_500Medium],SpaceGroteskBold:[SpaceGrotesk_700Bold]};
export type CanvasFontManager=NonNullable<ReturnType<typeof useFonts>>;
export const CanvasFontsContext=createContext<CanvasFontManager|null>(null);

export function CanvasFontProvider({children}:PropsWithChildren){
 const startedAt=useRef(__DEV__?perfNow():0);
 const fontManager=useFonts(fontSources);
 const reported=useRef(false);
 useEffect(()=>{
  if(!fontManager||reported.current)return;
  reported.current=true;
  if(__DEV__)console.log('[Notex perf] skia_fonts_ready',{duration_ms:Math.round((perfNow()-startedAt.current)*10)/10});
 },[fontManager]);
 return <CanvasFontsContext.Provider value={fontManager}>{children}</CanvasFontsContext.Provider>;
}
