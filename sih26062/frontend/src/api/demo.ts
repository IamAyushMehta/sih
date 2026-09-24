import { api } from './client';

export async function demoRun(token: string, input: Record<string, any>) {
  const res = await api.post('/demo/run-critical-workflow', input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
