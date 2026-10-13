import Link from "next/link";
import { MapPinned } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <MapPinned className="size-5 text-accent" /> My Places
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">{children}</div>
    </main>
  );
}
