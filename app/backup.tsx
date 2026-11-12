import { useState } from 'react';
import { ActivityIndicator,Alert,Platform,Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { File,Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { createBackup,inspectBackup,importBackup,webDownload } from '@/services/notexBackup';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';

type Pending={bytes:Uint8Array;summary:string};
const backupName=(uri:string)=>{try{return decodeURIComponent(uri.split('/').pop()??uri).split(':').pop()??uri}catch{return uri}};
type BackupChoice={uri:string;exportedAt:number|null;readable:boolean};
const backupDateLabel=(choice:BackupChoice)=>choice.exportedAt===null?'Yedekleme zamanı belirlenemiyor':new Date(choice.exportedAt).toLocaleString('tr-TR',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const readAndroidBytes=async(uri:string)=>{
 const encoded=await LegacyFileSystem.readAsStringAsync(uri,{encoding:LegacyFileSystem.EncodingType.Base64});
 const binary=atob(encoded),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
};
export default function BackupScreen(){
 const {colors}=useTheme();const [busy,setBusy]=useState(false),[label,setLabel]=useState(''),[percent,setPercent]=useState(0),[pending,setPending]=useState<Pending|null>(null),[error,setError]=useState('');
 const [backupChoices,setBackupChoices]=useState<BackupChoice[]>([]);
 const refresh=useNotebookStore(s=>s.refresh),refreshFolders=useNotebookStore(s=>s.refreshFolders);
 const progress=(text:string,value:number)=>{setLabel(text);setPercent(value)};
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){const msg=e instanceof Error?e.message:'İşlem tamamlanamadı';setError(msg);console.error('Yedekleme hatası',e)}finally{setBusy(false)}};
 const saveAndroid=async(bytes:Uint8Array,name:string)=>{
  const permission=await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if(!permission.granted)return false;
  const destination=await LegacyFileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri,name,'application/zip');
  // SAF writes require a base64-encoded string; avoid interpreting ZIP bytes as UTF-8.
  let base64='';for(let i=0;i<bytes.length;i+=8192){const chunk=bytes.subarray(i,i+8192);base64+=String.fromCharCode(...chunk)}
  await LegacyFileSystem.writeAsStringAsync(destination,btoa(base64),{encoding:LegacyFileSystem.EncodingType.Base64});
  const saved=await LegacyFileSystem.readAsStringAsync(destination,{encoding:LegacyFileSystem.EncodingType.Base64});
  if(saved!==btoa(base64))throw new Error('Kaydedilen yedek doğrulanamadı. Lütfen başka klasör seç.');
  return true;
 };
 const create=()=>void run(async()=>{
  const bytes=await createBackup(progress);
  const now=new Date();
  const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0'),String(now.getHours()).padStart(2,'0'),String(now.getMinutes()).padStart(2,'0'),String(now.getSeconds()).padStart(2,'0')].join('-');
  // Android document providers recognize .zip reliably with application/zip.
  // The internal ZIP format remains the same as .notex backups on web.
  const name='Notex-yedek-'+date+(Platform.OS==='android'?'.zip':'.notex');
  if(Platform.OS==='web')webDownload(bytes,name);
  else if(Platform.OS==='android'){
   progress('Kaydedilecek klasörü seç…',95);
   const saved=await saveAndroid(bytes,name);
   if(!saved){setLabel('Kaydetme iptal edildi');return}
  }
  else{
   const file=new File(Paths.cache,name);
   await file.write(bytes);
   if(!await Sharing.isAvailableAsync())throw new Error('Paylaşma bu cihazda kullanılamıyor');
   // ZIP MIME lets Android/iOS file providers recognize the archive instead of a generic .bin.
   // Keep the cache file briefly after the share sheet closes: some targets read it asynchronously.
   try{await Sharing.shareAsync(file.uri,{mimeType:'application/zip',UTI:'public.zip-archive',dialogTitle:'Notex yedeğini kaydet'});}
   finally{setTimeout(()=>{try{if(file.exists)file.delete()}catch(e){console.warn('Geçici yedek temizlenemedi',e)}},60000)}
  }
  await settingsRepository.set('lastBackupAt',new Date().toISOString());
  setLabel('Yedek oluşturuldu');setPercent(100);
 });
 const readSelectedAndroidBackup=(uri:string)=>void run(async()=>{
  const bytes=await readAndroidBytes(uri);
  const {manifest}=await inspectBackup(bytes);
  setBackupChoices([]);
  setPending({bytes,summary:`${manifest.counts.notebooks} defter, ${manifest.counts.pages} sayfa, ${manifest.counts.files} resim bulundu`});
 });
 const pick=()=>void run(async()=>{
  let bytes:Uint8Array;
  if(Platform.OS==='android'){
   // SAF provides a persistent document URI directly; avoid the Expo Go
   // DocumentPicker cache file, which can be unreadable on some devices.
   const permission=await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
   if(!permission.granted)return;
   const entries=await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(permission.directoryUri);
   // The SAF picker selects a directory, not an individual file.
   // Give a deterministic list of backup names in the app so the user can choose.
   const candidates=entries.filter(uri=>{
    const decoded=decodeURIComponent(uri);
    return /\.(?:zip|notex|bin)(?:$|[?#])/i.test(decoded);
   });
   if(candidates.length===0)throw new Error('Seçilen klasörde .zip, .notex veya .bin yedeği bulunamadı.');
   progress('Yedeklerin gerçek tarihleri okunuyor…',10);
   const choices:BackupChoice[]=[];
   for(let i=0;i<candidates.length;i++){
    const uri=candidates[i];
    try{
     const bytes=await readAndroidBytes(uri);
     const {manifest}=await inspectBackup(bytes);
     const parsed=Date.parse(manifest.exportedAt);
     choices.push({uri,exportedAt:Number.isFinite(parsed)?parsed:null,readable:true});
    }catch(e){
     console.warn('Yedek bilgileri okunamadı:',backupName(uri),e);
     choices.push({uri,exportedAt:null,readable:false});
    }
    progress('Yedekler inceleniyor…',10+Math.round(80*(i+1)/candidates.length));
   }
   choices.sort((a,b)=>(b.exportedAt??-1)-(a.exportedAt??-1)||backupName(a.uri).localeCompare(backupName(b.uri),'tr'));
   setBackupChoices(choices);
   setLabel('Yedekler listelendi');setPercent(100);
   return;
  }else{
   const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false});
   if(result.canceled)return;
   const asset=result.assets[0];if(!asset)throw new Error('Bu dosya okunamadı');
   if(Platform.OS==='web'){
    if(!asset.file)throw new Error('Bu dosya okunamadı');
    bytes=new Uint8Array(await asset.file.arrayBuffer());
   }else bytes=await new File(asset.uri).bytes();
  }
  let manifest:Awaited<ReturnType<typeof inspectBackup>>['manifest'];
  try{({manifest}=await inspectBackup(bytes))}catch(e){console.error('Notex ZIP doğrulama hatası',e);throw new Error('Seçilen dosya geçerli bir Notex yedeği değil: '+(e instanceof Error?e.message:String(e)))}
  setPending({bytes,summary:`${manifest.counts.notebooks} defter, ${manifest.counts.pages} sayfa, ${manifest.counts.files} resim bulundu`});
 });
 const restore=()=>{if(!pending)return;const bytes=pending.bytes;setPending(null);void run(async()=>{await importBackup(bytes,progress);await refreshFolders();await refresh();Alert.alert('Tamamlandı','Defterler mevcut verilere eklendi.')})};
 const button=(text:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={{backgroundColor:colors.surfaceRaised,borderRadius:14,padding:18,marginTop:12,opacity:(disabled||busy)?0.5:1}}><Text style={{color:colors.ink,fontSize:16,fontWeight:'600'}}>{text}</Text></Pressable>;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable><Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Yedekle ve geri yükle</Text></View><ScrollView contentContainerStyle={{padding:20}}>
  <Text style={{color:colors.muted}}>Defterler, sayfalar, çizimler ve resimler tek bir .notex dosyasına kaydedilir. Silinenler yedeğe dahil edilmez.</Text>
  {Platform.OS==='android'&&<Text style={{color:colors.muted,marginTop:12}}>Android: Yedek oluştururken kayıt klasörünü seç. Geri yüklerken yedeklerin bulunduğu klasörü seç; Notex yedekleri dosyanın içindeki gerçek oluşturulma zamanına göre listeler.</Text>}
  {button('Yedek oluştur',create)}{button('Yedekten geri yükle',pick)}
  {backupChoices.length>0&&<View style={{marginTop:16,gap:8}}><Text style={{color:colors.ink,fontWeight:'700',fontSize:17}}>Geri yüklenecek yedek</Text>{backupChoices.map((choice,index)=><Pressable key={choice.uri} accessibilityRole="button" disabled={busy||!choice.readable} onPress={()=>readSelectedAndroidBackup(choice.uri)} style={{padding:14,backgroundColor:colors.surfaceRaised,borderRadius:12,opacity:(busy||!choice.readable)?0.5:1}}><Text style={{color:colors.ink,fontWeight:'700'}}>{backupName(choice.uri)}</Text><Text style={{color:colors.muted,marginTop:4}}>{choice.readable?backupDateLabel(choice):'Yedek okunamadı'}{index===0&&choice.exportedAt!==null?' · En yeni yedek':''}</Text></Pressable>)}{button('İptal',()=>setBackupChoices([]))}</View>}
  {busy&&<View style={{marginTop:20,gap:10}}><ActivityIndicator color={colors.accent}/><Text style={{color:colors.ink}}>{label} %{percent}</Text><View style={{height:6,backgroundColor:colors.border,borderRadius:4}}><View style={{height:6,width:`${percent}%`,backgroundColor:colors.accent,borderRadius:4}}/></View></View>}
  {!!error&&<Text style={{color:colors.coral,marginTop:16}}>{error}</Text>}
  {pending&&<View style={{marginTop:24,padding:16,backgroundColor:colors.surfaceRaised,borderRadius:16,gap:12}}><Text style={{color:colors.ink,fontSize:17,fontWeight:'700'}}>Yedek bulundu</Text><Text style={{color:colors.ink}}>{pending.summary}</Text><Text style={{color:colors.muted}}>Mevcut verilere ekle: Hiçbir defterin üzerine yazılmaz, kopyalar oluşturulur.</Text>{button('Mevcut verilere ekle',restore)}{button('İptal',()=>setPending(null))}</View>}
 </ScrollView></SafeAreaView>;
}
