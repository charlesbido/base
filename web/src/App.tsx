import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { PeoplePage } from './pages/PeoplePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CampfirePage } from './pages/project/CampfirePage';
import { DocPage } from './pages/project/DocPage';
import { DocsPage } from './pages/project/DocsPage';
import { MessagesPage } from './pages/project/MessagesPage';
import { PostPage } from './pages/project/PostPage';
import { ProjectHome } from './pages/project/ProjectHome';
import { ProjectLayout } from './pages/project/ProjectLayout';
import { ProjectPeoplePage } from './pages/project/ProjectPeoplePage';
import { SchedulePage } from './pages/project/SchedulePage';
import { TodoDetailPage } from './pages/project/TodoDetailPage';
import { TodosPage } from './pages/project/TodosPage';
import { Text } from '@mantine/core';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route index element={<ProjectsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectHome />} />
          <Route path="todos" element={<TodosPage />} />
          <Route path="todos/:todoId" element={<TodoDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:postId" element={<PostPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/:docId" element={<DocPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="campfire" element={<CampfirePage />} />
          <Route path="people" element={<ProjectPeoplePage />} />
        </Route>
        <Route path="*" element={<Text mt="xl">Page not found.</Text>} />
      </Route>
    </Routes>
  );
}
