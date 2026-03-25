import { ControlPanel } from './components/ControlPanel';
import { StackSection } from './components/StackSection';
import { MapView } from './components/MapView';
import { useStore } from './store';

export default function App() {
  const viewMode = useStore((s) => s.viewMode);

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white font-mono">
      <ControlPanel />
      {viewMode === 'section' ? <StackSection /> : <MapView />}
    </div>
  );
}
