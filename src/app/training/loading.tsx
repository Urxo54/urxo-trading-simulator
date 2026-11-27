import { LoaderCircle } from "lucide-react";

export default function TrainingLoading() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="flex min-h-screen flex-col">
        <header className="flex h-[68px] items-center border-b border-white/[0.08] px-6">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.08]" />
          <div className="ml-3 h-3 w-36 animate-pulse rounded bg-white/[0.08]" />
        </header>

        <div className="flex flex-1 flex-col p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3 w-48 animate-pulse rounded bg-white/[0.05]" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/[0.08]" />
          </div>

          <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_260px]">
            <div className="min-h-[420px] animate-pulse rounded-xl border border-white/[0.08] bg-[#0d0d0d]" />
            <div className="hidden space-y-3 lg:block">
              <div className="h-32 animate-pulse rounded-xl border border-white/[0.08] bg-[#0d0d0d]" />
              <div className="h-48 animate-pulse rounded-xl border border-white/[0.08] bg-[#0d0d0d]" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500">
            <LoaderCircle size={16} className="animate-spin" />
            Preparing trading terminal…
          </div>
        </div>
      </div>
    </main>
  );
}
