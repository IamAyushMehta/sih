import { api } from './client';

export async function getCargo(token: string, cargoId: string) {
  const res = await api.get(`/shipping/cargo/${cargoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
