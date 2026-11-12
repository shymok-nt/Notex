import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,BackHandler,Modal,Pressable,ScrollView,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {Circle,Square,Triangle,ArrowRight,WandSparkles,ArrowLeft,Undo2,Redo2,Ellipsis,Eye,Palette,ChevronLeft,ChevronRight,X,Move,RotateCw,Maximize2,Copy,Trash2,Minus,Plus} from 'lucide-react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/fonts';
import {useNotebookStore} from '@/store/notebookStore';
import {notebookRepository} from '@/db/repositories/notebookRepository';
import {usePageStore} from '@/store/pageStore';
import {settingsRepository} from '@/db/repositories/settingsRepository';
import {DrawingCanvas,type Tool,type Brush} from './DrawingCanvas';
import {CanvasToolbar} from './CanvasToolbar';
import {CanvasPageStrip} from './CanvasPageStrip';
import {parseContent} from '@/features/canvas/engine/content';
import {useAutosave} from '@/features/canvas/hooks/useAutosave';
import {visibleSaveStatus} from '@/features/canvas/engine/autosavePolicy';
import {record,undo,redo,historyState} from '@/features/canvas/store/history';
import type {PageContent,ShapeMode} from '@/features/canvas/types';
import type {Page} from '@/types/page';
import type {PageTemplate} from '@/types/notebook';
import {useCanvasAwake} from '@/features/canvas/hooks/useCanvasAwake';
import {perfNow} from '@/features/canvas/engine/performance';
import {consumeNotebookNavigationStart} from '@/utils/notebookOpenPerformance';
const defaultTextStyle={fontSize:48,color:'#1B1B2F',bold:false,align:'left' as 'left'|'center'|'right'};
const templates:PageTemplate[]=['boş','çizgili','kareli','noktalı'];
const swatches=['#1B1B2F','#3347D9','#FF6B5A','#3E8E5A','#F2B632','#7B5CD6','#FF8BBD','#16A6B6','#FFFFFF','#6D6D6D','#F48C35','#7947AB','#000000','#1D4ED8','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#94A3B8','#78350F','#A3E635','#F97316'];
type PenTool='pen'|'highlighter';
type Preset={id:string;tool:PenTool;color:string;width:number;opacity:number};
const defaults:Preset[]=[{id:'thin-black',tool:'pen',color:'#1B1B2F',width:2,opacity:1},{id:'medium-blue',tool:'pen',color:'#3347D9',width:5,opacity:1},{id:'thick-red',tool:'pen',color:'#EF4444',width:10,opacity:1}];
const validHex=(s:string)=>/^#[0-9a-fA-F]{6}$/.test(s);
const parsePresets=(raw:string|null):Preset[]=>{if(!raw)return defaults;try{const a:unknown=JSON.parse(raw);if(!Array.isArray(a)||a.length>6||!a.every(p=>p&&typeof p.id==='string'&&(p.tool==='pen'||p.tool==='highlighter')&&typeof p.color==='string'&&validHex(p.color)&&typeof p.width==='number'&&p.width>=1&&p.width<=32&&typeof p.opacity==='number'&&p.opacity>0&&p.opacity<=1))return defaults;return a as Preset[]}catch{return defaults}};
const shade=(hex:string,amount:number)=>{const n=parseInt(hex.slice(1),16);return '#'+[16,8,0].map(shift=>{const c=(n>>shift)&255;return Math.max(0,Math.min(255,Math.round(amount>=0?c+(255-c)*amount:c*(1+amount)))).toString(16).padStart(2,'0')}).join('').toUpperCase()};
const hit={width:48,height:56,alignItems:'center' as const,justifyContent:'center' as const};
type CanvasController={back:()=>void;forward:()=>void;flush:()=>Promise<void>;canUndo:boolean;canRedo:boolean;error:boolean;saving:boolean;retry:()=>Promise<void>};
export default function NoteCanvasScreen(){
 const {colors,scheme}=useTheme();const {id,pageId}=useLocalSearchParams<{id:string;pageId?:string}>();const {width,height}=useWindowDimensions();const tablet=width>=600||width>height;
 const notebook=useNotebookStore(s=>s.notebooks.find(n=>n.id===id));
 const notebookExists=useNotebookStore(s=>s.notebooks.some(n=>n.id===id));
 const pages=usePageStore(s=>s.pages),pageStoreNotebookId=usePageStore(s=>s.notebookId),pagesLoading=usePageStore(s=>s.loading),load=usePageStore(s=>s.load),add=usePageStore(s=>s.add),remove=usePageStore(s=>s.remove),move=usePageStore(s=>s.move),changeTemplate=usePageStore(s=>s.updateTemplate),duplicateMany=usePageStore(s=>s.duplicateMany),removeMany=usePageStore(s=>s.removeMany),restoreMany=usePageStore(s=>s.restoreMany);
 const [readyNotebookId,setReadyNotebookId]=useState<string|null>(null);
 const [multiSelect,setMultiSelect]=useState(false),[selectedPageIds,setSelectedPageIds]=useState<string[]>([]),[pendingDelete,setPendingDelete]=useState<Page[]|null>(null);
 const deleteTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null),[tool,setTool]=useState<Tool>('pen'),[brush,setBrush]=useState<Brush>({color:'#1B1B2F',width:5,opacity:1});
 const [templatePageId,setTemplatePageId]=useState<string|null>(null);
 const [moreOpen,setMoreOpen]=useState(false);const [panel,setPanel]=useState<'tool'|'palette'|null>(null),[sheet,setSheet]=useState(false),[focus,setFocus]=useState(false),[eraserSize,setEraserSize]=useState(24),[eraserMode,setEraserMode]=useState<'pixel'|'stroke'>('pixel');
 const [controller,setController]=useState<CanvasController|null>(null);
 const [imageRequest,setImageRequest]=useState<{uri:string;width:number;height:number;version:number}|null>(null);
 const [selectedImageId,setSelectedImageId]=useState<string|null>(null);
 const [imageAction,setImageAction]=useState<{kind:'grow'|'shrink'|'delete';version:number}>();
 const editImage=(kind:'grow'|'shrink'|'delete')=>setImageAction({kind,version:Date.now()});
 const [shapeKind,setShapeKind]=useState<ShapeMode>('auto'),[shapeFill,setShapeFill]=useState(false),[ruler,setRuler]=useState(false);
 const [selectedText,setSelectedText]=useState(false);
 const [selectedElements,setSelectedElements]=useState<string[]>([]),[selectionAction,setSelectionAction]=useState<{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color'|'textStyle'|'toggleBeautify';value?:number;color?:string;textStyle?:Partial<{fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right'}>;version:number}>();
 const action=(kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color'|'textStyle'|'toggleBeautify',value?:number,color?:string,textStyle?:Partial<typeof defaultTextStyle>)=>setSelectionAction({kind,value,color,textStyle,version:Date.now()});
 const [recent,setRecent]=useState<string[]>([]);
 const [presets,setPresets]=useState<Preset[]>(defaults);
 const [hexInput,setHexInput]=useState('#1B1B2F');
 const [brightness,setBrightness]=useState(0);
 const [presetReady,setPresetReady]=useState(false);
 const [lastBrushes,setLastBrushes]=useState<Record<PenTool,Brush>>({pen:{color:'#1B1B2F',width:5,opacity:1},highlighter:{color:'#F2B632',width:5,opacity:0.35}});
 const loaded=useRef(false),recentRef=useRef<string[]>([]),recentTimer=useRef<ReturnType<typeof setTimeout>|null>(null),brushesRef=useRef(lastBrushes);
 const recordStroke=(_kind:PenTool,color:string)=>{if(!validHex(color))return;const c=color.toUpperCase();const next=[c,...recentRef.current.filter(v=>v.toUpperCase()!==c)].slice(0,8);recentRef.current=next;if(recentTimer.current)clearTimeout(recentTimer.current);recentTimer.current=setTimeout(()=>{setRecent(next);void settingsRepository.set('recentColors',JSON.stringify(next)).catch(()=>{})},900)};
 useEffect(()=>{let live=true;void Promise.all([settingsRepository.get('penPresets'),settingsRepository.get('recentColors'),settingsRepository.get('lastBrushes')]).then(([rawPresets,rawRecent,rawBrushes])=>{if(!live)return;setPresets(parsePresets(rawPresets));try{const a:unknown=JSON.parse(rawRecent??'[]');if(Array.isArray(a)){const colors=[...new Set(a.filter((v):v is string=>typeof v==='string'&&validHex(v)).map(v=>v.toUpperCase()))].slice(0,8);recentRef.current=colors;setRecent(colors)}}catch{}try{const a=JSON.parse(rawBrushes??'{}') as Record<PenTool,Brush>;if(a.pen&&a.highlighter&&[a.pen,a.highlighter].every(b=>validHex(b.color)&&Number.isFinite(b.width)&&b.width>=1&&b.width<=32&&Number.isFinite(b.opacity)&&b.opacity>0&&b.opacity<=1)){brushesRef.current=a;setLastBrushes(a);setBrush(a.pen)}}catch{}loaded.current=true;setPresetReady(true)}).catch(()=>{loaded.current=true;setPresetReady(true)});return()=>{live=false;if(recentTimer.current)clearTimeout(recentTimer.current)}},[]);
 useEffect(()=>{if(presetReady)void settingsRepository.set('penPresets',JSON.stringify(presets)).catch(()=>{})},[presets,presetReady]);
 const currentPreset=()=>({tool:tool==='highlighter'?'highlighter' as const:'pen' as const,...brush});
 const savePreset=(id?:string)=>{const item={id:id??Crypto.randomUUID(),...currentPreset()};if(id)setPresets(p=>p.map(v=>v.id===id?item:v));else if(presets.length>=6)Alert.alert('Hazır ayarlar','En fazla 6 hazır ayar eklenebilir.');else setPresets(p=>[...p,item])};
 const applyPreset=(item:Preset)=>{setTool(item.tool);setBrush({color:item.color,width:item.width,opacity:item.opacity})};
 const presetMenu=(item:Preset)=>Alert.alert('Hazır ayar','İşlem seç',[{text:'Mevcut ayarı buraya kaydet',onPress:()=>savePreset(item.id)},{text:'Sil',style:'destructive',onPress:()=>setPresets(p=>p.filter(v=>v.id!==item.id))},{text:'Vazgeç',style:'cancel'}]);
 const [textStyle,setTextStyle]=useState(defaultTextStyle);
 const controllerRef=useRef<CanvasController|null>(null);controllerRef.current=controller;
 useEffect(()=>{let active=true;if(id){const started=__DEV__?perfNow():0,navigationStartedAt=consumeNotebookNavigationStart(id);if(__DEV__&&navigationStartedAt!==undefined)console.log('[Notex perf] navigation_to_editor_mount',{duration_ms:Math.round((started-navigationStartedAt)*10)/10});setReadyNotebookId(null);setSelectedId(null);const lookupStarted=__DEV__?perfNow():0;const notebookLookup=notebookExists?Promise.resolve({row:true,duration_ms:0}):notebookRepository.getById(id).then(row=>({row:!!row,duration_ms:__DEV__?perfNow()-lookupStarted:0}));const pagesStarted=__DEV__?perfNow():0;const pageLoad=load(id).then(()=>__DEV__?perfNow()-pagesStarted:0);void Promise.all([notebookLookup,pageLoad]).then(([lookup,pageLoadMs])=>{if(!active)return;if(!lookup.row){router.replace('/(tabs)');return;}const loadedPages=usePageStore.getState().pages;const requestedPage=typeof pageId==='string'?loadedPages.find(page=>page.id===pageId):undefined;setSelectedId(requestedPage?.id??loadedPages[0]?.id??null);setReadyNotebookId(id);if(__DEV__)console.log('[Notex perf] notebook_open_data_ready',{duration_ms:Math.round((perfNow()-started)*10)/10,notebook_query_ms:Math.round(lookup.duration_ms*10)/10,page_load_ms:Math.round(pageLoadMs*10)/10,page_count:loadedPages.length})}).catch(error=>{console.error('Defter açılamadı',error);if(active)router.replace('/(tabs)')})}return()=>{active=false}},[id,pageId,load,notebookExists]);
 useEffect(()=>{let live=true;void settingsRepository.get('canvasToolSettings').then(raw=>{if(!raw||!live)return;try{const s=JSON.parse(raw) as {tool?:Tool;brush?:Brush;recent?:string[];eraserMode?:'pixel'|'stroke';eraserSize?:number;textStyle?:typeof textStyle};if(s.tool&&['pen','highlighter','eraser','hand'].includes(s.tool))setTool(s.tool);if(s.brush&&typeof s.brush.color==='string'&&typeof s.brush.width==='number'&&typeof s.brush.opacity==='number')setBrush(s.brush);if(s.eraserMode==='pixel'||s.eraserMode==='stroke')setEraserMode(s.eraserMode);if(typeof s.eraserSize==='number')setEraserSize(s.eraserSize);if(s.textStyle&&typeof s.textStyle.fontSize==='number')setTextStyle(s.textStyle)}catch{}}).catch(()=>{});return()=>{live=false}},[]);
 useEffect(()=>{void settingsRepository.set('canvasToolSettings',JSON.stringify({tool,brush,eraserMode,eraserSize,textStyle})).catch(()=>{})},[tool,brush,recent,eraserMode,eraserSize,textStyle]);
 const pagesReady=readyNotebookId===id&&pageStoreNotebookId===id&&!pagesLoading;const selected=pagesReady?pages.find(p=>p.id===selectedId):undefined;const index=selected?pages.findIndex(p=>p.id===selected.id):0;
 const loadingStartedAt=useRef(__DEV__?perfNow():0);
 const loadingRemovalLogged=useRef(false);
 useEffect(()=>{loadingRemovalLogged.current=false;if(__DEV__)loadingStartedAt.current=perfNow()},[id,pageId]);
 useEffect(()=>{if(!pagesReady||!__DEV__||loadingRemovalLogged.current)return;loadingRemovalLogged.current=true;console.log('[Notex perf] loading_overlay_removed',{duration_ms:Math.round((perfNow()-loadingStartedAt.current)*10)/10,page_ready:!!selected,page_count:pages.length})},[id,pagesReady,selected?.id,pages.length]);
 const select=(pageId:string)=>{if(pageId===selected?.id)return;void controllerRef.current?.flush();setImageRequest(null);setSelectedImageId(null);setSelectedId(pageId);setController(null);setPanel(null);setSheet(false)};
 const addPage=async()=>{await controllerRef.current?.flush();const count=pages.length;await add(index);const next=usePageStore.getState().pages;if(next.length>count)select(next[Math.min(index+1,next.length-1)].id)};
 const askRemove=(pageId:string)=>{if(pages.length<=1){Alert.alert('Son sayfa','Defterin son sayfası silinemez.');return}Alert.alert('Sayfayı sil','Bu sayfa silinsin mi?',[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{await controllerRef.current?.flush();await remove(pageId);const next=usePageStore.getState().pages;if(pageId===selected?.id&&next.length)setSelectedId(next[Math.min(index,next.length-1)].id)}}])};
 const chooseTemplate=(pageId:string)=>{setTemplatePageId(pageId);};
 const duplicatePages=async(ids:string[])=>{await controllerRef.current?.flush();const created=await duplicateMany(ids);if(created.length===1)select(created[0]);setMultiSelect(false);setSelectedPageIds([])};
 const finalizeDelete=()=>{if(deleteTimer.current)clearTimeout(deleteTimer.current);deleteTimer.current=null;setPendingDelete(null)};
 const deletePages=async(ids:string[])=>{
  if(ids.length>=pages.length){Alert.alert('Silinemedi','Defterde en az bir sayfa olmalı');return}
  await controllerRef.current?.flush();
  finalizeDelete();
  const removed=await removeMany(ids);
  if(!removed.length)return;
  const next=usePageStore.getState().pages;
  if(!next.some(p=>p.id===selected?.id))setSelectedId(next[Math.min(index,next.length-1)]?.id??null);
  setPendingDelete(removed);setMultiSelect(false);setSelectedPageIds([]);
  deleteTimer.current=setTimeout(()=>{setPendingDelete(null);deleteTimer.current=null},5000);
 };
 const confirmDelete=(ids:string[])=>{
  if(ids.length>=pages.length){Alert.alert('Silinemedi','Defterde en az bir sayfa olmalı');return}
  Alert.alert('Sayfaları sil',`${ids.length} sayfa silinsin mi?`,[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:()=>void deletePages(ids)}]);
 };
 const undoDelete=async()=>{const saved=pendingDelete;if(!saved)return;finalizeDelete();try{await restoreMany(saved)}catch(error){Alert.alert('Geri alınamadı',error instanceof Error?error.message:'Tekrar dene')}};
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')finalizeDelete()});return()=>{sub.remove();if(deleteTimer.current)clearTimeout(deleteTimer.current)}},[]);
 const pageActions=(pageId:string)=>Alert.alert('Sayfa işlemleri','İşlem seç',[{text:'Şablon',onPress:()=>chooseTemplate(pageId)},{text:'Çoğalt',onPress:()=>void duplicatePages([pageId])},{text:'Sil',style:'destructive',onPress:()=>confirmDelete([pageId])},{text:'Vazgeç',style:'cancel'}]);
 const togglePage=(pageId:string)=>setSelectedPageIds(current=>current.includes(pageId)?current.filter(id=>id!==pageId):[...current,pageId]);
 const moveSelected=async(toEnd:boolean)=>{await controllerRef.current?.flush();const ids=pages.filter(p=>selectedPageIds.includes(p.id)).map(p=>p.id);for(const id of (toEnd?ids:[...ids].reverse()))await move(id,toEnd?pages.length-1:0);setMultiSelect(false);setSelectedPageIds([])};
 const pageStripProps={pages,selectedId:selected?.id,colors,onSelect:select,onAdd:()=>void addPage(),onMove:(p:string,i:number)=>void move(p,i),onActions:pageActions,multiSelect,selectedPageIds,onToggle:togglePage,onEnterSelection:(pageId:string)=>{setMultiSelect(true);setSelectedPageIds([pageId])}};
 const selectionBar=multiSelect?<View style={{paddingHorizontal:10,paddingVertical:10,gap:10,backgroundColor:colors.surfaceRaised,borderBottomWidth:1,borderColor:colors.divider}}>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
 <View style={{flex:1,gap:3}}><Text style={{color:colors.ink,fontFamily:fonts.semibold,fontSize:14}}>Sayfaları düzenle</Text><Text style={{color:colors.muted,fontSize:12}}>{selectedPageIds.length} seçili · Sayfalara dokunarak seçimi değiştir</Text></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Seçimi bitir" onPress={()=>{setMultiSelect(false);setSelectedPageIds([])}} style={{width:34,height:34,borderRadius:17,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'}}><X size={18} color={colors.ink}/></Pressable></View>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{([{label:'Sil',action:()=>confirmDelete(selectedPageIds),danger:true},{label:'Çoğalt',action:()=>void duplicatePages(selectedPageIds)},{label:'Başa taşı',action:()=>void moveSelected(false)},{label:'Sona taşı',action:()=>void moveSelected(true)}]).map(item=><Pressable key={item.label} accessibilityRole="button" disabled={!selectedPageIds.length} onPress={item.action} style={{paddingHorizontal:11,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:item.danger?colors.coral+'55':colors.border,backgroundColor:item.danger?colors.coral+'14':colors.background,opacity:selectedPageIds.length?1:0.4}}><Text style={{color:item.danger?colors.coral:colors.ink,fontSize:12,fontFamily:fonts.semibold}}>{item.label}</Text></Pressable>)}</View></View>:null;

 const more=()=>{setPanel(null);setMoreOpen(true);};
 const moreItems=[
  {label:'Şablonu değiştir',onPress:()=>selected&&chooseTemplate(selected.id)},
  {label:'Sayfa ekle',onPress:()=>void addPage()},
  {label:'Sayfalar',onPress:()=>setSheet(true)},
  {label:'Cetvel aç/kapat',onPress:()=>setRuler(v=>!v)},
  {label:'Odak modu',onPress:()=>setFocus(v=>!v)},
  {label:'Defteri düzenle',onPress:()=>router.push({pathname:'/notebook-editor',params:{id}})}
 ];

 const insertImage=async()=>{
  if(!selected)return;
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.65,base64:true});
   if(result.canceled||!result.assets[0])return;
   const asset=result.assets[0];
   if(!asset.base64){Alert.alert('Resim eklenemedi','Resim verisi okunamadı.');return;}
   const mime=asset.mimeType==='image/png'?'image/png':'image/jpeg';
   const ratio=Math.max(0.1,(asset.width||1)/(asset.height||1));
   const w=Math.min(650,Math.max(150,ratio*450));const h=w/ratio;
   setImageRequest({uri:`data:${mime};base64,${asset.base64}`,width:w,height:h,version:Date.now()});
  }catch{Alert.alert('Resim eklenemedi','Galeriden resim seçilirken bir hata oluştu.');}
 };
 const chooseTool=(t:Tool)=>{if((t==='pen'||t==='highlighter')&&t!==tool)setBrush(brushesRef.current[t]);if(tool===t)setPanel(p=>p==='tool'?null:'tool');else{setTool(t);setPanel(null)}};
 const chooseColor=(color:string)=>{if(tool==='text'||selectedText){setTextStyle(v=>({...v,color}));if(selectedText)action('textStyle',undefined,undefined,{color})}else setBrush(b=>({...b,color}));};
 useEffect(()=>{if(tool!=='pen'&&tool!=='highlighter')return;const next={...brushesRef.current,[tool]:brush};brushesRef.current=next;setLastBrushes(next);if(!loaded.current)return;const timer=setTimeout(()=>{void settingsRepository.set('lastBrushes',JSON.stringify(next)).catch(()=>{})},700);return()=>clearTimeout(timer)},[tool,brush]);
 const ink=colors.ink,muted=colors.muted;const backdrop=scheme==='dark'?'#0B0B10':'#EEE9DF';
 const control=(name:string,Icon:typeof ArrowLeft,onPress:()=>void,disabled=false)=> <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{disabled}} disabled={disabled} hitSlop={4} onPress={onPress} style={[hit,{opacity:disabled?0.35:1}]}><Icon size={22} color={ink}/></Pressable>;
 const legacyInkViewControl=tool==='select'&&selectedElements.length>0?<Pressable accessibilityRole="button" accessibilityLabel="Eski görünüm ile özgün çizgiler arasında geçiş yap" onPress={()=>action('toggleBeautify')} style={{position:'absolute',bottom:tablet?24:100,left:12,right:12,zIndex:40,alignItems:'center',padding:10,borderRadius:12,backgroundColor:colors.surfaceRaised}}><Text style={{color:ink,fontSize:12}}>Kayıtlı görünüm / özgün çizgiler</Text></Pressable>:null;
  const selectedDeleteButton=tool!=='pen'&&tool!=='highlighter'&&(selectedImageId||selectedElements.length>0)?<Pressable accessibilityRole="button" accessibilityLabel={selectedImageId?'Seçili resmi sil':'Seçili şekilleri sil'} onPress={()=>{if(selectedImageId)editImage('delete');else action('delete');}} hitSlop={10} style={{width:48,height:48,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.coral+'16',marginHorizontal:4}}><Trash2 size={25} strokeWidth={2.2} color={colors.coral}/></Pressable>:null;
 const undoButton=control('Geri al',Undo2,()=>controllerRef.current?.back(),!controller?.canUndo);
 const redoButton=control('Yinele',Redo2,()=>controllerRef.current?.forward(),!controller?.canRedo);
 const saveStatus=visibleSaveStatus(!!controller?.error,!!controller?.saving);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
  if(templatePageId!==null){setTemplatePageId(null);return true}
  if(moreOpen){setMoreOpen(false);return true}
  if(sheet){if(multiSelect){setMultiSelect(false);setSelectedPageIds([])}else setSheet(false);return true}
  if(multiSelect){setMultiSelect(false);setSelectedPageIds([]);return true}
  if(panel){setPanel(null);return true}
  if(focus){setFocus(false);return true}
  return false;
 });return()=>sub.remove()},[templatePageId,moreOpen,sheet,multiSelect,panel,focus]);
 const goBack=()=>{
  finalizeDelete();
  // The header must navigate immediately on desktop too: waiting for a
  // pending autosave can leave the arrow apparently unresponsive.
  void controllerRef.current?.flush().catch(error=>console.error('Canvas save before navigation failed:',error));
  router.replace('/(tabs)');
 };
 const heading=<View style={{flexDirection:'row',alignItems:'center',minWidth:0,flex:tablet?0:1,width:tablet?220:undefined,zIndex:10}}>
 {control('Geri dön',ArrowLeft,goBack)}
 <View style={{flex:1,minWidth:0,justifyContent:'center',minHeight:56}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Defteri düzenle" onPress={()=>router.push({pathname:'/notebook-editor',params:{id}})}>
 <Text numberOfLines={1} style={{fontFamily:fonts.heading,fontSize:17,color:ink}}>{notebook?.title??'Defter'}</Text></Pressable>
 <View style={{flexDirection:'row',alignItems:'center',minWidth:0}}>
 <Text numberOfLines={1} style={{fontFamily:fonts.body,fontSize:12,color:muted}}>{`Sayfa ${pages.length?index+1:0} / ${pages.length}`}</Text>
 {saveStatus==='error'&&<Pressable accessibilityRole="button" accessibilityLabel="Kaydetmeyi tekrar dene" onPress={()=>{void controllerRef.current?.retry().catch(()=>{})}}><Text numberOfLines={1} style={{fontFamily:fonts.body,fontSize:12,color:colors.coral}}> · Kaydedilemedi, tekrar dene</Text></Pressable>}
 {saveStatus==='saving'&&<Text numberOfLines={1} style={{fontFamily:fonts.body,fontSize:12,color:muted}}> · Kaydediliyor…</Text>}
 </View></View></View>;
 const presetPanel=<View style={{gap:6}}><Text style={{color:ink,fontFamily:fonts.semibold}}>Hazır ayarlar</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{presets.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel="Hazır ayarı uygula" onPress={()=>applyPreset(item)} onLongPress={()=>presetMenu(item)} style={{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceRaised,alignItems:'center',justifyContent:'center'}}><View style={{width:Math.min(24,7+item.width),height:Math.min(24,7+item.width),borderRadius:20,backgroundColor:item.color,opacity:item.opacity}}/></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Hazır ayar ekle" onPress={()=>savePreset()} style={{width:36,height:36,alignItems:'center',justifyContent:'center'}}><Plus size={22} color={colors.accent}/></Pressable></View></View>;
 const palette=<View style={{gap:10}}><Text style={{fontFamily:fonts.semibold,color:ink}}>Renkler</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>{swatches.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={color+' renk'} accessibilityState={{selected:(tool==='text'||selectedText?textStyle.color:brush.color)===color}} onPress={()=>chooseColor(color)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:color,borderWidth:(tool==='text'?textStyle.color:brush.color)===color?3:1,borderColor:(tool==='text'?textStyle.color:brush.color)===color?colors.accent:colors.border}}/></Pressable>)}</View><View style={{gap:6}}><Text style={{color:ink}}>Özel renk (HEX)</Text><TextInput value={hexInput} onChangeText={v=>{setHexInput(v);if(validHex(v))chooseColor(v.toUpperCase())}} maxLength={7} autoCapitalize="characters" placeholder="#RRGGBB" placeholderTextColor={muted} style={{color:ink,borderColor:colors.border,borderWidth:1,borderRadius:8,padding:8}}/><Text style={{color:muted}}>Ton / parlaklık: {brightness}</Text><View style={{flexDirection:'row',gap:6}}>{[-0.5,-0.25,0,0.25,0.5].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={`Parlaklık ${n}`} onPress={()=>{setBrightness(n*100);if(validHex(hexInput))chooseColor(shade(hexInput,n))}} style={{width:40,height:40,borderRadius:8,backgroundColor:validHex(hexInput)?shade(hexInput,n):colors.surface,borderWidth:1,borderColor:colors.border}}/>)}</View></View>{recent.length>0&&<><Text style={{color:muted}}>Son kullanılanlar</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{recent.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={color+' son kullanılan renk'} onPress={()=>chooseColor(color)} style={hit}><View style={{width:30,height:30,borderRadius:15,backgroundColor:color,borderWidth:1,borderColor:colors.border}}/></Pressable>)}</View></>}</View>;
 const sizeSlider=(value:number,min:number,max:number,onValue:(n:number)=>void,label:string)=>{const width=260;const change=(x:number)=>onValue(Math.round(min+Math.max(0,Math.min(width,x))/width*(max-min)));return <View style={{gap:5,paddingTop:4,paddingBottom:13}}><Text style={{color:muted}}>{label}: {value}</Text><View accessibilityRole="adjustable" accessibilityLabel={label} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>change(e.nativeEvent.locationX)} onResponderMove={e=>change(e.nativeEvent.locationX)} style={{width,height:36,justifyContent:'center',marginTop:-4}}><View style={{height:6,borderRadius:6,backgroundColor:colors.border}}/><View pointerEvents="none" style={{position:'absolute',left:0,width:width*(value-min)/(max-min),height:6,borderRadius:6,backgroundColor:colors.accent}}/><View pointerEvents="none" style={{position:'absolute',left:width*(value-min)/(max-min)-11,width:22,height:22,borderRadius:11,backgroundColor:colors.accent,borderWidth:3,borderColor:colors.surfaceRaised}}/></View></View>};
 const toolPanel=<View style={{gap:7}}>{tool!=='shape'&&<Text style={{color:muted,fontSize:12}}>{tool==='eraser'?`Silgi boyutu: ${eraserSize}`:`Kalınlık: ${brush.width} pt`}</Text>}
 {(tool==='text'||selectedText)&&<>{sizeSlider(textStyle.fontSize,16,200,n=>{setTextStyle(v=>({...v,fontSize:n}));if(selectedText)action('textStyle',undefined,undefined,{fontSize:n})},'Yazı boyutu')}<Pressable onPress={()=>{const bold=!textStyle.bold;setTextStyle(v=>({...v,bold}));if(selectedText)action('textStyle',undefined,undefined,{bold})}} style={hit}><Text style={{color:ink}}>{textStyle.bold?'Kalın ✓':'Kalın'}</Text></Pressable><View style={{flexDirection:'row',gap:8}}>{(['left','center','right'] as const).map(align=><Pressable key={align} onPress={()=>{setTextStyle(v=>({...v,align}));if(selectedText)action('textStyle',undefined,undefined,{align})}} style={hit}><Text style={{color:ink}}>{align==='left'?'Sol':align==='center'?'Orta':'Sağ'}{textStyle.align===align?' ✓':''}</Text></Pressable>)}</View></>}
 {tool==='shape'&&<><Text style={{color:muted,fontSize:12}}>Şekil seç ve sayfada sürükle</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{(['auto','line','arrow','rect','ellipse','triangle'] as ShapeMode[]).map(kind=>{const label=({auto:'Otomatik',line:'Çizgi',arrow:'Ok',rect:'Dikdörtgen',ellipse:'Elips',triangle:'Üçgen'} as const)[kind as 'auto'|'line'|'arrow'|'rect'|'ellipse'|'triangle'];const Icon=kind==='auto'?WandSparkles:kind==='line'?Minus:kind==='arrow'?ArrowRight:kind==='rect'?Square:kind==='ellipse'?Circle:Triangle;return <Pressable key={kind} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:shapeKind===kind}} onPress={()=>setShapeKind(kind)} style={{width:76,height:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:shapeKind===kind?colors.accent:colors.border,backgroundColor:shapeKind===kind?colors.accent+'18':colors.surface,borderRadius:12}}><Icon size={25} strokeWidth={2} color={shapeKind===kind?colors.accent:ink}/></Pressable>})}</View><Pressable accessibilityRole="button" accessibilityLabel="Şekil dolgusu" accessibilityState={{selected:shapeFill}} onPress={()=>setShapeFill(v=>!v)} style={hit}><Text style={{color:ink}}>{shapeFill?'Dolgu açık':'Dolgu kapalı'}</Text></Pressable></>}
 {tool==='eraser'?<View style={{gap:8}}><View style={{flexDirection:'row',justifyContent:'space-around'}}>{(['pixel','stroke'] as const).map(mode=><Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode==='pixel'?'Piksel silgi':'Çizgi silgi'} accessibilityState={{selected:eraserMode===mode}} onPress={()=>setEraserMode(mode)} style={[hit,{minWidth:100,borderRadius:12,backgroundColor:eraserMode===mode?colors.accent+'22':'transparent'}]}><Text style={{color:ink}}>{mode==='pixel'?'Piksel':'Çizgi'}</Text></Pressable>)}</View>{sizeSlider(eraserSize,6,80,setEraserSize,'Silgi boyutu')}</View> :<>{tool!=='text'&&!selectedText&&sizeSlider(brush.width,1,32,n=>setBrush(b=>({...b,width:n})),'Kalınlık')}{tool==='highlighter'&&<View style={{flexDirection:'row',justifyContent:'space-between'}}>{[0.2,0.35,0.5,0.7].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={'Opaklık yüzde '+n*100} onPress={()=>setBrush(b=>({...b,opacity:n}))} style={hit}><Text style={{color:ink}}>{Math.round(n*100)}%</Text></Pressable>)}</View>}{(tool==='pen'||tool==='highlighter')&&presetPanel}{palette}<Pressable accessibilityRole="button" accessibilityLabel="Tüm renkleri aç" onPress={()=>setPanel('palette')} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>Tüm renkler</Text></Pressable></>}</View>;
 const popover=panel==='palette'&&<View style={{position:'absolute',zIndex:20,bottom:tablet?undefined:112,top:tablet?8:undefined,right:tablet?16:24,left:tablet?undefined:24,width:tablet?300:undefined,padding:16,borderRadius:20,backgroundColor:colors.surfaceRaised,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:16,elevation:8}}><Pressable accessibilityRole="button" accessibilityLabel="Paneli kapat" onPress={()=>setPanel(null)} style={{alignSelf:'flex-end',width:44,height:36,alignItems:'center',justifyContent:'center'}}><X size={20} color={ink}/></Pressable>{palette}</View>;
 return <SafeAreaView style={{flex:1,backgroundColor:backdrop}}>
 {!focus&&<View style={{minHeight:tablet?82:80,paddingTop:10,paddingBottom:8,flexDirection:'row',alignItems:'center',paddingHorizontal:tablet?12:4,zIndex:100,elevation:20,overflow:'visible',backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.divider}}>
 {heading}{tablet&&<View style={{flex:1,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}><CanvasToolbar tablet tool={tool} colors={colors} onTool={chooseTool} onPages={()=>setSheet(true)} onImage={()=>void insertImage()} toolPanel={toolPanel} panelTitle={tool==='pen'?'Kalem':tool==='highlighter'?'Vurgulayıcı':tool==='eraser'?'Silgi':tool==='shape'?'Şekil':tool==='text'?'Metin':tool==='select'?'Seç ve taşı':'Kaydırma'} panelOpen={panel==='tool'} onClosePanel={()=>setPanel(null)}/><Pressable accessibilityRole="button" accessibilityLabel="Renk paleti" onPress={()=>setPanel(p=>p==='palette'?null:'palette')} style={[hit,{width:44}]}><View style={{width:32,height:32,borderRadius:16,backgroundColor:brush.color,borderWidth:3,borderColor:colors.border}}/></Pressable></View>}
 {selectedDeleteButton}{undoButton}{redoButton}{control('Diğer',Ellipsis,more)}{tablet&&control('Odak modu',Eye,()=>setFocus(true))}
 </View>}
 <View style={{flex:1,flexDirection:'row'}}>
 {tablet&&!focus&&<View style={{width:132,backgroundColor:colors.background,borderRightWidth:1,borderRightColor:colors.divider}}>{selectionBar}<CanvasPageStrip tablet {...pageStripProps}/></View>}
 <View style={{flex:1,marginHorizontal:0,marginTop:0,marginBottom:0,borderRadius:0,overflow:'hidden'}}>
  {selected?<CanvasPage key={selected.id} page={selected} tool={tool} brush={brush} eraserSize={eraserSize} eraserMode={eraserMode} onController={setController} onHistory={()=>{}} onDrawStart={()=>setPanel(null)} onStrokeComplete={recordStroke} shapeKind={shapeKind} shapeFill={shapeFill} textStyle={textStyle} onSelectionChange={setSelectedElements} onTextSelectionChange={setSelectedText} selectionAction={selectionAction} imageRequest={imageRequest} imageAction={imageAction} onImageSelectionChange={setSelectedImageId}/>:<Text style={{color:ink}}>{pagesReady?'Sayfa bulunamadı':'Sayfalar yükleniyor…'}</Text>}
 </View>
 <View pointerEvents="none" style={{position:'absolute',bottom:tablet?22:110,right:24,backgroundColor:'#1B1B2FBB',borderRadius:20,paddingHorizontal:12,paddingVertical:7}}><Text style={{color:'#FFFFFF',fontSize:12}}>{index+1} / {pages.length}</Text></View>
 {focus&&<Pressable accessibilityRole="button" accessibilityLabel="Araç çubuklarını göster" onPress={()=>setFocus(false)} style={{position:'absolute',top:0,left:0,right:0,height:44,alignItems:'center',justifyContent:'center'}}><Eye color={colors.accent} size={20}/></Pressable>}
 {!tablet&&!focus&&<View style={{position:'absolute',bottom:28,left:12,right:12}}><CanvasToolbar tablet={false} tool={tool} colors={colors} onTool={chooseTool} onPages={()=>setSheet(true)} onImage={()=>void insertImage()} toolPanel={toolPanel} panelOpen={panel==='tool'} onClosePanel={()=>setPanel(null)}/></View>}

 
 {legacyInkViewControl}
 {pendingDelete&&<View style={{position:'absolute',bottom:tablet?18:170,left:16,right:16,backgroundColor:colors.surfaceRaised,padding:12,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:ink}}>{pendingDelete.length} sayfa silindi</Text><Pressable onPress={()=>void undoDelete()}><Text style={{color:colors.accent}}>Geri al</Text></Pressable></View>}
 {ruler&&<View pointerEvents="none" style={{position:'absolute',top:'45%',left:'15%',width:'70%',height:64,backgroundColor:colors.accent+'55',borderWidth:1,borderColor:colors.accent,borderRadius:6,justifyContent:'center',alignItems:'center'}}><Text style={{color:ink}}>0°   | | | | | | | | | | | |</Text></View>}
 {popover}
 </View>
 <Modal visible={sheet} transparent animationType="slide" onRequestClose={()=>{if(multiSelect){setMultiSelect(false);setSelectedPageIds([])}else setSheet(false)}}><GestureHandlerRootView style={{flex:1}}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}><View style={{backgroundColor:colors.surfaceRaised,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:28,maxHeight:height*0.65}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:12}}><Text style={{fontFamily:fonts.heading,fontSize:20,color:ink}}>Sayfalar</Text>{control('Kapat',X,()=>setSheet(false))}</View>{selectionBar}<CanvasPageStrip tablet={false} {...pageStripProps}/></View></View></GestureHandlerRootView></Modal>
 <Modal visible={templatePageId!==null} transparent animationType="fade" onRequestClose={()=>setTemplatePageId(null)}>
 <View style={{flex:1,justifyContent:'center',paddingHorizontal:20,backgroundColor:colors.overlay}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Şablon seçimini kapat" onPress={()=>setTemplatePageId(null)} style={{position:'absolute',top:0,bottom:0,left:0,right:0}}/>
 <View style={{backgroundColor:colors.surfaceRaised,borderRadius:24,padding:20,maxWidth:520,width:'100%',alignSelf:'center',gap:16}}>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
 <View style={{gap:4,flex:1}}><Text style={{fontFamily:fonts.heading,fontSize:21,color:ink}}>Sayfa şablonu</Text><Text style={{fontFamily:fonts.body,fontSize:13,color:muted}}>Sayfan için bir görünüm seç</Text></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={()=>setTemplatePageId(null)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X size={22} color={ink}/></Pressable>
 </View>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
 {templates.map(t=>{const active=pages.find(p=>p.id===templatePageId)?.template===t;return <Pressable key={t} accessibilityRole="button" accessibilityLabel={t+' sayfa şablonu'} accessibilityState={{selected:active}} onPress={()=>{const page=pages.find(p=>p.id===templatePageId);setTemplatePageId(null);if(page)void changeTemplate(page.id,t,page.paperColor)}} style={{width:'47%',flexGrow:1,gap:9,padding:10,borderRadius:16,borderWidth:active?2:1,borderColor:active?colors.accent:colors.divider,backgroundColor:active?colors.accent+'10':colors.surface}}>
 <View style={{height:112,backgroundColor:'#FFFFFF',borderRadius:9,borderWidth:1,borderColor:'#E5E6EB',overflow:'hidden',paddingHorizontal:12,paddingVertical:10,justifyContent:'space-evenly'}}>
 {t==='boş'?<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><View style={{width:35,height:2,backgroundColor:'#E7E9EF',borderRadius:2}}/></View>:t==='çizgili'?Array.from({length:7},(_,i)=><View key={i} style={{height:1,backgroundColor:'#D5DDF1'}}/>):t==='kareli'?<View style={{flex:1,justifyContent:'space-evenly'}}>{Array.from({length:7},(_,i)=><View key={i} style={{height:1,backgroundColor:'#D5DDF1'}}/>)}<View pointerEvents="none" style={{position:'absolute',top:0,bottom:0,left:0,right:0,flexDirection:'row',justifyContent:'space-evenly'}}>{Array.from({length:8},(_,i)=><View key={i} style={{width:1,backgroundColor:'#D5DDF1'}}/>)}</View></View>:<View style={{flex:1,justifyContent:'space-evenly'}}>{Array.from({length:6},(_,i)=><View key={i} style={{flexDirection:'row',justifyContent:'space-evenly'}}>{Array.from({length:7},(_,j)=><View key={j} style={{width:3,height:3,borderRadius:2,backgroundColor:'#B7C4E4'}}/>)}</View>)}</View>}
 </View>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontFamily:fonts.semibold,fontSize:15,color:ink,textTransform:'capitalize'}}>{t}</Text>{active&&<Text style={{color:colors.accent,fontSize:12,fontFamily:fonts.semibold}}>Seçili ✓</Text>}</View>
 </Pressable>})}
 </View>
 </View></View></Modal>
 <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={()=>setMoreOpen(false)}>
 <View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Menüyü kapat" onPress={()=>setMoreOpen(false)} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
 <View style={{backgroundColor:colors.surfaceRaised,borderTopLeftRadius:22,borderTopRightRadius:22,paddingHorizontal:20,paddingTop:16,paddingBottom:32}}>
 <Text style={{fontFamily:fonts.heading,fontSize:19,color:ink,marginBottom:12}}>Diğer işlemler</Text>
 {moreItems.map(item=><Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>{setMoreOpen(false);item.onPress()}} style={{minHeight:52,justifyContent:'center',borderBottomWidth:1,borderBottomColor:colors.divider}}><Text style={{fontSize:16,color:ink}}>{item.label}</Text></Pressable>)}
 <Pressable accessibilityRole="button" accessibilityLabel="Vazgeç" onPress={()=>setMoreOpen(false)} style={{minHeight:52,justifyContent:'center'}}><Text style={{fontSize:16,color:colors.accent}}>Vazgeç</Text></Pressable>
 </View></View></Modal>
 </SafeAreaView>;
}
function CanvasPage({page,tool,brush,eraserSize,eraserMode,onController,onHistory,onDrawStart,onStrokeComplete,shapeKind,shapeFill,textStyle,onSelectionChange,onTextSelectionChange,selectionAction,imageRequest,imageAction,onImageSelectionChange}:{page:Page;tool:Tool;brush:Brush;eraserSize:number;eraserMode:'pixel'|'stroke';onController:(value:CanvasController|null)=>void;onHistory:()=>void;onDrawStart:()=>void;onStrokeComplete:(tool:PenTool,color:string)=>void;shapeKind:ShapeMode;shapeFill:boolean;textStyle:{fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right'};onSelectionChange:(ids:string[])=>void;onTextSelectionChange:(selected:boolean)=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color'|'textStyle'|'toggleBeautify';value?:number;color?:string;textStyle?:Partial<{fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right'}>;version:number};imageRequest?:{uri:string;width:number;height:number;version:number}|null;imageAction?:{kind:'grow'|'shrink'|'delete';version:number};onImageSelectionChange:(id:string|null)=>void}){
 useCanvasAwake();const [content,setContent]=useState<PageContent>(()=>{const started=__DEV__?perfNow():0;const parsed=parseContent(page.content);if(__DEV__)console.log('[Notex perf] page_parse',{duration_ms:Math.round((perfNow()-started)*10)/10,element_count:parsed.elements.length,content_characters:page.content.length});return parsed});
 const {error,saving,retry,flush,setDrawingActive}=useAutosave(page.id,content);
 const change=(next:PageContent)=>{record(page.id,content);setContent(next);onHistory()};
 useEffect(()=>{if(!imageRequest)return;setContent(previous=>{record(page.id,previous);return {...previous,images:[...(previous.images??[]),{id:Crypto.randomUUID(),uri:imageRequest.uri,x:175,y:240,width:imageRequest.width,height:imageRequest.height}]}});onHistory()},[imageRequest?.version]);
 const back=()=>{const next=undo(page.id,content);if(next){setContent(next);onHistory()}};
 const forward=()=>{const next=redo(page.id,content);if(next){setContent(next);onHistory()}};
 const h=historyState(page.id);
 const controller:CanvasController={back,forward,flush,canUndo:h.canUndo,canRedo:h.canRedo,error,saving,retry};
 useEffect(()=>{onController(controller)},[error,saving,h.canUndo,h.canRedo]);
 useEffect(()=>()=>{void flush();onController(null)},[]);
 return <DrawingCanvas pageId={page.id} content={content} template={page.template} paperColor={page.paperColor} tool={tool} brush={tool==='highlighter'?{...brush,width:brush.width*5}:brush} eraserSize={eraserSize} eraserMode={eraserMode} onChange={change} onDrawingActive={setDrawingActive} onStrokeComplete={onStrokeComplete} shapeKind={shapeKind} shapeFill={shapeFill} textStyle={textStyle} onSelectionChange={ids=>{onSelectionChange(ids);onTextSelectionChange(ids.some(id=>content.elements.some(e=>e.id===id&&e.type==='text')))}} selectionAction={selectionAction} imageAction={imageAction} onImageSelectionChange={onImageSelectionChange}/>;
}
