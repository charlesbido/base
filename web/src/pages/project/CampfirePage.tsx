import { Button, Card, Group, ScrollArea, Stack, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import type { ChatMessageView, ChatTranscript } from '../../api/types';
import { useMe } from '../../auth';
import { ErrorAlert } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDay, formatTime, localDayKey } from '../../lib/format';
import { useProject } from './ProjectLayout';

/** How often the Campfire re-fetches. Polling only — no WebSockets in v1. */
export const POLL_INTERVAL_MS = 3000;

export function CampfirePage() {
  const { project } = useProject();
  const me = useMe();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const cursor = useRef<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  /** Merge by id: the API's `since` bound is inclusive, so the boundary message repeats. */
  const merge = useCallback((incoming: ChatMessageView[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const since = cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : '';
      const t = await api.get<ChatTranscript>(`/projects/${project.id}/chat${since}`);
      merge(t.messages);
      if (t.cursor) cursor.current = t.cursor;
      setError(undefined);
    } catch (e) {
      setError(e);
    } finally {
      setLoaded(true);
    }
  }, [project.id, merge]);

  useEffect(() => {
    setMessages([]);
    cursor.current = null;
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  // Keep pinned to the newest message.
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [messages.length]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/projects/${project.id}/chat`, { body: draft });
      setDraft('');
      await poll();
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  let lastDay = '';
  return (
    <Card padding={0}>
      <ScrollArea h="60vh" viewportRef={viewport} p="md">
        <Stack gap="sm">
          {loaded && messages.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              The Campfire is quiet. Say hello 👋
            </Text>
          )}
          {messages.map((m) => {
            const day = localDayKey(m.createdAt);
            const divider = day !== lastDay ? (
              <Text key={`d-${day}`} size="xs" c="dimmed" ta="center" fw={600}>
                {formatDay(m.createdAt)}
              </Text>
            ) : null;
            lastDay = day;
            const mine = m.author?.id === me.id;
            return [
              divider,
              <Group key={m.id} align="flex-start" wrap="nowrap" gap="sm">
                <UserAvatar user={m.author} />
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={700} c={mine ? 'campfire.8' : undefined}>
                      {m.author?.name ?? 'Former member'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatTime(m.createdAt)}
                    </Text>
                  </Group>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {m.body}
                  </Text>
                </div>
              </Group>,
            ];
          })}
        </Stack>
      </ScrollArea>
      <form onSubmit={send}>
        <Group p="md" align="flex-end" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }} wrap="nowrap">
          <Textarea
            style={{ flex: 1 }}
            placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
            autosize
            minRows={1}
            maxRows={5}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="submit" loading={sending} disabled={!draft.trim()}>
            Send
          </Button>
        </Group>
      </form>
      {error !== undefined && (
        <div style={{ padding: '0 var(--mantine-spacing-md) var(--mantine-spacing-md)' }}>
          <ErrorAlert error={error} />
        </div>
      )}
    </Card>
  );
}
