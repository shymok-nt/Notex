import {StyleSheet,Text,View} from 'react-native';
import type {PremiumCoverStyle} from '@/theme/covers';
import {darken,lighten} from '@/utils/color';
import {fonts} from '@/theme/fonts';

type Props={style:PremiumCoverStyle;color:string;ink:string;width:number;title:string;showTitle:boolean};
export function PremiumCoverFace({style,color,ink,width,title,showTitle}:Props){
 const small=width<80;
 const titleSize=Math.max(9,width*(style==='editorial'?0.16:style==='modern'?0.125:0.105));
 if(style==='classic')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',left:'14%',right:'8%',top:'8%',bottom:'7%',borderWidth:Math.max(1,width*0.012),borderColor:ink,opacity:0.55}}/>
  <View style={{position:'absolute',left:'17%',right:'11%',top:'10%',bottom:'9%',borderWidth:1,borderColor:ink,opacity:0.24}}/>
  <View style={{position:'absolute',left:'26%',right:'20%',top:'23%',height:1,backgroundColor:ink,opacity:0.5}}/>
  <View style={{position:'absolute',left:'26%',right:'20%',bottom:'23%',height:1,backgroundColor:ink,opacity:0.5}}/>
  <View style={{position:'absolute',left:'24%',right:'18%',top:'38%',bottom:'38%',alignItems:'center',justifyContent:'center',backgroundColor:lighten(color,0.1),borderWidth:1,borderColor:ink}}>{showTitle&&!small&&<Text numberOfLines={3} adjustsFontSizeToFit style={{fontFamily:fonts.heading,fontSize:titleSize,color:ink,textAlign:'center'}}>{title}</Text>}</View>
 </View>;
 if(style==='modern')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',left:'18%',right:0,top:0,height:'49%',backgroundColor:ink,opacity:0.3}}/>
  <View style={{position:'absolute',left:'18%',width:'35%',top:'31%',bottom:'15%',backgroundColor:darken(color,0.25)}}/>
  <View style={{position:'absolute',right:0,width:'26%',top:'49%',bottom:0,backgroundColor:ink,opacity:0.17}}/>
  <View style={{position:'absolute',left:'57%',right:'8%',top:'56%',height:Math.max(2,width*0.025),backgroundColor:ink,opacity:0.7}}/>
  {showTitle&&!small&&<View style={{position:'absolute',left:'19%',right:'12%',bottom:'8%'}}><Text numberOfLines={3} adjustsFontSizeToFit style={{fontFamily:fonts.semibold,fontSize:titleSize,color:ink,textAlign:'left'}}>{title}</Text></View>}
 </View>;
 if(style==='editorial')return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',left:'20%',right:'8%',top:'11%',height:Math.max(2,width*0.018),backgroundColor:ink}}/>
  <View style={{position:'absolute',left:'20%',right:'22%',top:'17%',height:1,backgroundColor:ink,opacity:0.5}}/>
  <View style={{position:'absolute',left:'20%',right:'8%',bottom:'19%',height:1,backgroundColor:ink,opacity:0.7}}/>
  <View style={{position:'absolute',left:'20%',width:'26%',bottom:'12%',height:Math.max(3,width*0.045),backgroundColor:ink,opacity:0.65}}/>
  {showTitle&&!small&&<View style={{position:'absolute',left:'20%',right:'8%',top:'28%'}}><Text numberOfLines={3} adjustsFontSizeToFit style={{fontFamily:fonts.heading,fontSize:titleSize,lineHeight:titleSize*1.06,color:ink,textAlign:'left'}}>{title}</Text></View>}
 </View>;
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <View style={{position:'absolute',width:width*1.35,height:width*1.4,borderRadius:width*0.72,right:-width*0.36,top:-width*0.22,backgroundColor:ink,opacity:0.23}}/>
  <View style={{position:'absolute',width:width*1.05,height:width*1.17,borderRadius:width*0.57,left:-width*0.38,top:width*0.43,backgroundColor:lighten(color,0.24)}}/>
  <View style={{position:'absolute',width:width*0.62,height:width*0.75,borderRadius:width*0.38,right:-width*0.18,bottom:width*0.12,backgroundColor:darken(color,0.2),opacity:0.62}}/>
  <View style={{position:'absolute',left:'18%',right:'12%',bottom:'9%',height:'27%',backgroundColor:lighten(color,0.14),justifyContent:'center',paddingHorizontal:Math.max(3,width*0.07)}}>{showTitle&&!small&&<Text numberOfLines={2} adjustsFontSizeToFit style={{fontFamily:fonts.medium,fontSize:titleSize,color:ink,textAlign:'left'}}>{title}</Text>}</View>
 </View>;
}
