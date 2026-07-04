import { init } from 'observe-js';
import { logToObserver, otlpEndpoint, otlpAuthToken } from './config';

export function initObserve(): void {
  if (!logToObserver || !otlpEndpoint) return;
  init({
    project: 'mind',
    service: 'mind_web',
    endpoint: otlpEndpoint,
    headers: otlpAuthToken ? { Authorization: `Bearer ${otlpAuthToken}` } : undefined,
    onError: import.meta.env.DEV ? (err) => console.error('[observe-js]', err) : undefined,
  });
}
