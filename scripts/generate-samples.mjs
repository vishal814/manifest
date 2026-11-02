import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';

const target = new URL('../samples/', import.meta.url);
await mkdir(target, { recursive: true });
const samples = [
  { filename: 'SHP-24811-invoice.pdf', title: 'COMMERCIAL INVOICE', number: 'INV-24811', weight: '3,120 kg', rows: [['Supplier', 'Company B (fictional), China'],['Buyer', 'Sample Importer A (fictional), India'],['Invoice number', 'INV-24811'],['Invoice date','2026-10-25'],['Currency / Incoterm','USD / FOB'],['Description','LED panel light 40W'],['HSN as printed','94054200'],['Quantity','2,400'],['Unit price','USD 6.80'],['Line total / Invoice total','USD 16,320.00'],['Packages','120 cartons'],['Gross weight','3,120 kg'],['Net weight','2,880 kg'],['Container','TEST1234567']] },
  { filename: 'SHP-24811-packing-list.pdf', title: 'PACKING LIST', number: 'PKL-24811', weight: '3,165 kg', rows: [['Supplier','Company B (fictional), China'],['Buyer','Sample Importer A (fictional), India'],['Packing list number','PKL-24811'],['Date','2026-10-25'],['Description','LED panel light 40W'],['Quantity','2,400'],['Packages','120 cartons'],['Gross weight','3,165 kg'],['Net weight','2,880 kg'],['Container','TEST1234567']] },
  { filename: 'SHP-24811-bill-of-lading.pdf', title: 'BILL OF LADING', number: 'BL-24811', weight: '3,120 kg', rows: [['Shipper','Company B (fictional), China'],['Consignee','Sample Importer A (fictional), India'],['Bill of lading number','BL-24811'],['Date','2026-10-26'],['Port of loading','Shanghai'],['Port of discharge','Nhava Sheva'],['Description','LED panel light 40W'],['Quantity','2,400'],['Packages','120 cartons'],['Gross weight','3,120 kg'],['Container','TEST1234567']] },
];
for (const sample of samples) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595,842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x:0,y:735,width:595,height:107,color:rgb(.09,.31,.23) });
  page.drawText('MANIFEST / FICTIONAL EVALUATION DOCUMENT', { x:42,y:803,size:9,font,color:rgb(.75,.87,.78) });
  page.drawText(sample.title,{x:42,y:762,size:23,font:bold,color:rgb(1,1,1)});
  page.drawText('Shipment SHP-24811',{x:42,y:701,size:13,font:bold,color:rgb(.15,.25,.19)});
  let y=660;
  for (const [key,value] of sample.rows) {
    page.drawText(key,{x:42,y,size:10,font,color:rgb(.4,.45,.4)});
    page.drawText(value,{x:230,y,size:10,font:bold,color:rgb(.15,.25,.19)});
    page.drawLine({start:{x:42,y:y-13},end:{x:552,y:y-13},thickness:.5,color:rgb(.88,.91,.87)});
    y-=33;
  }
  page.drawText('Synthetic data. Not a real commercial or shipping document.',{x:42,y:70,size:9,font,color:rgb(.5,.55,.48)});
  await writeFile(new URL(sample.filename,target),await pdf.save());
}
await writeFile(new URL('expected.json',target),JSON.stringify({
  shipment:'SHP-24811',
  invoice:{supplier:'Company B (fictional), China',invoiceNumber:'INV-24811',invoiceDate:'2026-10-25',currency:'USD',incoterm:'FOB',invoiceTotal:'16320.00',packageCount:'120',grossWeightKg:'3120',netWeightKg:'2880',quantity:'2400',unitPrice:'6.80',hsn:'94054200',containerNumbers:'TEST1234567'},
  packingList:{grossWeightKg:'3165',netWeightKg:'2880',packageCount:'120'},
  billOfLading:{grossWeightKg:'3120',packageCount:'120'},
  expectedFutureCheck:{rule:'gross_weight_match',status:'failed',differenceKg:'45'},
  note:'Labelled expected values for evaluation, not an AI response. The cross-check engine is a later milestone.'
},null,2)+'\n');
console.log('Created three fictional PDFs and expected.json in samples/.');
