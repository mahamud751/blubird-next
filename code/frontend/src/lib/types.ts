export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  stock: number;
  attributes: Record<string, unknown>;
  image_url: string;
  archived: boolean;
  created_at: string;
};

export type ProductList = {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
};

export type Customer = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export type OrderItem = {
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type Order = {
  id: number;
  customer_id: number;
  customer_email: string;
  status: string;
  total_cents: number;
  currency: string;
  notes: string;
  created_at: string;
  items: OrderItem[];
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  reply: string;
  session_id: string;
  products_consulted: { id: number; sku: string; name: string; price_cents: number }[];
  tools_used: string[];
};

export type ImportReport = {
  url: string;
  dry_run: boolean;
  source: string;
  created: string[];
  updated: string[];
  skipped: { row: number; sku?: string; reason: string }[];
  counts: { created: number; updated: number; skipped: number };
};

export type Health = {
  status: string;
  app: string;
  products: number;
  customers: number;
  orders: number;
  assistant?: boolean;
  model?: string | null;
};
