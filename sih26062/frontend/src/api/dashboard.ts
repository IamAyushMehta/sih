import { api } from './client';

export async function getDashboardSummary(token: string) {
  const res = await api.get('/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
