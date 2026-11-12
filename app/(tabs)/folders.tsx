import { useState } from 'react';
import { Alert,Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { FolderRow } from '@/components/FolderRow';
import { FolderEditorSheet } from '@/components/FolderEditorSheet';
import { folderRepository,type Folder } from '@/db/repositories/folderRepository';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';
export default function FoldersScreen(){
 const {colors,scheme}=useTheme(),folders=useNotebookStore(s=>s.folders),notebooks=useNotebookStore(s=>s.notebooks),refresh=useNotebookStore(s=>s.refreshFolders);
 const [edit,setEdit]=useState(false),[target,setTarget]=useState<Folder|null>(null),[sheet,setSheet]=useState(false);
 const openEditor=(folder:Folder|null)=>{setTarget(folder);setSheet(true)};
 const save=async(name:string)=>{if(target)await folderRepository.rename(target.id,name);else await folderRepository.create(name);await refresh()};
 const erase=(folder:Folder)=>Alert.alert('Klasörü sil','Bu klasör silinecek. İçindeki defterler silinmez, Klasörsüz\'e taşınır.',[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{try{await folderRepository.remove(folder.id);await refresh()}catch(e){Alert.alert('Hata','Klasör silinemedi')}}}]);
 const options=(folder:Folder)=>Alert.alert(folder.name,'Klasör işlemleri',[{text:'Yeniden adlandır',onPress:()=>openEditor(folder)},{text:'Sil',style:'destructive',onPress:()=>erase(folder)},{text:'Vazgeç',style:'cancel'}]);
 const shift=async(index:number,delta:number)=>{const ids=folders.map(f=>f.id),next=index+delta;if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];try{await folderRepository.reorder(ids);await refresh()}catch{Alert.alert('Hata','Sıralama kaydedilemedi')}};
 return <SafeAreaView style={{flex:1,backgroundColor:scheme==='light'?'#FFFFFF':colors.background}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:18}}><Text style={{fontSize:30,fontWeight:'700',color:colors.ink}}>Klasörler</Text><View style={{flexDirection:'row'}}><Pressable accessibilityRole="button" accessibilityLabel={edit?'Bitti':'Düzenle'} onPress={()=>setEdit(!edit)} style={{minWidth:64,height:44,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.accent}}>{edit?'Bitti':'Düzenle'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Yeni klasör" onPress={()=>openEditor(null)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Plus color={colors.accent}/></Pressable></View></View>
 <ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:100}}>
 <FolderRow name="Tüm defterler" count={notebooks.length} notebooks={notebooks} onPress={()=>router.push({pathname:'/folder/[id]',params:{id:'all'}})}/>
 <FolderRow name="Klasörsüz" count={notebooks.filter(n=>!n.folderId).length} notebooks={notebooks.filter(n=>!n.folderId)} onPress={()=>router.push({pathname:'/folder/[id]',params:{id:'none'}})}/>
 {folders.map((f,i)=>{const items=notebooks.filter(n=>n.folderId===f.id);return <FolderRow key={f.id} name={f.name} count={items.length} notebooks={items} onPress={()=>router.push({pathname:'/folder/[id]',params:{id:f.id}})} onOptions={edit?undefined:()=>options(f)} onUp={edit&&i>0?()=>void shift(i,-1):undefined} onDown={edit&&i<folders.length-1?()=>void shift(i,1):undefined}/>})}
 {!folders.length&&<View style={{padding:24,alignItems:'center',gap:16}}><Text style={{color:colors.muted}}>Henüz klasör yok</Text><Pressable accessibilityRole="button" accessibilityLabel="Klasör oluştur" onPress={()=>openEditor(null)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>Klasör oluştur</Text></Pressable></View>}
 </ScrollView><FolderEditorSheet key={target?.id??'new'} visible={sheet} initialName={target?.name??''} onClose={()=>setSheet(false)} onSave={save}/></SafeAreaView>
}
