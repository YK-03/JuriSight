import { auth } from "@clerk/nextjs/server";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const data = await getDashboardData();
  if (!data) {
    return (
      <div className="panel mx-auto max-w-2xl p-8">
        <h1 className="font-display text-2xl text-text-primary">Dashboard unavailable</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Your Clerk session is active, but JuriSight could not load your dashboard data. This usually
          means the application could not read or create your local user record in the database.
        </p>
      </div>
    );
  }

  return <DashboardOverview data={data} />;
}
