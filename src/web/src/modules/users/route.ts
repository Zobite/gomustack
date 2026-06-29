import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const UsersPage = lazy(() => import("./pages/UsersPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/users",
    element: UsersPage,
  },
];

export const nav: ModuleNav = {
  label: "Users",
  icon: "users",
  order: 1,
  group: "admin",
  requiredRole: ["admin"],
};
