import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PortalHeader from "@/components/PortalHeader";

const typeColors: Record<string, string> = {
  PM: "bg-blue-50 text-blue-700",
  REPAIR: "bg-red-50 text-red-700",
  EMERGENCY: "bg-red-100 text-red-800",
  INSTALL: "bg-green-50 text-green-700",
  INSPECTION: "bg-yellow-50 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default async function ServicePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const locationWhere = isAdmin ? {} : { users: { some: { id: session.user.id } } };

  const records = await prisma.serviceRecord.findMany({
    where: { location: locationWhere },
    include: { location: true, equipment: true, auditorium: true },
    orderBy: { date: "desc" },
  });

  const byLocation = records.reduce<Record<string, typeof records>>((acc, r) => {
    const key = r.location?.name ?? "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader title="Service History" email={session.user?.email} backHref="/portal" backLabel="Portal" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {records.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            No service records on file yet.
          </div>
        ) : (
          Object.entries(byLocation).map(([locName, recs]) => (
            <div key={locName} className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {locName.replace("Alamo Drafthouse ", "")}
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {recs.map((rec) => (
                  <div key={rec.id} className="px-5 py-4 flex items-start gap-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${typeColors[rec.type] ?? typeColors.OTHER}`}>
                      {rec.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{rec.description}</div>
                      {rec.auditorium && (
                        <div className="text-xs text-gray-400 mt-0.5">Auditorium {rec.auditorium.number}</div>
                      )}
                      {rec.equipment && (
                        <div className="text-xs text-gray-400 mt-0.5">{rec.equipment.name}</div>
                      )}
                      {rec.notes && <div className="text-xs text-gray-500 mt-1">{rec.notes}</div>}
                      {rec.parts && <div className="text-xs text-gray-400 mt-0.5">Parts: {rec.parts}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-400">
                        {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      {rec.technician && <div className="text-xs text-gray-300 mt-0.5">{rec.technician}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
