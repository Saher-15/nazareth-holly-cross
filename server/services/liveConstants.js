// Values shared by the live-broadcasting models, services and routes (docs/LIVE.md). They live here, not in the model
// files, because the local harness replaces every model file by an in-memory fake that exports only the model.

/** Nazareth's time zone: scheduled broadcasts are typed in Nazareth time and stored in UTC. */
export const NAZARETH_TIME_ZONE = 'Asia/Jerusalem';

/** A recording of a broadcast (model/liveRecording.js). */
export const RECORDING_STATUSES = ['uploading', 'processing', 'ready', 'failed'];

/** A scheduled broadcast (model/scheduledBroadcast.js). */
export const SCHEDULE_STATUSES = ['scheduled', 'live', 'done', 'cancelled'];

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 500;
