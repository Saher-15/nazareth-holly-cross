import { z } from 'zod';

// /admin/candle-videos (server/route/admin/candleVideos.js, docs/ADMIN.md 5.5).
export const candleVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['uploading', 'processing', 'ready', 'failed']),
  failReason: z.string().nullable(),
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  sizeBytes: z.number(),
  durationSeconds: z.number(),
  createdAt: z.string().nullable(),
  createdBy: z.string(),
  playbackUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
});
export type CandleVideo = z.infer<typeof candleVideoSchema>;
export const candleVideoListSchema = z.object({ configured: z.boolean(), max: z.number(), maxBytes: z.number(), items: z.array(candleVideoSchema) });
export type CandleVideoList = z.infer<typeof candleVideoListSchema>;
export const candleVideoUploadSchema = z.object({ video: candleVideoSchema, uploadUrl: z.string() });
export const candleVideoOneSchema = z.object({ video: candleVideoSchema });

/** Phones film in MP4 or QuickTime; Cloudflare Stream encodes these (the API checks the same list). */
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
