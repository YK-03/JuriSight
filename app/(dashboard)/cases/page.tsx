import type { Route } from "next";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/user-sync";
import db from "@/lib/db";
import { CaseCard } from "@/components/app/CaseCard";

export default async function CasesPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in" as Route);
  }
  const userId = user.id;

  const cases = await db.case.findMany({
    where: { userId },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl">All Cases</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => (
          <CaseCard key={c.id} data={c} />
        ))}
      </div>
      {cases.length === 0 ? <p className="text-text-secondary">No cases yet. Create your first case.</p> : null}
    </div>
  );
}
