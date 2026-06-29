import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/",
    element: DashboardPage,
  },
];

export const nav: ModuleNav = {
  label: "Dashboard",
  icon: "dashboard",
  order: 1,
};
