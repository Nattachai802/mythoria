"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ScrollText, Bug, MapPin } from "lucide-react";
import { ItemsView } from "./items-view";
import { LoreTimeline } from "./lore-timeline";
import { EntitiesView } from "./entities-view";
import { LocationsView } from "@/components/project/location/locations-view";
import { CreateLocationDialog } from "@/components/project/location/create-location-dialog";
import { LoreMonitor } from "./lore-monitor";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { checkGoogleConnected } from "@/server/drive-sync";
import { syncWorldBuilding } from "@/server/sheets-sync";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { useEffect } from "react";

interface WorldBuildingContentProps {
    novelId: string;
    novel: {
        id: string;
        title: string;
        characters?: { id: string; name: string }[];
        locations?: any[];
    };
    items: any[];
    loreEntries: any[];
    loreGroups: any[];
    eras: any[];
    entities: any[];
    connections: any[];
}

export function WorldBuildingContent({
    novelId,
    novel,
    items,
    loreEntries,
    loreGroups,
    eras,
    entities,
    connections,
}: WorldBuildingContentProps) {
    const router = useRouter();
    const characters = (novel as any).characters || [];
    const locations = (novel as any).locations || [];

    const [activeTab, setActiveTab] = useState("locations");
    const [googleConnected, setGoogleConnected] = useState(false);
    const [googleEmail, setGoogleEmail] = useState<string | undefined>(undefined);
    const [isSyncing, setIsSyncing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingStrategy, setPendingStrategy] = useState<"db-to-sheets" | "sheets-to-db" | null>(null);

    useEffect(() => {
        const checkConnection = async () => {
            const res = await checkGoogleConnected();
            setGoogleConnected(res.connected);
            setGoogleEmail(res.googleEmail);
        };
        checkConnection();
    }, []);

    useEffect(() => {
        const savedScroll = sessionStorage.getItem("scroll-position-worldbuilding");
        if (savedScroll) {
            const y = parseInt(savedScroll, 10);
            if (!isNaN(y)) {
                window.scrollTo({ top: y, behavior: "instant" as any });
            }
            sessionStorage.removeItem("scroll-position-worldbuilding");
        }
    }, [items, loreEntries, entities, locations]);

    const handleGoogleSheetsSync = async (strategy: "2-way" | "db-to-sheets" | "sheets-to-db" = "2-way") => {
        setIsSyncing(true);
        let message = "กำลังเริ่มการซิงก์ข้อมูลสองทางกับ Google Sheets...";
        if (strategy === "db-to-sheets") message = "กำลังส่งออกข้อมูลทั้งหมดไปยัง Google Sheets...";
        if (strategy === "sheets-to-db") message = "กำลังนำเข้าและเขียนทับข้อมูลในระบบเว็บจาก Google Sheets...";
        
        const toastId = toast.loading(message);
        
        try {
            const res = await syncWorldBuilding(novelId, strategy);
            if (res.success && res.spreadsheetUrl) {
                let successMsg = "ซิงก์ข้อมูลสองทางสำเร็จแล้ว!";
                if (strategy === "db-to-sheets") successMsg = "เขียนทับข้อมูลใน Google Sheets สำเร็จแล้ว!";
                if (strategy === "sheets-to-db") successMsg = "เขียนทับข้อมูลบนเว็บสำเร็จแล้ว!";
                
                toast.success(successMsg, {
                    id: toastId,
                    action: {
                        label: "เปิด Sheets",
                        onClick: () => window.open(res.spreadsheetUrl, "_blank")
                    }
                });
                sessionStorage.setItem("scroll-position-worldbuilding", window.scrollY.toString());
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาดในการซิงก์ข้อมูล", { id: toastId });
            }
        } catch (error: any) {
            toast.error(error?.message || "เกิดข้อผิดพลาดในการซิงก์ข้อมูล", { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRefresh = () => {
        sessionStorage.setItem("scroll-position-worldbuilding", window.scrollY.toString());
        router.refresh();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">🌍 World Building</h1>
                    <p className="text-muted-foreground mt-1">
                        จัดการสถานที่ ไอเทม ประวัติศาสตร์ และสิ่งมีชีวิตในโลกของคุณ
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {googleConnected && (
                        <div className="flex items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGoogleSheetsSync("2-way")}
                                disabled={isSyncing}
                                className="rounded-r-none gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/20 border-r-0"
                                title={googleEmail ? `ซิงก์บัญชี: ${googleEmail}` : "ซิงก์ไปยัง Google Sheets"}
                            >
                                {isSyncing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                )}
                                <span>ซิงก์ Google Sheets</span>
                            </Button>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isSyncing}
                                        className="rounded-l-none border-l-0 px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/20 h-[36px]"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleGoogleSheetsSync("2-way")} className="gap-2">
                                        <span className="text-base">🔄</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">ซิงก์สองทาง (2-Way Sync)</span>
                                            <span className="text-xs text-muted-foreground">ผสานข้อมูลความเปลี่ยนแปลงทั้งสองฝั่ง</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        setPendingStrategy("db-to-sheets");
                                        setConfirmOpen(true);
                                    }} className="gap-2">
                                        <span className="text-base text-amber-500">📤</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">เขียนทับ Google Sheets</span>
                                            <span className="text-xs text-muted-foreground text-amber-600 dark:text-amber-400">ใช้ข้อมูลในเว็บเขียนทับบนชีททั้งหมด</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        setPendingStrategy("sheets-to-db");
                                        setConfirmOpen(true);
                                    }} className="gap-2">
                                        <span className="text-base text-red-500">📥</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">เขียนทับข้อมูลบนเว็บ</span>
                                            <span className="text-xs text-muted-foreground text-red-600 dark:text-red-400">ใช้ข้อมูลในชีทเขียนทับเว็บ (ลบส่วนต่าง)</span>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                    <LoreMonitor novelId={novelId} onRefresh={handleRefresh} />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "locations" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("locations")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Locations</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{locations.length}</div>
                        <p className="text-xs text-muted-foreground">สถานที่และแผนที่</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "items" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("items")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Items</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{items.length}</div>
                        <p className="text-xs text-muted-foreground">ของวิเศษและอาวุธ</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "lore" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("lore")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Lore</CardTitle>
                        <ScrollText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loreEntries.length}</div>
                        <p className="text-xs text-muted-foreground">เหตุการณ์และตำนาน</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "entities" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("entities")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Entities</CardTitle>
                        <Bug className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{entities.length}</div>
                        <p className="text-xs text-muted-foreground">สิ่งมีชีวิตและมอนสเตอร์</p>
                    </CardContent>
                </Card>
            </div>

            {/* Create Location Button */}
            {activeTab === "locations" && (
                <div className="flex justify-end">
                    <CreateLocationDialog novelId={novelId} />
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-lg grid-cols-4">
                    <TabsTrigger value="locations" className="gap-2">
                        <MapPin className="h-4 w-4" />
                        Locations
                    </TabsTrigger>
                    <TabsTrigger value="items" className="gap-2">
                        <Package className="h-4 w-4" />
                        Items
                    </TabsTrigger>
                    <TabsTrigger value="lore" className="gap-2">
                        <ScrollText className="h-4 w-4" />
                        Lore
                    </TabsTrigger>
                    <TabsTrigger value="entities" className="gap-2">
                        <Bug className="h-4 w-4" />
                        Entities
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="locations" className="mt-6">
                    {locations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            <p className="text-lg mb-2">ยังไม่มีสถานที่</p>
                            <p className="text-sm mb-4">สร้างสถานที่แรกของคุณเพื่อเริ่มต้นสร้างโลก</p>
                            <CreateLocationDialog novelId={novelId} />
                        </div>
                    ) : (
                        <LocationsView
                            locations={locations}
                            connections={connections}
                            novelId={novelId}
                        />
                    )}
                </TabsContent>

                <TabsContent value="items" className="mt-6">
                    <ItemsView
                        items={items}
                        novelId={novelId}
                        characters={characters}
                        locations={locations}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>

                <TabsContent value="lore" className="mt-6">
                    <LoreTimeline
                        entries={loreEntries}
                        groups={loreGroups}
                        eras={eras}
                        novelId={novelId}
                        onRefresh={handleRefresh}
                        characters={characters}
                        locations={locations}
                        items={items}
                    />
                </TabsContent>

                <TabsContent value="entities" className="mt-6">
                    <EntitiesView
                        entities={entities}
                        novelId={novelId}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>
            </Tabs>

            {/* Warning Dialog สำหรับกรณีเขียนทับ (Overwrite) */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="border-red-200 dark:border-red-950 max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            <span>ยืนยันการดำเนินการเขียนทับข้อมูล</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 pt-2 text-sm">
                                {pendingStrategy === "db-to-sheets" ? (
                                    <>
                                        <p className="font-semibold text-foreground">คุณกำลังจะเขียนทับข้อมูลใน Google Sheets:</p>
                                        <p>
                                            ข้อมูลเดิมทั้งหมดบน Google Sheets จะถูกล้างและแทนที่ด้วยข้อมูลจากฐานข้อมูลหลักบนเว็บในปัจจุบัน ข้อมูลส่วนที่พิมพ์ค้างอยู่บนชีทแต่อยู่คนละที่กับในเว็บอาจสูญหายได้
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold text-red-600 dark:text-red-400">⚠️ คำเตือนสำคัญสำหรับการสูญเสียข้อมูล:</p>
                                        <p className="font-semibold text-foreground">
                                            คุณกำลังจะเขียนทับข้อมูลบนเว็บไซต์ด้วยข้อมูลจาก Google Sheets
                                        </p>
                                        <p className="text-muted-foreground">
                                            ข้อมูลต่างๆ ในระบบเว็บ (สถานที่, ไอเทม, เหตุการณ์ประวัติศาสตร์, สิ่งมีชีวิต) ที่<strong>ไม่มีอยู่บน Google Sheets</strong> จะถูก<strong>ลบออกจากฐานข้อมูลหลักอย่างถาวรทันที!</strong>
                                        </p>
                                        <p className="text-xs font-medium text-red-500 dark:text-red-400">
                                            * การดำเนินการนี้ไม่สามารถยกเลิกหรือกู้คืนได้ภายหลัง
                                        </p>
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingStrategy) {
                                    handleGoogleSheetsSync(pendingStrategy);
                                }
                            }}
                            className={pendingStrategy === "sheets-to-db" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-amber-600 text-white hover:bg-amber-500"}
                        >
                            ยืนยันเขียนทับข้อมูล
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

