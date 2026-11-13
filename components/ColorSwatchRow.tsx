import { ScrollView,Pressable,View,StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { coverPalette,isLightCover } from '@/theme/covers';
import { useTheme } from '@/theme/ThemeProvider';
import { lightColors,type ThemeColors } from '@/theme/colors';
import { DefaultLinenCover } from '@/components/DefaultLinenCover';
export function ColorSwatchRow({selected,onSelect}:{selected:string;onSelect:(color:string)=>void}){const {colors}=useTheme();const styles=makeStyles(colors);return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{coverPalette.map(item=><Pressable key={item.color} accessibilityRole="button" accessibilityLabel={`${item.name} kapak rengi`} accessibilityState={{selected:item.color===selected}} onPress={()=>onSelect(item.color)} style={[styles.touch,item.color===selected&&styles.active]}><View style={[styles.miniCover,{backgroundColor:item.color}]}><DefaultLinenCover color={item.color} width={30} height={40}/>{item.color===selected&&<Check size={20} strokeWidth={3} color={isLightCover(item.color)?lightColors.ink:lightColors.surface}/>}</View></Pressable>)}</ScrollView>}
const makeStyles=(colors:ThemeColors)=>StyleSheet.create({row:{gap:6,paddingVertical:4,paddingRight:16},touch:{width:48,height:48,borderRadius:7,borderWidth:2,borderColor:'transparent',alignItems:'center',justifyContent:'center'},active:{borderColor:colors.accent},miniCover:{width:30,height:40,borderRadius:3,overflow:'hidden',alignItems:'center',justifyContent:'center'}});
