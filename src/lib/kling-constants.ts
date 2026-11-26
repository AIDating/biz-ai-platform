/** Documented Kling AI video formats (kling-2.6). Shared by server client and UI. */

export const KLING_API_BASE = "https://api-singapore.klingai.com";

export const KLING_TEXT_TO_VIDEO_PATH = "/text-to-video/kling-2.6";
export const KLING_IMAGE_TO_VIDEO_PATH = "/image-to-video/kling-2.6";
export const KLING_TASKS_PATH = "/tasks";

export const KLING_ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;
export type KlingAspectRatio = (typeof KLING_ASPECT_RATIOS)[number];

export const KLING_RESOLUTIONS = ["720p", "1080p"] as const;
export type KlingResolution = (typeof KLING_RESOLUTIONS)[number];

export const KLING_DURATIONS = [5, 10] as const;
export type KlingDuration = (typeof KLING_DURATIONS)[number];

export type KlingTaskStatus = "submitted" | "processing" | "succeeded" | "failed";

export function isKlingAspectRatio(value: string): value is KlingAspectRatio {
  return (KLING_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function isKlingResolution(value: string): value is KlingResolution {
  return (KLING_RESOLUTIONS as readonly string[]).includes(value);
}

export function isKlingDuration(value: number): value is KlingDuration {
  return (KLING_DURATIONS as readonly number[]).includes(value);
}
