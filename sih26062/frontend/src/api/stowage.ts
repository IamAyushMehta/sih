import { api } from './client';

export async function getManifestStowage(token: string, manifestId: string) {
  const res = await api.get(`/shipping/manifests/${manifestId}/stowage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
