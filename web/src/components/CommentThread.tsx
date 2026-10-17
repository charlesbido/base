import { Button, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { api } from '../api/client';
import type { CommentView } from '../api/types';
import { useMe } from '../auth';
import { formatDateTime } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { ErrorAlert } from './Feedback';
import { UserAvatar } from './UserAvatar';

interface Props {
  comments: CommentView[];
  /** e.g. "/todos/123/comments" */
  postPath: string;
  onChange: () => void;
}

export function CommentThread({ comments, postPath, onChange }: Props) {
  const me = useMe();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api.post(postPath, { body });
      setBody('');
      onChange();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${id}`);
      onChange();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Stack gap="sm">
      <Text fw={600}>Comments {comments.length > 0 && `(${comments.length})`}</Text>
      {comments.map((c) => (
        <Paper key={c.id} p="sm">
          <Group gap="xs" mb={4} justify="space-between">
            <Group gap="xs">
              <UserAvatar user={c.author} size="sm" />
              <Text size="sm" fw={600}>
                {c.author?.name ?? 'Former member'}
              </Text>
              <Text size="xs" c="dimmed">
                {formatDateTime(c.createdAt)}
              </Text>
            </Group>
            {c.author?.id === me.id && (
              <Button variant="subtle" color="red" size="compact-xs" onClick={() => remove(c.id)}>
                Delete
              </Button>
            )}
          </Group>
          <Markdown source={c.body} />
        </Paper>
      ))}
      <ErrorAlert error={error} />
      <Textarea
        placeholder="Add a comment…"
        autosize
        minRows={2}
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) void submit();
        }}
      />
      <Group justify="flex-end">
        <Button onClick={submit} loading={busy} disabled={!body.trim()}>
          Add comment
        </Button>
      </Group>
    </Stack>
  );
}
