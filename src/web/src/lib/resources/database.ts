import type { HttpClient } from "../http";
import type { CreateProjectInput, ProjectItem, UpdateProjectInput } from "../types";

export class ProjectsResource {
  constructor(private http: HttpClient) {}

  /** List all projects */
  async list(): Promise<ProjectItem[]> {
    const res = await this.http.get<{ items: ProjectItem[]; meta: { total: number } }>("/api/datatables");
    return res.items;
  }

  /** Get project by ID */
  async get(id: string): Promise<ProjectItem> {
    return this.http.get<ProjectItem>(`/api/datatables/${id}`);
  }

  /** Create a new project */
  async create(input: CreateProjectInput): Promise<ProjectItem> {
    return this.http.post<ProjectItem>("/api/datatables", input);
  }

  /** Update project metadata */
  async update(id: string, input: UpdateProjectInput): Promise<ProjectItem> {
    return this.http.patch<ProjectItem>(`/api/datatables/${id}`, input);
  }

  /** Delete project (cascades tables + rows) */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/datatables/${id}`);
  }
}
