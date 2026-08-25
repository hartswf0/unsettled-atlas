-- GEONOSIS persistent storage contract
-- The static Atlas is a compiled projection of these relations, not the database itself.
create extension if not exists postgis;

create table if not exists geonosis_subjects (
  id text primary key,
  identity_basis jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists geonosis_forms (
  id text primary key,
  subject_id text not null references geonosis_subjects(id),
  form text not null check (form in ('OBJECT','FIELD','TRAJECTORY','RELATION')),
  geom geometry(Geometry,4326),
  atlas_address text,
  native_extent text,
  operative_scale text,
  provenance jsonb,
  created_at timestamptz not null default now()
);
create index if not exists geonosis_forms_geom_gix on geonosis_forms using gist (geom);
create index if not exists geonosis_forms_atlas_idx on geonosis_forms (atlas_address);
create index if not exists geonosis_forms_subject_idx on geonosis_forms (subject_id);

create table if not exists geonosis_observations (
  id text primary key,
  form_id text not null references geonosis_forms(id),
  regime text not null check (regime in ('MATERIAL','AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL')),
  source text not null,
  source_record_id text,
  source_signal_id text,
  epistemic text not null,
  predicate text not null,
  value jsonb,
  unit text,
  apparatus jsonb not null,
  occurred_at timestamptz,
  became_detectable_at timestamptz,
  observed_at timestamptz,
  recorded_at timestamptz,
  published_at timestamptz,
  valid_from timestamptz,
  recognized_at timestamptz,
  acted_on_at timestamptz,
  superseded_at timestamptz,
  expired_at timestamptz,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  provenance jsonb,
  inserted_at timestamptz not null default now()
);
create index if not exists geonosis_obs_form_idx on geonosis_observations (form_id);
create index if not exists geonosis_obs_regime_predicate_idx on geonosis_observations (regime,predicate);
create index if not exists geonosis_obs_observed_idx on geonosis_observations (observed_at desc);

create table if not exists geonosis_rules (
  id text primary key,
  kind text not null check (kind in ('INTERPRETATION','CORRESPONDENCE')),
  version text not null,
  definition jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists geonosis_interpretations (
  id text primary key,
  subject_id text not null references geonosis_subjects(id),
  actor_id text not null,
  rule_id text not null references geonosis_rules(id),
  interpretant text not null,
  modality text,
  alternatives jsonb not null default '[]'::jsonb,
  falsifiers jsonb not null default '[]'::jsonb,
  observation_ids jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists geonosis_possibilities (
  id text primary key,
  subject_id text not null references geonosis_subjects(id),
  actor_id text not null,
  condition text not null,
  modality text not null,
  reachable boolean,
  permitted boolean,
  expected boolean,
  risk double precision,
  horizon text,
  derived_from jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists geonosis_poss_actor_idx on geonosis_possibilities (actor_id);

create table if not exists geonosis_correspondences (
  id text primary key,
  subject_id text not null references geonosis_subjects(id),
  rule_id text not null references geonosis_rules(id),
  regime_a text not null,
  regime_b text not null,
  state text not null check (state in ('MATCH','MISMATCH','LAG','CONTRADICTION','UNKNOWN')),
  evidence jsonb not null,
  explanation text not null,
  valid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists geonosis_events (
  id text primary key,
  subject_id text not null references geonosis_subjects(id),
  rule_id text not null references geonosis_rules(id),
  regime_a text not null,
  regime_b text not null,
  state text not null,
  started_at timestamptz,
  resolved_at timestamptz,
  active boolean not null,
  evidence jsonb not null,
  geom geometry(Geometry,4326),
  atlas_address text,
  created_at timestamptz not null default now()
);
create index if not exists geonosis_events_geom_gix on geonosis_events using gist (geom);
create index if not exists geonosis_events_active_idx on geonosis_events (active,started_at desc);

create table if not exists geonosis_compile_runs (
  id text primary key,
  region text not null,
  source_manifest jsonb not null,
  counts jsonb not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null
);

comment on table geonosis_observations is 'Append-only evidence ledger. Corrections arrive as new observations; source records are not silently overwritten.';
comment on table geonosis_events is 'Derived regime breaks. Events are evidence-backed outputs, never source facts.';
