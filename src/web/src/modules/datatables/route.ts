import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const ProjectsListPage = lazy(() => import("./pages/ProjectsListPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const TableDetailPage = lazy(() => import("./pages/TableDetailPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/datatables",
    element: ProjectsListPage,
  },
  {
    path: "/datatables/:id",
    element: ProjectDetailPage,
  },
  {
    path: "/datatables/:projectId/tables/:id",
    element: TableDetailPage,
  },
];

export const nav: ModuleNav = {
  label: "DataTables",
  icon: "database",
  order: 4,
};
