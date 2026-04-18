import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

interface Props {
  title: string;
  email?: string | null;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export default function PortalHeader({ title, email, backHref, backLabel, actions }: Props) {
  return (
    <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {backHref && (
          <>
            <Link href={backHref} className="text-gray-400 hover:text-white text-sm">
              ← {backLabel ?? "Back"}
            </Link>
            <span className="text-gray-600">/</span>
          </>
        )}
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        {email && <span className="text-sm text-gray-300 hidden sm:block">{email}</span>}
        <SignOutButton />
      </div>
    </header>
  );
}
