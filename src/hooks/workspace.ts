import { createContext, useContext } from "react";
import type { Identity } from "../domain/types";
import type { api } from "../services/api";

type Workspace = {
  remote: ReturnType<typeof api> | null;
  identity: Identity | null;
};
export const WorkspaceContext = createContext<Workspace>({
  remote: null,
  identity: null,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
