import { api } from './client';

export async function createVoyage(token: string, input: {
  voyageCode: string;
  vesselName: string;
  departurePort: string;
  destinationStationId: string;
  departureDate: string;
  expectedArrival?: string;
  capacityNotes?: string;
}) {
  const res = await api.post('/shipping/voyages', input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function addCargoToManifest(token: string, voyageId: string, input: { cargoId: string }) {
  const res = await api.post(`/shipping/voyages/${voyageId}/manifests/addCargo`, input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function generateStowagePlan(token: string, manifestId: string) {
  const res = await api.post(`/shipping/manifests/${manifestId}/stowage/generate`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function markManifestLoaded(token: string, manifestId: string) {
  const res = await api.post(`/shipping/manifests/${manifestId}/loaded`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function departVoyage(token: string, voyageId: string) {
  const res = await api.post(`/shipping/voyages/${voyageId}/depart`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function receiveAtStation(token: string, voyageId: string) {
  const res = await api.post(`/shipping/voyages/${voyageId}/receive`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
