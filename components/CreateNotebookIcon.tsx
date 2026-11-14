import Svg,{G,Path,Rect} from 'react-native-svg';

export function CreateNotebookIcon({size=66}:{size?:number}){
 return <Svg width={size} height={size} viewBox="18 18 84 84" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  <Rect x="18" y="18" width="84" height="84" rx="20" fill="#000000"/>
  <Path d="M32 85C41 85 45 77 53 79C61 81 65 87 75 83" stroke="#EC4899" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  <Path d="M75 83C81 81 85 77 89 75" stroke="#06B6D4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  <G>
   <Path d="M72.5 31.5L87.5 46.5L51.5 82.5L34.5 84.5L36.5 67.5L72.5 31.5Z" fill="#9333EA" stroke="#C4B5FD" strokeWidth="1.5"/>
   <Path d="M72.5 31.5L78 37L42 73L36.5 67.5L72.5 31.5Z" fill="#4F46E5"/>
   <Path d="M82 41L87.5 46.5L51.5 82.5L45.5 83.2L82 41Z" fill="#EC4899"/>
   <Path d="M77.5 26.5C79.7091 24.2909 83.2909 24.2909 85.5 26.5L92.5 33.5C94.7091 35.7091 94.7091 39.2909 92.5 41.5L87.5 46.5L72.5 31.5L77.5 26.5Z" fill="#FFFFFF" stroke="#A5B4FC" strokeWidth="1.8"/>
   <Path d="M36.5 67.5L51.5 82.5L34.5 84.5L36.5 67.5Z" fill="#FEF3C7"/>
   <Path d="M35.2 78.5L40.5 83.8L34.5 84.5L35.2 78.5Z" fill="#312E81"/>
   <Rect x="65.5" y="38.5" width="4" height="12" rx="2" rotation="45" origin="65.5, 38.5" fill="#FFFFFF"/>
  </G>
 </Svg>;
}
