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

// Mirror Vite's BASE_URL so internal navigation stays under the deployed subpath.
// Local dev: '/'.  GitHub Pages: '/provably-fair-rng/'.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const router = createBrowserRouter(
  [
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
  ],
  { basename },
);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
