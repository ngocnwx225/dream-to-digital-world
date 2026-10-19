
create type public.app_role as enum ('admin');
create type public.doc_status as enum ('completed','cancelled');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public
as $$ select public.has_role(auth.uid(),'admin') $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

-- owner_exists for setup flow
create or replace function public.owner_exists() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.user_roles where role='admin') $$;
grant execute on function public.owner_exists() to anon, authenticated;

-- block extra signups; first user becomes owner
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if exists(select 1 from public.user_roles where role='admin') then
    raise exception 'Đăng ký đã bị khóa. Hệ thống chỉ có một chủ cửa hàng.';
  end if;
  insert into public.user_roles(user_id, role) values (new.id, 'admin');
  insert into public.profiles(id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table public.settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'StoreFlow',
  default_low_stock numeric(14,3) not null default 5,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
insert into public.settings(id) values (1);

create sequence public.product_code_seq;
create sequence public.customer_code_seq;
create sequence public.purchase_code_seq;
create sequence public.sale_code_seq;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('SP' || lpad(nextval('public.product_code_seq')::text, 4, '0')),
  name text not null check (length(trim(name)) > 0),
  unit text not null default 'Cái',
  sale_price numeric(14,3) not null check (sale_price >= 0),
  low_stock_threshold numeric(14,3),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('KH' || lpad(nextval('public.customer_code_seq')::text, 4, '0')),
  name text not null check (length(trim(name)) > 0),
  phone text, vehicle_name text, plate text, note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('PN' || lpad(nextval('public.purchase_code_seq')::text, 6, '0')),
  receipt_date date not null default current_date,
  note text,
  status doc_status not null default 'completed',
  cancel_reason text,
  total_qty numeric(14,3) not null default 0,
  total_amount numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(18,6) not null check (unit_cost >= 0),
  amount numeric(14,3) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index on public.purchase_items(product_id);
create index on public.purchase_items(receipt_id);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('DB' || lpad(nextval('public.sale_code_seq')::text, 6, '0')),
  order_date date not null default current_date,
  customer_id uuid references public.customers(id),
  customer_name text, phone text, plate text, vehicle_name text, note text,
  status doc_status not null default 'completed',
  cancel_reason text,
  total_qty numeric(14,3) not null default 0,
  total_amount numeric(14,3) not null default 0,
  total_cost numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.sales_orders(order_date);
create index on public.sales_orders(customer_id);
create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,3) not null check (unit_price >= 0),
  amount numeric(14,3) not null,
  unit_cost numeric(18,6) not null default 0,
  cost_amount numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.sales_order_items(product_id);
create index on public.sales_order_items(order_id);

create table public.inventory_opening_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id),
  opening_date date not null default current_date,
  quantity numeric(14,3) not null check (quantity >= 0),
  unit_cost numeric(18,6) not null check (unit_cost >= 0),
  amount numeric(14,3) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_date date not null,
  seq int not null,
  movement_type text not null check (movement_type in ('opening','purchase','sale')),
  doc_code text,
  ref_id uuid,
  qty_change numeric(14,3) not null,
  qty_after numeric(14,3) not null,
  unit_cost numeric(18,6),
  avg_cost_after numeric(18,6) not null,
  value_after numeric(14,3) not null,
  created_at timestamptz not null default now()
);
create index on public.inventory_movements(product_id, seq);

