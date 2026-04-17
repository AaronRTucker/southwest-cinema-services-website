import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Nav */}
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg tracking-tight">Southwest Cinema Services</span>
        <Link
          href="/login"
          className="text-sm bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-medium px-4 py-2 rounded transition-colors"
        >
          Customer Portal
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 bg-gray-900 text-white flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Cinema Equipment You Can Count On
        </h1>
        <p className="text-gray-300 max-w-xl text-lg mb-8">
          Installation and service of digital cinema projectors and sound systems.
          Keeping your auditoriums running at their best.
        </p>
        <Link
          href="/login"
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Access Your Portal
        </Link>
      </section>

      {/* Services */}
      <section className="bg-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                title: "Projector Service",
                desc: "Maintenance, repair, and calibration of digital cinema projectors including Christie, Barco, and NEC systems.",
              },
              {
                title: "Sound Systems",
                desc: "Installation and service of cinema audio systems including Dolby, DTS, and QSC equipment.",
              },
              {
                title: "Preventative Maintenance",
                desc: "Scheduled PM programs to keep your equipment performing reliably and extend its service life.",
              },
            ].map((s) => (
              <div key={s.title} className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-center text-sm py-6 px-6">
        © {new Date().getFullYear()} Southwest Cinema Services · Aaron Tucker
      </footer>
    </div>
  );
}
