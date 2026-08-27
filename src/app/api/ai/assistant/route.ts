import { requireSession } from "@/lib/auth";
import { aiAssistantAnswer } from "@/lib/ai/tasks";
import { buildAssistantContext } from "@/lib/engine/pipeline";
import { ok, fail, handle } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { question, bidId } = await req.json();
    if (!question || !bidId) return fail(400, "question and bidId are required");

    const ctx = await buildAssistantContext(bidId);
    // role-based context restriction: bidders never see competitor or officer-confidential data
    const result = await aiAssistantAnswer(
      { role: session.role === "BIDDER" ? "BIDDER" : "OFFICER", question, contextSummary: ctx },
      session.userId,
    );
    return ok({ answer: result.data.answer, evidenceRefs: result.data.evidenceRefs, simulated: result.meta.simulated, provider: result.meta.provider });
  });
}
