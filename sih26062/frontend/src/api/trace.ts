import { api } from './client';

export async function getCargo(token: string, cargoId: string) {
  const res = await api.get(`/shipping/cargo/${cargoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getCargoTimeline(token: string, cargoId: string) {
  const res = await api.get(`/shipping/cargo/${cargoId}/timeline`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
