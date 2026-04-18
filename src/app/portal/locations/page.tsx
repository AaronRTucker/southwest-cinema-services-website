import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PortalHeader from "@/components/PortalHeader";

export default async function LocationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const where = isAdmin ? {} : { users: { some: { id: session.user.id } } };

  const locations = await prisma.location.findMany({
    where,
    include: {
      _count: { select: { auditoriums: true, serviceRecords: true, pmReports: true } },
      auditoriums: {
        take: 1,
        include: { equipment: { where: { type: "PROJECTOR" }, take: 1 } },
      },
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  // Group by city
  const byCity = locations.reduce<Record<string, typeof locations>>((acc, loc) => {
    const key = loc.city ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(loc);
    return acc;
  }, {});

  const regionOrder = ["San Antonio", "Austin", "Dallas", "Richardson", "Denton", "Irving", "Other"];
  const sortedCities = Object.keys(byCity).sort(
    (a, b) => regionOrder.indexOf(a) - regionOrder.indexOf(b)
  );

  // Group DFW cities under one region label
  const dfwCities = new Set(["Dallas", "Richardson", "Denton", "Irving"]);
  const regions: { label: string; locations: typeof locations }[] = [];
  let dfwAdded = false;

  for (const city of sortedCities) {
    if (dfwCities.has(city)) {
      if (!dfwAdded) {
        const dfwLocs = [...dfwCities].flatMap((c) => byCity[c] ?? []);
        dfwLocs.sort((a, b) => a.name.localeCompare(b.name));
        regions.push({ label: "Dallas / Fort Worth", locations: dfwLocs });
        dfwAdded = true;
      }
    } else {
      regions.push({ label: city, locations: byCity[city] });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader title="Locations" email={session.user?.email} backHref="/portal" backLabel="Portal" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {regions.map((region) => (
          <div key={region.label} className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{region.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {region.locations.map((loc) => {
                const projector = loc.auditoriums[0]?.equipment[0];
                const brand = projector?.manufacturer ?? null;
                const brandColor = brand === "Barco" ? "bg-blue-50 text-blue-700" : brand === "Sony" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-500";

                return (
                  <Link
                    key={loc.id}
                    href={`/portal/locations/${loc.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                          {loc.name.replace("Alamo Drafthouse ", "")}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">{loc.city}, {loc.state}</p>
                      </div>
                      {brand && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${brandColor}`}>
                          {brand}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{loc._count.auditoriums} screens</span>
                      {loc._count.serviceRecords > 0 && (
                        <span>{loc._count.serviceRecords} service records</span>
                      )}
                      {loc._count.pmReports > 0 && (
                        <span>{loc._count.pmReports} PM reports</span>
                      )}
                    </div>

                    {loc.siteId && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                        Live monitoring active
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
