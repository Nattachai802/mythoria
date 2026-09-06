"use client";

import { useDraggable } from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, Lightbulb, Search, X, Shield, Zap, Gem, PawPrint, Layers, PanelLeftClose, Trash2, Loader2 } from "lucide-react";
import { flattenSystemEntries } from "@/lib/participant-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteIdea } from "@/server/idea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResourceSidebarProps {
  characters: any[];
  locations: any[];
  ideas: any[];
  factions?: any[];
  powers?: any[];
  items?: any[];
  entities?: any[];
  worldSystems?: any[];
  onCollapse?: () => void;
}

// แถบ tab: ไอคอนอย่างเดียวจำไม่ได้ว่าอันไหนคืออะไร — ใส่ label กำกับทุกอัน และให้สูงพอสำหรับนิ้ว (44px)
const TABS = [
  { value: "characters", label: "ตัวละคร", icon: User },
  { value: "factions", label: "ฝ่าย", icon: Shield },
  { value: "locations", label: "สถานที่", icon: MapPin },
  { value: "powers", label: "พลัง", icon: Zap },
  { value: "entities", label: "สัตว์", aria: "สัตว์/ภูต", icon: PawPrint },
  { value: "items", label: "สิ่งของ", icon: Gem },
  { value: "systems", label: "ระบบ", aria: "ระบบโลก", icon: Layers },
  { value: "ideas", label: "ไอเดีย", icon: Lightbulb },
];

