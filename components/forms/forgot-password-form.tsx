"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormDescription
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  email: z.string().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
})

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  const getRedirectUrl = () => {
    const base = process.env.NEXT_PUBLIC_BASE_URL
    if (base) return `${base}/reset-password`
    if (typeof window !== "undefined") return `${window.location.origin}/reset-password`
    return "/reset-password"
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("กำลังส่งลิงก์...")
    try {
      const response = await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          redirectTo: getRedirectUrl(),
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error?.message || "ส่งอีเมลไม่สำเร็จ"
        toast.error(message, { id: toastId })
        return
      }

      toast.success("ส่งลิงก์แล้ว กรุณาตรวจกล่องอีเมล", { id: toastId })
      form.reset()
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดระหว่างส่งลิงก์", { id: toastId })
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
                    <FormDescription>
                      ใช้อีเมลเดียวกับที่สมัครไว้
                    </FormDescription>
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
                ส่งลิงก์ตั้งรหัสใหม่
              </Button>
              <FieldDescription className="mt-6 text-center">
                จำรหัสผ่านได้แล้ว?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  กลับไปเข้าสู่ระบบ
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </Form>
    </div>
  )
}
