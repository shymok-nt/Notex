import { Image, View } from 'react-native';
import Svg,{Line,Circle} from 'react-native-svg';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import { colors } from '@/theme/colors';
import { isTauriDesktop, storedFileAssetUri } from '@/utils/tauriFiles';
import { resolveCoverUri } from '@/utils/files';
export function PagePreview({template,paperColor,width=60,height=78,thumbnailPath}:{template:PageTemplate;paperColor:PaperColor;width?:number;height?:number;thumbnailPath?:string|null}){
 const bg=paperColor==='beyaz'?'#FFFFFF':'#FBF3E0';
 const thumbnailUri=thumbnailPath?(isTauriDesktop()?storedFileAssetUri(thumbnailPath):resolveCoverUri(thumbnailPath)):null;
 if(thumbnailUri)return <View style={{width,height,backgroundColor:bg,borderRadius:5,overflow:'hidden',borderWidth:1,borderColor:colors.divider}}><Image source={{uri:thumbnailUri}} resizeMode="contain" style={{width:'100%',height:'100%'}}/></View>;
 return <View style={{width,height,backgroundColor:bg,borderRadius:5,overflow:'hidden',borderWidth:1,borderColor:colors.divider}}><Svg width="100%" height="100%" viewBox="0 0 60 78">
 {template==='çizgili'&&Array.from({length:7},(_,i)=><Line key={i} x1="0" x2="60" y1={(i+1)*10} y2={(i+1)*10} stroke={colors.lineBlue}/>)}
 {template==='kareli'&&<>{Array.from({length:7},(_,i)=><Line key={`h${i}`} x1="0" x2="60" y1={(i+1)*10} y2={(i+1)*10} stroke={colors.lineBlue}/>)}{Array.from({length:5},(_,i)=><Line key={`v${i}`} y1="0" y2="78" x1={(i+1)*10} x2={(i+1)*10} stroke={colors.lineBlue}/>)}</>}
 {template==='noktalı'&&Array.from({length:9},(_,y)=>Array.from({length:7},(_,x)=><Circle key={`${x}-${y}`} cx={x*9+3} cy={y*9+3} r="1" fill={colors.lineBlue}/>))}
 </Svg></View>
}
