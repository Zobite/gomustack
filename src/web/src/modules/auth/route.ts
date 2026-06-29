import { lazy } from "react";
import type { ModuleRoute } from "src/common/types/router";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const SetupPage = lazy(() => import("./pages/SetupPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/login",
    element: LoginPage,
    guard: "guest",
    layout: "none",
  },
  {
    path: "/setup",
    element: SetupPage,
    guard: "guest",
    layout: "none",
  },
];
