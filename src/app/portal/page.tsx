import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg tracking-tight">Southwest Cinema Services</span>
        <span className="text-sm text-gray-300">{session.user?.email}</span>
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
        </div>
      </main>
    </div>
  );
}
