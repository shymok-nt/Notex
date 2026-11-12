import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect,useState } from 'react';
import { ActivityIndicator,Pressable,Text,View,useColorScheme } from 'react-native';
import { useNotebookStore } from '@/store/notebookStore';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts as useSpaceFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { colors,applyColors } from '@/theme/colors';
import { ThemeProvider,useTheme } from '@/theme/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { DeleteUndoSnackbar } from '@/components/DeleteUndoSnackbar';
import {CanvasFontProvider} from '@/features/canvas/components/CanvasFontProvider';
export default function RootLayout(){const deviceScheme=useColorScheme();const [interLoaded,interError]=useInterFonts({Inter_400Regular,Inter_500Medium,Inter_600SemiBold});const [spaceLoaded,spaceError]=useSpaceFonts({SpaceGrotesk_500Medium,SpaceGrotesk_700Bold});const hydrate=useNotebookStore(s=>s.hydrate);const hydrateSettings=useSettingsStore(s=>s.hydrate);const theme=useSettingsStore(s=>s.theme);const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');applyColors(theme==='system'?(deviceScheme==='dark'?'dark':'light'):theme);const [errorMessage,setErrorMessage]=useState('');const retry=()=>{
 setStatus('loading');setErrorMessage('');
 let timeout:ReturnType<typeof setTimeout>|undefined;
 const loading=Promise.all([hydrate(),hydrateSettings()]);
 const limit=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Veritabanı 15 saniye içinde yüklenemedi. Web SQLite/WASM dosyalarını ve tarayıcı konsolunu kontrol et.')),15000)});
 Promise.race([loading,limit]).then(()=>setStatus('ready')).catch(error=>{console.error('Uygulama başlatılamadı:',error);setErrorMessage(error instanceof Error?error.message:String(error));setStatus('error')}).finally(()=>{if(timeout)clearTimeout(timeout)});
};useEffect(()=>{retry()},[]);if((!interLoaded&&!interError)||(!spaceLoaded&&!spaceError)||status==='loading')return <View style={{flex:1,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.accent} size="large"/></View>;if(status==='error')return <View style={{flex:1,backgroundColor:colors.background,alignItems:'center',justifyContent:'center',padding:24}}><Text style={{color:colors.ink,fontSize:18,textAlign:'center',marginBottom:18}}>Veriler yüklenemedi. Lütfen tekrar dene.</Text><Text selectable style={{color:colors.ink,textAlign:'center',marginBottom:18}}>{errorMessage}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tekrar dene" onPress={retry} style={{minHeight:48,paddingHorizontal:24,backgroundColor:colors.accent,borderRadius:12,justifyContent:'center'}}><Text style={{color:colors.surface}}>Tekrar dene</Text></Pressable></View>;return <GestureHandlerRootView style={{flex:1}}><CanvasFontProvider><ThemeProvider key={theme} initialMode={theme}><RootStack/></ThemeProvider></CanvasFontProvider></GestureHandlerRootView>}
function RootStack(){const {colors,scheme}=useTheme();return <><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}><Stack.Screen name="(tabs)"/><Stack.Screen name="notebook-editor" options={{presentation:'fullScreenModal'}}/><Stack.Screen name="note/[id]"/><Stack.Screen name="settings"/><Stack.Screen name="trash"/><Stack.Screen name="backup"/><Stack.Screen name="search" options={{animation:'fade'}}/><Stack.Screen name="folder/[id]"/></Stack><DeleteUndoSnackbar/><StatusBar style={scheme==='dark'?'light':'dark'}/></>}
