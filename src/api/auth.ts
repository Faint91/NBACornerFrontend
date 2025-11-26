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
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");

  const body: Record<string, string> = {
    password,
  };

  // Backend expects { "email" OR "username", "password" }
  if (isEmail) {
    body.email = trimmed;
  } else {
    body.username = trimmed;
  }

  return apiPost("/auth/login", body);
}
