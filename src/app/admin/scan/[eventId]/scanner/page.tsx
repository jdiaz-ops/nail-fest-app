import ScanWorkspace from "../../ScanWorkspace";

// Renders BOTH Escanear and Lista (see ScanWorkspace's own comment on
// why they share one mounted route instead of being two separate ones).
export default function ScannerPage() {
  return <ScanWorkspace />;
}
