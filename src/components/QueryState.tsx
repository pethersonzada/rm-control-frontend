export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (loading)
    return (
      <div className="skeleton" role="status">
        Carregando…
      </div>
    );
  if (!error) return null;
  return (
    <div className="error">
      <p role="alert">{error.message}</p>
      <button className="secondary" onClick={retry}>
        Tentar novamente
      </button>
    </div>
  );
}
