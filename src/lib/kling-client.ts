import "server-only";
import {
  KLING_API_BASE,
  KLING_IMAGE_TO_VIDEO_PATH,
  KLING_TASKS_PATH,
  KLING_TEXT_TO_VIDEO_PATH,
  type KlingAspectRatio,
  type KlingDuration,
  type KlingResolution,
  type KlingTaskStatus,
} from "@/lib/kling-constants";

export {
  KLING_API_BASE,
  KLING_ASPECT_RATIOS,
  KLING_DURATIONS,
  KLING_IMAGE_TO_VIDEO_PATH,
  KLING_RESOLUTIONS,
  KLING_TASKS_PATH,
  KLING_TEXT_TO_VIDEO_PATH,
  isKlingAspectRatio,
  isKlingDuration,
  isKlingResolution,
} from "@/lib/kling-constants";
export type { KlingAspectRatio, KlingDuration, KlingResolution, KlingTaskStatus } from "@/lib/kling-constants";

/**
 * Official Kling AI Open Platform (Singapore) — documented endpoints only.
 * Auth: Authorization: Bearer <API_KEY>
 * Domain: https://api-singapore.klingai.com
 */

export type KlingCreateTaskResult = {
  id: string;
  status: KlingTaskStatus;
  externalId?: string;
};

export type KlingTaskOutput = {
  type: string;
  id?: string;
  url?: string;
  watermark_url?: string;
  duration?: string;
};

export type KlingTaskResult = {
  id: string;
  status: KlingTaskStatus;
  message?: string;
  external_id?: string;
  outputs?: KlingTaskOutput[];
};

type KlingApiEnvelope<T> = {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export class KlingApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "KlingApiError";
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let body: KlingApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as KlingApiEnvelope<T>;
  } catch {
    throw new KlingApiError("Kling API returned a non-JSON response.", undefined, response.status);
  }
  if (!response.ok) {
    throw new KlingApiError(
      body?.message || `Kling API HTTP ${response.status}`,
      body?.code,
      response.status,
    );
  }
  if (body.code !== 0) {
    throw new KlingApiError(body.message || `Kling API error ${body.code}`, body.code, response.status);
  }
  if (body.data === undefined || body.data === null) {
    throw new KlingApiError("Kling API returned no data.", body.code, response.status);
  }
  return body.data;
}

export type TextToVideoInput = {
  prompt: string;
  aspectRatio?: KlingAspectRatio;
  resolution?: KlingResolution;
  duration?: KlingDuration;
  externalTaskId?: string;
};

/** POST /text-to-video/kling-2.6 */
export async function createTextToVideoTask(
  apiKey: string,
  input: TextToVideoInput,
  fetchImpl: typeof fetch = fetch,
): Promise<KlingCreateTaskResult> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new KlingApiError("Prompt is required.");
  if (prompt.length > 2500) throw new KlingApiError("Prompt exceeds 2500 characters.");

  const payload = {
    prompt,
    settings: {
      resolution: input.resolution ?? "720p",
      aspect_ratio: input.aspectRatio ?? "16:9",
      duration: input.duration ?? 5,
      audio: "off",
    },
    options: {
      ...(input.externalTaskId ? { external_task_id: input.externalTaskId } : {}),
      watermark_info: { enabled: false },
    },
  };

  const response = await fetchImpl(`${KLING_API_BASE}${KLING_TEXT_TO_VIDEO_PATH}`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const data = await parseEnvelope<{
    id: string;
    status: string;
    external_id?: string;
  }>(response);

  return {
    id: data.id,
    status: normalizeStatus(data.status),
    externalId: data.external_id,
  };
}

export type ImageToVideoInput = {
  prompt: string;
  imageUrl: string;
  resolution?: KlingResolution;
  duration?: KlingDuration;
  externalTaskId?: string;
};

/** POST /image-to-video/kling-2.6 */
export async function createImageToVideoTask(
  apiKey: string,
  input: ImageToVideoInput,
  fetchImpl: typeof fetch = fetch,
): Promise<KlingCreateTaskResult> {
  const prompt = input.prompt.trim();
  const imageUrl = input.imageUrl.trim();
  if (!prompt) throw new KlingApiError("Prompt is required.");
  if (prompt.length > 2500) throw new KlingApiError("Prompt exceeds 2500 characters.");
  if (!imageUrl) throw new KlingApiError("Image URL is required.");

  const payload = {
    contents: [
      { type: "prompt", text: prompt },
      { type: "first_frame", url: imageUrl },
    ],
    settings: {
      resolution: input.resolution ?? "720p",
      duration: input.duration ?? 5,
      audio: "off",
    },
    options: {
      ...(input.externalTaskId ? { external_task_id: input.externalTaskId } : {}),
      watermark_info: { enabled: false },
    },
  };

  const response = await fetchImpl(`${KLING_API_BASE}${KLING_IMAGE_TO_VIDEO_PATH}`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const data = await parseEnvelope<{
    id: string;
    status: string;
    external_id?: string;
  }>(response);

  return {
    id: data.id,
    status: normalizeStatus(data.status),
    externalId: data.external_id,
  };
}

/** GET /tasks?task_ids=… */
export async function queryKlingTasks(
  apiKey: string,
  taskIds: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<KlingTaskResult[]> {
  const ids = taskIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const url = new URL(`${KLING_API_BASE}${KLING_TASKS_PATH}`);
  url.searchParams.set("task_ids", ids.join(","));

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: authHeaders(apiKey),
  });
  const data = await parseEnvelope<KlingTaskResult[]>(response);
  return data.map((task) => ({
    ...task,
    status: normalizeStatus(task.status),
  }));
}

export function pickVideoOutput(task: KlingTaskResult): {
  videoUrl: string;
  watermarkUrl: string;
} {
  const video = (task.outputs ?? []).find((item) => item.type === "video" && item.url);
  return {
    videoUrl: video?.url ?? "",
    watermarkUrl: video?.watermark_url ?? "",
  };
}

function normalizeStatus(value: string): KlingTaskStatus {
  if (value === "processing" || value === "succeeded" || value === "failed" || value === "submitted") {
    return value;
  }
  return "processing";
}
