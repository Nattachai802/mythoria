"use client";

import { useDraggable } from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { User, MapPin, Lightbulb, Search, Filter, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Filter Logic
  const filterItems = (items: any[], type: 'character' | 'location' | 'idea') => {
    return items.filter(item => {
      // 1. Text Search
      const resourceName = type === 'character' || type === 'location' ? item.name : item.title;
      const matchesSearch = resourceName?.toLowerCase().includes(searchQuery.toLowerCase()) || false;

      // 2. Role Filter (Only for characters)
      let matchesFilter = true;
      if (type === 'character' && activeFilter) {
        matchesFilter = item.role?.toLowerCase() === activeFilter.toLowerCase();
      }

      // 3. Idea specific: only show unused
      if (type === 'idea') {
        return matchesSearch && !item.isUsed;
      }

      return matchesSearch && matchesFilter;
    });
  };

  const filteredCharacters = filterItems(characters, 'character');
  const filteredLocations = filterItems(locations, 'location');
  const filteredIdeas = filterItems(ideas, 'idea');

  // Role filters for characters
  const roles = [
    { label: 'Protagonist', value: 'protagonist', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    { label: 'Antagonist', value: 'antagonist', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
    { label: 'Supporting', value: 'supporting', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { label: 'Minor', value: 'minor', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  ];

  return (
    <div className="h-full flex flex-col bg-background/50 border-r">
      <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-0 space-y-2">
          {/* Tabs */}
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="characters" title="Characters"><User className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="locations" title="Locations"><MapPin className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="ideas" title="Ideas"><Lightbulb className="w-4 h-4" /></TabsTrigger>
          </TabsList>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="h-8 pl-8 text-xs bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Character Filters (conditionally shown or always shown but functional only on chars tab? 
              Lets simplify effectively: show filters if active tab is characters OR just show them always but they only affect characters) 
             Let's show them conditionally based on tab. Wait, Tabs content is separated. 
             If we put filters outside TransContent, they show for all tabs. 
             Ideally filter pills are most useful for characters. */}

          {/* We can inspect the active tab via state if we wanted, but for now let's put the filter pills INSIDE the characters tab content or just make them generic. 
              Actually, let's put them below search, only active when filtering characters.
              But since Shadcn Tabs don't expose active state easily without being controlled, 
              Let's just show them. If user filters 'Protagonist' while on Locations, it just does nothing or we assume user knows.
              BETTER: Put Filter bar inside TabsContent for Characters.
           */}
        </div>

        <TabsContent value="characters" className="flex-1 p-0 m-0 flex flex-col">
          {/* Filter Pills */}
          <div className="px-2 py-2 flex gap-1.5 flex-wrap content-start border-b">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 text-[10px] px-2.5 rounded-full border shrink-0 ${!activeFilter ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}
              onClick={() => setActiveFilter(null)}
            >
              All
            </Button>
            {roles.map(role => (
              <button
                key={role.value}
                onClick={() => setActiveFilter(activeFilter === role.value ? null : role.value)}
                className={`
                            h-6 text-[10px] px-2.5 rounded-full border transition-colors whitespace-nowrap shrink-0
                            ${activeFilter === role.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : `${role.color} border-transparent bg-opacity-70`}
                        `}
              >
                {role.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 overflow-hidden px-2 pb-2">
            <div className="space-y-1.5">
              {filteredCharacters.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">No characters found</div>
              ) : (
                filteredCharacters.map(char => (
                  <DraggableResource
                    key={char.id}
                    id={char.id}
                    type="character"
                    title={char.name}
                    data={char}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="locations" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {filteredLocations.map(loc => (
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
          {/* Tag/Category filters for ideas could go here in future */}
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {filteredIdeas.map(idea => (
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

  // Get colors based on type and role
  const getColors = () => {
    if (type === 'character') {
      // Color based on character role
      switch (data?.role?.toLowerCase()) {
        case 'protagonist':
          return {
            border: 'border-l-amber-500 hover:border-l-amber-600',
            icon: 'text-amber-500',
            bg: 'bg-amber-50/50'
          };
        case 'antagonist':
          return {
            border: 'border-l-red-500 hover:border-l-red-600',
            icon: 'text-red-500',
            bg: 'bg-red-50/50'
          };
        case 'supporting':
          return {
            border: 'border-l-green-300 hover:border-l-green-400',
            icon: 'text-green-300',
            bg: 'bg-green-50/50'
          };
        case 'minor':
        default:
          return {
            border: 'border-l-slate-400 hover:border-l-slate-500',
            icon: 'text-slate-400',
            bg: 'bg-slate-50/50'
          };
      }
    }
    if (type === 'location') {
      return {
        border: 'border-l-green-500 hover:border-l-green-600',
        icon: 'text-green-500',
        bg: ''
      };
    }
    // idea
    return {
      border: 'border-l-yellow-500 hover:border-l-yellow-600',
      icon: 'text-yellow-500',
      bg: ''
    };
  };

  const colors = getColors();

  // Role label for characters
  const getRoleLabel = () => {
    if (type !== 'character' || !data?.role) return null;
    const role = data.role.toLowerCase();
    switch (role) {
      case 'protagonist': return '⭐';
      case 'antagonist': return '👿';
      case 'supporting': return '👤';
      default: return null;
    }
  };

  const roleLabel = getRoleLabel();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        group flex items-center gap-2 p-2 rounded-md border border-l-2 bg-card cursor-grab active:cursor-grabbing hover:shadow-sm hover:translate-x-0.5 transition-all
        ${colors.border}
        ${colors.bg}
        ${isDragging ? "opacity-50 ring-2 ring-primary" : ""}
      `}
    >
      <div className={`shrink-0 ${colors.icon}`}>
        {type === "character" && <User className="w-3.5 h-3.5" />}
        {type === "location" && <MapPin className="w-3.5 h-3.5" />}
        {type === "idea" && <Lightbulb className="w-3.5 h-3.5" />}
      </div>
      <span className="truncate text-xs font-medium text-foreground/90 flex-1">{title}</span>
      {roleLabel && (
        <span className="text-xs shrink-0" title={data.role}>{roleLabel}</span>
      )}
    </div>
  );
}