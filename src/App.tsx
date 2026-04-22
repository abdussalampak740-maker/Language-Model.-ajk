/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Volume2, Languages, Loader2, Play, RefreshCcw, BookOpen, X, Send, Trash2 } from 'lucide-react';
import { useAudioRecorder, blobToBase64 } from './hooks/useAudioRecorder';
import { processPahariSpeech, VoiceResponse } from './services/geminiService';
import { playPcmAudio } from './lib/pcmUtils';
import { getLearnedRules, addLearnedRule, clearLearnedRules, rulesToPrompt } from './lib/dialectStore';

export default function App() {
  const { isRecording, audioBlob, startRecording, stopRecording, clearAudio } = useAudioRecorder();
  const [response, setResponse] = useState<VoiceResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [learnedRules, setLearnedRules] = useState(getLearnedRules());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newRuleText, setNewRuleText] = useState("");

  // Auto-process once audio is recorded
  useEffect(() => {
    if (audioBlob) {
      handleProcessAudio(audioBlob);
    }
  }, [audioBlob]);

  const handleProcessAudio = async (blob: Blob) => {
    setStatus('thinking');
    setErrorMsg(null);
    try {
      const base64 = await blobToBase64(blob);
      const result = await processPahariSpeech(base64, rulesToPrompt(learnedRules));
      setResponse(result);
      
      // Auto-play the response audio if available
      if (result.audioBase64) {
        playAudio(result.audioBase64);
      } else {
        setStatus('idle');
      }
    } catch (error: any) {
      console.error(error);
      const isQuota = error?.message?.toLowerCase().includes("quota") || error?.status === 429;
      setErrorMsg(isQuota 
        ? "Daily AI usage limit reached. It usually resets every 24 hours. Please try again later or check your API quota." 
        : (error?.message || "Failed to call the Gemini API. Please try again."));
      setStatus('idle');
    } finally {
      clearAudio();
    }
  };

  const handleAddRuleFromResponse = () => {
    if (response?.transcription) {
       const rule = `The user says '${response.transcription}' is the correct way to speak.`;
       const updated = addLearnedRule(rule);
       setLearnedRules(updated);
       setIsSidebarOpen(true);
    }
  };

  const handleManualAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    const updated = addLearnedRule(newRuleText);
    setLearnedRules(updated);
    setNewRuleText("");
  };

  const handleClearRules = () => {
    clearLearnedRules();
    setLearnedRules([]);
  };

  const playAudio = async (base64: string) => {
    try {
      setStatus('speaking');
      await playPcmAudio(base64);
    } catch (error: any) {
      console.error("PCM Playback Error:", error);
      setErrorMsg("Audio playback failed.");
    } finally {
      setStatus('idle');
    }
  };

  const toggleRecording = () => {
    if (status === 'listening') {
      stopRecording();
    } else if (status === 'idle' || status === 'speaking') {
      // If AI is talking, stop it first (implied in a fast UI)
      setResponse(null);
      setErrorMsg(null);
      setStatus('listening');
      startRecording();
    }
  };

  const reset = () => {
    setResponse(null);
    clearAudio();
    setStatus('idle');
    setErrorMsg(null);
  };

  // UI variant based on status
  const theme = {
    listening: 'bg-blue-500 shadow-[0_0_60px_rgba(59,130,246,0.5)]',
    thinking: 'bg-purple-500 shadow-[0_0_60px_rgba(168,85,247,0.5)]',
    speaking: 'bg-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.5)]',
    idle: 'bg-white border border-gray-100 shadow-sm'
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F1F1F] flex flex-col font-sans select-none overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none transition-all duration-1000 overflow-hidden">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[150px] transition-all duration-1000 ${
           status === 'listening' ? 'bg-blue-200/40 opacity-100' :
           status === 'thinking' ? 'bg-purple-200/40 opacity-100' :
           status === 'speaking' ? 'bg-emerald-200/40 opacity-100' :
           'bg-gray-100 opacity-20'
        }`} />
      </div>

      {/* Mini Header */}
      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 text-gray-500"
          >
             <BookOpen size={20} />
          </button>
          <span className="text-sm font-semibold tracking-tight text-gray-400 uppercase tracking-widest text-[10px]">Pahari Highlands AI</span>
        </div>
        <button onClick={reset} className="p-3 hover:bg-white rounded-full transition-all text-gray-400 hover:text-gray-600 active:scale-90">
           <RefreshCcw size={18} />
        </button>
      </header>

      {/* Sidebar / Dialect Library */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-white shadow-2xl z-[70] p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <BookOpen size={20} className="text-rose-500" />
                  <h3 className="font-bold uppercase tracking-widest text-xs text-gray-800">Dialect Library</h3>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-6">
                {learnedRules.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-xs text-gray-400 font-medium">No rules taught yet.</p>
                  </div>
                ) : (
                  learnedRules.map((r) => (
                    <div key={r.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group relative">
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">{r.rule}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-auto space-y-4">
                <form onSubmit={handleManualAddRule} className="relative">
                  <input 
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Teach a new rule..."
                    className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-4 pr-10 text-xs focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button type="submit" className="absolute right-2 top-1.5 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                    <Send size={14} />
                  </button>
                </form>
                
                {learnedRules.length > 0 && (
                  <button 
                    onClick={handleClearRules}
                    className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors py-2"
                  >
                    <Trash2 size={12} />
                    Reset Library
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Experience */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 max-w-4xl mx-auto w-full">
        
        {/* Central Visualization Area */}
        <div className="flex flex-col items-center gap-16 w-full">
          
          <div className="relative group">
            {/* Visual Pulse Waves */}
            <AnimatePresence>
              {status !== 'idle' && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                    className={`absolute -inset-10 rounded-full border-2 ${
                      status === 'listening' ? 'border-blue-400' :
                      status === 'thinking' ? 'border-purple-400' :
                      'border-emerald-400'
                    }`}
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0.2 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.5, ease: "easeOut" }}
                    className={`absolute -inset-6 rounded-full border-2 ${
                      status === 'listening' ? 'border-blue-400' :
                      status === 'thinking' ? 'border-purple-400' :
                      'border-emerald-400'
                    }`}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Interaction Button */}
            <button
               onClick={toggleRecording}
               disabled={status === 'thinking'}
               className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 transform active:scale-90 hover:scale-105 z-20 relative ${theme[status]}`}
            >
              <AnimatePresence mode="wait">
                {status === 'thinking' ? (
                  <motion.div key="thinking" initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                    <Loader2 size={44} className="text-white" />
                  </motion.div>
                ) : status === 'listening' ? (
                   <motion.div key="listening" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                      <div className="flex gap-1.5 h-10 items-center justify-center">
                         {[0, 1, 2].map(i => (
                            <motion.div
                               key={i}
                               animate={{ height: [12, 32, 12] }}
                               transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                               className="w-1.5 bg-white rounded-full transition-all"
                            />
                         ))}
                      </div>
                   </motion.div>
                ) : status === 'speaking' ? (
                   <motion.div key="speaking" initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex gap-1 items-center">
                      <Volume2 size={44} className="text-white animate-pulse" />
                   </motion.div>
                ) : (
                   <motion.div key="idle" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                      <Mic size={48} className="text-gray-800" />
                   </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* User Transcript Container */}
          <div className="w-full text-center min-h-[140px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {status === 'idle' && !response && (
                <motion.div key="idle-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 className="text-4xl font-serif text-gray-900 mb-2 font-medium tracking-tight">Assaan sunnay aan...</h2>
                  <p className="text-gray-400 font-medium uppercase tracking-[0.3em] text-[10px]">Pahari Voice Interface Active</p>
                </motion.div>
              )}

              {status === 'listening' && (
                <motion.div key="listen-text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-blue-500 font-bold uppercase tracking-[0.5em] text-[11px]">
                  Listening Now
                </motion.div>
              )}

              {status === 'thinking' && (
                 <motion.div key="thinking-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-purple-500 font-bold uppercase tracking-[0.5em] text-[11px]">
                   Processing Dialect
                 </motion.div>
              )}

              {response?.transcription && (
                <motion.div
                  key="transcription"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/70 backdrop-blur-md rounded-[32px] p-10 shadow-sm border border-white/50 w-full"
                >
                  <p className="urdu text-5xl leading-tight text-right text-gray-800" dir="rtl">
                    {response.transcription}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Feedback/Error */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 text-red-700 px-6 py-3 rounded-full text-xs font-semibold border border-red-100 flex items-center gap-3"
              >
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </main>

      {/* Interactive Footer Map Bits */}
      <footer className="fixed bottom-0 left-0 right-0 p-12 flex justify-between items-end gap-10 opacity-40">
        <div className="flex gap-8">
           <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest">Latency</div>
              <div className="text-lg font-serif">Low (24ms)</div>
           </div>
           <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest">Identity</div>
              <div className="text-lg font-serif tracking-tighter">Pahari-AJK</div>
           </div>
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.6em] text-gray-400">
          Native Voice Intelligence
        </div>
      </footer>

      {/* Quota Info Box */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-medium opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2">
        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
        Daily free-tier quota applies. Resets every 24 hours.
      </div>

    </div>
  );
}
