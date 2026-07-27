import BulkSearch from "@/components/BulkSearch";
import Landing from "@/components/Landing";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Logo />
            <span>
              bulk<span className="text-accent">domain</span>search
            </span>
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-ink-3 sm:block">
              Zone-file index · parallel DNS · RDAP
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-16">
        <section className="mx-auto w-full max-w-4xl px-4 pb-8 pt-14 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Check thousands of domains.{" "}
            <span className="text-accent">Instantly.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-ink-2 sm:text-base">
            Paste up to 5,000 names or domains — availability streams in live as
            each check completes. Free, no signup.
          </p>
        </section>
        <BulkSearch />
        <Landing />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-4xl space-y-2 px-4 py-8 text-xs text-ink-3">
          <p>
            Availability is answered from a local zone-file index when we hold
            the TLD&apos;s zone, and from live DNS otherwise; any result can be
            confirmed against the registry via RDAP. Always confirm final
            availability and pricing at checkout.
          </p>
          <p>
            Registrar links may be affiliate links — they cost you nothing and
            help keep this tool free.
          </p>
        </div>
      </footer>
    </div>
  );
}
