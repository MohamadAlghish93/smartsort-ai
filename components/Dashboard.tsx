import React, { useState, useEffect } from 'react';
import { FolderOpen, BrainCircuit, Play, Loader2, Search, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { scanDirectory, verifyPermission, moveFile } from '../services/fileSystem';
import { analyzeFiles } from '../services/geminiService';
import { FileRecord, OrganizedFile, FileSystemDirectoryHandle } from '../types';
import FileIcon from './FileIcon';
import StatsPanel from './StatsPanel';
import ApiKeyModal from './ApiKeyModal';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const API_KEY_DATE_KEY = 'gemini_api_key_date';

// Helper function to get today's date string (YYYY-MM-DD)
const getTodayDateString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Helper function to check if API key is valid for today
const isApiKeyValidForToday = (): boolean => {
  const storedDate = localStorage.getItem(API_KEY_DATE_KEY);
  const today = getTodayDateString();
  return storedDate === today;
};

// Helper function to get API key if valid
const getValidApiKey = (): string | null => {
  if (!isApiKeyValidForToday()) {
    // Clear expired API key
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(API_KEY_DATE_KEY);
    return null;
  }
  return localStorage.getItem(API_KEY_STORAGE_KEY);
};

// Helper function to save API key with today's date
const saveApiKey = (apiKey: string): void => {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  localStorage.setItem(API_KEY_DATE_KEY, getTodayDateString());
};

const Dashboard: React.FC = () => {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [files, setFiles] = useState<OrganizedFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [filter, setFilter] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Check for API key on mount
  useEffect(() => {
    const storedApiKey = getValidApiKey();
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setShowApiKeyModal(false);
    } else {
      setApiKey(null);
      setShowApiKeyModal(true);
    }
  }, []);

  const handleApiKeySave = (key: string) => {
    saveApiKey(key);
    setApiKey(key);
    setShowApiKeyModal(false);
  };

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is valid in supported browsers
      const handle = await window.showDirectoryPicker();
      if (handle) {
        setRootHandle(handle);
        setIsScanning(true);
        const records = await scanDirectory(handle);
        setFiles(records.map(r => ({ ...r, status: 'pending' })));
        setIsScanning(false);
      }
    } catch (err) {
      console.error("User cancelled or API not supported", err);
      setIsScanning(false);
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Only analyze files that haven't been analyzed or failed
      const pendingFiles = files.filter(f => !f.analysis);
      const filenames = pendingFiles.map(f => f.name);
      
      const results = await analyzeFiles(filenames, apiKey);
      
      // Merge results back
      setFiles(prev => prev.map(f => {
        const analysis = results.find(r => r.originalName === f.name);
        return analysis ? { ...f, analysis, status: 'ready' } : f;
      }));
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (!rootHandle) return;
    const confirmed = window.confirm("This will move files in your actual file system. Ensure you have a backup. Proceed?");
    if (!confirmed) return;

    // Verify ReadWrite permission
    const hasPerm = await verifyPermission(rootHandle, true);
    if (!hasPerm) {
      alert("Permission denied. Please grant write access.");
      return;
    }

    setIsMoving(true);
    
    const readyFiles = files.filter(f => f.status === 'ready' && f.analysis);
    
    for (const file of readyFiles) {
      if (!file.analysis) continue;
      
      try {
        setFiles(prev => prev.map(p => p.id === file.id ? { ...p, status: 'moving' } : p));
        
        await moveFile(file, file.analysis.suggestedPath, rootHandle);
        
        setFiles(prev => prev.map(p => p.id === file.id ? { ...p, status: 'done' } : p));
      } catch (e) {
        setFiles(prev => prev.map(p => p.id === file.id ? { ...p, status: 'error' } : p));
      }
    }
    
    setIsMoving(false);
    alert("Organization Complete!");
    
    // Rescan to show new state
    setIsScanning(true);
    const records = await scanDirectory(rootHandle);
    // Merge known analysis data if file still exists (by name)
    setFiles(records.map(r => {
        const old = files.find(oldF => oldF.name === r.name);
        return { 
            ...r, 
            status: 'pending', 
            analysis: old?.analysis // Keep analysis if it exists, though path changed so it's moot usually
        };
    }));
    setIsScanning(false);
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));

  // Group by suggested path for preview
  const groupedFiles = React.useMemo(() => {
    const groups: Record<string, OrganizedFile[]> = {};
    filteredFiles.forEach(f => {
       const path = f.analysis?.suggestedPath || 'Unsorted';
       if (!groups[path]) groups[path] = [];
       groups[path].push(f);
    });
    return groups;
  }, [filteredFiles]);

  return (
    <div className="h-screen flex flex-col">
      {showApiKeyModal && (
        <ApiKeyModal onSave={handleApiKeySave} />
      )}
      
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
                 <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white">SmartSort AI</h1>
                <p className="text-xs text-gray-400">Semantic File Organizer</p>
            </div>
        </div>
        
        <div className="flex items-center space-x-4">
             {rootHandle && (
                 <div className="flex items-center space-x-2 text-sm text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-700">
                     <FolderOpen className="w-4 h-4" />
                     <span className="truncate max-w-[150px]">{rootHandle.name}</span>
                 </div>
             )}
             
             {!rootHandle ? (
                 <button 
                    onClick={handleSelectFolder}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition font-medium"
                 >
                    <FolderOpen className="w-4 h-4" />
                    <span>Select Folder</span>
                 </button>
             ) : (
                <div className="flex space-x-2">
                     <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || isScanning || files.length === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
                            isAnalyzing ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                     >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        <span>{isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}</span>
                     </button>
                     
                     <button 
                        onClick={handleExecute}
                        disabled={isMoving || !files.some(f => f.status === 'ready')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
                            isMoving || !files.some(f => f.status === 'ready') ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                     >
                        {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        <span>{isMoving ? 'Moving...' : 'Execute Changes'}</span>
                     </button>
                </div>
             )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Stats) */}
        <aside className="w-80 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto hidden md:block">
            <StatsPanel files={files} />
            
            <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">System Logic</h3>
                <div className="space-y-3">
                    <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex items-center space-x-2 mb-1">
                            <BrainCircuit className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-medium">Semantic Analysis</span>
                        </div>
                        <p className="text-xs text-gray-500">Files are categorized based on semantic meaning of filenames using Gemini 2.5 Flash.</p>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex items-center space-x-2 mb-1">
                            <ShieldCheck className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium">Privacy Guard</span>
                        </div>
                        <p className="text-xs text-gray-500">Sensitive items (IDs, finance) are automatically routed to a "Secret" folder.</p>
                    </div>
                </div>
            </div>
        </aside>

        {/* Center (File Grid/List) */}
        <section className="flex-1 bg-gray-900 p-6 overflow-y-auto relative">
            {!rootHandle && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-50">
                    <FolderOpen className="w-24 h-24 text-gray-600 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-300">No Folder Selected</h2>
                    <p className="text-gray-500">Select a local directory to begin organizing</p>
                </div>
            )}

            {rootHandle && (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <span>Files</span>
                            <span className="ml-3 text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{filteredFiles.length} items</span>
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                                type="text" 
                                placeholder="Filter files..." 
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-sm rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 w-64"
                            />
                        </div>
                    </div>

                    {isScanning ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="flex flex-col items-center space-y-4">
                                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                <span className="text-gray-400">Scanning directory...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {(Object.entries(groupedFiles) as [string, OrganizedFile[]][]).sort().map(([folder, groupFiles]) => (
                                <div key={folder} className="space-y-3">
                                    <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-800 pb-2">
                                        <FolderOpen className="w-4 h-4 text-yellow-500" />
                                        <span className="font-mono text-sm text-yellow-500">{folder === 'Unsorted' ? './' : folder}</span>
                                        <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{groupFiles.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {groupFiles.map(file => (
                                            <div 
                                                key={file.id} 
                                                className={`group relative bg-gray-800 rounded-lg p-3 border hover:border-blue-500 transition-all ${
                                                    file.analysis?.isSensitive ? 'border-red-500/50 bg-red-900/10' : 'border-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center space-x-2 truncate">
                                                        <FileIcon type={file.type} name={file.name} isSensitive={file.analysis?.isSensitive} />
                                                        <span className="text-sm font-medium text-gray-200 truncate" title={file.name}>{file.name}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-xs text-gray-500 mb-2 truncate">
                                                    {file.path}
                                                </div>

                                                {file.analysis ? (
                                                    <div className="space-y-2 mt-2 pt-2 border-t border-gray-700">
                                                        <div className="flex items-center text-xs text-blue-400">
                                                            <ArrowRight className="w-3 h-3 mr-1" />
                                                            <span className="truncate">{file.analysis.suggestedPath}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {file.analysis.tags.slice(0, 2).map(tag => (
                                                                <span key={tag} className="flex items-center px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px]">
                                                                    <Tag className="w-2 h-2 mr-1" />
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-600 italic">
                                                        Waiting for analysis...
                                                    </div>
                                                )}

                                                {/* Status Indicator */}
                                                <div className="absolute top-2 right-2">
                                                    {file.status === 'moving' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                                                    {file.status === 'done' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                                                    {file.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;