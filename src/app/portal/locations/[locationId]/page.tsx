import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PortalHeader from "@/components/PortalHeader";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { locationId } = await params;
  const isAdmin = session.user.role === "ADMIN";

  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      ...(isAdmin ? {} : { users: { some: { id: session.user.id } } }),
    },
    include: {
      auditoriums: {
        orderBy: { number: "asc" },
        include: {
          equipment: { orderBy: { type: "asc" } },
          attributes: true,
        },
      },
      serviceRecords: {
        orderBy: { date: "desc" },
        take: 5,
      },
      pmReports: {
        orderBy: { date: "desc" },
        take: 3,
        include: { items: true },
      },
    },
  });

  if (!location) notFound();

  const barcoCount = location.auditoriums.filter((a) =>
    a.equipment.some((e) => e.manufacturer === "Barco")
  ).length;
  const sonyCount = location.auditoriums.filter((a) =>
    a.equipment.some((e) => e.manufacturer === "Sony")
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        title={location.name.replace("Alamo Drafthouse ", "")}
        email={session.user?.email}
        backHref="/portal/locations"
        backLabel="Locations"
        actions={
          location.siteId ? (
            <Link
              href={`/portal/health/${location.siteId}`}
              className="text-xs bg-green-600 hover:bg-green-500 text-white font-medium px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-200 animate-pulse inline-block" />
              Live Health
            </Link>
          ) : undefined
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Location info bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 mb-8 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Address</div>
            <div className="text-sm font-medium text-gray-900">
              {location.address}, {location.city}, {location.state} {location.zip}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Screens</div>
            <div className="text-sm font-medium text-gray-900">{location.auditoriums.length}</div>
          </div>
          {barcoCount > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Barco</div>
              <div className="text-sm font-medium text-blue-700">{barcoCount} auditoriums</div>
            </div>
          )}
          {sonyCount > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Sony</div>
              <div className="text-sm font-medium text-purple-700">{sonyCount} auditoriums</div>
            </div>
          )}
        </div>

        {/* Auditoriums grid */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Auditoriums</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          {location.auditoriums.map((aud) => {
            const projector = aud.equipment.find((e) => e.type === "PROJECTOR");
            const isBarco = projector?.manufacturer === "Barco";
            const brandBorder = isBarco ? "border-l-blue-400" : projector?.manufacturer === "Sony" ? "border-l-purple-400" : "border-l-gray-200";

            return (
              <div
                key={aud.id}
                className={`bg-white rounded-xl border border-gray-200 border-l-4 ${brandBorder} p-4 flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Auditorium {aud.number}</span>
                  {aud.hasAtmos && (
                    <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-medium">Atmos</span>
                  )}
                </div>

                {projector ? (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="font-medium text-gray-800">{projector.manufacturer} {projector.model}</div>
                    {projector.serialNumber ? (
                      <div className="font-mono text-gray-500">S/N {projector.serialNumber}</div>
                    ) : (
                      <div className="text-gray-300 italic">S/N not on file</div>
                    )}
                    {projector.firmwareVersion && (
                      <div className="text-gray-400">FW {projector.firmwareVersion}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-300 italic">No projector on file</div>
                )}

                <div className="text-xs text-gray-400 space-y-0.5">
                  {aud.screenWidth && aud.screenHeight && (
                    <div>Screen: {aud.screenWidth}′ × {aud.screenHeight}′</div>
                  )}
                  {aud.seatingCapacity && <div>{aud.seatingCapacity} seats</div>}
                  {aud.isLaser && <div className="text-blue-500">Laser</div>}
                </div>

                {aud.attributes.length > 0 && (
                  <div className="border-t border-gray-50 pt-2 text-xs text-gray-400 space-y-0.5">
                    {aud.attributes.map((a) => (
                      <div key={a.id}><span className="text-gray-500">{a.key}:</span> {a.value}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent service records */}
        {location.serviceRecords.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Recent Service</h2>
              <Link href="/portal/service" className="text-xs text-yellow-600 hover:text-yellow-500">View all →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {location.serviceRecords.map((rec) => (
                <div key={rec.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-20 text-center shrink-0">
                    {rec.type}
                  </span>
                  <span className="text-sm text-gray-900">{rec.description}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">
                    {new Date(rec.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent PM reports */}
        {location.pmReports.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Recent PM Reports</h2>
              <Link href="/portal/reports" className="text-xs text-yellow-600 hover:text-yellow-500">View all →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {location.pmReports.map((pm) => (
                <div key={pm.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-900">{pm.summary}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">
                    {new Date(pm.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {location.serviceRecords.length === 0 && location.pmReports.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No service history on file yet for this location.
          </div>
        )}
      </main>
    </div>
  );
}
