import { ControlPanel } from './components/ControlPanel';
import { StackSection } from './components/StackSection';

export default function App() {
  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white font-mono">
      <ControlPanel />
      <StackSection />
    </div>
  );
}
