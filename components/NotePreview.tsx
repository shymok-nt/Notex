import { View, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import type { NoteTemplate } from '@/types/note';

export function NotePreview({template}:{template:NoteTemplate}) {
 const width=320,height=136;
 return <View style={styles.preview}><Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice">
 {template==='çizgili' && Array.from({length:7},(_,i)=><Line key={i} x1="0" x2={width} y1={(i+1)*20} y2={(i+1)*20} stroke={colors.lineBlue} strokeWidth="1"/>)}
 {template==='kareli' && <>{Array.from({length:7},(_,i)=><Line key={`h${i}`} x1="0" x2={width} y1={(i+1)*20} y2={(i+1)*20} stroke={colors.lineBlue}/>)}{Array.from({length:16},(_,i)=><Line key={`v${i}`} y1="0" y2={height} x1={(i+1)*20} x2={(i+1)*20} stroke={colors.lineBlue}/>)}</>}
 {template==='noktalı' && Array.from({length:8},(_,y)=>Array.from({length:20},(_,x)=><Circle key={`${x}-${y}`} cx={x*16+8} cy={y*16+8} r="1.1" fill={colors.lineBlue}/>))}
 </Svg></View>;
}
const styles=StyleSheet.create({preview:{height:136,backgroundColor:colors.paper,borderRadius:16,overflow:'hidden',shadowColor:colors.ink,shadowOffset:{width:0,height:2},shadowOpacity:0.1,shadowRadius:8,elevation:2}});
