import { Anchor, Button, Card, Divider, Group, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../../api/client';
import type { DocDetail } from '../../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../../components/Feedback';
import { formatDateTime } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { useAsync } from '../../lib/useAsync';
import { useProject } from './ProjectLayout';

export function DocPage() {
  const { docId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const { project } = useProject();
  const navigate = useNavigate();
  const doc = useAsync(() => api.get<DocDetail>(`/docs/${docId}`), [docId]);
  const [error, setError] = useState<unknown>();
  const editing = search.get('edit') === '1';
  const setEditing = (on: boolean) => setSearch(on ? { edit: '1' } : {}, { replace: true });

  if (!doc.data) return doc.error ? <ErrorAlert error={doc.error} /> : <PageLoader />;
  const d = doc.data;
  const back = `/projects/${project.id}/docs`;

  async function remove() {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try {
      await api.delete(`/docs/${d.id}`);
      navigate(back);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Stack>
      <Anchor component={Link} to={back} size="sm">
        ← Docs
      </Anchor>
      <Card padding="xl">
        {editing ? (
          <DocEditor
            key={d.updatedAt}
            doc={d}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await doc.reload();
            }}
          />
        ) : (
          <>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Title order={2}>{d.title}</Title>
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" size="xs" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="subtle" color="red" size="xs" onClick={remove}>Delete</Button>
              </Group>
            </Group>
            <Text size="xs" c="dimmed" my="sm">
              Created by {d.author?.name ?? 'a former member'} · last edited by {d.updatedBy?.name ?? 'a former member'},{' '}
              {formatDateTime(d.updatedAt)}
            </Text>
            <Divider mb="md" />
            {d.body ? <Markdown source={d.body} /> : <Text c="dimmed">This doc is empty. Click Edit to start writing.</Text>}
          </>
        )}
        <ErrorAlert error={error} />
      </Card>
    </Stack>
  );
}

function DocEditor({ doc, onSaved, onCancel }: { doc: DocDetail; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/docs/${doc.id}`, { title, body });
      await onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} error={fields.title} required size="md" />
        <Textarea
          label="Body"
          description="Supports # headings, **bold**, *italic*, `code`, - lists, > quotes and [links](https://…)"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          autosize
          minRows={14}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={busy}>Save</Button>
        </Group>
      </Stack>
    </form>
  );
}
