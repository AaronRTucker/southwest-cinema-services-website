import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSite } from "@/lib/relay";
import type { Projector, TemperatureSensor, VoltageSensor, FanSensor } from "@/lib/relay";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "bg-green-500",
    warning: "bg-yellow-400",
    error: "bg-red-500",
    critical: "bg-red-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-gray-300"}`} />;
}

function SensorRow({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className={`font-medium ${status === "ok" ? "text-gray-900" : status === "warning" ? "text-yellow-600" : "text-red-600"}`}>
        {value}
      </span>
    </div>
  );
}

function ProjectorCard({ proj }: { proj: Projector }) {
  const stateColors: Record<string, string> = {
    on: "border-l-green-500",
    standby: "border-l-blue-400",
    off: "border-l-gray-300",
    unreachable: "border-l-red-500",
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${stateColors[proj.state] ?? "border-l-gray-300"} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{proj.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{proj.model} · S/N {proj.serial} · FW {proj.firmware}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium capitalize text-gray-700">{proj.state}</div>
            <div className="text-xs text-gray-400">{new Date(proj.polledAt).toLocaleTimeString()}</div>
          </div>
        </div>

        {(proj.health.errors.length > 0 || proj.health.warnings.length > 0) && (
          <div className="mt-3 flex flex-col gap-1">
            {proj.health.errors.map((e) => (
              <div key={e.uid} className="text-xs bg-red-50 text-red-700 rounded px-3 py-1.5">
                ⛔ {e.description}
              </div>
            ))}
            {proj.health.warnings.map((w) => (
              <div key={w.uid} className="text-xs bg-yellow-50 text-yellow-700 rounded px-3 py-1.5">
                ⚠️ {w.description}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-gray-100">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Laser Power</div>
          <div className="text-xl font-bold text-gray-900">{proj.laserPower}%</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Lamp Hours</div>
          <div className={`text-xl font-bold ${proj.lampHours > proj.lampHoursWarning ? "text-yellow-600" : "text-gray-900"}`}>
            {proj.lampHours.toLocaleString()}
            <span className="text-sm font-normal text-gray-400"> / {proj.lampHoursEol.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Dowser</div>
          <div className={`text-xl font-bold ${proj.dowserOpen ? "text-green-600" : "text-gray-500"}`}>
            {proj.dowserOpen ? "Open" : "Closed"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">IP Address</div>
          <div className="text-sm font-mono text-gray-700 mt-1">{proj.ip}</div>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Temperatures</div>
          <div className="divide-y divide-gray-50">
            {proj.health.temperatures.map((t: TemperatureSensor) => (
              <SensorRow key={t.name} label={t.name} value={`${t.value}${t.unit}`} status={t.status} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Voltages</div>
          <div className="divide-y divide-gray-50">
            {proj.health.voltages.map((v: VoltageSensor) => (
              <SensorRow key={v.name} label={v.name} value={`${v.value}${v.unit}`} status={v.status} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fans</div>
          <div className="divide-y divide-gray-50">
            {proj.health.fans.map((f: FanSensor) => (
              <SensorRow key={f.name} label={f.name} value={`${f.value.toLocaleString()} ${f.unit}`} status={f.status} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function SiteHealthPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { siteId } = await params;
  const site = await getSite(siteId);

  if (!site) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Site not found or relay offline.</p>
          <Link href="/portal/health" className="text-yellow-600 hover:text-yellow-500">← Back to Health</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/health" className="text-gray-400 hover:text-white text-sm">← Health</Link>
          <span className="text-gray-600">/</span>
          <span className="font-semibold">{site.siteName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:block">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{site.siteName}</h1>
          <span className="text-xs text-gray-400">Updated {new Date(site.reportedAt).toLocaleString()}</span>
        </div>

        <div className="flex flex-col gap-6">
          {site.projectors.map((proj) => (
            <ProjectorCard key={proj.id} proj={proj} />
          ))}
        </div>
      </main>
    </div>
  );
}
