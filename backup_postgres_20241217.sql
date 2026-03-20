--
-- PostgreSQL database dump
--

\restrict SpvKBr4nF6YKHPQLKxhj1gwqLFmLY0qgw5Ag6J7NpbsIgwEPoZeEeiLjiwtRuzR

-- Dumped from database version 16.9 (Homebrew)
-- Dumped by pg_dump version 16.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: abenton333
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO abenton333;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: assignment_status; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.assignment_status AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'IN_PROGRESS',
    'COMPLETE',
    'NOT_DONE'
);


ALTER TYPE public.assignment_status OWNER TO abenton333;

--
-- Name: blue_book_status; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.blue_book_status AS ENUM (
    'PENDING',
    'COMPLETE'
);


ALTER TYPE public.blue_book_status OWNER TO abenton333;

--
-- Name: dispatch_status; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.dispatch_status AS ENUM (
    'DRAFT',
    'SENT'
);


ALTER TYPE public.dispatch_status OWNER TO abenton333;

--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.invoice_status AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'VOID'
);


ALTER TYPE public.invoice_status OWNER TO abenton333;

--
-- Name: log_kind; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.log_kind AS ENUM (
    'sms',
    'email'
);


ALTER TYPE public.log_kind OWNER TO abenton333;

--
-- Name: org_role; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.org_role AS ENUM (
    'admin',
    'backoffice',
    'contractor'
);


ALTER TYPE public.org_role OWNER TO abenton333;

--
-- Name: preferred_lang; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.preferred_lang AS ENUM (
    'EN',
    'ES_MX'
);


ALTER TYPE public.preferred_lang OWNER TO abenton333;

--
-- Name: role; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.role AS ENUM (
    'ADMIN',
    'DISPATCHER',
    'FOREMAN',
    'CREW',
    'OFFICE',
    'CUSTOMER'
);


ALTER TYPE public.role OWNER TO abenton333;

--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.ticket_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.ticket_status OWNER TO abenton333;

--
-- Name: unit_kind; Type: TYPE; Schema: public; Owner: abenton333
--

CREATE TYPE public.unit_kind AS ENUM (
    'PER_JOB',
    'PER_SQFT',
    'PER_UNIT'
);


ALTER TYPE public.unit_kind OWNER TO abenton333;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: abenton333
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO abenton333;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: abenton333
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO abenton333;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: abenton333
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_request_service_id uuid,
    crew_id uuid,
    dispatch_batch_id uuid,
    scheduled_start timestamp without time zone,
    scheduled_end timestamp without time zone,
    status public.assignment_status DEFAULT 'DRAFT'::public.assignment_status,
    notes text
);


ALTER TABLE public.assignments OWNER TO abenton333;

--
-- Name: blue_book_entries; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.blue_book_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    builder_id uuid,
    community_id uuid,
    lot text,
    model_plan_id uuid,
    service_id uuid,
    po_number text,
    status public.blue_book_status DEFAULT 'PENDING'::public.blue_book_status,
    assignment_id uuid,
    ticket_id uuid,
    invoice_line_id uuid,
    amount numeric,
    check_number text,
    check_date date,
    check_total numeric,
    is_ach boolean DEFAULT false,
    account_category_code text,
    account_category_name text,
    start_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'scraped'::text,
    CONSTRAINT blue_book_entries_source_check CHECK ((source = ANY (ARRAY['scraped'::text, 'manual'::text])))
);


ALTER TABLE public.blue_book_entries OWNER TO abenton333;

--
-- Name: builders; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.builders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true
);


ALTER TABLE public.builders OWNER TO abenton333;

--
-- Name: communities; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.communities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    builder_id uuid,
    name text NOT NULL,
    city text,
    state text,
    lat text,
    lng text,
    active boolean DEFAULT true
);


ALTER TABLE public.communities OWNER TO abenton333;

--
-- Name: community_lots; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.community_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid,
    job_number text NOT NULL,
    lot_number text NOT NULL,
    address text,
    model text,
    status text DEFAULT 'active'::text,
    scraped_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.community_lots OWNER TO abenton333;

--
-- Name: contract_rates; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.contract_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    builder_id uuid,
    service_id uuid,
    model_plan_id uuid,
    basis text,
    rate numeric,
    unit_label text,
    effective_on date,
    expires_on date
);


ALTER TABLE public.contract_rates OWNER TO abenton333;

--
-- Name: crews; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.crews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    foreman_id uuid,
    skills text[],
    capacity_per_day integer
);


ALTER TABLE public.crews OWNER TO abenton333;

--
-- Name: dispatch_batches; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.dispatch_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_date date,
    status public.dispatch_status DEFAULT 'DRAFT'::public.dispatch_status,
    notes text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispatch_batches OWNER TO abenton333;

--
-- Name: field_tickets; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.field_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid,
    submitted_by_id uuid,
    submitted_at timestamp without time zone,
    status public.ticket_status DEFAULT 'DRAFT'::public.ticket_status,
    items json,
    notes text,
    customer_sig text,
    foreman_sig text,
    ticket_pdf_url text
);


ALTER TABLE public.field_tickets OWNER TO abenton333;

--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    blue_book_id uuid,
    description text,
    qty numeric,
    unit text,
    unit_price numeric,
    amount numeric
);


ALTER TABLE public.invoice_lines OWNER TO abenton333;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    builder_id uuid,
    po_number text,
    status public.invoice_status DEFAULT 'DRAFT'::public.invoice_status,
    issued_on date,
    due_on date,
    subtotal numeric,
    tax numeric,
    total numeric,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO abenton333;

--
-- Name: job_request_services; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.job_request_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_request_id uuid,
    service_id uuid,
    requested_data json,
    walk_time text,
    assigned_foreman_name text
);


ALTER TABLE public.job_request_services OWNER TO abenton333;

--
-- Name: job_requests; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.job_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_via text,
    requested_by text,
    contact_phone text,
    contact_email text,
    builder_id uuid,
    community_id uuid,
    lot text,
    address text,
    model_plan_id uuid,
    due_date date,
    notes text,
    po_number text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.job_requests OWNER TO abenton333;

--
-- Name: model_plans; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.model_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    builder_id uuid,
    code text,
    name text NOT NULL,
    sqft text,
    defaults json
);


ALTER TABLE public.model_plans OWNER TO abenton333;

--
-- Name: org_members; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.org_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.org_role DEFAULT 'contractor'::public.org_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.org_members OWNER TO abenton333;

--
-- Name: orgs; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orgs OWNER TO abenton333;

--
-- Name: service_logs; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.service_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    date date NOT NULL,
    project_name text,
    builder text,
    community text,
    address text,
    lot text,
    unit_lot text,
    service_type text,
    category text,
    status text,
    time_in time without time zone,
    time_out time without time zone,
    hours numeric(6,2),
    team text[],
    extras text,
    supervisor text,
    foreman text,
    crew_leader text,
    explain_work text,
    amount numeric(12,2),
    source text DEFAULT 'manual'::text NOT NULL,
    photos text[],
    external_id text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_logs OWNER TO abenton333;

