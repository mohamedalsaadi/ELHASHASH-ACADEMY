# Processors and DPAs

**What a DPA is.** A Data Processing Agreement is the contract with a supplier that touches personal data.
It says the supplier processes the data only on Dhirwa’s instructions, keeps it secure, tells Dhirwa about a
breach, and deletes it when the service ends. Most suppliers offer a standard DPA in their dashboard. Accept
it, download the signed or accepted copy, and keep it with the company records.

**Rule.** No supplier below should process real student data until its DPA is accepted and filed. Test keys
and synthetic data are fine before that.

| Supplier | Role | Personal data it sees | Where it processes | DPA status | Action |
|---|---|---|---|---|---|
| Vercel | Hosting, functions, Blob storage | Everything that passes through the app; uploaded homework; invoice PDFs | Global edge; functions in `dxb1`; Blob `cdg1` | Standard DPA available in the dashboard | Accept and file |
| Neon | Postgres database | All application data | Frankfurt, `eu-central-1` | DPA available | Accept and file |
| Resend | Transactional email | Name, email, message contents, consent-link tokens | United States | DPA available | Accept and file |
| Ziina | AED card payments | Buyer name, amount, order reference; card data stays with Ziina | UAE | Merchant agreement plus DPA | File the signed terms |
| Paymob | EGP payments (coded, switched off) | Buyer name, phone, amount | Egypt | Merchant agreement plus DPA | File before `PAYMOB_ENABLED=1` |
| Stripe | Card payments (coded, test keys only) | Buyer email, amount | Ireland / United States | DPA available | File before any live key |
| VdoCipher | Paid video playback | Account and video identifiers, playback logs | India / global | DPA available | Accept and file |
| Daily | Live lecture rooms | Name, room token, join and leave times | United States | DPA available | Accept and file before live classes |
| Google Gemini | AI-assisted grading and bank-alert reading | The student answer sent for grading; never the whole account | United States | Google Cloud terms / DPA | Confirm the paid tier. On a free tier, submitted content may be used to improve the model, which is not acceptable for a minor’s work |
| Anthropic | Possible future assistant | Only what a prompt contains | United States | Commercial terms / DPA | File before use |
| WhatsApp / support inbox | Support conversations | Whatever the person writes | Owner-controlled | Not a processor if the owner answers personally | Keep support replies inside the ticket system where possible |

## What to keep

- A folder with each accepted DPA, the date, and the account it covers.
- The sub-processor list each supplier publishes. Check it once a year.
- A note of any supplier that refuses a DPA. Do not send it student data.

## Open questions for the owner

- Is the Gemini key on the paid tier? The answer decides whether submitted homework may be used for training.
- Does the Ziina merchant agreement include a data-processing annex, or only payment terms?
- Will live lectures use Daily, or another provider? The DPA follows the choice.
