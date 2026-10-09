"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HubEvent } from "@/lib/contracts";

// One EventSource per URL per tab, shared by every component that asks for it
// and closed when the last one unmounts. Read with useSyncExternalStore, like
// use-mounted.ts.
//
// The stream does not replay what was missed while it was down. Consumers
// should refetch their data when `connected` turns true again, not only when
// `latest` changes.

export type LiveState = { latest: HubEvent | null; connected: boolean };

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const OFFLINE: LiveState = { latest: null, connected: false };

type Channel = {
  url: string;
  state: LiveState;
  listeners: Set<() => void>;
  refs: number;
  source: EventSource | null;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const channels = new Map<string, Channel>();

function set(channel: Channel, next: Partial<LiveState>) {
  channel.state = { ...channel.state, ...next };
  channel.listeners.forEach((listener) => listener());
}

function connect(channel: Channel) {
  channel.timer = null;
  const source = new EventSource(channel.url);
  channel.source = source;

  source.onopen = () => {
    channel.attempt = 0;
    set(channel, { connected: true });
  };
  source.onmessage = (message) => {
    let json: unknown;
    try {
      json = JSON.parse(message.data);
    } catch {
      return;
    }
    const parsed = HubEvent.safeParse(json);
    if (parsed.success) set(channel, { latest: parsed.data });
  };
  source.onerror = () => {
    set(channel, { connected: false });
    // EventSource retries a network drop on its own. CLOSED means it gave up,
    // for example after a 502 from Caddy while the hub restarts.
    if (source.readyState === EventSource.CLOSED) {
      source.close();
      channel.source = null;
      scheduleReconnect(channel);
    }
  };
}

function scheduleReconnect(channel: Channel) {
  if (channel.timer || channel.refs === 0) return;
  const delay = BACKOFF_MS[Math.min(channel.attempt, BACKOFF_MS.length - 1)];
  channel.attempt += 1;
  channel.timer = setTimeout(() => connect(channel), delay);
}

function reconnectNow(channel: Channel) {
  if (channel.source || channel.refs === 0) return;
  if (channel.timer) clearTimeout(channel.timer);
  connect(channel);
}

function onOnline() {
  channels.forEach(reconnectNow);
}

function acquire(url: string): Channel {
  let channel = channels.get(url);
  if (!channel) {
    if (channels.size === 0) window.addEventListener("online", onOnline);
    channel = { url, state: OFFLINE, listeners: new Set(), refs: 0, source: null, attempt: 0, timer: null };
    channels.set(url, channel);
    connect(channel);
  }
  channel.refs += 1;
  return channel;
}

function release(channel: Channel) {
  channel.refs -= 1;
  if (channel.refs > 0) return;
  channel.source?.close();
  if (channel.timer) clearTimeout(channel.timer);
  channels.delete(channel.url);
  if (channels.size === 0) window.removeEventListener("online", onOnline);
}

export function useLiveEvents(options?: { code?: string | null }): LiveState {
  const code = options?.code ?? null;
  const url = code ? `/api/events?code=${encodeURIComponent(code)}` : "/api/events";

  // Stable per URL. React resubscribes whenever this changes, and a resubscribe
  // closes and reopens the EventSource.
  const subscribe = useCallback(
    (listener: () => void) => {
      const channel = acquire(url);
      channel.listeners.add(listener);
      return () => {
        channel.listeners.delete(listener);
        release(channel);
      };
    },
    [url],
  );

  return useSyncExternalStore(
    subscribe,
    () => channels.get(url)?.state ?? OFFLINE,
    () => OFFLINE,
  );
}
