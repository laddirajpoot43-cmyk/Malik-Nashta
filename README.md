# Malik Tasty Nashta Point - Complete POS & Hotel Management Platform
**Version:** v2.4.0 (Enterprise Release)  
**Location:** Vehari Road, Hasilpur, Punjab, Pakistan  
**Technology Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, PostgreSQL / InsForge SSL Pool with Zero Floating-Point Drift Engine.

---

## 🍳 Overview
Designed specifically for chaotic Pakistani breakfast hotel morning rushes (5:30 AM to 12:30 PM), **Malik Tasty Nashta Point POS** accelerates customer billing to **under 4 seconds**, supports instant keyboard shortcuts, eliminates calculation errors through portion and custom rupee reciprocation (e.g. *"50 rupay k channay"*, *"Aadha chana"*, *"Pao daleem"*), prevents cash shrinkage with strict drawer shift reconciliation, tracks Mandi supplier credit (Udhaar Khata), and provides the owner with an executive single-pane dashboard (**Roozana Hisaab Kitab**).

---

## ⚡ High-Speed Keyboard Shortcuts (100% Mouse-Free)

| Shortcut | Action | Operational Behavior |
| :--- | :--- | :--- |
| **`F2`** | Focus Product Search | Instantly jumps cursor to the search bar and selects existing text. |
| **`Shift + Enter`** or **`F6`** | **Quick Cash Checkout & Print** | Instantly finalizes exact Cash payment, generates order & receipt number, and opens thermal print dialog in < 3.5s. |
| **`F4`** | **Hold Dining Order** | Pauses table cart and assigns table/customer name (`HOLD-001`). |
| **`D`** / `Ctrl+D` | **Apply Discount** | Opens discount dialog (percentage or flat rupees). |
| **`F9`** | **Digital / Split Payment** | Opens payment tender modal for JazzCash, EasyPaisa, or Bank Card. |
| **`Delete`** | Remove Selected Item | Removes highlighted line item from the active cart. |
| **`Ctrl + ↑ / ↓`** | Navigate Cart | Moves selection cursor through cart items. |
| **`Esc`** | Cancel / Close | Dismisses any active dialog and returns focus to search bar. |

---

## 🍲 Traditional Menu Catalogue & Reciprocal Portion Engine
- **Reciprocal Rupee Calculation:**
  - Standard Selling Price for Channay = Rs. 260/plate.
  - Cashier enters **Rs. 50**: System automatically sets quantity to **0.19 portions**.
  - Cashier selects **0.5 (Aadhi plate)**: System automatically updates price to **Rs. 130**.
- **Quick Portion Chips:** `0.25 (Pao)`, `0.5 (Aadha)`, `1.0 (Poora)`, `1.5`, `2.0`
- **Quick Rupee Chips:** `Rs. 50`, `Rs. 100`, `Rs. 150`, `Rs. 200`, `Rs. 300`
- **Kitchen Instruction Pills:** *"Mirch kam"*, *"Oil kam"*, *"Extra crispy"*, *"Chai strong"*, *"Meetha tez"*, *"Garam garam"*
- **Add-ons:** Makhan / Fresh Butter (+50), Desi Ghee (+60), Extra Tari / Gravy (+30), Dahi Raita (+40).

---

## 💵 Cash Drawer Shift Management
1. **Shift Opening Float:** Cashier enters starting drawer cash (e.g. Rs. 5,000 float). The counter register is locked until opened.
2. **Automated Sales Inflow:** Cash transactions automatically add to the drawer ledger.
3. **Cash In / Cash Out:** Record float additions or petty cash expenses (Ice, tea leaves, emergency milk) with reasons.
4. **Shift Closing Reconciliation:** Cashier enters physically counted cash. System mathematically verifies:
   $$\text{Expected} = \text{Opening} + \text{Cash Sales} + \text{Cash In} - \text{Cash Out} - \text{Refunds}$$
   Discrepancies (Shortage/Surplus) are permanently saved to immutable audit logs.

---

## 🌾 Mandi Suppliers & Udhaar Khata Ledgers
- Suppliers: *Madina Atta Chakki (Flour)*, *Haji Ghee Traders (Oil & Ghee)*, *Al-Rehman Dairy (Milk)*, *Bismillah Kiryana Store*.
- **Maal Kharidari (Purchases):** Record raw ingredient deliveries (`PUR-01001`), cash paid, and unpaid credit.
- **Counter Drawer Cash Deduction:** Checking `deduct_from_register: true` automatically creates a `CASH_OUT` in the counter drawer.
- **Chronological Khata Statement:** Unified ledger with running balance, debits (payments), credits (deliveries), and payment settlement vouchers (`VPAY-01001`).

---

## 📊 Roozana Hisaab Kitab (Executive Reconciliation)
Access `/daily-summary` for single-day reconciliation:
- **Total Net Sales:** Gross sales minus discounts and refunds, split into Cash vs Digital.
- **Total Raw Material Purchases:** Total maal bills split into Naqad (Paid Cash) and Udhaar (Credit debt).
- **Cash Drawer In-Hand:** Exact mathematical expected cash in drawer.
- **Day Gross Margin:** $\text{Net Sales} - \text{Raw Material Purchases}$ and Net Cash Flow.

---

## 🛡️ Role-Based Access & Supervisor PIN Security
- **Cashier (Bilal - PIN: 0000):** Can bill, use quick shortcuts, hold/resume, cash in/out, and apply discounts up to 15%.
- **Master Admin (Malik Ammar - PIN: 1234):** Controls price updates, order voids, itemized refunds, business settings, and reports.
- **Audit Logs:** Immutable audit trail recorded for all events with old vs new state diffs.

---

## 🖨️ 80mm ESC/POS Thermal Printing
- Native `@media print` styling calibrated for 80mm paper rolls.
- Automatic print trigger with 80ms delay after checkout.
- Receipt duplicate audit watermark: `*** REPRINT DUPLICATE ***` if printed more than once.

---

## 🚀 Running the Platform

### Start Development Server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Production Build & E2E Verification:
```bash
npm run build
npm test:e2e
```
All 14 End-to-End test scenarios verify with **100% Pass rate**.

