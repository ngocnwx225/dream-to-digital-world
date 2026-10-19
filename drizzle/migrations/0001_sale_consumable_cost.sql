
-- Fixed consumable cost per vehicle (dây rút, băng keo, keo dán...). Not stocked, not billed
-- to the customer; it only reduces profit. Amounts are in nghìn đồng like every other money column.

alter table public.settings
  add column consumable_cost_per_vehicle numeric(14,3) not null default 5 check (consumable_cost_per_vehicle >= 0);

-- Existing orders keep NULL (no consumable data) so history is never charged retroactively.
alter table public.sales_orders
  add column vehicle_count int check (vehicle_count >= 0),
  add column consumable_unit_cost numeric(14,3) check (consumable_unit_cost >= 0),
  add column consumable_total_cost numeric(14,3) not null default 0 check (consumable_total_cost >= 0);

-- save_sale gains the vehicle count; drop the old signature so PostgREST sees a single function.
drop function if exists public.save_sale(uuid, date, uuid, jsonb, boolean, text, jsonb);

create or replace function public.save_sale(
  p_id uuid, p_date date, p_customer_id uuid, p_customer jsonb, p_save_customer boolean, p_note text, p_items jsonb,
  p_vehicle_count int default 1
) returns uuid
language plpgsql security definer set search_path=public as $$
declare oid uuid; it jsonb; affected uuid[]; pid uuid; qty numeric; price numeric; cid uuid := p_customer_id; cname text;
  v_rate numeric;
begin
  perform ensure_owner();
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Đơn bán phải có ít nhất một sản phẩm'; end if;
  if p_vehicle_count is null or p_vehicle_count < 0 then raise exception 'Số xe không hợp lệ'; end if;
  cname := nullif(trim(p_customer->>'name'),'');
  if cid is null and p_save_customer and cname is not null then
    insert into customers(name, phone, plate, vehicle_name) values (cname, nullif(p_customer->>'phone',''), nullif(p_customer->>'plate',''), nullif(p_customer->>'vehicle_name',''))
    returning id into cid;
  end if;

  -- New orders take today's configured rate; edits keep the rate stored on the order.
  -- A legacy order (no rate) only gets the current rate when the owner sets vehicles > 0.
  if p_id is null then
    select consumable_cost_per_vehicle into v_rate from settings where id = 1;
  else
    select consumable_unit_cost into v_rate from sales_orders where id = p_id;
    if v_rate is null and p_vehicle_count > 0 then
      select consumable_cost_per_vehicle into v_rate from settings where id = 1;
    end if;
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

  update sales_orders set vehicle_count = p_vehicle_count, consumable_unit_cost = v_rate,
    consumable_total_cost = round(coalesce(v_rate, 0) * p_vehicle_count, 3)
  where id = oid;

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
  insert into audit_logs(user_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_id is null then 'create' else 'update' end, 'sale', oid,
    jsonb_build_object('items', p_items, 'vehicle_count', p_vehicle_count, 'consumable_unit_cost', v_rate));
  return oid;
end $$;

revoke execute on function public.save_sale(uuid,date,uuid,jsonb,boolean,text,jsonb,int) from public, anon;
grant execute on function public.save_sale(uuid,date,uuid,jsonb,boolean,text,jsonb,int) to authenticated;
