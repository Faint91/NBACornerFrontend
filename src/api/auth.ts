import { loginPayload } from "../auth/identityPolicy";
// src/api/auth.ts
import { apiPost } from "./client";

export interface User {
  id: number;
  email: string;
  username: string | null;
  is_admin: boolean;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const body = loginPayload(identifier, password);

  return apiPost("/auth/login", body);
}
