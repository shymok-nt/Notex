import {useMemo,useState} from 'react';
import {Alert,FlatList,Modal,Platform,Pressable,Text,TextInput,View} from 'react-native';
import {useCourseStore} from '@/store/courseStore';
import {useTheme} from '@/theme/ThemeProvider';
import type {Notebook} from '@/types/notebook';
import type {CourseDeleteMode} from '@/types/course';

type Row={key:string;kind:'all'|'unclassified'|'course'|'topic'|'note';id:string;courseId:string|null;topicId:string|null;name:string;color?:string;icon?:string;level:number;expandable?:boolean;expanded?:boolean};
type Editor={kind:'course'|'topic';id?:string;courseId?:string;name:string;color:string;icon:string};
type Deletion={kind:'course'|'topic';id:string;name:string};
const palette=['#3347D9','#1C9A8E','#3E8E5A','#F2B632','#FF6B5A','#7B5CD6'];
const icons=['📘','📚','🧪','📐','🌎','💻','🎨'];

export function CourseSidebar({notebooks,onOpenNote,onCreateNote}:{notebooks:Notebook[];onOpenNote:(id:string)=>void;onCreateNote:()=>void}){
 const {colors}=useTheme();
 const courses=useCourseStore(s=>s.courses),topics=useCourseStore(s=>s.topics),expandedIds=useCourseStore(s=>s.expandedIds);
 const selectedCourseId=useCourseStore(s=>s.selectedCourseId),selectedTopicId=useCourseStore(s=>s.selectedTopicId);
 const [editor,setEditor]=useState<Editor|null>(null),[deletion,setDeletion]=useState<Deletion|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const store=useCourseStore.getState;
 const rows=useMemo(()=>{
  const result:Row[]=[{key:'all',kind:'all',id:'all',courseId:null,topicId:null,name:'Tüm notlar',level:0}];
  result.push({key:'unclassified',kind:'unclassified',id:'unclassified',courseId:'unclassified',topicId:null,name:'Sınıflandırılmamış',level:0,expandable:true,expanded:expandedIds.includes('unclassified')});
  if(expandedIds.includes('unclassified'))for(const n of notebooks.filter(n=>n.courseId===null))
   result.push({key:'note-'+n.id,kind:'note',id:n.id,courseId:null,topicId:null,name:n.title,level:1});
  for(const c of courses){
   const expanded=expandedIds.includes('course-'+c.id);
   result.push({key:'course-'+c.id,kind:'course',id:c.id,courseId:c.id,topicId:null,name:c.name,color:c.color,icon:c.icon,level:0,expandable:true,expanded});
   if(!expanded)continue;
   for(const n of notebooks.filter(n=>n.courseId===c.id&&n.topicId===null))result.push({key:'note-'+n.id,kind:'note',id:n.id,courseId:c.id,topicId:null,name:n.title,level:1});
   for(const t of topics.filter(t=>t.courseId===c.id)){
    const isExpanded=expandedIds.includes('topic-'+t.id);
    result.push({key:'topic-'+t.id,kind:'topic',id:t.id,courseId:c.id,topicId:t.id,name:t.name,level:1,expandable:true,expanded:isExpanded});
    if(isExpanded)for(const n of notebooks.filter(n=>n.topicId===t.id))result.push({key:'note-'+n.id,kind:'note',id:n.id,courseId:c.id,topicId:t.id,name:n.title,level:2});
   }
  }
  return result;
 },[courses,topics,notebooks,expandedIds]);
 const run=async(fn:()=>Promise<unknown>)=>{
  if(busy)return;
  setBusy(true);setError('');
  try{await fn()}catch(e){
   const message=e instanceof Error?e.message:String(e);setError(message);
   if(Platform.OS==='web'&&typeof window!=='undefined')window.alert(message);else Alert.alert('İşlem başarısız',message);
  }finally{setBusy(false)}
 };
 const save=()=>{if(!editor)return;const e=editor;void run(async()=>{
  if(e.kind==='course'){
   if(e.id)await store().updateCourse(e.id,{name:e.name,color:e.color,icon:e.icon});
   else{const id=await store().addCourse(e.name,e.color,e.icon);await store().toggleExpanded('course-'+id);store().select(id)}
  }else if(e.courseId){
   if(e.id)await store().renameTopic(e.id,e.name);
   else{const id=await store().addTopic(e.courseId,e.name);await store().toggleExpanded('topic-'+id);store().select(e.courseId,id)}
  }
  setEditor(null);
 })};
 const remove=(mode:CourseDeleteMode)=>{if(!deletion)return;const d=deletion;void run(async()=>{
  if(d.kind==='course')await store().removeCourse(d.id,mode);
  else await store().removeTopic(d.id,mode);
  setDeletion(null);
 })};
 const selected=(r:Row)=>r.kind==='all'?selectedCourseId===null:r.kind==='unclassified'?selectedCourseId==='unclassified':r.kind==='course'?selectedCourseId===r.id&&selectedTopicId===null:r.kind==='topic'?selectedTopicId===r.id:false;
 const activate=(r:Row)=>{
  if(r.kind==='note'){onOpenNote(r.id);return}
  if(r.kind==='all')store().select(null);
  else if(r.kind==='unclassified')store().select('unclassified');
  else store().select(r.courseId,r.topicId);
 };
 const rowView=({item:r}:{item:Row})=><View style={{flexDirection:'row',alignItems:'center',minHeight:42,paddingLeft:8+r.level*14,paddingRight:6,backgroundColor:selected(r)?colors.surfaceRaised:'transparent'}}>
  {r.expandable?<Pressable accessibilityLabel={r.expanded?'Daralt':'Genişlet'} onPress={()=>void run(()=>store().toggleExpanded(r.kind==='unclassified'?'unclassified':r.kind+'-'+r.id))} style={{width:28,padding:5}}><Text style={{color:colors.muted}}>{r.expanded?'▾':'▸'}</Text></Pressable>:<View style={{width:28}}/>}
  <Pressable onPress={()=>activate(r)} onLongPress={()=>{if(r.kind==='course')setEditor({kind:'course',id:r.id,name:r.name,color:r.color??palette[0],icon:r.icon??icons[0]});else if(r.kind==='topic')setEditor({kind:'topic',id:r.id,courseId:r.courseId??undefined,name:r.name,color:palette[0],icon:icons[0]})}} style={{flex:1,paddingVertical:9}}>
   <Text numberOfLines={1} style={{fontSize:13,color:colors.ink,fontWeight:selected(r)?'700':'400'}}>{r.icon??(r.kind==='topic'?'📄':r.kind==='note'?'•':'')} {r.name}</Text>
  </Pressable>
  {r.kind==='course'||r.kind==='topic'?<Pressable accessibilityLabel={r.name+' işlemleri'} onPress={()=>{
   if(r.kind==='course')setEditor({kind:'course',id:r.id,name:r.name,color:r.color??palette[0],icon:r.icon??icons[0]});
   else setEditor({kind:'topic',id:r.id,courseId:r.courseId??undefined,name:r.name,color:palette[0],icon:icons[0]});
  }} style={{padding:8}}><Text style={{color:colors.muted}}>⋯</Text></Pressable>:null}
 </View>;
 return <View style={{width:248,flexShrink:0,backgroundColor:colors.surface,borderRightWidth:1,borderRightColor:colors.divider}}>
  <View style={{padding:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   <Text style={{color:colors.ink,fontWeight:'700',fontSize:16}}>Dersler</Text>
   <Pressable accessibilityLabel="Yeni ders ekle" onPress={()=>setEditor({kind:'course',name:'',color:palette[0],icon:icons[0]})}><Text style={{color:colors.accent,fontSize:19}}>＋</Text></Pressable>
  </View>
  {courses.length===0?<Text style={{paddingHorizontal:12,paddingBottom:8,color:colors.muted,fontSize:12}}>Henüz ders yok, ilk dersini ekle.</Text>:null}
  <FlatList data={rows} keyExtractor={item=>item.key} renderItem={rowView} keyboardShouldPersistTaps="handled" initialNumToRender={25}/>
  <View style={{padding:10,gap:6}}>
   {selectedCourseId!==null&&selectedCourseId!=='unclassified'&&selectedTopicId===null?<Pressable onPress={()=>setEditor({kind:'topic',courseId:selectedCourseId,name:'',color:palette[0],icon:icons[0]})}><Text style={{color:colors.accent}}>＋ Konu ekle</Text></Pressable>:null}
   <Pressable onPress={onCreateNote}><Text style={{color:colors.accent,fontWeight:'600'}}>＋ Yeni not</Text></Pressable>
  </View>
  <Modal visible={editor!==null} transparent animationType="fade" onRequestClose={()=>setEditor(null)}>
   <View style={{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:20}}>
    <View style={{backgroundColor:colors.surface,padding:18,borderRadius:16,gap:12}}>
     <Text style={{fontWeight:'700',fontSize:17,color:colors.ink}}>{editor?.kind==='course'?'Ders':'Konu'} {editor?.id?'düzenle':'ekle'}</Text>
     <TextInput accessibilityLabel="İsim" placeholder="İsim" placeholderTextColor={colors.muted} value={editor?.name??''} onChangeText={name=>setEditor(e=>e?{...e,name}:e)} style={{borderWidth:1,borderColor:colors.divider,padding:10,color:colors.ink,borderRadius:8}}/>
     {editor?.kind==='course'?<><View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{palette.map(color=><Pressable key={color} accessibilityLabel={'Renk '+color} onPress={()=>setEditor(e=>e?{...e,color}:e)} style={{width:27,height:27,backgroundColor:color,borderWidth:editor.color===color?3:0,borderColor:colors.ink,borderRadius:14}}/>)}</View>
      <View style={{flexDirection:'row',gap:7}}>{icons.map(icon=><Pressable key={icon} onPress={()=>setEditor(e=>e?{...e,icon}:e)}><Text style={{fontSize:19,opacity:editor.icon===icon?1:0.45}}>{icon}</Text></Pressable>)}</View></>:null}
     {error?<Text style={{color:colors.coral}}>{error}</Text>:null}
     <View style={{flexDirection:'row',justifyContent:'space-between'}}>
      {editor?.id?<Pressable onPress={()=>{setDeletion({kind:editor.kind,id:editor.id!,name:editor.name});setEditor(null)}}><Text style={{color:colors.coral}}>Sil</Text></Pressable>:<View/>}
      <Pressable onPress={()=>setEditor(null)}><Text style={{color:colors.ink}}>Vazgeç</Text></Pressable>
      <Pressable disabled={busy||!editor?.name.trim()} onPress={save}><Text style={{color:colors.accent}}>Kaydet</Text></Pressable>
     </View>
    </View>
   </View>
  </Modal>
  <Modal visible={deletion!==null} transparent animationType="fade" onRequestClose={()=>setDeletion(null)}>
   <View style={{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:20}}><View style={{backgroundColor:colors.surface,padding:18,borderRadius:14,gap:14}}>
    <Text style={{color:colors.ink,fontWeight:'700'}}>{deletion?.name} silinsin mi?</Text>
    <Text style={{color:colors.muted}}>Bağlı notlar ne olsun? Güvenli seçenek, Sınıflandırılmamış'a taşımaktır.</Text>
    <Pressable onPress={()=>remove('unclassify')}><Text style={{color:colors.accent,fontWeight:'700'}}>Notları Sınıflandırılmamış'a taşı</Text></Pressable>
    <Pressable onPress={()=>remove('trash')}><Text style={{color:colors.coral}}>Notları Silinenler'e taşı</Text></Pressable>
    <Pressable onPress={()=>setDeletion(null)}><Text style={{color:colors.ink}}>Vazgeç</Text></Pressable>
   </View></View>
  </Modal>
 </View>;
}
