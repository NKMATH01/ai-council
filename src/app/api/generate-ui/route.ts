import { NextRequest } from "next/server";
import { streamGemini } from "@/lib/ai-stream";
import {
  buildHarnessUiUserMessage,
  getHarnessUiPrompt,
  getUiPrototypePrompt,
  getUiRefinePrompt,
} from "@/lib/prompts";
import { GenerateUiRequestSchema } from "@/lib/api-schemas";
import { generateStitchPrototype } from "@/lib/stitch-ui";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = GenerateUiRequestSchema.parse(await request.json());
    const provider = body.uiProvider || "stitch";

    if (provider === "stitch") {
      const result = await generateStitchPrototype({
        prd: body.prd,
        existingHtml: body.existingHtml,
        modificationRequest: body.modificationRequest,
        source: body.source,
        harnessArtifacts: body.harnessArtifacts,
        projectId: body.stitchProjectId,
        deviceType: body.stitchDeviceType,
        modelId: body.stitchModelId,
      });

      return new Response(result.html, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Stitch-Project-Id": result.projectId,
          "X-Stitch-Screen-Id": result.screenId,
          ...(result.imageUrl ? { "X-Stitch-Image-Url": result.imageUrl } : {}),
        },
      });
    }

    const { systemPrompt, userMessage } = buildGeminiUiPrompt(body);
    const stream = await streamGemini(systemPrompt, userMessage, undefined, 65536);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      console.error("Generate UI validation error:", error.issues);
      return Response.json({ error: "Invalid generate-ui request." }, { status: 400 });
    }

    console.error("Generate UI error:", error);
    return Response.json(
      { error: error?.message || "UI generation failed." },
      { status: 500 },
    );
  }
}

function buildGeminiUiPrompt(body: ReturnType<typeof GenerateUiRequestSchema.parse>) {
  if (body.existingHtml && body.modificationRequest) {
    return {
      systemPrompt: getUiRefinePrompt(),
      userMessage: `## Existing HTML\n${body.existingHtml}\n\n## Revision request\n${body.modificationRequest}`,
    };
  }

  if (body.source === "harness" && body.harnessArtifacts) {
    return {
      systemPrompt: getHarnessUiPrompt(),
      userMessage: buildHarnessUiUserMessage(body.harnessArtifacts),
    };
  }

  return {
    systemPrompt: getUiPrototypePrompt(),
    userMessage: body.prd,
  };
}
