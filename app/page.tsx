import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
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
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-forge-gold text-background hover:bg-forge-amber font-medium transition-colors forge-btn-hover chamfered-sm">
              <Link href="/dashboard">
                Start Writing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-forge-gold/5 to-forge-amber/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-gold/10 border border-forge-gold/25 mb-8 chamfered-sm">
            <Sparkles className="w-3.5 h-3.5 text-forge-gold" />
            <span className="text-xs font-technical tracking-wider text-forge-gold uppercase">
              AI-Powered Novel Writing Platform
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display tracking-tight mb-6">
            <span className="block">Craft Your Story</span>
            <span className="block text-forge-gold text-glow-gold">
              Like Never Before
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The ultimate platform for plotting, character building, and writing your next masterpiece.
            Visualize your story with AI-powered tools.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" asChild className="h-12 px-8 text-base bg-forge-gold text-background hover:bg-forge-amber font-semibold shadow-lg shadow-forge-gold/15 transition-all forge-btn-hover chamfered">
              <Link href="/dashboard">
                Start Writing Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base border-steel-600 hover:bg-muted/50 chamfered">
              <Link href="#features">
                Explore Features
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 relative border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">Everything You Need to Write</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From initial idea to final draft, Mythoria gives you powerful, state-of-the-art tools to craft your best work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Brain className="w-5 h-5" />}
              title="Author Fingerprint & Stylometry"
              description="AI analyzes your vocabulary richness, sentence length, and pacing to ensure your unique writing style never drifts off course."
            />
            <FeatureCard
              icon={<GitBranch className="w-5 h-5" />}
              title="Two-Way Google Drive Sync"
              description="Automatically sync your chapters to Google Docs. Edit anywhere—our smart 3-way merge engine handles conflicts seamlessly."
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5" />}
              title="Immersive Writing Studio"
              description="Write without distractions using Zen Mode and Typewriter Mode. Track every change with detailed version history."
            />
            <FeatureCard
              icon={<Map className="w-5 h-5" />}
              title="Deep World Building"
              description="Create rich Characters, Locations, Items, and Powers. Keep all your lore interconnected and accessible instantly."
            />
            <FeatureCard
              icon={<Lightbulb className="w-5 h-5" />}
              title="Interactive Ideas Board"
              description="A visual kanban board for your creative sparks. Attach entities, tag storylines, and link ideas directly to your chapters."
            />
            <FeatureCard
              icon={<PenTool className="w-5 h-5" />}
              title="Drag & Drop Organization"
              description="Restructure your entire novel effortlessly. Drag and drop chapters, reorder folders, and keep your narrative flowing perfectly."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/20 border-y border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 grid-pattern-subtle opacity-50" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive workflow built specifically for novelists and worldbuilders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Build Your Universe"
              description="Map out your Characters, Locations, and Powers. Brainstorm on the Ideas board before you even write a single word."
            />
            <StepCard
              number={2}
              title="Write & Analyze"
              description="Draft your chapters in Zen Mode. Let our Stylometry AI run Author Fingerprint checks to keep your tone consistent."
            />
            <StepCard
              number={3}
              title="Sync & Collaborate"
              description="Push your drafts securely to Google Drive. Edit from your phone, and let Mythoria merge changes automatically."
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
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">Ready to Write Your Masterpiece?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of writers who trust Mythoria to bring their stories to life.
          </p>
          <Button size="lg" asChild className="h-12 px-8 text-base bg-forge-gold text-background hover:bg-forge-amber font-semibold shadow-lg shadow-forge-gold/15 transition-all forge-btn-hover chamfered">
            <Link href="/dashboard">
              Get Started for Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
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
              © {new Date().getFullYear()} Mythoria. Craft your stories.
            </p>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
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

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/80 hover:border-forge-gold/50 transition-all duration-300 hover:shadow-xl hover:shadow-forge-gold/5 hover:-translate-y-0.5 chamfered-lg">
      <div className="w-10 h-10 rounded-lg bg-forge-gold/10 border border-forge-gold/20 flex items-center justify-center text-forge-gold mb-4 group-hover:scale-105 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold font-display mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
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