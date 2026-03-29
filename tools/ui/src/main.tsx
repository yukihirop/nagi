import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { DataProvider } from "./contexts/data-context.tsx";
import { DashboardLayout } from "./layouts/dashboard.tsx";
import { Overview } from "./views/overview.tsx";
import { Groups } from "./views/groups.tsx";
import { Channels } from "./views/channels.tsx";
import { Sessions } from "./views/sessions.tsx";
import { SessionDetail } from "./views/session-detail.tsx";
import { ThreadDetail } from "./views/thread-detail.tsx";
import { Tasks } from "./views/tasks.tsx";
import { Logs } from "./views/logs.tsx";
import { Settings } from "./views/settings.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DataProvider><DashboardLayout /></DataProvider>,
    children: [
      { index: true, element: <Overview /> },
      { path: "groups", element: <Groups /> },
      { path: "channels", element: <Channels /> },
      { path: "sessions", element: <Sessions /> },
      { path: "sessions/:id", element: <SessionDetail /> },
      { path: "sessions/:id/threads/:threadIndex", element: <ThreadDetail /> },
      { path: "tasks", element: <Tasks /> },
      { path: "logs", element: <Logs /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
