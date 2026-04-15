export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}

export class ModelLoadError extends Error {
  override name = 'ModelLoadError';
}

export function isWebGLFailure(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('webgl') ||
    m.includes('emscripten_webgl_create_context') ||
    m.includes('kgpuservice') ||
    m.includes('unable to initialize egl') ||
    m.includes("couldn't create")
  );
}
