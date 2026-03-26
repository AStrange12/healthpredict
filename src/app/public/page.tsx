
"use client";

import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User, ShieldCheck, Heart, Info } from 'lucide-react';
import { getPatientById, getPatientByName } from '@/lib/db-mock';
import { Patient } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function PublicSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Patient | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    let patient = await getPatientById(query);
    if (!patient) {
      patient = await getPatientByName(query);
    }
    
    setResult(patient || null);
    setSearched(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-4xl font-bold text-primary font-headline">Patient Information Portal</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Securely access patient risk assessments and deterioration status using ID or Full Name.
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative group mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            className="h-16 pl-12 pr-32 text-lg rounded-2xl shadow-sm border-2 border-transparent focus-visible:border-primary transition-all"
            placeholder="Search by Patient ID or Name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" size="lg" className="absolute right-2 top-2 h-12 px-8 rounded-xl">
            Search
          </Button>
        </form>

        {searched && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {result ? (
              <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/5 pb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl font-bold">{result.name}</CardTitle>
                      <CardDescription className="font-code mt-1">ID: {result.id}</CardDescription>
                    </div>
                    <Badge variant={result.predictions[0]?.riskLevel === 'High' ? 'destructive' : 'outline'} className="px-3 py-1">
                      {result.predictions[0]?.riskLevel || 'Monitoring'} Risk
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatusItem icon={<Heart className="text-rose-500" />} label="Overall Health" value={result.predictions[0]?.riskLevel || 'Stable'} />
                    <StatusItem icon={<Search className="text-blue-500" />} label="Last Assessment" value={result.predictions[0] ? new Date(result.predictions[0].timestamp).toLocaleDateString() : 'N/A'} />
                    <StatusItem icon={<ShieldCheck className="text-emerald-500" />} label="Status" value="Monitored" />
                  </div>

                  {result.predictions[0] && (
                    <div className="p-6 rounded-2xl bg-muted/30 border border-muted-foreground/10">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-primary mb-2">High-Level Explanation</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {result.predictions[0].explanation.split('.')[0]}. Clinical staff are continuously monitoring vital patterns to ensure optimal care and early intervention if needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                    Disclaimer: This information is for general awareness. Please consult with the attending physician for professional medical advice.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16 bg-white/50 border-2 border-dashed rounded-3xl">
                <User className="mx-auto w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-medium text-muted-foreground">Patient Record Not Found</h3>
                <p className="text-sm text-muted-foreground mt-2">Please verify the ID or name and try again.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-muted/20">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
        {icon}
      </div>
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-primary mt-1">{value}</span>
    </div>
  );
}
