import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

/**
 * Serve a BidDocument file for admin viewing.
 * GET /api/admin/documents/[id]/file
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const doc = await prisma.bidDocument.findUnique({ where: { id } });
  if (!doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const buffer = await storage.read(doc.storagePath);
    const ext = doc.fileName.toLowerCase().split(".").pop() ?? "";
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
      jpeg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheet.sheet", txt: "text/plain",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Failed to serve document file:", err);
    return new Response(JSON.stringify({ error: "File not available" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
