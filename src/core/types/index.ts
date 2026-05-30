export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SessionRun {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface ListRunsResponse {
  items: SessionRun[];
  total: number;
}

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

export interface PhaseBar {
  startSec: number;
  endSec: number;
  phase: BreathPhase;
}

export interface InstructionDto {
  timestamp: string;
  type: string;
  payload: {
    phase?: BreathPhase;
    durationMs?: number;
  } & Record<string, unknown>;
}

export interface BioSampleDto {
  timestamp: string;
  sampleType: string;
  data: Record<string, number | boolean | string>;
}

export interface NfbCalibrationRecord {
  id: string;
  userId: string;
  deviceSerial: string;
  calibratedAt: string;
  createdAt: string;
  isValid: boolean;
  failReason: string | null;
  individualFrequency: number;
  individualPeakFrequencyPower: number;
  individualPeakFrequencySuppression: number;
  individualBandwidth: number;
  individualNormalizedPower: number;
  lowerFrequency: number;
  upperFrequency: number;
}

export interface NfbCalibrationsResponse {
  records: NfbCalibrationRecord[];
  total: number;
}
