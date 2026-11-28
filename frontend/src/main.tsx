import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthBootstrap, OwnerLogin, PrivateWorkspace } from './app/AuthGate';
import { store } from './app/store';
import { EditProjectPage, NewProjectPage } from './features/projects/ProjectFormPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { EditSessionPage, NewSessionPage } from './features/sessions/SessionFormPage';
import { SessionsPage } from './features/sessions/SessionHistory';
import { SessionPage } from './features/sessions/SessionPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { TimelinePage } from './features/overview/TimelinePage';
import { SearchPage } from './features/tools/SearchPage';
import { SettingsPage } from './features/tools/SettingsPage';
import { initializeTheme } from './shared/preferences';
import { Empty, PageHeader } from './shared/ui';
import './styles.css';
import './experience.css';

initializeTheme();

const ChallengesPage = lazy(() => import('./features/growth/GrowthPages').then(module => ({ default: module.ChallengesPage })));
const LearningPage = lazy(() => import('./features/growth/GrowthPages').then(module => ({ default: module.LearningPage })));
const ReflectionPage = lazy(() => import('./features/growth/GrowthPages').then(module => ({ default: module.ReflectionPage })));
const RoadmapPage = lazy(() => import('./features/growth/GrowthPages').then(module => ({ default: module.RoadmapPage })));
const DocumentsPage = lazy(() => import('./features/tools/DocumentsPage').then(module => ({ default: module.DocumentsPage })));
const GitHubPage = lazy(() => import('./features/tools/GitHubPage').then(module => ({ default: module.GitHubPage })));
const ProjectPage = lazy(() => import('./features/projects/ProjectPage').then(module => ({ default: module.ProjectPage })));

function LegacyStudioRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/sessions/new', search }} replace />;
}

const root = document.getElementById('root');
if (!root) throw new Error('DevTrail root element is missing.');

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthBootstrap />}>
            <Route path="/login" element={<OwnerLogin />} />
            <Route element={<PrivateWorkspace />}>
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              <Route path="/projects/:projectId/edit" element={<EditProjectPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/new" element={<NewSessionPage />} />
              <Route path="/sessions/:sessionId" element={<SessionPage />} />
              <Route path="/sessions/:sessionId/edit" element={<EditSessionPage />} />
              <Route path="/studio" element={<LegacyStudioRedirect />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/learning" element={<LearningPage />} />
              <Route path="/challenges" element={<ChallengesPage />} />
              <Route path="/reflection" element={<ReflectionPage />} />
              <Route path="/analytics" element={<OverviewPage dedicated />} />
              <Route path="/insights" element={<DocumentsPage insights />} />
              <Route path="/reports" element={<DocumentsPage />} />
              <Route path="/github" element={<GitHubPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={
                <>
                  <PageHeader title="Page not found" />
                  <Empty title="This workspace link is unavailable.">
                    <Link className="button secondary" to="/overview">Overview</Link>
                  </Empty>
                </>
              } />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
