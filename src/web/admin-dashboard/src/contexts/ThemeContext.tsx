import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'white' | 'g10' | 'g90' | 'g100';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('white');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('context-store-theme') as ThemeMode;
    if (savedTheme && ['white', 'g10', 'g90', 'g100'].includes(savedTheme)) {
      setThemeState(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'g100' : 'white');
    }
  }, []);

  // Save theme to localStorage when it changes
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('context-store-theme', newTheme);
    
    // Update document class for global styles
    document.documentElement.setAttribute('data-carbon-theme', newTheme);
  };

  // Toggle between light and dark themes
  const toggleTheme = () => {
    const isDarkTheme = theme === 'g90' || theme === 'g100';
    setTheme(isDarkTheme ? 'white' : 'g100');
  };

  // Update document class when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-carbon-theme', theme);
  }, [theme]);

  const isDark = theme === 'g90' || theme === 'g100';

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};