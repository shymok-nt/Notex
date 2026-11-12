import { useEffect,useState } from 'react';
import { Alert,Platform,Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft,Trash2 } from 'lucide-react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';

const DAY=24*60*60*1000;
const remaining=(deletedAt:string)=>Math.max(0,30-Math.floor((Date.now()-new Date(deletedAt).getTime())/DAY));
const confirmAction=(title:string,message:string,action:()=>Promise<void>)=>{
 if(Platform.OS==='web'){
  if(typeof window!=='undefined'&&window.confirm(message))void action().catch(error=>console.error(title,error));
 }else Alert.alert(title,message,[{text:'Vazgeç',style:'cancel'},{text:'Kalıcı olarak sil',style:'destructive',onPress:()=>void action().catch(error=>console.error(title,error))}]);
};
export default function TrashScreen(){
 const {colors}=useTheme();
 const deleted=useNotebookStore(s=>s.deletedNotebooks);
 const refresh=useNotebookStore(s=>s.refreshDeleted);
 const restore=useNotebookStore(s=>s.restoreNotebook);
 const permanentlyRemove=useNotebookStore(s=>s.permanentlyDeleteNotebook);
 const empty=useNotebookStore(s=>s.emptyTrash);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{void refresh().catch(console.error)},[refresh]);
 const perform=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await action()}catch(error){Alert.alert('İşlem başarısız',String(error));console.error(error)}finally{setBusy(false)}};
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
  <View style={{height:64,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10}}>
   <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable>
   <Text style={{flex:1,color:colors.ink,fontSize:22,fontWeight:'700'}}>Silinenler</Text>
   {deleted.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Çöpü boşalt" onPress={()=>confirmAction('Çöpü boşalt','Silinen tüm defterler ve içerikleri kalıcı olarak silinecek. Bu işlem geri alınamaz.',()=>perform(empty))} style={{padding:10}}><Text style={{color:colors.coral,fontWeight:'600'}}>Çöpü boşalt</Text></Pressable>}
  </View>
  <ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:80}}>
   {deleted.length===0?<Text style={{color:colors.muted,textAlign:'center',marginTop:100}}>Silinen defter yok</Text>:deleted.map(n=><View key={n.id} style={{flexDirection:'row',alignItems:'center',paddingVertical:14,borderBottomWidth:1,borderBottomColor:colors.divider,gap:14}}>
    <NotebookCover notebook={n} width={64}/>
    <View style={{flex:1,minWidth:0,gap:5}}>
     <Text numberOfLines={2} style={{color:colors.ink,fontSize:16,fontWeight:'600'}}>{n.title}</Text>
     <Text style={{color:colors.muted,fontSize:12}}>{remaining(n.deletedAt)} gün kaldı</Text>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:14,marginTop:5}}>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={n.title+' geri yükle'} onPress={()=>void perform(()=>restore(n.id))} style={{paddingVertical:8}}><Text style={{color:colors.accent,fontWeight:'600'}}>Geri yükle</Text></Pressable>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={n.title+' kalıcı olarak sil'} onPress={()=>confirmAction('Kalıcı olarak sil','Bu defter, sayfaları ve dosyaları kalıcı olarak silinecek. Bu işlem geri alınamaz.',()=>perform(()=>permanentlyRemove(n.id)))} style={{paddingVertical:8}}><Text style={{color:colors.coral,fontWeight:'600'}}>Kalıcı olarak sil</Text></Pressable>
     </View>
    </View>
   </View>)}
  </ScrollView>
 </SafeAreaView>;
}
