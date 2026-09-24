import { api } from './client';

export async function recordConsumption(
  token: string,
  stationId: string,
  itemId: string,
  input: { date?: string; quantityConsumed: number; unit: string; source?: string; notes?: string }
) {
  const res = await api.post(
    `/inventory/stations/${stationId}/items/${itemId}/consumption`,
    input,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function getForecast(token: string, stationId: string, itemId: string, asOfDate?: string) {
  const res = await api.get(
    `/inventory/forecast/stations/${stationId}/items/${itemId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: asOfDate ? { asOfDate } : undefined,
    }
  );
  return res.data;
}

export async function getAlerts(token: string) {
  const res = await api.get('/inventory/dashboard/alerts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
