import { StyleSheet, Text, View } from 'react-native';
import Svg,{Path,Rect,Line} from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
export function EmptyState({ colorsOverride }: { colorsOverride?: ThemeColors }) {
  const { colors: themeColors } = useTheme();
  const colors = colorsOverride ?? themeColors;
  const styles = makeStyles(colors);
  return <View style={styles.root}>
    <Svg width={86} height={96} viewBox="0 0 86 96">
      <Rect x="17" y="8" width="55" height="75" rx="8" fill={colors.paper} stroke={colors.border} strokeWidth="2" />
      <Rect x="17" y="8" width="9" height="75" rx="3" fill={colors.accent} />
      <Path d="M36 30H62 M36 40H57 M36 50H60" stroke={colors.lineBlue} strokeWidth="3" strokeLinecap="round" />
      <Line x1="17" y1="87" x2="71" y2="87" stroke={colors.border} strokeWidth="2" />
    </Svg>
    <Text style={styles.title}>Burada henüz defter yok</Text>
    <Text style={styles.subtitle}>Yeni defter oluşturmak için + butonuna dokun</Text>
  </View>;
}
const makeStyles=(colors:ThemeColors)=>StyleSheet.create({root:{alignItems:'center',justifyContent:'center',paddingHorizontal:24},title:{fontFamily:fonts.heading,fontSize:19,color:colors.ink,marginTop:18,textAlign:'center'},subtitle:{fontFamily:fonts.body,fontSize:14,color:colors.muted,marginTop:10,textAlign:'center'}});
