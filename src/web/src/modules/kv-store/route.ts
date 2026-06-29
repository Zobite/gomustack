import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const KvStorePage = lazy(() => import("./page"));

export const routes: ModuleRoute[] = [
  {
    path: "/kv-store",
    element: KvStorePage,
  },
];

export const nav: ModuleNav = {
  label: "KV Store",
  icon: "key",
  order: 3,
};
