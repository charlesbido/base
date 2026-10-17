import { Anchor, Breadcrumbs, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { api } from '../../api/client';
import type { ProjectDetail } from '../../api/types';
import { ErrorAlert, PageLoader } from '../../components/Feedback';
import { UserAvatar } from '../../components/UserAvatar';
import { useAsync } from '../../lib/useAsync';

export interface ProjectContext {
  project: ProjectDetail;
  reloadProject: () => Promise<void>;
}

/** For pages nested under a project route. */
export const useProject = () => useOutletContext<ProjectContext>();

export const PROJECT_TABS = [
  { value: '', label: 'Home' },
  { value: 'todos', label: 'To-dos' },
  { value: 'messages', label: 'Message Board' },
  { value: 'docs', label: 'Docs' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'campfire', label: 'Campfire' },
  { value: 'people', label: 'People' },
] as const;

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const project = useAsync(() => api.get<ProjectDetail>(`/projects/${projectId}`), [projectId]);

  if (project.error && !project.data) return <ErrorAlert error={project.error} />;
  if (!project.data) return <PageLoader />;

  const base = `/projects/${projectId}`;
  const section = location.pathname.slice(base.length).split('/')[1] ?? '';
  const p = project.data;

  return (
    <Stack gap="md" mt="sm">
      <Breadcrumbs>
        <Anchor component={Link} to="/" size="sm">
          Projects
        </Anchor>
        <Text size="sm">{p.name}</Text>
      </Breadcrumbs>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{p.name}</Title>
          {p.description && (
            <Text c="dimmed" size="sm">
              {p.description}
            </Text>
          )}
        </div>
        <Group gap={4}>
          {p.members.slice(0, 8).map((m) => (
            <UserAvatar key={m.id} user={m} />
          ))}
        </Group>
      </Group>
      <Tabs value={section} onChange={(v) => navigate(v ? `${base}/${v}` : base)}>
        <Tabs.List>
          {PROJECT_TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <Outlet context={{ project: p, reloadProject: project.reload } satisfies ProjectContext} />
    </Stack>
  );
}
