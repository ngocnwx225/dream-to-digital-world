import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileSpreadsheet, KeyRound, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, LoadingSkeleton, PageHeader } from "@/components/app/shared";
import { CurrencyInput, Field, QuantityInput } from "@/components/app/inputs";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, useProfile, useSettings } from "@/lib/data";
import { parseDecimal, toInputString } from "@/lib/calc";
import { errMsg, MONEY_UNIT } from "@/lib/format";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Cài đặt – StoreFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thông tin cửa hàng, tài khoản và bảo mật" />
      <div className="grid gap-5 lg:grid-cols-2">
        <StoreSettings />
        <ProfileSettings />
        <PasswordSettings />
        <Card title="Nhập dữ liệu từ Excel" icon={FileSpreadsheet}>
          <p className="mb-4 text-sm text-muted-foreground">
            Chuyển dữ liệu Mua vào / Bán ra từ file Excel cũ vào hệ thống. Có bước xem trước để sửa ngày, số điện thoại, số xe trước khi lưu.
          </p>
          <Button variant="outline" asChild><Link to="/import-excel"><FileSpreadsheet className="h-4 w-4" />Mở trang nhập Excel</Link></Button>
        </Card>
      </div>
    </>
  );
}

const storeSchema = z.object({
  store_name: z.string().trim().min(1, "Vui lòng nhập tên cửa hàng").max(100),
  default_low_stock: z.string().refine((s) => (parseDecimal(s) ?? -1) >= 0, "Giá trị không hợp lệ"),
  consumable_cost_per_vehicle: z.string().refine((s) => (parseDecimal(s) ?? -1) >= 0, "Giá trị không hợp lệ"),
});

function StoreSettings() {
  const { data, isLoading } = useSettings();
  const invalidate = useInvalidateAll();
  const form = useForm<z.infer<typeof storeSchema>>({ resolver: zodResolver(storeSchema), defaultValues: { store_name: "", default_low_stock: "", consumable_cost_per_vehicle: "" } });
  const { errors, isSubmitting } = form.formState;
  useEffect(() => {
    if (data) form.reset({
      store_name: data.store_name,
      default_low_stock: toInputString(data.default_low_stock, 3),
      consumable_cost_per_vehicle: toInputString(data.consumable_cost_per_vehicle, 3),
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.from("settings")
      .update({
        store_name: v.store_name.trim(),
        default_low_stock: parseDecimal(v.default_low_stock) ?? 0,
        consumable_cost_per_vehicle: parseDecimal(v.consumable_cost_per_vehicle) ?? 0,
      }).eq("id", 1);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    void invalidate();
  });

  return (
    <Card title="Thông tin cửa hàng" icon={Store}>
      {isLoading ? <LoadingSkeleton rows={3} /> : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Tên cửa hàng" htmlFor="store_name" required error={errors.store_name?.message}>
            <Input id="store_name" className="h-9" {...form.register("store_name")} />
          </Field>
          <Field label="Mức cảnh báo tồn mặc định" htmlFor="low" error={errors.default_low_stock?.message}
            hint="Áp dụng cho sản phẩm chưa đặt ngưỡng cảnh báo riêng">
            <Controller control={form.control} name="default_low_stock" render={({ field }) => (
              <QuantityInput id="low" value={field.value} onChange={field.onChange} className="max-w-[160px]" />
            )} />
          </Field>
          <Field label="Chi phí vật tư tiêu hao mặc định / xe" htmlFor="consumable" error={errors.consumable_cost_per_vehicle?.message}
            hint="Dây rút, băng keo, keo dán, gen co nhiệt... Chỉ áp dụng cho đơn bán tạo mới; đơn đã lưu giữ nguyên mức cũ.">
            <Controller control={form.control} name="consumable_cost_per_vehicle" render={({ field }) => (
              <CurrencyInput id="consumable" value={field.value} onChange={field.onChange} className="max-w-[200px]" invalid={!!errors.consumable_cost_per_vehicle} />
            )} />
          </Field>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
            Đơn vị tiền tệ: <b className="text-foreground">{MONEY_UNIT}</b>. Ví dụ: 850 nghĩa là 850 nghìn đồng (850.000 ₫).
            Giá vốn tính theo phương pháp <b className="text-foreground">bình quân gia quyền di động</b>.
          </div>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}</Button>
        </form>
      )}
    </Card>
  );
}

const profileSchema = z.object({ full_name: z.string().trim().min(1, "Vui lòng nhập họ tên").max(100) });

function ProfileSettings() {
  const { data, isLoading } = useProfile();
  const invalidate = useInvalidateAll();
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { full_name: "" } });
  const { errors, isSubmitting } = form.formState;
  useEffect(() => { if (data) form.reset({ full_name: data.full_name }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = form.handleSubmit(async (v) => {
    if (!data) return;
    const { error } = await supabase.from("profiles").update({ full_name: v.full_name.trim() }).eq("id", data.id);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    void invalidate();
  });

  return (
    <Card title="Tài khoản" icon={UserRound}>
      {isLoading ? <LoadingSkeleton rows={3} /> : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Email đăng nhập"><Input value={data?.email ?? ""} disabled className="h-9" /></Field>
          <Field label="Họ tên" htmlFor="full_name" required error={errors.full_name?.message}>
            <Input id="full_name" className="h-9" {...form.register("full_name")} />
          </Field>
          <Field label="Vai trò"><Input value="Chủ cửa hàng / Quản trị viên" disabled className="h-9" /></Field>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}</Button>
        </form>
      )}
    </Card>
  );
}

const passwordSchema = z
  .object({ password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Mật khẩu xác nhận không khớp" });

function PasswordSettings() {
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return void toast.error(errMsg(error));
    toast.success("Đã đổi mật khẩu");
    form.reset();
  });
  return (
    <Card title="Đổi mật khẩu" icon={KeyRound}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Mật khẩu mới" htmlFor="new-password" required error={errors.password?.message}>
          <Input id="new-password" type="password" autoComplete="new-password" className="h-9" {...form.register("password")} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="confirm-password" required error={errors.confirm?.message}>
          <Input id="confirm-password" type="password" autoComplete="new-password" className="h-9" {...form.register("confirm")} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Đổi mật khẩu"}</Button>
      </form>
    </Card>
  );
}
