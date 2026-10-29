# Plafond journalier de l’assistant IA — 29 septembre 2026

## Constat

Chaque question posée à l’assistant appelle le modèle d’IA, ce qui est facturé. La seule protection était de 12 questions par minute et par compte : un compte pouvait déclencher plus de 17 000 appels par jour, et aucun plafond ne bornait la plateforme entière.

## Correction

`netlify/functions/assistant-chat.ts` vérifie deux budgets sur 24 heures avant chaque appel au modèle, avec la table `rate_limits` existante (aucune migration) :

| Budget | Variable | Valeur par défaut |
| --- | --- | --- |
| Par compte | `NXT5_ASSISTANT_DAILY_USER_LIMIT` | 50 appels |
| Toute la plateforme | `NXT5_ASSISTANT_DAILY_TOTAL_LIMIT` | 1 000 appels |

- Le budget du compte est vérifié en premier : un compte qui a dépassé le sien ne consomme pas le budget commun.
- Au-delà d’un budget, ou si le budget ne peut pas être vérifié, l’assistant répond avec l’aide locale (`fallback: true`) au lieu d’une erreur. Aucun appel facturé n’est fait.
- La limite de 12 questions par minute reste en place.
- Une valeur de variable absente, nulle ou invalide revient à la valeur par défaut.

## Vérification

`src/__tests__/assistant-ai-budget.test.ts` couvre l’appel dans les budgets, le dépassement du compte, le dépassement global, l’indisponibilité du contrôle et la lecture des variables. Ces tests échouent sans la correction.
