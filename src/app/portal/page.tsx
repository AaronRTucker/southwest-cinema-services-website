import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default async function PortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg tracking-tight">Southwest Cinema Services</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:block">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Your Portal</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { title: "Locations", desc: "View your cinema locations and equipment.", href: "/portal/locations" },
            { title: "Service History", desc: "Browse past service and repair records.", href: "/portal/service" },
            { title: "PM Reports", desc: "Download preventative maintenance reports.", href: "/portal/reports" },
          ].map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <h2 className="font-semibold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.desc}</p>
            </a>
          ))}
          <a
            href="/portal/health"
            className="bg-gray-900 rounded-xl border border-gray-700 p-6 hover:bg-gray-800 transition-colors sm:col-span-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h2 className="font-semibold text-white">Equipment Health</h2>
                </div>
                <p className="text-sm text-gray-400">Real-time projector status, sensor readings, and active alerts across all sites.</p>
              </div>
              <span className="text-gray-400 text-sm font-medium whitespace-nowrap ml-6">View dashboard →</span>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
