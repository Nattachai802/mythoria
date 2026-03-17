"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { createIdea } from "@/server/idea";
import { toast } from "sonner";

const ideaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().default("general"),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

interface CreateIdeaDialogProps {
  novelId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultLinkedCharacterIds?: string[];
  defaultCategory?: string;
  onIdeaCreated?: (idea: any) => void;
}

export function CreateIdeaDialog({
  novelId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultLinkedCharacterIds,
  defaultCategory,
  onIdeaCreated
}: CreateIdeaDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const form = useForm<IdeaFormData>({
    resolver: zodResolver(ideaSchema),
    defaultValues: {
      title: "",
      content: "",
      category: defaultCategory || "general",
    },
  });

  const onSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);

    const result = await createIdea({
      title: data.title,
      content: data.content,
      novelId,
      category: data.category,
      linkedCharacterIds: defaultLinkedCharacterIds,
    });

    if (result.success) {
      toast.success("Idea created successfully");
      onIdeaCreated?.(result.data);
      setOpen(false);
      form.reset();
    } else {
      toast.error(result.error || "Failed to create idea");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Idea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Idea</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Idea title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">💭 General</SelectItem>
                      <SelectItem value="character">👤 Character</SelectItem>
                      <SelectItem value="power">⚡ Power</SelectItem>
                      <SelectItem value="lore">📜 Lore</SelectItem>
                      <SelectItem value="location">🗺️ Location</SelectItem>
                      <SelectItem value="plot">📖 Plot</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    ประเภทของไอเดียนี้
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your idea..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Idea"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}