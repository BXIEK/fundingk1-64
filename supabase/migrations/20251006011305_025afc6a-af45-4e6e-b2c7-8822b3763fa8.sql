-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para executar rebalanceamento a cada 4 horas
SELECT cron.schedule(
  'auto-rebalance-every-4-hours',
  '0 */4 * * *', -- A cada 4 horas (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
  $$
  SELECT
    net.http_post(
        url:='https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/auto-rebalance-cron',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);