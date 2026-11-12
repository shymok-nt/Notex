import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { lightColors } from '@/theme/colors';
import { defaultCoverColor } from '@/theme/covers';
import { fonts } from '@/theme/fonts';
import { darken, lighten, isLightCover } from '@/utils/color';
import type { Notebook, NotebookDraft } from '@/types/notebook';
type CoverData=Pick<NotebookDraft,'title'|'coverType'|'coverColor'|'coverImageUri'|'showTitleOnCover'> & {favorite?:boolean};
export function NotebookCover({notebook,width=160,showTitle=notebook.showTitleOnCover,colorsOverride}:{notebook:CoverData;width?:number;showTitle?:boolean;colorsOverride?:ThemeColors}){
 const {colors:themeColors,scheme}=useTheme();const colors=colorsOverride??themeColors;const styles=makeStyles(colors);
 const height=width*4/3,light=notebook.coverType==='color'&&isLightCover(notebook.coverColor);
 const foreground=light?lightColors.ink:lightColors.surface;
 const coverColor=notebook.coverColor;
 return <View style={[styles.shadow,{width,height},scheme==='dark'&&{shadowOpacity:0,borderWidth:1,borderColor:colors.border,borderRadius:12}]}>
  <View style={[styles.cover,{backgroundColor:notebook.coverType==='color'?colors.ink:coverColor}]}>
   {notebook.coverType==='image'&&notebook.coverImageUri&&<Image source={{uri:notebook.coverImageUri}} resizeMode="cover" style={StyleSheet.absoluteFill}/>}
   <LinearGradient pointerEvents="none" colors={notebook.coverType==='image'?['#FFFFFF10','#00000008','#00000050']:[lighten(coverColor,0.06),coverColor,darken(coverColor,0.04)]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
   <View style={[styles.spine,{width:Math.max(8,width*0.0875),backgroundColor:notebook.coverType==='color'?darken(coverColor,0.2):'#151525B8'}]}>
    {[0,1,2,3].map(i=><View key={i} style={[styles.stitch,{width:Math.max(3,width*0.03),height:Math.max(3,width*0.03)}]}/>)}
   </View>
   {showTitle&&<View style={[styles.label,{left:width*0.15,right:width*0.07,bottom:notebook.coverType==='image'?height*0.29:height*0.13,backgroundColor:notebook.coverType==='image'?'#00000070':light?'#FFFFFF9C':'#FFFFFF27'}]}><Text numberOfLines={3} style={{fontFamily:fonts.heading,fontSize:Math.max(9,width*0.1),textAlign:'center',color:foreground}}>{notebook.title}</Text></View>}
   {notebook.favorite&&<View style={[styles.favorite,{top:Math.max(7,width*0.05),right:Math.max(7,width*0.05)}]}><Star size={Math.max(12,width*0.105)} color="#C68A00" fill={colors.highlight}/></View>}
   <View style={styles.pageRight}/><View style={styles.pageBottom}/>
  </View>
 </View>
}
const makeStyles=(colors:ThemeColors)=>StyleSheet.create({shadow:{shadowColor:colors.ink,shadowOffset:{width:0,height:3},shadowRadius:7,shadowOpacity:0.12,elevation:3},cover:{flex:1,overflow:'hidden',borderTopLeftRadius:4,borderBottomLeftRadius:4,borderTopRightRadius:12,borderBottomRightRadius:12},spine:{position:'absolute',left:0,top:0,bottom:0,justifyContent:'space-evenly',alignItems:'center',borderRightWidth:1,borderRightColor:'#FFFFFF40'},stitch:{borderRadius:20,backgroundColor:'#FFFFFF7A'},label:{position:'absolute',paddingVertical:7,paddingHorizontal:4,borderRadius:6},favorite:{position:'absolute',backgroundColor:'#FFFFFFE8',width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'},pageRight:{position:'absolute',right:0,top:7,bottom:4,width:3,backgroundColor:'#F7F0DDCC'},pageBottom:{position:'absolute',left:12,right:4,bottom:0,height:3,backgroundColor:'#F4ECD8DD'}});
