import Link from "next/link";
import { Button } from "@/components/ui/button";
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl">Mythoria</span>
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
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              <Link href="/dashboard">
                Start Writing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-violet-500/5 to-indigo-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              AI-Powered Novel Writing Platform
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="block">Craft Your Story</span>
            <span className="block bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Like Never Before
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The ultimate platform for plotting, character building, and writing your next masterpiece.
            Visualize your story with AI-powered tools.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" asChild className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
              <Link href="/dashboard">
                Start Writing Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
              <Link href="#features">
                Explore Features
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Write</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From initial idea to final draft, Mythoria gives you powerful tools to craft your best work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="Character Builder"
              description="Create complex characters with detailed traits, backstories, relationships, and track their development."
              gradient="from-pink-500 to-rose-500"
            />
            <FeatureCard
              icon={<GitBranch className="w-6 h-6" />}
              title="Plot Visualization"
              description="Visualize your story structure with interactive timeline and plot boards. Never lose track of your narrative."
              gradient="from-violet-500 to-purple-500"
            />
            <FeatureCard
              icon={<Map className="w-6 h-6" />}
              title="World Building"
              description="Build immersive worlds with locations, lore, and interconnected elements all linked to your story."
              gradient="from-emerald-500 to-teal-500"
            />
            <FeatureCard
              icon={<Lightbulb className="w-6 h-6" />}
              title="Ideas Vault"
              description="Capture and organize your creative sparks. Tag, categorize, and link ideas to chapters instantly."
              gradient="from-amber-500 to-orange-500"
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="AI Assistant"
              description="Get intelligent suggestions, plot hole detection, and character consistency checks powered by AI."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6" />}
              title="Note System"
              description="Rich text editor with auto-save, version history, and seamless organization across chapters."
              gradient="from-indigo-500 to-violet-500"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and bring your stories to life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Create Your Project"
              description="Start a new novel project, set your goals, and outline your story structure."
            />
            <StepCard
              number={2}
              title="Build Your World"
              description="Add characters, locations, and ideas. Let AI help you maintain consistency."
            />
            <StepCard
              number={3}
              title="Write & Publish"
              description="Write your chapters with our distraction-free editor and track your progress."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-6">
            <PenTool className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Write Your Masterpiece?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of writers who trust Mythoria to bring their stories to life.
          </p>
          <Button size="lg" asChild className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
            <Link href="/dashboard">
              Get Started for Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Feather className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl">Mythoria</span>
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
    </main>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
  gradient
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl bg-card border border-border/50 hover:border-border transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/5">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// Step Card Component
function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="relative p-6 rounded-2xl bg-card border border-border/50 text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}