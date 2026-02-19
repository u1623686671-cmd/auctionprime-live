'use client';

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuctionDetailView } from "@/components/auctions/AuctionDetailView";

export default function OtherPage() {
  const router = useRouter();
  const params = useParams();
  const otherId = params.id as string;
  
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <Button onClick={() => router.back()} variant="ghost" className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Back</span>
        </Button>
      </div>
      <AuctionDetailView itemId={otherId} category="others" />
    </div>
  );
}
