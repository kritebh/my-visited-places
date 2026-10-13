import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <WifiOff className="size-8 text-muted" />
      <h1 className="text-lg font-semibold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-ink-2">Pages you&apos;ve opened before still work. Reconnect to load new data.</p>
    </main>
  );
}
