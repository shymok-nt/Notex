import { ScrollView,Pressable,Text,StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { FolderFilter } from '@/types/notebook';
import { useNotebookStore } from '@/store/notebookStore';

export function FolderChips({value,onChange,includeAll=true,colorsOverride}:{value:FolderFilter;onChange:(value:FolderFilter)=>void;includeAll?:boolean;colorsOverride?:ThemeColors}){
 const {colors:themeColors,scheme}=useTheme();const colors=colorsOverride??themeColors;
 const styles=makeStyles(colors,scheme);
 const available=Array.from(new Set(useNotebookStore(s=>s.folders).map(f=>f.name as FolderFilter))).filter(name=>name!=='Tümü'&&name!=='Klasörsüz');
 const folders:FolderFilter[]=includeAll?['Tümü',...available,'Klasörsüz']:['Klasörsüz',...available];
 return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
  {folders.map(folder=><Pressable key={folder} accessibilityRole="button" accessibilityLabel={`${folder} klasörü`} accessibilityState={{selected:value===folder}} onPress={()=>onChange(folder)} style={[styles.chip,value===folder&&styles.active]}><Text style={[styles.text,value===folder&&styles.activeText]}>{folder}</Text></Pressable>)}
 </ScrollView>;
}
const makeStyles=(colors:ThemeColors,scheme:'light'|'dark')=>StyleSheet.create({
 scroll:{flexGrow:0,backgroundColor:colors.background},
 row:{gap:8,alignItems:'center',paddingHorizontal:20},
 chip:{height:42,paddingHorizontal:16,borderWidth:1,borderColor:colors.divider,borderRadius:21,backgroundColor:scheme==='light'?colors.surface:colors.surfaceRaised,alignItems:'center',justifyContent:'center'},
 active:{backgroundColor:colors.accent,borderColor:colors.accent},
 text:{fontFamily:fonts.medium,fontSize:14,color:colors.ink},
 activeText:{fontFamily:fonts.semibold,color:colors.surface}
});
