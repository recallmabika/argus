import { useEffect, useState, useRef, useCallback } from 'react';
import { Alert } from '../types';

type MessageHandler = (data: { type: string; alert?: Alert; [key: string]: any }) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private reconnectTimer: any = null;
  private isConnected = false;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyConnectionState(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach(handler => handler(data));
        } catch (e) {
          console.error('[WebSocket] Message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyConnectionState(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[WebSocket] Init error:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  subscribe(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected));
  }
}

export const wsService = new WebSocketService();

export function useArgusWebSocket(onMessage?: MessageHandler) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    wsService.connect();

    const unsubConn = wsService.onConnectionChange(setConnected);

    const unsubMsg = wsService.subscribe((data) => {
      if (handlerRef.current) {
        handlerRef.current(data);
      }
    });

    return () => {
      unsubConn();
      unsubMsg();
    };
  }, []);

  return { connected };
}
