import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { applyColors,darkColors,lightColors,type ThemeColors } from '@/theme/colors';
import { settingsRepository } from '@/db/repositories/settingsRepository';
export type ThemeMode='system'|'light'|'dark';
type ThemeContextValue={colors:ThemeColors;scheme:'light'|'dark';mode:ThemeMode;setMode:(mode:ThemeMode)=>Promise<void>};
const Context=createContext<ThemeContextValue>({colors:lightColors,scheme:'light',mode:'system',setMode:async()=>{}});
export function ThemeProvider({children,initialMode='system'}:{children:ReactNode;initialMode?:ThemeMode}){
 const system=useColorScheme();const [mode,setCurrentMode]=useState<ThemeMode>(initialMode);
 const scheme=mode==='system'?(system==='dark'?'dark':'light'):mode;
 const palette=scheme==='dark'?darkColors:lightColors;
 applyColors(scheme);
 const setMode=async(next:ThemeMode)=>{await settingsRepository.set('theme',next);setCurrentMode(next)};
 const value=useMemo(()=>({colors:palette,scheme,mode,setMode}),[scheme,mode]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTheme(){return useContext(Context)}
