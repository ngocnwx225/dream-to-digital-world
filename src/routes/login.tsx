import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3, Eye, EyeOff, Loader2, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/app/inputs";
import { FullPageLoader } from "@/components/app/shared";
import { supabase } from "@/integrations/supabase/client";
import { getActiveSession, rememberSession } from "@/lib/auth";
import { errMsg } from "@/lib/format";
import { useCachedBrand, type Brand } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" && s["redirect"].startsWith("/") ? { redirect: s["redirect"] } : {},
  beforeLoad: async () => {
    if (await getActiveSession()) throw redirect({ to: "/dashboard", replace: true });
  },
  pendingComponent: FullPageLoader,
  head: () => ({ meta: [{ title: "Đăng nhập – Chơi Xe-Xe Chơi" }] }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

const setupSchema = z
  .object({
    full_name: z.string().trim().min(1, "Vui lòng nhập họ tên").max(100),
    email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Mật khẩu xác nhận không khớp" });

function PasswordInput({ id, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} className="h-10 pr-10" {...props} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginPage() {
  const brand = useCachedBrand();
  const ownerQuery = useQuery({
    queryKey: ["owner-exists"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_exists");
      if (error) throw error;
      return Boolean(data);
    },
  });

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel brand={brand} />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="animate-page-in w-full max-w-[420px]">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <img src={brand.logo} alt={brand.name} className="mb-3 h-20 w-20 rounded-full object-cover shadow-glow" />
            <h1 className="text-2xl font-bold text-foreground">{brand.name}</h1>
            {brand.subtitle && <p className="mt-1 text-sm text-muted-foreground">{brand.subtitle}</p>}
          </div>
          <div className="card-surface p-6 shadow-elevated md:p-8">
            {ownerQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : ownerQuery.data === false ? (
              <SetupForm onDone={() => void ownerQuery.refetch()} />
            ) : (
              <LoginForm />
            )}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {brand.name}</p>
        </div>
      </div>
    </div>
  );
}

const highlights = [
  { icon: Truck, text: "Nhập hàng, bán ra và tồn kho cập nhật tức thì" },
  { icon: BarChart3, text: "Doanh thu, giá vốn và lợi nhuận theo từng tháng" },
  { icon: ShieldCheck, text: "Một tài khoản chủ cửa hàng, dữ liệu được bảo vệ" },
] as const;

/** Desktop-only brand side of the login screen. */
function BrandPanel({ brand }: { brand: Brand }) {
  return (
    <aside className="bg-brand relative hidden overflow-hidden p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-sidebar/40 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <img src={brand.logo} alt="" className="h-14 w-14 rounded-full object-cover" />
        <span className="text-xl font-bold tracking-tight">{brand.name}</span>
      </div>
      <div className="relative max-w-md">
        <h2 className="text-4xl font-bold leading-tight tracking-tight">Quản lý mua bán &amp; tồn kho, gọn trong một nơi.</h2>
        <ul className="mt-8 space-y-4">
          {highlights.map((h) => (
            <li key={h.text} className="flex items-center gap-3 text-[15px] text-white/90">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20"><h.icon className="h-[18px] w-[18px]" /></span>
              {h.text}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-white/70">Đơn giản – chính xác – hiệu quả</p>
    </aside>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const { redirect: back } = Route.useSearch();
  const [remember, setRemember] = useState(true);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) {
      form.setError("root", { message: errMsg(error) });
      return;
    }
    rememberSession(remember);
    toast.success("Đăng nhập thành công");
    await navigate({ to: back ?? "/dashboard", replace: true });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Đăng nhập</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dành cho chủ cửa hàng</p>
      </div>
      {errors.root && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="email@cuahang.vn" className="h-10" {...form.register("email")} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
        <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">Ghi nhớ đăng nhập</Label>
      </div>
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Đăng nhập
      </Button>
    </form>
  );
}

/** One-time setup: creates the single owner account. The database blocks any later sign-up. */
function SetupForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.full_name }, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      form.setError("root", { message: errMsg(error) });
      return;
    }
    if (data.session) {
      rememberSession(true);
      toast.success("Đã tạo tài khoản chủ cửa hàng");
      await navigate({ to: "/dashboard", replace: true });
    } else {
      setPendingConfirm(v.email);
    }
  });

  if (pendingConfirm) {
    return (
      <div className="space-y-4 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-success" />
        <p className="font-semibold">Tài khoản đã được tạo</p>
        <p className="text-sm text-muted-foreground">Vui lòng mở email <b>{pendingConfirm}</b> và xác nhận, sau đó đăng nhập.</p>
        <Button className="w-full" onClick={onDone}>Đến trang đăng nhập</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Thiết lập tài khoản chủ cửa hàng</h2>
        <p className="text-sm text-muted-foreground">Hệ thống chưa có tài khoản. Tài khoản đầu tiên sẽ là chủ cửa hàng; sau đó đăng ký mới sẽ bị khóa.</p>
      </div>
      {errors.root && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
      <Field label="Họ tên" htmlFor="full_name" error={errors.full_name?.message}>
        <Input id="full_name" autoComplete="name" className="h-10" {...form.register("full_name")} />
      </Field>
      <Field label="Email" htmlFor="setup-email" error={errors.email?.message}>
        <Input id="setup-email" type="email" autoComplete="email" className="h-10" {...form.register("email")} />
      </Field>
      <Field label="Mật khẩu" htmlFor="setup-password" error={errors.password?.message}>
        <PasswordInput id="setup-password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Nhập lại mật khẩu" htmlFor="setup-confirm" error={errors.confirm?.message}>
        <PasswordInput id="setup-confirm" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Tạo tài khoản
      </Button>
    </form>
  );
}
