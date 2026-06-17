type LogDestination = 'file' | 'grafana' | 'both';

const raw = (import.meta.env.VITE_LOG_DESTINATION as string | undefined)?.trim();
export const logDestination: LogDestination =
  raw === 'grafana' || raw === 'both' || raw === 'file' ? raw : 'file';

export const logToConsole = logDestination === 'file' || logDestination === 'both';
export const logToObserver = logDestination === 'grafana' || logDestination === 'both';

export const otlpEndpoint =
  (import.meta.env.VITE_OTLP_ENDPOINT as string | undefined)?.trim() || undefined;
