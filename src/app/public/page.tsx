
"use client";

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ShieldAlert, Activity, User, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function PublicPortal() {
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const db = useFirestore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchInput.trim();
    if (!term) return;

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      // Try searching by Patient ID Code first (exact match)
      const idQuery = query(
        collection(db, 'patients'), 
        where('patientIdCode', '==', term),
        limit(1)
      );
      const idSnap = await getDocs(idQuery);

      if (!idSnap.empty) {
        setResult(idSnap.docs[0].data());
      } else {
        // Try searching by name (case-insensitive via name_lower)
        const nameQuery = query(
          collection(db, 'patients'),
          where('name_lower', '==', term.toLowerCase()),
          limit(1)
        );
        const nameSnap = await getDocs(nameQuery);
        
        if (!nameSnap.empty) {
          setResult(nameSnap.docs[0].data());
        } else {
          setError('Patient record not found. Please check the ID or Name and try again.');
        }
      }
    } catch (err: any) {
      console.error('Search permission/logic error:', err);
      if (err.message?.includes('permission-denied')) {
        setError('Security check failed: Unauthorized access to clinical records.');
      } else {
        setError('A system error occurred. Please try again later.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <ShieldAlert size={16} className="text-accent" />
            <span className="text-sm font-medium text-accent">Authorized Public Access</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4 font-headline">
            Clinical Prediction Search
          </h1>
          <p className="text-muted-foreground text-lg">
            Verify patient deterioration risk assessments via secure clinical lookup.
          </p>
        </div>

        <Card className="border-none shadow-xl bg-white overflow-hidden mb-8">
          <CardHeader className="bg-primary text-white pt-8 pb-10">
            <CardTitle className="text-xl">Patient Lookup</CardTitle>
            <CardDescription className="text-primary-foreground/70">
              Search using the unique Patient ID (e.g., P-XYZ123) or full registered name.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  placeholder="Enter Patient ID or Name..." 
                  className="pl-12 h-14 text-lg border-2 focus-visible:ring-primary shadow-none"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={isSearching}
                />
              </div>
              <Button type="submit" className="h-14 px-8 text-lg font-semibold bg-accent hover:bg-accent/90" disabled={isSearching}>
                {isSearching ? <Loader2 size={24} className="animate-spin" /> : 'Search Results'}
              </Button>
            </form>
            
            {error && (
              <div className="mt-6 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <ShieldAlert size={16} />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-lg overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <User size={14} /> Identification: {result.firstName} {result.lastName}
                </div>
                <Badge variant="outline" className="bg-white">{result.patientIdCode}</Badge>
              </div>
              <CardContent className="pt-8 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <ResultScore label="ICU Risk" value={result.latestIcuRisk || 0} />
                  <ResultScore label="Arrest Risk" value={result.latestArrestRisk || 0} />
                  <ResultScore label="Mortality Risk" value={result.latestMortalityRisk || 0} />
                </div>

                <div className="mt-10 p-6 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary">Assessment: {result.latestRiskLevel || 'Calculating'}</h3>
                      <p className="text-xs text-muted-foreground">Verification Date: {new Date(result.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    Note: These results are generated using multimodal clinical data (vitals + notes). This portal displays only the final assessment metrics to maintain patient confidentiality regarding specific clinical observations.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultScore({ label, value }: { label: string, value: number }) {
  const percentage = Math.round(value * 100);
  let color = 'text-emerald-600';
  let bgColor = 'bg-emerald-500';
  
  if (value > 0.7) {
    color = 'text-destructive';
    bgColor = 'bg-destructive';
  } else if (value > 0.4) {
    color = 'text-amber-600';
    bgColor = 'bg-amber-500';
  }

  return (
    <div className="text-center space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-5xl font-bold font-headline ${color}`}>{percentage}%</div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden max-w-[120px] mx-auto">
        <div className={`h-full ${bgColor}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
