import React, { useState } from 'react';
import { X, Key, ExternalLink, Sparkles, Shield, AlertCircle, Check } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  currentApiKey,
  onSaveApiKey,
}) => {
  const [keyInput, setKeyInput] = useState(currentApiKey);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-850 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Google Maps Platform Key Setup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live Google Maps satellite, street view, & Places
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Prototyping Demo Key Callout */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Free Maps Demo Key Quickstart (No billing card required)</span>
            </div>
            <p className="text-xs text-blue-800/90 dark:text-blue-300 leading-relaxed">
              For prototyping without Google Cloud billing setup, generate a free Maps Demo Key in seconds:
            </p>
            <ol className="list-decimal list-inside text-xs text-blue-800 dark:text-blue-300 space-y-1 pl-1">
              <li>
                Open the official{' '}
                <a
                  href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline text-blue-600 dark:text-blue-300 hover:text-blue-800 inline-flex items-center gap-0.5"
                >
                  Maps Demo Key Console <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>Sign in with your Google account and accept demo project terms</li>
              <li>Copy the demo key and paste it below</li>
            </ol>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Google Maps API Key / Demo Key
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full text-xs font-mono px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              You can also define <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in environment variables.
            </p>
          </div>

          {/* Compliance & Cost Notice */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Security & Production Notice</span>
            </div>
            <p>
              Usage of Google Maps Platform products and services may incur costs against your Google Cloud project billing account once in production. Remember to restrict production keys by HTTP referrer.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer"
            >
              {saved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
              <span>{saved ? 'Key Saved!' : 'Apply Key'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
