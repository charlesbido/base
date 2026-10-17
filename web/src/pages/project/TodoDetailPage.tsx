import { Anchor, Badge, Button, Card, Checkbox, Group, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import type { TodoDetail } from '../../api/types';
import { CommentThread } from '../../components/CommentThread';
import { ErrorAlert, fieldErrors, PageLoader } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDateTime, formatDueDate, isOverdue } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function TodoDetailPage() {
  const { todoId = '' } = useParams();
  const { project, reloadProject } = useProject();
  const navigate = useNavigate();
  const todo = useAsync(() => api.get<TodoDetail>(`/todos/${todoId}`), [todoId]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<unknown>();

  if (!todo.data) return todo.error ? <ErrorAlert error={todo.error} /> : <PageLoader />;
  const t = todo.data;
  const back = `/projects/${project.id}/todos`;

  async function toggle() {
    if (t.done) await api.delete(`/todos/${t.id}/completion`);
    else await api.post(`/todos/${t.id}/completion`);
    await todo.reload();
    void reloadProject();
  }

  async function remove() {
    if (!window.confirm('Delete this to-do?')) return;
    try {
      await api.delete(`/todos/${t.id}`);
      void reloadProject();
      navigate(back);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Stack>
      <Anchor component={Link} to={back} size="sm">
        ← {t.list.name}
      </Anchor>
      <Card padding="lg">
        {editing ? (
          <EditTodoForm
            todo={t}
            onDone={() => {
              setEditing(false);
              void todo.reload();
            }}
          />
        ) : (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Checkbox checked={t.done} onChange={toggle} size="md" mt={6} aria-label="Done" />
                <Title order={3} td={t.done ? 'line-through' : undefined}>
                  {t.title}
                </Title>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" size="xs" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="subtle" color="red" size="xs" onClick={remove}>Delete</Button>
              </Group>
            </Group>
            <Group gap="lg">
              <Group gap={6}>
                <Text size="sm" c="dimmed">Assigned to</Text>
                {t.assignee ? (
                  <>
                    <UserAvatar user={t.assignee} size="sm" />
                    <Text size="sm">{t.assignee.name}</Text>
                  </>
                ) : (
                  <Text size="sm">Nobody</Text>
                )}
              </Group>
              <Group gap={6}>
                <Text size="sm" c="dimmed">Due</Text>
                {t.dueDate ? (
                  <Badge variant="light" color={isOverdue(t.dueDate, t.done) ? 'red' : 'gray'}>{formatDueDate(t.dueDate)}</Badge>
                ) : (
                  <Text size="sm">No due date</Text>
                )}
              </Group>
            </Group>
            {t.description ? <Markdown source={t.description} /> : null}
            <Text size="xs" c="dimmed">
              Added by {t.createdBy?.name ?? 'a former member'} · {formatDateTime(t.createdAt)}
              {t.done && t.completedAt && ` · Completed ${formatDateTime(t.completedAt)}`}
            </Text>
          </Stack>
        )}
        <ErrorAlert error={error} />
      </Card>
      <CommentThread comments={t.comments} postPath={`/todos/${t.id}/comments`} onChange={() => void todo.reload()} />
    </Stack>
  );
}

function EditTodoForm({ todo, onDone }: { todo: TodoDetail; onDone: () => void }) {
  const { project } = useProject();
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [assigneeId, setAssigneeId] = useState<string | null>(todo.assignee?.id ?? null);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? '');
  const [error, setError] = useState<unknown>();
  useEffect(() => setError(undefined), [title, description, assigneeId, dueDate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.patch(`/todos/${todo.id}`, { title, description, assigneeId, dueDate: dueDate || null });
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} error={fields.title} required />
        <Textarea label="Notes" description="Supports **bold**, *italic*, lists and [links](https://…)" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={3} />
        <Group grow>
          <Select
            label="Assignee"
            clearable
            data={project.members.map((m) => ({ value: m.id, label: m.name }))}
            value={assigneeId}
            onChange={setAssigneeId}
            error={fields.assigneeId}
          />
          <TextInput label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} error={fields.dueDate} />
        </Group>
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onDone}>Cancel</Button>
          <Button type="submit">Save changes</Button>
        </Group>
      </Stack>
    </form>
  );
}
