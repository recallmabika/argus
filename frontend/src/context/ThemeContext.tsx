import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('argus-theme') as ThemeMode) || 'dark';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('argus-theme', mode);
  };

  useEffect(() => {
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setIsDark(e.matches);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemChange);

    let darkCalculated = false;
    if (theme === 'dark') darkCalculated = true;
    else if (theme === 'light') darkCalculated = false;
    else darkCalculated = mediaQuery.matches;

    setIsDark(darkCalculated);

    if (darkCalculated) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
