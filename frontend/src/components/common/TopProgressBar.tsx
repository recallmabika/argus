import React, { useState, useEffect } from 'react';
import { useLoading } from '../../context/LoadingContext';

export const TopProgressBar: React.FC = () => {
  const { isLoading, progress, currentColor } = useLoading();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading || progress > 0) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isLoading, progress]);

  if (!visible && !isLoading && progress === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[999999] pointer-events-none transition-opacity duration-300 ${
        !isLoading && progress >= 100 ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Sleek, High-Precision Top Progress Bar across viewport top */}
      <div
        className="h-[3px] transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: currentColor,
          boxShadow: `0 0 10px ${currentColor}, 0 0 3px ${currentColor}`
        }}
      />
    </div>
  );
};
