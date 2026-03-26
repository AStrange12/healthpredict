
"use client";

import Link from 'next/link';
import { Stethoscope, User, LayoutDashboard, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navigation() {
  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Stethoscope size={20} />
          </div>
          HealthPredict AI
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/public" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1">
            <Search size={16} />
            Patient Search
          </Link>
          <Link href="/dashboard">
            <Button variant="default" className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              Doctor Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
