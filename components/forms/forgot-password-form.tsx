"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
  FormDescription
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
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
    const toastId = toast.loading("Sending reset link...")
    try {
      const response = await fetch("/api/auth/request-password-reset", {
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
        const message = errorBody?.error?.message || "Unable to send reset email."
        toast.error(message, { id: toastId })
        return
      }

      toast.success("Reset link sent. Check your inbox.", { id: toastId })
      form.reset()
    } catch (error) {
      toast.error("Something went wrong while sending the reset link.", { id: toastId })
      console.log(error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Form {...form}>
        <Card>
          <CardHeader>
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FieldGroup>
                <Field>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <FormControl>
                          <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          We&apos;ll email you a link to reset your password.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Field>
                <Field>
                  <div className="flex flex-col gap-2">
                    <Button type="submit">Send reset link</Button>
                  </div>
                  <FieldDescription className="text-center">
                    Remembered your password? You can log back in.
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
