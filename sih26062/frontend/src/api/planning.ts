import { api } from './client';

export async function getStations(token: string) {
  const res = await api.get('/planning/stations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getSeasons(token: string) {
  const res = await api.get('/planning/seasons', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

type CreateRequirementInput = {
  stationId: string;
  seasonId: string;
  plannedResupplyDate?: string;
  lines: Array<{
    itemId: string;
    requiredQty: number;
    existingStockQty?: number;
    expectedConsumptionQty?: number;
    safetyStockQty?: number;
    plannedResupplyQty?: number;
    unit: string;
  }>;
};

export async function createRequirement(token: string, input: CreateRequirementInput) {
  const res = await api.post('/planning/requirements', input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

type CreateIndentInput = {
  indentCode: string;
};

export async function createIndent(token: string, requirementId: string, input: CreateIndentInput) {
  const res = await api.post(`/planning/requirements/${requirementId}/indents`, input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function approveIndent(token: string, indentId: string) {
  const res = await api.post(`/planning/indents/${indentId}/approve`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
