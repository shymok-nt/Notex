import { Pressable,Text,View } from 'react-native';
import { ChevronRight,Folder as FolderIcon,MoreHorizontal,ChevronUp,ChevronDown } from 'lucide-react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { useTheme } from '@/theme/ThemeProvider';
import type { Notebook } from '@/types/notebook';
export function FolderRow({name,count,notebooks=[],onPress,onOptions,onUp,onDown}:{name:string;count:number;notebooks?:Notebook[];onPress:()=>void;onOptions?:()=>void;onUp?:()=>void;onDown?:()=>void}){
 const {colors}=useTheme();return <View style={{minHeight:88,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.divider,gap:14}}>
 <Pressable accessibilityRole="button" accessibilityLabel={name+' klasörünü aç'} onPress={onPress} onLongPress={onOptions} style={{flex:1,minHeight:88,flexDirection:'row',alignItems:'center',gap:14}}>
 <View style={{width:62,height:64,justifyContent:'center',alignItems:'center'}}>{notebooks.length?notebooks.slice(0,2).map((n,i)=><View key={n.id} style={{position:'absolute',left:7+i*9,top:5+i*3}}><NotebookCover notebook={{...n,showTitleOnCover:false}} width={36}/></View>):<FolderIcon size={34} color={colors.accent}/>}</View>
 <View style={{flex:1}}><Text numberOfLines={1} style={{color:colors.ink,fontSize:16,fontWeight:'600'}}>{name}</Text><Text style={{color:colors.muted,fontSize:13,marginTop:4}}>{count} defter</Text></View>
 </Pressable>
 {onUp&&<Pressable accessibilityRole="button" accessibilityLabel={name+' yukarı taşı'} style={{width:44,height:44,justifyContent:'center',alignItems:'center'}} onPress={onUp}><ChevronUp color={colors.ink}/></Pressable>}
 {onDown&&<Pressable accessibilityRole="button" accessibilityLabel={name+' aşağı taşı'} style={{width:44,height:44,justifyContent:'center',alignItems:'center'}} onPress={onDown}><ChevronDown color={colors.ink}/></Pressable>}
 {onOptions?<Pressable accessibilityRole="button" accessibilityLabel={name+' seçenekleri'} onPress={onOptions} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><MoreHorizontal color={colors.ink}/></Pressable>:<ChevronRight color={colors.muted}/>}
 </View>
}
