
import Image from "next/image";
import { Star, ShoppingBag, Wine, CheckCircle, Gem, Palette, CreditCard, Phone, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="mb-8">
            <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                <Link href="/profile">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
            </Button>
        </div>
      </div>
      <main>
        {/* Hero Section */}
        <section className="bg-secondary/50 py-20 md:py-28 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">
              About Us
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground">
              Welcome to a new way of buying and selling, where value isn’t
              fixed, it’s discovered.
            </p>
          </div>
        </section>

        {/* Founders' Story Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-xl order-last md:order-first">
                <Image
                  src="https://images.unsplash.com/photo-1556761175-59736f663b12?q=80&w=2070&auto=format&fit=crop"
                  alt="Two founders collaborating"
                  fill
                  className="object-cover"
                  data-ai-hint="founders working"
                />
              </div>
              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">
                  We are two founders who shared a simple but powerful idea: why
                  shouldn’t anyone be able to sell anything through an auction?
                  Because the truth is, value is subjective. An item worth
                  nothing to one person can be priceless to another.
                </p>
                <p className="text-muted-foreground">
                  That belief became the foundation of our auction marketplace, a
                  platform built to let the market decide, transparently,
                  fairly, and in real time.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="container mx-auto" />

        {/* Vision Section */}
        <section className="py-16 md:py-24 text-center">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold font-headline">
              Our Vision
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Traditional marketplaces tell you what something is “worth.” We
              believe people should decide that themselves. Our app was created
              to break the limits of conventional selling by opening the door to
              competitive bidding across diverse categories, from everyday
              items to high-value assets.
            </p>
            <p className="mt-2 text-lg text-muted-foreground">
              Whether you’re selling something rare, meaningful, or simply
              unused, there’s always someone out there who sees its potential.
              Auctions don’t just sell products, they reveal demand, emotion,
              and perspective.
            </p>
          </div>
        </section>

        <hr className="container mx-auto" />

        {/* Categories Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">
                Our Auction Categories
              </h2>
              <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
                To keep the experience structured yet flexible, we’ve designed
                distinct categories tailored to different kinds of value.
              </p>
            </div>
            <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <div className="p-6 border rounded-lg bg-card shadow-sm">
                <Gem className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Iconic</h3>
                <p className="text-muted-foreground">
                  A special collection of personal items from celebrities, giving you a chance to own a piece of history.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <ShoppingBag className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Other</h3>
                <p className="text-muted-foreground">
                  For everything else. A category for items that don't fit into our specialized collections.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <Wine className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Alcohol</h3>
                <p className="text-muted-foreground">
                  A dedicated space for alcohol auctions, including rare spirits, limited editions, and premium collections for enthusiasts.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <Palette className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Art</h3>
                <p className="text-muted-foreground">
                  A curated collection of fine art, from contemporary paintings to classical sculptures, for discerning collectors.
                </p>
              </div>
               <div className="p-6 border rounded-lg bg-card shadow-sm">
                <Shirt className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Apparel</h3>
                <p className="text-muted-foreground">
                  A marketplace for clothing, shoes, and accessories.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <CreditCard className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Car Plates</h3>
                <p className="text-muted-foreground">
                  Auctions for unique and rare license plates for collectors and enthusiasts.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card shadow-sm">
                <Phone className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2 font-headline">Phone Numbers</h3>
                <p className="text-muted-foreground">
                  A marketplace for distinctive and memorable phone numbers.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="container mx-auto" />

        {/* Why We Built This Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
               <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">
                  Why We Built This
                </h2>
                <p className="text-lg text-muted-foreground">
                  We grew up understanding that markets aren’t just numbers, they’re stories, emotions, and opportunities. Coming from Lebanon, where resilience and creativity are part of everyday life, we wanted to build something open, fair, and accessible globally.
                </p>
                <p className="text-muted-foreground">
                  Our platform is built for:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-2 text-primary shrink-0 mt-1"/><span>Sellers who want true market value.</span></li>
                    <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-2 text-primary shrink-0 mt-1"/><span>Buyers who enjoy competition and discovery.</span></li>
                    <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-2 text-primary shrink-0 mt-1"/><span>Remember that value is personal.</span></li>
                </ul>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-xl">
                 <Image
                    src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop"
                    alt="A global community connected"
                    fill
                    className="object-cover"
                    data-ai-hint="global marketplace"
                  />
              </div>
            </div>
          </div>
        </section>

        {/* Promise Section */}
        <section className="bg-primary text-primary-foreground py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold font-headline">
              Our Promise
            </h2>
            <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                    <h3 className="font-semibold text-lg">Open access</h3>
                    <p className="text-primary-foreground/80">anyone can sell</p>
                </div>
                 <div className="text-center">
                    <h3 className="font-semibold text-lg">Transparent bidding</h3>
                    <p className="text-primary-foreground/80">no hidden rules</p>
                </div>
                 <div className="text-center">
                    <h3 className="font-semibold text-lg">Diverse categories</h3>
                    <p className="text-primary-foreground/80">from casual to elite</p>
                </div>
                 <div className="text-center">
                    <h3 className="font-semibold text-lg">Value earned</h3>
                    <p className="text-primary-foreground/80">not assigned</p>
                </div>
            </div>
             <p className="mt-12 text-xl font-semibold">
                This isn’t just an auction app. It’s a marketplace powered by perspective. Welcome to auctions without limits.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
