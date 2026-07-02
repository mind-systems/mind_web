import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface EChartProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  notMerge?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
  xAxisInterval?: number;
}

export function EChart({ option, style, notMerge, onEvents, xAxisInterval }: EChartProps) {
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

  // Keyed on xAxisInterval/isDark — a targeted axis-only merge that runs after the option
  // effect. This touches only xAxis.interval (series/grids/yAxis/dataZoom stay untouched),
  // so a zoom-driven interval change is a cheap setOption merge instead of a full rebuild.
  // Keying on isDark re-applies after a theme-driven canvas recreate.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || xAxisInterval == null) return;
    // Axis count read from the `option` prop closure, not `chart.getOption()` — the latter
    // deep-clones the entire maintained option, including every series' data array, just to
    // read a length. `option.xAxis` is intentionally excluded from the deps below: the effect
    // must fire only on xAxisInterval/isDark, not on every option change (that would defeat
    // the point of the targeted merge).
    const count = Array.isArray(option.xAxis) ? option.xAxis.length : 1;
    chart.setOption(
      { xAxis: Array.from({ length: count }, () => ({ interval: xAxisInterval })) },
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xAxisInterval, isDark]);

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
