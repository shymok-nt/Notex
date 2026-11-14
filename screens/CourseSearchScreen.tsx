import {useEffect,useMemo,useState} from 'react';
import {useFocusEffect,router} from 'expo-router';
import {useCallback} from 'react';
import {FlatList,Pressable,SafeAreaView,Text,TextInput,View} from 'react-native';
import {Search,X} from 'lucide-react-native';
import {useNotebookStore} from '@/store/notebookStore';
import {useCourseStore} from '@/store/courseStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useTheme} from '@/theme/ThemeProvider';
import {countUnsearchablePdfPages,hydrateSearchIndex,normalizeSearch,searchIndexedPages,type SearchHit} from '@/features/search/searchIndex';
import {markNotebookNavigationStart} from '@/utils/notebookOpenPerformance';
import type {Course,Topic} from '@/types/course';

type Result={key:string;kind:'page';hit:SearchHit;title:string;path:string}|{key:string;kind:'course';course:Course}|{key:string;kind:'topic';topic:Topic;course:Course};
export default function CourseSearchScreen(){
 const {colors}=useTheme();
 const notebooks=useNotebookStore(s=>s.notebooks);
 const courses=useCourseStore(s=>s.courses),topics=useCourseStore(s=>s.topics);
 const selectedCourseId=useCourseStore(s=>s.selectedCourseId);
 const recent=useSettingsStore(s=>s.recentSearches),addSearch=useSettingsStore(s=>s.addSearch),clearSearch=useSettingsStore(s=>s.clearSearches);
 const [query,setQuery]=useState(''),[debounced,setDebounced]=useState(''),[onlyCurrent,setOnlyCurrent]=useState(false);
 const [ready,setReady]=useState(false),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(query.trim()),200);return()=>clearTimeout(timer)},[query]);
 useFocusEffect(useCallback(()=>{let active=true;void hydrateSearchIndex().then(()=>{if(active){setReady(true);setRevision(v=>v+1)}}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]));
 const byCourse=new Map(courses.map(c=>[c.id,c])),byTopic=new Map(topics.map(t=>[t.id,t]));
 const metadata=useMemo(()=>new Map(notebooks.map(note=>[note.id,{
  title:note.title,courseId:note.courseId,
  courseName:note.courseId!==null?byCourse.get(note.courseId)?.name:undefined,
  topicName:note.topicId!==null?byTopic.get(note.topicId)?.name:undefined
 }])),[notebooks,courses,topics]);
 const results=useMemo<Result[]>(()=>{
  void revision;
  if(!ready||debounced==='')return [];
  const selected=onlyCurrent?(selectedCourseId==='unclassified'?null:selectedCourseId??undefined):undefined;
  const hits=searchIndexedPages(debounced,metadata,selected);
  const pages:Result[]=hits.map(hit=>{
   const note=notebooks.find(n=>n.id===hit.page.notebookId);
   return {kind:'page',key:'p-'+hit.page.pageId,hit,title:note?.title??'Not',path:[note?.courseId!=null?byCourse.get(note.courseId)?.name:'Sınıflandırılmamış',note?.topicId!=null?byTopic.get(note.topicId)?.name:undefined].filter(Boolean).join(' › ')};
  });
  const needle=normalizeSearch(debounced);
  const matchedCourses:Result[]=courses.filter(c=>normalizeSearch(c.name).includes(needle)&&(!onlyCurrent||selectedCourseId===null||selectedCourseId===c.id)).map(course=>({kind:'course',key:'c-'+course.id,course}));
  const matchedTopics:Result[]=topics.filter(t=>normalizeSearch(t.name).includes(needle)&&(!onlyCurrent||selectedCourseId===null||selectedCourseId===t.courseId)).flatMap(topic=>{
   const course=byCourse.get(topic.courseId);return course?[{kind:'topic' as const,key:'t-'+topic.id,topic,course}]:[]
  });
  return [...matchedCourses,...matchedTopics,...pages];
 },[ready,revision,debounced,metadata,notebooks,courses,topics,onlyCurrent,selectedCourseId]);
 const open=(item:Result)=>{
  void addSearch(query).catch(()=>{});
  if(item.kind==='course'){useCourseStore.getState().select(item.course.id);router.navigate('/(tabs)/notebooks');return}
  if(item.kind==='topic'){useCourseStore.getState().select(item.course.id,item.topic.id);router.navigate('/(tabs)/notebooks');return}
  markNotebookNavigationStart(item.hit.page.notebookId);
  router.push({pathname:'/note/[id]',params:{id:item.hit.page.notebookId,pageId:item.hit.page.pageId}});
 };
 const textStyle={color:colors.ink};
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
  <View style={{padding:18,borderBottomWidth:1,borderBottomColor:colors.divider,gap:12}}>
   <Text style={{fontSize:26,fontWeight:'700',color:colors.ink}}>Ara</Text>
   <View style={{flexDirection:'row',alignItems:'center',borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:12}}>
    <Search size={19} color={colors.muted}/>
    <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Not, ders, konu veya PDF metni ara" placeholderTextColor={colors.muted} accessibilityLabel="Notlarda ara" style={{flex:1,minHeight:49,color:colors.ink,fontSize:15,paddingHorizontal:10}}/>
    {query!==''?<Pressable onPress={()=>setQuery('')}><X size={19} color={colors.ink}/></Pressable>:null}
   </View>
   <Pressable onPress={()=>setOnlyCurrent(v=>!v)} style={{flexDirection:'row',alignItems:'center',gap:8}}>
    <Text style={{color:colors.accent}}>{onlyCurrent?'☑':'□'}</Text><Text style={textStyle}>Yalnızca seçili derste ara</Text>
   </Pressable>
   {ready&&countUnsearchablePdfPages()>0?<Text style={{color:colors.muted,fontSize:12}}>Metin katmanı bulunmayan {countUnsearchablePdfPages()} PDF sayfası metin aramasına dahil edilmiyor.</Text>:null}
  </View>
  {error!==null?<Text style={{color:colors.coral,padding:20}}>Arama dizini yüklenemedi: {error}</Text>:null}
  {!ready&&!error?<Text style={{color:colors.muted,padding:20}}>Arama dizini hazırlanıyor…</Text>:null}
  {debounced===''&&recent.length>0?<View style={{padding:18,gap:8}}><Pressable onPress={()=>void clearSearch()}><Text style={{color:colors.accent}}>Son aramaları temizle</Text></Pressable>{recent.slice(0,8).map(item=><Pressable key={item} onPress={()=>setQuery(item)}><Text style={textStyle}>{item}</Text></Pressable>)}</View>:null}
  <FlatList data={results} keyExtractor={item=>item.key} keyboardShouldPersistTaps="handled" initialNumToRender={24} maxToRenderPerBatch={25} windowSize={7}
   contentContainerStyle={{paddingHorizontal:18,paddingBottom:80}}
   ListHeaderComponent={debounced!==''?<Text style={{color:colors.muted,paddingVertical:12}}>{results.length} sonuç</Text>:null}
   ListEmptyComponent={ready&&debounced!==''?<Text style={{color:colors.muted,paddingTop:40,textAlign:'center'}}>Sonuç bulunamadı</Text>:null}
   renderItem={({item})=><Pressable onPress={()=>open(item)} style={{paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors.divider,gap:3}}>
    {item.kind==='page'?<>
     <Text style={{fontSize:15,fontWeight:'700',color:colors.ink}}>{item.title} · Sayfa {item.hit.page.position+1}</Text>
     <Text style={{color:colors.muted,fontSize:12}}>{item.path}{item.hit.source==='pdf'?' · PDF':''}</Text>
     <Text numberOfLines={2} style={{color:colors.ink,fontSize:13}}>{item.hit.before}<Text style={{fontWeight:'700',color:colors.accent}}>{item.hit.match}</Text>{item.hit.after}</Text>
    </>:item.kind==='course'?<><Text style={{fontWeight:'700',color:colors.ink}}>📘 {item.course.name}</Text><Text style={{color:colors.muted,fontSize:12}}>Ders</Text></>:<><Text style={{fontWeight:'700',color:colors.ink}}>{item.topic.name}</Text><Text style={{color:colors.muted,fontSize:12}}>{item.course.name} › Konu</Text></>}
   </Pressable>}
  />
 </SafeAreaView>;
}
