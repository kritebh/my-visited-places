import Link from "next/link";
import { Globe2, MapPinned, Smartphone, Upload } from "lucide-react";

const FEATURES = [
  { icon: Upload, title: "Import Google Maps data", text: "Takeout, the phone Timeline export or Google Photos. It's parsed on your device, so your photos never upload." },
  { icon: MapPinned, title: "Every state, coloured", text: "An India map with official boundaries. States get darker the more you've been there." },
  { icon: Globe2, title: "The world, too", text: "Trips abroad light up countries and their states or provinces." },
  { icon: Smartphone, title: "Install it", text: "Add it to your home screen and it works like an app, even offline." },
];

export default function Home() {
  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          <MapPinned className="size-5 text-accent" /> My Places
        </span>
        <Link href="/login" className="text-sm font-medium text-ink-2 hover:text-ink">
          Log in
        </Link>
      </header>

      <section className="mt-14 sm:mt-24 max-w-2xl">
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-balance">
          Every place you&apos;ve been, on one map.
        </h1>
        <p className="mt-5 text-lg text-ink-2 text-pretty">
          Turn your Google Maps history into a map of your travels. See which Indian states you&apos;ve covered, which countries you&apos;ve visited, and when.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="inline-flex h-12 items-center rounded-xl bg-accent px-6 font-medium text-accent-ink hover:brightness-110">
            Get started
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center rounded-xl bg-surface-2 px-6 font-medium hover:bg-line">
            I have an account
          </Link>
        </div>
      </section>

      <section className="mt-16 sm:mt-24 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-line bg-surface p-5">
            <Icon className="size-5 text-accent" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-ink-2">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
