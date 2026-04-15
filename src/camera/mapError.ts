import type { CameraState } from './cameraState';

/**
 * Pure mapping from a getUserMedia rejection + current PermissionState to a CameraState.
 *
 * OverconstrainedError is NOT handled here — the hook retries with relaxed constraints
 * before ever invoking this mapper. If the relaxed retry also fails, the resulting
 * error hits this function and falls through to SYSTEM_DENIED via the default branch.
 */
export function mapGetUserMediaError(
  err: unknown,
  permissionState: PermissionState | 'unknown',
): CameraState {
  if (!(err instanceof DOMException)) return 'SYSTEM_DENIED';
  switch (err.name) {
    case 'NotAllowedError':
      return permissionState === 'denied' ? 'USER_DENIED' : 'SYSTEM_DENIED';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'NOT_FOUND';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'DEVICE_CONFLICT';
    default:
      return 'SYSTEM_DENIED';
  }
}
