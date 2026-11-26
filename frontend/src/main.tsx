import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import { AuthBootstrap, OwnerLogin, PrivateWorkspace } from './app/AuthGate';
import { store } from './app/store';
import { EditProjectPage, NewProjectPage } from './features/projects/ProjectFormPage';
import { ProjectPage } from './features/projects/ProjectPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { EditSessionPage, NewSessionPage } from './features/sessions/SessionFormPage';
import { TimelinePage } from './features/sessions/SessionHistory';
import { SessionPage } from './features/sessions/SessionPage';
import { Empty, PageHeader } from './shared/ui';
import './styles.css';

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
              <Route index element={<Navigate to="/timeline" replace />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              <Route path="/projects/:projectId/edit" element={<EditProjectPage />} />
              <Route path="/sessions/new" element={<NewSessionPage />} />
              <Route path="/sessions/:sessionId" element={<SessionPage />} />
              <Route path="/sessions/:sessionId/edit" element={<EditSessionPage />} />
              <Route path="*" element={
                <>
                  <PageHeader title="Page not found" />
                  <Empty title="This workspace link is unavailable.">
                    <Link className="button secondary" to="/timeline">Daily Timeline</Link>
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
