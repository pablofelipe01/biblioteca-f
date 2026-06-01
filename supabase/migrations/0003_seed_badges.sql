-- ============================================================================
-- LeoAventura · Semilla de insignias (§9)
-- ============================================================================
insert into badges (code, name, description, icon) values
  ('primer_paso',   'Primer paso',     'Completaste tu primera misión.',            '🎯'),
  ('aventurero',    'Aventurero',      'Completaste tu primera aventura entera.',   '🗺️'),
  ('racha_7',       'Racha de fuego',  'Leíste 7 días seguidos.',                   '🔥'),
  ('creativo',      'Mente creativa',  'Superaste 3 retos creativos con 80+.',      '🎨'),
  ('maraton_lector','Maratón lector',  'Completaste 10 aventuras.',                 '📚')
on conflict (code) do nothing;
