import { useState, useEffect, useRef, FormEvent, KeyboardEvent, MouseEvent } from "react";
import { 
  Languages, 
  ArrowRightLeft, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Bookmark, 
  Trash2, 
  Sparkles, 
  Share2, 
  Moon, 
  Sun, 
  RefreshCw, 
  AlertTriangle, 
  Globe, 
  X, 
  ChevronRight, 
  BookmarkCheck, 
  BookOpen, 
  Maximize2, 
  Search, 
  Smile, 
  FileText,
  Clock,
  ExternalLink,
  CornerDownRight,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Popular languages supported by LingoPulse
interface Language {
  code: string;
  name: string;
  nativeName: string;
  speechLocale: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", speechLocale: "en-US" },
  { code: "es", name: "Spanish", nativeName: "Español", speechLocale: "es-ES" },
  { code: "fr", name: "French", nativeName: "Français", speechLocale: "fr-FR" },
  { code: "de", name: "German", nativeName: "Deutsch", speechLocale: "de-DE" },
  { code: "it", name: "Italian", nativeName: "Italiano", speechLocale: "it-IT" },
  { code: "ja", name: "Japanese", nativeName: "日本語", speechLocale: "ja-JP" },
  { code: "zh", name: "Chinese", nativeName: "中文 (简体)", speechLocale: "zh-CN" },
  { code: "ko", name: "Korean", nativeName: "한국어", speechLocale: "ko-KR" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", speechLocale: "hi-IN" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", speechLocale: "mr-IN" },
  { code: "pt", name: "Portuguese", nativeName: "Português", speechLocale: "pt-BR" },
  { code: "ru", name: "Russian", nativeName: "Русский", speechLocale: "ru-RU" },
  { code: "ar", name: "Arabic", nativeName: "العربية", speechLocale: "ar-SA" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", speechLocale: "tr-TR" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", speechLocale: "vi-VN" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", speechLocale: "nl-NL" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", speechLocale: "sv-SE" },
];

const PRESET_PHRASES = [
  { text: "Thank you so much for your hospitality and guidance.", category: "Polite" },
  { text: "Where can I find the nearest train station and coffee shop?", category: "Travel" },
  { text: "What time is our project presentation starting today?", category: "Work" },
  { text: "That is an absolutely beautiful view! Let's take a photo.", category: "Casual" }
];

interface HistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  detectedLangName?: string;
  tone: string;
  timestamp: string;
  isFavorite: boolean;
}

interface Alternative {
  text: string;
  description: string;
}

interface VocabularyWord {
  originalWord: string;
  translatedWord: string;
  meaning: string;
  pronunciation?: string;
}

interface TranslationResponse {
  translatedText: string;
  detectedLanguageCode: string;
  detectedLanguageName: string;
  alternatives: Alternative[];
  breakdown: VocabularyWord[];
  pronunciationGuide: string;
}

