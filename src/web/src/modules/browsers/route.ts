import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

export const routes: ModuleRoute[] = [
  {
    path: "/browsers",
    element: lazy(() => import("./page")),
    guard: "auth",
    layout: "app",
  },
];

export const nav: ModuleNav = {
  label: "Browsers",
  path: "/browsers",
  icon: "globe",
  order: 6,
};
