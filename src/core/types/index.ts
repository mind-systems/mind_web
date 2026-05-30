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
