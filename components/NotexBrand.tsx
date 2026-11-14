import { SvgXml } from 'react-native-svg';
import { notexIconSvg, notexWordmarkSvg } from '@/components/notexBrandAssets';

export function NotexIcon({compact}:{compact:boolean}){
 const size=compact?62:72;
 return <SvgXml xml={notexIconSvg} width={size} height={size} accessibilityLabel="Notex logosu"/>;
}

export function NotexWordmark({compact,dark=false}:{compact:boolean;dark?:boolean}){
 const width=compact?145:166;
 const xml=dark?notexWordmarkSvg.replace('fill="#1E293B"','fill="#FFFFFF"').replace('fill="url(#notex2dGrad)"','fill="#FFFFFF"'):notexWordmarkSvg;
 return <SvgXml xml={xml} width={width} height={width*200/560} accessibilityLabel="Notex yazı logosu"/>;
}
