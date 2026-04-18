export interface TemperatureSensor {
  name: string;
  value: number;
  warning: number;
  critical: number;
  unit: string;
  status: "ok" | "warning" | "critical";
}

export interface VoltageSensor {
  name: string;
  value: number;
  nominal: number;
  tolerance: number;
  unit: string;
  status: "ok" | "warning";
}

export interface FanSensor {
  name: string;
  value: number;
  warning: number;
  unit: string;
  status: "ok" | "warning";
}

export interface ProjectorAlert {
  type: "E" | "W" | "N";
  uid: string;
  description: string;
}

export interface ProjectorHealth {
  temperatures: TemperatureSensor[];
  voltages: VoltageSensor[];
  fans: FanSensor[];
  errors: ProjectorAlert[];
  warnings: ProjectorAlert[];
}

export interface Projector {
  id: string;
  name: string;
  ip: string;
  model: string;
  serial: string;
  firmware: string;
  state: string;
  laserPower: number;
  lampHours: number;
  lampHoursWarning: number;
  lampHoursEol: number;
  dowserOpen: boolean;
  health: ProjectorHealth;
  status: "ok" | "warning" | "error";
  polledAt: string;
  error?: string;
}

export interface SiteStatus {
  siteId: string;
  siteName: string;
  projectors?: Projector[];
  reportedAt?: string;
  receivedAt?: string;
  online: boolean;
  lastHeartbeat?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  version?: string;
}

export interface RelayStatus {
  sites: SiteStatus[];
  asOf: string;
}

const CENTRAL_RELAY_URL = process.env.CENTRAL_RELAY_URL ?? "http://localhost:4000";
const RELAY_API_KEY = process.env.RELAY_API_KEY ?? "";

function relayHeaders() {
  return RELAY_API_KEY ? { "x-api-key": RELAY_API_KEY } : undefined;
}

export async function getAllSites(): Promise<SiteStatus[]> {
  try {
    const res = await fetch(`${CENTRAL_RELAY_URL}/api/status`, {
      cache: "no-store",
      headers: relayHeaders(),
    });
    if (!res.ok) return [];
    const data: RelayStatus = await res.json();
    return data.sites ?? [];
  } catch {
    return [];
  }
}

export async function getSite(siteId: string): Promise<SiteStatus | null> {
  try {
    const res = await fetch(`${CENTRAL_RELAY_URL}/api/status/${siteId}`, {
      cache: "no-store",
      headers: relayHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
