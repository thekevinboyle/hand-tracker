export const CAMERA_STATES = [
  'PROMPT',
  'GRANTED',
  'USER_DENIED',
  'SYSTEM_DENIED',
  'DEVICE_CONFLICT',
  'NOT_FOUND',
  'MODEL_LOAD_FAIL',
  'NO_WEBGL',
] as const;

export type CameraState = (typeof CAMERA_STATES)[number];

export function isCameraState(value: unknown): value is CameraState {
  return typeof value === 'string' && (CAMERA_STATES as readonly string[]).includes(value);
}
