
-- Supabase runs API requests with pg-safeupdate, which rejects any UPDATE without a WHERE
-- clause ("UPDATE requires a WHERE clause"). refresh_sales_totals() had none, so every
-- save_purchase / save_sale / cancel_* / save_opening_balance call failed.
-- Only touch orders whose stored cost actually changed; this is also cheaper as orders grow.
create or replace function public.refresh_sales_totals() returns void
language sql security definer set search_path=public as $$
  update sales_orders so
     set total_cost = t.cost
    from (
      select o.id, coalesce(sum(i.cost_amount), 0) as cost
        from sales_orders o
        left join sales_order_items i on i.order_id = o.id
       group by o.id
    ) t
   where t.id = so.id
     and so.total_cost is distinct from t.cost
$$;
revoke execute on function public.refresh_sales_totals() from public, anon, authenticated;
