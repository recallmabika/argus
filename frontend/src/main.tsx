import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { notifyLoadingStart, notifyLoadingFinish } from './context/LoadingContext';

// Global fetch interceptor to trigger multi-stage loading bar on API calls
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    const isApiCall = typeof url === 'string' && url.includes('/api/v1/');
    if (isApiCall) {
      notifyLoadingStart();
    }
    try {
      return await originalFetch(...args);
    } finally {
      if (isApiCall) {
        notifyLoadingFinish();
      }
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
