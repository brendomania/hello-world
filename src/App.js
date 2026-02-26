import React, { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { UploadCloud, ArrowRight, FileText, Check, AlertCircle } from 'lucide-react';
import { loadFilesIntoFs, getBranches, generateDiff } from './git';
import {
  isLoadedAtom,
  branchesAtom,
  baseBranchAtom,
  compareBranchAtom,
  diffsAtom,
  loadingDiffsAtom
} from './store';
import './App.css';

export default function App() {
  const [isLoaded, setIsLoaded] = useAtom(isLoadedAtom);
  const [branches, setBranches] = useAtom(branchesAtom);
  const [baseBranch, setBaseBranch] = useAtom(baseBranchAtom);
  const [compareBranch, setCompareBranch] = useAtom(compareBranchAtom);
  const [diffs, setDiffs] = useAtom(diffsAtom);
  const [loadingDiffs, setLoadingDiffs] = useAtom(loadingDiffsAtom);

  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFolderUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if it contains a .git folder
    const hasGit = Array.from(files).some(f => f.webkitRelativePath.includes('/.git/'));
    if (!hasGit) {
      setError("The selected folder does not contain a .git directory. Please select a valid Git repository.");
      return;
    }

    setError(null);
    setIsLoaded(true);
    setLoadingDiffs(true);

    try {
      await loadFilesIntoFs(files);
      const gitBranches = await getBranches();
      setBranches(gitBranches);

      if (gitBranches.length > 0) {
        let defaultBase = gitBranches.includes('main') ? 'main' : gitBranches.includes('master') ? 'master' : gitBranches[0];
        setBaseBranch(defaultBase);
        setCompareBranch(gitBranches[0]);
      }
    } catch (e) {
      setError("Failed to parse Git repository.");
      console.error(e);
    } finally {
      setLoadingDiffs(false);
    }
  };

  const handleGenerateDiff = async () => {
    if (!baseBranch || !compareBranch) return;
    setLoadingDiffs(true);
    try {
      const results = await generateDiff(baseBranch, compareBranch);
      setDiffs(results);
    } catch (e) {
      setError("Failed to generate diff between branches.");
      console.error(e);
    } finally {
      setLoadingDiffs(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex-center flex-col w-full min-h-screen bg-slate-900 text-white p-6">
        <div className="max-w-xl w-full text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
            Visual Pull Request Viewer
          </h1>
          <p className="text-slate-400 text-lg">
            Review your local branch differences before creating a Pull Request. Completely private, runs in your browser.
          </p>

          <div
            className="mt-8 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/50 transition-colors 
                       rounded-2xl p-12 cursor-pointer flex-center flex-col gap-4 focus-within:ring-2 focus-within:ring-blue-500 outline-none"
            tabIndex="0"
            role="button"
            aria-label="Upload Project Directory"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="p-4 bg-blue-500/10 rounded-full">
              <UploadCloud className="w-12 h-12 text-blue-400" />
            </div>
            <div className="text-lg font-medium">Click to select a local repository folder</div>
            <div className="text-sm text-slate-500 mt-2">Must contain a .git directory</div>

            <input
              ref={fileInputRef}
              type="file"
              webkitdirectory="true"
              className="hidden"
              onChange={handleFolderUpload}
              aria-hidden="true"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 mt-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-left rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Visual PR Viewer
          </h1>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto">
            <select
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              aria-label="Base Branch"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <ArrowRight className="w-5 h-5 text-slate-500 flex-shrink-0" />

            <select
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
              value={compareBranch}
              onChange={(e) => setCompareBranch(e.target.value)}
              aria-label="Compare Branch"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <button
              onClick={handleGenerateDiff}
              disabled={loadingDiffs}
              className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-900 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loadingDiffs ? 'Loading...' : 'Generate Diff'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loadingDiffs ? (
          <div className="flex-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : diffs.length === 0 ? (
          <div className="flex-center flex-col py-20 text-slate-500">
            <Check className="w-16 h-16 mb-4 text-green-500/50" />
            <p className="text-xl text-slate-400">There are no changes between these branches.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mb-4 text-sm font-medium text-slate-400">
              Showing {diffs.length} changed file{diffs.length !== 1 && 's'}
            </div>

            {diffs.map((fileDiff, idx) => (
              <div key={idx} className="border border-slate-700 rounded-xl overflow-hidden shadow-lg bg-slate-850 bg-slate-900">
                {/* File Header */}
                <div className="bg-slate-800/50 px-4 py-3 flex items-center justify-between border-b border-slate-700">
                  <span className="font-mono text-sm text-slate-300 font-semibold">{fileDiff.filename}</span>
                  {fileDiff.status && (
                    <span className={`text-xs px-2 py-1 rounded-md uppercase font-bold tracking-wide
                      ${fileDiff.status === 'added' ? 'bg-green-500/20 text-green-400' :
                        fileDiff.status === 'deleted' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'}`}
                    >
                      {fileDiff.status}
                    </span>
                  )}
                </div>

                {/* Diff Viewer Body */}
                <div className="bg-[#0d1117] font-mono text-sm overflow-x-auto">
                  {fileDiff.hunks.map((hunk, hIdx) => (
                    <div key={hIdx}>
                      <div className="bg-blue-500/10 text-slate-500 px-4 py-1 border-y border-slate-800 text-xs">
                        {hunk.header}
                      </div>
                      <table className="w-full text-left border-collapse">
                        <tbody>
                          {hunk.lines.map((text, lineIdx) => {
                            const isAdded = text.startsWith('+');
                            const isRemoved = text.startsWith('-');
                            const isMeta = text.startsWith('\\');

                            return (
                              <tr
                                key={lineIdx}
                                className={`
                                  ${isAdded ? 'bg-[#238636]/20' : ''} 
                                  ${isRemoved ? 'bg-[#da3633]/20' : ''}
                                  hover:bg-slate-800/50 transition-colors
                                `}
                              >
                                <td className="w-10 text-right pr-4 py-0.5 text-slate-600 select-none border-r border-slate-800 text-xs">
                                  {/* Line numbers could be computed and placed here */}
                                </td>
                                <td className="w-10 text-right pr-4 py-0.5 text-slate-600 select-none border-r border-slate-800 text-xs text-[#238636]">
                                  {isAdded ? '+' : ''}
                                </td>
                                <td className="w-10 text-right pr-4 py-0.5 text-slate-600 select-none border-r border-slate-800 text-xs text-[#da3633]">
                                  {isRemoved ? '-' : ''}
                                </td>
                                <td className={`pl-4 py-0.5 whitespace-pre font-mono text-slate-300
                                  ${isAdded ? 'text-[#2ea043]' : ''}
                                  ${isRemoved ? 'text-[#f85149]' : ''}
                                  ${isMeta ? 'text-slate-500 italic' : ''}
                                `}>
                                  {text}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}