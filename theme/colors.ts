export const lightColors={background:'#FAF7F2',surface:'#FFFFFF',surfaceRaised:'#FFFFFF',paper:'#FFFEFA',ink:'#1B1B2F',muted:'#55546A',border:'#D9D4C7',divider:'#ECE7DA',accent:'#3347D9',highlight:'#FFE98A',coral:'#FF6B5A',lineBlue:'#DCE3F5',onAccent:'#FFFFFF',overlay:'rgba(0,0,0,0.45)'} as const;
export const darkColors={background:'#121218',surface:'#1C1C26',surfaceRaised:'#23232F',paper:'#FFFEFA',ink:'#F2F0EA',muted:'#A3A2B5',border:'#3A3A4A',divider:'#2A2A36',accent:'#7C8BFF',highlight:'#FFE98A',coral:'#FF7F70',lineBlue:'#DCE3F5',onAccent:'#0E0E18',overlay:'rgba(0,0,0,0.7)'} as const;
export type ThemeColors={ [K in keyof typeof lightColors]:string };
export const colors:ThemeColors={...lightColors};
export function applyColors(scheme:'light'|'dark'){Object.assign(colors,scheme==='dark'?darkColors:lightColors)}
