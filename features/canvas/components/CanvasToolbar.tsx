import React,{useState} from 'react';
import {Pressable,Text,View,ScrollView} from 'react-native';
import {Pen,Highlighter,Eraser,Hand,Move,Shapes,Type,Image as ImageIcon,PanelsTopLeft} from 'lucide-react-native';
import type {Tool} from './DrawingCanvas';
import type {ThemeColors} from '@/theme/colors';

export type UiTool=Tool|'select'|'shape'|'text'|'image'|'pages';
export const tools:{id:UiTool;label:string;icon:typeof Pen;enabled:boolean}[]=[
 {id:'pen',label:'Kalem',icon:Pen,enabled:true},
 {id:'highlighter',label:'Vurgulayıcı',icon:Highlighter,enabled:true},
 {id:'eraser',label:'Silgi',icon:Eraser,enabled:true},
 {id:'select',label:'Seç ve taşı',icon:Move,enabled:true},
 {id:'shape',label:'Şekil',icon:Shapes,enabled:true},
 {id:'text',label:'Metin',icon:Type,enabled:true},
 {id:'image',label:'Resim',icon:ImageIcon,enabled:true},
 {id:'hand',label:'Kaydırma',icon:Hand,enabled:true},
 {id:'pages',label:'Sayfalar',icon:PanelsTopLeft,enabled:true}
];
type Props={tablet:boolean;tool:Tool;colors:ThemeColors;onTool:(tool:Tool)=>void;onPages:()=>void;onImage:()=>void;toolPanel?:React.ReactNode;panelTitle?:string;panelOpen?:boolean;onClosePanel?:()=>void};
export function CanvasToolbar({tablet,tool,colors,onTool,onPages,onImage,toolPanel,panelTitle,panelOpen,onClosePanel}:Props){
 const [anchorX,setAnchorX]=useState(0);
 const shown=tablet?tools.filter(t=>t.id!=='pages'):tools.filter(t=>t.id!=='hand');
 return <View style={{flexDirection:'row',alignItems:'center',backgroundColor:tablet?colors.background:colors.surfaceRaised,borderRadius:tablet?18:24,paddingHorizontal:4,paddingVertical:tablet?2:8,shadowColor:'#000',shadowOpacity:tablet?0:0.12,shadowRadius:14,elevation:tablet?0:6}}>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems:'center',flexGrow:1,justifyContent:'space-around'}}>
 {shown.map(t=>{const Icon=t.icon;const active=t.id===tool;return <Pressable key={t.id} onLayout={e=>{if(t.id===tool)setAnchorX(e.nativeEvent.layout.x)}} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{selected:active,disabled:!t.enabled}} disabled={!t.enabled} onPress={()=>t.id==='pages'?onPages():t.id==='image'?onImage():onTool(t.id as Tool)} style={{width:tablet?48:46,height:tablet?44:48,alignItems:'center',justifyContent:'center',borderRadius:16,opacity:t.enabled?1:0.4,backgroundColor:active?colors.accent+'1F':'transparent'}}>
 <Icon size={22} color={active?colors.accent:colors.ink}/></Pressable>})}
 </ScrollView>{panelOpen&&toolPanel&&<View style={{position:'absolute',zIndex:100,width:Math.min(292,tablet?292:300),left:tablet?Math.max(0,anchorX-120):0,top:tablet?54:undefined,bottom:tablet?undefined:64,padding:12,borderRadius:16,backgroundColor:colors.surfaceRaised,shadowColor:'#000',shadowOpacity:0.16,shadowRadius:18,elevation:12}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><Text style={{color:colors.ink,fontSize:12,fontWeight:'600'}}>{panelTitle??'Araç'}</Text><Pressable onPress={onClosePanel} accessibilityLabel="Kapat" style={{paddingHorizontal:8,paddingVertical:4}}><Text style={{color:colors.ink,fontSize:18}}>×</Text></Pressable></View><ScrollView nestedScrollEnabled style={{maxHeight:tablet?320:280}} showsVerticalScrollIndicator={false}>{toolPanel}</ScrollView></View>}</View>;
}
