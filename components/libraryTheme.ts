import type { ThemeColors } from '@/theme/colors';

export function libraryColors(themeColors: ThemeColors, scheme: 'light' | 'dark'): ThemeColors {
  if (scheme === 'dark') return themeColors;
  return {
    ...themeColors,
    background: '#F4F5F9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    paper: '#F4F5F9',
    ink: '#14183A',
    muted: '#7A8099',
    border: '#E3E5EE',
    divider: '#E3E5EE',
    accent: '#2F4BFF',
    highlight: '#E8ECFF',
    lineBlue: '#E3E8FF',
    onAccent: '#FFFFFF',
  };
}