--
-- Name: services; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    unit_kind public.unit_kind
);


ALTER TABLE public.services OWNER TO abenton333;

--
-- Name: sms_email_logs; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.sms_email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind public.log_kind,
    "to" text,
    body text,
    meta json,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sms_email_logs OWNER TO abenton333;

--
-- Name: users; Type: TABLE; Schema: public; Owner: abenton333
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    phone text,
    name text,
    role public.role DEFAULT 'CUSTOMER'::public.role NOT NULL,
    preferred_lang public.preferred_lang DEFAULT 'EN'::public.preferred_lang,
    password_hash text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    reset_token text,
    reset_token_expiry timestamp without time zone,
    preferred_contact_method text DEFAULT 'email'::text
);


ALTER TABLE public.users OWNER TO abenton333;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: abenton333
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: abenton333
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	b2812171f36f39b051f06eda11cf36f2b2e55e2d3ae5c8a81ed5701915bb0337	1762758676091
\.


--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.assignments (id, job_request_service_id, crew_id, dispatch_batch_id, scheduled_start, scheduled_end, status, notes) FROM stdin;
\.


--
-- Data for Name: blue_book_entries; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.blue_book_entries (id, builder_id, community_id, lot, model_plan_id, service_id, po_number, status, assignment_id, ticket_id, invoice_line_id, amount, check_number, check_date, check_total, is_ach, account_category_code, account_category_name, start_date, created_at, updated_at, source) FROM stdin;
4d5843ae-9205-435b-993a-061416baad83	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	13003	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055034-0000	COMPLETE	\N	\N	\N	403.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.242724	2025-11-16 09:11:48.836	scraped
7f9e962d-03b5-4e55-8029-28f08355a43b	64a145a6-bb10-42fe-a8d3-85946142d985	b54c2a8c-b6c5-4e68-9532-aeab7ff7d3ee	31900	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2052097-0000	COMPLETE	\N	\N	\N	347.00	3018	2025-10-17	138329.36	f	22714	Interior Clean	2025-10-09	2025-11-12 17:14:14.517257	2025-11-16 09:11:48.827	scraped
a6108b1f-2c97-490e-bc6b-aec272418af2	64a145a6-bb10-42fe-a8d3-85946142d985	2b5b357d-1d6d-4b6b-b5a3-f470b5318ff2	19806	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2052131-0000	COMPLETE	\N	\N	\N	303.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-24	2025-11-12 17:14:14.510064	2025-11-16 09:11:48.831	scraped
b2cb6d7d-f67c-4221-8081-0aed3da323de	64a145a6-bb10-42fe-a8d3-85946142d985	2b5b357d-1d6d-4b6b-b5a3-f470b5318ff2	15306	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2052125-0000	COMPLETE	\N	\N	\N	1282.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-15	2025-11-12 17:14:14.513285	2025-11-16 09:11:48.831	scraped
8437817d-c276-4f6d-a5ed-31fc9580c531	64a145a6-bb10-42fe-a8d3-85946142d985	5fcbf6e6-9afc-4c50-a0e2-27cb077f2874	05008	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2055057-0000	PENDING	\N	\N	\N	1753.00	3171	2025-10-31	54621.00	f	22702	Exterior Clean	2025-11-13	2025-11-11 16:54:29.23771	2025-12-17 23:24:08.736	scraped
7fc3fa78-7d26-4a1b-8916-900b900a2355	64a145a6-bb10-42fe-a8d3-85946142d985	5ad5df1b-2a8f-460e-86e8-0c6850d99a65	10900	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051522-0000	COMPLETE	\N	\N	\N	373.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-20	2025-11-12 17:14:14.521019	2025-11-16 09:11:48.854	scraped
6403381b-e6c9-42cd-a23f-d2dc5bb73ba8	64a145a6-bb10-42fe-a8d3-85946142d985	0133cbbd-4368-4600-bd28-781b5e44a705	00100	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055357-0000	COMPLETE	\N	\N	\N	398.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.194788	2025-11-16 09:11:48.844	scraped
e2f72b6c-d168-47ad-8e84-60658817ae5d	64a145a6-bb10-42fe-a8d3-85946142d985	0133cbbd-4368-4600-bd28-781b5e44a705	03600	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055068-0000	COMPLETE	\N	\N	\N	431.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-22	2025-11-11 16:54:29.233111	2025-11-16 09:11:48.844	scraped
97b631f5-3591-4b9d-82ba-2ecf3c6dbcb0	64a145a6-bb10-42fe-a8d3-85946142d985	9cc72172-57d4-45b2-9eb3-170f0464e063	20201	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055040-0000	COMPLETE	\N	\N	\N	226.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.240651	2025-11-16 09:11:48.839	scraped
c8ababdc-0a40-467b-9f14-17e5f7696e5f	64a145a6-bb10-42fe-a8d3-85946142d985	9cc72172-57d4-45b2-9eb3-170f0464e063	21001	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055330-0000	COMPLETE	\N	\N	\N	213.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-06	2025-11-11 16:54:29.201524	2025-11-16 09:11:48.839	scraped
084a10dc-5f5a-4bab-9377-a128d8db4d31	64a145a6-bb10-42fe-a8d3-85946142d985	a0badd33-ae88-406b-b0ae-be4aa34e0e11	24901	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055343-0000	COMPLETE	\N	\N	\N	323.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.198149	2025-11-16 09:11:48.841	scraped
a653ebb2-858b-431e-87e3-e3eaa5c37f40	64a145a6-bb10-42fe-a8d3-85946142d985	881180ff-e473-4809-9d9e-94cd041e5375	03400	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2051447-0000	PENDING	\N	\N	\N	595.00	3018	2025-10-17	138329.36	f	22714	Interior Clean	2025-11-17	2025-11-12 17:14:14.531424	2025-12-17 23:56:43.611	scraped
4e1df64e-c6d2-454d-a699-20b42ebc6e43	64a145a6-bb10-42fe-a8d3-85946142d985	18571187-20c0-429e-8584-6f5d81b9098f	03407	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055251-0000	COMPLETE	\N	\N	\N	378.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-22	2025-11-11 16:54:29.207444	2025-11-16 09:11:48.812	scraped
1144cf4c-984a-43cf-aadf-89efab75af01	64a145a6-bb10-42fe-a8d3-85946142d985	45a2c342-d07d-433f-94e5-512e3dc493d6	06508	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055170-0000	COMPLETE	\N	\N	\N	460.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.21858	2025-11-16 09:11:48.852	scraped
dad1e2e1-748d-4cf0-b98b-93d35c288263	64a145a6-bb10-42fe-a8d3-85946142d985	45a2c342-d07d-433f-94e5-512e3dc493d6	06208	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2052281-0000	COMPLETE	\N	\N	\N	441.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-10	2025-11-12 17:14:14.488362	2025-11-16 09:11:48.852	scraped
aa91d413-9777-444e-b4c4-6a80f28bff73	64a145a6-bb10-42fe-a8d3-85946142d985	45a2c342-d07d-433f-94e5-512e3dc493d6	06208	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055169-0000	COMPLETE	\N	\N	\N	441.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.221522	2025-11-16 09:11:48.852	scraped
95780f39-bb84-4b9f-aca5-47c12d46df67	64a145a6-bb10-42fe-a8d3-85946142d985	4fb36b6b-9822-4748-ad1d-412f813695c9	11009	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055106-0000	COMPLETE	\N	\N	\N	441.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-22	2025-11-11 16:54:29.226026	2025-11-16 09:11:48.847	scraped
38fd08fe-b9a0-46cf-8057-f699b1387efb	64a145a6-bb10-42fe-a8d3-85946142d985	881180ff-e473-4809-9d9e-94cd041e5375	01600	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2051440-0000	COMPLETE	\N	\N	\N	521.00	3018	2025-10-17	138329.36	f	22714	Interior Clean	2025-10-08	2025-11-12 17:14:14.534054	2025-11-16 09:11:48.845	scraped
df9f8004-bdaa-4642-9274-1704d6f9a216	64a145a6-bb10-42fe-a8d3-85946142d985	5ad5df1b-2a8f-460e-86e8-0c6850d99a65	10800	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051521-0000	COMPLETE	\N	\N	\N	390.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-17	2025-11-12 17:14:14.523577	2025-11-16 09:11:48.854	scraped
2ab489cf-149e-49e1-9be7-b6688d9f1b10	64a145a6-bb10-42fe-a8d3-85946142d985	4f2a4736-0756-458e-bea1-0d38c59e05db	07200	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2055189-0000	PENDING	\N	\N	\N	786.00	3171	2025-10-31	54621.00	f	22712	Interior Clean	2025-12-19	2025-11-11 16:54:29.215697	2025-12-18 01:21:17.266	scraped
00bfe756-93b6-4382-9b77-23f208f68edd	64a145a6-bb10-42fe-a8d3-85946142d985	76fa6f2f-c7a5-4951-b768-c8005ef5744f	06953	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055395-0000	COMPLETE	\N	\N	\N	373.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-30	2025-11-11 16:54:29.179552	2025-11-16 09:11:48.849	scraped
2154c743-408b-4950-886e-170768d86788	64a145a6-bb10-42fe-a8d3-85946142d985	76fa6f2f-c7a5-4951-b768-c8005ef5744f	06853	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055394-0000	COMPLETE	\N	\N	\N	346.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-29	2025-11-11 16:54:29.184405	2025-11-16 09:11:48.849	scraped
e29ecbad-217e-41b6-bc53-71e3ca6b19f8	64a145a6-bb10-42fe-a8d3-85946142d985	ca2dc799-63ed-425d-ac0a-ec8423d84014	01507	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2052262-0000	COMPLETE	\N	\N	\N	917.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-22	2025-11-12 17:14:14.494283	2025-11-16 09:11:48.85	scraped
b160e8cf-a8e4-4de7-8ae9-8b504839c42d	64a145a6-bb10-42fe-a8d3-85946142d985	4fb36b6b-9822-4748-ad1d-412f813695c9	10909	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055105-0000	COMPLETE	\N	\N	\N	453.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.228683	2025-11-16 09:11:48.847	scraped
437ce2d6-5b34-4205-b19d-c9e6e5a24389	64a145a6-bb10-42fe-a8d3-85946142d985	caae219a-11b9-44f3-9e54-d094dbfb7d31	01707	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2055277-0000	COMPLETE	\N	\N	\N	584.00	3171	2025-10-31	54621.00	f	22712	Interior Clean	2025-10-27	2025-11-11 16:54:29.204509	2025-11-16 09:11:48.834	scraped
3daf11a7-19e7-49bc-9197-c3e5fffdd153	64a145a6-bb10-42fe-a8d3-85946142d985	caae219a-11b9-44f3-9e54-d094dbfb7d31	01407	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2052138-0000	COMPLETE	\N	\N	\N	584.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-23	2025-11-12 17:14:14.503648	2025-11-16 09:11:48.834	scraped
e95e0c78-25c1-43a3-857e-46e493cfcc88	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	12503	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055033-0000	COMPLETE	\N	\N	\N	348.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-22	2025-11-11 16:54:29.245844	2025-11-16 09:11:48.836	scraped
92766b98-ede8-4273-aad8-0f22e4b288ec	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	12303	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055032-0000	COMPLETE	\N	\N	\N	338.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.248123	2025-11-16 09:11:48.836	scraped
2e2c0364-3a64-4589-a49e-ecc31e84f3dd	64a145a6-bb10-42fe-a8d3-85946142d985	4fb36b6b-9822-4748-ad1d-412f813695c9	10809	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055104-0000	COMPLETE	\N	\N	\N	460.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.231017	2025-11-16 09:11:48.847	scraped
d809e511-4e5d-421e-830a-f00522af4f62	64a145a6-bb10-42fe-a8d3-85946142d985	4fb36b6b-9822-4748-ad1d-412f813695c9	10809	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051459-0000	COMPLETE	\N	\N	\N	460.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-10	2025-11-12 17:14:14.52755	2025-11-16 09:11:48.847	scraped
0ababa7c-bfed-4da0-ab82-1b5d10f95f68	64a145a6-bb10-42fe-a8d3-85946142d985	ca2dc799-63ed-425d-ac0a-ec8423d84014	04907	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2055431-0000	COMPLETE	\N	\N	\N	304.00	3171	2025-10-31	54621.00	f	22712	Interior Clean	2025-10-27	2025-11-11 16:54:29.1728	2025-11-16 09:11:48.85	scraped
9d11d273-f380-41a2-912c-dbd57ceac320	64a145a6-bb10-42fe-a8d3-85946142d985	45a2c342-d07d-433f-94e5-512e3dc493d6	01008	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2055155-0000	COMPLETE	\N	\N	\N	453.00	3171	2025-10-31	54621.00	f	22712	Interior Clean	2025-10-28	2025-11-11 16:54:29.223861	2025-11-16 09:11:48.852	scraped
92f3faf6-a270-4659-9a62-2e21b12bafe6	64a145a6-bb10-42fe-a8d3-85946142d985	45a2c342-d07d-433f-94e5-512e3dc493d6	06508	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051506-0000	COMPLETE	\N	\N	\N	460.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-13	2025-11-12 17:14:14.525328	2025-11-16 09:11:48.852	scraped
f06102d0-0d90-400e-91c6-139746ce7209	64a145a6-bb10-42fe-a8d3-85946142d985	76613568-97d1-4d2e-af0b-437d52b20d13	03700	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051427-0000	COMPLETE	\N	\N	\N	345.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-09	2025-11-12 17:14:14.54208	2025-11-13 01:14:14.541	scraped
3bfd4219-a371-47cb-9f96-530ae6a09d75	64a145a6-bb10-42fe-a8d3-85946142d985	18571187-20c0-429e-8584-6f5d81b9098f	03007	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055250-0000	COMPLETE	\N	\N	\N	335.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-20	2025-11-11 16:54:29.210438	2025-11-16 09:11:48.812	scraped
2e24a231-2c8d-4880-906f-cd7e2f203e1a	64a145a6-bb10-42fe-a8d3-85946142d985	18571187-20c0-429e-8584-6f5d81b9098f	00802	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055248-0000	COMPLETE	\N	\N	\N	352.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.21292	2025-11-16 09:11:48.812	scraped
f3aeae39-8447-40d6-bc41-2808299511e2	64a145a6-bb10-42fe-a8d3-85946142d985	7e17d334-f779-4d4c-8c5f-71b4bb442385	02711	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2051300-0000	COMPLETE	\N	\N	\N	1324.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-13	2025-11-12 17:14:14.555595	2025-11-16 09:11:48.829	scraped
6b7a29fb-a43d-408f-8b01-e586f7aec127	64a145a6-bb10-42fe-a8d3-85946142d985	caae219a-11b9-44f3-9e54-d094dbfb7d31	00907	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2052134-0000	COMPLETE	\N	\N	\N	327.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-09	2025-11-12 17:14:14.506508	2025-11-16 09:11:48.834	scraped
3871d5b4-fbde-4ef1-b53d-dd130e6a2ca9	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	12203	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2055031-0000	COMPLETE	\N	\N	\N	348.00	3171	2025-10-31	54621.00	f	22712	Interior Clean	2025-10-22	2025-11-11 16:54:29.251014	2025-11-16 09:11:48.836	scraped
2f223528-8b1b-4dfe-bcaf-7fdbe3db0054	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	13303	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2052169-0000	COMPLETE	\N	\N	\N	338.00	3018	2025-10-17	138329.36	f	22714	Interior Clean	2025-10-10	2025-11-12 17:14:14.496798	2025-11-16 09:11:48.836	scraped
afaa5b31-d5c8-4b64-b5e8-a819261117d9	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	11803	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2052166-0000	COMPLETE	\N	\N	\N	1015.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-17	2025-11-12 17:14:14.499258	2025-11-16 09:11:48.836	scraped
6c0bda9b-b0ba-4421-b19b-f25be2371d1d	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	10603	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2052161-0000	COMPLETE	\N	\N	\N	348.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-15	2025-11-12 17:14:14.501472	2025-11-16 09:11:48.836	scraped
46295db5-392e-4a92-b961-1f0efaba2db8	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	13003	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051394-0000	COMPLETE	\N	\N	\N	403.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-13	2025-11-12 17:14:14.546447	2025-11-16 09:11:48.836	scraped
a8e22aac-ad0e-43c6-91f6-4660ddbaee4f	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	12503	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051393-0000	COMPLETE	\N	\N	\N	348.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-09	2025-11-12 17:14:14.548498	2025-11-16 09:11:48.836	scraped
eed50665-af4c-49f5-a62f-0412183b58f0	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	11703	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2051390-0000	COMPLETE	\N	\N	\N	1015.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-16	2025-11-12 17:14:14.550071	2025-11-16 09:11:48.836	scraped
81442875-d7a8-42ee-a523-05357a72a6ba	64a145a6-bb10-42fe-a8d3-85946142d985	b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	10103	\N	f3271918-918c-45aa-9993-e3fee69e7f54	2051379-0000	COMPLETE	\N	\N	\N	1015.00	3018	2025-10-17	138329.36	f	22702	Exterior Clean	2025-10-15	2025-11-12 17:14:14.552071	2025-11-16 09:11:48.836	scraped
c28bc576-91ff-43d6-a5dd-f37a7a389179	64a145a6-bb10-42fe-a8d3-85946142d985	9cc72172-57d4-45b2-9eb3-170f0464e063	19501	\N	d4a08102-a22a-4b85-bb45-f3a0e8276a78	2051400-0000	COMPLETE	\N	\N	\N	213.00	3018	2025-10-17	138329.36	f	22712	Interior Clean	2025-10-07	2025-11-12 17:14:14.544503	2025-11-16 09:11:48.839	scraped
e04dbdaf-8150-4455-a94f-5c572764628f	64a145a6-bb10-42fe-a8d3-85946142d985	0133cbbd-4368-4600-bd28-781b5e44a705	01200	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2051434-0000	COMPLETE	\N	\N	\N	398.00	3018	2025-10-17	138329.36	f	22714	Interior Clean	2025-10-09	2025-11-12 17:14:14.536209	2025-11-16 09:11:48.844	scraped
755048a6-6da8-4cd1-8220-2696dda4f1cd	64a145a6-bb10-42fe-a8d3-85946142d985	ca2dc799-63ed-425d-ac0a-ec8423d84014	05407	\N	03e1e8fe-c035-4d16-85e0-990e837b617a	2055433-0000	COMPLETE	\N	\N	\N	447.00	3171	2025-10-31	54621.00	f	22714	Interior Clean	2025-10-23	2025-11-11 16:54:29.09305	2025-11-16 09:11:48.85	scraped
\.


