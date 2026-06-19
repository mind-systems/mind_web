export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export type ActivityType = 'breath' | 'meditation';

export interface SessionRun {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  activityType: ActivityType;
  description: string | null;
  complexity: number | null;
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
  timestamp: number;
  moduleId: string;
  instructionType: string;
  data: {
    phase?: BreathPhase;
    offsetMs?: number;
    tickCount?: number;
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
