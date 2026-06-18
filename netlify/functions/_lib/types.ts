import type { Context } from "@netlify/functions";

export type Nxt5Handler = (request: Request, context: Context) => Response | Promise<Response>;

export type DbUser = {
  id: string;
  account_name: string;
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
  notif_match?: boolean | null;
  notif_report?: boolean | null;
  created_at?: string | Date;
};

export type DbSession = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string | Date;
  revoked_at?: string | Date | null;
  user_agent?: string | null;
  ip?: string | null;
};

export type RiotParticipant = {
  participantId: number;
  teamId: 100 | 200 | number;
  championId: number;
  championName: string;
  summonerName?: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  teamPosition?: string;
  individualPosition?: string;
  lane?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  goldEarned?: number;
  totalDamageDealtToChampions?: number;
  visionScore?: number;
  [key: string]: unknown;
};

export type RiotTeam = {
  teamId: 100 | 200 | number;
  win?: boolean;
  objectives?: Record<string, { kills?: number }>;
  [key: string]: unknown;
};

export type RiotMatch = {
  metadata?: {
    matchId?: string;
    participants?: string[];
    [key: string]: unknown;
  };
  info: {
    gameId?: number;
    gameCreation?: number;
    gameDuration?: number;
    gameVersion?: string;
    participants: RiotParticipant[];
    teams: RiotTeam[];
    [key: string]: unknown;
  };
  timeline?: unknown;
  [key: string]: unknown;
};
