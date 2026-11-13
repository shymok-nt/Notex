import { Image, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { defaultCoverColor,getPremiumCover,getSpecialCover,type PremiumCoverStyle } from '@/theme/covers';
import { PremiumCoverArt } from '@/components/PremiumCoverArt';
import { PremiumCoverFace } from '@/components/PremiumCoverFace';
import { SpecialCoverImage } from '@/components/SpecialCoverImage';
import { DefaultLinenCover } from '@/components/DefaultLinenCover';
import { resolveCoverRenderUri,storedFileAssetUri } from '@/utils/tauriFiles';
import type { Notebook, NotebookDraft } from '@/types/notebook';
type CoverData=Pick<NotebookDraft,'title'|'coverType'|'coverColor'|'coverImageUri'|'coverPresetId'|'showTitleOnCover'> & {favorite?:boolean;coverImagePath?:string|null};
export function NotebookCover({notebook,width=160,showTitle=notebook.showTitleOnCover,colorsOverride}:{notebook:CoverData;width?:number;showTitle?:boolean;colorsOverride?:ThemeColors}){
 const {colors:themeColors}=useTheme();const colors=colorsOverride??themeColors;const styles=makeStyles(colors);
 const preset=notebook.coverType==='preset'?getPremiumCover(notebook.coverPresetId):null;
 const special=notebook.coverType==='preset'?getSpecialCover(notebook.coverPresetId):null;
 const height=width*4/3,coverColor=/^#[0-9a-f]{6}$/i.test(notebook.coverColor)?notebook.coverColor:(preset?.color??special?.color??defaultCoverColor);
 const legacyPreset=preset?.style==='linen'||preset?.style==='leather';
 const pdfCoverUri=notebook.coverPresetId==='pdf-import'?storedFileAssetUri(notebook.coverImagePath):null;
 return <View style={[styles.shadow,{width,height}]}>
  <View style={[styles.cover,{backgroundColor:coverColor}]}>
   {notebook.coverType==='image'&&(pdfCoverUri||notebook.coverImageUri)&&<Image source={{uri:pdfCoverUri??resolveCoverRenderUri(notebook.coverImageUri)??notebook.coverImageUri!}} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors/>}
   {notebook.coverType==='color'&&<DefaultLinenCover color={coverColor} width={width} height={height}/>}
   {special&&<SpecialCoverImage id={special.id} width={width} height={height} backgroundColor={coverColor}/>}
   {preset&&(legacyPreset?<PremiumCoverArt style={preset.style} ink={preset.ink} width={width}/>:<PremiumCoverFace style={preset.style as PremiumCoverStyle} color={coverColor} ink={preset.ink} width={width} title={notebook.title} showTitle={false}/>)}
   {notebook.favorite&&<View style={[styles.favorite,{top:Math.max(7,width*0.05),right:Math.max(7,width*0.05)}]}><Star size={Math.max(12,width*0.105)} color="#C68A00" fill={colors.highlight}/></View>}
  </View>
 </View>
}
const makeStyles=(colors:ThemeColors)=>StyleSheet.create({shadow:{shadowColor:colors.ink,shadowOffset:{width:0,height:2},shadowRadius:4,shadowOpacity:0.08,elevation:1,borderRadius:7},cover:{flex:1,overflow:'hidden',borderRadius:7},favorite:{position:'absolute',backgroundColor:'#FFFFFFE8',width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'}});
