"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { PasswordInput } from "@/components/ui/password-input"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  newPassword: z
    .string()
    .min(6, { message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" })
    .max(128),
})

export function ResetPasswordForm({
  token,
  className,
  ...props
}: { token: string | null } & React.ComponentProps<"div">) {
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) {
      toast.error("ไม่พบรหัสยืนยัน กรุณากดลิงก์จากอีเมลอีกครั้ง")
      return
    }

    const toastId = toast.loading("กำลังเปลี่ยนรหัสผ่าน...")
    try {
      const query = new URLSearchParams({ token }).toString()
      const response = await fetch(`/api/auth/reset-password?${query}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: values.newPassword,
          token,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ"
        toast.error(message, { id: toastId })
        return
      }

      toast.success("เปลี่ยนรหัสผ่านแล้ว เข้าสู่ระบบได้เลย", { id: toastId })
      form.reset()
      router.push("/login")
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดระหว่างเปลี่ยนรหัสผ่าน", { id: toastId })
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
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel htmlFor="newPassword">รหัสผ่านใหม่</FieldLabel>
                    <FormControl>
                      <PasswordInput
                        id="newPassword"
                        autoComplete="new-password"
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Field>
            {!token && (
              <Field>
                <FieldDescription className="text-destructive">
                  ลิงก์นี้ไม่มีรหัสยืนยัน หรือรหัสหมดอายุแล้ว — กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน
                </FieldDescription>
              </Field>
            )}
            <Field>
              <Button
                type="submit"
                className="w-full"
                disabled={!token || form.formState.isSubmitting}
              >
                เปลี่ยนรหัสผ่าน
              </Button>
              <FieldDescription className="mt-4 text-center">
                เปลี่ยนเสร็จแล้วระบบจะพากลับไปหน้าเข้าสู่ระบบ
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </Form>
    </div>
  )
}
