import { Anchor, AppShell, Avatar, Container, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { PageLoader } from './Feedback';

/** Signed-in chrome: top bar with navigation and the user menu. */
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user === undefined) return <PageLoader />;
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="lg">
              <Anchor component={Link} to="/" underline="never" fw={800} size="lg" c="campfire.8">
                ⛺ Camp
              </Anchor>
              <Anchor component={Link} to="/" c="dimmed" size="sm">
                Projects
              </Anchor>
              <Anchor component={Link} to="/people" c="dimmed" size="sm">
                People
              </Anchor>
            </Group>
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <UnstyledButton aria-label="Account menu">
                  <Group gap="xs">
                    <Avatar name={user.name} color="initials" size="sm" radius="xl" />
                    <Text size="sm" visibleFrom="xs">
                      {user.name}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item component={Link} to="/settings/tokens">
                  Access tokens
                </Menu.Item>
                <Menu.Item
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg" pb="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