--
-- Data for Name: builders; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.builders (id, name, active) FROM stdin;
772345c1-3158-44d3-97e3-717569036833	Default Builder	t
64a145a6-bb10-42fe-a8d3-85946142d985	Pulte	t
\.


--
-- Data for Name: communities; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.communities (id, builder_id, name, city, state, lat, lng, active) FROM stdin;
02180e49-9d92-4d56-92b0-881982898ba9	772345c1-3158-44d3-97e3-717569036833	Sunset Hills	Las Vegas	NV	\N	\N	t
89da6433-2b70-4203-b9ff-b31f44e8bbd8	\N	Sunset Hills	Las Vegas	NV	\N	\N	t
94ee1bd6-1462-4343-a92b-366acfb9c985	64a145a6-bb10-42fe-a8d3-85946142d985	Brantley KL - 3500	\N	\N	\N	\N	t
5ad5df1b-2a8f-460e-86e8-0c6850d99a65	64a145a6-bb10-42fe-a8d3-85946142d985	Brantley KL - 4500	\N	\N	\N	\N	t
4f2a4736-0756-458e-bea1-0d38c59e05db	64a145a6-bb10-42fe-a8d3-85946142d985	Brantley KL - 5500	\N	\N	\N	\N	t
e779d8ac-c8ff-41ec-a191-ace184d55ba2	64a145a6-bb10-42fe-a8d3-85946142d985	Caprock - 5500s	\N	\N	\N	\N	t
ef3b6e42-50c0-4b45-a85e-07147d55f1b5	64a145a6-bb10-42fe-a8d3-85946142d985	Daylight at Cameron - 50/70	\N	\N	\N	\N	t
274366df-f253-408d-997e-c0dd9b9aa4b5	64a145a6-bb10-42fe-a8d3-85946142d985	Daylight at Warm Spring -50/70	\N	\N	\N	\N	t
ce5f0739-e7d5-47be-b4ee-c1a7b487fafe	64a145a6-bb10-42fe-a8d3-85946142d985	Delamar	\N	\N	\N	\N	t
538a8f6a-f615-4d35-82a0-4e0404179ede	64a145a6-bb10-42fe-a8d3-85946142d985	Delamar at Polaris - 3600	\N	\N	\N	\N	t
e06ff6ae-71e3-44d9-9ea4-df7c213c2ac4	64a145a6-bb10-42fe-a8d3-85946142d985	DW Lake Las Vegas S1-4000	\N	\N	\N	\N	t
7904cf9e-b646-4c4d-b688-5e6d2b00c8d7	64a145a6-bb10-42fe-a8d3-85946142d985	DW Lake Las Vegas S2-4500	\N	\N	\N	\N	t
b54c2a8c-b6c5-4e68-9532-aeab7ff7d3ee	64a145a6-bb10-42fe-a8d3-85946142d985	DW Lake Las Vegas S3-5400	\N	\N	\N	\N	t
9cc72172-57d4-45b2-9eb3-170f0464e063	64a145a6-bb10-42fe-a8d3-85946142d985	DW LLV C2-3000	\N	\N	\N	\N	t
a0badd33-ae88-406b-b0ae-be4aa34e0e11	64a145a6-bb10-42fe-a8d3-85946142d985	DW LLV C2-4500	\N	\N	\N	\N	t
caba9351-11e3-4339-997b-540b9d3c9a1c	64a145a6-bb10-42fe-a8d3-85946142d985	DW LLV M5-5400	\N	\N	\N	\N	t
7de8a78c-b00e-4387-97b5-23fca5abc8c1	64a145a6-bb10-42fe-a8d3-85946142d985	Hayford at Polaris - 4500	\N	\N	\N	\N	t
caae219a-11b9-44f3-9e54-d094dbfb7d31	64a145a6-bb10-42fe-a8d3-85946142d985	Hayford Collection	\N	\N	\N	\N	t
4ae7a5cf-462f-41af-8f37-dc5d5df2426d	64a145a6-bb10-42fe-a8d3-85946142d985	Incline - 4500s	\N	\N	\N	\N	t
0133cbbd-4368-4600-bd28-781b5e44a705	64a145a6-bb10-42fe-a8d3-85946142d985	Incline - 5500s	\N	\N	\N	\N	t
605acd77-450f-4597-bdfd-77fe3dd5f259	64a145a6-bb10-42fe-a8d3-85946142d985	Liberty Ct 8 - 3600	\N	\N	\N	\N	t
5fcbf6e6-9afc-4c50-a0e2-27cb077f2874	64a145a6-bb10-42fe-a8d3-85946142d985	Liberty Ct 8 - 4500	\N	\N	\N	\N	t
4c680d7d-4f2a-4fd3-a13d-0caddfc7e271	64a145a6-bb10-42fe-a8d3-85946142d985	Liberty Ct 8 - 5500	\N	\N	\N	\N	t
1a561a05-778a-4af7-82b5-4c284039909f	64a145a6-bb10-42fe-a8d3-85946142d985	Liberty-3600	\N	\N	\N	\N	t
45a2c342-d07d-433f-94e5-512e3dc493d6	64a145a6-bb10-42fe-a8d3-85946142d985	Luxury at Russell - 3600	\N	\N	\N	\N	t
4fb36b6b-9822-4748-ad1d-412f813695c9	64a145a6-bb10-42fe-a8d3-85946142d985	Luxury at Warm Springs - 3600	\N	\N	\N	\N	t
18571187-20c0-429e-8584-6f5d81b9098f	64a145a6-bb10-42fe-a8d3-85946142d985	Monument at Reverence	\N	\N	\N	\N	t
ca2dc799-63ed-425d-ac0a-ec8423d84014	64a145a6-bb10-42fe-a8d3-85946142d985	Paldona at Buffalo - 3000	\N	\N	\N	\N	t
ee4272f1-db4f-41ff-a373-a960f37d3ecf	64a145a6-bb10-42fe-a8d3-85946142d985	Paldona at Cimarron - 3000	\N	\N	\N	\N	t
346eb96f-4a26-4174-81f9-215e4b1bb295	64a145a6-bb10-42fe-a8d3-85946142d985	Paldona at Warm Springs - 3000	\N	\N	\N	\N	t
b84d2613-3d37-4b8b-8d77-a2ddef2a5f89	64a145a6-bb10-42fe-a8d3-85946142d985	Quinn Canyon	\N	\N	\N	\N	t
7e17d334-f779-4d4c-8c5f-71b4bb442385	64a145a6-bb10-42fe-a8d3-85946142d985	Rainbow Crossing Luxury-3600	\N	\N	\N	\N	t
fc466777-e4e6-4898-89be-f3f53503cde7	64a145a6-bb10-42fe-a8d3-85946142d985	SCM North- 4200s/4500s	\N	\N	\N	\N	t
db97cb2c-cbbb-4d9a-a19e-9f6e2c7bcadf	64a145a6-bb10-42fe-a8d3-85946142d985	SCM North- 5400s	\N	\N	\N	\N	t
8ea223fb-d4d5-4d38-9869-ec346e83d01b	64a145a6-bb10-42fe-a8d3-85946142d985	SCM North-3000s	\N	\N	\N	\N	t
f12f00f1-b98b-4587-89bc-772c49cbcc0c	64a145a6-bb10-42fe-a8d3-85946142d985	Suntero-4500	\N	\N	\N	\N	t
76fa6f2f-c7a5-4951-b768-c8005ef5744f	64a145a6-bb10-42fe-a8d3-85946142d985	Tenaya Spring at Cimarron-2500	\N	\N	\N	\N	t
881180ff-e473-4809-9d9e-94cd041e5375	64a145a6-bb10-42fe-a8d3-85946142d985	The Pointe - 7000s	\N	\N	\N	\N	t
2b5b357d-1d6d-4b6b-b5a3-f470b5318ff2	64a145a6-bb10-42fe-a8d3-85946142d985	Wesley Park	\N	\N	\N	\N	t
76613568-97d1-4d2e-af0b-437d52b20d13	64a145a6-bb10-42fe-a8d3-85946142d985	8100	\N	\N	\N	\N	t
\.


