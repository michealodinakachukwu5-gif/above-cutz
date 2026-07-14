-- Run this in Supabase SQL Editor to add dental service support

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'barber'
  CHECK (service_type IN ('barber', 'dental'));

-- Update any existing services to explicitly be 'barber'
UPDATE services SET service_type = 'barber' WHERE service_type IS NULL OR service_type = 'barber';
