import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CallToAction() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-balance text-4xl font-semibold lg:text-5xl">Ready to write your masterpiece?</h2>
                    <p className="mt-4">Join Mythoria today and turn your ideas into a finished novel.</p>

                    <div className="mt-12 flex flex-wrap justify-center gap-4">
                        <Button
                            asChild
                            size="lg">
                            <Link href="/dashboard">
                                <span>Start Writing Now</span>
                            </Link>
                        </Button>

                        <Button
                            asChild
                            size="lg"
                            variant="outline">
                            <Link href="#features">
                                <span>Explore Features</span>
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
