'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function CsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            setHeaders(results.meta.fields || []);
            setData(results.data);
            setIsProcessing(false);
          },
          error: () => {
            setIsProcessing(false);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1).map((row: any) => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = row[index];
              });
              return obj;
            });
            setHeaders(headers);
            setData(rows);
          }
          setIsProcessing(false);
        };
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      setIsProcessing(false);
    }
  };

  const handleGoogleSheetsImport = async () => {
    if (!googleSheetsUrl) return;
    
    setIsProcessing(true);
    try {
      // Extract sheet ID from URL
      const match = googleSheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setIsProcessing(false);
        return;
      }
      
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      // Fetch CSV from Google Sheets
      const response = await fetch(exportUrl, { mode: 'cors' });
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          setHeaders(results.meta.fields || []);
          setData(results.data);
          setIsProcessing(false);
        },
        error: () => {
          alert('Error importing from Google Sheets. Make sure the sheet is public.');
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('Error importing Google Sheets:', error);
      alert('Error importing from Google Sheets. Make sure the sheet is public and shared.');
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (csvHeader: string, dbField: string) => {
    setMapping((prev) => ({ ...prev, [csvHeader]: dbField }));
  };

  const handleImport = async () => {
    const mappedData = data.map(row => {
      const newRow: { [key: string]: any } = {};
      for (const csvHeader in mapping) {
        const dbField = mapping[csvHeader];
        newRow[dbField] = row[csvHeader];
      }
      return newRow;
    });

    // This is a simplified example. In a real application,
    // you would want to do more validation and transformation here.
    for (const row of mappedData) {
      await fetch('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(row),
      });
    }
  };

  const dbFields = [
    'builderId',
    'communityId',
    'lot',
    'address',
    'modelPlanId',
    'serviceIds',
    'dueDate',
    'walkTime',
    'notes',
    'requestedBy',
    'contact',
    'poNumber',
  ];

  return (
    <div className="space-y-6">
      {/* Import Method Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Import Data
        </h3>
        
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
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            />
            <button 
              onClick={handleParse}
              disabled={!file || isProcessing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Parse File'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Supports CSV, XLSX, and XLS formats
          </p>
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
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleGoogleSheetsImport}
              disabled={!googleSheetsUrl || isProcessing}
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

      {headers.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Map Columns to Database Fields
          </h3>
          <div className="space-y-3">
            {headers.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium">
                    {header}
                  </span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex-1">
                  <select
                    onChange={(e) => handleMappingChange(header, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select Database Field</option>
                    {dbFields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {data.length} rows ready to import
            </p>
            <button 
              onClick={handleImport}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import {data.length} Rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
