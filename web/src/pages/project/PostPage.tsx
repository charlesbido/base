import { Anchor, Button, Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import type { PostDetail } from '../../api/types';
import { useMe } from '../../auth';
import { CommentThread } from '../../components/CommentThread';
import { ErrorAlert, PageLoader } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDateTime } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { useAsync } from '../../lib/useAsync';
import { PostForm } from './MessagesPage';
import { useProject } from './ProjectLayout';

export function PostPage() {
  const { postId = '' } = useParams();
  const { project } = useProject();
  const me = useMe();
  const navigate = useNavigate();
  const post = useAsync(() => api.get<PostDetail>(`/posts/${postId}`), [postId]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<unknown>();

  if (!post.data) return post.error ? <ErrorAlert error={post.error} /> : <PageLoader />;
  const p = post.data;
  const back = `/projects/${project.id}/messages`;

  async function remove() {
    if (!window.confirm('Delete this message and its comments?')) return;
    try {
      await api.delete(`/posts/${p.id}`);
      navigate(back);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Stack>
      <Anchor component={Link} to={back} size="sm">
        ← Message Board
      </Anchor>
      <Card padding="xl">
        {editing ? (
          <PostForm
            initial={{ title: p.title, body: p.body }}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await api.patch(`/posts/${p.id}`, values);
              setEditing(false);
              await post.reload();
            }}
          />
        ) : (
          <>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Title order={2}>{p.title}</Title>
              {p.author?.id === me.id && (
                <Group gap="xs" wrap="nowrap">
                  <Button variant="default" size="xs" onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="subtle" color="red" size="xs" onClick={remove}>Delete</Button>
                </Group>
              )}
            </Group>
            <Group gap="xs" my="sm">
              <UserAvatar user={p.author} />
              <Text size="sm">{p.author?.name ?? 'Former member'}</Text>
              <Text size="sm" c="dimmed">
                · {formatDateTime(p.createdAt)}
                {p.updatedAt !== p.createdAt && ' (edited)'}
              </Text>
            </Group>
            <Divider mb="md" />
            <Markdown source={p.body} />
          </>
        )}
        <ErrorAlert error={error} />
      </Card>
      <CommentThread comments={p.comments} postPath={`/posts/${p.id}/comments`} onChange={() => void post.reload()} />
    </Stack>
  );
}
