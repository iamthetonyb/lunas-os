'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TubsWindowsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: builders } = useSWR('/api/builders', fetcher);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file || !builderId) return;
    
    setIsProcessing(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            await fetch('/api/import/tubs-windows', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ builderId, rows: results.data }),
            });
            setIsProcessing(false);
            alert('Import completed successfully!');
          },
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          await fetch('/api/import/tubs-windows', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ builderId, rows: jsonData }),
          });
          setIsProcessing(false);
          alert('Import completed successfully!');
        };
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error('Error importing:', error);
      setIsProcessing(false);
      alert('Error during import');
    }
  };

  const handleGoogleSheetsImport = async () => {
    if (!googleSheetsUrl || !builderId) return;
    
    setIsProcessing(true);
    try {
      const match = googleSheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setIsProcessing(false);
        return;
      }
      
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      const response = await fetch(exportUrl, { mode: 'cors' });
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        complete: async (results) => {
          await fetch('/api/import/tubs-windows', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ builderId, rows: results.data }),
          });
          setIsProcessing(false);
          alert('Google Sheets import completed successfully!');
        },
      });
    } catch (error) {
      console.error('Error importing Google Sheets:', error);
      alert('Error importing from Google Sheets. Make sure the sheet is public.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Tubs & Windows Daily Sheet Importer
        </h2>
        
        {/* Builder Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Builder
          </label>
          <select 
            onChange={(e) => setBuilderId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">Choose a builder...</option>
            {builders?.map((builder: any) => (
              <option key={builder.id} value={builder.id}>
                {builder.name}
              </option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upload File (CSV, Excel)
          </label>
          <div className="flex gap-3">
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileChange}
              disabled={!builderId}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
              onClick={handleImport} 
              disabled={!file || !builderId || isProcessing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {isProcessing ? 'Importing...' : 'Import File'}
            </button>
          </div>
        </div>

        {/* Google Sheets Import */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Import from Google Sheets
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Paste Google Sheets URL here..."
              value={googleSheetsUrl}
              onChange={(e) => setGoogleSheetsUrl(e.target.value)}
              disabled={!builderId}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleGoogleSheetsImport}
              disabled={!googleSheetsUrl || !builderId || isProcessing}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              {isProcessing ? 'Importing...' : 'Import from Sheets'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Make sure your Google Sheet is public or shared with link access
          </p>
        </div>
      </div>
    </div>
  );
}
