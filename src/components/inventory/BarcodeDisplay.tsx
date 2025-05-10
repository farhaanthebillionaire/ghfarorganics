// @ts-nocheck
'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface BarcodeDisplayProps {
  value: string;
  interactive?: boolean;
}

export function BarcodeDisplay({ value, interactive = false }: BarcodeDisplayProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 16,
          margin: 10,
          width: 2,
          height: 100,
        });
      } catch (e) {
        console.error("Barcode generation error:", e);
        // Optionally display an error message in the UI if barcodeRef.current exists
        if (barcodeRef.current) {
          barcodeRef.current.innerHTML = `<text x="10" y="50" fill="red">Error generating barcode</text>`;
        }
      }
    }
  }, [value]);

  const handleDownload = () => {
    if (barcodeRef.current) {
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
      const canvas = document.createElement('canvas');
      
      // Calculate canvas size based on SVG viewbox or dimensions for better quality
      const svgWidth = barcodeRef.current.viewBox?.baseVal?.width || barcodeRef.current.width?.baseVal?.value || 300;
      const svgHeight = barcodeRef.current.viewBox?.baseVal?.height || barcodeRef.current.height?.baseVal?.value || 150;
      
      canvas.width = svgWidth * 2; // Increase resolution
      canvas.height = svgHeight * 2;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = 'white'; // Set background to white
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngFile = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = `${value}-barcode.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      }
    }
  };
  
  const handlePrint = () => {
     if (barcodeRef.current) {
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Barcode - ${value}</title>
              <style>
                @media print {
                  body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                  svg { max-width: 90%; max-height: 90%; }
                }
              </style>
            </head>
            <body>
              ${svgData}
              <script>
                window.onload = function() {
                  window.print();
                  window.onafterprint = function() { window.close(); };
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };


  if (!value) {
    return <p className="text-sm text-muted-foreground">Enter a Unique ID to see barcode preview.</p>;
  }
  
  return (
    <div className="flex flex-col items-center space-y-3 w-full">
      <svg ref={barcodeRef} className="max-w-full h-auto bg-white p-2 rounded shadow"></svg>
      {interactive && (
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-3 w-full max-w-xs sm:max-w-sm px-2">
          <Button variant="outline" size="sm" onClick={handleDownload} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Download PNG
          </Button>
           <Button variant="outline" size="sm" onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      )}
    </div>
  );
}
