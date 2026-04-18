import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const reports = await prisma.pMReport.findMany({
    where: isAdmin
      ? {}
      : { location: { users: { some: { id: session.user.id } } } },
    include: { location: true },
    orderBy: { date: "desc" },
  });

  const byLocation = reports.reduce<Record<string, { locationName: string; reports: typeof reports }>>((acc, r) => {
    if (!acc[r.locationId]) acc[r.locationId] = { locationName: r.location.name, reports: [] };
    acc[r.locationId].reports.push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="text-gray-400 hover:text-white text-sm">← Portal</Link>
          <span className="text-gray-600">/</span>
          <span className="font-semibold">PM Reports</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:block">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Preventative Maintenance Reports</h1>

        {reports.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
            No PM reports on file yet.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.values(byLocation).map(({ locationName, reports: locReports }) => (
              <div key={locationName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">{locationName}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{locReports.length} report{locReports.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {locReports.map((r) => (
                    <div key={r.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{r.summary}</p>
                          {r.details && (
                            <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{r.details}</p>
                          )}
                        </div>
                        <div className="text-sm font-medium text-gray-900 shrink-0">
                          {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
