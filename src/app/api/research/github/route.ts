import { NextRequest } from "next/server";
import { GithubResearchRequestSchema } from "@/lib/api-schemas";
import { researchGitHubReferences } from "@/lib/github-research";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = GithubResearchRequestSchema.parse(await request.json());
    const research = await researchGitHubReferences(body);
    return Response.json(research);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Validation error:", error.issues);
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("GitHub research API error:", error);
    return Response.json({ error: "GitHub 리서치 중 오류가 발생했습니다." }, { status: 500 });
  }
}
