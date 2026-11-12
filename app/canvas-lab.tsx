import React,{useEffect,useMemo,useRef,useState} from 'react';
import {PixelRatio,Pressable,SafeAreaView,Text,View,useWindowDimensions} from 'react-native';
import {Canvas,Group,Image as SkImage,Path,Skia,PaintStyle,StrokeCap,StrokeJoin,BlendMode,type SkImage as SkImageType,type SkSurface} from '@shopify/react-native-skia';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {useDerivedValue,useFrameCallback,useSharedValue} from 'react-native-reanimated';

// Isolated experiment: no notebook model, store, repository or persistence.
// Surface ownership and every pointer update live on the UI runtime.
const INK='#17243A';
const PAPER='#FFFFFF';
type Mode='pen'|'eraser';
const round=(v:number)=>Math.round(v*10)/10;
export default function CanvasLab(){
 const {width:screenWidth,height:screenHeight}=useWindowDimensions();
 const [viewport,setViewport]=useState({width:Math.max(1,screenWidth),height:Math.max(1,screenHeight-170)});
 const [modeLabel,setModeLabel]=useState<Mode>('pen');
 const [radiusLabel,setRadiusLabel]=useState(18);
 const [stats,setStats]=useState({fps:0,lag:0,bench:0});
 const ratio=PixelRatio.get();
 const pxWidth=Math.max(1,Math.ceil(viewport.width*ratio));
 const pxHeight=Math.max(1,Math.ceil(viewport.height*ratio));
 const mode=useSharedValue<Mode>('pen');
 const radius=useSharedValue(18);
 const drawing=useSharedValue(false);
 const activePath=useSharedValue('');
 const cursorX=useSharedValue(-100),cursorY=useSharedValue(-100);
 const visible=useSharedValue(false);
 const frames=useSharedValue(0);
 const lastFps=useSharedValue(0);
 const benchmark=useSharedValue(0);
 const image=useSharedValue<SkImageType|null>(null);
 const surface=useDerivedValue<SkSurface|null>(()=>{
  const s=Skia.Surface.MakeOffscreen(pxWidth,pxHeight);
  if(!s)return null;
  s.getCanvas().clear(Skia.Color(PAPER));
  s.flush();
  image.value=s.makeImageSnapshot();
  return s;
 },[pxWidth,pxHeight]);
 const gesturePath=useSharedValue<ReturnType<typeof Skia.Path.Make>|null>(null);
 const lastX=useSharedValue(0),lastY=useSharedValue(0);
 const strokePaint=useDerivedValue(()=>{
  const p=Skia.Paint();p.setAntiAlias(true);p.setColor(Skia.Color(INK));
  p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(4*ratio);p.setStrokeCap(StrokeCap.Round);p.setStrokeJoin(StrokeJoin.Round);
  return p;
 },[ratio]);
 const erasePaint=useDerivedValue(()=>{
  const p=Skia.Paint();p.setAntiAlias(true);p.setBlendMode(BlendMode.Clear); // Clear
  p.setStyle(PaintStyle.Stroke);p.setStrokeCap(StrokeCap.Round);p.setStrokeJoin(StrokeJoin.Round);p.setStrokeWidth(radius.value*2*ratio);
  return p;
 },[ratio]);
 const publish=()=>{'worklet';
  const s=surface.value;if(!s)return;
  s.flush();
  image.value=s.makeImageSnapshot();
 };
 const eraseSegment=(x:number,y:number)=>{'worklet';
  const s=surface.value;if(!s)return;
  const x0=lastX.value,y0=lastY.value,dx=x-x0,dy=y-y0;
  const step=Math.max(0.5,radius.value/4);
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/step));
  let svg='M'+(x0*ratio)+' '+(y0*ratio);
  for(let i=1;i<=n;i++)svg+=' L'+((x0+dx*i/n)*ratio)+' '+((y0+dy*i/n)*ratio);
  const path=Skia.Path.MakeFromSVGString(svg);
  const p=Skia.Paint();p.setAntiAlias(true);p.setBlendMode(BlendMode.Clear);
  p.setStyle(1);p.setStrokeCap(1);p.setStrokeJoin(1);p.setStrokeWidth(radius.value*2*ratio);
  if(path)s.getCanvas().drawPath(path,p);
  lastX.value=x;lastY.value=y;publish();
 };
 const pan=Gesture.Pan().minDistance(0).maxPointers(1)
  .onBegin(e=>{
   if(!surface.value)return;
   drawing.value=true;visible.value=true;
   lastX.value=e.x;lastY.value=e.y;cursorX.value=e.x;cursorY.value=e.y;
   if(mode.value==='eraser'){
    eraseSegment(e.x,e.y);
   }else{
    const svg='M'+round(e.x*ratio)+' '+round(e.y*ratio);
    gesturePath.value=Skia.Path.MakeFromSVGString(svg);activePath.value=svg;
   }
  })
  .onUpdate(e=>{
   if(!drawing.value)return;
   cursorX.value=e.x;cursorY.value=e.y;
   if(mode.value==='eraser'){eraseSegment(e.x,e.y);return}
   if(!gesturePath.value)return;
   const svg=activePath.value+' L'+round(e.x*ratio)+' '+round(e.y*ratio);
   const p=Skia.Path.MakeFromSVGString(svg);if(!p)return;
   gesturePath.value=p;lastX.value=e.x;lastY.value=e.y;
   activePath.value=svg;
  })
  .onEnd(()=>{
   if(!drawing.value)return;
   if(mode.value==='pen'&&surface.value&&gesturePath.value){
    // Exactly the path already shown in the live overlay; no geometry rebuild.
    surface.value.getCanvas().drawPath(gesturePath.value,strokePaint.value);
    publish(); // snapshot and draft removal in one UI-thread worklet
    gesturePath.value=null;activePath.value='';
   }
   drawing.value=false;visible.value=false;
  })
  .onFinalize(()=>{
   if(drawing.value&&mode.value==='pen'&&surface.value&&gesturePath.value){
    surface.value.getCanvas().drawPath(gesturePath.value,strokePaint.value);
    publish();
   }
   gesturePath.value=null;activePath.value='';drawing.value=false;visible.value=false;
  });
 const displayedImage=useDerivedValue(()=>image.value);
 const displayedPath=useDerivedValue(()=>activePath.value);
 const ringPath=useDerivedValue(()=>{
  if(!visible.value||mode.value!=='eraser')return '';
  const r=radius.value,x=cursorX.value,y=cursorY.value;
  return 'M'+(x-r)+' '+y+' a'+r+' '+r+' 0 1 0 '+(2*r)+' 0 a'+r+' '+r+' 0 1 0 '+(-2*r)+' 0';
 });
 const setMode=(m:Mode)=>{mode.value=m;setModeLabel(m)};
 const setRadius=(v:number)=>{const n=Math.max(4,Math.min(60,v));radius.value=n;setRadiusLabel(n)};
 const clear=()=>{const s=surface.value;if(!s)return;s.getCanvas().clear(Skia.Color(PAPER));publish()};
 const seed=()=>{
  const s=surface.value;if(!s)return;
  const t=Date.now();const canvas=s.getCanvas();const p=Skia.Paint();
  p.setAntiAlias(true);p.setColor(Skia.Color(INK));p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(4*ratio);p.setStrokeCap(StrokeCap.Round);p.setStrokeJoin(StrokeJoin.Round);
  for(let i=0;i<1000;i++){
   const x=(12+Math.random()*(viewport.width-24))*ratio,y=(12+Math.random()*(viewport.height-24))*ratio;
   let svg='M'+x+' '+y;
   for(let j=1;j<=12;j++)svg+=' L'+(x+j*2.5*ratio)+' '+(y+Math.sin(j*0.8+i)*7*ratio);
   const path=Skia.Path.MakeFromSVGString(svg);
   if(path)canvas.drawPath(path,p);
  }
  publish();benchmark.value=Date.now()-t;
  setStats(v=>({...v,bench:benchmark.value}));
 };
 const frameCount=useRef(0),lagTick=useRef(Date.now());
 useFrameCallback(()=>{frames.value+=1});
 useEffect(()=>{
  const timer=setInterval(()=>{
   const now=Date.now(),lag=Math.max(0,now-lagTick.current-1000);lagTick.current=now;
   // Do not trigger a React render while a finger is drawing.
   if(!drawing.value){const count=frames.value;frames.value=0;setStats(v=>({...v,fps:count,lag}))}
  },1000);
  return()=>clearInterval(timer);
 },[]);
 const radiusTrack=Gesture.Pan().onBegin(e=>{radius.value=Math.max(4,Math.min(60,4+e.x/220*56))}).onUpdate(e=>{radius.value=Math.max(4,Math.min(60,4+e.x/220*56))}).onEnd(()=>{setRadiusLabel(Math.round(radius.value))});
 return <SafeAreaView style={{flex:1,backgroundColor:'#F1F4F8'}}>
  <View style={{paddingHorizontal:14,paddingVertical:9,gap:8}}>
   <Text style={{fontWeight:'700',fontSize:18,color:INK}}>Canvas Lab · bağımsız test</Text>
   <Text style={{fontSize:12,color:'#566273'}}>FPS: {stats.fps} · JS gecikmesi: {stats.lag} ms · 1000 çizgi: {stats.bench} ms</Text>
   <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
    <Pressable onPress={()=>setMode('pen')} style={{padding:10,backgroundColor:modeLabel==='pen'?'#C6D9FF':'#FFF',borderRadius:8}}><Text>Kalem</Text></Pressable>
    <Pressable onPress={()=>setMode('eraser')} style={{padding:10,backgroundColor:modeLabel==='eraser'?'#C6D9FF':'#FFF',borderRadius:8}}><Text>Silgi</Text></Pressable>
    <Pressable onPress={clear} style={{padding:10,backgroundColor:'#FFF',borderRadius:8}}><Text>Temizle</Text></Pressable>
    <Pressable onPress={seed} style={{padding:10,backgroundColor:'#FFF',borderRadius:8}}><Text>1000 çizgi ekle</Text></Pressable>
   </View>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <Text style={{color:INK}}>Silgi yarıçapı: {radiusLabel}</Text>
    <Pressable onPress={()=>setRadius(radiusLabel-4)} style={{padding:8,backgroundColor:'#FFF'}}><Text>−</Text></Pressable>
    <GestureDetector gesture={radiusTrack}><View style={{width:220,height:28,justifyContent:'center'}}><View style={{height:5,borderRadius:3,backgroundColor:'#A5B8D8'}}/><View style={{position:'absolute',left:(radiusLabel-4)/56*208,width:12,height:22,borderRadius:6,backgroundColor:'#426BD6'}}/></View></GestureDetector>
    <Pressable onPress={()=>setRadius(radiusLabel+4)} style={{padding:8,backgroundColor:'#FFF'}}><Text>+</Text></Pressable>
   </View>
  </View>
  <View onLayout={e=>{const {width,height}=e.nativeEvent.layout;if(width>0&&height>0)setViewport(v=>v.width===width&&v.height===height?v:{width,height})}} style={{flex:1,backgroundColor:PAPER}}>
   <GestureDetector gesture={pan}><View style={{flex:1}}>
    <Canvas style={{flex:1}}>
     <SkImage image={displayedImage} x={0} y={0} width={viewport.width} height={viewport.height}/>
     <Group transform={[{scale:1/ratio}]}><Path path={displayedPath} color={INK} style="stroke" strokeWidth={4*ratio} strokeCap="round" strokeJoin="round"/></Group>
     <Path path={ringPath} color="#7C8799" style="stroke" strokeWidth={1.5}/>
    </Canvas>
   </View></GestureDetector>
  </View>
 </SafeAreaView>;
}
