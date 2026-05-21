export interface SBU {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SBUCreateInput {
  name: string;
  code: string;
}
