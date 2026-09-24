import { api, type AuthResponse } from './client';

export type RegisterInput = {
  username: string;
  password: string;
  role?: 'ADMIN' | 'PLANNER' | 'LOGISTICS' | 'MEDICAL' | 'EMERGENCY';
};

export async function register(input: RegisterInput) {
  const res = await api.post<AuthResponse>('/auth/register', input);
  return res.data;
}

export type LoginInput = {
  username: string;
  password: string;
};

export async function login(input: LoginInput) {
  const res = await api.post<AuthResponse>('/auth/login', input);
  return res.data;
}
