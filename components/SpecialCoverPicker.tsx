import {Pressable,ScrollView,Text,View} from 'react-native';
import {NotebookCover} from '@/components/NotebookCover';
import {specialCoverCollection,type SpecialCoverId} from '@/theme/covers';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/fonts';

export function SpecialCoverPicker({selected,onSelect}:{selected:string|null;onSelect:(id:SpecialCoverId)=>void}){
 const {colors}=useTheme();
 return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingVertical:3,paddingRight:20}}>{specialCoverCollection.map(cover=><Pressable key={cover.id} accessibilityRole="button" accessibilityLabel={`${cover.label} özel kapağı`} accessibilityState={{selected:selected===cover.id}} onPress={()=>onSelect(cover.id)} style={{width:104,minHeight:146,alignItems:'center',gap:8,padding:6,borderRadius:12,borderWidth:1.5,borderColor:selected===cover.id?colors.accent:colors.border,backgroundColor:colors.surface}}><NotebookCover notebook={{title:'',coverType:'preset',coverColor:cover.color,coverImageUri:null,coverPresetId:cover.id,showTitleOnCover:false}} width={76} showTitle={false}/><View style={{height:30,justifyContent:'center'}}><Text numberOfLines={2} style={{fontFamily:fonts.medium,fontSize:11,color:colors.ink,textAlign:'center'}}>{cover.label}</Text></View></Pressable>)}</ScrollView>;
}
