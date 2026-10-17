import { Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { ErrorAlert, fieldErrors } from '../components/Feedback';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrors(error);
  return (
    <Center mih="100vh" bg="gray.0" p="md">
      <Paper p="xl" w={380} shadow="sm">
        <form onSubmit={submit}>
          <Stack>
            <div>
              <Title order={2}>⛺ Camp</Title>
              <Text c="dimmed" size="sm">
                {mode === 'login' ? 'Sign in to your projects' : 'Create your account'}
              </Text>
            </div>
            {mode === 'register' && (
              <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} error={fields.name} required autoFocus />
            )}
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              error={fields.email}
              required
              autoFocus={mode === 'login'}
            />
            <PasswordInput
              label="Password"
              description={mode === 'register' ? 'At least 8 characters' : undefined}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              error={fields.password}
              required
            />
            {Object.keys(fields).length === 0 && <ErrorAlert error={error} title="Could not sign in" />}
            <Button type="submit" loading={busy} fullWidth>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <Text size="sm" ta="center">
              {mode === 'login' ? (
                <>
                  New here? <Anchor component={Link} to="/register" state={location.state}>Create an account</Anchor>
                </>
              ) : (
                <>
                  Have an account? <Anchor component={Link} to="/login" state={location.state}>Sign in</Anchor>
                </>
              )}
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
