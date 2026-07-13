export interface EventPerson {
  id: string;
  visit_count: number;
}

export interface EventSummary {
  id: string;
  event_type: string;
  confidence: number | null;
  zone: string | null;
  action_taken: string | null;
  created_at: Date;
  person: EventPerson | null;
}

export interface ListEventsResult {
  events: EventSummary[];
  page: number;
  limit: number;
  total: number;
}
