import React,{memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {View,PixelRatio,Platform,TextInput,BackHandler,Keyboard,Animated,Text,Modal,Pressable,type LayoutChangeEvent,type ViewStyle} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,DashPathEffect,Image as SkiaImage,Skia,vec,Paragraph,TextAlign,TextDecoration,FontSlant} from '@shopify/react-native-skia';
import {Gesture,GestureDetector,PointerType} from 'react-native-gesture-handler';
import {useSettingsStore} from '@/store/settingsStore';
import {useDerivedValue,useSharedValue,runOnJS} from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type PageImage,type StrokeElement,type TextElement,type TextFontFamily} from '@/features/canvas/types';
import {makeStroke,strokePath,strokePathString,cacheFinalizedStrokePath} from '@/features/canvas/engine/geometry';
import {appendPolylinePoint,centerlinePathString} from '@/features/canvas/engine/centerlinePath';
import {appendSample,emptySampleBuffer,flattenSamples,normalizeStylusPressure,sampleBufferAt,sampleBufferFromPoint,type Sample,type SampleBuffer} from '@/features/canvas/engine/sampleBuffer';
import {interruptedStrokeAction,isCurrentStrokeCommit} from '@/features/canvas/engine/strokeInterruption';
import {CanvasFontsContext,type CanvasFontManager} from '@/features/canvas/components/CanvasFontProvider';
import {perfNow} from '@/features/canvas/engine/performance';
import {pixelErase} from '@/features/canvas/engine/pixelEraser';
import {hasCommittedErase,isCurrentEraseHandoff,shouldReleaseEraserHandoff} from '@/features/canvas/engine/eraserHandoff';
import {getPaperGuideMetrics,nearestPaperGuide,PAPER_GUIDE_SPACING,PAPER_GUIDE_LINE_WIDTH} from '@/features/canvas/engine/paperGuides';
import {recognizeShape} from '@/features/canvas/engine/recognizeShape';
import {deleteStoredFile,imageDebugError,isTauriDesktop,isStoredAppDataPath,isTauriDevelopmentRuntime,logImageDebug,readStoredFile} from '@/utils/tauriFiles';
import {shapePath,makeShape,moveElement,scaleElement,rotateElement} from '@/features/canvas/engine/shapes';
import {lassoSelect,lassoPathLength} from '@/features/canvas/engine/lassoGeometry';
import {shouldGrabSelectionCorner} from '@/features/canvas/engine/selectionGestureTarget';
import {readSelectionClipboard,writeSelectionClipboard,hasSelectionClipboard} from '@/features/canvas/engine/selectionClipboard';
import {isSelectionHandoffCommitted,needsReleasedSelectionHandoff,shouldApplySelectionPreviewTransform,shouldDismissSelectionOnBlankTap,shouldUseCommittedSelectionGeometry} from '@/features/canvas/engine/selectionHandoff';
import type {ShapeMode,Element} from '@/features/canvas/types';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand'|'select'|'shape'|'text';
export type Brush={color:string;width:number;opacity:number};
type Props={pageId:string;content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;eraserMode?:'pixel'|'stroke';onChange:(next:PageContent)=>void;onAddImage?:(image:PageImage)=>void;onDrawingActive?:(active:boolean)=>void;onFinishEditingReady?:(finish:()=>void)=>void;onStrokeComplete?:(tool:'pen'|'highlighter',color:string)=>void;shapeKind?:ShapeMode;shapeFill?:boolean;onSelectionChange?:(ids:string[])=>void;onSelectionClipboardChange?:(hasItems:boolean)=>void;onSelectionActionComplete?:(version:number)=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color'|'textStyle'|'copy'|'paste'|'clear'|'selectAll'|'cut'|'width'|'fontSize'|'front'|'back';pageId:string;value?:number;color?:string;dx?:number;dy?:number;textStyle?:Partial<Pick<TextElement,'fontSize'|'color'|'bold'|'italic'|'underline'|'align'>>;version:number};transformMode?:boolean;onImageSelectionChange?:(id:string|null)=>void;onImageLoadError?:(message:string)=>void;imageRequest?:{uri:string;width:number;height:number;version:number}|null;onImageRequestConsumed?:(version:number)=>void;imageAction?:{kind:'grow'|'shrink'|'delete'|'clear';version:number};textStyle?:{fontSize:number;color:string;bold:boolean;italic?:boolean;underline?:boolean;align:'left'|'center'|'right'}};
const normalizeShapeSize=(kind:string,w:number,h:number):[number,number]=>{ 'worklet';
 if(kind==='triangle'){
  const side=Math.max(Math.abs(w),Math.abs(h)*2/Math.sqrt(3));
  return [Math.sign(w||1)*side,Math.sign(h||1)*side*Math.sqrt(3)/2];
 }
 if((kind==='rect'||kind==='ellipse')&&Math.min(Math.abs(w),Math.abs(h))/Math.max(1,Math.abs(w),Math.abs(h))>=0.76){
  const side=(Math.abs(w)+Math.abs(h))/2;
  return [Math.sign(w||1)*side,Math.sign(h||1)*side];
 }
 return [w,h];
};
const isTauriTextWidthDebugEnabled=()=>Platform.OS==='web'&&typeof window!=='undefined'&&window.location.protocol==='http:'&&window.location.hostname==='127.0.0.1'&&window.location.port==='1431'&&isTauriDesktop();
const previewShape=(kind:string,x0:number,y0:number,x1:number,y1:number):string=>{ 'worklet';
 if(kind==='triangle'||kind==='rect'||kind==='ellipse'){
  const size=normalizeShapeSize(kind,x1-x0,y1-y0);
  x1=x0+size[0];y1=y0+size[1];
 }
 const l=Math.min(x0,x1),r=Math.max(x0,x1),t=Math.min(y0,y1),b=Math.max(y0,y1);
 if(kind==='line'||kind==='arrow'){
  let s='M '+x0+' '+y0+' L '+x1+' '+y1;
  if(kind==='arrow'){const a=Math.atan2(y1-y0,x1-x0),h=24;s+=' M '+(x1-h*Math.cos(a-0.5))+' '+(y1-h*Math.sin(a-0.5))+' L '+x1+' '+y1+' L '+(x1-h*Math.cos(a+0.5))+' '+(y1-h*Math.sin(a+0.5))}
  return s}
 if(kind==='rect')return 'M '+l+' '+t+' L '+r+' '+t+' L '+r+' '+b+' L '+l+' '+b+' Z';
 if(kind==='triangle')return 'M '+((x0+x1)/2)+' '+y0+' L '+x1+' '+y1+' L '+x0+' '+y1+' Z';
 const rx=(r-l)/2,ry=(b-t)/2,cx=l+rx,cy=t+ry;
 if(rx<1||ry<1)return '';
 return 'M '+(cx+rx)+' '+cy+' A '+rx+' '+ry+' 0 1 0 '+(cx-rx)+' '+cy+' A '+rx+' '+ry+' 0 1 0 '+(cx+rx)+' '+cy+' Z';
};
// For a single shape, the selection frame follows its local axes rather
// than the axis-aligned bounding box of the rotated geometry.
const selectionFrame=(elements:Element[]):{bounds:readonly [number,number,number,number];rotation:number}|null=>{
 if(!elements.length)return null;
 if(elements.length===1&&elements[0].type==='shape'){
  const p=elements[0].params;
  return {bounds:[Math.min(p.x,p.x+p.w),Math.min(p.y,p.y+p.h),Math.max(p.x,p.x+p.w),Math.max(p.y,p.y+p.h)],rotation:p.rotation};
 }
 return {bounds:[
  Math.min(...elements.map(e=>e.bbox[0])),Math.min(...elements.map(e=>e.bbox[1])),
  Math.max(...elements.map(e=>e.bbox[2])),Math.max(...elements.map(e=>e.bbox[3]))
 ],rotation:0};
};
const pathCache=new Map<string,{element:Element;path:ReturnType<typeof strokePath>}>();
const storedPageImageCache=new Map<string,ReturnType<typeof Skia.Image.MakeImageFromEncoded>>();
async function decodeStoredPageImage(uri:string){
 const cached=storedPageImageCache.get(uri);
 if(cached){logImageDebug('skia_decode_cache_hit',{format:uri.split('.').pop()?.toLowerCase()});return cached}
 logImageDebug('skia_decode_started',{format:uri.split('.').pop()?.toLowerCase()});
 const bytes=await readStoredFile(uri);
 const image=Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
 if(!image)throw new Error('Skia seçilen dosyanın içeriğini çözemedi.');
 storedPageImageCache.set(uri,image);
 if(storedPageImageCache.size>24){const oldest=storedPageImageCache.keys().next().value;if(oldest)storedPageImageCache.delete(oldest)}
 logImageDebug('skia_decode_succeeded',{sizeBytes:bytes.byteLength,format:uri.split('.').pop()?.toLowerCase()});
 return image;
}
const IMAGE_RENDER_PROBE_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVR4nGP4z7Dlv8id//9hNAMyB0QzEFQBAOwvLQEyGFrGAAAAAElFTkSuQmCC';
const pathBuildMetrics={count:0,totalMs:0,maxMs:0};
const cachedPath=(element:Element)=>{
 const cacheKey=element.id;
 const hit=pathCache.get(cacheKey);
 if(hit?.element===element)return hit.path;
 const measurePath=__DEV__&&element.type==='stroke',started=measurePath?perfNow():0;
 const path=element.type==='stroke'?strokePath(element):element.type==='shape'?shapePath(element):Skia.Path.Make();
 if(measurePath){const elapsed=perfNow()-started;pathBuildMetrics.count++;pathBuildMetrics.totalMs+=elapsed;pathBuildMetrics.maxMs=Math.max(pathBuildMetrics.maxMs,elapsed)}
 pathCache.set(cacheKey,{element,path});
 if(pathCache.size>2500){for(const id of Array.from(pathCache.keys()).slice(0,500))pathCache.delete(id)}
 return path;
};
const StaticPaper=memo(function StaticPaper({template,paperColor,pageHeight,fitWidth}:{template:PageTemplate;paperColor:PaperColor;pageHeight:number;fitWidth:number}){
 const ratio=PixelRatio.get();
 const guideMetrics=getPaperGuideMetrics(fitWidth,ratio);
 const stepPage=guideMetrics.stepPage;
 const lineW=guideMetrics.lineWidth;
 const firstLinePage=guideMetrics.firstLinePage;
 const lines=useMemo(()=>{
  const items:{x1:number;y1:number;x2:number;y2:number}[]=[];
  if(template==='çizgili'||template==='kareli')for(let y=firstLinePage;y<pageHeight;y+=stepPage)items.push({x1:0,y1:y,x2:PAGE_WIDTH,y2:y});
  if(template==='kareli')for(let x=firstLinePage;x<PAGE_WIDTH;x+=stepPage)items.push({x1:x,y1:0,x2:x,y2:pageHeight});
  return items;
 },[template,fitWidth,pageHeight,stepPage,firstLinePage]);
 const dots=useMemo(()=>{
  if(template!=='noktalı')return [] as [number,number][];
  const items:[number,number][]=[];
  for(let y=firstLinePage;y<pageHeight;y+=stepPage)for(let x=firstLinePage;x<PAGE_WIDTH;x+=stepPage)items.push([x,y]);
  return items;
 },[template,fitWidth,pageHeight,stepPage,firstLinePage]);
 return <>
  <Rect x={0} y={0} width={PAGE_WIDTH} height={pageHeight} color={paperColor==='krem'?'#FFF5DF':'#FFFFFF'}/>
  {lines.map((l,i)=><Line key={i} p1={vec(l.x1,l.y1)} p2={vec(l.x2,l.y2)} color="#C4CCDD" strokeWidth={lineW}/>)}
  {dots.map((p,i)=><Circle key={i} cx={p[0]} cy={p[1]} r={lineW*1.2} color="#C4CCDD"/>)}
 </>;
});
const InlineTextEditor=memo(function InlineTextEditor({item,left,top,scale,canvasZoom,pageHeight,onCommit,onValueChange,onMove,onResize,onGeometryCommit,onStyleChange}:{item:TextElement;left:number;top:number;scale:number;canvasZoom:number;pageHeight:number;onCommit:(value:string)=>void;onValueChange:(value:string)=>void;onMove:(dx:number,dy:number,heightPx:number)=>void;onResize:(width:number,minHeight:number|null,heightPx:number)=>void;onGeometryCommit:()=>void;onStyleChange:(patch:Partial<Pick<TextElement,'fontSize'|'color'|'bold'|'italic'|'underline'|'align'>>)=>void}){
 const [value,setValue]=useState(item.text);
 const [typing,setTyping]=useState(true);
 const editorHostRef=useRef<any>(null);
 const [webTextHeight,setWebTextHeight]=useState(0);
 const [preview,setPreviewState]=useState({dx:0,dy:0,width:item.w*scale,height:Math.max(24,item.bbox[3]-item.bbox[1])*scale});
 const previewRef=useRef(preview);
 const setPreview=(next:typeof preview)=>{previewRef.current=next;setPreviewState(next)};

 const valueRef=useRef(value);valueRef.current=value;
 const done=useRef(false);
 const commit=()=>{if(done.current)return;done.current=true;onCommit(valueRef.current)};
 const width=Math.max(40*scale,Math.min((PAGE_WIDTH-item.x)*scale,item.w*scale));
 const height=Math.max(24*scale,(item.bbox[3]-item.bbox[1])*scale,webTextHeight);
 const latest=useRef({item,scale,pageHeight,width,height,onMove,onResize,onGeometryCommit});
 latest.current={item,scale,pageHeight,width,height,onMove,onResize,onGeometryCommit};
 useLayoutEffect(()=>{if(!dragRef.current)setPreview({dx:0,dy:0,width,height})},[item.x,item.y,item.w,item.minHeight,item.bbox[3],width,height]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{commit();return true});return()=>sub.remove()},[]);
 // Measure the actual browser textarea after each edit, not from a size-change event.
 // This avoids React #185 and prevents the browser scrolling text inside the box.
 useLayoutEffect(()=>{
  if(Platform.OS!=='web')return;
  const host=editorHostRef.current as HTMLElement|null;
  const textarea=host?.querySelector?.('textarea') as HTMLTextAreaElement|null;
  if(!textarea)return;
  textarea.style.height='0px';
  const needed=Math.ceil(textarea.scrollHeight+2);
  if(Number.isFinite(needed)&&needed>0){
   textarea.style.height=needed+'px';
   textarea.style.overflowY='hidden';
   textarea.style.resize='none';
   textarea.scrollTop=0;
   setWebTextHeight(previous=>Math.abs(previous-needed)>1?needed:previous);
  }
 },[value,width,item.fontSize,item.fontFamily,item.bold,item.italic,scale]);
 const dragRef=useRef<{kind:'resize';handle:string;startX:number;startY:number;dx:number;dy:number}|null>(null);
 const begin=(handle:string,event:any)=>{
  if(Platform.OS!=='web')return;
  event.preventDefault?.();event.stopPropagation?.();
  const native=event.nativeEvent??event;
  dragRef.current={kind:'resize',handle,startX:native.clientX??0,startY:native.clientY??0,dx:0,dy:0};
  if(typeof native.pointerId==='number')(event.currentTarget as HTMLElement)?.setPointerCapture?.(native.pointerId);
 };
 const move=(event:any)=>{
  const d=dragRef.current;if(!d)return;
  const native=event.nativeEvent??event;
  const {item,scale,pageHeight,width,height}=latest.current;
  const factor=Math.max(0.01,scale);
  const dx=(native.clientX??d.startX)-d.startX,dy=(native.clientY??d.startY)-d.startY;
  d.dx=dx;d.dy=dy;
  const west=d.handle.includes('w'),east=d.handle.includes('e'),north=d.handle.includes('n'),south=d.handle.includes('s');
  let w=width+(east?dx:west?-dx:0),h=height+(south?dy:north?-dy:0);
  if(d.handle.length===2){
   const ratio=width/Math.max(1,height);
   if(Math.abs(dx)/Math.max(1,width)>Math.abs(dy)/Math.max(1,height))h=w/ratio;
   else w=h*ratio;
  }
  w=Math.max(40*factor,Math.min(PAGE_WIDTH*factor,w));
  h=Math.max(24*factor,Math.min(pageHeight*factor,h));
  setPreview({dx:west?width-w:0,dy:north?height-h:0,width:w,height:h});
 };
 const end=(event:any)=>{
  const d=dragRef.current;if(!d)return;
  event.stopPropagation?.();
  dragRef.current=null;
  const {item,scale,pageHeight,onMove,onResize,onGeometryCommit}=latest.current;
  const finalPreview=previewRef.current;
  const factor=Math.max(0.01,scale);
  if(d.handle.includes('w')||d.handle.includes('n'))onMove(finalPreview.dx,finalPreview.dy,finalPreview.height);
   onResize(Math.max(40,finalPreview.width/factor),Math.max(24,finalPreview.height/factor),finalPreview.height);
   onGeometryCommit();
 };
 const handles=['nw','n','ne','e','se','s','sw','w'] as const;
 const positions:Record<string,{left?:number;top?:number;right?:number;bottom?:number;cursor:string}>={
  nw:{left:-6,top:-6,cursor:'nwse-resize'},n:{left:preview.width/2-6,top:-6,cursor:'ns-resize'},
  ne:{right:-6,top:-6,cursor:'nesw-resize'},e:{right:-6,top:preview.height/2-6,cursor:'ew-resize'},
  se:{right:-6,bottom:-6,cursor:'nwse-resize'},s:{left:preview.width/2-6,bottom:-6,cursor:'ns-resize'},
  sw:{left:-6,bottom:-6,cursor:'nesw-resize'},w:{left:-6,top:preview.height/2-6,cursor:'ew-resize'}
 };
 return <View ref={editorHostRef} style={{position:'absolute',left:left+preview.dx,top:top+preview.dy,width:preview.width,height:preview.height,borderWidth:1,borderColor:'#496AE8',backgroundColor:'transparent',overflow:'visible'} as any}>
  <View onPointerDown={(event:any)=>event.preventDefault?.()} style={{position:'absolute',left:0,bottom:'100%',marginBottom:19,flexDirection:'row',alignItems:'center',gap:4,padding:4,borderRadius:6,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#C9D0E8',zIndex:30} as any}>
   {([{label:'B',patch:{bold:!item.bold}},{label:'I',patch:{italic:!item.italic}},{label:'U',patch:{underline:!item.underline}},{label:'Sol',patch:{align:'left'}},{label:'Orta',patch:{align:'center'}},{label:'Sağ',patch:{align:'right'}},{label:'−',patch:{fontSize:Math.max(16,item.fontSize-2)}},{label:'+',patch:{fontSize:Math.min(200,item.fontSize+2)}}] as {label:string;patch:Partial<Pick<TextElement,'fontSize'|'bold'|'italic'|'underline'|'align'>>}[]).map(action=><Pressable key={action.label} accessibilityLabel={action.label} onPress={()=>onStyleChange(action.patch)} style={{paddingHorizontal:6,paddingVertical:4,borderRadius:4,backgroundColor:'#F1F3FA'}}><Text style={{fontSize:12,color:'#25355B'}}>{action.label}</Text></Pressable>)}
   {['#1B1B2F','#3347D9','#D94343','#25825B'].map(color=><Pressable key={color} accessibilityLabel={'Yazı rengi '+color} onPress={()=>onStyleChange({color})} style={{width:16,height:16,borderRadius:8,backgroundColor:color,borderWidth:1,borderColor:'#DDD'}}/>)}
  </View>
  <TextInput multiline scrollEnabled={false} autoFocus={typing} value={value} onChangeText={next=>{valueRef.current=next;setValue(next);onValueChange(next)}} onBlur={()=>{if(!dragRef.current){setTyping(false);commit()}}} onFocus={()=>setTyping(true)} underlineColorAndroid="transparent" style={{width:'100%',height:Platform.OS==='web'?Math.max(height,webTextHeight):'100%',padding:4,margin:0,fontSize:item.fontSize*scale,lineHeight:item.fontSize*1.3*scale,color:item.color,fontFamily:nativeFontFamily(item.fontFamily,item.bold),fontStyle:item.italic?'italic':'normal',textDecorationLine:item.underline?'underline':'none',textAlign:item.align,textAlignVertical:'top',backgroundColor:'transparent',borderWidth:0,whiteSpace:'pre-wrap',overflowWrap:'anywhere',wordBreak:'break-word',overflow:'visible',overflowY:'hidden',resize:'none',boxSizing:'border-box'} as any}/>
  {handles.map(handle=><View key={handle} onPointerDown={(e:any)=>begin(handle,e)} onPointerMove={move} onPointerUp={end} style={{position:'absolute',width:12,height:12,borderRadius:2,borderWidth:1,borderColor:'#FFFFFF',backgroundColor:'#496AE8',touchAction:'none',zIndex:20,...positions[handle]} as any}/>)}
 </View>;
});
type InlineTextEditorBoundaryProps={children:React.ReactNode;fallbackStyle:object;onClose:()=>void};
type InlineTextEditorBoundaryState={error:Error|null;componentStack:string};
class InlineTextEditorErrorBoundary extends React.Component<InlineTextEditorBoundaryProps,InlineTextEditorBoundaryState>{
 state:InlineTextEditorBoundaryState={error:null,componentStack:''};
 static getDerivedStateFromError(error:Error):Partial<InlineTextEditorBoundaryState>{return {error}}
 componentDidMount(){if(Platform.OS==='web'&&isTauriDesktop()){window.addEventListener('error',this.captureWindowError);window.addEventListener('unhandledrejection',this.captureUnhandledRejection)}}
 componentWillUnmount(){if(Platform.OS==='web'&&isTauriDesktop()){window.removeEventListener('error',this.captureWindowError);window.removeEventListener('unhandledrejection',this.captureUnhandledRejection)}}
 private captureWindowError=(event:ErrorEvent)=>{if(this.state.error)return;const error=event.error instanceof Error?event.error:new Error(event.message||'Bilinmeyen pencere hatası');this.setState({error,componentStack:`${event.filename||''}:${event.lineno||0}:${event.colno||0}`});console.error('[Notex text editor] window error during editor session',error)};
 private captureUnhandledRejection=(event:PromiseRejectionEvent)=>{if(this.state.error)return;const error=event.reason instanceof Error?event.reason:new Error(String(event.reason));this.setState({error,componentStack:'Unhandled promise rejection during editor session'});console.error('[Notex text editor] unhandled rejection during editor session',error)};
 componentDidCatch(error:Error,info:React.ErrorInfo){
  this.setState({componentStack:info.componentStack??''});
  console.error('[Notex text editor] render/focus transition failed',error,info.componentStack);
 }
 render(){
  const {error,componentStack}=this.state;
  if(!error)return this.props.children;
  return <View style={[{position:'absolute',zIndex:1000,maxWidth:520,padding:12,borderWidth:1,borderColor:'#B42318',backgroundColor:'#FFF4F2'} as const,this.props.fallbackStyle]}>
   <Text style={{fontWeight:'700',color:'#7A271A'}}>Metin düzenleyici açılamadı</Text>
   <Text selectable style={{marginTop:6,color:'#7A271A'}}>{error.message||String(error)}</Text>
   {!!error.stack&&<Text selectable style={{marginTop:6,maxHeight:180,color:'#7A271A',fontSize:11}}>{error.stack}</Text>}
   {!!componentStack&&<Text selectable style={{marginTop:6,maxHeight:140,color:'#7A271A',fontSize:11}}>{componentStack}</Text>}
   <Pressable accessibilityRole="button" accessibilityLabel="Metin düzenleyici hata bildirimini kapat" onPress={this.props.onClose} style={{alignSelf:'flex-start',marginTop:8,paddingVertical:6,paddingHorizontal:10,borderWidth:1,borderColor:'#B42318'}}><Text style={{color:'#7A271A'}}>Kapat</Text></Pressable>
  </View>;
 }
}
const paragraphAlign=(align:TextElement['align']):TextAlign=>align==='center'?TextAlign.Center:align==='right'?TextAlign.Right:TextAlign.Left;
const paragraphTextStyle=(element:TextElement)=>({fontFamilies:[skiaFontFamily(element.fontFamily,element.bold),'Inter'],fontSize:element.fontSize,color:Skia.Color(element.color),fontStyle:{slant:element.italic?FontSlant.Italic:FontSlant.Upright},decoration:element.underline?TextDecoration.Underline:TextDecoration.NoDecoration});
const skiaFontFamily=(family:TextFontFamily|undefined,bold:boolean)=>family==='SpaceGrotesk'?(bold?'SpaceGroteskBold':'SpaceGrotesk'):(bold?'InterBold':'Inter');
const nativeFontFamily=(family:TextFontFamily|undefined,bold:boolean)=>family==='SpaceGrotesk'?(bold?'SpaceGrotesk_700Bold':'SpaceGrotesk_500Medium'):(bold?'Inter_700Bold':'Inter_400Regular');
const textLayoutCache=new Map<string,{paragraph:ReturnType<ReturnType<typeof Skia.ParagraphBuilder.Make>['build']>;height:number}>();
const TextLayer=memo(function TextLayer({element,fonts}:{element:TextElement;fonts:CanvasFontManager|null}){
 const key=[element.id,element.text,element.fontSize,element.w,element.bold,element.italic,element.underline,element.align,element.color,element.fontFamily??'Inter'].join('|');
 const layout=useMemo(()=>{
  if(!fonts)return null;
  const cached=textLayoutCache.get(key);if(cached)return cached;
  const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(element.align)},fonts);
  builder.pushStyle(paragraphTextStyle(element));
  builder.addText(element.text);builder.pop();
  const paragraph=builder.build();paragraph.layout(element.w);
  const result={paragraph,height:paragraph.getHeight()};
  textLayoutCache.set(key,result);
  if(textLayoutCache.size>400){const first=textLayoutCache.keys().next().value;if(first)textLayoutCache.delete(first)}
  return result;
 },[key,fonts]);
 const erasePaths=useMemo(()=>element.erasures?.map(erase=>{
  const pts=erase.points;
  const commands:string[]=[];
  if(pts.length>=2){
   commands.push(`M ${pts[0]} ${pts[1]}`);
   for(let i=2;i+1<pts.length;i+=2)commands.push(`L ${pts[i]} ${pts[i+1]}`);
  }
  const path=Skia.Path.MakeFromSVGString(commands.join(' '))??Skia.Path.Make();
  return {path,radius:erase.radius,first:pts.length>=2?[pts[0],pts[1]]:null};
 })??[],[element.erasures]);
 if(!layout)return null;
 if(!erasePaths.length)return <Paragraph paragraph={layout.paragraph} x={element.x} y={element.y} width={element.w}/>;
 return <Group layer>
  <Paragraph paragraph={layout.paragraph} x={element.x} y={element.y} width={element.w}/>
  {erasePaths.map((erase,i)=><React.Fragment key={i}>
   <Path path={erase.path} color="black" style="stroke" strokeWidth={erase.radius*2} strokeCap="round" strokeJoin="round" blendMode="clear"/>
   {erase.first&&<Circle cx={erase.first[0]} cy={erase.first[1]} r={erase.radius} color="black" blendMode="clear"/>}
  </React.Fragment>)}
 </Group>;
});
const StrokeLayer=memo(function StrokeLayer({element}:{element:Element}){
 const path=useMemo(()=>cachedPath(element),[element]);
 if(element.type==='text')return null;
 if(element.type==='shape'){
  const {x,y,w,h,rotation}=element.params;
  const center=vec(x+w/2,y+h/2);
  return <Group origin={center} transform={[{rotate:rotation}]}>
   {element.fill&&<Path path={path} color={element.fill.color} opacity={element.fill.opacity} style="fill"/>}
   <Path path={path} color={element.stroke.color} opacity={element.stroke.opacity} style="stroke" strokeWidth={element.stroke.width}/>
  </Group>;
 }
 return <Path path={path} color={element.color} opacity={element.opacity} blendMode={element.tool==='highlighter'?'multiply':'srcOver'} {...(element.renderMode==='centerline'||element.renderMode==='raw'?{style:'stroke' as const,strokeWidth:element.width,strokeCap:'round' as const,strokeJoin:'round' as const}:{})}/>;
});
const PageImageLayer=memo(function PageImageLayer({item,onLoadError}:{item:import('@/features/canvas/types').PageImage;onLoadError?:(message:string)=>void}){
 const desktopStored=isTauriDesktop()&&isStoredAppDataPath(item.uri);
 const [storedImage,setStoredImage]=useState<ReturnType<typeof Skia.Image.MakeImageFromEncoded>>(null);
 const onLoadErrorRef=useRef(onLoadError);onLoadErrorRef.current=onLoadError;
 useEffect(()=>{
  if(!desktopStored){setStoredImage(null);return;}
  let current=true;
  setStoredImage(null);
  void decodeStoredPageImage(item.uri).then(image=>{
   if(current)setStoredImage(image);
  }).catch(error=>{
   logImageDebug('skia_page_image_load_failed',{elementId:item.id,errorType:error instanceof Error?error.name:typeof error,error:imageDebugError(error)});
   console.error('[Notex image] Stored page image could not be read or decoded',{id:item.id,uri:item.uri,error});
   if(current)onLoadErrorRef.current?.('Görsel Notex’in yerel kopyasından okunamadı. Dosyayı yeniden ekleyip deneyin.');
  });
  return()=>{current=false};
 },[desktopStored,item.id,item.uri]);
 const image=useMemo(()=>{
  try{
   const encoded=item.uri.includes(',')?item.uri.slice(item.uri.indexOf(',')+1):'';
   if(!encoded)return null;
   const data=Skia.Data.fromBase64(encoded);
   const decoded=Skia.Image.MakeImageFromEncoded(data);
   if(!decoded)console.error('[Notex image] Embedded page image could not be decoded',{id:item.id});
   return decoded;
  }catch(error){
   console.error('[Notex image] Embedded page image decode failed',{id:item.id,error});
   return null;
  }
 },[item.uri]);
 const renderedImage=desktopStored?storedImage:image;
 useEffect(()=>{logImageDebug('skia_render_layer_received',{elementId:item.id,source:desktopStored?'app_data_bytes':'embedded_data',width:item.width,height:item.height})},[item.id,item.uri,desktopStored]);
 useEffect(()=>{if(renderedImage)logImageDebug('skia_canvas_layer_ready',{elementId:item.id,x:item.x,y:item.y,width:item.width,height:item.height})},[renderedImage,item.id,item.x,item.y,item.width,item.height]);
 return renderedImage?<SkiaImage image={renderedImage} x={item.x} y={item.y} width={item.width} height={item.height} fit="contain"/>:null;
});
const Completed=memo(function Completed({content,hiddenIds,fonts}:{content:PageContent;hiddenIds?:string[];fonts:CanvasFontManager|null}){
 const elements=useMemo(()=>content.elements.filter(element=>!hiddenIds?.includes(element.id)),[content.elements,hiddenIds]);
 useEffect(()=>{
  if(!__DEV__||!pathBuildMetrics.count)return;
  console.log('[Notex perf] stroke_paths',{count:pathBuildMetrics.count,total_ms:Math.round(pathBuildMetrics.totalMs*10)/10,max_ms:Math.round(pathBuildMetrics.maxMs*10)/10});
  pathBuildMetrics.count=0;pathBuildMetrics.totalMs=0;pathBuildMetrics.maxMs=0;
 },[elements]);
 return <>{elements.map(element=>element.type==='text'?<TextLayer key={element.id} element={element} fonts={fonts}/>:<StrokeLayer key={element.id} element={element}/>)}</>;
});
export function DrawingCanvas({pageId,content,template,paperColor,tool,brush,eraserSize,eraserMode='pixel',onChange,onAddImage,onDrawingActive,onFinishEditingReady,onStrokeComplete,shapeKind='auto',shapeFill=false,onSelectionChange,onSelectionClipboardChange,onSelectionActionComplete,selectionAction,transformMode=false,onImageSelectionChange,onImageLoadError,imageRequest,onImageRequestConsumed,imageAction,textStyle={fontSize:48,color:'#1B1B2F',bold:false,align:'left'}}:Props){
 const imageRenderProbeEnabled=useMemo(()=>{
  if(Platform.OS!=='web'||!isTauriDevelopmentRuntime())return false;
  try{return window.localStorage.getItem('notexImageRenderProbe')==='1'}catch{return false}
 },[]);
 const imageRenderProbe=useMemo(()=>{
  if(!imageRenderProbeEnabled)return null;
  try{
   const decoded=Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(IMAGE_RENDER_PROBE_BASE64));
   logImageDebug(decoded?'isolated_render_probe_decode_succeeded':'isolated_render_probe_decode_failed',{format:'png',persistent:false});
   return decoded;
  }catch(error){logImageDebug('isolated_render_probe_decode_failed',{format:'png',persistent:false,error:String(error)});return null}
 },[imageRenderProbeEnabled]);
 const desktopSurfaceRef=useRef<any>(null);
 const pressureEnabled=useSettingsStore(state=>state.penSettings.pressureEnabled);
 const pressureSensitivity=useSettingsStore(state=>state.penSettings.pressureSensitivity);
 const fingerDraw=useSettingsStore(state=>state.penSettings.fingerDraw);
 const stylusOnly=useSettingsStore(state=>state.penSettings.stylusOnly);
 const sharedFonts=React.useContext(CanvasFontsContext);
 const textFonts=sharedFonts;
 const [editing,setEditing]=useState<TextElement|null>(null);
 const pendingCloseRef=useRef<{id:string;text:string;remove:boolean}|null>(null);
 const [,setKeyboardLayoutTick]=useState(0);

 const editingRef=useRef<TextElement|null>(null);

 const editValueRef=useRef('');
 const textSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clearTextSaveTimer=()=>{if(textSaveTimer.current!==null){clearTimeout(textSaveTimer.current);textSaveTimer.current=null}};
 // Keep the original editor mounted until the updated content reaches the canvas.
 // No duplicate text layer or temporary rendered copy is created.
 useLayoutEffect(()=>{
  const pending=pendingCloseRef.current;
  if(!pending)return;
  const saved=content.elements.find(e=>e.id===pending.id);
  if(pending.remove?!saved:saved?.type==='text'&&saved.text===pending.text){
   pendingCloseRef.current=null;
   setEditing(null);
  }
 },[content]);
 const measureTextHeight=(element:TextElement,value:string,width:number)=>{
  const lines=value.split('\n');
  const charsPerLine=Math.max(1,Math.floor(width/(element.fontSize*0.55)));
  const lineCount=lines.reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/charsPerLine)),0);
  let height=Math.max(element.fontSize*1.25,lineCount*element.fontSize*1.25);
  if(textFonts&&value.trim()){
   const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(element.align)},textFonts);
   builder.pushStyle(paragraphTextStyle(element));
   builder.addText(value);builder.pop();
   const paragraph=builder.build();paragraph.layout(Math.max(1,width-8));
   height=Math.max(element.fontSize*1.25,paragraph.getHeight());
  }
  // The saved box height must never force deleted lines to remain visible.
  return Math.max(element.fontSize*1.3,height+8);
 };
 const persistTextGeometry=()=>{
  const current=editingRef.current;if(!current)return;
  const value=editValueRef.current;
  const width=Math.min(current.w,PAGE_WIDTH-current.x);
  const height=measureTextHeight(current,value,width);
  const next={...current,w:width,text:value,minHeight:height,bbox:[current.x,current.y,current.x+width,current.y+height] as [number,number,number,number]};
  const exists=content.elements.some(element=>element.id===current.id);
  if(value.trim()||exists){
   const elements=content.elements.filter(element=>element.id!==current.id);
   if(value.trim())elements.push(next);
   pendingCloseRef.current=null;
   onChange({...content,elements});
  }
  editingRef.current=next;setEditing(next);
 };
 const finishText=()=>{
  clearTextSaveTimer();
  const current=editingRef.current;if(!current)return;
  const value=editValueRef.current;
  const width=Math.min(current.w,PAGE_WIDTH-current.x);
  const height=measureTextHeight(current,value,width);
  const next={...current,w:width,text:value,bbox:[current.x,current.y,current.x+width,current.y+height] as [number,number,number,number]};
  if(isTauriTextWidthDebugEnabled())console.info('[Notex text-width]',{stage:'save_to_skia',id:current.id,textElementW:current.w,savedWidth:width,paragraphLayoutWidth:width,zoom:zoom.value,scale:fitWidth*zoom.value});
  const elements=content.elements.filter(e=>e.id!==current.id);
  if(value.trim())elements.push(next);
  editingRef.current=null;
  if(value.trim()||content.elements.some(e=>e.id===current.id)){
   pendingCloseRef.current={id:current.id,text:value,remove:!value.trim()};
   onChange({...content,elements});
  }else setEditing(null);
 };
 const finishRef=useRef(finishText);finishRef.current=finishText;
 const persistTextRef=useRef(persistTextGeometry);persistTextRef.current=persistTextGeometry;
 const scheduleTextSave=()=>{clearTextSaveTimer();textSaveTimer.current=setTimeout(()=>{textSaveTimer.current=null;persistTextRef.current()},500)};
 useEffect(()=>()=>clearTextSaveTimer(),[]);
 useEffect(()=>{onFinishEditingReady?.(()=>finishRef.current())},[onFinishEditingReady]);
 useEffect(()=>{if(tool!=='text'&&tool!=='select'&&editingRef.current)finishRef.current()},[tool]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(!editingRef.current)return false;finishRef.current();return true});return()=>sub.remove()},[]);
 const beginText=(x:number,y:number,requestedWidth?:number,requestedHeight?:number)=>{
   if(editingRef.current){finishRef.current();return;}
  const hit=[...content.elements].reverse().find(e=>e.type==='text'&&x>=e.bbox[0]&&x<=e.bbox[2]&&y>=e.bbox[1]&&y<=e.bbox[3]) as TextElement|undefined;
  const scale=Math.max(0.01,fitWidth*zoom.value);
  const initialWidth=Math.min(PAGE_WIDTH,Math.max(60,requestedWidth??280/scale));
  const initialHeight=Math.max(textStyle.fontSize*1.3+8,requestedHeight??0);
  const initialX=Math.max(0,Math.min(PAGE_WIDTH-initialWidth,x));
  const initialY=Math.max(0,Math.min(Math.max(0,pageHeight-initialHeight),y));
  const current=hit??{id:Crypto.randomUUID(),type:'text' as const,z:content.elements.length,createdAt:new Date().toISOString(),x:initialX,y:initialY,w:initialWidth,text:'',fontSize:textStyle.fontSize,color:textStyle.color,bold:textStyle.bold,italic:textStyle.italic??false,underline:textStyle.underline??false,align:textStyle.align,fontFamily:'Inter' as const,bbox:[initialX,initialY,initialX+initialWidth,initialY+initialHeight] as [number,number,number,number]};
  // Old text boxes may contain an oversized saved height; the editor frame
  // should reflect the current text, not the obsolete three-line placeholder.
  const textHeight=measureTextHeight(current,current.text,current.w);
  const fitted={...current,bbox:[current.x,current.y,current.x+current.w,current.y+textHeight] as [number,number,number,number]};
  pendingCloseRef.current=null;
  editingRef.current=fitted;editValueRef.current=fitted.text;setEditing(fitted);
 };
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const selectedRef=useRef<string[]>([]);selectedRef.current=selectedIds;
 const traceRef=useRef<{id:number;part:number;ids:string[];gestureEndAt:number|null;events:{t:number;event:string;ids:string[];detail?:unknown}[]}>({id:0,part:0,ids:[],gestureEndAt:null,events:[]});
 const traceSequence=useRef(0);
 const trace=(event:string,detail?:unknown)=>{if(!__DEV__||Platform.OS!=='android')return;const current=traceRef.current;if(!current.id)return;const t=Math.round(perfNow()*10)/10;if(event==='gesture_end')current.gestureEndAt=t;const timing=event==='react_render_commit'&&current.gestureEndAt!==null?{msSinceGestureEnd:Math.round((t-current.gestureEndAt)*10)/10}:{};current.events.push({t,event,ids:current.ids,detail:event==='react_render_commit'?{...(detail as Record<string,unknown>),...timing}:detail});if(current.events.length>80)current.events.shift()};
 const flushTrace=()=>{if(!__DEV__||Platform.OS!=='android')return;const current=traceRef.current;if(current.events.length){console.log('[Notex lasso-trace] '+JSON.stringify({operation:current.id,part:++current.part,pageId,measurement:'React commit and JS events; not presented Skia frames',events:current.events}));current.events=[]}};
 const beginTrace=(kind:string,bounds:readonly number[])=>{if(!__DEV__||Platform.OS!=='android')return;flushTrace();traceRef.current={id:++traceSequence.current,part:0,ids:selectedRef.current.slice(0,12),gestureEndAt:null,events:[]};trace('gesture_begin',{kind,bounds})};

 const [imageId,setImageId]=useState<string|null>(null);
 const imageIdRef=useRef<string|null>(null);imageIdRef.current=imageId;
 useEffect(()=>{if(!imageAction||!imageIdRef.current)return;const id=imageIdRef.current;
  if(imageAction.kind==='clear'){setImageId(null);onImageSelectionChange?.(null);return;}
  if(imageAction.kind==='delete'){onChange({...content,images:(content.images??[]).filter(i=>i.id!==id)});setImageId(null);onImageSelectionChange?.(null);return;}
  const factor=imageAction.kind==='grow'?1.2:1/1.2;
  onChange({...content,images:(content.images??[]).map(i=>i.id!==id?i:{...i,width:Math.max(50,Math.min(PAGE_WIDTH*2,i.width*factor)),height:Math.max(50,Math.min(PAGE_HEIGHT*2,i.height*factor))})});
 },[imageAction?.version]);
 useEffect(()=>{
  if(!selectionAction||selectionAction.pageId!==pageId)return;
  if(selectionAction.kind==='selectAll'){
   const allIds=content.elements.filter(element=>(element as Element&{locked?:boolean}).locked!==true).map(element=>element.id);
   resetPaintedTransform();setHandoff(null);setSelectedIds(allIds);onSelectionChange?.(allIds);
   onSelectionActionComplete?.(selectionAction.version);return;
  }
  if(selectionAction.kind==='copy'){writeSelectionClipboard(selectedElements);onSelectionClipboardChange?.(hasSelectionClipboard());onSelectionActionComplete?.(selectionAction.version);return;}
  if(selectionAction.kind==='clear'){
   clearElementSelection();
   onSelectionActionComplete?.(selectionAction.version);return;
  }
  const ids=new Set(selectedRef.current);
  if(selectionAction.kind==='cut'){
   if(ids.size){writeSelectionClipboard(content.elements.filter(element=>ids.has(element.id)));onSelectionClipboardChange?.(true);onChange({...content,elements:content.elements.filter(element=>!ids.has(element.id))});setSelectedIds([]);onSelectionChange?.([])}
   onSelectionActionComplete?.(selectionAction.version);return;
  }
  if(selectionAction.kind==='paste'||selectionAction.kind==='duplicate'){
   const source=selectionAction.kind==='paste'?readSelectionClipboard():content.elements.filter(e=>ids.has(e.id));
   if(!source.length){onSelectionActionComplete?.(selectionAction.version);return;}
   const copies=source.map((element,index)=>({...moveElement(element,20,20),id:Crypto.randomUUID(),z:content.elements.length+index}));
   const next=[...content.elements,...copies],copyIds=copies.map(element=>element.id);
   resetPaintedTransform();setHandoff(null);setSelectedIds(copyIds);onSelectionChange?.(copyIds);onChange(withHeight(next));onSelectionActionComplete?.(selectionAction.version);
   return;
  }
  if(!ids.size){onSelectionActionComplete?.(selectionAction.version);return;}
  let next:Element[]=content.elements;
  if(selectionAction.kind==='delete')next=next.filter(e=>!ids.has(e.id));
 if(selectionAction.kind==='move')next=next.map(e=>ids.has(e.id)?moveElement(e,selectionAction.dx??selectionAction.value??20,selectionAction.dy??selectionAction.value??20):e);
 if(selectionAction.kind==='scale')next=next.map(e=>ids.has(e.id)?scaleElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??1.1,selectionAction.value??1.1):e);
 if(selectionAction.kind==='rotate')next=next.map(e=>ids.has(e.id)?rotateElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??Math.PI/12):e);
 if(selectionAction.kind==='width')next=next.map(e=>ids.has(e.id)&&e.type==='stroke'?{...e,width:Math.max(0.1,Math.min(200,selectionAction.value??e.width))}:e);
 if(selectionAction.kind==='fontSize')next=next.map(e=>{if(!ids.has(e.id)||e.type!=='text')return e;const fontSize=Math.max(16,Math.min(200,selectionAction.value??e.fontSize));return {...e,fontSize};});
 if(selectionAction.kind==='front'||selectionAction.kind==='back'){
  const sorted=[...next].sort((a,b)=>a.z-b.z);
  const selected=sorted.filter(e=>ids.has(e.id)),others=sorted.filter(e=>!ids.has(e.id));
  next=(selectionAction.kind==='front'?[...others,...selected]:[...selected,...others]).map((e,z)=>({...e,z}));
 }
 if(selectionAction.kind==='color')next=next.map(e=>{if(!ids.has(e.id))return e;if(e.type==='stroke')return {...e,color:selectionAction.color??e.color};if(e.type==='text')return {...e,color:selectionAction.color??e.color};return {...e,stroke:{...e.stroke,color:selectionAction.color??e.stroke.color}}});
 if(selectionAction.kind==='textStyle'&&selectionAction.textStyle)next=next.map(e=>{if(!ids.has(e.id)||e.type!=='text')return e;const updated={...e,...selectionAction.textStyle};let height=Math.max(updated.fontSize*1.25,e.bbox[3]-e.bbox[1]);if(textFonts){const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(updated.align)},textFonts);builder.pushStyle(paragraphTextStyle(updated));builder.addText(updated.text);builder.pop();const paragraph=builder.build();paragraph.layout(updated.w);height=Math.max(updated.fontSize*1.25,paragraph.getHeight())}return {...updated,bbox:[updated.x,updated.y,updated.x+updated.w,updated.y+height] as [number,number,number,number]};});
  if(next!==content.elements){onChange(withHeight(next));if(selectionAction.kind==='delete'){setSelectedIds([]);onSelectionChange?.([])}}
  onSelectionActionComplete?.(selectionAction.version);
 },[selectionAction?.version]);
 const [size,setSize]=useState({width:300,height:450});
 const spacePan=useSharedValue(false),handPanActive=useSharedValue(false);
  const eraserCommitRef=useRef<{elements:Element[];generation:number}|null>(null);
 const canvasMountedAt=useRef(__DEV__?perfNow():0),firstCanvasLayoutLogged=useRef(false);
 const strokeTelemetryStart=useRef(0),strokeTelemetryPointer=useRef('unknown');
 const fitWidth=Math.max(0.01,size.width/PAGE_WIDTH);
 const pageHeight=Math.max(PAGE_HEIGHT,content.h??PAGE_HEIGHT,Math.ceil(size.height/fitWidth));
 const withHeight=(elements:Element[],minimum=pageHeight):PageContent=>({v:2,elements,images:content.images,backgroundImage:content.backgroundImage,h:Math.max(pageHeight,minimum)});
 const fitAll=Math.max(0.01,Math.min(fitWidth,size.height/pageHeight));
 const minZoom=1;
 const zoom=useSharedValue(1),offsetX=useSharedValue(0),offsetY=useSharedValue(0);
 useEffect(()=>{const adjust=(event:{endCoordinates:{height:number}})=>{const item=editingRef.current;if(!item)return;const scale=fitWidth*zoom.value;const estimatedBottom=offsetY.value+(item.bbox[3]+32)*scale;const visibleBottom=Math.max(80,size.height-event.endCoordinates.height);if(estimatedBottom>visibleBottom){offsetY.value-=estimatedBottom-visibleBottom;setKeyboardLayoutTick(v=>v+1)}};const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',adjust);return()=>show.remove()},[size.height,fitWidth]);
 const awaitingCommit=useSharedValue(false);
 const cursorX=useSharedValue(0),cursorY=useSharedValue(0),cursorOn=useSharedValue(false);
 const eraserWidth=useDerivedValue(()=>eraserSize*1.2/(fitWidth*zoom.value));
 const eraserRadius=useDerivedValue(()=>eraserWidth.value/2);
 const cursorOpacity=useDerivedValue(()=>cursorOn.value?0.6:0);
  const draft=useSharedValue(''),draftIsOutline=useSharedValue(false),handoffDraft=useSharedValue(''),eraserHandoffDraft=useSharedValue(''),eraserHandoffGeneration=useSharedValue(0),handoffGeneration=useSharedValue(0),handoffCommittedGeneration=useSharedValue(0),handoffIsOutline=useSharedValue(false),handoffColor=useSharedValue(brush.color),handoffOpacity=useSharedValue(brush.opacity),handoffWidth=useSharedValue(brush.width),handoffTool=useSharedValue<'pen'|'highlighter'>('pen'),baseZoom=useSharedValue(1),baseX=useSharedValue(0),baseY=useSharedValue(0),pinchX=useSharedValue(0),pinchY=useSharedValue(0);
 const draftPaintStyle=useDerivedValue(()=>draftIsOutline.value?'fill':'stroke');
 const handoffPaintStyle=useDerivedValue(()=>handoffIsOutline.value?'fill':'stroke');
 const handoffBlendMode=useDerivedValue(()=>handoffTool.value==='highlighter'?'multiply':'srcOver');
 const pinchPageX=useSharedValue(0),pinchPageY=useSharedValue(0);
 const samples=useSharedValue<SampleBuffer>(emptySampleBuffer()),blocked=useSharedValue(false),drawing=useSharedValue(false);
 const shiftDown=useSharedValue(false);
 const dragX=useSharedValue(0),dragY=useSharedValue(0),draggingSelection=useSharedValue(false);

 const dragPending=useSharedValue(false);
 const selectionGestureGeneration=useSharedValue(0);
 const cornerActive=useSharedValue(false),cornerStartX=useSharedValue(0),cornerStartY=useSharedValue(0);
 const cornerCenterX=useSharedValue(0),cornerCenterY=useSharedValue(0);
 const cornerStartRadius=useSharedValue(1),cornerStartAngle=useSharedValue(0);
 const cornerLastAngle=useSharedValue(0),cornerAccumAngle=useSharedValue(0);
 const cornerMode=useSharedValue(0); // 0 undecided, 1 resize, 2 rotate
 const cornerStartPageX=useSharedValue(0),cornerStartPageY=useSharedValue(0);
 const gestureScale=useSharedValue(1),gestureAngle=useSharedValue(0);
 const gestureDX=useSharedValue(0),gestureDY=useSharedValue(0);
 // Keep the preview pose until the final shape is mounted on release.
 const selectionPreviewLive=useSharedValue(false);
 const transformActive=useSharedValue(false),transformPending=useSharedValue(false);
 const [handoff,setHandoff]=useState<{elements:Element[];bounds:readonly [number,number,number,number];rotation:number;dx:number;dy:number;scale:number;angle:number;generation:number}|null>(null);
 const pendingHandoff=useRef(false);
 const rotateActive=useSharedValue(false),pinchActive=useSharedValue(false);
 const gestureFocalX=useSharedValue(0),gestureFocalY=useSharedValue(0);
 const gestureCenterX=useSharedValue(0),gestureCenterY=useSharedValue(0);

 const selectedElements=useMemo(()=>content.elements.filter(e=>selectedIds.includes(e.id)),[content,selectedIds]);
 const selectionCanRotate=false; // Rotation is intentionally outside the new Lasso scope.
 const selectionCanRotateValue=useSharedValue(selectionCanRotate);
 useEffect(()=>{selectionCanRotateValue.value=selectionCanRotate;},[selectionCanRotate]);
  // Only retain a handoff while it represents the same selection.
  const handoffMatchesSelection=!!handoff&&handoff.elements.length===selectedIds.length&&
   handoff.elements.every(e=>selectedIds.includes(e.id));
 // Freeze the selected Skia paths for the entire selection session.
 // Saving a gesture updates document data, NOT the visible path tree.
 const selectionKey=selectedIds.join('|');
 const frozenSelection=useRef<{key:string;elements:Element[];frame:ReturnType<typeof selectionFrame>}|null>(null);
  const frozenContentElements=useRef(content.elements);
 if(!frozenSelection.current||frozenSelection.current.key!==selectionKey){
  frozenSelection.current={key:selectionKey,elements:selectedElements,frame:selectionFrame(selectedElements)};
 }
  // A transform commit can land one React render after the gesture ends.
  // Track document commit independently from whether selection is still active.
  const handoffIsCommitted=isSelectionHandoffCommitted(handoff?.elements??null,content.elements);
  const handoffNeedsReleaseRender=needsReleasedSelectionHandoff(!!handoff,handoffIsCommitted,tool==='select',handoffMatchesSelection);
  if(frozenContentElements.current!==content.elements){
   // During a pending move, the frozen paths must remain at their pointerdown geometry.
   // Replacing them with the newly committed paths while the preview offset is live
   // would apply the same movement twice and cause a forward jump.
   if(!handoffIsCommitted&&!(handoffMatchesSelection&&pendingHandoff.current))frozenSelection.current={key:selectionKey,elements:selectedElements,frame:selectionFrame(selectedElements)};
   frozenContentElements.current=content.elements;
  }
 // Before the page commit, keep the frozen source paths under the live
 // transform. As soon as the exact final objects are in content, swap the
 // selected overlay to those same objects and remove the preview transform.
 const renderCommittedSelection=shouldUseCommittedSelectionGeometry(handoffIsCommitted,handoffMatchesSelection);
  if(renderCommittedSelection)frozenSelection.current={key:selectionKey,elements:handoff!.elements,frame:{bounds:handoff!.bounds,rotation:handoff!.rotation}};
 const paintedElements=renderCommittedSelection?handoff!.elements:frozenSelection.current.elements;
 const paintedFrame=renderCommittedSelection?{bounds:handoff!.bounds,rotation:handoff!.rotation}:frozenSelection.current.frame;
 const committedDX=useSharedValue(0),committedDY=useSharedValue(0);
 const committedScale=useSharedValue(1),committedAngle=useSharedValue(0);
 const resetPaintedTransform=()=>{
  trace('shared_transform_reset',{dx:committedDX.value+dragX.value+gestureDX.value,dy:committedDY.value+dragY.value+gestureDY.value,scale:committedScale.value*gestureScale.value,angle:committedAngle.value+gestureAngle.value,pendingDrag:dragPending.value,pendingTransform:transformPending.value});
  committedDX.value=0;committedDY.value=0;
  committedScale.value=1;committedAngle.value=0;
  dragX.value=0;dragY.value=0;gestureScale.value=1;gestureAngle.value=0;
   dragPending.value=false;transformPending.value=false;
 };
 const tracedContentRef=useRef(content.elements);
 useLayoutEffect(()=>{resetPaintedTransform();},[selectionKey,tool]);
 useLayoutEffect(()=>{
  const contentReferenceChanged=tracedContentRef.current!==content.elements;
  tracedContentRef.current=content.elements;
  if(!__DEV__||Platform.OS!=='android'||!traceRef.current.id)return;
  const hidden=new Set(tool==='select'?selectedIds:[]);
  if(handoffNeedsReleaseRender)for(const element of handoff!.elements)hidden.add(element.id);
  const relevant=new Set([...selectedIds,...(handoff?.elements.map(e=>e.id)??[])]);
  trace('react_render_commit',{
   scope:'tracked element IDs',contentReferenceChanged,
   committed:handoffIsCommitted,pending:pendingHandoff.current,
   completedHidden:[...hidden].slice(0,12),
   completedDrawn:content.elements.filter(e=>relevant.has(e.id)&&!hidden.has(e.id)).slice(0,12).map(e=>({id:e.id,bbox:e.bbox})),
   selectionActive:tool==='select'&&!!paintedFrame,
   selectionDrawn:tool==='select'?paintedElements.slice(0,12).map(e=>({id:e.id,bbox:e.bbox})):[],
   handoffActive:handoffNeedsReleaseRender,
   handoffDrawn:handoffNeedsReleaseRender?handoff!.elements.slice(0,12).map(e=>({id:e.id,bbox:e.bbox})):[],
   transform:{dx:committedDX.value+dragX.value+gestureDX.value,dy:committedDY.value+dragY.value+gestureDY.value,scale:committedScale.value*gestureScale.value,angle:committedAngle.value+gestureAngle.value},
   previewApplied:shouldApplySelectionPreviewTransform(renderCommittedSelection,draggingSelection.value||cornerActive.value||transformActive.value,dragPending.value||transformPending.value,handoff?.generation??-1,selectionGestureGeneration.value),
   handoffGeneration:handoff?.generation??null,gestureGeneration:selectionGestureGeneration.value,
  });
 },[content.elements,handoff,selectedIds,tool]);


 // Use the same committed baseline for drawing, hit-testing and the next edit.
 // Parent content can arrive a render later than the locally committed handoff.
 const baselineElements=handoffMatchesSelection?handoff!.elements:selectedElements;
 const selectedFrame=useMemo(()=>selectionFrame(selectedElements),[selectedElements]);
 // Use the same geometry for gesture hit-testing, transform center and rendering.
 // A retained handoff is the current visible baseline until another commit.
 const selectedBounds=handoffMatchesSelection?handoff!.bounds:(selectedFrame?.bounds??null);
 const selectedRotation=handoffMatchesSelection?handoff!.rotation:(selectedFrame?.rotation??0);
 // Match the actual painted outline rather than an arbitrary 10-unit
 // gap. Scaling the shared Group now keeps the frame flush with the stroke.
 const selectionPadding=Math.max(0,...baselineElements.map(e=>e.type==='shape'?e.stroke.width/2:0));
 const selectionPaddingValue=useSharedValue(0);
 useEffect(()=>{selectionPaddingValue.value=selectionPadding;},[selectionPadding]);
 const selectedRotationValue=useSharedValue(0);
 useEffect(()=>{selectedRotationValue.value=selectedRotation;},[selectedRotation]);
 // As soon as persisted geometry arrives, the handoff draws that geometry
 // instead of re-projecting the old path. This prevents stale-size flashes.
 // The handoff always contains the FINAL geometry, never an old path.
 // Switching between old and new paths was the source of the release flash.
 const handoffBounds=handoffMatchesSelection?handoff!.bounds:null;
 const handoffRotation=handoffMatchesSelection?handoff!.rotation:0;
 // The frame and shape share exactly one live Group transform.
 // Avoid double-scaling the frame on the first gesture.
 const selectionBoundsValue=useSharedValue<readonly [number,number,number,number]|null>(null);
 useEffect(()=>{selectionBoundsValue.value=selectedBounds;},[selectedBounds]);
 const dragTransform=useDerivedValue(()=>[{translateX:dragX.value},{translateY:dragY.value}]);
 // A fixed-length transform keeps Skia's animated property binding intact
 // for the first and every subsequent gesture.
 const paintedCenterX=paintedFrame?(paintedFrame.bounds[0]+paintedFrame.bounds[2])/2:0;
 const paintedCenterY=paintedFrame?(paintedFrame.bounds[1]+paintedFrame.bounds[3])/2:0;
 const paintedHandoffGeneration=handoff?.generation??-1;
  const selectionTransform=useDerivedValue(()=>{
   const applyPreview=shouldApplySelectionPreviewTransform(renderCommittedSelection,draggingSelection.value||cornerActive.value||transformActive.value,dragPending.value||transformPending.value,paintedHandoffGeneration,selectionGestureGeneration.value);
   return [
   {translateX:applyPreview?committedDX.value+dragX.value+gestureDX.value:0},
   {translateY:applyPreview?committedDY.value+dragY.value+gestureDY.value:0},
  {translateX:paintedCenterX},
  {translateY:paintedCenterY},
   {rotate:applyPreview?committedAngle.value+gestureAngle.value:0},
   {scale:applyPreview?committedScale.value*gestureScale.value:1},
  {translateX:-paintedCenterX},
  {translateY:-paintedCenterY}
   ];
  });
 const deleteSelectedImage=()=>{const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).filter(i=>i.id!==id)});setImageId(null);onImageSelectionChange?.(null);setDisplayImageId(null);paintedImageIdRef.current=null;};
 const clearElementSelection=()=>{
  const keepPendingHandoff=!!handoff&&pendingHandoff.current&&!handoffIsCommitted;
  trace('selection_clear',{handoff:!!handoff,committed:handoffIsCommitted,pending:pendingHandoff.current});
  setSelectedIds([]);onSelectionChange?.([]);
  // Keep the mounted preview pose until React removes the selection layer.
  // The selectionKey layout effect resets it after that commit.
  if(!keepPendingHandoff){trace('handoff_clear',{reason:'selection_clear'});setHandoff(null);}
 };
 const selectAt=(x:number,y:number,extend=false)=>{
  const image=[...(content.images??[])].reverse().find(i=>{const cx=i.x+i.width/2,cy=i.y+i.height/2,a=-(i.rotation??0),dx=x-cx,dy=y-cy,px=dx*Math.cos(a)-dy*Math.sin(a)+cx,py=dx*Math.sin(a)+dy*Math.cos(a)+cy;return px>=i.x&&px<=i.x+i.width&&py>=i.y&&py<=i.y+i.height});
  if(image){setImageId(image.id);onImageSelectionChange?.(image.id);clearElementSelection();return;}
  setImageId(null);onImageSelectionChange?.(null);
  const margin=16/fitWidth;
  const hit=[...content.elements].reverse().find(e=>(e as Element&{locked?:boolean}).locked!==true&&x>=e.bbox[0]-margin&&x<=e.bbox[2]+margin&&y>=e.bbox[1]-margin&&y<=e.bbox[3]+margin);
  if(hit){
   const ids=extend?(selectedRef.current.includes(hit.id)?selectedRef.current.filter(id=>id!==hit.id):[...selectedRef.current,hit.id]):[hit.id];
   if(ids.join('|')!==selectedRef.current.join('|')){resetPaintedTransform();setHandoff(null)}
   setSelectedIds(ids);onSelectionChange?.(ids);
  }
  else if(!extend&&shouldDismissSelectionOnBlankTap(tool==='select',selectedRef.current.length>0,false))clearElementSelection();
 };
 const completeLasso=(points:Sample[])=>{
  const polygon=points.flatMap(point=>[point[0],point[1]]);
  const ids=lassoSelect(content.elements,polygon);
  resetPaintedTransform();setHandoff(null);setImageId(null);onImageSelectionChange?.(null);
  const selectedNow=content.elements.filter(element=>ids.includes(element.id));
  frozenSelection.current={key:ids.join('|'),elements:selectedNow,frame:selectionFrame(selectedNow)};
  frozenContentElements.current=content.elements;
  setSelectedIds(ids);onSelectionChange?.(ids);
 };
 const commitSelectionMove=(dx:number,dy:number,generation:number)=>{
  trace('runOnJS_commit_start',{kind:'move',dx,dy});
  if(Math.hypot(dx,dy)<0.1)return;
  const ids=new Set(selectedRef.current);
  if(!ids.size)return;
  const b=selectedBounds;
  if(!b)return;
  const baseline=new Map(baselineElements.map(e=>[e.id,e]));
  const next=content.elements.map(e=>ids.has(e.id)?moveElement(baseline.get(e.id)??e,dx,dy):e);
  const finalElements=next.filter(e=>ids.has(e.id));
  const finalFrame=selectionFrame(finalElements);
  if(!finalFrame)return;
  trace('final_bbox',finalElements.slice(0,12).map(e=>({id:e.id,bbox:e.bbox})));
  pendingHandoff.current=true;
  trace('handoff_created',{bounds:finalFrame.bounds});
  setHandoff({elements:finalElements,bounds:finalFrame.bounds,rotation:finalFrame.rotation,dx:0,dy:0,scale:1,angle:0,generation});
  trace('onChange',{count:next.length});
  onChange(withHeight(next));
 };
 const commitGesture=(dx:number,dy:number,scale:number,angle:number,generation:number)=>{
  trace('runOnJS_commit_start',{kind:'transform',dx,dy,scale,angle});
  const ids=new Set(selectedRef.current);
  if(!ids.size)return;
  // Text elements have no persisted rotation model. Never preview a rotation
  // that cannot be committed to the document.
  if(baselineElements.some(element=>ids.has(element.id)&&element.type==='text'))angle=0;
  const b=selectedBounds;
  if(!b)return;
  const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const baseline=new Map(baselineElements.map(e=>[e.id,e]));
  const next=content.elements.map(e=>{
   if(!ids.has(e.id))return e;
   let out=baseline.get(e.id)??e;
   if(Math.abs(scale-1)>0.0001)out=scaleElement(out,cx,cy,scale,scale);
   if(Math.abs(angle)>0.0001){
    out=rotateElement(out,cx,cy,angle);
    if(out.type==='shape'){
     const p=out.params;
     const sx=p.x+p.w/2,sy=p.y+p.h/2;
     const rx=cx+(sx-cx)*cos-(sy-cy)*sin;
     const ry=cy+(sx-cx)*sin+(sy-cy)*cos;
     out=moveElement(out,rx-sx,ry-sy);
    }
   }
   if(Math.abs(dx)+Math.abs(dy)>0.0001)out=moveElement(out,dx,dy);
   return out;
  });
  // Publish the final path and its matching selection frame together.
  // No stale geometry is ever drawn while React/Skia apply the update.
  const finalElements=next.filter(e=>ids.has(e.id));
  const finalFrame=selectionFrame(finalElements);
  if(!finalFrame)return;
  trace('final_bbox',finalElements.slice(0,12).map(e=>({id:e.id,bbox:e.bbox})));
  pendingHandoff.current=true;
  trace('handoff_created',{bounds:finalFrame.bounds});
  setHandoff({elements:finalElements,bounds:finalFrame.bounds,rotation:finalFrame.rotation,dx:0,dy:0,scale:1,angle:0,generation});
  trace('onChange',{count:next.length});
  onChange(withHeight(next));
 };
 // Keep the released preview pose until the exact final objects are in content.
 useLayoutEffect(()=>{
  if(!handoff)return;
  if(handoffIsCommitted){
   trace('content_commit_confirmed',{final:handoff.elements.map(e=>content.elements.find(item=>item.id===e.id)).filter((e):e is Element=>!!e).slice(0,12).map(e=>({id:e.id,bbox:e.bbox}))});
   pendingHandoff.current=false;
   if(selectionGestureGeneration.value===handoff.generation){
    trace('shared_transform_pending_reset',{handoff:handoff.elements.map(e=>e.id),dx:committedDX.value+dragX.value+gestureDX.value,dy:committedDY.value+dragY.value+gestureDY.value,scale:committedScale.value*gestureScale.value,angle:committedAngle.value+gestureAngle.value,pendingDrag:dragPending.value,pendingTransform:transformPending.value});
    resetPaintedTransform();
   }
   if(tool!=='select'||!handoffMatchesSelection){trace('handoff_clear',{reason:'committed_release'});setHandoff(null)}
   return;
  }
  // Keep final geometry until the exact elements are present in document
  // content. If it is no longer a pending edit (Undo/external content change),
  // its overlay is stale and can be discarded.
  if((tool!=='select'||!handoffMatchesSelection)&&pendingHandoff.current){resetPaintedTransform();return;}
  if(!pendingHandoff.current){trace('handoff_clear',{reason:'stale'});setHandoff(null);resetPaintedTransform();}
 },[content.elements,handoff,handoffIsCommitted,handoffMatchesSelection,tool]);
 useEffect(()=>{
  const available=new Set(content.elements.map(element=>element.id));
  const current=selectedRef.current;
  const valid=current.filter(id=>available.has(id));
  if(valid.length!==current.length){setSelectedIds(valid);onSelectionChange?.(valid);}
 },[content.elements]);
 // Keep the committed geometry mounted as the selected shape's baseline.
 // Removing the handoff after React's commit caused a second Skia scene
 // replacement, briefly repainting the previous geometry on CanvasKit.
 // It is cleared only when selection/tool identity changes.
 useEffect(()=>{
  if(tool!=='select'||selectedIds.length===0){
   if(handoff&&pendingHandoff.current&&!handoffIsCommitted){resetPaintedTransform();return;}
   trace('handoff_clear',{reason:'selection_closed'});pendingHandoff.current=false;setHandoff(null);
  }
 },[tool,selectedIds.length,handoff,handoffIsCommitted]);
  useEffect(()=>{if(handoffIsCommitted||(!handoff&&selectedIds.length===0))flushTrace()},[handoffIsCommitted,handoff,selectedIds.length]);
  const selectionStart=useSharedValue<Sample|null>(null);
  const textDragStart=useSharedValue<Sample|null>(null);
  const lassoDrawing=useSharedValue(false);
  useEffect(()=>{if(tool!=='select'){if(lassoDrawing.value){lassoDrawing.value=false;samples.value=emptySampleBuffer();draft.value=''}if(selectedRef.current.length){setSelectedIds([]);onSelectionChange?.([])}}},[tool]);
 const originX=useDerivedValue(()=>(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value);
 const originY=useDerivedValue(()=>offsetY.value);
 const transform=useDerivedValue(()=>[{translateX:originX.value},{translateY:originY.value},{scale:fitWidth*zoom.value}]);
 const clamp=useCallback((z:number,x:number,y:number):[number,number]=>{ 'worklet';
  const pw=PAGE_WIDTH*fitWidth*z,ph=pageHeight*fitWidth*z;
  const limitX=Math.max(0,(pw-size.width)/2);
  const minY=Math.min(0,size.height-ph),maxY=0;
  return [Math.max(-limitX,Math.min(limitX,x)),Math.max(minY,Math.min(maxY,y))];
 },[size.width,size.height,fitWidth,pageHeight]);
 useEffect(()=>{
  if(!isTauriDesktop()||typeof window==='undefined')return;
  const surface=desktopSurfaceRef.current as HTMLElement|null;
  if(!surface)return;
  const stopNonPrimaryPointer=(event:PointerEvent)=>{
   if(event.button===0)return;
   event.preventDefault();event.stopImmediatePropagation();
  };
  const stopContextMenu=(event:MouseEvent)=>event.preventDefault();
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   const rect=surface.getBoundingClientRect();
   const unit=event.deltaMode===WheelEvent.DOM_DELTA_LINE?16:event.deltaMode===WheelEvent.DOM_DELTA_PAGE?rect.height:1;
   const dx=event.deltaX*unit,dy=event.deltaY*unit;
   if(event.ctrlKey){
    const currentZoom=zoom.value;
    const pointerX=event.clientX-rect.left,pointerY=event.clientY-rect.top;
    const pageX=(pointerX-originX.value)/(fitWidth*currentZoom);
    const pageY=(pointerY-originY.value)/(fitWidth*currentZoom);
    const nextZoom=Math.max(minZoom,Math.min(5,currentZoom*Math.exp(-dy*0.0015)));
    const nextWidth=PAGE_WIDTH*fitWidth*nextZoom;
    const nextX=pointerX-pageX*fitWidth*nextZoom-(size.width-nextWidth)/2;
    const nextY=pointerY-pageY*fitWidth*nextZoom;
    const [x,y]=clamp(nextZoom,nextX,nextY);
    zoom.value=nextZoom;offsetX.value=x;offsetY.value=y;
   }else{
    const [x,y]=clamp(zoom.value,offsetX.value-dx,offsetY.value-dy);
    offsetX.value=x;offsetY.value=y;
   }
  };
  const isTextTarget=(target:EventTarget|null)=>target instanceof HTMLElement&&
   (target.isContentEditable||!!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
  const isControlTarget=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('button,a,[role="button"],input,textarea,select,[contenteditable="true"]');
  const keyDown=(event:KeyboardEvent)=>{
   if(event.key==='Shift')shiftDown.value=true;
   if(event.code!=='Space'||isTextTarget(event.target)||isControlTarget(event.target))return;
   if(event.target===document.body||surface.contains(event.target as Node)){
    event.preventDefault();spacePan.value=true;
   }
  };
  const keyUp=(event:KeyboardEvent)=>{if(event.code==='Space')spacePan.value=false;if(event.key==='Shift')shiftDown.value=false};
  const blur=()=>{spacePan.value=false;shiftDown.value=false;handPanActive.value=false};
  surface.addEventListener('pointerdown',stopNonPrimaryPointer,true);
  surface.addEventListener('contextmenu',stopContextMenu,true);
  surface.addEventListener('wheel',wheel,{passive:false});
  window.addEventListener('keydown',keyDown);
  window.addEventListener('keyup',keyUp);
  window.addEventListener('blur',blur);
  return()=>{
   surface.removeEventListener('pointerdown',stopNonPrimaryPointer,true);
   surface.removeEventListener('contextmenu',stopContextMenu,true);
   surface.removeEventListener('wheel',wheel);
   window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);
   spacePan.value=false;handPanActive.value=false;
  };
 },[clamp,fitWidth,minZoom,originX,size.height,size.width]);
 const layout=(e:LayoutChangeEvent)=>{const {width,height}=e.nativeEvent.layout;if(__DEV__&&!firstCanvasLayoutLogged.current){firstCanvasLayoutLogged.current=true;const dimensions={width:Math.round(width),height:Math.round(height)};requestAnimationFrame(()=>requestAnimationFrame(()=>console.log('[Notex perf] first_canvas_visible',{duration_ms:Math.round((perfNow()-canvasMountedAt.current)*10)/10,...dimensions})))}if(width===size.width&&height===size.height)return;setSize({width,height});if(!isTauriDesktop()){zoom.value=1;offsetX.value=0;offsetY.value=0;return;}const fit=Math.max(0.01,width/PAGE_WIDTH),pageH=Math.max(PAGE_HEIGHT,content.h??PAGE_HEIGHT,Math.ceil(height/fit)),z=zoom.value,limitX=Math.max(0,(PAGE_WIDTH*fit*z-width)/2),minY=Math.min(0,height-pageH*fit*z);offsetX.value=Math.max(-limitX,Math.min(limitX,offsetX.value));offsetY.value=Math.max(minY,Math.min(0,offsetY.value))};
 const pagePoint=(x:number,y:number):Sample=>{ 'worklet';return [(x-originX.value)/(fitWidth*zoom.value),(y-originY.value)/(fitWidth*zoom.value),0.5]};
 const imageProbeCenter=imageRenderProbe?pagePoint(size.width/2,size.height/2):null;
 useEffect(()=>{
  if(content.images?.length)logImageDebug('canvas_received_page_images',{pageId,count:content.images.length,elementIds:content.images.map(image=>image.id)});
 },[pageId,content.images]);
 useEffect(()=>{
  if(imageRenderProbe&&imageProbeCenter)logImageDebug('isolated_render_probe_canvas_layer_ready',{pageId,persistent:false,coordinateSpace:'page',measurement:'Skia JSX layer prepared; not a physical frame capture'});
 },[pageId,imageRenderProbe,imageProbeCenter?.[0],imageProbeCenter?.[1]]);
 const consumedImageRequest=useRef<number|null>(null);
 useEffect(()=>{
  if(!imageRequest||consumedImageRequest.current===imageRequest.version)return;
  consumedImageRequest.current=imageRequest.version;
  logImageDebug('canvas_received_image_request',{pageId,version:imageRequest.version,width:imageRequest.width,height:imageRequest.height});
  let active=true;
  void decodeStoredPageImage(imageRequest.uri).then(()=>{
   if(!active)return;
   const center=pagePoint(size.width/2,size.height/2);
   const x=Math.max(0,Math.min(PAGE_WIDTH-imageRequest.width,center[0]-imageRequest.width/2));
   const y=Math.max(0,Math.min(Math.max(0,pageHeight-imageRequest.height),center[1]-imageRequest.height/2));
   const image:PageImage={id:Crypto.randomUUID(),uri:imageRequest.uri,x,y,width:imageRequest.width,height:imageRequest.height};
   if(!onAddImage){logImageDebug('page_add_callback_missing',{pageId});throw new Error('Sayfaya görsel ekleme bağlantısı hazır değil.')}
   logImageDebug('image_element_created',{pageId,elementId:image.id,bounds:[x,y,x+image.width,y+image.height]});
   onAddImage(image);
  }).catch(error=>{
   logImageDebug('skia_image_element_decode_failed',{pageId,format:imageRequest.uri.split('.').pop()?.toLowerCase(),errorType:error instanceof Error?error.name:typeof error,error:imageDebugError(error)});
   console.error('[Notex image] Selected page image could not be decoded',{uri:imageRequest.uri,error});
   void deleteStoredFile(imageRequest.uri).catch(cleanupError=>console.error('[Notex image] Failed import cleanup failed',{uri:imageRequest.uri,error:cleanupError}));
   if(active){
    onImageLoadError?.('Seçilen görsel okunamadı veya desteklenen bir biçimde değil. Lütfen başka bir PNG, JPG ya da WebP dosyası seçin.');
   }
  }).finally(()=>{if(active)onImageRequestConsumed?.(imageRequest.version)});
  return()=>{active=false};
 },[imageRequest?.version]);
 const endStroke=(points:Sample[],commitGeneration:number)=>{if(!points.length)return;
  if(tool==='select'){
  if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration))awaitingCommit.value=false;
  const poly=points.flatMap(p=>[p[0],p[1]]);
  const ids=lassoSelect(content.elements,poly);
  if(!ids.length&&points.length<=3){const p=points[0];const hit=content.elements.filter(e=>p[0]>=e.bbox[0]-12&&p[0]<=e.bbox[2]+12&&p[1]>=e.bbox[1]-12&&p[1]<=e.bbox[3]+12).at(-1);if(hit)ids.push(hit.id)}
  setSelectedIds(ids);onSelectionChange?.(ids);return;
 }
 if(tool==='shape'){
  if(__DEV__){
   const step=Math.max(1,Math.floor(points.length/150));
   const pts=points.filter((_,i)=>i%step===0).map(p=>[Math.round(p[0]),Math.round(p[1])]);
  }
  const first=points[0],last=points[points.length-1];
  if(shapeKind==='auto'){
   const r=recognizeShape(points);
   if(__DEV__)console.log('SHAPE_RESULT',JSON.stringify(r?{kind:r.kind,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.w),h:Math.round(r.h)}:null));
   if(r){
    const s=makeShape(r.kind,r.x,r.y,r.w,r.h,brush.color,brush.width,brush.opacity,shapeFill);
    if(r.kind==='polygon'&&r.points)s.params={...s.params,points:r.points};
    s.z=content.elements.length;
    if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration))handoffCommittedGeneration.value=commitGeneration;
    onChange(withHeight([...content.elements,s],s.bbox[3]+400));return;
   }
   // Unrecognized input falls through to the freehand stroke.
  }else{
   let w=last[0]-first[0],h=last[1]-first[1];
   if(Math.hypot(w,h)<8){if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration)){handoffDraft.value='';awaitingCommit.value=false}return}
   [w,h]=normalizeShapeSize(shapeKind,w,h);
   const shape=makeShape(shapeKind,first[0],first[1],w,h,brush.color,brush.width,brush.opacity,shapeFill);shape.z=content.elements.length;
   if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration))handoffCommittedGeneration.value=commitGeneration;
   onChange(withHeight([...content.elements,shape],shape.bbox[3]+400));return;
  }
 }
 if(tool==='eraser'){
     const radius=eraserSize*1.2/2/(fitWidth*zoom.value);
     const erased=pixelErase(content.elements,points,radius,eraserMode==='stroke');
       if(erased!==content.elements){
        eraserCommitRef.current={elements:erased,generation:commitGeneration};
        onChange(withHeight(erased));
       }
        else if(isCurrentEraseHandoff(eraserHandoffGeneration.value,commitGeneration)){
         const pending=eraserCommitRef.current;
         if(!pending){eraserHandoffDraft.value='';awaitingCommit.value=false}
         else{
          pending.generation=commitGeneration;
          if(hasCommittedErase(pending.elements,content.elements)){
           let second=0;
           const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
            if(!shouldReleaseEraserHandoff(eraserCommitRef.current?.elements??null,content.elements,eraserHandoffGeneration.value,commitGeneration))return;
            eraserHandoffDraft.value='';awaitingCommit.value=false;eraserCommitRef.current=null;
           })});
           void first;void second;
          }
         }
       }
     return;
   }
  const finalizeStarted=__DEV__?perfNow():0;
  let distanceTotal=0,maxPointGap=0;
  if(__DEV__){
   for(let index=1;index<points.length;index++){
    const gap=Math.hypot(points[index][0]-points[index-1][0],points[index][1]-points[index-1][1]);
    distanceTotal+=gap;maxPointGap=Math.max(maxPointGap,gap);
   }
   const durationMs=strokeTelemetryStart.current?Math.max(0,perfNow()-strokeTelemetryStart.current):0;
   console.log('[Notex ink perf] stroke_samples',{pointer:strokeTelemetryPointer.current,point_count:points.length,duration_ms:Math.round(durationMs*10)/10,approx_updates_per_second:durationMs>0?Math.round(Math.max(0,points.length-1)*1000/durationMs):null,mean_point_gap:points.length>1?Math.round(distanceTotal/(points.length-1)*100)/100:0,max_point_gap:Math.round(maxPointGap*100)/100});
   strokeTelemetryStart.current=0;
  }
  const stroke=makeStroke(points,{tool:tool==='highlighter'?'highlighter':'pen',...brush},Crypto.randomUUID(),content.elements.length);
  if(tool==='pen'&&pressureEnabled&&points.some(p=>p[2]!==0.5))stroke.renderMode='outline';
  const finalizedSvg=strokePathString(stroke);cacheFinalizedStrokePath(stroke,finalizedSvg);
  if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration)){handoffDraft.value=finalizedSvg;handoffColor.value=stroke.color;handoffOpacity.value=stroke.opacity;handoffWidth.value=stroke.width;handoffTool.value=stroke.tool;handoffIsOutline.value=stroke.renderMode==='outline'}
  if(__DEV__)console.log('[Notex perf] stroke_finalize',{duration_ms:Math.round((perfNow()-finalizeStarted)*10)/10,point_count:points.length});
  if(__DEV__)console.log('[Notex ink] endStroke kalÄ±cÄ± stroke Ã¼retiyor:',{pageId,tool:stroke.tool,pointCount:points.length,strokeId:stroke.id});
  if(isCurrentStrokeCommit(handoffGeneration.value,commitGeneration))handoffCommittedGeneration.value=commitGeneration;
  onChange(withHeight([...content.elements,stroke],stroke.bbox[3]+400));
  onStrokeComplete?.(tool==='highlighter'?'highlighter':'pen',brush.color);
 };
 const notify=(active:boolean)=>onDrawingActive?.(active);
 const complete=(buffer:SampleBuffer,commitGeneration:number)=>{endStroke(flattenSamples(buffer),commitGeneration);};
 // Release autosave's drawing barrier only after the JS-side edit is committed.
 const completeAndNotify=(buffer:SampleBuffer,commitGeneration:number)=>{
  try{complete(buffer,commitGeneration)}finally{notify(false)}
 };
 const transferActivePathToHandoff=()=>{'worklet';
  handoffGeneration.value+=1;
  handoffDraft.value=draft.value;handoffColor.value=brush.color;handoffOpacity.value=brush.opacity;handoffWidth.value=brush.width;
  handoffTool.value=tool==='highlighter'?'highlighter':'pen';handoffIsOutline.value=draftIsOutline.value;draft.value='';
  return handoffGeneration.value;
 };
  const transferEraserPathToHandoff=()=>{'worklet';
   eraserHandoffGeneration.value+=1;
   eraserHandoffDraft.value=eraserHandoffDraft.value?eraserHandoffDraft.value+' '+draft.value:draft.value;
   draft.value='';
   return eraserHandoffGeneration.value;
  };
 const finishInterruptedStroke=()=>{'worklet';
  const action=interruptedStrokeAction(tool,drawing.value,awaitingCommit.value,blocked.value,samples.value.length);
  if(action==='commit'){
   awaitingCommit.value=true;
    const commitGeneration=tool==='eraser'?transferEraserPathToHandoff():transferActivePathToHandoff();
   drawing.value=false;
   runOnJS(completeAndNotify)(samples.value,commitGeneration);
  }
  return action;
 };
 useEffect(()=>{
     if(!awaitingCommit.value)return;
     const scheduledGeneration=handoffCommittedGeneration.value;
     if(!isCurrentStrokeCommit(handoffGeneration.value,scheduledGeneration))return;
     let r2=0;
     const r1=requestAnimationFrame(()=>{r2=requestAnimationFrame(()=>{if(isCurrentStrokeCommit(handoffGeneration.value,scheduledGeneration)&&isCurrentStrokeCommit(handoffCommittedGeneration.value,scheduledGeneration)){handoffDraft.value='';awaitingCommit.value=false}})});
     return()=>{cancelAnimationFrame(r1);cancelAnimationFrame(r2)};
   },[content]);
  // Keep the clear-blend eraser preview mounted until React has committed the
  // matching erased element list. Otherwise old content can flash back in the
  // frame between the gesture worklet clearing `draft` and the JS onChange.
  useEffect(()=>{
   const pending=eraserCommitRef.current;
   if(!pending||!hasCommittedErase(pending.elements,content.elements))return;
   const generation=pending.generation;
   let second=0;
   const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
    if(!shouldReleaseEraserHandoff(eraserCommitRef.current?.elements??null,content.elements,eraserHandoffGeneration.value,generation))return;
    if(eraserCommitRef.current?.generation!==generation)return;
    eraserHandoffDraft.value='';awaitingCommit.value=false;eraserCommitRef.current=null;
   })});
   return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
  },[content]);
 const imageDragging=useSharedValue(false),imageDX=useSharedValue(0),imageDY=useSharedValue(0);
 const imageGestureLocked=useSharedValue(false);
 const imagePinching=useSharedValue(false),imageScale=useSharedValue(1),imageAngle=useSharedValue(0),imageRotateActive=useSharedValue(false),imagePinchActive=useSharedValue(false);
 const imageFocalX=useSharedValue(0),imageFocalY=useSharedValue(0),imageFocalDX=useSharedValue(0),imageFocalDY=useSharedValue(0);
 const imageBounds=useSharedValue<[number,number,number,number]|null>(null);
 const imagePaintBounds=useSharedValue<[number,number,number,number]|null>(null);
 const imageRotateHandle=useSharedValue(false),imageRotateStart=useSharedValue(0);
 const imageCorner=useSharedValue(false),imageCornerStart=useSharedValue(1),imageCornerX=useSharedValue(0),imageCornerY=useSharedValue(0);
 const imageCornerAnchorX=useSharedValue(0),imageCornerAnchorY=useSharedValue(0),imageCornerSignX=useSharedValue(1),imageCornerSignY=useSharedValue(1);
 const imageCommittedX=useSharedValue(0),imageCommittedY=useSharedValue(0),imageCommittedScale=useSharedValue(1),imageCommittedAngle=useSharedValue(0);
 const imageHandoff=useRef(false);
 // Keep the selected image's rendered geometry frozen until the Skia preview
 // and persisted geometry can be reconciled together, like shape selection.
 const [paintedImage,setPaintedImage]=useState<import('@/features/canvas/types').PageImage|null>(null);
 // UI gestures need only the frozen image rotation, never a mutable React ref.
 const paintedImageRotation=useSharedValue(0);
 
 const imageTransform=useDerivedValue(()=>{const b=imagePaintBounds.value,cx=b?(b[0]+b[2])/2:0,cy=b?(b[1]+b[3])/2:0;return [{translateX:imageCommittedX.value+imageDX.value+imageFocalDX.value},{translateY:imageCommittedY.value+imageDY.value+imageFocalDY.value},{translateX:cx},{translateY:cy},{rotate:imageCommittedAngle.value+imageAngle.value},{scale:imageCommittedScale.value*imageScale.value},{translateX:-cx},{translateY:-cy}]});
 // Selection chrome is drawn inside the scaled image group. Compensate for
 // image scale so the blue outline and corner handles stay visually constant.
 // Keep the rotation handle on the UI thread; never read a shared value during React render.
 const imageRotateY=useDerivedValue(()=>{const b=imagePaintBounds.value;return b?b[1]-48/Math.max(0.001,imageCommittedScale.value):0;});
 const imageRotatePoint=useDerivedValue(()=>{const b=imagePaintBounds.value;return vec(b?(b[0]+b[2])/2:0,imageRotateY.value);});
 const imageHandleScale=useDerivedValue(()=>1/Math.max(0.001,imageCommittedScale.value*imageScale.value));
 const imageOutlineWidth=useDerivedValue(()=>3*imageHandleScale.value);
 const imageHandleRadius=useDerivedValue(()=>9*imageHandleScale.value);
 const imageDeleteRadius=useDerivedValue(()=>30*imageHandleScale.value);
 const imageDeleteStroke=useDerivedValue(()=>3*imageHandleScale.value);
 const commitImagePinch=(dx:number,dy:number,scale:number,angle:number)=>{imageHandoff.current=true;const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).map(i=>{if(i.id!==id)return i;const w=Math.max(40,i.width*scale),h=Math.max(40,i.height*scale);return {...i,x:i.x+(i.width-w)/2+dx,y:i.y+(i.height-h)/2+dy,width:w,height:h,rotation:(i.rotation??0)+angle}})})};
 const finishImagePinch=()=>{'worklet';const dx=imageFocalDX.value,dy=imageFocalDY.value,scale=imageScale.value,angle=imageAngle.value;imagePinching.value=false;imageCommittedX.value+=dx;imageCommittedY.value+=dy;imageCommittedScale.value*=scale;imageCommittedAngle.value+=angle;imageFocalDX.value=0;imageFocalDY.value=0;imageScale.value=1;imageAngle.value=0;if(Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001)runOnJS(commitImagePinch)(dx,dy,scale,angle)};
 const commitImageMove=(dx:number,dy:number)=>{imageHandoff.current=true;const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).map(i=>i.id===id?{...i,x:i.x+dx,y:i.y+dy}:i)})};
 // Update the selection origin and retire the UI-thread preview in the same
 // layout commit as the persisted image geometry. A later passive effect
 // would shift the transform origin one frame after the image was repainted.
 // Like the proven shape-selection fix, keep one immutable Skia image
 // throughout selection. Repainting updated image geometry and resetting the
 // UI-thread transform in separate frames caused the visible release jitter.
 // Only reset the preview when a DIFFERENT image is selected/deselected.
 const paintedImageIdRef=useRef<string|null>(null);
 const [displayImageId,setDisplayImageId]=useState<string|null>(null);
 useLayoutEffect(()=>{
  const current=(content.images??[]).find(x=>x.id===imageId);
  imageBounds.value=current?[current.x,current.y,current.x+current.width,current.y+current.height]:null;
  // Deselecting must only remove the handles. Switching from the frozen
  // Skia baseline to persisted geometry on that tap caused a visible jump.
  if(imageId===null)return;
  if(paintedImageIdRef.current===imageId)return;
  paintedImageIdRef.current=imageId;
  setDisplayImageId(imageId);
  imageHandoff.current=false;
  imageCommittedX.value=0;imageCommittedY.value=0;
  imageCommittedScale.value=1;imageCommittedAngle.value=0;
  imageDX.value=0;imageDY.value=0;imageScale.value=1;imageAngle.value=0;
  imagePaintBounds.value=current?[current.x,current.y,current.x+current.width,current.y+current.height]:null;
  paintedImageRotation.value=current?.rotation??0;
  setPaintedImage(current??null);
 },[imageId,content.images]);
 const logPointerStart=(pointerType:string,currentTool:Tool,allowed:boolean)=>{if(__DEV__){console.log('[Notex canvas] pointer start:',{pointerType,tool:currentTool,fingerDraw:fingerDraw,stylusOnly:stylusOnly,allowed});if(allowed&&(currentTool==='pen'||currentTool==='highlighter')){strokeTelemetryStart.current=perfNow();strokeTelemetryPointer.current=pointerType}}};
 const pan=Gesture.Pan().minDistance(0).onTouchesDown(e=>{
  if(e.allTouches.length>1){const action=finishInterruptedStroke();blocked.value=true;lassoDrawing.value=false;imageDragging.value=false;imageDX.value=0;imageDY.value=0;samples.value=emptySampleBuffer();if(action==='discard')draft.value='';drawing.value=false}
 }).onBegin(e=>{
  if(e.numberOfPointers!==1||imageGestureLocked.value)return;
  const isStylus=e.pointerType===PointerType.STYLUS;
  runOnJS(logPointerStart)(String(e.pointerType),tool,!((stylusOnly||!fingerDraw)&&!isStylus&&['pen','highlighter','eraser','shape'].includes(tool)&&!imageBounds.value));
  if((stylusOnly||!fingerDraw)&&!isStylus&&['pen','highlighter','eraser','shape'].includes(tool)&&!imageBounds.value){blocked.value=true;samples.value=emptySampleBuffer();draft.value='';drawing.value=false;return;}
  // A previous two-finger gesture must not disable the next one-finger drag.
  blocked.value=false;
  if(tool==='hand'||spacePan.value){handPanActive.value=true;baseX.value=offsetX.value;baseY.value=offsetY.value;return}
  if(imageBounds.value&&imagePaintBounds.value){
   // Hit-test the actually painted image, not the persisted rectangle.
   // The painted geometry is frozen to prevent jitter, so after a pinch
   // the old rectangle no longer matches the image on screen.
   const p=pagePoint(e.x,e.y),bounds=imagePaintBounds.value;
   const cx=(bounds[0]+bounds[2])/2,cy=(bounds[1]+bounds[3])/2;
   const scale=Math.max(0.001,imageCommittedScale.value*imageScale.value);
   const angle=paintedImageRotation.value+imageCommittedAngle.value+imageAngle.value;
   const cos=Math.cos(angle),sin=Math.sin(angle);
   const dx=(p[0]-cx-imageCommittedX.value-imageDX.value)/scale;
   const dy=(p[1]-cy-imageCommittedY.value-imageDY.value)/scale;
   const lx=cx+dx*cos+dy*sin,ly=cy-dx*sin+dy*cos;
   const radius=24/(fitWidth*zoom.value)/scale;
   if(Platform.OS==='web'&&Math.hypot(lx-(cx),ly-(bounds[1]-48/scale))<radius){imageRotateHandle.value=true;imageRotateStart.value=Math.atan2(p[1]-cy-imageCommittedY.value,p[0]-cx-imageCommittedX.value);imageAngle.value=0;samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;}
   if(Platform.OS==='web'){
    const corners:[[number,number],[number,number],[number,number],[number,number]]=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[3]]];
    for(const [hx,hy] of corners){
     if(Math.hypot(lx-hx,ly-hy)>radius)continue;
     const anchorX=hx===bounds[0]?bounds[2]:bounds[0],anchorY=hy===bounds[1]?bounds[3]:bounds[1];
     imageCorner.value=true;imageCornerAnchorX.value=anchorX;imageCornerAnchorY.value=anchorY;
     imageCornerSignX.value=hx===bounds[0]?-1:1;imageCornerSignY.value=hy===bounds[1]?-1:1;
     // Capture the pointer and the CURRENT painted corner. Using the old
     // untransformed corner made the first update snap the image smaller.
     const vx=(hx-cx)*scale,vy=(hy-cy)*scale;
     const cornerDX=vx*cos-vy*sin,cornerDY=vx*sin+vy*cos;
     imageCornerStart.value=Math.max(1,Math.hypot(cornerDX,cornerDY));
     imageCornerX.value=p[0];imageCornerY.value=p[1];imageScale.value=1;
     samples.value=emptySampleBuffer();drawing.value=false;draft.value='';blocked.value=false;
     return;
    }
   }
   if(lx>=bounds[0]&&lx<=bounds[2]&&ly>=bounds[1]&&ly<=bounds[3]){imageDragging.value=true;imageDX.value=0;imageDY.value=0;samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;}
   // While an image is selected, a missed image hit must never fall
   // through to the pen. Tapping outside can still deselect the image.
   samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;
  }
  // Drag an already selected element immediately; don't wait for a long press.
  // The previous zero-distance Pan gesture prevented LongPress from reliably activating.
  if(tool==='select'&&selectionBoundsValue.value){
    if(renderCommittedSelection){committedDX.value=0;committedDY.value=0;committedScale.value=1;committedAngle.value=0;gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0}
   const p=pagePoint(e.x,e.y),b=selectionBoundsValue.value;
   const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   const cornerRadius=22/(fitWidth*zoom.value);
   const rotation=selectedRotationValue.value,cos=Math.cos(rotation),sin=Math.sin(rotation);
   const corners:[[number,number],[number,number],[number,number],[number,number]]=[
    [b[0]-selectionPaddingValue.value,b[1]-selectionPaddingValue.value],[b[2]+selectionPaddingValue.value,b[1]-selectionPaddingValue.value],[b[0]-selectionPaddingValue.value,b[3]+selectionPaddingValue.value],[b[2]+selectionPaddingValue.value,b[3]+selectionPaddingValue.value]
   ].map(([x,y])=>[cx+(x-cx)*cos-(y-cy)*sin,cy+(x-cx)*sin+(y-cy)*cos]) as [[number,number],[number,number],[number,number],[number,number]];
   let cornerHit=false;
   for(const corner of corners){
    if(shouldGrabSelectionCorner(p,corner,[cx,cy],cornerRadius)){
     cornerHit=true;
     selectionPreviewLive.value=true;
     cornerActive.value=true;cornerMode.value=0;
     cornerCenterX.value=cx;cornerCenterY.value=cy;
     cornerStartX.value=corner[0];cornerStartY.value=corner[1];
     cornerStartPageX.value=p[0];cornerStartPageY.value=p[1];
     cornerStartRadius.value=Math.max(1,Math.hypot(corner[0]-cx,corner[1]-cy));
     cornerStartAngle.value=Math.atan2(p[1]-cy,p[0]-cx);
     cornerLastAngle.value=cornerStartAngle.value;cornerAccumAngle.value=0;
     gestureCenterX.value=cx;gestureCenterY.value=cy;
     gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
     break;
    }
   }
   if(cornerHit){selectionGestureGeneration.value+=1;(__DEV__&&runOnJS(beginTrace)('corner',b));samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;}
   const hitSlop=12/(fitWidth*zoom.value);
   // Reuse the rotation matrix from the handle hit test above.
    const localX=cx+(p[0]-cx)*cos+(p[1]-cy)*sin;
    const localY=cy-(p[0]-cx)*sin+(p[1]-cy)*cos;
    if(localX>=b[0]-hitSlop&&localX<=b[2]+hitSlop&&localY>=b[1]-hitSlop&&localY<=b[3]+hitSlop){
    selectionPreviewLive.value=true;
    selectionGestureGeneration.value+=1;draggingSelection.value=true;dragX.value=0;dragY.value=0;(__DEV__&&runOnJS(beginTrace)('move',b));
    samples.value=emptySampleBuffer();drawing.value=false;draft.value='';
    return;
   }
  }
  if(tool==='text'){textDragStart.value=pagePoint(e.x,e.y);samples.value=emptySampleBuffer();drawing.value=false;draft.value='';blocked.value=false;return;}
  if(tool==='select'){
   const start=pagePoint(e.x,e.y);
   samples.value=sampleBufferFromPoint(start);drawing.value=false;lassoDrawing.value=true;draft.value=centerlinePathString([start]);
   return;
  }
  const start=pagePoint(e.x,e.y);
  if(!Number.isFinite(start[0])||!Number.isFinite(start[1])){samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;}
  samples.value=sampleBufferFromPoint(start);drawing.value=false;draft.value=centerlinePathString([start]);draftIsOutline.value=false;
  if(tool==='eraser'){
    const q=sampleBufferAt(samples.value,0);
    draft.value='M'+q[0]+' '+q[1]+' L'+(q[0]+0.01)+' '+q[1];
    cursorX.value=q[0];cursorY.value=q[1];cursorOn.value=true;drawing.value=true;runOnJS(notify)(true);
  }
 }).onUpdate(e=>{
  if(blocked.value||e.numberOfPointers!==1)return;
  if(imageRotateHandle.value){const p=pagePoint(e.x,e.y),b=imagePaintBounds.value;if(!b)return;const cx=(b[0]+b[2])/2+imageCommittedX.value,cy=(b[1]+b[3])/2+imageCommittedY.value;imageAngle.value=Math.atan2(p[1]-cy,p[0]-cx)-imageRotateStart.value;return;}
  if(imageCorner.value){
   const p=pagePoint(e.x,e.y),b=imagePaintBounds.value;if(!b)return;
   const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   const totalAngle=paintedImageRotation.value+imageCommittedAngle.value;
   const cos=Math.cos(totalAngle),sin=Math.sin(totalAngle);
   const vx=imageCornerSignX.value*(b[2]-b[0])/2;
   const vy=imageCornerSignY.value*(b[3]-b[1])/2;
   const ux=(vx*cos-vy*sin)/Math.max(1,Math.hypot(vx,vy));
   const uy=(vx*sin+vy*cos)/Math.max(1,Math.hypot(vx,vy));
   const movement=(p[0]-imageCornerX.value)*ux+(p[1]-imageCornerY.value)*uy;
   // Relative pointer movement starts at scale 1, even after repeated
   // resizes and rotations. Keep the frozen Skia baseline for no jitter.
   imageScale.value=Math.max(0.15,Math.min(8,1+movement/imageCornerStart.value));
   return;
  }
  if(imageDragging.value){imageDX.value=e.translationX/(fitWidth*zoom.value);imageDY.value=e.translationY/(fitWidth*zoom.value);return}
  if(blocked.value||imageBounds.value)return;
  if(tool==='hand'||handPanActive.value){const [x,y]=clamp(zoom.value,baseX.value+e.translationX,baseY.value+e.translationY);offsetX.value=x;offsetY.value=y;return}
  if(cornerActive.value){
   const p=pagePoint(e.x,e.y),cx=cornerCenterX.value,cy=cornerCenterY.value;
   const dx=p[0]-cornerStartPageX.value,dy=p[1]-cornerStartPageY.value;
   const startX=cornerStartX.value-cx,startY=cornerStartY.value-cy;
   const tangent=(-startY*dx+startX*dy)/cornerStartRadius.value;
   const radial=(startX*dx+startY*dy)/cornerStartRadius.value;
   // Decide the gesture after a small screen-space movement, without an 8px dead zone.
   if(cornerMode.value===0&&Math.hypot(dx,dy)>2/(fitWidth*zoom.value))
    cornerMode.value=selectionCanRotateValue.value&&Math.abs(tangent)>Math.abs(radial)*1.25?2:1;
   if(cornerMode.value===1){
    // Relative projection ensures scale starts at exactly 1 under the pointer.
    gestureScale.value=Math.max(0.15,Math.min(8,1+radial/cornerStartRadius.value));
    gestureAngle.value=0;
   }else if(cornerMode.value===2){
    // Measure against the initial pointer angle, not the handle center.
    // This prevents the first-frame jump when grabbing off-center.
    const startAngle=Math.atan2(cornerStartPageY.value-cy,cornerStartPageX.value-cx);
    const angle=Math.atan2(p[1]-cy,p[0]-cx);
    let delta=angle-startAngle;
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    gestureAngle.value=delta;gestureScale.value=1;
   }
   return;
  }
  if(draggingSelection.value){
   // Use the gesture's stable translation, not a new pointer origin.
    const pageScale=Math.max(0.001,fitWidth*zoom.value);
    dragX.value=e.translationX/pageScale;
    dragY.value=e.translationY/pageScale;
   return;
  }
  if(tool==='select'&&lassoDrawing.value){
   const p=pagePoint(e.x,e.y);
   if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))return;
   samples.value=appendSample(samples.value,p);
   draft.value=appendPolylinePoint(draft.value,p);
   return;
  }
  if(tool==='text'&&textDragStart.value){
   const start=textDragStart.value,end=pagePoint(e.x,e.y);
   if(Math.hypot(end[0]-start[0],end[1]-start[1])*fitWidth*zoom.value>=8){
    const left=Math.min(start[0],end[0]),right=Math.max(start[0],end[0]),top=Math.min(start[1],end[1]),bottom=Math.max(start[1],end[1]);
    draft.value=`M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
   }
   return;
  }
  if(tool==='select'||tool==='text')return;
  const p=pagePoint(e.x,e.y);
  if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))return;
  if(e.pointerType===PointerType.STYLUS&&pressureEnabled&&e.stylusData){
   p[2]=normalizeStylusPressure(e.stylusData.pressure,pressureSensitivity);
  }
  samples.value=appendSample(samples.value,p);
  const startingDrawing=!drawing.value;
  if(startingDrawing){drawing.value=true;runOnJS(notify)(true)}
  if(tool==='shape'&&shapeKind!=='auto'){
    const a=sampleBufferAt(samples.value,0),x0=a[0],y0=a[1],x1=p[0],y1=p[1];
    draft.value=previewShape(shapeKind,x0,y0,x1,y1);
    return;
  }
  draft.value=startingDrawing?centerlinePathString(flattenSamples(samples.value)):appendPolylinePoint(draft.value,p);
  if(tool==='eraser'){cursorX.value=p[0];cursorY.value=p[1];cursorOn.value=true}
 }).onEnd(e=>{
  if(tool==='text'&&textDragStart.value){
   const start=textDragStart.value,end=pagePoint(e.x,e.y);
   textDragStart.value=null;draft.value='';
   if(Math.hypot(end[0]-start[0],end[1]-start[1])*fitWidth*zoom.value>=8)
    runOnJS(beginText)(Math.min(start[0],end[0]),Math.min(start[1],end[1]),Math.abs(end[0]-start[0]),Math.abs(end[1]-start[1]));
   return;
  }
  if(handPanActive.value){handPanActive.value=false;return;}
  if(imageRotateHandle.value){const angle=imageAngle.value;imageRotateHandle.value=false;imageCommittedAngle.value+=angle;imageAngle.value=0;if(Math.abs(angle)>0.0001)runOnJS(commitImagePinch)(0,0,1,angle);return;}
  if(imageCorner.value){const scale=imageScale.value;imageCorner.value=false;imageCommittedScale.value*=scale;imageScale.value=1;if(Math.abs(scale-1)>0.0001)runOnJS(commitImagePinch)(0,0,scale,0);return;}
  if(imageDragging.value){const dx=imageDX.value,dy=imageDY.value;imageDragging.value=false;imageDX.value=0;imageDY.value=0;if(!imagePinching.value&&Math.hypot(dx,dy)>0.1){imageCommittedX.value+=dx;imageCommittedY.value+=dy;runOnJS(commitImageMove)(dx,dy);}return;}
  if(cornerActive.value){
   const scale=gestureScale.value,angle=gestureAngle.value;
   if(__DEV__)runOnJS(trace)('gesture_end',{kind:'corner',scale,angle});
   const shouldCommit=!blocked.value&&(Math.abs(scale-1)>0.0001||Math.abs(angle)>0.0001);
   if(shouldCommit)transformPending.value=true;
   cornerActive.value=false;cornerMode.value=0;
   if(shouldCommit){
    runOnJS(commitGesture)(0,0,scale,angle,selectionGestureGeneration.value);
   }else {gestureScale.value=1;gestureAngle.value=0;selectionPreviewLive.value=false}
   runOnJS(notify)(false);return;
  }
  if(draggingSelection.value){
   // Use exactly the same displacement at release as during preview.
    const pageScale=Math.max(0.001,fitWidth*zoom.value);
    const dx=e.translationX/pageScale,dy=e.translationY/pageScale;
   dragX.value=dx;dragY.value=dy;
   if(__DEV__)runOnJS(trace)('gesture_end',{kind:'move',dx,dy});
   const shouldCommit=!blocked.value&&Math.hypot(dx,dy)>0.1;
   if(shouldCommit)dragPending.value=true;
   draggingSelection.value=false;
    if(shouldCommit){runOnJS(commitSelectionMove)(dx,dy,selectionGestureGeneration.value);}
    else {dragX.value=0;dragY.value=0;dragPending.value=false}
   drawing.value=false;
   runOnJS(notify)(false);return;
  }
  if(tool==='select'&&lassoDrawing.value){
   lassoDrawing.value=false;
   const points=flattenSamples(samples.value),minimumLength=12/(fitWidth*zoom.value);
   const length=lassoPathLength(points);
   if(length>=minimumLength)runOnJS(completeLasso)(flattenSamples(samples.value));
   samples.value=emptySampleBuffer();draft.value='';drawing.value=false;
   return;
  }
   const hasCommit=!imageBounds.value&&!blocked.value&&tool!=='hand'&&tool!=='text'&&drawing.value&&samples.value.length>0;
  if(hasCommit){awaitingCommit.value=true;const commitGeneration=tool==='pen'||tool==='highlighter'||tool==='shape'?transferActivePathToHandoff():tool==='eraser'?transferEraserPathToHandoff():handoffGeneration.value;runOnJS(completeAndNotify)(samples.value,commitGeneration)}
  samples.value=emptySampleBuffer();if(!awaitingCommit.value)draft.value='';drawing.value=false;cursorOn.value=false;if(!hasCommit)runOnJS(notify)(false);
 }).onFinalize(()=>{
  // Android can cancel a stylus gesture when its input device is unplugged.
  // Preserve the points collected so far through the ordinary JS commit path.
  finishInterruptedStroke();
   if(draggingSelection.value&&!dragPending.value){dragX.value=0;dragY.value=0;committedDX.value=0;committedDY.value=0}
   lassoDrawing.value=false;textDragStart.value=null;samples.value=emptySampleBuffer();if(!awaitingCommit.value)draft.value='';drawing.value=false;blocked.value=false;cursorOn.value=false;draggingSelection.value=false;cornerActive.value=false;handPanActive.value=false;
 }).runOnJS(false);
 const pinch=Gesture.Pinch().onBegin(e=>{
  if(imageBounds.value){const action=finishInterruptedStroke();blocked.value=true;samples.value=emptySampleBuffer();if(action==='discard')draft.value='';drawing.value=false;imageGestureLocked.value=true;imagePinching.value=true;imagePinchActive.value=true;imageDragging.value=false;imageDX.value=0;imageDY.value=0;imageScale.value=1;imageFocalDX.value=0;imageFocalDY.value=0;imageFocalX.value=e.focalX;imageFocalY.value=e.focalY;return;}
  if(tool==='select'&&selectionBoundsValue.value){
    if(renderCommittedSelection){committedDX.value=0;committedDY.value=0;committedScale.value=1;committedAngle.value=0;gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0}
   blocked.value=true;samples.value=emptySampleBuffer();draft.value='';drawing.value=false;
   if(!transformActive.value)selectionGestureGeneration.value+=1;
   (__DEV__&&runOnJS(beginTrace)('pinch',selectionBoundsValue.value));
   transformActive.value=true;pinchActive.value=true;
   gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
   gestureFocalX.value=e.focalX;gestureFocalY.value=e.focalY;
   const bounds=selectionBoundsValue.value;
   gestureCenterX.value=(bounds[0]+bounds[2])/2;
   gestureCenterY.value=(bounds[1]+bounds[3])/2;
   runOnJS(notify)(true);return;
  }
  const action=finishInterruptedStroke();blocked.value=true;samples.value=emptySampleBuffer();if(action==='discard')draft.value='';drawing.value=false;
  baseZoom.value=zoom.value;baseX.value=offsetX.value;baseY.value=offsetY.value;
  pinchX.value=e.focalX;pinchY.value=e.focalY;
  pinchPageX.value=(e.focalX-originX.value)/(fitWidth*zoom.value);
  pinchPageY.value=(e.focalY-originY.value)/(fitWidth*zoom.value);
 }).onUpdate(e=>{
  if(imageGestureLocked.value){// Resize and rotate around the image's fixed center. Finger midpoint drift
   // must not translate the image; moving it is handled by the one-finger pan.
   imageScale.value=Math.max(0.15,Math.min(8,e.scale));imageFocalDX.value=0;imageFocalDY.value=0;return;}
  if(tool==='select'&&selectionBoundsValue.value){
   gestureScale.value=Math.max(0.15,Math.min(8,e.scale));
   gestureDX.value=(e.focalX-gestureFocalX.value)/(fitWidth*zoom.value);
   gestureDY.value=(e.focalY-gestureFocalY.value)/(fitWidth*zoom.value);
   return;
  }
  const z=Math.max(minZoom,Math.min(5,baseZoom.value*e.scale));
  const newWidth=PAGE_WIDTH*fitWidth*z;
  const desiredX=e.focalX-pinchPageX.value*fitWidth*z-(size.width-newWidth)/2;
  const desiredY=e.focalY-pinchPageY.value*fitWidth*z;
  const [x,y]=clamp(z,desiredX,desiredY);
  zoom.value=z;offsetX.value=x;offsetY.value=y;
 }).onEnd(()=>{
  if(imageGestureLocked.value){imagePinchActive.value=false;if(!imageRotateActive.value){finishImagePinch();imageGestureLocked.value=false;}return;}
  if(tool==='select'&&transformActive.value){
   pinchActive.value=false;
   if(!rotateActive.value){
    const dx=gestureDX.value,dy=gestureDY.value,scale=gestureScale.value,angle=gestureAngle.value;
    if(__DEV__)runOnJS(trace)('gesture_end',{kind:'pinch',dx,dy,scale,angle});
    const shouldCommit=Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001;
    if(shouldCommit)transformPending.value=true;
    transformActive.value=false;
    if(shouldCommit){
     runOnJS(commitGesture)(dx,dy,scale,angle,selectionGestureGeneration.value);
    }
    else {gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0}
    runOnJS(notify)(false);
   }
   return;
  }
  blocked.value=true;
 }).runOnJS(false);
 const rotation=Gesture.Rotation().onBegin(()=>{
  if(imageBounds.value){imageGestureLocked.value=true;imagePinching.value=true;imageRotateActive.value=true;blocked.value=true;samples.value=emptySampleBuffer();drawing.value=false;draft.value='';return;}
   if(tool==='select'&&selectionBoundsValue.value&&selectionCanRotateValue.value){if(__DEV__)runOnJS(beginTrace)('rotation',selectionBoundsValue.value);if(!transformActive.value)selectionGestureGeneration.value+=1;if(renderCommittedSelection){committedDX.value=0;committedDY.value=0;committedScale.value=1;committedAngle.value=0;}if(!transformActive.value){gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;}transformActive.value=true;selectionPreviewLive.value=true;rotateActive.value=true;blocked.value=true;return;}
 }).onUpdate(e=>{
  if(imageGestureLocked.value){imageAngle.value=e.rotation;return;}
  if(tool==='select'&&transformActive.value&&selectionCanRotateValue.value)gestureAngle.value=e.rotation;
 }).onEnd(()=>{
  if(imageGestureLocked.value){imageRotateActive.value=false;if(!imagePinchActive.value){finishImagePinch();imageGestureLocked.value=false;}return;}
  if(tool==='select'&&transformActive.value){
   rotateActive.value=false;
   if(!pinchActive.value){
    const dx=gestureDX.value,dy=gestureDY.value,scale=gestureScale.value,angle=gestureAngle.value;
    if(__DEV__)runOnJS(trace)('gesture_end',{kind:'rotation',dx,dy,scale,angle});
    const shouldCommit=Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001;
    if(shouldCommit)transformPending.value=true;
    transformActive.value=false;
     if(shouldCommit){
     runOnJS(commitGesture)(dx,dy,scale,angle,selectionGestureGeneration.value);
     }else {gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;}
    runOnJS(notify)(false);
   }
  }
 }).runOnJS(false);
 const openSelectedText=(x:number,y:number)=>{
  if(tool!=='select')return;
  const hit=[...content.elements].reverse().find(e=>e.type==='text'&&x>=e.bbox[0]&&x<=e.bbox[2]&&y>=e.bbox[1]&&y<=e.bbox[3]);
  if(!hit)return;
  clearElementSelection();
  beginText(x,y);
 };
 const doubleTap=Gesture.Tap().numberOfTaps(2).maxDuration(280).maxDistance(12).onEnd(e=>{
  if(tool==='select'){const p=pagePoint(e.x,e.y);runOnJS(openSelectedText)(p[0],p[1]);}
 }).runOnJS(false);
 const singleTap=Gesture.Tap().numberOfTaps(1).maxDuration(250).maxDistance(12).onEnd(e=>{
  if(!blocked.value){const p=pagePoint(e.x,e.y);if(tool==='text')runOnJS(beginText)(p[0],p[1]);else runOnJS(selectAt)(p[0],p[1],shiftDown.value);}
 }).runOnJS(false);
 // A double-tap recognizer delays the single tap until its second-tap window
 // expires. Text creation has no double-tap action, so bypass that wait.
 // Selection still keeps its existing double-tap-to-edit behavior.
 const gestures=Gesture.Simultaneous(pan,pinch,rotation,tool==='text'?singleTap:Gesture.Exclusive(doubleTap,singleTap));

 return <View ref={desktopSurfaceRef} onLayout={layout} style={{flex:1,overflow:'hidden',touchAction:'none',backgroundColor:paperColor==='krem'?'#FFF5DF':'#FFFFFF'} as ViewStyle}>
 <GestureDetector gesture={gestures}><View style={{flex:1,touchAction:'none'} as ViewStyle}><Canvas style={{flex:1}}>
 <Group transform={transform}>
 <StaticPaper template={template} paperColor={paperColor} pageHeight={pageHeight} fitWidth={fitWidth}/>
 {content.backgroundImage&&<PageImageLayer item={content.backgroundImage} onLoadError={onImageLoadError}/>}
 {(content.images??[]).map(source=>{const item=source.id===displayImageId&&paintedImage?paintedImage:source;const cx=item.x+item.width/2,cy=item.y+item.height/2;const art=<Group origin={vec(cx,cy)} transform={[{rotate:item.rotation??0}]}><PageImageLayer item={item} onLoadError={onImageLoadError}/>{item.id===imageId&&<><Rect x={item.x} y={item.y} width={item.width} height={item.height} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/>{Platform.OS==='web'&&<><Line p1={vec(cx,item.y)} p2={imageRotatePoint} color="#3388EE" strokeWidth={imageOutlineWidth}/><Circle cx={cx} cy={imageRotateY} r={imageHandleRadius} color="#FFFFFF"/><Circle cx={cx} cy={imageRotateY} r={imageHandleRadius} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/></>}{Platform.OS==='web'&&[[item.x,item.y],[item.x+item.width,item.y],[item.x,item.y+item.height],[item.x+item.width,item.y+item.height]].map(([x,y],index)=><Group key={index}><Circle cx={x} cy={y} r={imageHandleRadius} color="#FFFFFF"/><Circle cx={x} cy={y} r={imageHandleRadius} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/></Group>)}</>}</Group>;return item.id===displayImageId?<Group key={item.id} transform={imageTransform}>{art}</Group>:<Group key={item.id}>{art}</Group>})}
 {imageRenderProbe&&imageProbeCenter&&<><SkiaImage image={imageRenderProbe} x={imageProbeCenter[0]-24} y={imageProbeCenter[1]-24} width={48} height={48} fit="fill"/><Rect x={imageProbeCenter[0]-27} y={imageProbeCenter[1]-27} width={54} height={54} color="#111111" style="stroke" strokeWidth={2}/></>}

 <Group layer={tool==='eraser'}>
  <Completed content={content} hiddenIds={editing?[editing.id,...(handoffNeedsReleaseRender?handoff!.elements.map(element=>element.id):[])]:tool==='select'?[...selectedIds,...(handoffNeedsReleaseRender?handoff!.elements.map(element=>element.id):[])]:handoffNeedsReleaseRender?handoff!.elements.map(element=>element.id):undefined} fonts={textFonts}/>
  {handoffNeedsReleaseRender&&<Group>{handoff!.elements.map(element=>element.type==='text'?<TextLayer key={element.id} element={element} fonts={textFonts}/>:<StrokeLayer key={element.id} element={element}/>)}</Group>}
   {tool==='eraser'&&<>
    <Path path={eraserHandoffDraft} blendMode="clear" color="black" style="stroke" strokeWidth={eraserWidth} strokeCap="round" strokeJoin="round"/>
    <Path path={draft} blendMode="clear" color="black" style="stroke" strokeWidth={eraserWidth} strokeCap="round" strokeJoin="round"/>
   </>}
 </Group>
  {tool==='select'&&paintedFrame&&<Group transform={selectionTransform}>
   <Rect x={paintedFrame.bounds[0]} y={paintedFrame.bounds[1]} width={paintedFrame.bounds[2]-paintedFrame.bounds[0]} height={paintedFrame.bounds[3]-paintedFrame.bounds[1]} color="#3388EE" opacity={0.035}/>
  {paintedElements.map(element=>element.type==='text'?<TextLayer key={element.id} element={element} fonts={textFonts}/>:<StrokeLayer key={element.id} element={element}/>)}
  {(()=>{
   const bounds=paintedFrame.bounds;
   const rotation=paintedFrame.rotation;
   const padding=Math.max(0,...paintedElements.map(e=>e.type==='shape'?e.stroke.width/2:0));
   const x=bounds[0]-padding,y=bounds[1]-padding,w=bounds[2]-bounds[0]+2*padding,h=bounds[3]-bounds[1]+2*padding;
   return <Group origin={vec((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2)} transform={[{rotate:rotation}]}>
    <Rect x={x} y={y} width={w} height={h} color="#3388EE" style="stroke" strokeWidth={1.5}/>

    {[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map((p,i)=><Group key={i}><Circle cx={p[0]} cy={p[1]} r={6} color="#FFFFFF"/><Circle cx={p[0]} cy={p[1]} r={6} color="#3388EE" style="stroke" strokeWidth={2}/></Group>)}
   </Group>;
  })()}
 </Group>}
 <Path path={handoffDraft} color={handoffColor} opacity={handoffOpacity} blendMode={handoffBlendMode} style={handoffPaintStyle} strokeWidth={handoffWidth} strokeCap="round" strokeJoin="round"/>
 {tool!=='eraser'&&tool!=='select'&&<Path path={draft} color={brush.color} opacity={brush.opacity} blendMode={tool==='highlighter'?'multiply':'srcOver'} style={draftPaintStyle} strokeWidth={brush.width} strokeCap="round" strokeJoin="round"/>}
  {tool==='select'&&<>
   
   <Path path={draft} color="#3388EE" opacity={0.95} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round"><DashPathEffect intervals={[8,6]}/></Path>
  </>}
 {tool==='eraser'&&<Circle cx={cursorX} cy={cursorY} r={eraserRadius} color="#808080" opacity={cursorOpacity} style="stroke" strokeWidth={1.5}/>}
 </Group></Canvas></View></GestureDetector>{editing&&<InlineTextEditorErrorBoundary key={editing.id} fallbackStyle={{left:12,top:12,right:12}} onClose={()=>finishRef.current()}><InlineTextEditor
  item={editing}
  left={(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value+editing.x*fitWidth*zoom.value}
  top={offsetY.value+editing.y*fitWidth*zoom.value}
  scale={fitWidth*zoom.value}
  canvasZoom={zoom.value}
  pageHeight={pageHeight}
  onCommit={value=>{editValueRef.current=value;finishRef.current()}}
  onValueChange={value=>{
   editValueRef.current=value;
   const current=editingRef.current;
   if(current){
    // Keep the editor's bounding box in sync with wrapped text immediately,
    // without waiting for the debounced SQLite write.
    const height=measureTextHeight(current,value,current.w);
    const next={...current,text:value,minHeight:height,bbox:[current.x,current.y,current.x+current.w,current.y+height] as [number,number,number,number]};
    editingRef.current=next;
    setEditing(next);
   }
   scheduleTextSave();
  }}
  onGeometryCommit={()=>persistTextGeometry()}
  onStyleChange={patch=>{
   const current=editingRef.current;if(!current)return;
   const next={...current,...patch};
   editingRef.current=next;setEditing(next);
   onChange({...content,elements:content.elements.map(element=>element.id===next.id?next:element)});
  }}
  onMove={(dx,dy,heightPx)=>{
   const current=editingRef.current;if(!current)return;
   const scale=Math.max(0.01,fitWidth*zoom.value);
   const height=Math.min(Math.max(0,pageHeight),Math.max(0,heightPx/scale));
   const x=Math.max(0,Math.min(PAGE_WIDTH-current.w,current.x+dx/scale));
   const y=Math.max(0,Math.min(Math.max(0,pageHeight-height),current.y+dy/scale));
   const next={...current,x,y,bbox:[x,y,x+current.w,y+height] as [number,number,number,number]};
   editingRef.current=next;setEditing(next);
  }}
  onResize={(width,minHeight,heightPx)=>{
   const current=editingRef.current;if(!current)return;
   const nextWidth=Math.max(1,Math.min(PAGE_WIDTH-current.x,width));
   const height=Math.min(Math.max(0,pageHeight-current.y),Math.max(0,heightPx/Math.max(0.01,fitWidth*zoom.value)));
   const next={...current,w:nextWidth,minHeight:minHeight??undefined,bbox:[current.x,current.y,current.x+nextWidth,current.y+height] as [number,number,number,number]};
   editingRef.current=next;setEditing(next);
  }}
 /></InlineTextEditorErrorBoundary>}</View>;
}
