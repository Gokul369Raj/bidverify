import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

/**
 * Cross-bid shared-evidence detector.
 *
 * Groups identical documents (exact SHA-256) submitted by DIFFERENT
 * organizations for the same tender. This is a REVIEW SIGNAL ONLY:
 * legitimate cases exist (authorized distributor reselling the same OEM
 * letter). Never treated as proof of collusion.
 */
export async function GET() {
  return handle(async () => {
    await requireOfficer();

    const docs = await prisma.bidDocument.findMany({
      select: {
        id: true, sha256: true, fileName: true, docType: true,
        submissionId: true,
        submission: {
          select: {
            bidNumber: true, tenderId: true,
            tender: { select: { tenderNumber: true, title: true } },
            organization: { select: { legalName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // group key: hash + tender ⇒ same certificate inside one tender competition
    const groups = new Map<string, typeof docs>();
    for (const d of docs) {
      const org = d.submission.organization?.legalName ?? "—";
      const key = `${d.sha256}:${d.submission.tenderId}`;
      // only interesting when multiple distinct orgs share it
      const list = groups.get(key) ?? [];
      if (!list.some((x) => x.id === d.id)) list.push(d);
      groups.set(key, list);
    }

    const shared = [...groups.values()]
      .filter((g) => new Set(g.map((d) => d.submission.organization?.legalName)).size > 1)
      .map((g) => ({
        sha256: g[0].sha256.slice(0, 16) + "…",
        docType: g[0].docType,
        fileName: g[0].fileName,
        tenderNumber: g[0].submission.tender.tenderNumber,
        occurrences: g.map((d) => ({
          bidNumber: d.submission.bidNumber,
          organization: d.submission.organization?.legalName ?? "—",
          documentId: d.id,
        })),
        note:
          "Potential Shared Evidence — identical file bytes across different bidders in the same tender. " +
          "Legitimate explanations include authorized OEM letters distributed to multiple dealers. Officer review required.",
      }));

    return ok({ groups: shared, scanned: docs.length });
  });
}
