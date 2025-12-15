"use client";

import { useDraggable } from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { User, MapPin, Lightbulb } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResourceSidebarProps {
  characters: any[];
  locations: any[];
  ideas: any[];
}

export function ResourceSidebar({
  characters,
  locations,
  ideas,
}: ResourceSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-background/50 border-r">
      <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-0">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="characters" title="Characters"><User className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="locations" title="Locations"><MapPin className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="ideas" title="Ideas"><Lightbulb className="w-4 h-4" /></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="characters" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {characters.map(char => (
                <DraggableResource
                  key={char.id}
                  id={char.id}
                  type="character"
                  title={char.name}
                  data={char}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="locations" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {locations.map(loc => (
                <DraggableResource
                  key={loc.id}
                  id={loc.id}
                  type="location"
                  title={loc.name}
                  data={loc}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ideas" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {ideas.map(idea => (
                <DraggableResource
                  key={idea.id}
                  id={idea.id}
                  type="idea"
                  title={idea.title}
                  data={idea}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DraggableResource({ id, type, title, data }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${type}-${id}`,
    data: {
      type,
      id: id,
      title,
      from: 'sidebar',
      ...data
    },
  });

  const borderColor =
    type === 'character' ? 'border-l-blue-500 hover:border-l-blue-600' :
      type === 'location' ? 'border-l-green-500 hover:border-l-green-600' :
        'border-l-yellow-500 hover:border-l-yellow-600';

  const iconColor =
    type === 'character' ? 'text-blue-500' :
      type === 'location' ? 'text-green-500' :
        'text-yellow-500';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        group flex items-center gap-2 p-2 rounded-md border border-l-2 bg-card cursor-grab active:cursor-grabbing hover:shadow-sm hover:translate-x-0.5 transition-all
        ${borderColor}
        ${isDragging ? "opacity-50 ring-2 ring-primary" : ""}
      `}
    >
      <div className={`shrink-0 ${iconColor}`}>
        {type === "character" && <User className="w-3.5 h-3.5" />}
        {type === "location" && <MapPin className="w-3.5 h-3.5" />}
        {type === "idea" && <Lightbulb className="w-3.5 h-3.5" />}
      </div>
      <span className="truncate text-xs font-medium text-foreground/90">{title}</span>
    </div>
  );
}