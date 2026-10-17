import { Anchor, Badge, Button, Card, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client';
import type { PostSummary } from '../../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function MessagesPage() {
  const { project } = useProject();
  const posts = useAsync(() => api.get<PostSummary[]>(`/projects/${project.id}/posts`), [project.id]);
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Stack>
      <Group justify="flex-end">
        <Button onClick={open}>New message</Button>
      </Group>
      <ErrorAlert error={posts.error} />
      {!posts.data ? (
        <PageLoader />
      ) : posts.data.length === 0 ? (
        <Text c="dimmed">No messages yet. Post an announcement, a pitch, or a question for the team.</Text>
      ) : (
        posts.data.map((p) => (
          <Card key={p.id} padding="md">
            <Group wrap="nowrap" align="flex-start">
              <UserAvatar user={p.author} size="md" />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Anchor component={Link} to={`/projects/${project.id}/messages/${p.id}`} fw={700}>
                  {p.title}
                </Anchor>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {p.excerpt}
                </Text>
                <Text size="xs" c="dimmed">
                  {p.author?.name ?? 'Former member'} · {formatDateTime(p.createdAt)}
                </Text>
              </Stack>
              {p.commentCount > 0 && <Badge variant="light" color="gray">💬 {p.commentCount}</Badge>}
            </Group>
          </Card>
        ))
      )}
      <Modal opened={opened} onClose={close} title="New message" size="lg">
        <PostForm
          submitLabel="Post this message"
          onSubmit={async (values) => {
            const post = await api.post<{ id: string }>(`/projects/${project.id}/posts`, values);
            close();
            return `/projects/${project.id}/messages/${post.id}`;
          }}
        />
      </Modal>
    </Stack>
  );
}

interface PostFormProps {
  initial?: { title: string; body: string };
  submitLabel: string;
  /** Returns a path to navigate to afterwards, if any. */
  onSubmit: (values: { title: string; body: string }) => Promise<string | void>;
  onCancel?: () => void;
}

export function PostForm({ initial, submitLabel, onSubmit, onCancel }: PostFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await onSubmit({ title, body });
      if (next) navigate(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} error={fields.title} required autoFocus />
        <Textarea
          label="Message"
          description="Supports # headings, **bold**, *italic*, `code`, - lists, > quotes and [links](https://…)"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          error={fields.body}
          autosize
          minRows={8}
          required
        />
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          {onCancel && <Button variant="subtle" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" loading={busy}>{submitLabel}</Button>
        </Group>
      </Stack>
    </form>
  );
}
