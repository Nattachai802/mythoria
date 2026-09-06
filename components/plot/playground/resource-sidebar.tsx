"use client";

import { useDraggable } from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { User, MapPin, Lightbulb, Search, Filter, X, Shield, Zap, Gem, PanelLeftClose } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ResourceSidebarProps {
  characters: any[];
  locations: any[];
  ideas: any[];
  factions?: any[];
  powers?: any[];
  items?: any[];
  onCollapse?: () => void;
}

export function ResourceSidebar({
  characters,
  locations,
  ideas,
  factions = [],
  powers = [],
  items = [],
  onCollapse,
}: ResourceSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Filter Logic
  const filterItems = (items: any[], type: 'character' | 'location' | 'idea' | 'faction' | 'power' | 'item') => {
    return items.filter(item => {
      // 1. Text Search
      const resourceName = type === 'idea' ? item.title : item.name; // มีแต่ idea ที่ใช้ title
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
  const filteredPowers = filterItems(powers, 'power');
  const filteredItems = filterItems(items, 'item');
  const filteredIdeas = filterItems(ideas, 'idea');
  const filteredFactions = filterItems(factions, 'faction');

  // Role filters for characters
  const roles = [
    { label: 'ตัวเอก', value: 'protagonist', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    { label: 'ตัวร้าย', value: 'antagonist', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
    { label: 'ตัวสมทบ', value: 'supporting', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { label: 'ตัวประกอบ', value: 'minor', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  ];

  return (
    <div className="h-full flex flex-col bg-background/50 border-r">
      <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-0 space-y-2">
          {/* Tabs */}
          <div className="flex items-center gap-1">
          <TabsList className="flex-1 grid grid-cols-6 h-9">
            <TabsTrigger value="characters" title="ตัวละคร"><User className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="factions" title="ฝ่าย"><Shield className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="locations" title="สถานที่"><MapPin className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="powers" title="พลัง"><Zap className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="items" title="สิ่งของ"><Gem className="w-4 h-4" /></TabsTrigger>
            <TabsTrigger value="ideas" title="ไอเดีย"><Lightbulb className="w-4 h-4" /></TabsTrigger>
          </TabsList>
          {onCollapse && (
            <Button variant="ghost" size="icon" className="h-9 w-8 shrink-0" title="ย่อแถบ" onClick={onCollapse}>
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          )}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหา..."
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
              ทั้งหมด
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
                <div className="text-center py-4 text-xs text-muted-foreground">ไม่พบตัวละคร</div>
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

        <TabsContent value="factions" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {filteredFactions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">ไม่พบฝ่าย</div>
              ) : (
                filteredFactions.map(faction => (
                  <DraggableResource
                    key={faction.id}
                    id={faction.id}
                    type="faction"
                    title={faction.name}
                    data={faction}
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

        <TabsContent value="powers" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {filteredPowers.map(power => (
                <DraggableResource
                  key={power.id}
                  id={power.id}
                  type="power"
                  title={power.name}
                  data={power}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="items" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full px-2 py-2">
            <div className="space-y-1.5">
              {filteredItems.map(it => (
                <DraggableResource
                  key={it.id}
                  id={it.id}
                  type="item"
                  title={it.name}
                  data={it}
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
      ...data,
      // resource kind ต้องมาทีหลังเสมอ — กัน field ชื่อชนกัน (เช่น faction.type = "ORGANIZATION") ทับ kind ที่ตั้งใจไว้
      type,
      id: id,
      title,
      from: 'sidebar',
    },
  });

  // สีตามชนิด/บทบาท — จุดสีเล็กแทนแถบขอบซ้าย (แถบขอบหนาข้างเดียวเป็นแพทเทิร์นที่ AI UI ใช้จนดูจำเจ)
  const getColors = () => {
    if (type === 'character') {
      switch (data?.role?.toLowerCase()) {
        case 'protagonist':
          return { dot: 'bg-amber-500', icon: 'text-amber-500', bg: 'bg-amber-500/5' };
        case 'antagonist':
          return { dot: 'bg-red-500', icon: 'text-red-500', bg: 'bg-red-500/5' };
        case 'supporting':
          return { dot: 'bg-green-400', icon: 'text-green-400', bg: 'bg-green-500/5' };
        case 'minor':
        default:
          return { dot: 'bg-slate-400', icon: 'text-slate-400', bg: 'bg-slate-500/5' };
      }
    }
    if (type === 'location') {
      return { dot: 'bg-green-500', icon: 'text-green-500', bg: '' };
    }
    if (type === 'faction') {
      return { dot: 'bg-emerald-500', icon: 'text-emerald-500', bg: 'bg-emerald-500/5' };
    }
    // idea
    return { dot: 'bg-yellow-500', icon: 'text-yellow-500', bg: '' };
  };

  const colors = getColors();

  // ป้ายบทบาทตัวละคร (ข้อความ ไม่ใช่สีเดียว — กันอ่านความหมายผ่านสีอย่างเดียว)
  const getRoleLabel = () => {
    if (type !== 'character' || !data?.role) return null;
    switch (data.role.toLowerCase()) {
      case 'protagonist': return 'ตัวเอก';
      case 'antagonist': return 'ตัวร้าย';
      case 'supporting': return 'ตัวสมทบ';
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
        group flex items-center gap-2 p-2 rounded-md border border-border/60 bg-card cursor-grab active:cursor-grabbing hover:shadow-sm hover:translate-x-0.5 transition-all
        ${colors.bg}
        ${isDragging ? "opacity-50 ring-2 ring-primary" : ""}
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
      <div className={`shrink-0 ${colors.icon}`}>
        {type === "character" && <User className="w-3.5 h-3.5" />}
        {type === "faction" && <Shield className="w-3.5 h-3.5" />}
        {type === "location" && <MapPin className="w-3.5 h-3.5" />}
        {type === "power" && <Zap className="w-3.5 h-3.5 text-purple-500" />}
        {type === "item" && <Gem className="w-3.5 h-3.5 text-cyan-600" />}
        {type === "idea" && <Lightbulb className="w-3.5 h-3.5" />}
      </div>
      <span className="truncate text-xs font-medium text-foreground/90 flex-1">{title}</span>
      {roleLabel && (
        <span className="text-[10px] text-muted-foreground shrink-0">{roleLabel}</span>
      )}
    </div>
  );
}