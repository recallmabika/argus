import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface LoadingContextType {
  startLoading: () => void;
  finishLoading: () => void;
  isLoading: boolean;
  progress: number;
  currentColor: string;
}

const LoadingContext = createContext<LoadingContextType>({
  startLoading: () => {},
  finishLoading: () => {},
  isLoading: false,
  progress: 0,
  currentColor: '#ef4444'
});

export const useLoading = () => useContext(LoadingContext);

/**
 * Color progression strictly adhering to:
 * Red -> Orange -> Yellow -> Blue -> Green (when complete)
 */
export const getColorForProgress = (pct: number): string => {
  if (pct < 25) return '#ef4444'; // Red (0 - 24%)
  if (pct < 50) return '#f97316'; // Orange (25 - 49%)
  if (pct < 75) return '#eab308'; // Yellow (50 - 74%)
  if (pct < 98) return '#3b82f6'; // Blue (75 - 97%)
  return '#10b981';               // Green when complete (98 - 100%)
};

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentColor, setCurrentColor] = useState<string>('#ef4444');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
  };

  const startLoading = useCallback(() => {
    clearTimers();
    setIsLoading(true);
    setProgress(15);
    setCurrentColor('#ef4444'); // Starts Red

    let currentPct = 15;
    timerRef.current = setInterval(() => {
      currentPct += (90 - currentPct) * 0.18;
      const rounded = Math.round(currentPct);
      setProgress(rounded);
      setCurrentColor(getColorForProgress(rounded));
      if (rounded >= 90 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 100);
  }, []);

  const finishLoading = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setCurrentColor('#10b981'); // Turns Green when complete

    finishTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setCurrentColor('#ef4444');
    }, 300);
  }, []);

  // ONLY trigger loading when user actually navigates to a different page route
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      startLoading();
      const t = setTimeout(() => {
        finishLoading();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [location.pathname, startLoading, finishLoading]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        startLoading,
        finishLoading,
        isLoading,
        progress,
        currentColor
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};
