'use client';

import { useState } from 'react';
import Papa from 'papaparse';

export function CsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<{ [key: string]: string }>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = () => {
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setHeaders(results.meta.fields || []);
          setData(results.data);
        },
      });
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
    <div>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleParse}>Parse</button>

      {headers.length > 0 && (
        <div>
          <h2>Map Columns</h2>
          {headers.map((header) => (
            <div key={header}>
              <span>{header}</span>
              <select
                onChange={(e) => handleMappingChange(header, e.target.value)}
              >
                <option value="">Select Field</option>
                {dbFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button onClick={handleImport}>Import</button>
        </div>
      )}
    </div>
  );
}
