import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './styles.css';
import { Layout } from './components/Layout.tsx';
import { NotFound } from './components/NotFound.tsx';
import { Home } from './pages/Home.tsx';
import { Verify } from './pages/Verify.tsx';
import { Simulate } from './pages/Simulate.tsx';
import { History } from './pages/History.tsx';
import { ApiDocs } from './pages/ApiDocs.tsx';
import { Compliance } from './pages/Compliance.tsx';
import { Architecture } from './pages/Architecture.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'verify', element: <Verify /> },
      { path: 'simulate', element: <Simulate /> },
      { path: 'history', element: <History /> },
      { path: 'api', element: <ApiDocs /> },
      { path: 'compliance', element: <Compliance /> },
      { path: 'architecture', element: <Architecture /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
