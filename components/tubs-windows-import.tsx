'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function TubsWindowsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const { data: builders } = useSWR('/api/builders', fetcher);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (file && builderId) {
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
        },
      });
    }
  };

  return (
    <div>
      <h2>Tubs & Windows Daily Sheet Importer</h2>
      <select onChange={(e) => setBuilderId(e.target.value)}>
        <option value="">Select Builder</option>
        {builders?.map((builder: any) => (
          <option key={builder.id} value={builder.id}>
            {builder.name}
          </option>
        ))}
      </select>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleImport} disabled={!file || !builderId}>
        Import
      </button>
    </div>
  );
}
