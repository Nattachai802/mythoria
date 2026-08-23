import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { HeroGraph } from "@/components/landing/hero-graph";
import {
  BookOpen,
  Users,
  Map,
  Sparkles,
  Lightbulb,
  GitBranch,
  Feather,
  ArrowRight,
  Zap,
  Shield,
  Star,
  PenTool,
  Layers,
  Brain,
  ChevronRight,
  Network,
  BookMarked,
  ShieldCheck,
  Waypoints,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  FileText,
  Sliders,
  Database,
  Search,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-forge-amber to-forge-yellow flex items-center justify-center chamfered-sm">
              <Feather className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-xl font-display">Mythoria</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#pain-points" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ทำไมต้อง Mythoria
            </Link>
            <Link href="#pillars" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              3 เสาหลักระบบ
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ขั้นตอนการทำงาน
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link href="/login">เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild className="bg-forge-gold text-background hover:bg-forge-amber font-medium transition-colors forge-btn-hover chamfered-sm">
              <a href="/api/guest">
                ลองเล่นเลย
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden grid-pattern-subtle noise-texture">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-forge-gold/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-forge-amber/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-gold/10 border border-forge-gold/25 mb-8 chamfered-sm">
            <Sparkles className="w-3.5 h-3.5 text-forge-gold" />
            <span className="text-xs font-technical tracking-wider text-forge-gold uppercase">
              The AI-Powered Forge for Your Next Masterpiece
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display tracking-tight mb-6">
            <span className="block">เปลี่ยนต้นฉบับในหัว</span>
            <span className="block text-forge-gold text-glow-gold">
              ให้เป็นนิยายที่ไร้รูรั่ว
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            ลืมการเปิดโน้ตกระจัดกระจาย Mythoria ถักทอตัวละคร พล็อต พลัง และตำนานเข้าด้วยกัน
            พร้อม AI และ Plot Analysis Engine ตรวจสอบความขัดแย้งของเนื้อหาให้อัตโนมัติ
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Button size="lg" asChild className="h-12 px-8 text-base bg-forge-gold text-background hover:bg-forge-amber font-semibold shadow-lg shadow-forge-gold/15 transition-all forge-btn-hover chamfered">
              <a href="/api/guest">
                ลองเล่นโหมดผู้เยี่ยมชม
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base border-steel-600 hover:bg-muted/50 chamfered">
              <Link href="/login">
                เข้าสู่ระบบด้วยบัญชีจริง
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-14">
            เข้าทดลองใช้งานนิยายเดโมที่มีข้อมูลครบได้ทันที · ไม่ต้องกรอกบัตรหรือสมัครสมาชิก
          </p>

          <HeroGraph />
        </div>
      </section>

      {/* Pain Points vs Mythoria Solution Section */}
      <section id="pain-points" className="py-20 relative border-t border-border/50 bg-muted/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              ก้าวข้ามขีดจำกัดเดิมๆ ของการเขียนนิยาย
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              เมื่อเรื่องยาวขึ้น ความซับซ้อนก็เพิ่มขึ้น Mythoria ถูกสร้างมาเพื่อแก้ปัญหาที่นักเขียนทุกคนต้องเจอ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Nightmare Card */}
            <div className="p-8 rounded-2xl bg-destructive/5 border border-destructive/20 relative chamfered-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-display text-destructive">ฝันร้ายของนักเขียนทั่วไป</h3>
              </div>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive font-bold shrink-0">×</span>
                  <span><strong>ปมหาย ตัวละครหาย:</strong> เขียนถึงบทที่ 30 แต่ลืมปมที่หว่านไว้ในบทแรกๆ</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive font-bold shrink-0">×</span>
                  <span><strong>พล็อตหลุด Logic พัง:</strong> ตัวละครที่ตายไปแล้วเผลอกลับมาโผล่ซ้ำ หรือพลังขัดกับกฎโลก</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive font-bold shrink-0">×</span>
                  <span><strong>สำนวนแกว่ง:</strong> ยิ่งเขียนไปนาน จังหวะประโยคและน้ำเสียงการบรรยายเริ่มเพี้ยนไปจากเดิม</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive font-bold shrink-0">×</span>
                  <span><strong>โน้ตกระจัดกระจาย:</strong> เก็บข้อมูลไว้ในหลายแอปจนหาไม่เจอเมื่อต้องใช้จริง</span>
                </li>
              </ul>
            </div>

            {/* Mythoria Solution Card */}
            <div className="p-8 rounded-2xl bg-forge-gold/5 border border-forge-gold/30 relative chamfered-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-forge-gold/10 flex items-center justify-center text-forge-gold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-display text-forge-gold">ทางออกด้วย Mythoria Forge</h3>
              </div>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="text-forge-gold font-bold shrink-0">✓</span>
                  <span><strong>Plot Engine ตรวจให้:</strong> คำนวณ 5 กฎดักจับปมค้าง (Unpaid Threads) และตัวละครที่โผล่แล้วหาย</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-forge-gold font-bold shrink-0">✓</span>
                  <span><strong>Consistency Guardian:</strong> ตรวจสอบความขัดแย้งของข้อมูลแบบ Deterministic ชัวร์ ไม่หลอน</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-forge-gold font-bold shrink-0">✓</span>
                  <span><strong>Stylometry Analysis:</strong> วัดกราฟจังหวะประโยค และคุมลายนิ้วมือการเขียน (#1-#5) ให้อยู่กับที่</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-forge-gold font-bold shrink-0">✓</span>
                  <span><strong>World Graph & Context Fabric:</strong> เชื่อมทุก Entity ถึงกันแบบ MCP ถามอะไรบรรณารักษ์ก็ตอบได้</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars Section */}
      <section id="pillars" className="py-20 relative border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              3 เสาหลักเพื่อการสร้างสรรค์ระดับมาสเตอร์พีซ
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              ออกแบบระบบครอบคลุมทุกระยะของการทำนิยาย ตั้งแต่วางแผน ลงมือเขียน ไปจนถึงการตรวจทานขั้นสูง
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/80 hover:border-forge-gold/50 transition-all duration-300 chamfered-lg">
              <div className="w-12 h-12 rounded-xl bg-forge-gold/10 border border-forge-gold/20 flex items-center justify-center text-forge-gold mb-6">
                <Network className="w-6 h-6" />
              </div>
              <span className="text-xs font-technical uppercase text-forge-gold tracking-wider block mb-2">Pillar 01</span>
              <h3 className="text-xl font-bold font-display mb-3">วางโลกและพล็อต (World & Plot)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                รวบรวม Story Bible, Factions, Power Systems และสถานที่เข้าด้วยกันบน World Graph พร้อม Plot Analysis Engine ตรวจสอบความสมบูรณ์ของโครงเรื่องก่อนเขียนจริง
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border/40 pt-4">
                <li className="flex items-center gap-2">• Story Bible Import สกัดข้อมูลอัตโนมัติ</li>
                <li className="flex items-center gap-2">• Plot Spine & 5 Structural Checks</li>
                <li className="flex items-center gap-2">• Google Sheets Dual Sync</li>
              </ul>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/80 hover:border-forge-gold/50 transition-all duration-300 chamfered-lg">
              <div className="w-12 h-12 rounded-xl bg-forge-gold/10 border border-forge-gold/20 flex items-center justify-center text-forge-gold mb-6">
                <PenTool className="w-6 h-6" />
              </div>
              <span className="text-xs font-technical uppercase text-forge-gold tracking-wider block mb-2">Pillar 02</span>
              <h3 className="text-xl font-bold font-display mb-3">เขียนอย่างมีสมาธิ (Writing Studio)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                พื้นที่เขียนแบบ A5 Focus View พร้อม Smart Sidebar แสดงตัวละครและเหตุการณ์ประจำตอน มี Echo Score คาดเดาจังหวะความหักมุม และ Power Rules คุม AI ไม่ให้หลุดกติกา
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border/40 pt-4">
                <li className="flex items-center gap-2">• Quill Editor A5 Page View</li>
                <li className="flex items-center gap-2">• Echo Score Twist Predictability</li>
                <li className="flex items-center gap-2">• Power Rules Engine (Hard/Soft)</li>
              </ul>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/80 hover:border-forge-gold/50 transition-all duration-300 chamfered-lg">
              <div className="w-12 h-12 rounded-xl bg-forge-gold/10 border border-forge-gold/20 flex items-center justify-center text-forge-gold mb-6">
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-xs font-technical uppercase text-forge-gold tracking-wider block mb-2">Pillar 03</span>
              <h3 className="text-xl font-bold font-display mb-3">ตรวจทานระดับสถิติ (Analytics & Voice)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                วิเคราะห์สำนวนเขียน (Stylometry #1-#5) ตรวจกราฟความยาวประโยค อารมณ์ และความหลากหลายของคำ พร้อม Consistency Guardian ทำหน้าที่เป็นผู้ช่วยตรวจความถูกต้อง
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border/40 pt-4">
                <li className="flex items-center gap-2">• Author Fingerprint & Rhythm Curve</li>
                <li className="flex items-center gap-2">• Consistency Guardian ดักข้อมูลขัดแย้ง</li>
                <li className="flex items-center gap-2">• Librarian Q&A ถามตอบจาก Canon</li>
              </ul>
            </div>
          </div>

          {/* Quick Features Matrix */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              [<Database key="1" className="w-4 h-4 text-forge-gold" />, "World Systems (JSONB)"],
              [<FileText key="2" className="w-4 h-4 text-forge-gold" />, "Paragraph Rewrite & Diff"],
              [<Shield key="3" className="w-4 h-4 text-forge-gold" />, "Data Isolation & Auth"],
              [<Search key="4" className="w-4 h-4 text-forge-gold" />, "Global Search & Mentions"],
            ].map(([icon, label]) => (
              <div key={label as string} className="flex items-center gap-2.5 p-3 rounded-lg bg-card/30 border border-border/50 text-xs text-muted-foreground">
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-muted/20 border-y border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 grid-pattern-subtle opacity-50" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">ขั้นตอนการทำงานที่ลื่นไหล</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              เริ่มต้นสร้างสรรค์ผลงานอย่างเป็นระบบด้วย 3 ขั้นตอนง่ายๆ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="1. สกัดข้อมูลและสร้างโลก"
              description="นำเข้าเอกสาร Story Bible หรือออกแบบตัวละคร สถานที่ และระบบโลกขึ้นมาใหม่บน Idea Playground"
            />
            <StepCard
              number={2}
              title="2. ตรวจสอบพล็อต & ลงมือเขียน"
              description="วางกระดูกสันหลังของฉาก (Scene Spine) ให้ Plot Engine วิเคราะห์หาจุดรั่ว แล้วเขียนบทเรียนในกระดาษ A5"
            />
            <StepCard
              number={3}
              title="3. ตรวจทานและคุมสำนวน"
              description="ใช้ Stylometry ตรวจสอบลายนิ้วมือสำนวนการเขียน รัน Consistency Guardian และซิงค์ขึ้น Google Drive/Sheets"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden grid-pattern-subtle noise-texture">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-forge-gold/5 via-transparent to-forge-amber/5" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-forge-gold text-background mb-6 glow-gold chamfered-lg">
            <PenTool className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">ทดลองใช้งานได้ทันที</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            เข้าสำรวจแอปพลิเคชันผ่านโหมดผู้เยี่ยมชม พร้อมนิยายตัวอย่างที่มีข้อมูลพล็อต ตัวละคร และระบบโลกสมบูรณ์แบบ
          </p>
          <Button size="lg" asChild className="h-12 px-8 text-base bg-forge-gold text-background hover:bg-forge-amber font-semibold shadow-lg shadow-forge-gold/15 transition-all forge-btn-hover chamfered">
            <a href="/api/guest">
              เข้าสู่ระบบโหมดผู้เยี่ยมชม
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-forge-gold flex items-center justify-center chamfered-sm">
                <Feather className="w-4 h-4 text-black" />
              </div>
              <span className="font-bold text-xl font-display">Mythoria</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Mythoria. The AI-Powered Novel Forge.
            </p>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Theme Toggle */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="p-1.5 rounded-xl bg-card/60 backdrop-blur-md border border-border/80 shadow-lg hover:border-forge-gold/50 hover:shadow-forge-gold/5 transition-all duration-300">
          <ModeToggle />
        </div>
      </div>
    </main>
  );
}

// Step Card Component
function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/80 chamfered-lg text-center">
      <div className="w-12 h-12 rounded-full bg-forge-gold text-background border-4 border-background flex items-center justify-center font-technical font-bold text-xl mx-auto mb-4 glow-gold">
        {number}
      </div>
      <h3 className="text-lg font-semibold font-display mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}