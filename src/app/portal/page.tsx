import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PortalHeader from "@/components/PortalHeader";

export default async function PortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const where = isAdmin ? {} : { users: { some: { id: session.user.id } } };

  const [locationCount, auditoriumCount, equipmentCount] = await Promise.all([
    prisma.location.count({ where }),
    prisma.auditorium.count({ where: { location: where } }),
    prisma.equipment.count({ where: { location: where } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader title="Southwest Cinema Services" email={session.user?.email} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal</h1>
        <p className="text-gray-500 text-sm mb-8">Welcome back, {session.user?.name ?? session.user?.email}</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Locations", value: locationCount },
            { label: "Auditoriums", value: auditoriumCount },
            { label: "Equipment Items", value: equipmentCount },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-6 py-5">
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: "Locations", desc: "Browse all cinema sites, auditoriums, and equipment.", href: "/portal/locations", icon: "📍" },
            { title: "Service History", desc: "Past service records, repairs, and work orders.", href: "/portal/service", icon: "🔧" },
            { title: "PM Reports", desc: "Preventative maintenance reports by location.", href: "/portal/reports", icon: "📋" },
          ].map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow flex items-start gap-4"
            >
              <span className="text-2xl">{card.icon}</span>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">{card.title}</h2>
                <p className="text-sm text-gray-500">{card.desc}</p>
              </div>
            </Link>
          ))}

          <Link
            href="/portal/health"
            className="bg-gray-900 rounded-xl border border-gray-700 p-6 hover:bg-gray-800 transition-colors flex items-start gap-4"
          >
            <span className="mt-0.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            </span>
            <div>
              <h2 className="font-semibold text-white mb-1">Equipment Health</h2>
              <p className="text-sm text-gray-400">Real-time projector status, sensor readings, and active alerts across all sites.</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
