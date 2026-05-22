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

export interface SBUUnit {
  id: string;
  name: string;
  code: string;
  sbu_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SBUUnitCreateInput {
  name: string;
  code: string;
  sbu_id: string;
}
