import { Autocomplete, Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import type { UserSummary } from '../../api/types';
import { useMe } from '../../auth';
import { ErrorAlert, fieldErrors } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function ProjectPeoplePage() {
  const { project, reloadProject } = useProject();
  const me = useMe();
  const navigate = useNavigate();
  const everyone = useAsync(() => api.get<UserSummary[]>('/users'), []);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>();

  const memberIds = new Set(project.members.map((m) => m.id));
  const candidates = (everyone.data ?? []).filter((u) => !memberIds.has(u.id)).map((u) => u.email);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/projects/${project.id}/members`, { email });
      setEmail('');
      setError(undefined);
      await reloadProject();
    } catch (err) {
      setError(err);
    }
  }

  async function remove(user: UserSummary) {
    const leaving = user.id === me.id;
    if (!window.confirm(leaving ? `Leave "${project.name}"?` : `Remove ${user.name} from this project?`)) return;
    try {
      await api.delete(`/projects/${project.id}/members/${user.id}`);
      if (leaving) navigate('/');
      else await reloadProject();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Stack>
      <Card padding="lg">
        <form onSubmit={add}>
          <Group align="flex-end">
            <Autocomplete
              style={{ flex: 1 }}
              label="Add someone to this project"
              description="They need a Camp account first."
              placeholder="email@example.com"
              data={candidates}
              value={email}
              onChange={setEmail}
              error={fieldErrors(error).email}
            />
            <Button type="submit" disabled={!email.trim()}>
              Add
            </Button>
          </Group>
        </form>
        {!fieldErrors(error).email && <ErrorAlert error={error} />}
      </Card>
      <Card padding={0}>
        {project.members.map((m, i) => (
          <Group key={m.id} p="md" justify="space-between" style={i > 0 ? { borderTop: '1px solid var(--mantine-color-gray-2)' } : undefined}>
            <Group>
              <UserAvatar user={m} size="md" />
              <div>
                <Text fw={600}>
                  {m.name} {m.id === me.id && <Text span c="dimmed" size="sm">(you)</Text>}
                </Text>
                <Text size="sm" c="dimmed">{m.email}</Text>
              </div>
              {project.createdBy?.id === m.id && <Badge variant="light">Owner</Badge>}
            </Group>
            {project.createdBy?.id !== m.id && (
              <Button variant="subtle" color="red" size="xs" onClick={() => remove(m)}>
                {m.id === me.id ? 'Leave' : 'Remove'}
              </Button>
            )}
          </Group>
        ))}
      </Card>
    </Stack>
  );
}
