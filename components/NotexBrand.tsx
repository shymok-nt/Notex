import { SvgXml } from 'react-native-svg';
import { notexIconSvg, notexWordmarkSvg } from '@/components/notexBrandAssets';

export function NotexIcon({compact}:{compact:boolean}){
 const size=compact?62:72;
 const xml=notexIconSvg.replace('viewBox="0 0 580 560"','viewBox="90 85 430 400"');
 return <SvgXml xml={xml} width={size} height={size*400/430} accessibilityLabel="Notex logosu"/>;
}

export function NotexWordmark({compact,dark=false}:{compact:boolean;dark?:boolean}){
 const width=compact?145:166;
 const themedSvg=dark?notexWordmarkSvg.replace('fill="#1E293B"','fill="#FFFFFF"').replace('fill="url(#notex2dGrad)"','fill="#FFFFFF"'):notexWordmarkSvg;
 // Crop the SVG viewport to the actual wordmark instead of moving its artwork
 // inside a wide, invisible box. Keep the source vector and theme behavior.
 const xml=themedSvg.replace('viewBox="0 0 560 200"','viewBox="28 0 504 200"');
 return <SvgXml xml={xml} width={width} height={width*200/504} accessibilityLabel="Notex yazı logosu"/>;
}
