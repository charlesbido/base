import { Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api/client';
import type { ProjectCard } from '../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../components/Feedback';
import { timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function ProjectsPage() {
  const projects = useAsync(() => api.get<ProjectCard[]>('/projects'), []);
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Stack>
      <Group justify="space-between" mt="md">
        <Title order={2}>Your projects</Title>
        <Button onClick={open}>New project</Button>
      </Group>
      <ErrorAlert error={projects.error} />
      {projects.data === undefined && projects.loading ? (
        <PageLoader />
      ) : projects.data?.length === 0 ? (
        <Card p="xl">
          <Stack align="center" gap="xs">
            <Text fw={600}>No projects yet</Text>
            <Text c="dimmed" size="sm">
              Projects hold your to-dos, messages, docs, schedule and chat.
            </Text>
            <Button mt="sm" onClick={open}>
              Start your first project
            </Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {projects.data?.map((p) => (
            <Card key={p.id} component={Link} to={`/projects/${p.id}`} padding="lg" style={{ textDecoration: 'none' }}>
              <Text fw={700} size="lg" lineClamp={1}>
                {p.name}
              </Text>
              <Text c="dimmed" size="sm" lineClamp={2} mih={40}>
                {p.description || 'No description'}
              </Text>
              <Group mt="md" justify="space-between">
                <Badge variant="light">{p.memberCount} {p.memberCount === 1 ? 'person' : 'people'}</Badge>
                <Text size="xs" c="dimmed">
                  updated {timeAgo(p.updatedAt)}
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
      <Modal opened={opened} onClose={close} title="New project">
        <NewProjectForm onDone={close} />
      </Modal>
    </Stack>
  );
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const project = await api.post<{ id: string }>('/projects', { name, description });
      onDone();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} error={fields.name} required autoFocus />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
        {!fields.name && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          <Button type="submit" loading={busy}>
            Create project
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
