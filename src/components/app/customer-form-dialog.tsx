import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, type Customer } from "@/lib/data";
import { errMsg } from "@/lib/format";
import { Field } from "./inputs";

const schema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên khách hàng").max(200),
  phone: z.string().trim().max(30).refine((s) => !s || /^[0-9+\-.\s()]{6,}$/.test(s), "Số điện thoại không hợp lệ"),
  vehicle_name: z.string().trim().max(100),
  plate: z.string().trim().max(30),
  note: z.string().max(1000),
});
type Values = z.infer<typeof schema>;

/** Create (customer = "new") or edit a customer. Same-name customers are never merged. */
export function CustomerFormDialog({ customer, onClose }: { customer: Customer | "new" | null; onClose: () => void }) {
  const invalidate = useInvalidateAll();
  const c = customer && customer !== "new" ? customer : null;
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (customer) form.reset({ name: c?.name ?? "", phone: c?.phone ?? "", vehicle_name: c?.vehicle_name ?? "", plate: c?.plate ?? "", note: c?.note ?? "" });
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      name: v.name.trim(), phone: v.phone.trim() || null, vehicle_name: v.vehicle_name.trim() || null,
      plate: v.plate.trim().toUpperCase() || null, note: v.note.trim() || null,
    };
    const { error } = c
      ? await supabase.from("customers").update(payload).eq("id", c.id)
      : await supabase.from("customers").insert(payload);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    void invalidate();
    onClose();
  });

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{c ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          <DialogDescription>{c ? `Mã khách hàng ${c.code}` : "Mã khách hàng được tạo tự động."}</DialogDescription>
        </DialogHeader>
        <form id="customer-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên khách" htmlFor="c-name" required error={errors.name?.message}>
            <Input id="c-name" className="h-9" autoFocus {...form.register("name")} />
          </Field>
          <Field label="Số điện thoại" htmlFor="c-phone" error={errors.phone?.message}>
            <Input id="c-phone" type="tel" inputMode="tel" className="h-9" {...form.register("phone")} />
          </Field>
          <Field label="Tên xe thường dùng" htmlFor="c-vehicle">
            <Input id="c-vehicle" className="h-9" {...form.register("vehicle_name")} />
          </Field>
          <Field label="Biển số xe thường dùng" htmlFor="c-plate">
            <Input id="c-plate" className="h-9 uppercase" {...form.register("plate")} />
          </Field>
          <Field label="Ghi chú" htmlFor="c-note" className="sm:col-span-2">
            <Textarea id="c-note" rows={2} {...form.register("note")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="customer-form" disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
