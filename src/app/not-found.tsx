import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">ApnaHaath</p>
      <h1 className="mt-4 text-4xl font-semibold md:text-5xl">This page is not in the log.</h1>
      <p className="mt-4 text-lg text-[var(--muted)]">The link may be old or mistyped. Your care circle is safe.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn-primary">
          Go to ApnaHaath
        </Link>
      </div>
      <p className="mt-12 text-sm font-semibold text-[var(--danger)]">
        Emergency: call 108 or go to the nearest hospital.
      </p>
    </main>
  );
}
