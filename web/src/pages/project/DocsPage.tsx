import { Anchor, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client';
import type { DocSummary } from '../../api/types';
import { ErrorAlert, PageLoader } from '../../components/Feedback';
import { timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function DocsPage() {
  const { project } = useProject();
  const navigate = useNavigate();
  const docs = useAsync(() => api.get<DocSummary[]>(`/projects/${project.id}/docs`), [project.id]);

  async function create() {
    const doc = await api.post<{ id: string }>(`/projects/${project.id}/docs`, { title: 'Untitled document', body: '' });
    navigate(`/projects/${project.id}/docs/${doc.id}?edit=1`);
  }

  return (
    <Stack>
      <Group justify="flex-end">
        <Button onClick={create}>New doc</Button>
      </Group>
      <Text size="xs" c="dimmed">
        Text documents only for now — file uploads are coming in a later version.
      </Text>
      <ErrorAlert error={docs.error} />
      {!docs.data ? (
        <PageLoader />
      ) : docs.data.length === 0 ? (
        <Text c="dimmed">No docs yet. Write up a plan, a spec, or meeting notes.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {docs.data.map((d) => (
            <Card key={d.id} padding="lg">
              <Anchor component={Link} to={`/projects/${project.id}/docs/${d.id}`} fw={700} lineClamp={1}>
                {d.title}
              </Anchor>
              <Text size="sm" c="dimmed" lineClamp={3} mih={60} mt={4}>
                {d.excerpt || 'Empty document'}
              </Text>
              <Text size="xs" c="dimmed" mt="sm">
                Updated {timeAgo(d.updatedAt)} by {d.updatedBy?.name ?? 'a former member'}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
