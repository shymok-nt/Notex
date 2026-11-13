import React,{memo,useMemo,useRef,useState} from 'react';
import {View,Text,Pressable,ScrollView} from 'react-native';
import {Plus,Check} from 'lucide-react-native';
import Animated,{useAnimatedStyle,useSharedValue,withSpring,runOnJS} from 'react-native-reanimated';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {PagePreview} from '@/components/PagePreview';
import type {Page} from '@/types/page';
import type {ThemeColors} from '@/theme/colors';
type Props={pages:Page[];selectedId?:string;tablet:boolean;pdfMode?:boolean;colors:ThemeColors;onSelect:(id:string)=>void;onAdd:()=>void;onMove:(id:string,index:number)=>void;onActions:(id:string)=>void;multiSelect?:boolean;selectedPageIds?:string[];onToggle?:(id:string)=>void;onEnterSelection?:(id:string)=>void};
const PAGE_ITEM_HEIGHT=148;
const PAGE_ITEM_GAP=8;
const PageItem=memo(function PageItem({page,index,count,tablet,colors,selected,checked,multiSelect,onSelect,onMove,onActions,onToggle,onEnterSelection}:{page:Page;index:number;count:number;tablet:boolean;colors:ThemeColors;selected:boolean;checked:boolean;multiSelect:boolean;onSelect:(id:string)=>void;onMove:(id:string,index:number)=>void;onActions:(id:string)=>void;onToggle:(id:string)=>void;onEnterSelection:(id:string)=>void}){
 const translation=useSharedValue(0),active=useSharedValue(false);
 const drag=useMemo(()=>Gesture.Pan().activateAfterLongPress(260).minDistance(6).enabled(!multiSelect)
  .onStart(()=>{active.value=true;translation.value=0})
  .onUpdate(e=>{translation.value=tablet?e.translationY:e.translationX})
  .onEnd(e=>{const delta=tablet?e.translationY:e.translationX,step=tablet?PAGE_ITEM_HEIGHT+PAGE_ITEM_GAP:100;const target=Math.max(0,Math.min(count-1,index+Math.round(delta/step)));if(target!==index)runOnJS(onMove)(page.id,target)})
  .onFinalize(()=>{translation.value=withSpring(0);active.value=false}),[tablet,multiSelect,index,count,onMove,page.id]);
 const hold=useMemo(()=>Gesture.LongPress().minDuration(520).maxDistance(12).enabled(!multiSelect).onStart(()=>{runOnJS(onEnterSelection)(page.id)}),[multiSelect,onEnterSelection,page.id]);
 const tap=useMemo(()=>Gesture.Tap().maxDuration(220).onEnd((_,success)=>{if(success){if(multiSelect)runOnJS(onToggle)(page.id);else runOnJS(onSelect)(page.id)}}),[multiSelect,onToggle,onSelect,page.id]);
 const gesture=useMemo(()=>Gesture.Race(drag,hold,tap),[drag,hold,tap]);
 const style=useAnimatedStyle(()=>({transform:[tablet?{translateY:translation.value}:{translateX:translation.value},{scale:withSpring(active.value?1.07:1)}],zIndex:active.value?100:0,opacity:active.value?0.92:1}));
 return <View style={{width:tablet?108:100,height:PAGE_ITEM_HEIGHT,alignItems:'center',justifyContent:'center'}}>
 <GestureDetector gesture={gesture}><Animated.View style={[style,{touchAction:'none'}]}>
 <View accessibilityLabel={`Sayfa ${index+1}`} style={{padding:5,borderRadius:13,borderWidth:2,borderColor:checked||selected?colors.accent:colors.border,backgroundColor:colors.surface,alignItems:'center'}}>
 <PagePreview template={page.template} paperColor={page.paperColor} width={80} height={108} thumbnailPath={page.thumbnailPath}/>
 {multiSelect&&<View style={{position:'absolute',right:0,top:0,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:checked?colors.accent:colors.surfaceRaised,borderWidth:1,borderColor:colors.accent}}>{checked&&<Check size={14} color="#FFFFFF"/>}</View>}
 </View></Animated.View></GestureDetector>
 <Text style={{fontSize:12,color:selected?colors.accent:colors.muted,marginTop:5,fontWeight:selected?'600':'400'}}>Sayfa {index+1}</Text>
 </View>;
});
export const CanvasPageStrip=memo(function CanvasPageStrip({pages,selectedId,tablet,pdfMode=false,colors,onSelect,onAdd,onMove,onActions,multiSelect=false,selectedPageIds=[],onToggle,onEnterSelection}:Props){
 const scrollRef=useRef<ScrollView>(null);
 const [viewportHeight,setViewportHeight]=useState(0);
 const [contentHeight,setContentHeight]=useState(0);
 const [scrollY,setScrollY]=useState(0);
 const showScrubber=pdfMode&&tablet&&contentHeight>viewportHeight+1&&viewportHeight>0;
 const thumbHeight=Math.max(40,viewportHeight*viewportHeight/Math.max(contentHeight,1));
 const travel=Math.max(1,viewportHeight-thumbHeight);
 const scrollToTrack=(y:number)=>{const ratio=Math.max(0,Math.min(1,(y-thumbHeight/2)/travel));scrollRef.current?.scrollTo({y:ratio*(contentHeight-viewportHeight),animated:false})};
 return <View style={tablet?{flex:1,minHeight:0,flexDirection:'row'}:{}}>
 <ScrollView ref={scrollRef} style={tablet?{flex:1}:undefined} horizontal={!tablet} disableScrollViewPanResponder
  showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={pdfMode&&tablet&&!showScrubber}
  scrollEventThrottle={32}
  onLayout={event=>{if(tablet)setViewportHeight(event.nativeEvent.layout.height)}}
  onContentSizeChange={(_,height)=>{if(tablet)setContentHeight(height)}}
  onScroll={event=>{if(tablet)setScrollY(event.nativeEvent.contentOffset.y)}}
  contentContainerStyle={{padding:12,alignItems:'center',gap:tablet?PAGE_ITEM_GAP:0,flexGrow:tablet?0:1}}>
 {pages.map((page,index)=><PageItem key={page.id} page={page} index={index} count={pages.length} tablet={tablet} colors={colors} selected={page.id===selectedId} checked={selectedPageIds.includes(page.id)} multiSelect={multiSelect} onSelect={onSelect} onMove={onMove} onActions={onActions} onToggle={onToggle??onSelect} onEnterSelection={onEnterSelection??onSelect}/>)}
 {!pdfMode&&!multiSelect&&<View style={{width:tablet?108:100,height:PAGE_ITEM_HEIGHT,alignItems:'center',justifyContent:'center'}}><Pressable accessibilityRole="button" accessibilityLabel="Sayfa ekle" onPress={onAdd} style={{width:90,height:108,borderWidth:1,borderStyle:'dashed',borderColor:colors.border,borderRadius:8,alignItems:'center',justifyContent:'center',gap:5}}><Plus size={24} color={colors.accent}/><Text style={{fontSize:12,color:colors.accent}}>Sayfa ekle</Text></Pressable></View>}
 </ScrollView>
 {showScrubber&&<View accessibilityLabel="PDF sayfa listesi hızlı kaydırma" style={{width:18,paddingHorizontal:5,paddingVertical:0,justifyContent:'flex-start'}}
  onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
  onResponderGrant={event=>scrollToTrack(event.nativeEvent.locationY)}
  onResponderMove={event=>scrollToTrack(event.nativeEvent.locationY)}>
  <View style={{flex:1,borderRadius:8,backgroundColor:colors.divider,overflow:'hidden'}}>
   <View pointerEvents="none" style={{position:'absolute',left:0,right:0,top:Math.max(0,Math.min(travel,scrollY/Math.max(1,contentHeight-viewportHeight)*travel)),height:thumbHeight,borderRadius:8,backgroundColor:colors.accent}}/>
  </View>
 </View>}
 </View>;
});
