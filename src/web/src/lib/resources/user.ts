import type { HttpClient } from "../http";
import type { CreateUserInput, UpdateUserInput, User } from "../types";

export class UsersResource {
  constructor(private http: HttpClient) {}

  /** List all users (admin only) */
  async list(): Promise<User[]> {
    const res = await this.http.get<{ items: User[]; meta: { total: number } }>("/api/users");
    return res.items;
  }

  /** Get a single user by ID */
  async get(id: string): Promise<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  /** Create a new user (admin only) */
  async create(input: CreateUserInput): Promise<User> {
    return this.http.post<User>("/api/users", input);
  }

  /** Update a user */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    return this.http.patch<User>(`/api/users/${id}`, input);
  }

  /** Admin reset password for any user (no old password needed) */
  async resetPassword(id: string, password: string): Promise<void> {
    await this.http.post<{ success: boolean }>(`/api/users/${id}/reset-password`, { password });
  }

  /** Delete a user (admin only) */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/users/${id}`);
  }
}
