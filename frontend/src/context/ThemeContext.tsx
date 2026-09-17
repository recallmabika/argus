import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyThemeToDOM = (isDarkTheme: boolean) => {
  if (typeof document === 'undefined') return;
  if (isDarkTheme) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (
      (localStorage.getItem('argus-theme') as ThemeMode) ||
      (localStorage.getItem('theme') as ThemeMode) ||
      'dark'
    );
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('argus-theme', mode);
    localStorage.setItem('theme', mode);

    let darkCalculated = false;
    if (mode === 'dark') darkCalculated = true;
    else if (mode === 'light') darkCalculated = false;
    else darkCalculated = window.matchMedia('(prefers-color-scheme: dark)').matches;

    setIsDark(darkCalculated);
    applyThemeToDOM(darkCalculated);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  useEffect(() => {
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setIsDark(e.matches);
        applyThemeToDOM(e.matches);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemChange);

    let darkCalculated = false;
    if (theme === 'dark') darkCalculated = true;
    else if (theme === 'light') darkCalculated = false;
    else darkCalculated = mediaQuery.matches;

    setIsDark(darkCalculated);
    applyThemeToDOM(darkCalculated);

    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
