import { View } from 'react-native';
import Svg,{Line,Circle} from 'react-native-svg';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import { colors } from '@/theme/colors';
export function PagePreview({template,paperColor,width=60,height=78}:{template:PageTemplate;paperColor:PaperColor;width?:number;height?:number}){
 const bg=paperColor==='beyaz'?'#FFFFFF':'#FBF3E0';
 return <View style={{width,height,backgroundColor:bg,borderRadius:5,overflow:'hidden',borderWidth:1,borderColor:colors.divider}}><Svg width="100%" height="100%" viewBox="0 0 60 78">
 {template==='çizgili'&&Array.from({length:7},(_,i)=><Line key={i} x1="0" x2="60" y1={(i+1)*10} y2={(i+1)*10} stroke={colors.lineBlue}/>)}
 {template==='kareli'&&<>{Array.from({length:7},(_,i)=><Line key={`h${i}`} x1="0" x2="60" y1={(i+1)*10} y2={(i+1)*10} stroke={colors.lineBlue}/>)}{Array.from({length:5},(_,i)=><Line key={`v${i}`} y1="0" y2="78" x1={(i+1)*10} x2={(i+1)*10} stroke={colors.lineBlue}/>)}</>}
 {template==='noktalı'&&Array.from({length:9},(_,y)=>Array.from({length:7},(_,x)=><Circle key={`${x}-${y}`} cx={x*9+3} cy={y*9+3} r="1" fill={colors.lineBlue}/>))}
 </Svg></View>
}
