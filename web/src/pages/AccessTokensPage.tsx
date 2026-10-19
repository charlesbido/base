import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { AccessTokenCreated, AccessTokenView } from '../api/types';
import { ErrorAlert, fieldErrors, PageLoader } from '../components/Feedback';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

/**
 * Long-lived personal access tokens: an alternative to the 30-day browser session, for MCP
 * clients and scripts that can't go through a login flow when a session expires. Create one here,
 * paste it into your MCP client's config (e.g. CAMP_TOKEN or an Authorization: Bearer header), and
 * it keeps working until you revoke it.
 */
export function AccessTokensPage() {
  const tokens = useAsync(() => api.get<AccessTokenView[]>('/access-tokens'), []);
  const [opened, { open, close }] = useDisclosure(false);
  const [justCreated, setJustCreated] = useState<AccessTokenCreated | null>(null);

  async function revoke(t: AccessTokenView) {
    if (!window.confirm(`Revoke "${t.name}"? Anything using this token will stop working immediately.`)) return;
    await api.delete(`/access-tokens/${t.id}`);
    void tokens.reload();
  }

  return (
    <Stack mt="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Access tokens</Title>
          <Text c="dimmed" size="sm">
            Long-lived tokens for MCP clients and scripts. Unlike signing in, they don't expire after 30 days.
          </Text>
        </div>
        <Button onClick={open}>New token</Button>
      </Group>
      <ErrorAlert error={tokens.error} />
      {!tokens.data ? (
        <PageLoader />
      ) : tokens.data.length === 0 ? (
        <Text c="dimmed">No access tokens yet.</Text>
      ) : (
        <Paper>
          {tokens.data.map((t, i) => (
            <Group key={t.id} p="sm" justify="space-between" style={i > 0 ? { borderTop: '1px solid var(--mantine-color-gray-2)' } : undefined}>
              <div>
                <Group gap="xs">
                  <Text fw={600}>{t.name}</Text>
                  {t.revoked && <Badge color="gray">Revoked</Badge>}
                </Group>
                <Text size="sm" c="dimmed">
                  Created {formatDate(t.createdAt)} · {t.expiresAt ? `Expires ${formatDate(t.expiresAt)}` : 'Never expires'}
                </Text>
              </div>
              {!t.revoked && (
                <Button variant="subtle" color="red" size="sm" onClick={() => revoke(t)}>
                  Revoke
                </Button>
              )}
            </Group>
          ))}
        </Paper>
      )}

      <Modal opened={opened} onClose={close} title="New access token">
        <CreateTokenForm
          onCreated={(created) => {
            close();
            setJustCreated(created);
            void tokens.reload();
          }}
        />
      </Modal>

      <Modal opened={justCreated !== null} onClose={() => setJustCreated(null)} title="Token created" closeOnClickOutside={false}>
        {justCreated && (
          <Stack>
            <Alert color="yellow" title="Copy it now">
              This is the only time the full token is shown. If you lose it, revoke it and create a new one.
            </Alert>
            <Group gap="xs" wrap="nowrap">
              <Code block style={{ flex: 1, overflowWrap: 'anywhere' }}>
                {justCreated.token}
              </Code>
              <CopyButton value={justCreated.token}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy'}>
                    <ActionIcon variant="light" onClick={copy} aria-label="Copy token">
                      {copied ? '✓' : '⧉'}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Text size="sm" c="dimmed">
              Use it as <Code>Authorization: Bearer {'<token>'}</Code>, or as <Code>CAMP_TOKEN</Code> for the stdio MCP server.
            </Text>
            <Group justify="flex-end">
              <Button onClick={() => setJustCreated(null)}>Done</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function CreateTokenForm({ onCreated }: { onCreated: (created: AccessTokenCreated) => void }) {
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState<string>('');
  const [error, setError] = useState<unknown>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await api.post<AccessTokenCreated>('/access-tokens', {
        name,
        expiresInDays: expiry ? Number(expiry) : null,
      });
      onCreated(created);
    } catch (err) {
      setError(err);
    }
  }

  const fields = fieldErrors(error);
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. laptop MCP client"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={fields.name}
          required
          autoFocus
        />
        <Select label="Expires" data={EXPIRY_OPTIONS} value={expiry} onChange={(v) => setExpiry(v ?? '')} allowDeselect={false} />
        {Object.keys(fields).length === 0 && <ErrorAlert error={error} />}
        <Group justify="flex-end">
          <Button type="submit">Create token</Button>
        </Group>
      </Stack>
    </form>
  );
}
