import {StyleSheet,View} from 'react-native';
import type {PremiumCoverStyle,LegacyCoverStyle} from '@/theme/covers';

export function PremiumCoverArt({style,ink,width}:{style:PremiumCoverStyle|LegacyCoverStyle;ink:string;width:number}){
 if(style==='linen')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  {[12,22,32,42,52,62,72,82,92].map(top=><View key={top} style={{position:'absolute',left:0,right:0,top:`${top}%`,height:1,backgroundColor:ink,opacity:0.22}}/>)}
  {[24,48,72,90].map(left=><View key={left} style={{position:'absolute',top:0,bottom:0,left:`${left}%`,width:1,backgroundColor:ink,opacity:0.13}}/>)}
 </View>;
 if(style==='leather')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',left:'13%',right:'8%',top:'7%',bottom:'6%',borderWidth:1,borderColor:ink,opacity:0.52,borderRadius:3}}/>
  <View style={{position:'absolute',left:'16%',right:'11%',top:'9%',bottom:'8%',borderWidth:1,borderColor:ink,opacity:0.18,borderRadius:2}}/>
  {[19,40,61,82].map(top=><View key={top} style={{position:'absolute',left:'18%',right:'13%',top:`${top}%`,height:1,backgroundColor:ink,opacity:0.09}}/>)}
 </View>;
 if(style==='editorial')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',left:'21%',right:'11%',top:'14%',height:1,backgroundColor:ink,opacity:0.7}}/>
  <View style={{position:'absolute',left:'21%',top:'14%',bottom:'13%',width:1,backgroundColor:ink,opacity:0.62}}/>
  <View style={{position:'absolute',left:'21%',right:'36%',bottom:'13%',height:1,backgroundColor:ink,opacity:0.7}}/>
  <View style={{position:'absolute',right:'12%',top:'21%',width:Math.max(8,width*0.21),height:Math.max(8,width*0.21),borderRadius:width*0.11,borderWidth:1,borderColor:ink,opacity:0.5}}/>
 </View>;
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',width:width*1.05,height:width*1.05,borderRadius:width*0.53,right:-width*0.3,top:width*0.07,backgroundColor:ink,opacity:0.2}}/>
  <View style={{position:'absolute',width:width*0.85,height:width*0.95,borderRadius:width*0.48,left:-width*0.24,bottom:-width*0.04,backgroundColor:ink,opacity:0.17}}/>
 </View>;
}
