export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit_of_measure: string;
  stock_quantity: number;
  low_stock_threshold: number;
  unit_cost: number | null;
  is_active: boolean;
  warehouse_id: string | null;
  warehouse_location: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateInput {
  name: string;
  sku: string;
  description?: string;
  unit_of_measure?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
  unit_cost?: number;
  warehouse_location: string;
}
