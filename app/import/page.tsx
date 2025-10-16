'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import { useState, useRef } from 'react';

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [activeSection, setActiveSection] = useState<'file' | 'sheets'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    try {
      // TODO: Replace with actual API endpoint
      setTimeout(() => {
        alert(`File "${selectedFile.name}" imported successfully!`);
        setSelectedFile(null);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
    } catch {
      alert('Import failed. Please try again.');
      setUploading(false);
    }
  };

  const handleGoogleSheetsImport = async () => {
    if (!googleSheetsUrl.trim()) {
      alert('Please enter a Google Sheets URL first.');
      return;
    }
    
    setUploading(true);
    try {
      // TODO: Connect to actual API
      setTimeout(() => {
        alert('Google Sheets import functionality will be connected to API');
        setGoogleSheetsUrl('');
        setUploading(false);
      }, 1500);
    } catch {
      alert('Import failed. Please try again.');
      setUploading(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Data Import" 
        description="Import job data from files, Google Sheets, or various formats"
        action={
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            📥 Multiple Format Support
          </div>
        }
      />
      <main className="px-6 py-6">
        {/* Section Switcher */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 p-2 flex gap-2">
          <button
            onClick={() => setActiveSection('file')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === 'file'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg mr-2">📁</span>
            File Upload
          </button>
          <button
            onClick={() => setActiveSection('sheets')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === 'sheets'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg mr-2">📊</span>
            Google Sheets
          </button>
        </div>

        {/* File Upload Section */}
        {activeSection === 'file' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-2xl">📁</span>
                File Import
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload CSV, Excel (.xlsx, .xls, .ods), or PDF files containing job data.
              </p>
            </div>

            {/* File Input (Hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.ods,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File Selection Area */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 mb-6 text-center bg-gray-50 dark:bg-slate-900/50">
              {!selectedFile ? (
                <div>
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No file selected. Click the button below to choose a file.
                  </p>
                  <button
                    onClick={handlePickFile}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Choose File to Import
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <span>📊</span>
                      CSV
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📗</span>
                      Excel
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📄</span>
                      PDF
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Size: {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    onClick={handleClearFile}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Choose a different file
                  </button>
                </div>
              )}
            </div>

            {/* Import Button */}
            {selectedFile && (
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClearFile}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import File
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Google Sheets Section */}
        {activeSection === 'sheets' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Google Sheets Import
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Import data directly from a shared Google Sheets URL.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Google Sheets URL
                </label>
                <input
                  type="text"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Make sure the Google Sheet is shared with &quot;Anyone with the link can view&quot; permissions
                </p>
              </div>

              {/* Instructions Card */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-300 text-sm mb-2 flex items-center gap-2">
                  <span>📋</span>
                  How to Share Your Google Sheet
                </h4>
                <ol className="text-xs text-green-800 dark:text-green-200 space-y-1 ml-4 list-decimal">
                  <li>Open your Google Sheet</li>
                  <li>Click the &quot;Share&quot; button in the top-right corner</li>
                  <li>Change &quot;Restricted&quot; to &quot;Anyone with the link&quot;</li>
                  <li>Set permission to &quot;Viewer&quot;</li>
                  <li>Copy the link and paste it above</li>
                </ol>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setGoogleSheetsUrl('')}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleGoogleSheetsImport}
                  disabled={!googleSheetsUrl.trim() || uploading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import from Google Sheets
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Tips */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
            <span>💡</span>
            Import Tips
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-6 list-disc">
            <li><strong>CSV files</strong>: Ensure headers match expected format (builder, community, lot, address, etc.)</li>
            <li><strong>Excel files</strong>: Supports .xlsx, .xls, and .ods formats. Data should be in first sheet.</li>
            <li><strong>PDF files</strong>: Text-based PDFs work best. Scanned images may require OCR processing.</li>
            <li><strong>Google Sheets</strong>: Sheet must be publicly accessible via link sharing. First row should contain headers.</li>
            <li>Large files may take a few moments to process - please be patient.</li>
            <li>Review imported data before finalizing to ensure accuracy.</li>
          </ul>
        </div>
      </main>
    </AppLayout>
  );
}
