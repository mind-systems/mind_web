import { init } from 'observe-js';
import { logToObserver, otlpEndpoint } from './config';

export function initObserve(): void {
  if (!logToObserver || !otlpEndpoint) return;
  init({
    project: 'mind',
    service: 'mind_web',
    endpoint: otlpEndpoint,
    onError: import.meta.env.DEV ? (err) => console.error('[observe-js]', err) : undefined,
  });
}
