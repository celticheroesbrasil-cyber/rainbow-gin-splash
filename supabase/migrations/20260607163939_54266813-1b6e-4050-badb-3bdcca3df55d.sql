CREATE TABLE public.shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  service_code text,
  tracking_number text,
  shipping_order_number text,
  label_url text,
  error text,
  raw_request jsonb,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_labels TO authenticated;
GRANT ALL ON public.shipping_labels TO service_role;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_shipping_labels_order_id ON public.shipping_labels(order_id);
CREATE TRIGGER shipping_labels_set_updated_at
  BEFORE UPDATE ON public.shipping_labels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();