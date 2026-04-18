import Link from "next/link";
import Image from "next/image";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: "700" });
import logo from "../../public/images/logo-gemini.png";
import speakerWall from "../../public/images/speaker-wall.png";
import projectorInternals from "../../public/images/projector-internals.png";
import barcoProjector from "../../public/images/barco-projector.png";
import projectionBooth from "../../public/images/projection-booth.png";
import aaronHeadshot from "../../public/images/aaron-headshot-larger.png";
import richardHeadshot from "../../public/images/richard-headshot-larger.png";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="bg-yellow-500 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image src={logo} alt="Southwest Cinema Services" height={44} className="w-auto mix-blend-multiply" />
          <span className={`${cinzel.className} text-lg tracking-wide text-gray-900 hidden sm:block`}>Southwest Cinema Services, LLC</span>
        </div>
        <Link
          href="/login"
          className="text-sm bg-gray-900 hover:bg-gray-700 text-white font-medium px-4 py-2 rounded transition-colors"
        >
          Customer Portal
        </Link>
      </header>

      {/* Hero */}
      <section className="bg-gray-900 text-white px-6 py-24 text-center">
<h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Digital Cinema Service You Can Count On
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto text-lg mb-10 leading-relaxed">
          Installation, service, and proactive monitoring of Barco and Christie digital cinema projectors
          and sound systems across the Southwest.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Access Your Portal
          </Link>
          <a
            href="#services"
            className="border border-gray-600 hover:border-gray-400 text-white font-medium px-8 py-3 rounded-lg transition-colors"
          >
            Our Services
          </a>
        </div>
      </section>

      {/* Photo gallery */}
      <section className="bg-gray-950 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest text-center mb-8">25 Years of Experience in the Field</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { src: barcoProjector, alt: "Barco digital cinema projector service", label: "Training" },
              { src: projectorInternals, alt: "Projector internal electronics repair", label: "Troubleshooting" },
              { src: projectionBooth, alt: "35mm projection booth", label: "Film" },
              { src: speakerWall, alt: "Dolby Atmos cinema speaker wall installation", label: "Audio" },
            ].map((photo) => (
              <div key={photo.alt} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{photo.label}</p>
                <div className="relative rounded-xl overflow-hidden h-52 sm:h-64">
                  <Image src={photo.src} alt={photo.alt} fill className="object-cover" placeholder="blur" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Services</h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Comprehensive cinema equipment support from a technician who specializes in your systems.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Projector Installation",
                desc: "Full installation of digital cinema projectors including rack-out, alignment, lens setup, and system integration. Barco and Christie certified.",
              },
              {
                title: "Projector Service & Repair",
                desc: "Fault diagnosis and repair of digital cinema projectors. Laser module replacement, optical alignment, electronics repair, and firmware updates.",
              },
              {
                title: "Sound System Service",
                desc: "Installation and service of cinema audio systems including Dolby Atmos, DTS:X, and QSC. Speaker alignment, processor configuration, and calibration.",
              },
              {
                title: "Preventative Maintenance",
                desc: "Scheduled PM programs with documented inspection reports. Filter changes, thermal cleaning, optical checks, and firmware maintenance.",
              },
              {
                title: "Real-Time Monitoring",
                desc: "Remote SNMP and API monitoring of projector health — temperatures, lamp hours, voltages, and fan speeds — with alerts sent before failures occur.",
              },
              {
                title: "Emergency Response",
                desc: "Rapid response for equipment failures affecting show schedules. Remote diagnosis and on-site dispatch to minimize downtime.",
              },
            ].map((s) => (
              <div key={s.title} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Over 60 Years of Combined Experience</h2>
          <p className="text-gray-500 mb-14 max-w-xl mx-auto">
            Southwest Cinema Services is a family business built on decades of hands-on experience with cinema projection and audio systems across Texas and the Southwest.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-16">
            {[
              { src: aaronHeadshot, name: "Aaron Tucker", pos: "object-[30%_20%]", bio: "Barco and Christie certified technician specializing in digital cinema projectors, laser systems, and SNMP-based monitoring." },
              { src: richardHeadshot, name: "Richard Tucker", pos: "object-[45%_15%]", bio: "Decades of experience servicing 35mm and digital cinema equipment, with deep expertise in optical alignment and sound systems." },
            ].map((person) => (
              <div key={person.name} className="flex flex-col items-center gap-4">
                <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-md">
                  <Image src={person.src} alt={person.name} fill className={`object-cover ${person.pos}`} placeholder="blur" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{person.name}</div>
                  <p className="text-gray-500 text-sm max-w-xs mt-1">{person.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monitoring feature */}
      <section className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1">
            <p className="text-yellow-400 text-sm font-semibold uppercase tracking-widest mb-3">Proactive Monitoring</p>
            <h2 className="text-3xl font-bold mb-4">Know Before Your Audience Does</h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              Every projector at your sites reports temperature, voltage, fan speed, and lamp hours in real time.
              Issues are flagged before they cause failures — so problems get fixed during the day, not during a show.
            </p>
            <ul className="space-y-3 text-sm text-gray-300">
              {[
                "Live sensor data from all auditoriums in one dashboard",
                "Alerts on thermal, voltage, and lamp hour thresholds",
                "Full service and PM history tied to each piece of equipment",
                "Accessible from any browser through your customer portal",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-sm lg:max-w-none">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Auditorium 1</span>
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                Online
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-400">
              {[
                ["Front air inlet", "22°C", "ok"],
                ["LDM 1 main board heatsink", "45°C", "ok"],
                ["ICMP/ICP-D - PowerPC", "62°C", "ok"],
                ["SMPS +12V", "11.94 V", "ok"],
                ["Card cage inlet fan 1", "2,539 RPM", "ok"],
                ["LDM 1 fan 1", "2,461 RPM", "ok"],
              ].map(([label, value, status]) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${status === "ok" ? "bg-green-500" : "bg-yellow-400"}`} />
                    {label}
                  </div>
                  <span className="text-gray-300 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-white px-6 py-20 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Get In Touch</h2>
          <p className="text-gray-500 mb-8">
            Contact us to discuss service agreements, equipment installations, or to set up your customer portal account.
          </p>
          <a
            href="mailto:southwestcinemaservices@gmail.com"
            className="inline-block bg-gray-900 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            southwestcinemaservices@gmail.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-500 text-sm py-6 px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} Southwest Cinema Services · Aaron Tucker</span>
        <Link href="/login" className="text-gray-400 hover:text-white transition-colors">Customer Portal →</Link>
      </footer>
    </div>
  );
}
