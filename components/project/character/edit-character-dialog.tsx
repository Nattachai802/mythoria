"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Loader2 } from "lucide-react";
import { updateCharacter } from "@/server/character";
import { generateThaiAliases } from "@/server/ai";
import { toast } from "sonner";
import { Character } from "@/db/schema";
import { ImageUpload } from "@/components/ui/image-upload";
import { useRouter } from "next/navigation";

const characterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
  age: z.string().optional(),
  gender: z.string().optional(),
  species: z.string().optional(),
  image: z.string().optional(),
  aliases: z.array(z.string()).optional(),
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

interface EditCharacterDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCharacterDialog({
  character,
  open,
  onOpenChange,
}: EditCharacterDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aliasInput, setAliasInput] = useState("");

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character.name || "",
      role: character.role as any || "supporting",
      age: character.age || "",
      gender: character.gender || "",
      species: character.species || "",
      image: character.image || "",
      aliases: ((character as any).aliases as string[]) || [],
      description: character.description || "",
      appearance: character.appearance || "",
      personality: character.personality || "",
      backstory: character.backstory || "",
      goals: character.goals || "",
      motivation: character.motivation || "",
      conflict: character.conflict || "",
      strengths: character.strengths || "",
      weaknesses: character.weaknesses || "",
    },
  });

  // Reset form when character changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: character.name || "",
        role: character.role as any || "supporting",
        age: character.age || "",
        gender: character.gender || "",
        species: character.species || "",
        image: character.image || "",
        aliases: ((character as any).aliases as string[]) || [], // Reset aliases
        description: character.description || "",
        appearance: character.appearance || "",
        personality: character.personality || "",
        backstory: character.backstory || "",
        goals: character.goals || "",
        motivation: character.motivation || "",
        conflict: character.conflict || "",
        strengths: character.strengths || "",
        weaknesses: character.weaknesses || "",
      });
    }
  }, [character, open, form]);

  const onSubmit = async (data: CharacterFormData) => {
    setIsSubmitting(true);
    const result = await updateCharacter(character.id, data);

    if (result.success) {
      toast.success("Character updated successfully");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update character");
    }
    setIsSubmitting(false);
  };

  const handleAutoGenerateThaiName = async () => {
    const currentName = form.getValues("name");
    if (!currentName || isGenerating) return;

    setIsGenerating(true);
    try {
      const generatedAliases = await generateThaiAliases(currentName);

      if (generatedAliases && generatedAliases.length > 0) {
        const currentAliases = (form.getValues("aliases") as string[]) || [];
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Character</DialogTitle>
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
                            placeholder="Character name"
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              handleAutoGenerateThaiName();
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

                {/* Aliases Section */}
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}