export default function App() {
  // Theme & Layout state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lingoPulse_darkMode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Main Input & Translation workflow state
  const [inputText, setInputText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto"); // "auto" means detect language
  const [targetLang, setTargetLang] = useState("es"); // default to Spanish
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLangInfo, setDetectedLangInfo] = useState<{ code: string; name: string } | null>(null);
  const [tone, setTone] = useState("balanced"); // balanced, formal, informal, literary, literal

  // Detailed Linguistic insights from server
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [vocabularyBreakdown, setVocabularyBreakdown] = useState<VocabularyWord[]>([]);
  const [pronunciationGuide, setPronunciationGuide] = useState("");

  // Interactive UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<"breakdown" | "alternatives" | "context">("breakdown");

  // History & Filter state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lingoPulse_history");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [searchHistory, setSearchHistory] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "favorites">("all");

  // Web Speech synthesis reference
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Sync theme
  useEffect(() => {
    localStorage.setItem("lingoPulse_darkMode", String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Sync history
  useEffect(() => {
    localStorage.setItem("lingoPulse_history", JSON.stringify(history));
  }, [history]);

  // Trigger Translation
  const handleTranslate = async (e?: FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToTranslate = overrideText !== undefined ? overrideText : inputText;

    if (!textToTranslate || textToTranslate.trim() === "") {
      setError("Please write some text to translate.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang: sourceLang === "auto" ? "" : sourceLang,
          targetLang: targetLang,
          tone: tone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Translation API request failed.");
      }

      setTranslatedText(data.translatedText);
      setAlternatives(data.alternatives || []);
      setVocabularyBreakdown(data.breakdown || []);
      setPronunciationGuide(data.pronunciationGuide || "");

      if (sourceLang === "auto") {
        setDetectedLangInfo({
          code: data.detectedLanguageCode,
          name: data.detectedLanguageName,
        });
      } else {
        setDetectedLangInfo(null);
      }

      // Add to translation history log
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        originalText: textToTranslate,
        translatedText: data.translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        detectedLangName: sourceLang === "auto" ? data.detectedLanguageName : undefined,
        tone: tone,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isFavorite: false,
      };

      setHistory(prev => [newHistoryItem, ...prev.slice(0, 49)]); // Keep last 50 items

    } catch (err: any) {
      console.error("Translation execution error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong during translation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run translation quickly when tone changes and input is not empty
  const handleToneChange = (newTone: string) => {
    setTone(newTone);
    if (inputText && inputText.trim() !== "") {
      // Trigger update with the new tone
      setTimeout(() => {
        const textToUse = inputText;
        setIsLoading(true);
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textToUse,
            sourceLang: sourceLang === "auto" ? "" : sourceLang,
            targetLang: targetLang,
            tone: newTone,
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.translatedText) {
            setTranslatedText(data.translatedText);
            setAlternatives(data.alternatives || []);
            setVocabularyBreakdown(data.breakdown || []);
            setPronunciationGuide(data.pronunciationGuide || "");
          }
        })
        .catch(err => console.error("Tone live change failed", err))
        .finally(() => setIsLoading(false));
      }, 50);
    }
  };

  // Swap Languages
  const handleSwap = () => {
    // If auto is selected on source, replace it with detected lang or English if none
    const actualSource = sourceLang === "auto" 
      ? (detectedLangInfo?.code || "en") 
      : sourceLang;
    
    const actualTarget = targetLang;

    // Prevent swapping to the exact same language
    if (actualSource === actualTarget) return;

    setSourceLang(actualTarget);
    setTargetLang(actualSource);
    setInputText(translatedText);
    setTranslatedText(inputText);
    setDetectedLangInfo(null);

    // Trigger a new translation
    if (translatedText && translatedText.trim() !== "") {
      setIsLoading(true);
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translatedText,
          sourceLang: actualTarget,
          targetLang: actualSource,
          tone: tone,
        })
      })
      .then(res => res.json())
      .then(data => {
        setTranslatedText(data.translatedText);
        setAlternatives(data.alternatives || []);
        setVocabularyBreakdown(data.breakdown || []);
        setPronunciationGuide(data.pronunciationGuide || "");
      })
      .catch((err) => console.error("Swap action translation failed", err))
      .finally(() => setIsLoading(false));
    }
  };

  // Copy to Clipboard
  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Text to Speech
  const handleTTS = () => {
    if (!translatedText || !synthRef.current) return;

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    // Capture the locale
    const findLang = LANGUAGES.find(l => l.code === targetLang);
    const locale = findLang ? findLang.speechLocale : "en-US";

    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = locale;

    // Try to load correct voice for the target language
    const voices = synthRef.current.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(targetLang) || v.lang.startsWith(locale));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  // Keyboard shortcut (Ctrl + Enter or Cmd + Enter) to translate
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleTranslate();
    }
  };

  // History Interactions
  const toggleFavorite = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, isFavorite: !item.isFavorite };
      }
      return item;
    }));
  };

  const deleteHistoryItem = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    if (confirm("Are you sure you want to clear your translation log history?")) {
      setHistory([]);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setInputText(item.originalText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setTranslatedText(item.translatedText);
    setTone(item.tone);
    setDetectedLangInfo(null);
    setAlternatives([]);
    setVocabularyBreakdown([]);
    setPronunciationGuide("");
    
    // Smooth scroll back to translator view
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Preset loading helper
  const handleLoadPreset = (text: string) => {
    setInputText(text);
    // Autofilling fires translation after immediate state update
    handleTranslate(undefined, text);
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.originalText.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.translatedText.toLowerCase().includes(searchHistory.toLowerCase());
    const matchesFilter = historyFilter === "favorites" ? item.isFavorite : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div id="lingopulse-app" className={`min-h-screen transition-all duration-300 font-sans ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10 transition-colors">
        
        {/* Navigation / Header */}
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
              <Languages className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-white dark:to-indigo-200 bg-clip-text text-transparent">
                LingoPulse <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full ml-1">AI PRO</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">High-fidelity smart translator & language learning aid</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full border border-emerald-400/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Gemini AI Connected
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* Major Translator Grid Workspace */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* Translator Main Card - Left Column */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Tone Selector & Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Requested Tone:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "balanced", label: "Balanced", color: "hover:bg-slate-100 dark:hover:bg-slate-800" },
                  { id: "formal", label: "Polite/Formal", color: "hover:bg-blue-500/10 text-blue-500" },
                  { id: "informal", label: "Casual/Slang", color: "hover:bg-violet-500/10 text-violet-500" },
                  { id: "literary", label: "Poetic", color: "hover:bg-pink-500/10 text-pink-500" },
                  { id: "literal", label: "Word-by-Word", color: "hover:bg-emerald-500/10 text-emerald-500" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleToneChange(item.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      tone === item.id 
                        ? "bg-slate-900 dark:bg-indigo-600 text-white dark:text-white scale-102" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/30 dark:hover:border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Side-By-Side Translation Interface */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden transition-all duration-300">
              
              {/* Top Selector Panel */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 p-4 gap-3">
                
                {/* Source Selection Dropdown */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">From</span>
                  <div className="relative flex-1">
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-slate-300 dark:hover:border-slate-600 transition-all appearance-none cursor-pointer"
                    >
                      <option value="auto">🌎 Match / Auto Detect Language</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l pl-2 border-slate-200 dark:border-slate-700">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center items-center py-1 sm:py-0 px-2">
                  <button
                    onClick={handleSwap}
                    className="p-2.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-indigo-400/50 dark:hover:border-indigo-400/50 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:scale-110 active:scale-95 shadow-sm transition-all cursor-pointer"
                    title="Swap native & target languages"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Target Selection Dropdown */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">To</span>
                  <div className="relative flex-1">
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-slate-300 dark:hover:border-slate-600 transition-all appearance-none cursor-pointer"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          ✨ {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l pl-2 border-slate-200 dark:border-slate-700">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Text Inputs Container GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-800/85">
                
                {/* Source Input Box (Left Panel) */}
                <div className="p-5 flex flex-col justify-between min-h-[300px] h-full relative">
                  <div>
                    <textarea
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Write or paste your text here..."
                      maxLength={5000}
                      className="w-full bg-transparent resize-none border-0 p-0 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base leading-relaxed h-[200px] focus:outline-none focus:ring-0 focus:border-0"
                    />

                    {detectedLangInfo && (
                      <div className="absolute top-5 right-5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-bold border border-indigo-500/20">
                        <Globe className="w-3.5 h-3.5 animate-spin" />
                        Detected: {detectedLangInfo.name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100/10 pt-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-mono font-medium ${inputText.length > 4500 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>
                        {inputText.length} / 5000 chars
                      </span>
                      {inputText && (
                        <button
                          onClick={() => {
                            setInputText("");
                            setTranslatedText("");
                            setDetectedLangInfo(null);
                            setAlternatives([]);
                            setVocabularyBreakdown([]);
                            setPronunciationGuide("");
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/5 transition-all text-xs flex items-center gap-0.5 cursor-pointer"
                          title="Clear input"
                        >
                          <X className="w-3.5 h-3.5" /> Clear
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleTranslate()}
                      disabled={isLoading || !inputText.trim()}
                      className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all text-sm cursor-pointer ${
                        !inputText.trim()
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                          : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-indigo-500/10"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Translating...
                        </>
                      ) : (
                        <>
                          <Languages className="w-4 h-4" /> Translate
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Target Output Box (Right Panel) */}
                <div className="p-5 flex flex-col justify-between min-h-[300px] h-full bg-slate-50/30 dark:bg-slate-900/20 relative">
                  <div>
                    {isLoading ? (
                      <div className="h-[200px] flex flex-col justify-center items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                          <Sparkles className="w-4 h-4 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 animate-pulse font-semibold">Gemini translating context & idioms...</p>
                      </div>
                    ) : translatedText ? (
                      <div>
                        {/* Translate output */}
                        <div className="text-slate-900 dark:text-slate-100 text-base leading-relaxed font-semibold h-[180px] overflow-y-auto whitespace-pre-wrap select-text selection:bg-indigo-500/20">
                          {translatedText}
                        </div>
                        
                        {/* Pronunciation romanization subtitle if provided */}
                        {pronunciationGuide && (
                          <div className="mt-3 inline-flex items-start gap-1 p-2 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 rounded-xl">
                            <span className="text-[10px] font-bold uppercase py-0.5 px-1 bg-amber-500 text-slate-950 dark:text-slate-950 rounded tracking-widest mt-0.5">READ</span>
                            <p className="text-xs font-semibold italic text-slate-600 dark:text-slate-300">{pronunciationGuide}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[200px] flex flex-col justify-center items-center text-slate-400 dark:text-slate-600 gap-1.5">
                        <FileText className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm font-semibold select-none">Translation output as soon as you translate.</p>
                        <p className="text-xs text-slate-400/80 dark:text-slate-650 font-medium">Use preset sentences below to try instantly.</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar for target */}
                  <div className="flex items-center justify-between border-t border-slate-100/10 pt-4 mt-2">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase select-none">
                      Output ({tone})
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Audio Reader */}
                      <button
                        onClick={handleTTS}
                        disabled={!translatedText}
                        className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer ${
                          !translatedText ? "opacity-30 cursor-not-allowed" : "text-slate-700 dark:text-slate-300"
                        }`}
                        title={isSpeaking ? "Stop Speaking" : "Listen to translation"}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* Copy Button */}
                      <button
                        onClick={handleCopy}
                        disabled={!translatedText}
                        className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative ${
                          !translatedText ? "opacity-30 cursor-not-allowed" : "text-slate-700 dark:text-slate-300"
                        }`}
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* General Preset Quick Translate Buttons */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Try common everyday phrases:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_PHRASES.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handleLoadPreset(preset.text)}
                    className="p-3 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/30 rounded-xl text-left text-xs leading-relaxed transition-all cursor-pointer group flex items-start gap-2.5 shadow-sm"
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5 group-hover:translate-x-1 transition-transform" />
                    <div>
                      <span className="font-semibold block text-slate-800 dark:text-slate-200 line-clamp-1">{preset.text}</span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 block">Style: {preset.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-400">Oops, something didn't work</h4>
                  <p className="text-xs text-rose-600/90 dark:text-rose-450 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Tabbed Learning Insights Section (Breakdown, Alternatives) */}
            {(vocabularyBreakdown.length > 0 || alternatives.length > 0) && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden mt-2">
                
                {/* Tab Header */}
                <div className="flex border-b border-slate-200/80 dark:border-slate-800/85 bg-slate-50/70 dark:bg-slate-900/40 px-4">
                  <button
                    onClick={() => setActiveTab("breakdown")}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === "breakdown"
                        ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-850"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" /> Word-by-Word Breakdown
                  </button>
                  <button
                    onClick={() => setActiveTab("alternatives")}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                      activeTab === "alternatives"
                        ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-850"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" /> Alternative phrasing
                  </button>
                </div>

                {/* Tab Content Box */}
                <div className="p-6">
                  
                  {/* Tab 1: Breakdown */}
                  {activeTab === "breakdown" && (
                    <div>
                      {vocabularyBreakdown.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {vocabularyBreakdown.map((item, id) => (
                            <div 
                              key={id}
                              className="p-3.5 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 hover:scale-101 transition-all"
                            >
                              <div className="flex justify-between items-start gap-2 mb-1.5 border-b border-slate-200/20 pb-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-base">
                                  {item.originalWord}
                                </span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                                  {item.translatedWord}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-450 leading-relaxed font-semibold">
                                {item.meaning}
                              </p>
                              {item.pronunciation && (
                                <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 italic mt-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded self-start">
                                  Phonetic: {item.pronunciation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-450 text-center py-4">No breakdown stats loaded yet.</p>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Alternatives */}
                  {activeTab === "alternatives" && (
                    <div>
                      {alternatives.length > 0 ? (
                        <div className="space-y-4">
                          {alternatives.map((item, idx) => (
                            <div 
                              key={idx}
                              className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl hover:border-indigo-500/25 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group"
                            >
                              <div className="space-y-1 max-w-[80%]">
                                <span className="text-[11px] font-bold block text-slate-400 uppercase tracking-widest">
                                  {item.description || "Alternative translation"}
                                </span>
                                <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {item.text}
                                </h5>
                              </div>

                              <div className="flex items-center gap-2 sm:self-center">
                                {/* Load expression helper */}
                                <button
                                  onClick={() => {
                                    setTranslatedText(item.text);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 dark:text-indigo-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-400/10"
                                >
                                  Load this output
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.text);
                                    alert("Alternative copied to clipboard!");
                                  }}
                                  className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-all cursor-pointer"
                                  title="Copy variation"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-450 text-center py-4">Alternative phrased translations will show here.</p>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

          </section>

          {/* Translation History Drawer & Favorite Side Column - Right Column */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            
            {/* History & Favorites Header */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg flex flex-col gap-4 h-full">
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-100/10">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">History Log</h3>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className="p-1 px-2.5 rounded-lg text-[10px] uppercase font-bold tracking-wider hover:bg-rose-500/5 text-rose-500 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              {/* Filters Area */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/65 rounded-xl">
                <button
                  onClick={() => setHistoryFilter("all")}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    historyFilter === "all"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  All ({history.length})
                </button>
                <button
                  onClick={() => setHistoryFilter("favorites")}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    historyFilter === "favorites"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  ★ Favorites ({history.filter(h => h.isFavorite).length})
                </button>
              </div>

              {/* Search filter in translation list */}
              {history.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search past logs..."
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Log Listing Area */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => {
                    const fromLangName = LANGUAGES.find(l => l.code === item.sourceLang)?.name || item.detectedLangName || "Detected";
                    const toLangName = LANGUAGES.find(l => l.code === item.targetLang)?.name || "Target";

                    return (
                      <div
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        className="p-3 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 rounded-2xl border border-slate-200/20 dark:border-slate-800/20 hover:border-indigo-500/10 hover:scale-[1.01] cursor-pointer transition-all flex flex-col justify-between gap-2.5 relative group"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 pr-4 leading-normal">
                            {item.originalText}
                          </p>

                          {/* Quick bookmark star */}
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => toggleFavorite(item.id, e)}
                              className={`p-1 rounded-md transition-all cursor-pointer ${
                                item.isFavorite 
                                  ? "text-amber-500 translate-y-0 opacity-100" 
                                  : "text-slate-300 dark:text-slate-600 hover:text-amber-400"
                              }`}
                              title={item.isFavorite ? "Remove favorite" : "Save to favorites"}
                            >
                              <Bookmark className="w-3.5 h-3.5 fill-current border-0" />
                            </button>
                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-500/5 hover:scale-105 transition-all cursor-pointer"
                              title="Delete log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Result translation text preview */}
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 border-l-2 border-indigo-400/40 pl-2 line-clamp-1 py-0.5">
                          {item.translatedText}
                        </div>

                        {/* Card metadata bar */}
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 border-t border-slate-100/5 pt-1.5 mt-1">
                          <span className="uppercase tracking-wider">
                            {fromLangName.substring(0, 8)} → {toLangName.substring(0, 8)}
                          </span>
                          <span className="font-medium text-slate-400/75 shrink-0 block">
                            {item.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-650 mt-4">
                    <History className="w-10 h-10 text-slate-300 dark:text-slate-700 stroke-1 mb-2 animate-pulse" />
                    <p className="text-xs font-semibold">No translations logged yet.</p>
                    <p className="text-[11px] text-slate-400/75 mt-0.5">Your translating sessions save here automatically.</p>
                  </div>
                )}
              </div>

            </div>

          </section>

        </main>

        {/* Informative Footer explaining Google GenAI translation */}
        <footer className="text-center mt-20 pb-12 border-t border-slate-200/60 dark:border-slate-800/70 pt-8 text-xs text-slate-400 dark:text-slate-500 space-y-3">
          <p className="font-medium">
            🧬 Powered by advanced <b className="text-slate-600 dark:text-slate-300">Google Gemini-3 AI</b> with deep grammatical context parsing and sentiment recognition.
          </p>
          <p className="text-[11px]">
            LingoPulse and its dependencies run completely server-side for maximum API key security and minimal memory footprints.
          </p>
          <div className="flex justify-center gap-6 mt-4 font-bold">
            <span className="text-slate-500 dark:text-slate-400">Ctrl + Enter to trigger</span>
            <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full self-center" />
            <span className="text-slate-500 dark:text-slate-400">Web Speech TTS integration</span>
            <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full self-center" />
            <a href="https://github.com/google" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-1 leading-none">
              Google AI <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}

// Simple fallback icon to prevent crashing if some are missing or different in lucide version
function History(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 8v4l3 3" />
      <path d="M3.05 11a9 9 0 1 1 .2 4m-.2 5v-5h5" />
    </svg>
  );
}
