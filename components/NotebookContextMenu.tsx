import React from 'react';
import {Modal,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/fonts';

export type NotebookMenuAction={label:string;onPress:()=>void;danger?:boolean};
export function NotebookContextMenu({visible,x,y,title,actions,onClose}:{visible:boolean;x:number;y:number;title:string;actions:NotebookMenuAction[];onClose:()=>void}){
 const {colors}=useTheme();
 const {width,height}=useWindowDimensions();
 const menuWidth=220;
 const menuHeight=54+actions.length*36+12;
 const left=Math.max(8,Math.min(x,width-menuWidth-8));
 const top=Math.max(8,Math.min(y,height-menuHeight-8));
 return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
  <View style={{flex:1}}>
   <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Menüyü kapat"/>
   <View style={{position:'absolute',left,top,width:menuWidth,padding:6,borderRadius:12,backgroundColor:colors.surfaceRaised,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,shadowColor:'#000',shadowOffset:{width:0,height:7},shadowOpacity:0.16,shadowRadius:18,elevation:12}}>
    <Text numberOfLines={1} style={{fontFamily:fonts.semibold,fontSize:12,color:colors.muted,paddingHorizontal:10,paddingVertical:10}}>{title}</Text>
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:colors.divider,marginBottom:5}}/>
    {actions.map((action,i)=><Pressable key={i} accessibilityRole="menuitem" onPress={()=>{onClose();action.onPress()}} style={({hovered})=>({minHeight:36,borderRadius:7,justifyContent:'center',paddingHorizontal:10,backgroundColor:hovered?colors.background:'transparent'})}>
     <Text style={{fontFamily:fonts.medium,fontSize:13,color:action.danger?colors.coral:colors.ink}}>{action.label}</Text>
    </Pressable>)}
   </View>
  </View>
 </Modal>;
}
