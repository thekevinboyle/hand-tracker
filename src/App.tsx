import { useCamera } from './camera/useCamera';
import { ErrorStates } from './ui/ErrorStates';
import { PrePromptCard } from './ui/PrePromptCard';

export function App() {
  const { state, retry } = useCamera();
  return (
    <main className="app-shell">
      <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>
        {state}
      </p>
      {state === 'PROMPT' && <PrePromptCard onAllow={retry} />}
      {state !== 'PROMPT' && state !== 'GRANTED' && <ErrorStates state={state} onRetry={retry} />}
      {state === 'GRANTED' && (
        <>
          <h1>Hand Tracker FX</h1>
          <p>Scaffolding ready. Webcam pipeline lands in Phase 1 of the implementation plan.</p>
        </>
      )}
    </main>
  );
}
