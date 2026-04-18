import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default async function ServicePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const records = await prisma.serviceRecord.findMany({
    where: isAdmin
      ? {}
      : { equipment: { location: { users: { some: { id: session.user.id } } } } },
    include: {
      equipment: { include: { location: true } },
    },
    orderBy: { date: "desc" },
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
          <span className="font-semibold">Service History</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:block">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Service History</h1>

        {records.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
            No service records on file yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {records.map((rec) => (
                <div key={rec.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-gray-900">{rec.equipment.name}</span>
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                          {typeLabel[rec.equipment.type] ?? rec.equipment.type}
                        </span>
                        <span className="text-xs text-gray-400">{rec.equipment.location.name}</span>
                      </div>
                      <p className="text-sm text-gray-700">{rec.description}</p>
                      {rec.notes && (
                        <p className="text-xs text-gray-500 mt-1">{rec.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      {rec.technician && (
                        <div className="text-xs text-gray-400 mt-0.5">{rec.technician}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
