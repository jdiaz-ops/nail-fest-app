# Amazon SES setup

1. **Verify your sending domain** (SES console → Verified identities →
   Create identity → Domain). Add the SPF/DKIM/DMARC DNS records it gives
   you — required before requesting production access.
2. **Create two Configuration Sets** — this is what keeps a marketing
   complaint spike from hurting the reputation of the transactional QR
   email (see the pricing/deliverability discussion in the plan):
   - `nailfest-transactional`
   - `nailfest-marketing`
3. **SNS feedback loop**: for each Configuration Set, add an event
   destination that publishes bounces/complaints to an SNS topic. AWS
   checks for this before approving production access — without it, expect
   a denial.
4. **Request production access**: SES console → Account dashboard →
   "Request production access". Be specific in the form: who receives
   these emails (people who opted in via the Nail Fest registration form —
   not a purchased list), expected volume (~10k/event, 7 events/year, plus
   ad-hoc broadcasts to those who opted into marketing), and how
   unsubscribes are handled (List-Unsubscribe header + `/api/unsubscribe`,
   see `src/lib/unsubscribe.ts`). Approval is usually ~24h if the request
   is specific; vague answers get rejected.
5. Fill in `.env`:
   ```
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   SES_FROM_TRANSACTIONAL=tickets@yourdomain
   SES_FROM_MARKETING=hola@yourdomain
   SES_CONFIGURATION_SET_TRANSACTIONAL=nailfest-transactional
   SES_CONFIGURATION_SET_MARKETING=nailfest-marketing
   ```

**If production access gets denied**: the code sends through
`src/lib/email/provider.ts`'s interface, not the AWS SDK directly — swapping
in SendGrid/Mailgun/Postmark only touches `src/lib/email/ses.ts` and the env
vars, per the plan's fallback strategy. Nothing else in the app changes.

**Until production access is approved**, SES is in sandbox mode: you can
only send to individually-verified email addresses. Verify your own test
addresses (SES console → Verified identities → Create identity → Email
address) to test the registration flow end to end before approval comes
through.
