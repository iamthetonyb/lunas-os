'use client';

import { useState } from 'react';

export function EmailParser() {
  const [emailContent, setEmailContent] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);

  const handleParse = () => {
    const lotRegex = /Lot:\s*(\d+)/;
    const communityRegex = /Community:\s*([^\n]+)/;
    const serviceRegex = /Service:\s*([^\n]+)/;

    const lotMatch = emailContent.match(lotRegex);
    const communityMatch = emailContent.match(communityRegex);
    const serviceMatch = emailContent.match(serviceRegex);

    setParsedData({
      lot: lotMatch ? lotMatch[1] : null,
      community: communityMatch ? communityMatch[1] : null,
      service: serviceMatch ? serviceMatch[1] : null,
    });
  };

  return (
    <div>
      <h2>Email Parser</h2>
      <textarea
        rows={10}
        cols={50}
        value={emailContent}
        onChange={(e) => setEmailContent(e.target.value)}
      />
      <button onClick={handleParse}>Parse Email</button>

      {parsedData && (
        <div>
          <h3>Parsed Data</h3>
          <pre>{JSON.stringify(parsedData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
