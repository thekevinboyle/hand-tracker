import { useCamera } from './camera/useCamera';

export function App() {
  const { state } = useCamera();
  return (
    <main className="app-shell">
      <h1>Hand Tracker FX</h1>
      <p>Scaffolding ready. Webcam pipeline lands in Phase 1 of the implementation plan.</p>
      <p data-testid="camera-state">{state}</p>
    </main>
  );
}