export function ResourceSidebar({
  characters,
  locations,
  ideas,
  factions = [],
  powers = [],
  items = [],
  entities = [],
  worldSystems = [],
  onCollapse,
}: ResourceSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  // คุม tab เอง เพื่อจองที่แถวฟิลเตอร์ไว้ทุก tab — ไม่ให้รายการเด้งตอนสลับ
  const [activeTab, setActiveTab] = useState("characters");
  // ลบไอเดียเป็นการลบถาวร — ต้องผ่านกล่องยืนยันเสมอ
  const [ideaToDelete, setIdeaToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();

  const confirmDeleteIdea = () => {
    if (!ideaToDelete) return;
    const { id, title } = ideaToDelete;
    startDelete(async () => {
      const res = await deleteIdea(id);
      if (res.success) {
        toast.success(`ลบไอเดีย "${title}" แล้ว`);
        setIdeaToDelete(null);
        router.refresh(); // ideas เป็น prop จาก server — refresh ให้รายการตรงกับ DB
      } else {
        toast.error(res.error ?? "ลบไอเดียไม่สำเร็จ");
      }
    });
  };

  // Filter Logic
  const filterItems = (items: any[], type: 'character' | 'location' | 'idea' | 'faction' | 'power' | 'item' | 'entity' | 'system') => {
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
  const filteredEntities = filterItems(entities, 'entity');
  // ระบบโลกลากเป็น "ระดับ" ทีละอัน ไม่ใช่ทั้งระบบ — ดูเหตุผลใน lib/participant-types.ts
  const filteredSystems = filterItems(flattenSystemEntries(worldSystems), 'system');
  const filteredIdeas = filterItems(ideas, 'idea');
  const filteredFactions = filterItems(factions, 'faction');

  // Role filters for characters
  const roles = [
    { label: 'ตัวเอก', value: 'protagonist', color: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
    { label: 'ตัวร้าย', value: 'antagonist', color: 'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300' },
    { label: 'ตัวสมทบ', value: 'supporting', color: 'bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-300' },
    { label: 'ตัวประกอบ', value: 'minor', color: 'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300' },
  ];

  return (
    <div className="h-full flex flex-col bg-background/50 border-r">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-0 space-y-2">
          {/* Tabs */}
          <div className="flex items-stretch gap-1">
            <TabsList className="flex-1 grid grid-cols-4 h-auto gap-x-0.5 gap-y-1 bg-transparent p-0">
              {TABS.map(({ value, label, aria, icon: Icon }: any) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  aria-label={aria ?? label}
                  title={aria ?? label}
                  className="chamfered-sm h-auto flex-col gap-1 rounded-none border border-border/40 bg-card/40 px-0.5 py-1.5 text-[11px] leading-none text-muted-foreground transition-colors hover:border-forge-amber/40 hover:text-foreground data-[state=active]:border-forge-amber/70 data-[state=active]:bg-forge-amber/15 data-[state=active]:text-forge-amber data-[state=active]:shadow-none"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span className="truncate max-w-full">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {onCollapse && (
              <Button
                variant="ghost"
                size="icon"
                className="h-auto w-9 shrink-0"
                aria-label="ย่อแถบทรัพยากร"
                title="ย่อแถบ"
                onClick={onCollapse}
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="ค้นหา..."
              aria-label="ค้นหาทรัพยากร"
              className="chamfered-sm h-8 rounded-none border-border/60 bg-card/40 pl-8 pr-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="ล้างคำค้นหา"
                className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* แถวฟิลเตอร์: สูงคงที่ทุก tab กันรายการเด้งตอนสลับ */}
        <div className="min-h-[41px] px-2 py-2 border-b flex gap-1.5 flex-wrap content-start">
          {activeTab === "characters" && (
            <>
              <button
                type="button"
                aria-pressed={!activeFilter}
                className={`chamfered-sm h-6 text-[11px] px-2.5 border transition-colors whitespace-nowrap shrink-0 ${!activeFilter ? 'bg-forge-amber/20 text-forge-amber border-forge-amber/60' : 'border-border/50 bg-card/40 text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveFilter(null)}
              >
                ทั้งหมด
              </button>
              {roles.map(role => (
                <button
                  key={role.value}
                  type="button"
                  aria-pressed={activeFilter === role.value}
                  onClick={() => setActiveFilter(activeFilter === role.value ? null : role.value)}
                  className={`
                    chamfered-sm h-6 text-[11px] px-2.5 border transition-colors whitespace-nowrap shrink-0
                    ${activeFilter === role.value
                      ? 'bg-forge-amber/20 text-forge-amber border-forge-amber/60'
                      : `${role.color} border-transparent`}
                  `}
                >
                  {role.label}
                </button>
              ))}
            </>
          )}
        </div>

        <TabsContent value="characters" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`characters-${searchQuery}-${activeFilter ?? "all"}`}
            items={filteredCharacters}
            empty={<EmptyResource query={searchQuery} label="ตัวละคร" filtered={!!activeFilter} />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="character" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="factions" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`factions-${searchQuery}`}
            items={filteredFactions}
            empty={<EmptyResource query={searchQuery} label="ฝ่าย" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="faction" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="locations" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`locations-${searchQuery}`}
            items={filteredLocations}
            empty={<EmptyResource query={searchQuery} label="สถานที่" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="location" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="powers" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`powers-${searchQuery}`}
            items={filteredPowers}
            empty={<EmptyResource query={searchQuery} label="พลัง" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="power" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="items" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`items-${searchQuery}`}
            items={filteredItems}
            empty={<EmptyResource query={searchQuery} label="สิ่งของ" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="item" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="entities" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`entities-${searchQuery}`}
            items={filteredEntities}
            empty={<EmptyResource query={searchQuery} label="สัตว์/ภูต" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="entity" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="systems" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`systems-${searchQuery}`}
            items={filteredSystems}
            empty={<EmptyResource query={searchQuery} label="ระบบโลก" hint="ระบบโลกต้องมี &quot;ระดับ&quot; อย่างน้อยหนึ่งระดับจึงจะลากมาใช้ได้" />}
            renderItem={(it: any) => (
              <DraggableResource key={it.id} id={it.id} type="system" title={it.name} data={it} />
            )}
          />
        </TabsContent>

        <TabsContent value="ideas" className="flex-1 p-0 m-0 overflow-hidden">
          <ResourceList
            key={`ideas-${searchQuery}`}
            items={filteredIdeas}
            empty={<EmptyResource query={searchQuery} label="ไอเดีย" hint="ไอเดียที่วางลงกระดานแล้วจะไม่แสดงในรายการนี้" />}
            renderItem={(it: any) => (
              <DraggableResource
                key={it.id}
                id={it.id}
                type="idea"
                title={it.title}
                data={it}
                onDelete={() => setIdeaToDelete({ id: it.id, title: it.title })}
              />
            )}
          />
        </TabsContent>

      </Tabs>

      <AlertDialog open={!!ideaToDelete} onOpenChange={(open) => !open && !isDeleting && setIdeaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบไอเดียนี้ถาวร?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{ideaToDelete?.title}&quot; จะถูกลบออกจากคลังไอเดียของโปรเจกต์ทั้งหมด ไม่ใช่แค่หน้านี้ และกู้คืนไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => { e.preventDefault(); confirmDeleteIdea(); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              ลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const PAGE_SIZE = 30;

// รายการยาว ๆ (ฝ่าย/ตัวละครเป็นร้อย) ไม่ควรเรนเดอร์ทีเดียวหมด — ตัดเป็นชุดละ 30 แล้วกดโหลดต่อ
// รีเซ็ตกลับหน้าแรกอัตโนมัติเมื่อคำค้น/ฟิลเตอร์เปลี่ยน เพราะ parent ใส่ key ใหม่ให้ (remount)
function ResourceList({ items, renderItem, empty }: { items: any[]; renderItem: (item: any) => React.ReactNode; empty: React.ReactNode }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;

  return (
    <ScrollArea className="h-full px-2 py-2">
      <div className="space-y-1.5">
        {items.length === 0 ? empty : (
          <>
            {shown.map(renderItem)}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="chamfered-sm w-full border border-border/50 bg-card/40 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-forge-amber/50 hover:text-foreground"
              >
                แสดงเพิ่ม (เหลืออีก {remaining})
              </button>
            )}
            {items.length > PAGE_SIZE && (
              <p className="pt-0.5 text-center text-[11px] text-muted-foreground/60">
                แสดง {shown.length} จาก {items.length}
              </p>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

// แยก "ค้นหาไม่เจอ" กับ "ยังไม่มีข้อมูล" — ข้อความเดียวกันทำให้เข้าใจผิดว่าข้อมูลหาย
// ponytail: ยังไม่มีลิงก์ไปหน้าสร้าง เพราะ sidebar ไม่รู้ projectId — เพิ่ม prop เมื่อต้องการปุ่มลัด
function EmptyResource({ query, label, filtered, hint }: { query: string; label: string; filtered?: boolean; hint?: string }) {
  if (query) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        ไม่พบ{label}ที่ตรงกับ &quot;{query}&quot;
      </p>
    );
  }
  if (filtered) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        ไม่มี{label}ในบทบาทที่เลือก
      </p>
    );
  }
  return (
    <div className="px-3 py-8 text-center space-y-1">
      <p className="text-xs text-muted-foreground">ยังไม่มี{label}ในโปรเจกต์นี้</p>
      <p className="text-[11px] text-muted-foreground/70">{hint ?? `สร้าง${label}ก่อน แล้วลากมาวางบนกระดานได้`}</p>
    </div>
  );
}

function resourceColors(type: string, data: any) {
  // สีตามชนิด/บทบาท — จุดสีเล็กแทนแถบขอบซ้าย (แถบขอบหนาข้างเดียวเป็นแพทเทิร์นที่ AI UI ใช้จนดูจำเจ)
  // ทุกสีต้องมีคู่ dark: เพราะโปรเจกต์มีธีมมืดจริง (app/globals.css)
  if (type === 'character') {
    switch (data?.role?.toLowerCase()) {
      case 'protagonist':
        return { dot: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/5' };
      case 'antagonist':
        return { dot: 'bg-red-500', icon: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/5' };
      case 'supporting':
        return { dot: 'bg-green-500', icon: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/5' };
      case 'minor':
      default:
        return { dot: 'bg-slate-400', icon: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/5' };
    }
  }
  if (type === 'location') return { dot: 'bg-green-500', icon: 'text-green-600 dark:text-green-400', bg: '' };
  if (type === 'faction') return { dot: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5' };
  if (type === 'power') return { dot: 'bg-purple-500', icon: 'text-purple-600 dark:text-purple-400', bg: '' };
  if (type === 'item') return { dot: 'bg-cyan-500', icon: 'text-cyan-600 dark:text-cyan-400', bg: '' };
  if (type === 'entity') return { dot: 'bg-orange-500', icon: 'text-orange-600 dark:text-orange-400', bg: '' };
  if (type === 'system') return { dot: 'bg-indigo-500', icon: 'text-indigo-600 dark:text-indigo-400', bg: '' };
  return { dot: 'bg-yellow-500', icon: 'text-yellow-600 dark:text-yellow-400', bg: '' };
}

// ป้ายบทบาทตัวละคร (ข้อความ ไม่ใช่สีเดียว — กันอ่านความหมายผ่านสีอย่างเดียว)
function roleLabelOf(type: string, data: any) {
  if (type !== 'character' || !data?.role) return null;
  switch (data.role.toLowerCase()) {
    case 'protagonist': return 'ตัวเอก';
    case 'antagonist': return 'ตัวร้าย';
    case 'supporting': return 'ตัวสมทบ';
    case 'minor': return 'ตัวประกอบ';
    default: return null;
  }
}

const RESOURCE_ICONS: Record<string, any> = {
  character: User,
  faction: Shield,
  location: MapPin,
  power: Zap,
  item: Gem,
  entity: PawPrint,
  system: Layers,
  idea: Lightbulb,
};

// หน้าตาแถวทรัพยากร ใช้ร่วมกันระหว่างใน sidebar กับ DragOverlay
// ตอนลากต้องเป็นชิ้นเดิมที่ติดมือ ไม่ใช่กระโดดไปเป็นการ์ดใหญ่บนกระดาน
export function ResourceChip({ type, title, data, overlay, onDelete }: { type: string; title: string; data?: any; overlay?: boolean; onDelete?: () => void }) {
  const colors = resourceColors(type, data);
  const Icon = RESOURCE_ICONS[type] ?? Lightbulb;
  const roleLabel = roleLabelOf(type, data);

  return (
    <div
      className={`
        chamfered-sm flex items-center gap-2 p-2 border bg-card
        ${colors.bg}
        ${overlay
          ? 'w-[224px] border-forge-amber/70 shadow-lg shadow-black/20 -rotate-2 scale-[1.03] cursor-grabbing'
          : 'border-border/60 transition-colors group-hover:border-forge-amber/50 group-hover:shadow-sm'}
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
      <div className={`shrink-0 ${colors.icon}`} aria-hidden="true">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="truncate text-xs font-medium text-foreground/90 flex-1">{title}</span>
      {roleLabel && <span className="text-[11px] text-muted-foreground shrink-0">{roleLabel}</span>}
      {onDelete && !overlay && (
        <button
          type="button"
          aria-label={`ลบไอเดีย ${title}`}
          // หยุด pointer ไว้ตรงนี้ ไม่งั้นการกดปุ่มจะกลายเป็นการเริ่มลากการ์ด
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 -my-1 -mr-1 h-6 w-6 flex items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function DraggableResource({ id, type, title, data, onDelete }: any) {
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // ตอนลาก: ทิ้งช่องว่างเส้นประไว้ที่เดิม (รู้ว่ามาจากไหน) แทนวงแหวนสีทับตัวการ์ด
      className={`
        group cursor-grab active:cursor-grabbing transition-[opacity,transform] duration-150
        ${isDragging ? 'opacity-40 grayscale' : 'hover:translate-x-0.5'}
      `}
    >
      <ResourceChip type={type} title={title} data={data} onDelete={onDelete} />
    </div>
  );
}
