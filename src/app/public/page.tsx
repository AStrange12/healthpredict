"use client";

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ShieldCheck, Activity, AlertCircle, Loader2, User } from 'lucide-react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function PublicPortal() {
  const db = useFirestore();
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fix hydration mismatch by only rendering search results after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchResult([]);

    const term = searchInput.trim();
    const termLower = term.toLowerCase();

    try {
      // Search by Patient ID Code (Exact)
      const idQuery = query(collection(db, 'patients'), where('patientIdCode', '==', term), limit(1));
      const idSnap = await getDocs(idQuery);
      
      let results: any[] = [];
      idSnap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));

      // If no ID match, try Name search (Exact match for security/privacy)
      if (results.length === 0) {
        const nameQuery = query(collection(db, 'patients'), where('name_lower', '==', termLower), limit(1));
        const nameSnap = await getDocs(nameQuery);
        nameSnap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
      }

      setSearchResult(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent mb-6">
            <ShieldCheck size={18} />
            <span className="text-sm font-semibold">Secure Patient Access Portal</span>
          </div>
          <h1 className="text-4xl font-bold text-primary mb-4 font-headline">Find Risk Assessment</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Enter your Patient ID or full name as registered by your healthcare provider to view your latest clinical deterioration risk summary.
          </p>
        </div>

        <Card className="border-none shadow-xl overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardContent className="pt-8">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  placeholder="Enter Patient ID (e.g. P-ABC123) or Full Name..." 
                  className="pl-12 h-14 text-lg border-2 focus-visible:ring-accent"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-14 px-8 text-lg font-semibold bg-primary hover:bg-primary/90" disabled={isSearching}>
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Status"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-12">
          {isSearching && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
              <p>Verifying clinical records...</p>
            </div>
          )}

          {hasSearched && !isSearching && searchResult.length === 0 && (
            <Card className="border-dashed border-2 bg-transparent">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">No Record Found</h3>
                <p className="text-muted-foreground mt-2">
                  We couldn't find any results for "{searchInput}". Please double-check the ID or name with your medical team.
                </p>
              </CardContent>
            </Card>
          )}

          {hasSearched && !isSearching && searchResult.map(patient => (
            <Card key={patient.id} className="border-none shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                      <User size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{patient.firstName} {patient.lastName}</CardTitle>
                      <CardDescription>Patient ID: {patient.patientIdCode}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={patient.latestRiskLevel === 'High' ? 'destructive' : 'outline'} className="px-4 py-1">
                    {patient.latestRiskLevel || 'Pending Review'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ResultIndicator 
                    label="ICU Transfer Risk" 
                    value={patient.latestIcuRisk} 
                    description="Likelihood of requiring critical care monitoring."
                  />
                  <ResultIndicator 
                    label="Cardiac Arrest Risk" 
                    value={patient.latestArrestRisk} 
                    description="Calculated risk of cardiovascular instability."
                  />
                  <ResultIndicator 
                    label="Mortality Risk" 
                    value={patient.latestMortalityRisk} 
                    description="General physiological deterioration risk."
                  />
                </div>
                
                <div className="mt-8 p-4 rounded-xl bg-muted/30 border text-xs text-muted-foreground flex gap-3">
                  <Activity size={16} className="shrink-0 text-accent" />
                  <p>
                    This is a public summary of your latest clinical assessment. Detailed medical rationale is restricted to authorized medical professionals. Please consult your physician for a full explanation of these results.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function ResultIndicator({ label, value, description }: { label: string, value: number | undefined, description: string }) {
  const percentage = value !== undefined ? Math.round(value * 100) : 0;
  const isPending = value === undefined;

  let colorClass = 'bg-emerald-500';
  if (percentage > 70) colorClass = 'bg-destructive';
  else if (percentage > 40) colorClass = 'bg-amber-500';

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
        <span className="text-2xl font-bold text-primary">{isPending ? '--' : `${percentage}%`}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-1000`} 
          style={{ width: `${isPending ? 0 : percentage}%` }} 
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
    </div>
  );
}

function Label({ className, children }: { className?: string, children: React.ReactNode }) {
  return <span className={`text-sm font-medium leading-none ${className}`}>{children}</span>;
}
