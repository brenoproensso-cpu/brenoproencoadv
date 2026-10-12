-- Permite ao admin excluir os dados de um lead (pedido do titular pela LGPD)
grant delete on public.leads to authenticated;
drop policy if exists leads_admin_delete on public.leads;
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_admin());
