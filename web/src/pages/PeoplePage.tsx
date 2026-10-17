import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { api } from '../api/client';
import type { UserSummary } from '../api/types';
import { ErrorAlert, PageLoader } from '../components/Feedback';
import { UserAvatar } from '../components/UserAvatar';
import { useAsync } from '../lib/useAsync';

/** Everyone with an account on this Camp. */
export function PeoplePage() {
  const people = useAsync(() => api.get<UserSummary[]>('/users'), []);
  return (
    <Stack mt="md">
      <Title order={2}>People</Title>
      <Text c="dimmed" size="sm">
        Everyone with a Camp account. Add people to a project from its People tab.
      </Text>
      <ErrorAlert error={people.error} />
      {!people.data ? (
        <PageLoader />
      ) : (
        <Paper>
          {people.data.map((u, i) => (
            <Group key={u.id} p="sm" style={i > 0 ? { borderTop: '1px solid var(--mantine-color-gray-2)' } : undefined}>
              <UserAvatar user={u} size="md" />
              <div>
                <Text fw={600}>{u.name}</Text>
                <Text size="sm" c="dimmed">
                  {u.email}
                </Text>
              </div>
            </Group>
          ))}
        </Paper>
      )}
    </Stack>
  );
}