--
-- Data for Name: community_lots; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.community_lots (id, community_id, job_number, lot_number, address, model, status, scraped_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contract_rates; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.contract_rates (id, builder_id, service_id, model_plan_id, basis, rate, unit_label, effective_on, expires_on) FROM stdin;
\.


--
-- Data for Name: crews; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.crews (id, name, foreman_id, skills, capacity_per_day) FROM stdin;
3e21969a-80d0-4048-a826-8d538da8056d	Carmen	\N	\N	\N
14858a0f-eaf1-4fee-becc-1f659747bd79	Luis D	\N	\N	\N
f78f628a-c194-4fbe-beb1-d636762a4c5a	Alan	\N	\N	\N
558750c5-c2e1-4b8d-a2e9-50f13df7a872	Antonio M	\N	\N	\N
73f33312-688b-4202-bc0f-8a8f96283ce5	Alfonso	\N	\N	\N
d080a3ab-204a-417f-8e4d-8114733e1d09	Adriana	\N	\N	\N
\.


--
-- Data for Name: dispatch_batches; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.dispatch_batches (id, service_date, status, notes, created_by_id, created_at) FROM stdin;
f5323b2d-112d-4ef3-aaee-79ab1a2c0cd5	2025-12-18	SENT	\N	\N	2025-12-17 17:16:16.105721
07fe74c2-6f17-4501-967b-baa2b37dbedd	2025-12-18	SENT	\N	\N	2025-12-17 17:21:09.606247
\.


--
-- Data for Name: field_tickets; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.field_tickets (id, assignment_id, submitted_by_id, submitted_at, status, items, notes, customer_sig, foreman_sig, ticket_pdf_url) FROM stdin;
\.


--
-- Data for Name: invoice_lines; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.invoice_lines (id, invoice_id, blue_book_id, description, qty, unit, unit_price, amount) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.invoices (id, builder_id, po_number, status, issued_on, due_on, subtotal, tax, total, created_at) FROM stdin;
\.


--
-- Data for Name: job_request_services; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.job_request_services (id, job_request_id, service_id, requested_data, walk_time, assigned_foreman_name) FROM stdin;
98e8c8b8-a322-40e6-bc06-2818c43502c1	99bd8af1-dfd4-4e5c-b193-ad3a20a8506a	63a12015-d613-487e-a9cf-d7e6f7dbe83e	\N	\N	\N
83c4b6d2-c7ff-49a8-9cce-86895313c4af	9c84d2d5-6393-40b6-82f2-6089af5a89bf	63a12015-d613-487e-a9cf-d7e6f7dbe83e	\N	\N	\N
53fc1778-44b3-4156-8a42-67ddfdae9909	0f0ead22-7f3d-4c7e-87b6-e8939441ee47	2de5c71e-9af9-4b8a-a283-d7719d3c6647	\N	22:19	\N
\.


--
-- Data for Name: job_requests; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.job_requests (id, received_via, requested_by, contact_phone, contact_email, builder_id, community_id, lot, address, model_plan_id, due_date, notes, po_number, created_by_id, created_at) FROM stdin;
99bd8af1-dfd4-4e5c-b193-ad3a20a8506a	\N	Test	\N	\N	772345c1-3158-44d3-97e3-717569036833	02180e49-9d92-4d56-92b0-881982898ba9	TEST-LOT	123 Test St	b59b18f0-da28-4024-a48d-9ec757f69ecf	2025-11-14	CLI test	\N	\N	2025-11-14 15:44:31.288149
9c84d2d5-6393-40b6-82f2-6089af5a89bf	\N	Test	\N	\N	772345c1-3158-44d3-97e3-717569036833	02180e49-9d92-4d56-92b0-881982898ba9	TEST-LOT	123 Test St	b59b18f0-da28-4024-a48d-9ec757f69ecf	2025-11-14	CLI test	\N	\N	2025-11-14 15:49:45.553241
0f0ead22-7f3d-4c7e-87b6-e8939441ee47	app	Anahi	iam@theony.com	\N	64a145a6-bb10-42fe-a8d3-85946142d985	02180e49-9d92-4d56-92b0-881982898ba9	8		\N	2025-11-17	test		3feadc8b-8b51-474e-b016-f12b89cf6f1b	2025-11-14 20:19:55.238794
\.


--
-- Data for Name: model_plans; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.model_plans (id, builder_id, code, name, sqft, defaults) FROM stdin;
b59b18f0-da28-4024-a48d-9ec757f69ecf	772345c1-3158-44d3-97e3-717569036833	M-100	Plan 100	1800	\N
710930fc-d349-4b09-8b41-2a5169b13212	\N	M-100	Plan 100	1800	\N
\.


--
-- Data for Name: org_members; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.org_members (id, org_id, user_id, role, created_at) FROM stdin;
b5c6d31a-ab4c-458a-9629-a39870318fc6	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	3feadc8b-8b51-474e-b016-f12b89cf6f1b	admin	2025-11-10 00:01:48.766488
1e29954e-d4f0-4712-a0ae-b44b59f37434	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	3c28f2d1-e9e9-417b-87dc-7949c8d5530f	contractor	2025-11-16 17:56:54.10201
1cc7634d-ee02-4164-a6fc-0b87fc4ef76a	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	6651bda1-75f7-4674-bb57-45c2bffbc220	contractor	2025-12-17 17:01:51.757585
0864fba2-567c-4f23-b4a2-6db24a5b7e81	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	b485130a-776a-4940-a6ad-2f9e82a1b351	contractor	2025-12-17 17:01:51.757585
e96f0c0f-df0e-429a-a4ec-617e16025730	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	5bd09327-f7d7-4c2b-bcc9-c5ec1566ebc4	contractor	2025-12-17 17:01:51.757585
0b27a7e7-f250-4083-88e1-133b29ad927e	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	ed59bcae-115f-4f89-8543-d777578b932d	contractor	2025-12-17 17:01:51.757585
3d8b10e6-d1eb-4ef2-9651-982a20fcf3dc	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	a1c005c3-f0d2-4ac2-a311-695a0fa2c586	contractor	2025-12-17 17:01:51.757585
\.


--
-- Data for Name: orgs; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.orgs (id, name, slug, created_at, updated_at) FROM stdin;
ded38a64-c228-4870-aa0a-f1ffa0fcc7af	Lunas	lunas	2025-11-09 23:58:13.934105	2025-11-09 23:58:13.934105
4096b6d7-a400-4969-b92c-738699224bdf	Pulte	pulte	2025-11-15 22:12:21.050637	2025-11-15 22:12:21.050637
\.


--
-- Data for Name: service_logs; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.service_logs (id, org_id, date, project_name, builder, community, address, lot, unit_lot, service_type, category, status, time_in, time_out, hours, team, extras, supervisor, foreman, crew_leader, explain_work, amount, source, photos, external_id, created_by, created_at, updated_at) FROM stdin;
b1269b93-d14d-4d4a-8556-1ba8c4df3dac	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	2025-11-16	db	Pulte	Delamar		102		Rough Clean			20:51:00	22:51:00	2.00	\N						20.00	manual	\N	\N	3feadc8b-8b51-474e-b016-f12b89cf6f1b	2025-11-15 20:51:29.705138	2025-11-15 20:51:29.705138
3eac7115-6c64-4de8-bcea-a571ef642614	ded38a64-c228-4870-aa0a-f1ffa0fcc7af	2025-11-16	ff	Pulte	DW Lake Las Vegas S1-4000				Final Clean			\N	\N	0.00	\N						0.00	manual	\N	\N	3feadc8b-8b51-474e-b016-f12b89cf6f1b	2025-11-15 20:53:50.186818	2025-11-15 20:53:50.186818
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.services (id, code, name, category, unit_kind) FROM stdin;
63a12015-d613-487e-a9cf-d7e6f7dbe83e	CLEAN_ROUGH	Rough Clean	cleanup	PER_UNIT
48567101-70b0-41e7-9cce-78583f9d5350	CLEAN_FINAL	Final Clean	cleanup	PER_UNIT
c2d986ee-9faa-424f-ba2b-586789f24dbe	CLEAN_DETAIL	Detail / Punch Clean	cleanup	PER_UNIT
2de5c71e-9af9-4b8a-a283-d7719d3c6647	CLEAN_EXTRAS	Extras / Misc	cleanup	PER_UNIT
9369c30d-91e7-497b-a858-5daa2b43a15e	CLEAN_WINDOWS_INT	Window Cleaning (Interior)	cleanup	PER_UNIT
73ac193b-4f31-4dd3-aa50-e38cb4fc1b7d	CLEAN_WINDOWS_EXT	Window Cleaning (Exterior)	cleanup	PER_UNIT
12071fc9-6a41-4b23-96de-8ffe0d31255a	CLEAN_BATH_TUBS	Tub/Shower Polish & Detail	cleanup	PER_UNIT
b55b64c4-e537-4198-8ee6-df1a0caafbaa	CLEAN_APPLIANCES	Appliance Detail	cleanup	PER_UNIT
93eabf91-bbe4-4665-a5ec-9d4f69775a85	CLEAN_TRASH_HAUL	Trash / Debris Haul-Off	cleanup	PER_UNIT
e70128ad-28e7-471e-a769-68d99c3f4a27	POWER_WASH_DRIVE	Power Wash (Driveway/Garage)	power-wash	PER_UNIT
440c241b-b397-460b-ad0f-81abea799cdb	POWER_WASH_EXT	Power Wash (Exterior Siding/Walks)	power-wash	PER_UNIT
676aa0e2-d9fd-4e74-96b5-557a614a5f45	CLEAN_WINDOWS_ALL	Window Cleaning (In/Out)	cleanup	PER_UNIT
03e1e8fe-c035-4d16-85e0-990e837b617a	22714	Interior Clean	\N	PER_JOB
d4a08102-a22a-4b85-bb45-f3a0e8276a78	22712	Interior Clean	\N	PER_JOB
f3271918-918c-45aa-9993-e3fee69e7f54	22702	Exterior Clean	\N	PER_JOB
\.


--
-- Data for Name: sms_email_logs; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.sms_email_logs (id, kind, "to", body, meta, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: abenton333
--

COPY public.users (id, email, phone, name, role, preferred_lang, password_hash, created_at, updated_at, reset_token, reset_token_expiry, preferred_contact_method) FROM stdin;
3c28f2d1-e9e9-417b-87dc-7949c8d5530f	iam@thetonyb.com	\N	TB	CUSTOMER	EN	$2b$10$j6nWZ83sT2YoKWhMQqiRC.yvpqZdOlvIq4xa3O52Ca6iM2N0PF51K	2025-11-16 16:37:57.236234	2025-11-16 16:37:57.236234	\N	\N	email
3feadc8b-8b51-474e-b016-f12b89cf6f1b	admin@lunas.local	\N	admin	ADMIN	EN	$2b$10$ngn5PKXOx2yZdWJXa3cHCua09OB/gFqBLN3FyXHE9rZEJvNJlkc5i	2025-11-09 23:58:14.005216	2025-11-09 23:58:14.005216	\N	\N	email
6651bda1-75f7-4674-bb57-45c2bffbc220	anahi@lunas.local	\N	Anahi	FOREMAN	EN	$2b$10$p6R6l2ymthwfcpnVU/wH2e/k.rVqCjbDwYUSvsW/wmKYpIKuIjvFy	2025-12-17 16:05:36.133708	2025-12-17 16:05:36.133708	\N	\N	email
b485130a-776a-4940-a6ad-2f9e82a1b351	blanca@lunas.local	\N	Blanca	FOREMAN	EN	$2b$10$p6R6l2ymthwfcpnVU/wH2e/k.rVqCjbDwYUSvsW/wmKYpIKuIjvFy	2025-12-17 16:05:36.133708	2025-12-17 16:05:36.133708	\N	\N	email
5bd09327-f7d7-4c2b-bcc9-c5ec1566ebc4	chayo@lunas.local	\N	Chayo	FOREMAN	EN	$2b$10$p6R6l2ymthwfcpnVU/wH2e/k.rVqCjbDwYUSvsW/wmKYpIKuIjvFy	2025-12-17 16:05:36.133708	2025-12-17 16:05:36.133708	\N	\N	email
ed59bcae-115f-4f89-8543-d777578b932d	francisco@lunas.local	\N	Francisco	FOREMAN	EN	$2b$10$p6R6l2ymthwfcpnVU/wH2e/k.rVqCjbDwYUSvsW/wmKYpIKuIjvFy	2025-12-17 16:05:36.133708	2025-12-17 16:05:36.133708	\N	\N	email
a1c005c3-f0d2-4ac2-a311-695a0fa2c586	raudel@lunas.local	\N	Raudel	FOREMAN	EN	$2b$10$p6R6l2ymthwfcpnVU/wH2e/k.rVqCjbDwYUSvsW/wmKYpIKuIjvFy	2025-12-17 16:05:36.133708	2025-12-17 16:05:36.133708	\N	\N	email
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: abenton333
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: abenton333
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: blue_book_entries blue_book_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_pkey PRIMARY KEY (id);


--
-- Name: model_plans builder_id_code_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.model_plans
    ADD CONSTRAINT builder_id_code_unique UNIQUE (builder_id, code);


--
-- Name: communities builder_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT builder_id_name_unique UNIQUE (builder_id, name);


--
-- Name: builders builders_name_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.builders
    ADD CONSTRAINT builders_name_unique UNIQUE (name);


--
-- Name: builders builders_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.builders
    ADD CONSTRAINT builders_pkey PRIMARY KEY (id);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: community_lots community_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.community_lots
    ADD CONSTRAINT community_lots_pkey PRIMARY KEY (id);


--
-- Name: contract_rates contract_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.contract_rates
    ADD CONSTRAINT contract_rates_pkey PRIMARY KEY (id);


--
-- Name: crews crews_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_pkey PRIMARY KEY (id);


--
-- Name: dispatch_batches dispatch_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.dispatch_batches
    ADD CONSTRAINT dispatch_batches_pkey PRIMARY KEY (id);


--
-- Name: field_tickets field_tickets_assignment_id_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.field_tickets
    ADD CONSTRAINT field_tickets_assignment_id_unique UNIQUE (assignment_id);


--
-- Name: field_tickets field_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.field_tickets
    ADD CONSTRAINT field_tickets_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_request_services job_request_services_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_request_services
    ADD CONSTRAINT job_request_services_pkey PRIMARY KEY (id);


--
-- Name: job_requests job_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_pkey PRIMARY KEY (id);


--
-- Name: model_plans model_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.model_plans
    ADD CONSTRAINT model_plans_pkey PRIMARY KEY (id);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: orgs orgs_slug_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_slug_unique UNIQUE (slug);


--
-- Name: service_logs service_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.service_logs
    ADD CONSTRAINT service_logs_pkey PRIMARY KEY (id);


--
-- Name: services services_code_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_code_unique UNIQUE (code);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: sms_email_logs sms_email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.sms_email_logs
    ADD CONSTRAINT sms_email_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: org_members_org_user_key; Type: INDEX; Schema: public; Owner: abenton333
--

CREATE UNIQUE INDEX org_members_org_user_key ON public.org_members USING btree (org_id, user_id);


--
-- Name: service_logs_org_date_idx; Type: INDEX; Schema: public; Owner: abenton333
--

CREATE INDEX service_logs_org_date_idx ON public.service_logs USING btree (org_id, date);


--
-- Name: service_logs_org_external_idx; Type: INDEX; Schema: public; Owner: abenton333
--

CREATE UNIQUE INDEX service_logs_org_external_idx ON public.service_logs USING btree (org_id, external_id);


--
-- Name: assignments assignments_crew_id_crews_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_crew_id_crews_id_fk FOREIGN KEY (crew_id) REFERENCES public.crews(id);


--
-- Name: assignments assignments_dispatch_batch_id_dispatch_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_dispatch_batch_id_dispatch_batches_id_fk FOREIGN KEY (dispatch_batch_id) REFERENCES public.dispatch_batches(id);


--
-- Name: assignments assignments_job_request_service_id_job_request_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_job_request_service_id_job_request_services_id_fk FOREIGN KEY (job_request_service_id) REFERENCES public.job_request_services(id);


--
-- Name: blue_book_entries blue_book_entries_assignment_id_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_assignment_id_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.assignments(id);


--
-- Name: blue_book_entries blue_book_entries_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: blue_book_entries blue_book_entries_community_id_communities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_community_id_communities_id_fk FOREIGN KEY (community_id) REFERENCES public.communities(id);


--
-- Name: blue_book_entries blue_book_entries_invoice_line_id_invoice_lines_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_invoice_line_id_invoice_lines_id_fk FOREIGN KEY (invoice_line_id) REFERENCES public.invoice_lines(id);


--
-- Name: blue_book_entries blue_book_entries_model_plan_id_model_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_model_plan_id_model_plans_id_fk FOREIGN KEY (model_plan_id) REFERENCES public.model_plans(id);


--
-- Name: blue_book_entries blue_book_entries_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: blue_book_entries blue_book_entries_ticket_id_field_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.blue_book_entries
    ADD CONSTRAINT blue_book_entries_ticket_id_field_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.field_tickets(id);


--
-- Name: communities communities_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: community_lots community_lots_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.community_lots
    ADD CONSTRAINT community_lots_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id);


--
-- Name: contract_rates contract_rates_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.contract_rates
    ADD CONSTRAINT contract_rates_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: contract_rates contract_rates_model_plan_id_model_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.contract_rates
    ADD CONSTRAINT contract_rates_model_plan_id_model_plans_id_fk FOREIGN KEY (model_plan_id) REFERENCES public.model_plans(id);


--
-- Name: contract_rates contract_rates_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.contract_rates
    ADD CONSTRAINT contract_rates_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: crews crews_foreman_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_foreman_id_users_id_fk FOREIGN KEY (foreman_id) REFERENCES public.users(id);


--
-- Name: dispatch_batches dispatch_batches_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.dispatch_batches
    ADD CONSTRAINT dispatch_batches_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: field_tickets field_tickets_assignment_id_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.field_tickets
    ADD CONSTRAINT field_tickets_assignment_id_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.assignments(id);


--
-- Name: field_tickets field_tickets_submitted_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.field_tickets
    ADD CONSTRAINT field_tickets_submitted_by_id_users_id_fk FOREIGN KEY (submitted_by_id) REFERENCES public.users(id);


--
-- Name: invoice_lines invoice_lines_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: invoices invoices_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: job_request_services job_request_services_job_request_id_job_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_request_services
    ADD CONSTRAINT job_request_services_job_request_id_job_requests_id_fk FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id);


