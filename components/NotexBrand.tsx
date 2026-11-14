import { SvgXml } from 'react-native-svg';
import { notexIconSvg, notexWordmarkSvg } from '@/components/notexBrandAssets';

export function NotexIcon({compact}:{compact:boolean}){
 const size=compact?62:72;
 return <SvgXml xml={notexIconSvg} width={size} height={size} accessibilityLabel="Notex logosu"/>;
}

export function NotexWordmark({compact,dark=false}:{compact:boolean;dark?:boolean}){
 const width=compact?145:166;
 const themedSvg=dark?notexWordmarkSvg.replace('fill="#1E293B"','fill="#FFFFFF"').replace('fill="url(#notex2dGrad)"','fill="#FFFFFF"'):notexWordmarkSvg;
 // The supplied SVG has unused left padding inside its viewBox. Shift its viewport,
 // not the layout gap, so the visible lettering sits closer to the icon.
 const xml=themedSvg.replace('viewBox="0 0 560 200"','viewBox="55 0 560 200"');
 return <SvgXml xml={xml} width={width} height={width*200/560} accessibilityLabel="Notex yazı logosu"/>;
}
