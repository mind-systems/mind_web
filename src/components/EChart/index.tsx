import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface EChartProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  notMerge?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function EChart({ option, style, notMerge, onEvents }: EChartProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Keyed on isDark only — disposes and recreates the canvas when the OS theme switches.
  useEffect(() => {
    if (!divRef.current) return;
    const chart = echarts.init(divRef.current, isDark ? 'dark' : undefined);
    chartRef.current = chart;

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(divRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [isDark]);

  // Keyed on option/notMerge/isDark — runs after the init effect (same commit order),
  // so on a theme switch the fresh canvas gets its data applied immediately.
  // On an option-only change this is a cheap setOption merge with no dispose.
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(
      { backgroundColor: 'transparent', ...(option as object) },
      notMerge ?? false,
    );
  }, [option, notMerge, isDark]);

  // Keyed on onEvents/isDark — runs after the init effect so freshly created charts
  // (e.g. after a theme switch) get their handlers re-bound. Uses off-before-on to
  // prevent duplicate bindings if the caller passes a new reference. Never disposes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;
    for (const [event, handler] of Object.entries(onEvents)) {
      chart.off(event);
      chart.on(event, handler);
    }
  }, [onEvents, isDark]);

  return <div ref={divRef} style={style} />;
}
