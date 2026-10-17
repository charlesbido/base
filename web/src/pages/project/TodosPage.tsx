import {
  ActionIcon, Anchor, Badge, Button, Card, Checkbox, Group, Menu, Progress, Select, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import type { TodoListView, TodoView } from '../../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDueDate, isOverdue } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function TodosPage() {
  const { project, reloadProject } = useProject();
  const lists = useAsync(() => api.get<TodoListView[]>(`/projects/${project.id}/todolists`), [project.id]);
  const refresh = () => {
    void lists.reload();
    void reloadProject();
  };

  if (!lists.data) return lists.error ? <ErrorAlert error={lists.error} /> : <PageLoader />;
  return (
    <Stack>
      <ErrorAlert error={lists.error} />
      {lists.data.length === 0 && (
        <Text c="dimmed">No to-do lists yet. Create one to start tracking work.</Text>
      )}
      {lists.data.map((list) => (
        <TodoListCard key={list.id} list={list} onChange={refresh} />
      ))}
      <NewListForm projectId={project.id} onCreated={refresh} />
    </Stack>
  );
}

function TodoListCard({ list, onChange }: { list: TodoListView; onChange: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [error, setError] = useState<unknown>();

  async function rename(e: FormEvent) {
    e.preventDefault();
    try {
      await api.patch(`/todolists/${list.id}`, { name });
      setRenaming(false);
      onChange();
    } catch (err) {
      setError(err);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the list "${list.name}" and all its to-dos?`)) return;
    try {
      await api.delete(`/todolists/${list.id}`);
      onChange();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Card padding="lg">
      <Group justify="space-between" mb="xs">
        {renaming ? (
          <form onSubmit={rename} style={{ flex: 1 }}>
            <Group>
              <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus style={{ flex: 1 }} />
              <Button type="submit" size="xs">Save</Button>
              <Button variant="subtle" size="xs" onClick={() => setRenaming(false)}>Cancel</Button>
            </Group>
          </form>
        ) : (
          <Group gap="sm">
            <Title order={4}>{list.name}</Title>
            <Text size="sm" c="dimmed">
              {list.completedCount}/{list.totalCount} done
            </Text>
          </Group>
        )}
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="List actions">⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setRenaming(true)}>Rename</Menu.Item>
            <Menu.Item color="red" onClick={remove}>Delete list</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {list.description && <Text size="sm" c="dimmed" mb="xs">{list.description}</Text>}
      {list.totalCount > 0 && <Progress value={(list.completedCount / list.totalCount) * 100} size="xs" mb="sm" />}
      <ErrorAlert error={error} />
      <Stack gap={6}>
        {list.todos.map((t) => (
          <TodoRow key={t.id} todo={t} onChange={onChange} />
        ))}
      </Stack>
      <NewTodoForm listId={list.id} onCreated={onChange} />
    </Card>
  );
}

function TodoRow({ todo, onChange }: { todo: TodoView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      if (todo.done) await api.delete(`/todos/${todo.id}/completion`);
      else await api.post(`/todos/${todo.id}/completion`);
      onChange();
    } finally {
      setBusy(false);
    }
  }
  const overdue = isOverdue(todo.dueDate, todo.done);
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Checkbox checked={todo.done} onChange={toggle} disabled={busy} aria-label={`Mark "${todo.title}" ${todo.done ? 'not done' : 'done'}`} />
      <Anchor
        component={Link}
        to={`/projects/${todo.projectId}/todos/${todo.id}`}
        c={todo.done ? 'dimmed' : undefined}
        td={todo.done ? 'line-through' : undefined}
        style={{ flex: 1 }}
      >
        {todo.title}
      </Anchor>
      {todo.commentCount > 0 && <Badge variant="light" color="gray" size="sm">💬 {todo.commentCount}</Badge>}
      {todo.dueDate && (
        <Badge variant="light" color={overdue ? 'red' : 'gray'} size="sm">
          {formatDueDate(todo.dueDate)}
        </Badge>
      )}
      {todo.assignee && <UserAvatar user={todo.assignee} size="sm" />}
    </Group>
  );
}

function NewTodoForm({ listId, onCreated }: { listId: string; onCreated: () => void }) {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/todolists/${listId}/todos`, { title, assigneeId, dueDate: dueDate || null });
      setTitle('');
      setError(undefined);
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="subtle" size="xs" mt="sm" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
        + Add a to-do
      </Button>
    );
  }
  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack gap="xs" mt="sm">
        <TextInput placeholder="Describe the to-do…" value={title} onChange={(e) => setTitle(e.currentTarget.value)} error={fields.title} autoFocus />
        <Group grow>
          <Select
            placeholder="Assign to…"
            clearable
            data={project.members.map((m) => ({ value: m.id, label: m.name }))}
            value={assigneeId}
            onChange={setAssigneeId}
            error={fields.assigneeId}
          />
          <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} error={fields.dueDate} aria-label="Due date" />
        </Group>
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group gap="xs">
          <Button type="submit" size="xs" loading={busy} disabled={!title.trim()}>Add to-do</Button>
          <Button variant="subtle" size="xs" onClick={() => setOpen(false)}>Done</Button>
        </Group>
      </Stack>
    </form>
  );
}

function NewListForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<unknown>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/todolists`, { name, description });
      setName('');
      setDescription('');
      setError(undefined);
      onCreated();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Card padding="lg" bg="gray.0">
      <form onSubmit={submit}>
        <Stack gap="xs">
          <Text fw={600}>New to-do list</Text>
          <TextInput placeholder="List name, e.g. “Launch checklist”" value={name} onChange={(e) => setName(e.currentTarget.value)} error={fieldErrors(error).name} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={1} />
          <Group>
            <Button type="submit" size="xs" disabled={!name.trim()}>Add list</Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