create table public.inventory_balances (
  product_id uuid primary key references public.products(id),
  quantity numeric(14,3) not null default 0,
  avg_cost numeric(18,6) not null default 0,
  value numeric(14,3) not null default 0,
  total_in numeric(14,3) not null default 0,
  total_out numeric(14,3) not null default 0,
  opening_qty numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['settings','products','customers','purchase_receipts','sales_orders','inventory_opening_balances'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['settings','products','customers','purchase_receipts','purchase_items','sales_orders','sales_order_items','inventory_opening_balances','inventory_movements','inventory_balances','audit_logs'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner read" on public.%I for select to authenticated using (public.is_owner())', t);
  end loop;
  -- direct writes only for master data; transactions go through functions
  foreach t in array array['settings','products','customers'] loop
    execute format('grant insert, update on public.%I to authenticated', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated with check (public.is_owner())', t);
    execute format('create policy "owner update" on public.%I for update to authenticated using (public.is_owner())', t);
  end loop;
end $$;

-- Replay all valid movements for a product (moving weighted average)
create or replace function public.recalc_product(p_product uuid) returns void
language plpgsql security definer set search_path=public as $$
declare
  r record; q numeric := 0; v numeric := 0; avgc numeric := 0; s int := 0;
  cost numeric; tin numeric := 0; tout numeric := 0; oq numeric := 0; pname text;
begin
  select name into pname from products where id = p_product;
  delete from inventory_movements where product_id = p_product;
  for r in
    select * from (
      select 0 as kind, o.opening_date as d, o.created_at as c, o.id as item_id, o.id as ref_id, 'Tồn đầu'::text as code, o.quantity as qty, o.amount as amt, o.unit_cost as uc
        from inventory_opening_balances o where o.product_id = p_product
      union all
      select 1, pr.receipt_date, pr.created_at, pi.id, pr.id, pr.code, pi.quantity, pi.amount, pi.unit_cost
        from purchase_items pi join purchase_receipts pr on pr.id = pi.receipt_id
        where pi.product_id = p_product and pr.status = 'completed'
      union all
      select 2, so.order_date, so.created_at, si.id, so.id, so.code, si.quantity, si.amount, null
        from sales_order_items si join sales_orders so on so.id = si.order_id
        where si.product_id = p_product and so.status = 'completed'
    ) x order by d, kind, c, item_id
  loop
    s := s + 1;
    if r.kind in (0,1) then
      q := q + r.qty; v := v + r.amt;
      if r.kind = 0 then oq := oq + r.qty; else tin := tin + r.qty; end if;
      avgc := case when q > 0 then v / q else 0 end;
      insert into inventory_movements(product_id, movement_date, seq, movement_type, doc_code, ref_id, qty_change, qty_after, unit_cost, avg_cost_after, value_after)
      values (p_product, r.d, s, case when r.kind=0 then 'opening' else 'purchase' end, r.code, r.ref_id, r.qty, q, r.uc, avgc, v);
    else
      if r.qty > q then
        raise exception 'Không đủ số lượng tồn kho: "%" chỉ còn % tại ngày % (chứng từ %)', pname, trim_scale(q), to_char(r.d,'DD/MM/YYYY'), r.code;
      end if;
      if r.qty = q then cost := round(v, 3); else cost := round(r.qty * avgc, 3); end if;
      q := q - r.qty; v := v - cost; tout := tout + r.qty;
      if q = 0 then v := 0; end if;
      update sales_order_items set unit_cost = avgc, cost_amount = cost where id = r.item_id;
      insert into inventory_movements(product_id, movement_date, seq, movement_type, doc_code, ref_id, qty_change, qty_after, unit_cost, avg_cost_after, value_after)
      values (p_product, r.d, s, 'sale', r.code, r.ref_id, -r.qty, q, avgc, avgc, v);
    end if;
  end loop;
  insert into inventory_balances(product_id, quantity, avg_cost, value, total_in, total_out, opening_qty, updated_at)
  values (p_product, q, avgc, v, tin, tout, oq, now())
  on conflict (product_id) do update set quantity=excluded.quantity, avg_cost=excluded.avg_cost, value=excluded.value,
    total_in=excluded.total_in, total_out=excluded.total_out, opening_qty=excluded.opening_qty, updated_at=now();
end $$;
revoke execute on function public.recalc_product(uuid) from public, anon, authenticated;

create or replace function public.refresh_sales_totals() returns void language sql security definer set search_path=public as $$
  update sales_orders so set total_cost = coalesce((select sum(cost_amount) from sales_order_items where order_id = so.id),0)
$$;
revoke execute on function public.refresh_sales_totals() from public, anon, authenticated;

create or replace function public.ensure_owner() returns void language plpgsql stable security definer set search_path=public as $$
begin if not public.is_owner() then raise exception 'Không có quyền thực hiện'; end if; end $$;

-- balance row for new products
create or replace function public.product_init_balance() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into inventory_balances(product_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger product_balance after insert on public.products for each row execute function public.product_init_balance();

-- PURCHASE
create or replace function public.save_purchase(p_id uuid, p_date date, p_note text, p_items jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid; it jsonb; affected uuid[]; pid uuid; qty numeric; amt numeric; uc numeric;
begin
  perform ensure_owner();
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Phiếu nhập phải có ít nhất một sản phẩm'; end if;
  if p_id is not null then
    select array_agg(distinct product_id) into affected from purchase_items where receipt_id = p_id;
    if not exists(select 1 from purchase_receipts where id=p_id and status='completed') then raise exception 'Phiếu nhập không tồn tại hoặc đã hủy'; end if;
    update purchase_receipts set receipt_date=p_date, note=p_note where id=p_id;
    delete from purchase_items where receipt_id=p_id;
    rid := p_id;
  else
    insert into purchase_receipts(receipt_date, note) values (p_date, p_note) returning id into rid;
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::uuid; qty := (it->>'quantity')::numeric; amt := round((it->>'amount')::numeric, 3);
    if qty is null or qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
    if amt is null or amt < 0 then raise exception 'Thành tiền không hợp lệ'; end if;
    if p_id is null and not exists(select 1 from products where id=pid and is_active) then raise exception 'Sản phẩm không hợp lệ hoặc đã ngừng kinh doanh'; end if;
    uc := coalesce((it->>'unit_cost')::numeric, amt/qty);
    insert into purchase_items(receipt_id, product_id, quantity, unit_cost, amount) values (rid, pid, qty, round(uc,6), amt);
    affected := array_append(affected, pid);
  end loop;
  update purchase_receipts set total_qty=(select sum(quantity) from purchase_items where receipt_id=rid),
    total_amount=(select sum(amount) from purchase_items where receipt_id=rid) where id=rid;
  for pid in select distinct unnest(affected) loop perform recalc_product(pid); end loop;
  perform refresh_sales_totals();
  insert into audit_logs(user_id, action, entity, entity_id, details) values (auth.uid(), case when p_id is null then 'create' else 'update' end, 'purchase', rid, p_items);
  return rid;
end $$;

create or replace function public.cancel_purchase(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  perform ensure_owner();
  update purchase_receipts set status='cancelled', cancel_reason=p_reason where id=p_id and status='completed';
  if not found then raise exception 'Phiếu nhập không tồn tại hoặc đã hủy'; end if;
  for pid in select distinct product_id from purchase_items where receipt_id=p_id loop perform recalc_product(pid); end loop;
  perform refresh_sales_totals();
  insert into audit_logs(user_id, action, entity, entity_id, details) values (auth.uid(), 'cancel', 'purchase', p_id, jsonb_build_object('reason', p_reason));
end $$;

-- SALE
create or replace function public.save_sale(p_id uuid, p_date date, p_customer_id uuid, p_customer jsonb, p_save_customer boolean, p_note text, p_items jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare oid uuid; it jsonb; affected uuid[]; pid uuid; qty numeric; price numeric; cid uuid := p_customer_id; cname text;
begin
  perform ensure_owner();
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Đơn bán phải có ít nhất một sản phẩm'; end if;
  cname := nullif(trim(p_customer->>'name'),'');
  if cid is null and p_save_customer and cname is not null then
    insert into customers(name, phone, plate, vehicle_name) values (cname, nullif(p_customer->>'phone',''), nullif(p_customer->>'plate',''), nullif(p_customer->>'vehicle_name',''))
    returning id into cid;
  end if;
  if p_id is not null then
    if not exists(select 1 from sales_orders where id=p_id and status='completed') then raise exception 'Đơn bán không tồn tại hoặc đã hủy'; end if;
    select array_agg(distinct product_id) into affected from sales_order_items where order_id = p_id;
    update sales_orders set order_date=p_date, customer_id=cid, customer_name=coalesce(cname,'Khách lẻ'), phone=nullif(p_customer->>'phone',''),
      plate=nullif(p_customer->>'plate',''), vehicle_name=nullif(p_customer->>'vehicle_name',''), note=p_note where id=p_id;
    delete from sales_order_items where order_id=p_id;
    oid := p_id;
  else
    insert into sales_orders(order_date, customer_id, customer_name, phone, plate, vehicle_name, note)
    values (p_date, cid, coalesce(cname,'Khách lẻ'), nullif(p_customer->>'phone',''), nullif(p_customer->>'plate',''), nullif(p_customer->>'vehicle_name',''), p_note)
    returning id into oid;
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::uuid; qty := (it->>'quantity')::numeric; price := round((it->>'unit_price')::numeric,3);
    if qty is null or qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
    if price is null or price < 0 then raise exception 'Giá bán không hợp lệ'; end if;
    if p_id is null and not exists(select 1 from products where id=pid and is_active) then raise exception 'Sản phẩm không hợp lệ hoặc đã ngừng kinh doanh'; end if;
    insert into sales_order_items(order_id, product_id, quantity, unit_price, amount) values (oid, pid, qty, price, round(qty*price,3));
    affected := array_append(affected, pid);
  end loop;
  for pid in select distinct unnest(affected) loop perform recalc_product(pid); end loop;
  update sales_orders set total_qty=(select sum(quantity) from sales_order_items where order_id=oid),
    total_amount=(select sum(amount) from sales_order_items where order_id=oid) where id=oid;
  perform refresh_sales_totals();
  insert into audit_logs(user_id, action, entity, entity_id, details) values (auth.uid(), case when p_id is null then 'create' else 'update' end, 'sale', oid, p_items);
  return oid;
end $$;

create or replace function public.cancel_sale(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  perform ensure_owner();
  update sales_orders set status='cancelled', cancel_reason=p_reason where id=p_id and status='completed';
  if not found then raise exception 'Đơn bán không tồn tại hoặc đã hủy'; end if;
  for pid in select distinct product_id from sales_order_items where order_id=p_id loop perform recalc_product(pid); end loop;
  perform refresh_sales_totals();
  insert into audit_logs(user_id, action, entity, entity_id, details) values (auth.uid(), 'cancel', 'sale', p_id, jsonb_build_object('reason', p_reason));
end $$;

-- OPENING
create or replace function public.save_opening_balance(p_product uuid, p_date date, p_qty numeric, p_amount numeric, p_replace boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform ensure_owner();
  if p_qty < 0 or p_amount < 0 then raise exception 'Số lượng và giá trị không được âm'; end if;
  if exists(select 1 from inventory_opening_balances where product_id=p_product) then
    if not p_replace then raise exception 'Sản phẩm này đã có tồn kho ban đầu'; end if;
    update inventory_opening_balances set opening_date=p_date, quantity=p_qty, amount=round(p_amount,3),
      unit_cost=case when p_qty>0 then round(p_amount/p_qty,6) else 0 end where product_id=p_product;
  else
    insert into inventory_opening_balances(product_id, opening_date, quantity, amount, unit_cost)
    values (p_product, p_date, p_qty, round(p_amount,3), case when p_qty>0 then round(p_amount/p_qty,6) else 0 end);
  end if;
  perform recalc_product(p_product);
  perform refresh_sales_totals();
  insert into audit_logs(user_id, action, entity, entity_id, details) values (auth.uid(), 'opening', 'product', p_product, jsonb_build_object('qty',p_qty,'amount',p_amount));
end $$;

do $$ declare f text; begin
  foreach f in array array['save_purchase(uuid,date,text,jsonb)','cancel_purchase(uuid,text)','save_sale(uuid,date,uuid,jsonb,boolean,text,jsonb)','cancel_sale(uuid,text)','save_opening_balance(uuid,date,numeric,numeric,boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
