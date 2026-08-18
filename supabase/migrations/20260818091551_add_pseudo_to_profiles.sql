-- Ajoute un pseudo public aux profils (utilisé notamment sur le forum)
alter table public.profiles
  add column if not exists pseudo text;

-- Unicité des pseudos (les valeurs nulles ou vides sont ignorées)
create unique index if not exists profiles_pseudo_unique
  on public.profiles (pseudo)
  where pseudo is not null and btrim(pseudo) <> '';

-- Longueur raisonnable : entre 2 et 30 caractères
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pseudo_length'
  ) then
    alter table public.profiles
      add constraint profiles_pseudo_length
      check (pseudo is null or (char_length(btrim(pseudo)) between 2 and 30));
  end if;
end
$$;
