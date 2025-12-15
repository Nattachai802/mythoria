"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  newPassword: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." })
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
      toast.error("Reset token is missing. Please use the link from your email.")
      return
    }

    const toastId = toast.loading("Updating your password...")
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
        const message = errorBody?.error?.message || "Unable to reset password."
        toast.error(message, { id: toastId })
        return
      }

      toast.success("Password updated. You can now log in.", { id: toastId })
      form.reset()
      router.push("/login")
    } catch (error) {
      toast.error("Something went wrong while resetting your password.", { id: toastId })
      console.log(error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Form {...form}>
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              Choose a new password to secure your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FieldGroup>
                <Field>
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                        <FormControl>
                          <Input
                            id="newPassword"
                            type="password"
                            placeholder="••••••••"
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
                    <FieldDescription className="text-red-500">
                      Token is missing or invalid. Please use the reset link from your email.
                    </FieldDescription>
                  </Field>
                )}
                <Field>
                  <div className="flex flex-col gap-2">
                    <Button type="submit" disabled={!token}>
                      Reset password
                    </Button>
                  </div>
                  <FieldDescription className="text-center">
                    After resetting, you&apos;ll be redirected to login.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </Form>
    </div>
  )
}
