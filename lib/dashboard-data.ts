import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

export async function getDashboardData() {
  const user = await getOrCreateUser();
  if (!user) return null;

  const [totalCases, analyzedCases, recentCases, avgRiskScore] = await Promise.all([
    db.case.count({ where: { userId: user.id } }),
    db.case.count({ where: { userId: user.id, status: "ANALYZED" } }),
    db.case.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        section: true,
        status: true,
        createdAt: true,
        analysis: {
          select: {
            flightRisk: true,
            eligibilityStatus: true,
          },
        },
      },
    }),
    db.analysis.aggregate({
      where: { case: { userId: user.id } },
      _avg: { riskScore: true },
    }),
  ]);

  return {
    userName: user.name ?? "Counsel",
    stats: {
      totalCases,
      analyzedCases,
      pendingCases: totalCases - analyzedCases,
      avgRiskScore: avgRiskScore._avg.riskScore
        ? Math.round(avgRiskScore._avg.riskScore * 10) / 10
        : null,
    },
    recentCases,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
