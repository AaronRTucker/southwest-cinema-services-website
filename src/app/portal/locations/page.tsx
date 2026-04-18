import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default async function LocationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const locations = await prisma.location.findMany({
    where: isAdmin ? {} : { users: { some: { id: session.user.id } } },
    include: {
      equipment: { orderBy: { type: "asc" } },
      _count: { select: { pmReports: true } },
    },
    orderBy: { name: "asc" },
  });

  const typeLabel: Record<string, string> = {
    PROJECTOR: "Projector",
    SOUND: "Sound",
    SERVER: "Server",
    NETWORK: "Network",
    OTHER: "Other",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="text-gray-400 hover:text-white text-sm">← Portal</Link>
          <span className="text-gray-600">/</span>
          <span className="font-semibold">Locations</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:block">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Locations</h1>

        {locations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
            No locations on file yet. Contact Southwest Cinema Services to get set up.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {locations.map((loc) => (
              <div key={loc.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{loc.name}</h2>
                    {loc.address && <p className="text-xs text-gray-400 mt-0.5">{loc.address}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{loc.equipment.length} equipment items</span>
                    <span>{loc._count.pmReports} PM reports</span>
                    {loc.siteId && (
                      <Link
                        href={`/portal/health/${loc.siteId}`}
                        className="text-yellow-600 hover:text-yellow-500 font-medium"
                      >
                        Live health →
                      </Link>
                    )}
                  </div>
                </div>

                {loc.equipment.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {loc.equipment.map((eq) => (
                      <div key={eq.id} className="px-6 py-3 flex items-center gap-4">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded px-2 py-0.5 w-20 text-center shrink-0">
                          {typeLabel[eq.type] ?? eq.type}
                        </span>
                        <span className="font-medium text-gray-900 text-sm">{eq.name}</span>
                        {eq.manufacturer && (
                          <span className="text-xs text-gray-500">{eq.manufacturer}</span>
                        )}
                        {eq.model && (
                          <span className="text-xs text-gray-400">{eq.model}</span>
                        )}
                        {eq.serialNumber && (
                          <span className="text-xs text-gray-400 font-mono ml-auto">S/N {eq.serialNumber}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-4 text-sm text-gray-400">No equipment records on file.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
