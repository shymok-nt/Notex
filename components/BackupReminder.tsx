import { useEffect,useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { router } from 'expo-router';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { useTheme } from '@/theme/ThemeProvider';
export function BackupReminder(){
 const {colors}=useTheme();const [visible,setVisible]=useState(false);
 useEffect(()=>{let mounted=true;void Promise.all([settingsRepository.get('lastBackupAt'),settingsRepository.get('backupReminderDismissedAt')]).then(([last,dismissed])=>{
  const now=Date.now(),lastTime=last?Date.parse(last):0,dismissedTime=dismissed?Date.parse(dismissed):0;
  if(mounted)setVisible((!lastTime||now-lastTime>=14*86400000)&&(!dismissedTime||now-dismissedTime>=14*86400000));
 }).catch(console.error);return()=>{mounted=false}},[]);
 if(!visible)return null;
 return <View style={{marginTop:12,padding:12,borderRadius:12,backgroundColor:colors.surfaceRaised,flexDirection:'row',alignItems:'center',gap:8}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Yedekleme ekranını aç" onPress={()=>router.push('/backup')} style={{flex:1}}><Text style={{color:colors.ink,fontSize:13}}>Defterlerini yedeklemeyi unutma. Yedek oluştur</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Yedekleme hatırlatmasını kapat" onPress={()=>{setVisible(false);void settingsRepository.set('backupReminderDismissedAt',new Date().toISOString()).catch(console.error)}} style={{padding:8}}><Text style={{color:colors.muted}}>✕</Text></Pressable>
 </View>;
}
