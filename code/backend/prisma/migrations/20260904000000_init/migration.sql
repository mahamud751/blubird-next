CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" VARCHAR(80) NOT NULL DEFAULT 'general',
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "image_url" VARCHAR(300) NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_product_price_nonneg" CHECK ("price_cents" >= 0),
    CONSTRAINT "ck_product_stock_nonneg" CHECK ("stock" >= 0)
);

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'placed',
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_order_total_nonneg" CHECK ("total_cents" >= 0)
);

CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_item_qty_pos" CHECK ("quantity" >= 1),
    CONSTRAINT "ck_item_price_nonneg" CHECK ("unit_price_cents" >= 0)
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
