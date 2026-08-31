/**
 * Theme Context & Provider
 * Manages active theme selection ('Dark Mode', 'Light Mode', 'System Default')
 * and provides dynamic colors throughout the application.
 */
import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors } from '@/constants/theme';

export type ThemeMode = 'Dark Mode' | 'Light Mode' | 'System Default';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof DarkColors;
  isDark: boolean;
  effectiveTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'Dark Mode',
  setThemeMode: () => {},
  colors: DarkColors,
  isDark: true,
  effectiveTheme: 'dark',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('Dark Mode');
  const systemColorScheme = useColorScheme();

  const effectiveTheme: 'dark' | 'light' =
    themeMode === 'Light Mode'
      ? 'light'
      : themeMode === 'Dark Mode'
      ? 'dark'
      : systemColorScheme === 'light'
      ? 'light'
      : 'dark';

  const isDark = effectiveTheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const value = React.useMemo(
    () => ({
      themeMode,
      setThemeMode,
      colors,
      isDark,
      effectiveTheme,
    }),
    [themeMode, colors, isDark, effectiveTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
