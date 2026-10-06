// The schema defaults of model/liveRecording.js and model/scheduledBroadcast.js, for their in-memory fakes (the local
// harness, harness-models.js, and the server tests, __tests__/setup.js). Keep them equal to the models.
export const RECORDING_DEFAULTS = {
  status: 'uploading', liveEndedAt: null, durationSeconds: 0, sizeBytes: 0, mimeType: '', customerCode: '', failReason: null,
  published: false, publishedAt: null, uploadExpiresAt: null, checkedAt: null,
};
export const SCHEDULE_DEFAULTS = { description: '', published: false, status: 'scheduled', liveSession: null };
