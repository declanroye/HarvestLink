# Controlled template review — pending human sign-off

Version: v1. Status: code-reviewed for field preservation; Portuguese/English bilingual human review **PENDING**.

| Portuguese | English meaning / buyer rendering |
|---|---|
| Qual é seu nome? | What is your name? |
| Quantos quilos de tomate? | How many kilograms of tomatoes? |
| Qual é a classificação? Digite classe A ou classe B. | What is the grade? Enter grade A or B. |
| Qual é a data da colheita? Use AAAA-MM-DD. | What is the harvest date? Use YYYY-MM-DD. |
| Qual preço local por kg você consegue? | What local price per kg can you obtain? |
| Confirme ou corrija antes de salvar. | Confirm or correct before saving. |
| Nenhuma remessa foi autorizada. | No shipment has been authorized. |

Buyer template: `[farmer]: [quantityKg] kg tomatoes, grade [grade], harvest [harvestDate], Bonfim, Roraima. Farmer-confirmed availability only; not a shipment commitment.`

Review exact UI and SMS text in `public/core.js` and `public/index.html`. Check names, units, decimal commas, dates, consent wording and local use of grades. Do not claim buyer acceptance or legal compliance.

Reviewer name:
Languages / qualifications:
Date:
Accepted wording / corrections:
Sign-off:
