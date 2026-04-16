import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage, signIn, signOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Send, Settings, Bell, Newspaper, 
  LogOut, User as UserIcon, Heart, Shield, 
  Cpu, Activity, Zap, MessageSquare, Image as ImageIcon,
  Volume2, VolumeX, BrainCircuit, Upload, File, HardDrive,
  Eye, Monitor, LineChart, Terminal, ExternalLink,
  Coins, TrendingUp, Wallet, History, Database, Server, Cpu as CpuIcon, Globe,
  Library, Rocket, Calculator, Stars, BookOpen,
  Map, Hammer, Landmark
} from 'lucide-react';
import { 
  LineChart as ReChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import * as d3 from 'd3';
import { cn } from './lib/utils';
import { getAcktionsResponse, textToSpeech, generateImage } from './gemini';
import ReactMarkdown from 'react-markdown';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  voicePreference: string;
  isJamie: boolean;
  isJosiah: boolean;
  isFamily: boolean;
  hasFullAccess: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
}

interface Reminder {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  type: 'reminder' | 'alarm';
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [memories, setMemories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'reminders' | 'news' | 'finance' | 'archive'>('chat');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [devTab, setDevTab] = useState<'memories' | 'users' | 'voice' | 'gateway' | 'cognitive' | 'mining'>('memories');
  const [newMemory, setNewMemory] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [familyEmail, setFamilyEmail] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [familyRegistry, setFamilyRegistry] = useState<string[]>([]);
  const [gatewayFiles, setGatewayFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isCognitiveActive, setIsCognitiveActive] = useState(false);
  const [cognitiveLogs, setCognitiveLogs] = useState<{ time: string, observation: string }[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  
  // Financial State
  const [cryptoData, setCryptoData] = useState<any>(null);
  const [historicalBtc, setHistoricalBtc] = useState<any[]>([]);
  const [isFetchingFinance, setIsFetchingFinance] = useState(false);
  const [miningRigs, setMiningRigs] = useState<any[]>([
    { id: 'rig-01', name: 'Alpha Factory', hashrate: '145 TH/s', status: 'online', temp: '68°C', efficiency: '98%' },
    { id: 'rig-02', name: 'Beta Cold Storage', hashrate: '210 TH/s', status: 'online', temp: '62°C', efficiency: '99%' },
    { id: 'rig-03', name: 'Gamma Bitcore Node', hashrate: '0 TH/s', status: 'standby', temp: '45°C', efficiency: '100%' }
  ]);
  
  const fetchFinancialData = async () => {
    setIsFetchingFinance(true);
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano,solana,dogecoin&vs_currencies=usd&include_24hr_change=true');
      const data = await response.json();
      setCryptoData(data);
    } catch (e) {
      console.error("Finance Fetch Error:", e);
    } finally {
      setIsFetchingFinance(false);
    }
  };

  const fetchHistoricalBtc = async () => {
    setIsFetchingFinance(true);
    try {
      // Fetching last 365 days of BTC data as a sample of "historical data"
      // CoinGecko free tier has limits, so we'll fetch a reasonable range
      const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily');
      const data = await response.json();
      const formatted = data.prices.map((p: any) => ({
        date: new Date(p[0]).toLocaleDateString(),
        price: p[1]
      }));
      setHistoricalBtc(formatted);
    } catch (e) {
      console.error("Historical Fetch Error:", e);
    } finally {
      setIsFetchingFinance(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'finance') {
      fetchFinancialData();
      if (historicalBtc.length === 0) fetchHistoricalBtc();
    }
  }, [activeTab]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDeveloper = user?.email === 'jigsawmastervlxx@gmail.com';

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = isWakeWordEnabled && !isListening;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      const lowerTranscript = transcript.toLowerCase();

      if (isListening) {
        setInput(transcript);
        if (event.results[current].isFinal) {
          // Auto-send if it's a final result and we're in listening mode
          // handleSend(); // We can't call handleSend directly here easily without refs or moving it
        }
      } else if (isWakeWordEnabled) {
        if (lowerTranscript.includes('hey anthony') || lowerTranscript.includes('hey jarvis')) {
          setIsListening(true);
          setInput('');
          // Play a subtle activation sound
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
          audio.volume = 0.2;
          audio.play().catch(() => {});
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        setIsWakeWordEnabled(false);
        setIsListening(false);
      }
    };

    if (isListening || isWakeWordEnabled) {
      try {
        recognition.start();
      } catch (e) {
        // Already started
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isListening, isWakeWordEnabled]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const userDoc = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userDoc);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            const names = u.displayName?.split(' ') || [];
            const firstName = names[0] || '';
            const lastName = names.slice(1).join(' ') || '';
            const isJamie = firstName === 'Jamie' && lastName === 'Byrd';
            const isJosiah = firstName === 'Josiah' && lastName === 'Alexander';
            
            // Check family registry
            const registrySnap = await getDoc(doc(db, 'family_registry', u.email || ''));
            const isFamily = registrySnap.exists() || isJamie || isJosiah;
            
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Guest',
              email: u.email || '',
              firstName,
              lastName,
              voicePreference: 'Kore',
              isJamie,
              isJosiah,
              isFamily,
              hasFullAccess: isFamily
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${u.uid}`);
        }

        // Listen for chat
        const chatQuery = query(collection(db, 'users', u.uid, 'chat'), orderBy('timestamp', 'asc'), limit(50));
        onSnapshot(chatQuery, (snap) => {
          setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
        });

        // Listen for reminders
        const remindersQuery = query(collection(db, 'users', u.uid, 'reminders'), orderBy('time', 'asc'));
        onSnapshot(remindersQuery, (snap) => {
          setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
        });

        // Listen for global memories
        onSnapshot(collection(db, 'memories'), (snap) => {
          setMemories(snap.docs.map(d => d.data().content));
        });
      } else {
        setProfile(null);
        setMessages([]);
        setReminders([]);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isDevMode && isDeveloper) {
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      const unsubscribeRegistry = onSnapshot(collection(db, 'family_registry'), (snapshot) => {
        setFamilyRegistry(snapshot.docs.map(doc => doc.id));
      });
      return () => {
        unsubscribeUsers();
        unsubscribeRegistry();
      };
    }
  }, [isDevMode, isDeveloper]);

  useEffect(() => {
    if (isDevMode && isDeveloper && devTab === 'gateway') {
      const fetchFiles = async () => {
        const listRef = ref(storage, 'assets');
        try {
          const res = await listAll(listRef);
          const files = await Promise.all(res.items.map(async (item) => ({
            name: item.name,
            url: await getDownloadURL(item),
            path: item.fullPath
          })));
          setGatewayFiles(files);
        } catch (e) {
          console.error(e);
        }
      };
      fetchFiles();
    }
  }, [isDevMode, isDeveloper, devTab]);

  useEffect(() => {
    if (isDeveloper && !avatarUrl) {
      // Generate initial high-tech avatar for developer
      const initAvatar = async () => {
        const url = await generateImage("A hyper-realistic, high-tech cybernetic portrait of a brilliant man named Anthony, Jarvis-style holographic interface, glowing blue accents, professional and caring expression, cinematic lighting, 4k", "1K");
        if (url) setAvatarUrl(url);
      };
      initAvatar();
    }
  }, [isDeveloper, avatarUrl]);

  useEffect(() => {
    if (isDeveloper && isCognitiveActive) {
      const interval = setInterval(async () => {
        if (!isCameraActive && !isScreenActive) return;
        
        // Capture frame
        const canvas = canvasRef.current;
        const video = isScreenActive ? screenRef.current : videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        
        // Send to Gemini for "Cognitive Observation"
        try {
          const observation = await getAcktionsResponse(
            [{ 
              role: 'user', 
              content: `[SYSTEM OBSERVATION] Analyze this visual input from the developer's environment. What can you learn about Anthony's personality or the developer's current state to improve your cognitive growth? Speak aloud your findings.`,
              image: imageData
            }],
            profile?.displayName || 'Developer',
            false, false, false, true, memories
          );

          const newLog = { 
            time: new Date().toLocaleTimeString(), 
            observation: observation.substring(0, 100) + "..." 
          };
          setCognitiveLogs(prev => [newLog, ...prev].slice(0, 10));

          if (isAudioEnabled) {
            const audioData = await textToSpeech(observation, profile?.voicePreference || 'Kore');
            if (audioData) {
              const audio = new Audio(`data:audio/wav;base64,${audioData}`);
              audio.play().catch(() => {});
            }
          }
        } catch (e) {
          console.error("Cognitive Loop Error:", e);
        }
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isDeveloper, isCognitiveActive, isCameraActive, isScreenActive, isAudioEnabled, profile, memories]);

  const toggleCamera = async () => {
    if (isCameraActive) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      } catch (e) {
        alert("Camera access denied.");
      }
    }
  };

  const toggleScreen = async () => {
    if (isScreenActive) {
      const stream = screenRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setIsScreenActive(false);
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        if (screenRef.current) screenRef.current.srcObject = stream;
        setIsScreenActive(true);
      } catch (e) {
        alert("Screen share denied.");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isDeveloper) return;

    setIsUploading(true);
    const storageRef = ref(storage, `assets/${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setGatewayFiles(prev => [...prev, { name: file.name, url, path: storageRef.fullPath }]);
      alert('Asset PUT successfully into visionary92 bucket!');
    } catch (e) {
      console.error(e);
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user || isThinking) return;

    const userMsg = input;
    setInput('');
    setIsThinking(true);

    try {
      // Add user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chat'), {
        uid: user.uid,
        role: 'user',
        content: userMsg,
        timestamp: serverTimestamp()
      });

      // Get AI response
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMsg });

      const response = await getAcktionsResponse(
        history,
        profile?.displayName || 'Guest',
        profile?.isJamie || false,
        profile?.isJosiah || false,
        profile?.isFamily || false,
        profile?.hasFullAccess || false,
        memories
      );

      // Add AI response to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chat'), {
        uid: user.uid,
        role: 'model',
        content: response,
        timestamp: serverTimestamp()
      });

      // Speak if enabled
      if (isAudioEnabled) {
        const audioData = await textToSpeech(response, profile?.voicePreference || 'Kore');
        if (audioData) {
          const audio = new Audio(`data:audio/wav;base64,${audioData}`);
          audio.play();
        }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="scanline" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full jarvis-glass p-8 rounded-3xl jarvis-glow relative z-20"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-jarvis-blue flex items-center justify-center animate-pulse">
            <Cpu className="text-jarvis-blue w-10 h-10" />
          </div>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tighter text-jarvis-blue">ACKTION</h1>
          <p className="text-white/60 mb-8 font-light">Advanced Cognitive Knowledge & Tactical Integrated Operations Network</p>
          <button 
            onClick={signIn}
            className="w-full py-4 bg-jarvis-blue text-jarvis-dark font-bold rounded-xl hover:bg-white transition-colors flex items-center justify-center gap-3"
          >
            <Shield className="w-5 h-5" />
            INITIALIZE SYSTEM
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden relative bg-[#05070a] text-[#e0e6ed]">
      <div className="scanline" />
      
      {/* Header */}
      <header className="h-20 px-10 flex items-center justify-between border-b border-[#1e293b] bg-gradient-to-b from-[#0a0e14] to-[#05070a] z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-jarvis-blue rounded flex items-center justify-center text-jarvis-blue font-bold jarvis-glow">A</div>
          {isDeveloper ? (
            <a 
              href="https://g.dev/jigsawmastervlxx" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-jarvis-blue transition-colors"
            >
              <h1 className="text-2xl tracking-[4px] font-bold">ACKTION SYSTEM</h1>
            </a>
          ) : (
            <h1 className="text-2xl tracking-[4px] font-bold">ACKTION SYSTEM</h1>
          )}
        </div>

        <div className="flex items-center gap-5">
          {isDeveloper && (
            <a 
              href="https://g.dev/jigsawmastervlxx" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-white/60 hover:text-jarvis-blue hover:border-jarvis-blue transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              DEV PROFILE
            </a>
          )}
          <div className="px-4 py-2 bg-jarvis-blue/20 border border-jarvis-blue rounded-full flex items-center gap-3">
            <div className="w-2 h-2 bg-jarvis-blue rounded-full jarvis-glow animate-pulse" />
            <span className="text-sm font-bold uppercase">{profile?.displayName}</span>
            <span className="text-[10px] opacity-70 uppercase">V1.17.86 VERIFIED</span>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-[10px] text-[#94a3b8]">KANSAS CITY, MO</div>
          </div>
          <button 
            onClick={signOut}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-red-500"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="h-16 px-10 flex items-center gap-8 border-b border-[#1e293b] bg-[#0a0e14] z-30">
        <button 
          onClick={() => setActiveTab('chat')}
          className={cn("flex items-center gap-2 text-xs font-bold uppercase transition-all", activeTab === 'chat' ? "text-jarvis-blue" : "text-[#94a3b8] hover:text-white")}
        >
          <MessageSquare className="w-4 h-4" />
          Vocal Interface
        </button>
        <button 
          onClick={() => setActiveTab('finance')}
          className={cn("flex items-center gap-2 text-xs font-bold uppercase transition-all", activeTab === 'finance' ? "text-jarvis-blue" : "text-[#94a3b8] hover:text-white")}
        >
          <TrendingUp className="w-4 h-4" />
          Financial Terminal
        </button>
        <button 
          onClick={() => setActiveTab('reminders')}
          className={cn("flex items-center gap-2 text-xs font-bold uppercase transition-all", activeTab === 'reminders' ? "text-jarvis-blue" : "text-[#94a3b8] hover:text-white")}
        >
          <Bell className="w-4 h-4" />
          Active Protocols
        </button>
        <button 
          onClick={() => setActiveTab('news')}
          className={cn("flex items-center gap-2 text-xs font-bold uppercase transition-all", activeTab === 'news' ? "text-jarvis-blue" : "text-[#94a3b8] hover:text-white")}
        >
          <Globe className="w-4 h-4" />
          Intel Feed
        </button>
        <button 
          onClick={() => setActiveTab('archive')}
          className={cn("flex items-center gap-2 text-xs font-bold uppercase transition-all", activeTab === 'archive' ? "text-jarvis-blue" : "text-[#94a3b8] hover:text-white")}
        >
          <Library className="w-4 h-4" />
          Knowledge Archive
        </button>
      </nav>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-[280px_1fr_280px] gap-5 p-5 overflow-hidden z-20">
        {/* Left Panel: Memories */}
        <section className="jarvis-panel">
          <div className="panel-header">
            <span>Memory Repository</span>
            <span>ID: ASA_86</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {memories.map((memory, i) => (
              <div key={i} className="p-3 border-l-2 border-jarvis-blue bg-white/5 rounded-r">
                <div className="text-[10px] text-jarvis-blue uppercase font-bold">Memory Synced</div>
                <div className="text-sm font-medium mt-1">{memory}</div>
              </div>
            ))}
            {profile?.isJamie && (
              <div className="p-3 border-l-2 border-pink-400 bg-pink-400/5 rounded-r">
                <div className="text-[10px] text-pink-400 uppercase font-bold">Restricted: Jamie</div>
                <div className="text-sm font-medium mt-1">Affection & Care Protocol Active</div>
              </div>
            )}
            {profile?.isJosiah && (
              <div className="p-3 border-l-2 border-orange-400 bg-orange-400/5 rounded-r">
                <div className="text-[10px] text-orange-400 uppercase font-bold">Restricted: Josiah</div>
                <div className="text-sm font-medium mt-1">Fathering & Legacy Protocol Active</div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-[#1e293b] text-[10px] text-[#94a3b8] leading-tight">
            Developer Access: Anthony Scott Alexander Database active. New memories pending sync.
          </div>
        </section>

        {/* Center Panel: Chat/Vocal Core */}
        <section className="flex flex-col gap-5 overflow-hidden">
          <div className="flex-1 jarvis-panel relative">
            <div className="panel-header">
              <span>Vocal Core Interface</span>
              <div className="flex items-center gap-4">
                {isDeveloper && (
                  <button 
                    onClick={() => setIsDevMode(!isDevMode)}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                      isDevMode ? "bg-jarvis-blue text-jarvis-dark" : "border border-jarvis-blue text-jarvis-blue hover:bg-jarvis-blue/10"
                    )}
                  >
                    Dev Console
                  </button>
                )}
                <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className="hover:text-jarvis-blue transition-colors">
                  {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <span>System: Online</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
              {activeTab === 'finance' ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-jarvis-blue flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      FINANCIAL TERMINAL
                    </h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={fetchFinancialData}
                        className="p-2 bg-white/5 border border-[#1e293b] rounded hover:text-jarvis-blue transition-colors"
                        title="Refresh Markets"
                      >
                        <History className={cn("w-4 h-4", isFetchingFinance ? "animate-spin" : "")} />
                      </button>
                      <button 
                        onClick={() => {
                          const csv = "Date,Price\n" + historicalBtc.map(d => `${d.date},${d.price}`).join("\n");
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.setAttribute('hidden', '');
                          a.setAttribute('href', url);
                          a.setAttribute('download', 'bitcoin_historical_data.csv');
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="flex items-center gap-2 px-3 py-1 bg-jarvis-blue text-jarvis-dark text-[10px] font-bold rounded"
                      >
                        <Upload className="w-3 h-3" />
                        EXPORT BTC DATA
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {cryptoData ? Object.entries(cryptoData).map(([id, val]: [string, any]) => (
                      <div key={id} className="p-4 bg-white/5 border border-[#1e293b] rounded-lg">
                        <p className="text-[10px] text-[#94a3b8] uppercase font-bold">{id}</p>
                        <p className="text-lg font-bold text-white">${val.usd.toLocaleString()}</p>
                        <p className={cn("text-[10px] font-bold", val.usd_24h_change >= 0 ? "text-green-500" : "text-red-500")}>
                          {val.usd_24h_change >= 0 ? '+' : ''}{val.usd_24h_change.toFixed(2)}%
                        </p>
                      </div>
                    )) : (
                      <div className="col-span-4 py-10 text-center opacity-20">Initializing market feed...</div>
                    )}
                  </div>

                  <div className="jarvis-panel p-6 h-[300px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-jarvis-blue uppercase tracking-widest">Bitcoin Historical Performance (365D)</h3>
                      <span className="text-[10px] text-[#94a3b8]">Source: CoinGecko Bitcore Feed</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicalBtc}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8" 
                          fontSize={8} 
                          tickFormatter={(str) => str.split('/')[0] + '/' + str.split('/')[1]}
                          minTickGap={30}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={8} 
                          tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0e1218', border: '1px solid #1e293b', fontSize: '10px' }}
                          itemStyle={{ color: '#00f2ff' }}
                        />
                        <Area type="monotone" dataKey="price" stroke="#00f2ff" fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-[#1e293b] rounded-lg space-y-3">
                      <h3 className="text-[10px] font-bold text-jarvis-blue uppercase">Mining Factory Status</h3>
                      <div className="space-y-2">
                        {miningRigs.map(rig => (
                          <div key={rig.id} className="flex items-center justify-between text-[10px]">
                            <span className="text-[#94a3b8]">{rig.name}</span>
                            <span className={cn("font-bold", rig.status === 'online' ? "text-green-500" : "text-red-500")}>{rig.hashrate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-[#1e293b] rounded-lg space-y-3">
                      <h3 className="text-[10px] font-bold text-jarvis-blue uppercase">Cold Storage Assets</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#94a3b8]">BTC Mainnet</span>
                          <span className="text-jarvis-blue font-bold">6.421 BTC</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#94a3b8]">ETH Staking</span>
                          <span className="text-jarvis-blue font-bold">142.5 ETH</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'archive' ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-jarvis-blue flex items-center gap-2">
                      <Library className="w-5 h-5" />
                      KNOWLEDGE ARCHIVE
                    </h2>
                    <span className="text-[10px] text-[#94a3b8] uppercase tracking-widest">System Authority: Level 5</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <KnowledgeCard 
                      icon={<Calculator className="w-5 h-5" />}
                      title="Advanced Mathematics"
                      description="Calculus, Linear Algebra, Number Theory, and Quantum Computation algorithms."
                      onClick={() => setInput("Explain the principles of Quantum Computation and its mathematical foundations.")}
                    />
                    <KnowledgeCard 
                      icon={<Stars className="w-5 h-5" />}
                      title="Astrology & Celestial Mechanics"
                      description="Planetary alignments, zodiac charts, and the influence of celestial bodies."
                      onClick={() => setInput("Analyze the current planetary alignments and their astrological significance.")}
                    />
                    <KnowledgeCard 
                      icon={<History className="w-5 h-5" />}
                      title="USA Historical Records"
                      description="From the Founding Fathers to modern geopolitical shifts. Complete historical archives."
                      onClick={() => setInput("Provide a detailed analysis of the US Constitution's impact on modern space law.")}
                    />
                    <KnowledgeCard 
                      icon={<Rocket className="w-5 h-5" />}
                      title="Space Exploration & Rocketry"
                      description="SpaceX Starship engineering, NASA Artemis protocols, and orbital mechanics."
                      onClick={() => setInput("How do you build a Starship? Explain the materials and propulsion systems used by SpaceX.")}
                    />
                    <KnowledgeCard 
                      icon={<CpuIcon className="w-5 h-5" />}
                      title="Mechanical Engineering"
                      description="Internal Combustion Engines, aeronautics, and fluid dynamics."
                      onClick={() => setInput("Explain the mechanical intricacies of a high-performance internal combustion engine.")}
                    />
                    <KnowledgeCard 
                      icon={<BookOpen className="w-5 h-5" />}
                      title="Aeronautical Principles"
                      description="Lift, drag, thrust, and the physics of atmospheric and vacuum flight."
                      onClick={() => setInput("Explain the principles of aeronautics for both atmospheric and space flight.")}
                    />
                    <KnowledgeCard 
                      icon={<Hammer className="w-5 h-5" />}
                      title="Stone Masonry"
                      description="Historical techniques and material science from the Library of Congress archives."
                      onClick={() => setInput("Retrieve historical stone masonry techniques from the Library of Congress archives.")}
                    />
                    <KnowledgeCard 
                      icon={<Map className="w-5 h-5" />}
                      title="Land Surveying & Development"
                      description="Historical surveying methods, GIS integration, and land development practices."
                      onClick={() => setInput("Explain the evolution of land surveying from historical methods to modern GIS.")}
                    />
                  </div>

                  <div className="jarvis-panel p-6 bg-jarvis-blue/5 border-jarvis-blue/20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-2 border-jarvis-blue flex items-center justify-center animate-pulse">
                        <BrainCircuit className="w-6 h-6 text-jarvis-blue" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-jarvis-blue uppercase">Neural Knowledge Link Active</h4>
                        <p className="text-xs text-[#94a3b8]">ACKTION is now synchronized with global academic and technical databases. Ask any complex question to begin retrieval.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  {isDeveloper && (
                    <div className="mb-8">
                      <VisualCore url={avatarUrl} isThinking={isThinking} />
                    </div>
                  )}
                  {isDevMode && isDeveloper && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="jarvis-panel border-jarvis-blue/50 mb-6"
                >
                  <div className="panel-header bg-jarvis-blue/10">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setDevTab('memories')}
                        className={cn("hover:text-jarvis-blue", devTab === 'memories' ? "text-jarvis-blue font-bold" : "")}
                      >
                        Memory Uplink
                      </button>
                      <button 
                        onClick={() => setDevTab('users')}
                        className={cn("hover:text-jarvis-blue", devTab === 'users' ? "text-jarvis-blue font-bold" : "")}
                      >
                        User Access Control
                      </button>
                      <button 
                        onClick={() => setDevTab('voice')}
                        className={cn("hover:text-jarvis-blue", devTab === 'voice' ? "text-jarvis-blue font-bold" : "")}
                      >
                        Voice Profile
                      </button>
                      <button 
                        onClick={() => setDevTab('gateway')}
                        className={cn("hover:text-jarvis-blue", devTab === 'gateway' ? "text-jarvis-blue font-bold" : "")}
                      >
                        Visionary Gateway
                      </button>
                      <button 
                        onClick={() => setDevTab('cognitive')}
                        className={cn("hover:text-jarvis-blue", devTab === 'cognitive' ? "text-jarvis-blue font-bold" : "")}
                      >
                        Cognitive Growth
                      </button>
                      <button 
                        onClick={() => setDevTab('mining')}
                        className={cn("hover:text-jarvis-blue", devTab === 'mining' ? "text-jarvis-blue font-bold" : "")}
                      >
                        Mining Factory
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-[8px] text-jarvis-blue font-bold uppercase">
                          <Shield className="w-2 h-2" />
                          System Authority Linked
                        </div>
                        <a 
                          href="https://g.dev/jigsawmastervlxx" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-jarvis-blue hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-2 h-2" />
                          g.dev/jigsawmastervlxx
                        </a>
                        <a 
                          href="https://ais-dev-yjwxf624qwt2xsha2rwps7-445708808992.us-west2.run.app" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[8px] text-jarvis-blue/60 hover:underline flex items-center gap-1 mt-1"
                        >
                          <Globe className="w-2 h-2" />
                          Active Endpoint
                        </a>
                      </div>
                      <span className="text-jarvis-blue">Authorized: {user?.email}</span>
                    </div>
                  </div>
                  
                  {devTab === 'memories' ? (
                    <div className="p-6 space-y-4">
                      <p className="text-xs text-[#94a3b8]">Enter new memories of Anthony to update the global knowledge base.</p>
                      <div className="flex gap-4">
                        <textarea 
                          value={newMemory}
                          onChange={(e) => setNewMemory(e.target.value)}
                          placeholder="Describe a memory..."
                          className="flex-1 bg-white/5 border border-[#1e293b] rounded-lg p-3 text-sm focus:border-jarvis-blue focus:ring-0 min-h-[100px]"
                        />
                      </div>
                      <button 
                        onClick={async () => {
                          if (!newMemory.trim()) return;
                          try {
                            await addDoc(collection(db, 'memories'), {
                              content: newMemory,
                              timestamp: serverTimestamp()
                            });
                            setNewMemory('');
                            alert('Memory synced.');
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="px-6 py-2 bg-jarvis-blue text-jarvis-dark font-bold rounded hover:scale-105 transition-transform"
                      >
                        SYNC MEMORY
                      </button>
                    </div>
                  ) : devTab === 'users' ? (
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <p className="text-[10px] text-jarvis-blue font-bold uppercase">Pre-Authorize Family Email</p>
                        <div className="flex gap-2">
                          <input 
                            value={familyEmail}
                            onChange={(e) => setFamilyEmail(e.target.value)}
                            placeholder="Enter family member email..."
                            className="flex-1 bg-white/5 border border-[#1e293b] rounded px-3 py-2 text-xs focus:border-jarvis-blue focus:ring-0"
                          />
                          <button 
                            onClick={async () => {
                              if (!familyEmail.trim()) return;
                              try {
                                await setDoc(doc(db, 'family_registry', familyEmail.toLowerCase()), { registeredAt: serverTimestamp() });
                                setFamilyEmail('');
                                alert('Email registered in Family Vault.');
                              } catch (e) { console.error(e); }
                            }}
                            className="px-4 py-2 bg-jarvis-blue text-jarvis-dark text-xs font-bold rounded"
                          >
                            REGISTER
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-[#1e293b] my-4" />

                      <div className="flex gap-4">
                        <input 
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search active users..."
                          className="flex-1 bg-white/5 border border-[#1e293b] rounded px-4 py-2 text-sm focus:border-jarvis-blue focus:ring-0"
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {allUsers
                          .filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase()))
                          .map(u => (
                            <div key={u.id} className="p-3 bg-white/5 rounded border border-[#1e293b] space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold">{u.displayName || 'Anonymous'}</p>
                                  <p className="text-[10px] text-[#94a3b8]">{u.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {u.isJamie && <span className="px-2 py-0.5 bg-pink-500/20 text-pink-500 text-[8px] font-bold rounded">JAMIE</span>}
                                  {u.isJosiah && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-500 text-[8px] font-bold rounded">JOSIAH</span>}
                                  {u.isFamily && <span className="px-2 py-0.5 bg-jarvis-blue/20 text-jarvis-blue text-[8px] font-bold rounded">FAMILY</span>}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-4 gap-2">
                                <button 
                                  onClick={() => updateDoc(doc(db, 'users', u.id), { isJamie: !u.isJamie })}
                                  className={cn("text-[8px] p-1 border rounded uppercase font-bold", u.isJamie ? "border-pink-500 text-pink-500" : "border-[#1e293b] text-[#94a3b8]")}
                                >
                                  Jamie
                                </button>
                                <button 
                                  onClick={() => updateDoc(doc(db, 'users', u.id), { isJosiah: !u.isJosiah })}
                                  className={cn("text-[8px] p-1 border rounded uppercase font-bold", u.isJosiah ? "border-orange-500 text-orange-500" : "border-[#1e293b] text-[#94a3b8]")}
                                >
                                  Josiah
                                </button>
                                <button 
                                  onClick={() => updateDoc(doc(db, 'users', u.id), { isFamily: !u.isFamily })}
                                  className={cn("text-[8px] p-1 border rounded uppercase font-bold", u.isFamily ? "border-jarvis-blue text-jarvis-blue" : "border-[#1e293b] text-[#94a3b8]")}
                                >
                                  Family
                                </button>
                                <button 
                                  onClick={() => updateDoc(doc(db, 'users', u.id), { hasFullAccess: !u.hasFullAccess })}
                                  className={cn("text-[8px] p-1 border rounded uppercase font-bold", u.hasFullAccess ? "bg-green-500 text-white border-green-500" : "border-[#1e293b] text-[#94a3b8]")}
                                >
                                  Access
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : devTab === 'voice' ? (
                    <div className="p-6 space-y-4">
                      <p className="text-xs text-[#94a3b8]">Select the base voice profile for ACKTION. To use Anthony's real voice, please upload a clean audio sample (.mp3 or .wav) from his reels.</p>
                      <div className="grid grid-cols-3 gap-4">
                        {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map(v => (
                          <button 
                            key={v}
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'users', user.uid), { voicePreference: v });
                              } catch (e) { console.error(e); }
                            }}
                            className={cn(
                              "p-4 border rounded text-sm font-bold transition-all",
                              profile?.voicePreference === v ? "border-jarvis-blue bg-jarvis-blue/20 text-jarvis-blue" : "border-[#1e293b] hover:bg-white/5"
                            )}
                          >
                            {v}
                          </button>
                        ))}
                        <div className="p-4 border border-dashed border-jarvis-blue/30 rounded text-[10px] flex flex-col items-center justify-center text-center">
                          <Mic className="w-4 h-4 mb-2 text-jarvis-blue animate-pulse" />
                          <span className="text-jarvis-blue font-bold">Awaiting Audio Sync</span>
                          <span className="text-[8px] mt-1 opacity-50">Upload .mp3 to chat to begin cloning</span>
                        </div>
                      </div>
                    </div>
                  ) : devTab === 'gateway' ? (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-jarvis-blue">Visionary Gateway</h3>
                          <p className="text-[10px] text-[#94a3b8]">Bucket: visionary92 | Compatibility: 2024-05-01</p>
                        </div>
                        <div className="px-2 py-1 bg-green-500/20 text-green-500 text-[8px] font-bold rounded uppercase">
                          Status: Connected
                        </div>
                      </div>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                      
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "border-2 border-dashed border-[#1e293b] rounded-lg p-8 flex flex-col items-center justify-center text-center hover:border-jarvis-blue transition-colors cursor-pointer group",
                          isUploading ? "opacity-50 cursor-wait" : ""
                        )}
                      >
                        {isUploading ? (
                          <Activity className="w-8 h-8 mb-3 text-jarvis-blue animate-spin" />
                        ) : (
                          <Upload className="w-8 h-8 mb-3 text-[#94a3b8] group-hover:text-jarvis-blue transition-colors" />
                        )}
                        <p className="text-sm font-medium">PUT Asset into visionary92</p>
                        <p className="text-[10px] text-[#94a3b8] mt-1">Authorized for Anthony Alexander voice data</p>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {gatewayFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded border border-[#1e293b]">
                            <div className="flex items-center gap-3">
                              <File className="w-4 h-4 text-jarvis-blue" />
                              <span className="text-xs truncate max-w-[150px]">{f.name}</span>
                            </div>
                            <a 
                              href={f.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] text-jarvis-blue hover:underline"
                            >
                              GET
                            </a>
                          </div>
                        ))}
                        {gatewayFiles.length === 0 && (
                          <div className="text-center py-6 opacity-20">
                            <HardDrive className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-[10px]">Bucket is empty</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : devTab === 'mining' ? (
                    <div className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-jarvis-blue uppercase tracking-widest">Mining Factory Control</h3>
                          <p className="text-[10px] text-[#94a3b8]">Bitcore & Multi-Coin Infrastructure</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-jarvis-blue text-jarvis-dark text-[10px] font-bold rounded">REBOOT ALL</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {miningRigs.map(rig => (
                          <div key={rig.id} className="p-4 bg-white/5 border border-[#1e293b] rounded-lg space-y-3 relative overflow-hidden group">
                            <div className="flex items-center justify-between">
                              <Server className={cn("w-5 h-5", rig.status === 'online' ? "text-jarvis-blue" : "text-[#94a3b8]")} />
                              <div className={cn("w-2 h-2 rounded-full", rig.status === 'online' ? "bg-green-500 jarvis-glow animate-pulse" : "bg-red-500")} />
                            </div>
                            <div>
                              <p className="text-xs font-bold">{rig.name}</p>
                              <p className="text-[10px] text-[#94a3b8]">{rig.hashrate}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[8px] uppercase font-bold">
                              <div className="flex flex-col">
                                <span className="opacity-50 text-[6px]">Temp</span>
                                <span className={parseInt(rig.temp) > 65 ? "text-orange-500" : "text-green-500"}>{rig.temp}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="opacity-50 text-[6px]">Efficiency</span>
                                <span className="text-jarvis-blue">{rig.efficiency}</span>
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-jarvis-blue/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          </div>
                        ))}
                        <div className="p-4 border-2 border-dashed border-[#1e293b] rounded-lg flex flex-col items-center justify-center text-center hover:border-jarvis-blue transition-colors cursor-pointer group">
                          <Upload className="w-5 h-5 mb-2 text-[#94a3b8] group-hover:text-jarvis-blue" />
                          <span className="text-[10px] font-bold uppercase">Connect Rig</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-jarvis-blue uppercase">
                          <Database className="w-3 h-3" />
                          <span>Cold Storage Vaults</span>
                        </div>
                        <div className="bg-black/40 rounded border border-[#1e293b] p-3 space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3 text-green-500" />
                              <span>Main Ledger (Air-Gapped)</span>
                            </div>
                            <span className="font-mono text-jarvis-blue">6.421 BTC</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3 text-green-500" />
                              <span>Altcoin Reserve</span>
                            </div>
                            <span className="font-mono text-jarvis-blue">142.5 ETH</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-jarvis-blue uppercase tracking-widest">Cognitive Growth Monitor</h3>
                          <p className="text-[10px] text-[#94a3b8]">Developer Peripherals: Active Learning Mode</p>
                        </div>
                        <button 
                          onClick={() => setIsCognitiveActive(!isCognitiveActive)}
                          className={cn(
                            "px-3 py-1 rounded text-[10px] font-bold transition-all",
                            isCognitiveActive ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-jarvis-blue/20 text-jarvis-blue border border-jarvis-blue/50"
                          )}
                        >
                          {isCognitiveActive ? "TERMINATE LOOP" : "INITIALIZE LOOP"}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <button 
                            onClick={toggleCamera}
                            className={cn(
                              "w-full p-3 rounded border flex items-center justify-between text-xs font-bold transition-all",
                              isCameraActive ? "border-jarvis-blue bg-jarvis-blue/10 text-jarvis-blue" : "border-[#1e293b] text-[#94a3b8]"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              <span>OPTICAL SENSORS</span>
                            </div>
                            <div className={cn("w-2 h-2 rounded-full", isCameraActive ? "bg-jarvis-blue animate-pulse" : "bg-gray-600")} />
                          </button>
                          
                          <button 
                            onClick={toggleScreen}
                            className={cn(
                              "w-full p-3 rounded border flex items-center justify-between text-xs font-bold transition-all",
                              isScreenActive ? "border-jarvis-blue bg-jarvis-blue/10 text-jarvis-blue" : "border-[#1e293b] text-[#94a3b8]"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4" />
                              <span>SYSTEM MIRROR</span>
                            </div>
                            <div className={cn("w-2 h-2 rounded-full", isScreenActive ? "bg-jarvis-blue animate-pulse" : "bg-gray-600")} />
                          </button>
                        </div>

                        <div className="bg-black/40 rounded border border-[#1e293b] p-3 flex flex-col items-center justify-center relative overflow-hidden">
                          <video ref={videoRef} autoPlay muted playsInline className={cn("w-full h-full object-cover rounded", isCameraActive ? "block" : "hidden")} />
                          <video ref={screenRef} autoPlay muted playsInline className={cn("w-full h-full object-cover rounded", isScreenActive ? "block" : "hidden")} />
                          {!isCameraActive && !isScreenActive && (
                            <div className="text-center opacity-20">
                              <Activity className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-[8px] uppercase">No Visual Input</p>
                            </div>
                          )}
                          <canvas ref={canvasRef} className="hidden" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-jarvis-blue uppercase">
                          <Terminal className="w-3 h-3" />
                          <span>Cognitive Observations</span>
                        </div>
                        <div className="bg-black/60 rounded border border-[#1e293b] p-3 h-[120px] overflow-y-auto font-mono text-[9px] space-y-2">
                          {cognitiveLogs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-jarvis-blue">[{log.time}]</span>
                              <span className="text-[#94a3b8]">{log.observation}</span>
                            </div>
                          ))}
                          {cognitiveLogs.length === 0 && (
                            <p className="text-center py-8 opacity-20">Awaiting data stream...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                  <BrainCircuit className="w-20 h-20 mb-4 text-jarvis-blue" />
                  <p className="text-xl font-light tracking-widest">AWAITING COMMAND</p>
                </div>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[90%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded flex-shrink-0 flex items-center justify-center border",
                    msg.role === 'user' ? "border-white/20 bg-white/5" : "border-jarvis-blue/40 bg-jarvis-blue/10"
                  )}>
                    {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Cpu className="w-4 h-4 text-jarvis-blue" />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-lg text-sm leading-relaxed",
                    msg.role === 'user' ? "bg-white/5 border border-white/10" : "bg-[#0e1218] border border-[#1e293b]"
                  )}>
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isThinking && (
                <div className="flex gap-4 max-w-[90%]">
                  <div className="w-8 h-8 rounded border border-jarvis-blue/40 bg-jarvis-blue/10 flex items-center justify-center animate-spin">
                    <Zap className="w-4 h-4 text-jarvis-blue" />
                  </div>
                  <div className="p-4 rounded-lg bg-[#0e1218] border border-[#1e293b] text-sm text-[#94a3b8] italic">
                    Processing tactical data...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

            {/* Input Area */}
            <div className="absolute bottom-6 left-6 right-6">
              <form 
                onSubmit={handleSend}
                className="bg-[#0e1218] border border-jarvis-blue rounded-lg p-2 flex items-center gap-2 jarvis-glow"
              >
                <button 
                  type="button"
                  onClick={() => setIsListening(!isListening)}
                  className={cn(
                    "p-3 rounded transition-all",
                    isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "hover:bg-white/5 text-white/40"
                  )}
                  title="Manual Voice Command"
                >
                  {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsWakeWordEnabled(!isWakeWordEnabled)}
                  className={cn(
                    "p-3 rounded transition-all",
                    isWakeWordEnabled ? "text-jarvis-blue" : "text-white/20"
                  )}
                  title="Wake Word: 'Hey Anthony'"
                >
                  <Zap className={cn("w-5 h-5", isWakeWordEnabled ? "animate-pulse" : "")} />
                </button>
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Input command..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-white/20"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="p-3 bg-jarvis-blue text-jarvis-dark rounded hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Right Panel: Controls/System */}
        <section className="flex flex-col gap-5 overflow-hidden">
          <div className="jarvis-panel flex-1">
            <div className="panel-header">
              <span>Device Control</span>
              <span>Active</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              <DeviceBtn label="Main Lights" active />
              <DeviceBtn label="Climate" />
              <DeviceBtn label="Security" active />
              <DeviceBtn label="Entertainment" />
              <DeviceBtn label="Kitchen" />
              <DeviceBtn label="Network" active />
            </div>

            <div className="panel-header border-t border-[#1e293b]">
              <span>System Diagnostics</span>
            </div>
            <div className="p-4 space-y-4">
              <DiagnosticBar label="Voice Fidelity" value="99.8%" progress={99} />
              <DiagnosticBar label="Emotional Sync" value="Adaptive" progress={85} />
            </div>
            
            <div className="panel-header border-t border-[#1e293b]">
              <span>Active Protocols</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {reminders.map(r => (
                <div key={r.id} className="p-3 bg-white/5 border border-[#1e293b] rounded flex items-center justify-between">
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold truncate">{r.title}</p>
                    <p className="text-[10px] text-[#94a3b8]">{new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className={cn("w-1.5 h-1.5 rounded-full", r.completed ? "bg-green-500" : "bg-jarvis-blue animate-pulse")} />
                </div>
              ))}
              {reminders.length === 0 && <p className="text-[10px] text-[#94a3b8] text-center py-4">No active protocols.</p>}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Ticker */}
      <footer className="h-[60px] bg-[#0e1218] border-t border-[#1e293b] flex items-center px-10 gap-10 z-30">
        <div className="text-xs font-bold text-jarvis-blue whitespace-nowrap">INTEL FEED</div>
        <div className="text-xs text-[#94a3b8] overflow-hidden whitespace-nowrap flex-1">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex gap-10"
          >
            <span>LATEST: Tech giants announce breakthrough in neural processing • Kansas City weather: Partly cloudy • New memory update from Developer verified • Smart home nodes synchronized...</span>
            <span>LATEST: Tech giants announce breakthrough in neural processing • Kansas City weather: Partly cloudy • New memory update from Developer verified • Smart home nodes synchronized...</span>
          </motion.div>
        </div>
        <div className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded uppercase">
          Alarm: 7:30 AM Tomorrow
        </div>
      </footer>
    </div>
  );
}

function KnowledgeCard({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white/5 border border-[#1e293b] rounded-lg hover:border-jarvis-blue transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="text-jarvis-blue group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>
      </div>
      <p className="text-[10px] text-[#94a3b8] leading-relaxed">{description}</p>
    </div>
  );
}

function DeviceBtn({ label, active }: { label: string, active?: boolean }) {
  return (
    <div className={cn(
      "p-3 border border-[#1e293b] rounded text-[10px] text-center transition-colors cursor-pointer",
      active ? "bg-jarvis-blue/20 border-jarvis-blue text-jarvis-blue" : "hover:bg-white/5"
    )}>
      {label}
    </div>
  );
}

function DiagnosticBar({ label, value, progress }: { label: string, value: string, progress: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span>{label}</span>
        <span className="text-jarvis-blue">{value}</span>
      </div>
      <div className="h-1 bg-[#1e293b] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-jarvis-blue"
        />
      </div>
    </div>
  );
}

function VisualCore({ url, isThinking }: { url: string | null, isThinking: boolean }) {
  return (
    <div className="relative w-full aspect-square max-w-[200px] mx-auto">
      <AnimatePresence mode="wait">
        {url ? (
          <motion.div
            key="avatar"
            initial={{ opacity: 0, scale: 0.9, rotateY: -20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              rotateY: 0,
              y: [0, -5, 0]
            }}
            transition={{ 
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              default: { duration: 0.5 }
            }}
            className="relative w-full h-full rounded-full overflow-hidden border-2 border-jarvis-blue/30 jarvis-glow bg-[#0a0e14]"
          >
            <img 
              src={url} 
              alt="Anthony Avatar" 
              className="w-full h-full object-cover opacity-80 mix-blend-screen" 
              referrerPolicy="no-referrer" 
            />
            
            {/* Scanline effect on avatar */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-30" />
            
            {/* Thinking pulse */}
            {isThinking && (
              <motion.div 
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 bg-jarvis-blue/20"
              />
            )}
            
            {/* Subtle facial "expression" movement simulation */}
            <motion.div 
              animate={{ 
                scale: isThinking ? [1, 1.02, 1] : 1,
                filter: isThinking ? ["hue-rotate(0deg)", "hue-rotate(10deg)", "hue-rotate(0deg)"] : "none"
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 pointer-events-none"
            />
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            className="w-full h-full rounded-full border-2 border-dashed border-[#1e293b] flex flex-col items-center justify-center text-[#94a3b8]"
          >
            <BrainCircuit className="w-12 h-12 mb-2 opacity-20 animate-pulse" />
            <span className="text-[8px] uppercase tracking-widest opacity-50">Visual Core Initializing</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HUD Rings */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -inset-4 border border-jarvis-blue/10 rounded-full border-dashed pointer-events-none" 
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute -inset-8 border border-jarvis-blue/5 rounded-full border-dotted pointer-events-none" 
      />
    </div>
  );
}

