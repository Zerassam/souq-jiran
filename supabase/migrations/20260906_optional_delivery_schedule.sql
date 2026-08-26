-- Optional delivery scheduling guard.
-- Delivery orders may be created without a requested window; when a window is
-- supplied, the existing availability and 90-minute validation remain active.
create or replace function public.create_customer_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_choice text default 'pickup',
  p_delivery_address jsonb default null,
  p_delivery_fee integer default 0,
  p_delivery_schedule_mode text default 'none',
  p_requested_delivery_window_start timestamptz default null,
  p_requested_delivery_window_end timestamptz default null
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_subtotal integer;
  v_weight numeric;
  v_order public.orders;
  v_quote record;
  v_requires boolean;
  v_verified boolean;
  v_schedule_status text := 'not_requested';
begin
  if public.current_app_role() <> 'customer' then raise exception 'Only customer accounts can create orders'; end if;
  if public.is_customer_blacklisted(auth.uid()) then raise exception 'CUSTOMER_ACCOUNT_BLOCKED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'An order needs at least one product'; end if;
  if p_delivery_choice not in ('pickup','store','courier') then raise exception 'Invalid delivery options'; end if;
  if p_delivery_choice = 'pickup' and (p_delivery_schedule_mode <> 'none' or p_requested_delivery_window_start is not null or p_requested_delivery_window_end is not null) then raise exception 'PICKUP_CANNOT_BE_SCHEDULED'; end if;
  if p_delivery_choice <> 'pickup' and p_delivery_schedule_mode not in ('none','next_available','selected_window') then raise exception 'INVALID_DELIVERY_SCHEDULE_MODE'; end if;
  if p_delivery_choice <> 'pickup' and p_delivery_schedule_mode <> 'none' then
    if p_requested_delivery_window_start is null or p_requested_delivery_window_end is null then raise exception 'DELIVERY_SCHEDULE_WINDOW_REQUIRED'; end if;
    if extract(epoch from (p_requested_delivery_window_end - p_requested_delivery_window_start)) <> 90 * 60 then raise exception 'DELIVERY_WINDOW_MUST_BE_90_MINUTES'; end if;
    if not public.is_requested_delivery_window_available(p_merchant_id, p_delivery_choice, p_delivery_address, p_requested_delivery_window_start, p_requested_delivery_window_end) then raise exception 'DELIVERY_WINDOW_UNAVAILABLE'; end if;
    v_schedule_status := 'requested';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'unit',p.unit,'department',p.department,'qty',line.qty,'weight_kg',p.weight_kg) order by p.name),'[]'::jsonb), coalesce(sum(p.price*line.qty),0), coalesce(sum(p.weight_kg*line.qty),0)
    into v_items,v_subtotal,v_weight from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id where p.merchant_id=p_merchant_id and p.available and line.qty between 1 and 100;
  if jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'One or more selected products are unavailable'; end if;
  if p_delivery_choice = 'courier' and (p_delivery_address is null or nullif(p_delivery_address ->> 'wilaya','') is null or nullif(p_delivery_address ->> 'commune','') is null or nullif(p_delivery_address ->> 'label','') is null) then raise exception 'PRECISE_DELIVERY_ADDRESS_REQUIRED'; end if;
  select * into v_quote from public.quote_delivery(p_merchant_id,coalesce(p_delivery_address,'{}'::jsonb),v_weight);
  v_requires := p_delivery_choice = 'courier' and (v_subtotal >= 10000 or v_quote.is_interwilaya);
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) into v_verified;
  if v_requires and not v_verified then raise exception 'EMAIL_OTP_VERIFICATION_REQUIRED'; end if;
  insert into public.orders(customer_id,merchant_id,status,items,delivery_address,delivery_choice,subtotal,delivery_fee,total,requires_phone_verification,is_interwilaya,total_weight_kg,delivery_distance_km,estimated_delivery_minutes,origin_wilaya,origin_commune,destination_wilaya,destination_commune,delivery_schedule_mode,delivery_schedule_status,requested_delivery_window_start,requested_delivery_window_end)
  select auth.uid(),p_merchant_id,'pending',v_items,p_delivery_address,p_delivery_choice,v_subtotal,case when p_delivery_choice='pickup' then 0 else v_quote.fee end,v_subtotal+case when p_delivery_choice='pickup' then 0 else v_quote.fee end,false,v_quote.is_interwilaya,v_weight,v_quote.distance_km,v_quote.eta_minutes,m.wilaya,m.commune,p_delivery_address->>'wilaya',p_delivery_address->>'commune',case when p_delivery_choice='pickup' then 'none' else p_delivery_schedule_mode end,v_schedule_status,p_requested_delivery_window_start,p_requested_delivery_window_end from public.merchants m where m.id=p_merchant_id returning * into v_order;
  insert into public.order_items(order_id,product_id,product_name,unit,unit_price,quantity) select v_order.id,p.id,p.name,p.unit,p.price,line.qty from jsonb_to_recordset(p_items) line(product_id uuid,qty integer) join public.products p on p.id=line.product_id;
  perform public.record_order_lifecycle_event(v_order.id,'customer_order_confirmed',jsonb_build_object('verification_required',v_requires,'delivery_fee',v_order.delivery_fee,'delivery_schedule_status',v_schedule_status));
  perform public.record_admin_order_notification(v_order.id,'order_created');
  return v_order;
end; $$;

revoke all on function public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.create_customer_order(uuid,jsonb,text,jsonb,integer,text,timestamptz,timestamptz) to authenticated;
