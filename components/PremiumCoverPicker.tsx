import {Pressable,Text,View} from 'react-native';
import {NotebookCover} from '@/components/NotebookCover';
import {getPremiumCover,premiumCoverCollections,type PremiumCoverStyle} from '@/theme/covers';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/fonts';

export function PremiumCoverPicker({selected,onSelect}:{selected:string|null;onSelect:(id:string)=>void}){
 const {colors}=useTheme();
 const current=getPremiumCover(selected);
 const style:PremiumCoverStyle=current&&premiumCoverCollections.some(item=>item.style===current.style)?current.style as PremiumCoverStyle:'classic';
 const collection=premiumCoverCollections.find(item=>item.style===style)!;
 return <View style={{gap:14}}>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{premiumCoverCollections.map(item=><Pressable key={item.style} accessibilityRole="button" accessibilityLabel={`${item.label} kapak stili`} accessibilityState={{selected:style===item.style&&!!current}} onPress={()=>onSelect(item.variants[0].id)} style={{minHeight:44,paddingHorizontal:14,alignItems:'center',justifyContent:'center',borderRadius:10,borderWidth:1,borderColor:current?.style===item.style?colors.accent:colors.border,backgroundColor:current?.style===item.style?colors.accent+'12':colors.surface}}><Text style={{fontFamily:fonts.medium,color:colors.ink,fontSize:13}}>{item.label}</Text></Pressable>)}</View>
  <View style={{flexDirection:'row',gap:14}}>{collection.variants.map(variant=><Pressable key={variant.id} accessibilityRole="button" accessibilityLabel={`${collection.label} ${variant.label} kapak`} accessibilityState={{selected:selected===variant.id}} onPress={()=>onSelect(variant.id)} style={{flex:1,minWidth:0,alignItems:'center',gap:7,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:selected===variant.id?colors.accent:'transparent'}}><NotebookCover notebook={{title:'',coverType:'preset',coverColor:variant.color,coverImageUri:null,coverPresetId:variant.id,showTitleOnCover:false}} width={58}/><Text numberOfLines={1} style={{fontFamily:fonts.medium,fontSize:12,color:colors.ink}}>{variant.label}</Text></Pressable>)}</View>
 </View>;
}
