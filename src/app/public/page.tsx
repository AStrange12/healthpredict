
"use client";

import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Loader2, User, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Patient } from '@/lib/types';

export default function PublicPortal() {
  const db = useFirestore();
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchInput.trim();
    if (!queryStr) return;

    setIsSearching(true);
    setResult(null);
    setError(null);

    try {
      // 1. Try search by Patient ID Code (Exact Match)
      let q = query(collection(db, 'patients'), where('patientIdCode', '==', queryStr), limit(1));
      let snapshot = await getDocs(q);

      // 2. Fallback to search by Name (Case Insensitive using name_lower)
      if (snapshot.empty) {
        q = query(collection(db, 'patients'), where('name_lower', '==', queryStr.toLowerCase()), limit(1));
        snapshot = await getDocs(q);
      }

      if (!snapshot.empty) {
        const patientData = snapshot.docs[0].data() as Patient;
        setResult(patientData);
      } else {
        setError("Patient record not found. Please verify the ID or name.");
      }
    } catch (err: any) {
      console.error("Public search error:", err);
      setError("An error occurred during search. Please try again later.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-none px-4 py-1">
            Patient Transparency Portal
          </Badge>
          <h1 className="text-4xl font-bold text-primary mb-4 font-headline">Access Your Health Predictions</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Securely search for patient risk assessments using your unique Patient ID or registered full name.
          </p>
        </div>

        <Card className="border-none shadow-lg mb-8">
          <CardContent className="pt-8">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input 
                  placeholder="Enter Patient ID (e.g. P-ABC123) or Full Name..." 
                  className="pl-12 h-14 text-lg border-muted bg-muted/20"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-14 px-8 text-lg font-semibold shadow-md" disabled={isSearching}>
                {isSearching ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <SearchIcon className="w-6 h-6 mr-2" />}
                Search Record
              </Button>
            </form>
            {error && (
              <p className="mt-4 text-destructive text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertTriangle size={16} />
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-xl overflow-hidden">
              <div className="bg-primary p-8 text-white">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                      <User size={32} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">{result.firstName} {result.lastName}</h2>
                      <p className="text-primary-foreground/70 font-code tracking-wider">ID: {result.patientIdCode}</p>
                    </div>
                  </div>
                  <Badge className="bg-white/20 text-white border-none px-6 py-2 text-sm uppercase tracking-widest">
                    {(result as any).latestRiskLevel || 'No Prediction Yet'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <RiskDisplay 
                    label="ICU Transfer" 
                    value={(result as any).latestIcuRisk || 0} 
                    icon={<Activity className="text-blue-500" />}
                  />
                  <RiskDisplay 
                    label="Cardiac Arrest" 
                    value={(result as any).latestArrestRisk || 0} 
                    icon={<Activity className="text-rose-500" />}
                  />
                  <RiskDisplay 
                    label="Mortality Risk" 
                    value={(result as any).latestMortalityRisk || 0} 
                    icon={<Activity className="text-slate-500" />}
                  />
                </div>

                <div className="mt-12 p-6 rounded-2xl bg-muted/30 border border-dashed border-muted">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">What does this mean?</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        These scores are calculated using advanced clinical algorithms and historical data comparisons. 
                        They represent a snapshot of the current physiological trajectory. 
                        <strong> Always consult with your medical professional for definitive clinical decisions.</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="py-8 border-t bg-muted/20 text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 HealthPredict AI Clinical Systems. Authorized Access Only.
        </p>
      </footer>
    </div>
  );
}

function RiskDisplay({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  const percentage = Math.round(value * 100);
  let colorClass = 'bg-emerald-500';
  if (value > 0.7) colorClass = 'bg-rose-500';
  else if (value > 0.4) colorClass = 'bg-amber-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-muted-foreground">{label}</span>
        </div>
        <span className="text-2xl font-bold text-primary">{percentage}%</span>
      </div>
      <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full ${colorClass} transition-all duration-1000 ease-out`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}
