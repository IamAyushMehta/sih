import axios from 'axios';

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:4000',
});

export type AuthResponse = {
  token: string;
  user: { id: string; username: string; role: string };
};
