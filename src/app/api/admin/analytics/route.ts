import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/**
 * Admin analytics — platform-wide statistics for the admin dashboard.
 */
export async function GET() {
  return handle(async () => {
    const [
      totalUsers,
      totalBidders,
      totalOfficers,
      totalAdmins,
      totalTenders,
      activeTenders,
      totalBids,
      submittedBids,
      verifiedBids,
      totalOrgs,
      totalRequirements,
      totalComplianceResults,
      totalAuditLogs,
      totalNotifications,
      unreadNotifications,
      totalAiRuns,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "BIDDER" } }),
      prisma.user.count({ where: { role: { in: ["PROCUREMENT_OFFICER", "BID_EVALUATION_OFFICER", "COMPLIANCE_REVIEWER", "AUDITOR"] } } }),
      prisma.user.count({ where: { role: { in: ["SUPER_ADMIN", "SYSTEM_ADMIN"] } } }),
      prisma.tender.count(),
      prisma.tender.count({ where: { status: "ACTIVE" } }),
      prisma.bidSubmission.count(),
      prisma.bidSubmission.count({ where: { status: { in: ["SUBMITTED", "UNDER_VERIFICATION", "VERIFIED", "DECIDED"] } } }),
      prisma.bidSubmission.count({ where: { status: "VERIFIED" } }),
      prisma.organization.count(),
      prisma.tenderRequirement.count(),
      prisma.complianceResult.count(),
      prisma.auditLog.count(),
      prisma.notification.count(),
      prisma.notification.count({ where: { read: false } }),
      prisma.aiRun.count(),
    ]);

    // Recent logins (from audit logs)
    const recentLogins = await prisma.auditLog.findMany({
      where: { action: { in: ["LOGIN", "LOGIN_GOOGLE"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { actorEmail: true, action: true, createdAt: true, ip: true },
    });

    // Users with most logins
    const topUsers = await prisma.user.findMany({
      orderBy: { loginCount: "desc" },
      take: 5,
      select: { name: true, email: true, loginCount: true, role: true, lastLoginAt: true },
    });

    return ok({
      users: { total: totalUsers, bidders: totalBidders, officers: totalOfficers, admins: totalAdmins },
      tenders: { total: totalTenders, active: activeTenders },
      bids: { total: totalBids, submitted: submittedBids, verified: verifiedBids },
      organizations: totalOrgs,
      requirements: totalRequirements,
      complianceResults: totalComplianceResults,
      auditLogs: totalAuditLogs,
      notifications: { total: totalNotifications, unread: unreadNotifications },
      aiRuns: totalAiRuns,
      recentLogins,
      topUsers,
    });
  });
}
