"use client";

import { use, useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Patient, PredictionResult, VitalReading } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Thermometer, Droplets, Heart, Wind, Clock, Wand2, ArrowLeft, Loader2, User, Info, AlertCircle, BrainCircuit, Database, ChevronRight } from 'lucide-react';
import { predictPatientDeterioration } from '@/ai/flows/predict-patient-deterioration-flow';
import { predictAIAssessment } from '@/ai/flows/ai-prediction-flow';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { doc, collection, addDoc, query, orderBy, setDoc } from 'firebase/firestore';

function calculateAge(dobString: string) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  if (isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isPredicting, setIsPredicting] = useState<false | 'ai' | 'model'>(false);

  const patientDocRef = useMemoFirebase(() => doc(db, 'patients', id), [db, id]);
  const vitalsQuery = useMemoFirebase(() => query(collection(db, 'patients', id, 'vitalsRecords'), orderBy('recordedAt', 'desc')), [db, id]);
  const predictionsQuery = useMemoFirebase(() => query(collection(db, 'patients', id, 'predictions'), orderBy('predictedAt', 'desc')), [db, id]);

  const { data: patient, isLoading: isPatientLoading } = useDoc<Patient>(patientDocRef);
  const { data: vitalsData, isLoading: isVitalsLoading } = useCollection<VitalReading>(vitalsQuery);
  const { data: predictionsData, isLoading: isPredictionsLoading } = useCollection<PredictionResult>(predictionsQuery);

  const vitals = vitalsData || [];
  const predictions = predictionsData || [];

  const [hr, setHr] = useState('');
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (vitals.length > 0) {
      const latest = vitals[0];
      setHr(latest.heartRate?.toString() || '');
      setSbp(latest.bloodPressureSystolic?.toString() || '');
      setDbp(latest.bloodPressureDiastolic?.toString() || '');
      setSpo2(latest.spo2?.toString() || '');
      setRr(latest.respiratoryRate?.toString() || '');
      setTemp(latest.temperature?.toString() || '');
    }
  }, [vitalsData]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (patient) {
      setNotes(patient.clinicalNotes || '');
    }
  }, [patient]);

  const handleAddVitals = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'patients', id, 'vitalsRecords'), {
        patientId: id,
        recordedAt: new Date().toISOString(),
        heartRate: parseInt(hr) || 0,
        bloodPressureSystolic: parseInt(sbp) || 0,
        bloodPressureDiastolic: parseInt(dbp) || 0,
        spo2: parseInt(spo2) || 0,
        respiratoryRate: parseInt(rr) || 0,
        temperature: parseFloat(temp) || 0,
        addedByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      await setDoc(doc(db, 'patients', id), { 
        clinicalNotes: notes,
        updatedAt: new Date().toISOString() 
      }, { merge: true });

      toast({ title: "Vitals Recorded", description: "Patient readings have been logged." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    }
  };

  const runPrediction = async (method: 'ai' | 'model') => {
    if (!patient || !user) return;
    
    setIsPredicting(method);
    try {
      const input = {
        patientId: patient.id,
        vitals: {
          heartRate: parseInt(hr) || 0,
          systolicBp: parseInt(sbp) || 0,
          diastolicBp: parseInt(dbp) || 0,
          spo2: parseInt(spo2) || 0,
          respiratoryRate: parseInt(rr) || 0,
          temperature: parseFloat(temp) || 0,
        },
        clinicalNotes: notes
      };

      const result = method === 'ai' 
        ? await predictAIAssessment(input)
        : await predictPatientDeterioration(input);

      await addDoc(collection(db, 'patients', id, 'predictions'), {
        patientId: id,
        predictedAt: new Date().toISOString(),
        icuTransferRiskScore: result.icuTransferRisk,
        cardiacArrestRiskScore: result.cardiacArrestRisk,
        mortalityRiskScore: result.mortalityRisk,
        riskLevel: result.riskLevel,
        explanation: result.explanation,
        featureImportance: JSON.stringify(result.featureImportance),
        predictionMethod: method,
        triggeredByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'patients', id), {
        latestRiskLevel: result.riskLevel,
        latestIcuRisk: result.icuTransferRisk,
        latestArrestRisk: result.cardiacArrestRisk,
        latestMortalityRisk: result.mortalityRisk,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast({ 
        title: method === 'ai' ? "AI Assessment Complete" : "ML Model Prediction Complete", 
        description: "New risk assessment has been generated." 
      });
    } catch (error: any) {
      toast({ title: "Prediction Failed", variant: "destructive", description: error.message });
    } finally {
      setIsPredicting(false);
    }
  };

  if (isUserLoading || isPatientLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) return <div className="p-10 text-center">Patient record not found.</div>;

  const latestPrediction = (predictions?.length || 0) > 0 ? predictions[0] : null;
  const age = patient.age || calculateAge(patient.dateOfBirth);

  return (
    <div className="min-h-screen bg-background pb-12">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-bold text-primary hover:text-primary/70 mb-8 transition-colors bg-white px-4 py-2 rounded-full shadow-sm">
          <ArrowLeft size={16} className="mr-2" />
          Back to Roster
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-primary text-white p-8">
                <div className="flex justify-between items-start">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                    <User size={32} />
                  </div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none rounded-full px-4 py-1">
                    {patient.gender}
                  </Badge>
                </div>
                <CardTitle className="text-3xl font-extrabold mt-6 tracking-tight">{patient.firstName} {patient.lastName}</CardTitle>
                <CardDescription className="text-primary-foreground/70 font-medium">
                   Clinical ID: <span className="font-code text-white">{patient.patientIdCode}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-3xl bg-muted/30 border border-muted-foreground/5">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Patient Age</Label>
                    <div className="text-xl font-bold text-primary mt-1">{age || 'N/A'} Yrs</div>
                  </div>
                  <div className="p-4 rounded-3xl bg-muted/30 border border-muted-foreground/5">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Latest Risk</Label>
                    <div className={`text-xl font-bold mt-1 ${latestPrediction?.riskLevel === 'High' ? 'text-destructive' : 'text-accent'}`}>{latestPrediction?.riskLevel || 'TBD'}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase"><Info size={14} className="text-primary"/> Risk Profiles</Label>
                  <div className="flex flex-wrap gap-2">
                    {patient.preExistingConditions ? patient.preExistingConditions.split(',').map(c => (
                      <Badge key={c} variant="secondary" className="text-[10px] font-bold bg-primary/5 text-primary border-none rounded-full px-3">{c.trim()}</Badge>
                    )) : <span className="text-xs text-muted-foreground italic">No known conditions</span>}
                    <Badge variant="outline" className="text-[10px] rounded-full border-accent/20 text-accent">Tobacco: {patient.smokingStatus}</Badge>
                  </div>
                </div>
                
                {latestPrediction && (
                  <div className="space-y-5 pt-6 border-t border-muted">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inference Method</Label>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold bg-accent/5 text-accent border-accent/20 rounded-full px-3 py-0.5">
                        {latestPrediction.predictionMethod === 'ai' ? 'GenAI Logic' : 'ML Dataset Search'}
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      <RiskScore label="ICU Transfer" value={latestPrediction.icuTransferRiskScore || 0} />
                      <RiskScore label="Cardiac Arrest" value={latestPrediction.cardiacArrestRiskScore || 0} />
                      <RiskScore label="Mortality" value={latestPrediction.mortalityRiskScore || 0} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2rem] bg-accent/5 overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <Wand2 size={24} className="text-accent" />
                  Insight Engines
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-4">
                <Button 
                  variant="outline"
                  className="w-full h-14 text-sm font-bold border-primary/20 text-primary hover:bg-primary hover:text-white rounded-2xl gap-3 transition-all active:scale-95 shadow-sm" 
                  onClick={() => runPrediction('ai')}
                  disabled={!!isPredicting}
                >
                  {isPredicting === 'ai' ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={20} />}
                  AI Assessment
                </Button>
                <Button 
                  className="w-full h-14 text-sm font-bold bg-accent hover:bg-accent/90 text-white rounded-2xl gap-3 transition-all active:scale-95 shadow-lg shadow-accent/20" 
                  onClick={() => runPrediction('model')}
                  disabled={!!isPredicting}
                >
                  {isPredicting === 'model' ? <Loader2 size={18} className="animate-spin" /> : <Database size={20} />}
                  Dataset Inference
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="vitals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/50 p-1.5 rounded-2xl shadow-sm">
                <TabsTrigger value="vitals" className="rounded-xl font-bold py-2.5">Entry Sheet</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl font-bold py-2.5">Trend Analysis</TabsTrigger>
                <TabsTrigger value="ai-explanation" className="rounded-xl font-bold py-2.5">AI Insights</TabsTrigger>
              </TabsList>

              <TabsContent value="vitals">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-4">
                  <CardHeader className="p-8">
                    <CardTitle className="text-2xl font-bold">New Physiological Entry</CardTitle>
                    <CardDescription className="text-base">Document the latest vital signs and clinical notes for this patient.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                      <VitalInput label="HR (bpm)" icon={<Heart size={18} className="text-destructive" />} value={hr} onChange={setHr} />
                      <VitalInput label="SBP (mmHg)" icon={<Droplets size={18} className="text-primary" />} value={sbp} onChange={setSbp} />
                      <VitalInput label="DBP (mmHg)" icon={<Droplets size={18} className="text-primary" />} value={dbp} onChange={setDbp} />
                      <VitalInput label="SpO2 (%)" icon={<Wind size={18} className="text-accent" />} value={spo2} onChange={setSpo2} />
                      <VitalInput label="RR (/min)" icon={<Activity size={18} className="text-emerald-500" />} value={rr} onChange={setRr} />
                      <VitalInput label="Temp (°C)" icon={<Thermometer size={18} className="text-orange-500" />} value={temp} onChange={setTemp} />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clinical Observations</Label>
                      <Textarea 
                        placeholder="Detail any symptoms, subjective complaints, or changes in clinical status..." 
                        className="min-h-[180px] bg-muted/20 rounded-[1.5rem] border-none focus-visible:ring-primary/20 p-6 text-base"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddVitals} variant="secondary" className="w-full h-14 rounded-2xl text-lg font-bold shadow-md active:scale-95 transition-all">
                      Log Vitals & Save Notes
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <div className="space-y-8">
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-4 overflow-hidden">
                    <CardHeader className="p-8">
                      <CardTitle className="text-2xl font-bold">Physiological Trajectories</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8 pt-0">
                      {isVitalsLoading ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <Loader2 className="w-8 h-8 animate-spin mr-3 text-primary/40" /> 
                          <span className="font-medium">Synthesizing trends...</span>
                        </div>
                      ) : (vitals?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...(vitals || [])].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="recordedAt" 
                              tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              axisLine={false}
                              tickLine={false}
                              tick={{fontSize: 10, fill: '#999'}}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                            <Tooltip 
                              contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                            />
                            <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--primary))" name="Heart Rate" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                            <Line type="monotone" dataKey="spo2" stroke="hsl(var(--accent))" name="SpO2" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-[2rem] bg-muted/10">
                          <Activity size={48} className="opacity-10 mb-4" />
                          <p className="font-bold">Insufficient data for trending.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-4">
                    <CardHeader className="p-8">
                      <CardTitle className="text-2xl font-bold">Clinical Events Log</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                      <div className="space-y-4">
                        {isVitalsLoading && <div className="text-center py-12 text-muted-foreground animate-pulse">Synchronizing clinical logs...</div>}
                        {!isVitalsLoading && (vitals?.length || 0) === 0 && (
                          <div className="text-center py-12 text-muted-foreground">No records logged in the clinical history.</div>
                        )}
                        {(vitals || []).map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between p-5 rounded-[1.5rem] border border-muted-foreground/5 bg-muted/10 hover:bg-muted/20 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                                <Clock size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{new Date(v.recordedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">Vital Snapshot</p>
                              </div>
                            </div>
                            <div className="flex gap-6 font-code text-primary font-bold text-xs">
                              <span className="flex items-center gap-1"><Heart size={12}/> {v.heartRate}</span>
                              <span className="flex items-center gap-1"><Droplets size={12}/> {v.heartRate > 0 ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : 'N/A'}</span>
                              <span className="flex items-center gap-1"><Wind size={12}/> {v.spo2}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="ai-explanation">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-4">
                  <CardHeader className="p-8">
                    <CardTitle className="text-2xl font-bold flex items-center justify-between">
                      Clinical Rationale & Insights
                      <Badge variant="outline" className="rounded-full bg-accent/5 text-accent border-accent/20 font-bold">Genkit v1.0 Engine</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-10">
                    {isPredictionsLoading ? (
                      <div className="py-24 text-center text-muted-foreground">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent/40" /> 
                        <p className="font-bold">Analyzing multimodal data streams...</p>
                      </div>
                    ) : latestPrediction ? (
                      <>
                        <div className="p-8 rounded-[2rem] bg-accent/5 border border-accent/10 text-lg text-primary/80 leading-relaxed font-medium italic">
                          "{latestPrediction.explanation}"
                        </div>
                        <div className="space-y-6">
                          <h4 className="font-extrabold text-primary text-sm uppercase tracking-widest">Medical Attention Distribution</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {latestPrediction.featureImportance && Object.entries(JSON.parse(latestPrediction.featureImportance as string || '{}')).map(([key, val]) => (
                              <div key={key} className="space-y-2">
                                <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                  <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                                  <span className="text-accent">{Math.round((val as number) * 100)}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-accent transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(139,92,246,0.3)]" style={{ width: `${(val as number) * 100}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-24 text-center text-muted-foreground border-2 border-dashed rounded-[2.5rem] bg-muted/5 flex flex-col items-center">
                        <AlertCircle size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-bold text-lg">No Rationale Available</p>
                        <p className="max-w-xs mx-auto mt-2">Run an AI Assessment or Dataset Inference to generate clinical insights.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskScore({ label, value }: { label: string, value: number }) {
  const percentage = Math.round(value * 100);
  let colorClass = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
  if (value > 0.7) colorClass = 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]';
  else if (value > 0.4) colorClass = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className={value > 0.4 ? 'text-primary' : 'text-muted-foreground'}>{percentage}% Probability</span>
      </div>
      <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-1000 ease-in-out`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function VitalInput({ label, icon, value, onChange }: { label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-3 p-4 rounded-3xl bg-muted/20 border border-muted-foreground/5 hover:bg-muted/30 transition-all">
      <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="font-extrabold text-xl h-12 border-none bg-transparent shadow-none p-0 focus-visible:ring-0" />
    </div>
  );
}