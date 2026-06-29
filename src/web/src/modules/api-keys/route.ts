import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/api-keys",
    element: ApiKeysPage,
  },
];

export const nav: ModuleNav = {
  label: "API Keys",
  icon: "key-round",
  order: 2,
  group: "admin",
};
