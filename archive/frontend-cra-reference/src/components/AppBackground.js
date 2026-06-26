import './AppBackground.css';

export default function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg-glow app-bg-glow--tl" />
      <div className="app-bg-glow app-bg-glow--br" />
      <div className="app-bg-grid" />
    </div>
  );
}
