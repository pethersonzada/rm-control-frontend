import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/Theme";
import { App } from "./App";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15_000 } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <ThemeProvider><App /></ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
