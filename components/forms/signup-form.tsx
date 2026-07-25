"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"

const formSchema = z.object({
  email: z.string().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
  password: z
    .string()
    .min(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" })
    .max(50),
  confirmPassword: z
    .string()
    .min(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }),
  name: z.string().min(2, { message: "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร" }),
  inviteCode: z.string().min(1, { message: "ต้องกรอกรหัสเชิญ" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  path: ["confirmPassword"],
})

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      inviteCode: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("กำลังสร้างบัญชี...")
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
          inviteCode: values.inviteCode,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message =
          errorBody?.error?.message || "สมัครไม่สำเร็จ ตรวจสอบข้อมูลอีกครั้ง"
        toast.error(message, { id: toastId })
        return
      }

      const data = await response.json().catch(() => null)

      if (data?.redirect && data?.url) {
        toast.success("กำลังพาไปหน้าถัดไป...", { id: toastId })
        router.push(data.url)
        return
      }

      // better-auth สร้าง session ให้ตั้งแต่สมัครเสร็จ พาเข้าใช้งานได้เลย
      // ถ้าด้วยเหตุใดยังไม่มี session ด่านใน app/dashboard/layout.tsx จะเด้งกลับมาหน้า login เอง
      toast.success("สร้างบัญชีสำเร็จ", { id: toastId })
      router.push("/dashboard")
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดระหว่างสมัคร", { id: toastId })
      console.log(error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="name">ชื่อที่ใช้เรียก</FieldLabel>
                    <FormControl>
                      <Input
                        id="name"
                        type="text"
                        autoComplete="name"
                        placeholder="ชื่อของคุณ"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            <Field>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="email">อีเมล</FieldLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      ใช้สำหรับเข้าสู่ระบบและกู้คืนรหัสผ่าน
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            <Field>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
                    <FormControl>
                      <PasswordInput
                        id="password"
                        autoComplete="new-password"
                        placeholder="อย่างน้อย 8 ตัวอักษร"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            <Field>
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="confirmPassword">
                      ยืนยันรหัสผ่าน
                    </FieldLabel>
                    <FormControl>
                      <PasswordInput
                        id="confirmPassword"
                        autoComplete="new-password"
                        placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            <Field>
              <FormField
                control={form.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="inviteCode">รหัสเชิญ</FieldLabel>
                    <FormControl>
                      <Input
                        id="inviteCode"
                        type="text"
                        placeholder="กรอกรหัสที่ได้รับ"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            <Field>
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                สมัครใช้งาน
              </Button>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="font-technical text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  หรือ
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                type="button"
                className="w-full"
                disabled={form.formState.isSubmitting}
                onClick={async () => {
                  const toastId = toast.loading("กำลังพาไปหน้า Google...")
                  try {
                    await authClient.signIn.social({
                      provider: "google",
                      callbackURL: "/dashboard",
                    })
                  } catch (err) {
                    toast.error("สมัครด้วย Google ไม่สำเร็จ", { id: toastId })
                  }
                }}
              >
                สมัครด้วย Google
              </Button>

              <FieldDescription className="mt-6 text-center">
                มีบัญชีอยู่แล้ว?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  เข้าสู่ระบบ
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </Form>
    </div>
  )
}