--
-- Name: job_request_services job_request_services_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_request_services
    ADD CONSTRAINT job_request_services_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: job_requests job_requests_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: job_requests job_requests_community_id_communities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_community_id_communities_id_fk FOREIGN KEY (community_id) REFERENCES public.communities(id);


--
-- Name: job_requests job_requests_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: job_requests job_requests_model_plan_id_model_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.job_requests
    ADD CONSTRAINT job_requests_model_plan_id_model_plans_id_fk FOREIGN KEY (model_plan_id) REFERENCES public.model_plans(id);


--
-- Name: model_plans model_plans_builder_id_builders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.model_plans
    ADD CONSTRAINT model_plans_builder_id_builders_id_fk FOREIGN KEY (builder_id) REFERENCES public.builders(id);


--
-- Name: org_members org_members_org_id_orgs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_id_orgs_id_fk FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_logs service_logs_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.service_logs
    ADD CONSTRAINT service_logs_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: service_logs service_logs_org_id_orgs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: abenton333
--

ALTER TABLE ONLY public.service_logs
    ADD CONSTRAINT service_logs_org_id_orgs_id_fk FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict SpvKBr4nF6YKHPQLKxhj1gwqLFmLY0qgw5Ag6J7NpbsIgwEPoZeEeiLjiwtRuzR

