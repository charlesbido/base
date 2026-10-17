import { ActionIcon, Badge, Button, Card, Group, Menu, Modal, SegmentedControl, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import type { EventView } from '../../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../../components/Feedback';
import { formatDay, formatTime, fromLocalInput, localDayKey, toLocalInput } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

type Scope = 'upcoming' | 'past';

export function SchedulePage() {
  const { project, reloadProject } = useProject();
  const [scope, setScope] = useState<Scope>('upcoming');
  // Stable "now" per scope switch, so the query key doesn't change every render.
  const now = useMemo(() => new Date().toISOString(), [scope]);
  const query = scope === 'upcoming' ? `from=${encodeURIComponent(now)}` : `to=${encodeURIComponent(now)}`;
  const events = useAsync(() => api.get<EventView[]>(`/projects/${project.id}/events?${query}`), [project.id, query]);
  const [editing, setEditing] = useState<EventView | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  const refresh = () => {
    void events.reload();
    void reloadProject();
  };

  const days = useMemo(() => {
    const list = scope === 'past' ? [...(events.data ?? [])].reverse() : (events.data ?? []);
    const groups = new Map<string, EventView[]>();
    for (const e of list) {
      const key = localDayKey(e.startsAt);
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()];
  }, [events.data, scope]);

  async function remove(e: EventView) {
    if (!window.confirm(`Delete "${e.title}"?`)) return;
    await api.delete(`/events/${e.id}`);
    refresh();
  }

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          data={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
        <Button
          onClick={() => {
            setEditing(null);
            open();
          }}
        >
          New event
        </Button>
      </Group>
      <ErrorAlert error={events.error} />
      {!events.data ? (
        <PageLoader />
      ) : days.length === 0 ? (
        <Text c="dimmed">{scope === 'upcoming' ? 'Nothing scheduled. Add a meeting, milestone or deadline.' : 'No past events.'}</Text>
      ) : (
        days.map(([day, list]) => (
          <Stack key={day} gap="xs">
            <Title order={5} c="dimmed">
              {formatDay(list[0]!.startsAt)}
            </Title>
            {list.map((e) => (
              <Card key={e.id} padding="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap">
                    <Badge variant="light" size="lg" radius="sm" miw={150}>
                      {formatTime(e.startsAt)} – {localDayKey(e.endsAt) === day ? formatTime(e.endsAt) : `${formatDay(e.endsAt).split(',')[0]} ${formatTime(e.endsAt)}`}
                    </Badge>
                    <div>
                      <Text fw={700}>{e.title}</Text>
                      {e.description && <Markdown source={e.description} />}
                    </div>
                  </Group>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Event actions">⋯</ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        onClick={() => {
                          setEditing(e);
                          open();
                        }}
                      >
                        Edit
                      </Menu.Item>
                      <Menu.Item color="red" onClick={() => remove(e)}>Delete</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Card>
            ))}
          </Stack>
        ))
      )}
      <Modal opened={opened} onClose={close} title={editing ? 'Edit event' : 'New event'}>
        <EventForm
          key={editing?.id ?? 'new'}
          event={editing}
          projectId={project.id}
          onDone={() => {
            close();
            refresh();
          }}
        />
      </Modal>
    </Stack>
  );
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

function EventForm({ event, projectId, onDone }: { event: EventView | null; projectId: string; onDone: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(event ? toLocalInput(event.startsAt) : defaultStart());
  const [endsAt, setEndsAt] = useState(
    event ? toLocalInput(event.endsAt) : toLocalInput(new Date(new Date(defaultStart()).getTime() + 3600_000).toISOString()),
  );
  const [error, setError] = useState<unknown>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const values = { title, description, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt) };
    try {
      if (event) await api.patch(`/events/${event.id}`, values);
      else await api.post(`/projects/${projectId}/events`, values);
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} error={fields.title} required autoFocus />
        <Group grow>
          <TextInput label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.currentTarget.value)} error={fields.startsAt} required />
          <TextInput label="Ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.currentTarget.value)} error={fields.endsAt} required />
        </Group>
        <Textarea label="Notes" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          <Button type="submit">{event ? 'Save changes' : 'Add event'}</Button>
        </Group>
      </Stack>
    </form>
  );
}
