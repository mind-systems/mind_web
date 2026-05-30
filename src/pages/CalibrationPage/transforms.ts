import type { NfbCalibrationRecord } from '@/core/types';

export interface DeviceGroup {
  deviceSerial: string;
  records: NfbCalibrationRecord[];
  validCount: number;
}

/**
 * Groups calibration records by device serial, preserving the first-seen order
 * of each device. Within each group, records are sorted ascending by calibratedAt
 * (chronological order) so charts plot left-to-right over time.
 * The API returns records in createdAt DESC order, so sorting is always needed.
 */
export function groupByDevice(records: NfbCalibrationRecord[]): DeviceGroup[] {
  const orderMap = new Map<string, number>();
  const groupMap = new Map<string, NfbCalibrationRecord[]>();

  for (const record of records) {
    if (!groupMap.has(record.deviceSerial)) {
      orderMap.set(record.deviceSerial, orderMap.size);
      groupMap.set(record.deviceSerial, []);
    }
    groupMap.get(record.deviceSerial)!.push(record);
  }

  const devices = Array.from(groupMap.entries()).sort(
    ([a], [b]) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0),
  );

  return devices.map(([deviceSerial, recs]) => {
    const sorted = [...recs].sort(
      (a, b) => new Date(a.calibratedAt).getTime() - new Date(b.calibratedAt).getTime(),
    );
    return {
      deviceSerial,
      records: sorted,
      validCount: sorted.filter((r) => r.isValid).length,
    };
  });
}
