import { createRoot } from "react-dom/client";

// Placeholder shell from the scaffold. The UI lane replaces this (docs/lanes/ui.md).
function App() {
  return <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>Clearlane</main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
