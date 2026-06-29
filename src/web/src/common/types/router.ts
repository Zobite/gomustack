import type { ComponentType, LazyExoticComponent } from "react";

export interface ModuleRoute {
  path: string;
  element: LazyExoticComponent<ComponentType> | ComponentType;
  guard?: "auth" | "guest"; // default: "auth"
  layout?: "app" | "none"; // default: "app"
  children?: ModuleRoute[];
}

export interface ModuleNav {
  label: string;
  icon: string;
  order: number;
  group?: "main" | "admin"; // default: "main" — sidebar group
  path?: string; // override — default uses first route
  requiredRole?: readonly string[];
}
