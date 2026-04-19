import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllSites } from "@/lib/relay";
import Link from "next/link";
import PortalHeader from "@/components/PortalHeader";
import PingTool from "@/components/PingTool";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    on: "bg-green-100 text-green-800",
    standby: "bg-blue-100 text-blue-800",
    off: "bg-gray-100 text-gray-600",
    unreachable: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default async function HealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const sites = await getAllSites();
  const siteList = sites.map((s) => ({ siteId: s.siteId, siteName: s.siteName, online: s.online }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader title="Equipment Health" email={session.user?.email} backHref="/portal" backLabel="Portal" />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {siteList.length > 0 && (
          <div className="mb-8">
            <PingTool sites={siteList} />
          </div>
        )}

        {sites.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            No site data available. Check that the central relay is running and a site relay is connected.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {sites.map((site) => (
              <div key={site.siteId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{site.siteName}</h2>
                      {site.online ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                          online
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">offline</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {site.lastHeartbeat
                        ? `Last heartbeat: ${new Date(site.lastHeartbeat).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`
                        : site.reportedAt
                        ? `Last report: ${new Date(site.reportedAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`
                        : "No data received yet"}
                    </p>
                  </div>
                  <Link href={`/portal/health/${site.siteId}`} className="text-sm text-yellow-600 hover:text-yellow-500 font-medium">
                    Details →
                  </Link>
                </div>

                {site.projectors && site.projectors.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {site.projectors.map((proj) => (
                      <div key={proj.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-gray-900">{proj.name}</span>
                            <StatusBadge status={proj.status} />
                            <StatusBadge status={proj.state} />
                          </div>
                          <p className="text-xs text-gray-500">{proj.model} · S/N {proj.serial}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{proj.laserPower}%</div>
                            <div className="text-xs text-gray-400">Laser</div>
                          </div>
                          <div className="text-center">
                            <div className={`font-semibold ${proj.lampHours > proj.lampHoursWarning ? "text-yellow-600" : "text-gray-900"}`}>
                              {proj.lampHours.toLocaleString()}h
                            </div>
                            <div className="text-xs text-gray-400">Lamp hrs</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">
                              {proj.health.temperatures[0]?.value ?? "—"}°C
                            </div>
                            <div className="text-xs text-gray-400">Temp</div>
                          </div>
                          {proj.health.errors.length > 0 && (
                            <div className="text-center">
                              <div className="font-semibold text-red-600">{proj.health.errors.length}</div>
                              <div className="text-xs text-gray-400">Errors</div>
                            </div>
                          )}
                          {proj.health.warnings.length > 0 && (
                            <div className="text-center">
                              <div className="font-semibold text-yellow-600">{proj.health.warnings.length}</div>
                              <div className="text-xs text-gray-400">Warnings</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-4 text-sm text-gray-400">
                    Relay connected — waiting for projector data.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
