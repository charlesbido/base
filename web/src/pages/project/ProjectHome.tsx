import { Button, Card, Group, Modal, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useMe } from '../../auth';
import { ErrorAlert, fieldErrors } from '../../components/Feedback';
import { useProject } from './ProjectLayout';

/** Basecamp-style project home: one card per tool with a quick summary. */
export function ProjectHome() {
  const { project } = useProject();
  const { stats } = project;
  const base = `/projects/${project.id}`;
  const cards = [
    { to: 'todos', title: 'To-dos', summary: `${stats.openTodos} open · ${stats.completedTodos} done` },
    { to: 'messages', title: 'Message Board', summary: `${stats.posts} ${stats.posts === 1 ? 'post' : 'posts'}` },
    { to: 'docs', title: 'Docs', summary: `${stats.docs} ${stats.docs === 1 ? 'doc' : 'docs'}` },
    { to: 'schedule', title: 'Schedule', summary: `${stats.upcomingEvents} upcoming` },
    { to: 'campfire', title: 'Campfire', summary: 'Chat with the team' },
    { to: 'people', title: 'People', summary: `${project.members.length} ${project.members.length === 1 ? 'member' : 'members'}` },
  ];
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {cards.map((c) => (
          <Card key={c.to} component={Link} to={`${base}/${c.to}`} padding="lg" style={{ textDecoration: 'none' }}>
            <Text fw={700} size="lg">
              {c.title}
            </Text>
            <Text c="dimmed" size="sm">
              {c.summary}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      <ProjectSettings />
    </Stack>
  );
}

function ProjectSettings() {
  const { project, reloadProject } = useProject();
  const me = useMe();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [error, setError] = useState<unknown>();

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.patch(`/projects/${project.id}`, { name, description });
      await reloadProject();
      close();
    } catch (err) {
      setError(err);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${project.name}" and everything in it? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project.id}`);
      navigate('/');
    } catch (err) {
      setError(err);
    }
  }

  const fields = fieldErrors(error);
  return (
    <Group justify="flex-end">
      <Button variant="default" size="xs" onClick={open}>
        Edit project
      </Button>
      {project.createdBy?.id === me.id && (
        <Button variant="subtle" color="red" size="xs" onClick={remove}>
          Delete project
        </Button>
      )}
      <ErrorAlert error={!opened ? error : undefined} />
      <Modal opened={opened} onClose={close} title="Edit project">
        <form onSubmit={save}>
          <Stack>
            <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} error={fields.name} required />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
            <Group justify="flex-end">
              <Button type="submit">Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Group>
  );
}
