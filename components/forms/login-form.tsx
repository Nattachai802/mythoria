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
    .min(6, { message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" })
    .max(50),
})

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("กำลังเข้าสู่ระบบ...")
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message =
          errorBody?.error?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        toast.error(message, { id: toastId })
        return
      }

      const data = await response.json().catch(() => null)

      if (data?.redirect && data?.url) {
        toast.success("กำลังพาไปหน้าถัดไป...", { id: toastId })
        router.push(data.url)
        return
      }

      toast.success("เข้าสู่ระบบสำเร็จ", { id: toastId })
      router.push("/dashboard")
      form.reset()
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ", { id: toastId })
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
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
                      <Link
                        href="/forgot-password"
                        className="ml-auto inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        ลืมรหัสผ่าน?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput
                        id="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
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
                เข้าสู่ระบบ
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
                    toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ", { id: toastId })
                  }
                }}
              >
                เข้าสู่ระบบด้วย Google
              </Button>

              <FieldDescription className="mt-6 text-center">
                ยังไม่มีบัญชี?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  สมัครใช้งาน
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </Form>
    </div>
  )
}
