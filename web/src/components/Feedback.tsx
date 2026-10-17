import { Alert, Center, Loader } from '@mantine/core';
import { ApiError } from '../api/client';

export function PageLoader() {
  return (
    <Center py="xl">
      <Loader />
    </Center>
  );
}

export function ErrorAlert({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const heading = error instanceof ApiError && error.status === 403 ? 'Not allowed' : error instanceof ApiError && error.status === 404 ? 'Not found' : title;
  return (
    <Alert color="red" title={heading} my="sm">
      {message}
    </Alert>
  );
}

/** Per-field messages from a validation ApiError, for Mantine's `error` props. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {};
}
