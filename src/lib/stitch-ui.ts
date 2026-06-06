import { Stitch, StitchError, StitchToolClient } from "@google/stitch-sdk";

type StitchDeviceType = "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
type StitchModelId = "GEMINI_3_1_PRO" | "GEMINI_3_FLASH";

interface StitchGenerateInput {
  prd?: string;
  existingHtml?: string;
  modificationRequest?: string;
  source?: "debate" | "harness";
  harnessArtifacts?: {
    requirementSpec?: unknown;
    cps?: unknown;
    generatedPlan?: unknown;
    evaluation?: unknown;
  };
  projectId?: string;
  deviceType?: StitchDeviceType;
  modelId?: StitchModelId;
}

interface StitchGenerateResult {
  html: string;
  projectId: string;
  screenId: string;
  imageUrl?: string;
}

const DEFAULT_PROJECT_TITLE = "AI Council Prototypes";
const DEFAULT_DEVICE_TYPE: StitchDeviceType = "DESKTOP";
const DEFAULT_MODEL_ID: StitchModelId = "GEMINI_3_1_PRO";

export async function generateStitchPrototype(input: StitchGenerateInput): Promise<StitchGenerateResult> {
  const client = createStitchClient();

  try {
    const stitch = new Stitch(client);
    const projectId = normalizeProjectId(input.projectId || process.env.STITCH_PROJECT_ID);
    const project = projectId
      ? stitch.project(projectId)
      : await stitch.createProject(DEFAULT_PROJECT_TITLE);

    const prompt = buildStitchPrompt(input);
    const screen = await project.generate(
      prompt,
      input.deviceType || DEFAULT_DEVICE_TYPE,
      input.modelId || DEFAULT_MODEL_ID,
    );

    const [htmlUrl, imageUrl] = await Promise.all([
      screen.getHtml(),
      screen.getImage().catch(() => undefined),
    ]);
    const html = await downloadTextAsset(htmlUrl, "Stitch HTML");

    return {
      html: addStitchMetadata(html, {
        projectId: screen.projectId,
        screenId: screen.screenId,
        imageUrl,
      }),
      projectId: screen.projectId,
      screenId: screen.screenId,
      imageUrl,
    };
  } catch (error) {
    throw normalizeStitchError(error);
  } finally {
    await client.close().catch(() => {});
  }
}

function createStitchClient() {
  const apiKey = process.env.STITCH_API_KEY;
  const accessToken = process.env.STITCH_ACCESS_TOKEN;
  const cloudProjectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!apiKey && !(accessToken && cloudProjectId)) {
    throw new Error(
      "STITCH_API_KEY is not configured. Add STITCH_API_KEY to .env.local and Vercel environment variables.",
    );
  }

  return new StitchToolClient({
    apiKey,
    accessToken,
    projectId: cloudProjectId,
    baseUrl: process.env.STITCH_HOST,
    timeout: 300_000,
  });
}

function buildStitchPrompt(input: StitchGenerateInput): string {
  const productContext = input.source === "harness" && input.harnessArtifacts
    ? JSON.stringify(input.harnessArtifacts, null, 2)
    : input.prd || "";

  const refinement = input.modificationRequest
    ? `\n\nREVISION REQUEST:\n${input.modificationRequest}\n\nExisting HTML context:\n${trimForPrompt(input.existingHtml || "", 9000)}`
    : "";

  return `Create a high-fidelity responsive web application screen in Google Stitch.

DESIGN SYSTEM:
- Platform: Web app, desktop-first with mobile responsiveness.
- Visual tone: quiet, professional, operational, information-dense, not a marketing landing page.
- Palette: clean light UI, white surfaces, subtle green primary action, restrained blue/amber supporting accents.
- Components: top navigation, primary workspace, dense forms/tables/cards only where useful, clear empty/loading/error states.
- Radius: 8px maximum for cards and controls.
- Typography: clear sans-serif, compact hierarchy, no oversized hero typography inside app surfaces.
- Accessibility: strong contrast, readable labels, keyboard-friendly controls.

PAGE REQUIREMENTS:
1. Turn the PRD or planning artifacts into the most useful first screen a real user would need.
2. Use realistic Korean interface copy where user-facing text is needed.
3. Prefer working app UI over decorative mockups.
4. Include the key workflow controls and states implied by the PRD.
5. Keep layout stable on mobile and desktop.
6. Avoid generic purple gradients, decorative blobs, nested cards, and stock-looking hero art.

SOURCE CONTEXT:
${trimForPrompt(productContext, 18000)}${refinement}`;
}

async function downloadTextAsset(url: string, label: string) {
  if (!url) {
    throw new Error(`${label} download URL was empty.`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} download failed with HTTP ${response.status}.`);
  }

  return response.text();
}

function addStitchMetadata(
  html: string,
  metadata: { projectId: string; screenId: string; imageUrl?: string },
) {
  const comment = `<!-- ai-council-stitch ${JSON.stringify(metadata)} -->`;
  return `${comment}\n${html.trim()}`;
}

function normalizeProjectId(projectId?: string) {
  return projectId?.replace(/^projects\//, "").trim();
}

function trimForPrompt(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[...trimmed for prompt length...]`;
}

function normalizeStitchError(error: unknown) {
  if (error instanceof StitchError) {
    return new Error(`Stitch ${error.code}: ${error.message}`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown Stitch generation error.");
}
