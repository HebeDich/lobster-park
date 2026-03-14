import { useEffect, useState } from 'react';
import { DefaultService } from '@/api';

export type RealtimeEvent = {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  requestId: string;
};

export function useRealtimeEvents(limit = 20) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        const ticketResponse = await DefaultService.issueWsTicket();
        const ticket = ticketResponse.data?.ticket;
        if (!ticket || cancelled) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}/ws/v1/events?ticket=${ticket}`);
        socket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data) as RealtimeEvent;
            setEvents((current) => [parsed, ...current].slice(0, limit));
          } catch {
          }
        };
      } catch {
      }
    };

    void connect();
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [limit]);

  return events;
}
