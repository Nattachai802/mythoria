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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react"; // Import Loader2
import { createCharacter } from "@/server/character";
import { generateThaiAliases } from "@/server/ai";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";

const characterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
  age: z.string().optional(),
  gender: z.string().optional(),
  species: z.string().optional(),
  image: z.string().optional(),
  aliases: z.array(z.string()).optional(), // Added aliases to schema
  description: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  backstory: z.string().optional(),
  goals: z.string().optional(),
  motivation: z.string().optional(),
  conflict: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
});

type CharacterFormData = z.infer<typeof characterSchema>;

interface CreateCharacterDialogProps {
  novelId: string;
}

export function CreateCharacterDialog({ novelId }: CreateCharacterDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // New State
  const [aliasInput, setAliasInput] = useState(""); // Added missing state

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: "",
      role: "supporting",
      age: "",
      gender: "",
      species: "",
      image: "",
      aliases: [],
      description: "",
      appearance: "",
      personality: "",
      backstory: "",
      goals: "",
      motivation: "",
      conflict: "",
      strengths: "",
      weaknesses: "",
    },
  });

  const onSubmit = async (data: CharacterFormData) => {
    setIsSubmitting(true);
    const result = await createCharacter({
      ...data,
      novelId,
    });

    if (result.success) {
      toast.success("Character created successfully");
      setOpen(false);
      form.reset();
    } else {
      toast.error(result.error || "Failed to create character");
    }
    setIsSubmitting(false);
  };

  const handleAutoGenerateThaiName = async () => {
    const currentName = form.getValues("name");
    if (!currentName || isGenerating) return; // Prevent double call

    setIsGenerating(true);
    try {
      const generatedAliases = await generateThaiAliases(currentName);

      if (generatedAliases && generatedAliases.length > 0) {
        const currentAliases = (form.getValues("aliases") as string[]) || [];
        // Filter out duplicates
        const toAdd = generatedAliases.filter(s => !currentAliases.includes(s));

        if (toAdd.length > 0) {
          form.setValue("aliases", [...currentAliases, ...toAdd]);
          toast.success(`Auto-added: ${toAdd.join(", ")}`);
        }
      }
    } catch (error) {
      console.error("Auto-generate failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const addAlias = () => {
    if (aliasInput.trim()) {
      const currentAliases = (form.getValues("aliases") as string[]) || [];
      if (!currentAliases.includes(aliasInput.trim())) {
        form.setValue("aliases", [...currentAliases, aliasInput.trim()]);
      }
      setAliasInput("");
    }
  };

  const removeAlias = (aliasToRemove: string) => {
    const currentAliases = (form.getValues("aliases") as string[]) || [];
    form.setValue("aliases", currentAliases.filter((a: string) => a !== aliasToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Character
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Character</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="depth">Character Depth</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="Character name (English)"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur(); // call original onBlur
                              handleAutoGenerateThaiName(); // call our auto-gen
                            }}
                          />
                          {isGenerating && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Text Generation Feature */}
                <div className="space-y-2">
                  <FormLabel>Aliases / Thai Name</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type alias & Enter (e.g. ชื่อไทย, ชื่อเล่น)"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAlias();
                        }
                      }}
                    />
                  </div>

                  {/* Tags Display */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.watch("aliases")?.map((alias, index) => (
                      <div key={index} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm">
                        <span>{alias}</span>
                        <button type="button" onClick={() => removeAlias(alias)} className="text-muted-foreground hover:text-foreground">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-detects character mentions using these names.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="protagonist">Protagonist</SelectItem>
                          <SelectItem value="antagonist">Antagonist</SelectItem>
                          <SelectItem value="supporting">Supporting</SelectItem>
                          <SelectItem value="minor">Minor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 25" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Female" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Species</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Human, Elf, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Character Image</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value}
                          onChange={field.onChange}
                          folder="characters"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Description Tab */}
              <TabsContent value="description" className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the character..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appearance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appearance</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Physical appearance..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personality</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Personality traits..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="backstory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backstory</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Character's background..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Character Depth Tab */}
              <TabsContent value="depth" className="space-y-4">
                <FormField
                  control={form.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goals</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What does this character want to achieve?"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motivation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivation</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Why do they pursue these goals?"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conflict"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal/External Conflict</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What challenges or conflicts do they face?"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="strengths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Strengths</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Character's strengths..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weaknesses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weaknesses</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Character's weaknesses..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Character"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}