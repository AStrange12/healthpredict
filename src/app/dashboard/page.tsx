"use client";

import { useEffect, useState, useRef } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, User, Calendar, Activity, ChevronRight, Search as SearchIcon, Loader2, Heart, Wind, Thermometer, Droplets, Stethoscope, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Patient } from '@/lib/types';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

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

export default function DoctorDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [patientIdCode, setPatientIdCode] = useState('');
  
  const [hr, setHr] = useState('75');
  const [sbp, setSbp] = useState('120');
  const [dbp, setDbp] = useState('80');
  const [spo2, setSpo2] = useState('98');
  const [rr, setRr] = useState('16');
  const [temp, setTemp] = useState('37');
  
  const [conditions, setConditions] = useState('');
  const [smoking, setSmoking] = useState('Never');

  const patientsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(db, 'patients'), where('addedByUserId', '==', user.uid));
  }, [db, user]);

  const { data: patients = [], isLoading: isPatientsLoading } = useCollection<Patient>(patientsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length > 0) {
          const row: any = data[0];
          const headers = Object.keys(row);
          
          const findVal = (aliases: string[]) => {
            const key = headers.find(h => aliases.some(a => h.toLowerCase().trim().includes(a)));
            return key ? String(row[key]).trim() : '';
          };

          const rawName = findVal(['name', 'patient', 'full name']);
          if (rawName) {
            const parts = rawName.split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
          } else {
            setFirstName(findVal(['first name', 'fname', 'firstname']));
            setLastName(findVal(['last name', 'lname', 'lastname']));
          }

          setDob(findVal(['dob', 'birth', 'date of birth']));
          const rawGender = findVal(['gender', 'sex']).toLowerCase();
          if (rawGender.startsWith('m')) setGender('Male');
          else if (rawGender.startsWith('f')) setGender('Female');
          else setGender('Other');
          
          setPatientIdCode(findVal(['id', 'code', 'patientid']));

          setHr(findVal(['hr', 'heart', 'pulse', 'bpm']) || '75');
          setSbp(findVal(['sbp', 'systolic']) || '120');
          setDbp(findVal(['dbp', 'diastolic']) || '80');
          setSpo2(findVal(['spo2', 'oxygen', 'o2', 'sat']) || '98');
          setRr(findVal(['rr', 'respiratory', 'breath']) || '16');
          setTemp(findVal(['temp', 'temperature', 'celsius']) || '37');

          setConditions(findVal(['condition', 'pre-existing', 'history', 'medical']));
          const rawSmoking = findVal(['smoking', 'tobacco']).toLowerCase();
          if (rawSmoking.includes('never')) setSmoking('Never');
          else if (rawSmoking.includes('form') || rawSmoking.includes('ex')) setSmoking('Former');
          else if (rawSmoking.includes('curr') || rawSmoking.includes('yes')) setSmoking('Current');

          toast({
            title: "Data Extracted",
            description: "Patient details have been auto-filled from the uploaded file.",
          });
        }
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Could not parse the file. Please check the format.",
        });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !dob || !user) return;

    setIsRegistering(true);
    try {
      const patientRef = doc(collection(db, 'patients'));
      const age = calculateAge(dob);
      const fullName = `${firstName} ${lastName}`;
      const patientData = {
        id: patientRef.id,
        firstName,
        lastName,
        name: fullName,
        name_lower: fullName.toLowerCase(),
        dateOfBirth: dob,
        age: age,
        gender,
        patientIdCode: patientIdCode || `P-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        admissionDate: new Date().toISOString(),
        preExistingConditions: conditions,
        smokingStatus: smoking,
        addedByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(patientRef, patientData);

      const vitalsRef = collection(db, 'patients', patientRef.id, 'vitalsRecords');
      await addDoc(vitalsRef, {
        patientId: patientRef.id,
        recordedAt: new Date().toISOString(),
        heartRate: parseInt(hr),
        bloodPressureSystolic: parseInt(sbp),
        bloodPressureDiastolic: parseInt(dbp),
        spo2: parseInt(spo2),
        respiratoryRate: parseInt(rr),
        temperature: parseFloat(temp),
        addedByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Patient Registered", description: "The patient record has been successfully created." });
      setIsAddPatientOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDob('');
    setGender('Male');
    setPatientIdCode('');
    setHr('75');
    setSbp('120');
    setDbp('80');
    setSpo2('98');
    setRr('16');
    setTemp('37');
    setConditions('');
    setSmoking('Never');
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPatients = (patients || []).filter(p => 
    (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.patientIdCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold text-primary font-headline tracking-tight">Clinical Dashboard</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Activity size={16} className="text-accent" />
              Monitoring {patients?.length || 0} active patient records
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
              <Input 
                placeholder="Search ID or name..." 
                className="pl-10 w-[280px] bg-white/50 border-none shadow-sm focus-visible:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Dialog open={isAddPatientOpen} onOpenChange={(open) => {
              setIsAddPatientOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 h-11 px-6 shadow-lg shadow-primary/10 bg-primary hover:bg-primary/90 transition-all active:scale-95">
                  <Plus size={18} />
                  Add New Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                  <div className="flex items-center justify-between mb-2">
                    <DialogTitle className="text-2xl font-bold text-primary">Patient Registration</DialogTitle>
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".xlsx, .csv" 
                        className="hidden" 
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileSpreadsheet size={16} />
                        Import Excel
                      </Button>
                    </div>
                  </div>
                  <DialogDescription>
                    Fill in the patient's clinical profile manually or import a clinical data sheet.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-6 pt-4">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-xl">
                      <TabsTrigger value="basic" className="rounded-lg">Basic Info</TabsTrigger>
                      <TabsTrigger value="vitals" className="rounded-lg">Initial Vitals</TabsTrigger>
                      <TabsTrigger value="clinical" className="rounded-lg">History</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date of Birth</Label>
                          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Gender</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Patient ID Code (Optional)</Label>
                        <Input value={patientIdCode} onChange={(e) => setPatientIdCode(e.target.value)} placeholder="e.g. HOSP-12345" />
                      </div>
                    </TabsContent>

                    <TabsContent value="vitals" className="space-y-4 pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Heart size={14} className="text-destructive"/> HR</Label>
                          <Input type="number" value={hr} onChange={(e) => setHr(e.target.value)} className="font-semibold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Droplets size={14} className="text-primary"/> SBP</Label>
                          <Input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} className="font-semibold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Droplets size={14} className="text-primary"/> DBP</Label>
                          <Input type="number" value={dbp} onChange={(e) => setDbp(e.target.value)} className="font-semibold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Wind size={14} className="text-accent"/> SpO2 %</Label>
                          <Input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} className="font-semibold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Activity size={14} className="text-emerald-500"/> RR</Label>
                          <Input type="number" value={rr} onChange={(e) => setRr(e.target.value)} className="font-semibold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 text-xs uppercase font-bold text-muted-foreground"><Thermometer size={14} className="text-orange-500"/> Temp °C</Label>
                          <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} className="font-semibold" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="clinical" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Pre-existing Conditions</Label>
                        <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Diabetes, Hypertension, etc." />
                      </div>
                      <div className="space-y-2">
                        <Label>Smoking Status</Label>
                        <Select value={smoking} onValueChange={setSmoking}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Never">Never</SelectItem>
                            <SelectItem value="Former">Former</SelectItem>
                            <SelectItem value="Current">Current</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full h-12 text-lg rounded-xl shadow-lg shadow-primary/20" disabled={isRegistering}>
                    {isRegistering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Stethoscope size={20} className="mr-2" />}
                    Complete Registration
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isPatientsLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary/40" />
            <p className="text-muted-foreground animate-pulse font-medium">Syncing patient data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPatients.length === 0 ? (
              <div className="col-span-full py-24 text-center border-2 border-dashed rounded-[2rem] bg-white/40 flex flex-col items-center justify-center transition-colors hover:bg-white/60">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                  <User size={40} className="text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-bold text-muted-foreground">No clinical records found</h3>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Start by adding a patient to your roster using the action button above.</p>
              </div>
            ) : (
              filteredPatients.map(patient => (
                <PatientCard key={patient.id} patient={patient} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  const age = patient.age || calculateAge(patient.dateOfBirth);
  const riskColor = 
    patient.latestRiskLevel === 'High' ? 'text-destructive bg-destructive/10' :
    patient.latestRiskLevel === 'Medium' ? 'text-orange-600 bg-orange-50' :
    'text-emerald-600 bg-emerald-50';
  
  return (
    <Card className="hover:shadow-xl transition-all border-none shadow-sm overflow-hidden group rounded-[1.5rem] bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-primary/5 group-hover:bg-primary/10 transition-colors border-b border-primary/5">
        <div className="flex justify-between items-start">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
            <User size={28} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="bg-white rounded-full px-3 py-1 font-medium text-[10px] border-primary/10">
              {patient.gender}
            </Badge>
            {patient.latestRiskLevel && (
              <Badge variant="secondary" className={`rounded-full px-3 py-1 text-[10px] font-bold border-none ${riskColor}`}>
                {patient.latestRiskLevel} Risk
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-4">
          <CardTitle className="text-2xl font-bold text-primary group-hover:translate-x-1 transition-transform">{patient.firstName} {patient.lastName}</CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patient Code:</span>
            <span className="font-code text-xs bg-muted/50 px-2 py-0.5 rounded-md text-primary">{patient.patientIdCode}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-2xl bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar size={14} className="text-primary" />
                <span className="text-[10px] uppercase font-bold tracking-tight">Admission</span>
              </div>
              <p className="text-sm font-semibold">{new Date(patient.admissionDate).toLocaleDateString()}</p>
            </div>
            <div className="p-3 rounded-2xl bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity size={14} className="text-accent" />
                <span className="text-[10px] uppercase font-bold tracking-tight">Age</span>
              </div>
              <p className="text-sm font-semibold">{age || 'N/A'} Years</p>
            </div>
          </div>
          
          <Link href={`/dashboard/patients/${patient.id}`}>
            <Button variant="outline" className="w-full group/btn h-12 rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
              View Medical Profile
              <ChevronRight size={18} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}