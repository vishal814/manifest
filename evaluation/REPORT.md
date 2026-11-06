# Labelled extraction evaluation

Evaluated: 2026-11-06T05:39:37.735Z

Model: gemini-3.5-flash-lite; location: asia-south1.

5/5 documents extracted successfully.

Expected present values: 70/70 correct. Expected absent values: 15/15 correctly left empty.

Small synthetic smoke evaluation, not the client target of 95% accuracy on 200 historical shipments. Reviewer agreement is a separate metric. Failed documents are listed and are not counted as successful field evaluations.

| Field | Correct | Compared |
| --- | ---: | ---: |
| supplier | 5 | 5 |
| buyer | 5 | 5 |
| invoiceNumber | 5 | 5 |
| invoiceDate | 5 | 5 |
| currency | 5 | 5 |
| incoterm | 5 | 5 |
| invoiceTotal | 5 | 5 |
| packageCount | 5 | 5 |
| grossWeightKg | 5 | 5 |
| netWeightKg | 5 | 5 |
| containerNumbers | 5 | 5 |
| description | 6 | 6 |
| hsn | 6 | 6 |
| quantity | 6 | 6 |
| unitPrice | 6 | 6 |
| lineTotal | 6 | 6 |

## Observed differences

No differences in this run.
