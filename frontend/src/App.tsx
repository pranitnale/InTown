import { RouterProvider } from 'react-router';
import { router } from './routes-scaffold/router.tsx';

/**
 * App root. `<ThemeProvider>` wraps this in `main.tsx`; here we mount the P01
 * route skeleton (AC #5). Real screens arrive in later phases.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
