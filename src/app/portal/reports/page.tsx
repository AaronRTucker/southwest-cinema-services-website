import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PortalHeader from "@/components/PortalHeader";

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const reports = await prisma.pMReport.findMany({
    where: isAdmin
      ? {}
      : { location: { users: { some: { id: session.user.id } } } },
    include: {
      location: true,
      auditorium: true,
      items: { orderBy: [{ category: "asc" }, { task: "asc" }] },
    },
    orderBy: { date: "desc" },
  });

  const byLocation = reports.reduce<Record<string, typeof reports>>((acc, r) => {
    const key = r.location?.name ?? "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader title="PM Reports" email={session.user?.email} backHref="/portal" backLabel="Portal" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {reports.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            No PM reports on file yet.
          </div>
        ) : (
          Object.entries(byLocation).map(([locName, locReports]) => (
            <div key={locName} className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {locName.replace("Alamo Drafthouse ", "")}
              </h2>
              <div className="flex flex-col gap-4">
                {locReports.map((r) => {
                  const itemsByCategory = r.items.reduce<Record<string, typeof r.items>>((acc, item) => {
                    const cat = item.category ?? "General";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {});

                  const completedCount = r.items.filter((i) => i.completed).length;
                  const totalCount = r.items.length;

                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{r.summary}</div>
                          {r.auditorium && (
                            <div className="text-xs text-gray-400 mt-0.5">Auditorium {r.auditorium.number}</div>
                          )}
                          {r.technician && (
                            <div className="text-xs text-gray-400 mt-0.5">{r.technician}</div>
                          )}
                          {r.details && (
                            <div className="text-xs text-gray-500 mt-2 whitespace-pre-line">{r.details}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-gray-400">
                            {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          {totalCount > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              {completedCount}/{totalCount} items
                            </div>
                          )}
                        </div>
                      </div>

                      {Object.entries(itemsByCategory).length > 0 && (
                        <div className="border-t border-gray-50 px-5 py-3 space-y-3">
                          {Object.entries(itemsByCategory).map(([category, items]) => (
                            <div key={category}>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">{category}</div>
                              <div className="space-y-1">
                                {items.map((item) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${item.completed ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                                      {item.completed && (
                                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8">
                                          <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-xs ${item.completed ? "text-gray-600" : "text-gray-400"}`}>{item.task}</span>
                                      {item.notes && (
                                        <div className="text-xs text-gray-400 mt-0.5 italic">{item.notes}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
