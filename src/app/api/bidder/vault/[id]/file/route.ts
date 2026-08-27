import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";

/**
 * Serve a vault document file for viewing/download.
 * GET /api/bidder/vault/[id]/file
 * 
 * Auth:
 * - BIDDER: can only view their own organization's docs
 * - SUPER_ADMIN / PROCUREMENT_OFFICER: can view any doc
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  const doc = await prisma.documentVault.findUnique({ where: { id } });
  if (!doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Access control
  const isBidder = session.role === "BIDDER";
  const isAdmin = ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(session.role);
  const isOfficer = ["PROCUREMENT_OFFICER", "BID_EVALUATION_OFFICER"].includes(session.role);

  if (isBidder && session.organizationId !== doc.organizationId) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isBidder && !isAdmin && !isOfficer) {
    return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const buffer = await storage.read(doc.storagePath);

    // Log access
    await audit({
      actor: session,
      action: "VAULT_DOCUMENT_DOWNLOADED",
      entityType: "DocumentVault",
      entityId: id,
    });

    // Determine content type
    const ext = doc.fileName.toLowerCase().split(".").pop() ?? "";
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    // Check if download or inline view
    const url = new URL(req.url);
    const disposition = url.searchParams.get("download") === "true"
      ? `attachment; filename="${doc.fileName}"`
      : `inline; filename="${doc.fileName}"`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Failed to serve document file:", err);
    return new Response(JSON.stringify({ error: "File not available" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
