import type { CameraState } from '../camera/cameraState';

export interface CardCopy {
  title: string;
  body: string;
  retryLabel?: string;
}

export const errorCopy: Record<CameraState, CardCopy> = {
  PROMPT: {
    title: 'Enable your camera',
    body: 'Hand Tracker FX needs your camera to track your hand. Video stays on your device — nothing is uploaded.',
    retryLabel: 'Enable Camera',
  },
  GRANTED: { title: '', body: '' },
  USER_DENIED: {
    title: 'Camera access blocked',
    body: 'You denied camera access. Open your browser site settings for this page, switch Camera to Allow, and click Retry.',
    retryLabel: 'Retry',
  },
  SYSTEM_DENIED: {
    title: 'Your OS or browser blocked camera access',
    body: 'A system-level setting or Permissions-Policy prevented camera access. Check System Settings > Privacy > Camera, or open this page in a browser where the camera is not restricted.',
    retryLabel: 'Retry',
  },
  DEVICE_CONFLICT: {
    title: 'Camera is busy',
    body: 'Another app is using your camera. Close Zoom, FaceTime, Google Meet, or any other tool holding the camera, then click Retry.',
    retryLabel: 'Retry',
  },
  NOT_FOUND: {
    title: 'No camera detected',
    body: 'No video input device was found. Plug in a webcam and click Retry.',
    retryLabel: 'Retry',
  },
  MODEL_LOAD_FAIL: {
    title: 'Hand tracking failed to load',
    body: 'The hand tracking model could not be loaded. Check your network connection and reload the page.',
    retryLabel: 'Retry',
  },
  NO_WEBGL: {
    title: "Your browser can't run the effect",
    body: 'WebGL2 is unavailable. Try another browser (Chrome 120+, Firefox 132+, Safari 17+) or enable hardware acceleration.',
  },
};
