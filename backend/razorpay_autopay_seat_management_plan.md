# Razorpay AutoPay (Subscriptions) with Dynamic Seat Upgrade & Downgrade Architecture

## Feasibility & Implementation Overview

**Feasibility: Fully Possible.**
Razorpay provides a native **Subscriptions API (Recurring Payments / AutoPay)** supporting UPI AutoPay, eNACH Netbanking Mandates, and Card Recurring Payments. 

By integrating Razorpay Subscriptions API with dynamic `quantity` updates and prorated top-up orders, we can seamlessly support:
1. **Initial Subscription with AutoPay setup** (Monthly or Annual prepaid seat plan).
2. **Mid-cycle Seat Increase (Upgrade)**: Calculate & charge prorated payment immediately for the new seats for the remaining days of the current cycle, while updating the Razorpay AutoPay subscription quantity so the next cycle automatically auto-debits for the total updated seats.
3. **Mid-cycle Seat Decrease (Downgrade)**: Perform team density safety checks, keep current paid seats active until cycle end, and update the Razorpay AutoPay subscription quantity to bill for reduced seats starting from the next cycle.
4. **Annual Plan Updates**: Apply identical proration & auto-pay renewal updating logic scaled to the 365-day annual cycle.

---

## Technical Architecture & Razorpay Workflow

```
                             ┌───────────────────────────────────────────────┐
                             │       User Selects Seat Count & Cycle         │
                             └───────────────────────┬───────────────────────┘
                                                     │
                                           Is AutoPay Active?
                                        ╱                         ╲
                                   No  ╱                           ╲  Yes
                                      ╱                             ╲
                         ┌─────────────────────────┐   ┌───────────────────────────────┐
                         │   Initial Subscription  │   │     Seat Count Change         │
                         │    Create Razorpay      │   └───────────────┬───────────────┘
                         │   Plan & Subscription   │                   │
                         └────────────┬────────────┘     New Seats > Current Seats?
                                      │                        ╱               ╲
                                      ▼                   Yes ╱                 ╲ No
                         ┌─────────────────────────┐         ╱                   ╲
                         │ Razorpay Checkout Modal │        ▼                     ▼
                         │   (Auth + First Pay)    │ ┌──────────────┐     ┌──────────────┐
                         └────────────┬────────────┘ │ SEAT UPGRADE │     │SEAT DOWNGRADE│
                                      │              └──────┬───────┘     └──────┬───────┘
                                      ▼                     │                    │
                         ┌─────────────────────────┐        ▼                    ▼
                         │ Webhook: charged / auth │ Calculate Prorated    Validate Member
                         │ DB: auto_pay_enabled=1  │ Charge for New Seats  Density in Projects
                         └─────────────────────────┘ for Remaining Days    (maxProjectMembers)
                                                            │                    │
                                                            ▼                    ▼
                                                     Pay Prorated Order   Update Razorpay Sub
                                                     + Update Razorpay    Quantity for Next
                                                     Sub Quantity         Cycle End
```

---

## Detailed Scenarios & Business Logic

### Scenario 1: Initial Purchase (e.g., 10 Seats, Monthly or Annual)
1. **Backend Action**:
   - Create or fetch Razorpay Plan (`monthly_seat_plan` @ ₹159 or `annual_seat_plan` @ ₹1,188).
   - Create a Razorpay Subscription: `razorpay.subscriptions.create({ plan_id, total_count: 120, quantity: 10 })`.
2. **Frontend Action**:
   - Open Razorpay Checkout modal passing `subscription_id` instead of a one-time `order_id`.
   - User completes payment and authorizes recurring mandate (UPI AutoPay / Card / eNACH).
3. **Webhook / Verification**:
   - Webhook `subscription.authenticated` and `subscription.charged` verifies payment.
   - DB updates `organizations`: `razorpay_subscription_id`, `auto_pay_enabled = true`, `seats_purchased = 10`, `plan_start_date`, `plan_end_date`.

---

### Scenario 2: Mid-Cycle Seat Increase / Upgrade (e.g., Day 15, adding 10 seats -> Total 20 seats)
*Example: Monthly plan (₹159/seat/mo). User bought 10 seats on Day 1. On Day 15 (15 days remaining), user upgrades to 20 seats (+10 seats).*

1. **Prorated Instant Charge Calculation**:
   - `remainingDays = ceil((plan_end_date - now) / (1000 * 60 * 60 * 24))` = 15 days.
   - `dailyRatePerSeat = plan_cycle === "annual" ? (99 * 12) / 365 : 159 / 30` (₹5.30/day/seat for monthly).
   - `proratedAmount = addedSeats * dailyRatePerSeat * remainingDays` = `10 * 5.30 * 15` = **₹795**.
2. **Execution Steps**:
   - Step A: Backend creates a standard one-time Razorpay Order for **₹795**.
   - Step B: User pays ₹795 via Razorpay Checkout.
   - Step C: Upon verification, backend updates Razorpay Subscription:
     `razorpay.subscriptions.update(razorpay_subscription_id, { quantity: 20, schedule_change_at: 'cycle_end' })`
   - Step D: DB updates `seats_purchased = 20` **immediately**. Admin can use 20 seats right away.
   - Step E: On the next renewal date, Razorpay AutoPay automatically charges for 20 seats (₹3,180).

---

### Scenario 3: Mid-Cycle Seat Decrease / Downgrade (e.g., Day 15, 20 seats -> 5 seats)
*Example: User currently has 20 seats paid until end of month. Decreases to 5 seats.*

1. **Safeguard Validation Check (Project Member Density)**:
   - System queries max active team members in any single project:
     `maxMembersInAnyProject = max(count(project_members) per project)`.
   - If `maxMembersInAnyProject > 5`, **BLOCK** the request and return error:
     *"Cannot decrease to 5 seats because Project X currently has 7 active members. Please remove members first."*
2. **Execution Steps (if approved)**:
   - Prepaid model: No immediate charge and no instant refund for current cycle.
   - Backend calls Razorpay API:
     `razorpay.subscriptions.update(razorpay_subscription_id, { quantity: 5, schedule_change_at: 'cycle_end' })`
   - Store `pending_seats_change = 5` or update `quantity` for next cycle in DB.
   - Customer continues enjoying 20 seats until current cycle ends.
   - On the next cycle renewal date, Razorpay AutoPay automatically charges for 5 seats (₹795), and DB updates `seats_purchased = 5`.

---

### Scenario 4: Annual Plan Dynamic Seat Adjustments
- **Adding 10 seats mid-year (e.g., 180 days remaining)**:
  - Prorated charge: `10 seats * (1,188 / 365) * 180 days` = **₹5,858**.
  - Immediate top-up payment charged via one-time order.
  - Razorpay Subscription `quantity` updated to 20 for next annual auto-renewal cycle.
- **Reducing seats mid-year**:
  - Razorpay Subscription `quantity` updated to reduced count for next annual auto-renewal cycle.

---

## Technical File Locations to Modify (Future Execution)

1. **`backend/models/Organization.ts`**:
   - Add fields: `razorpay_subscription_id`, `razorpay_plan_id`, `auto_pay_enabled`, `pending_seats_purchased`.

2. **`backend/models/Transaction.ts`**:
   - Add fields: `transaction_type`, `razorpay_subscription_id`.

3. **`backend/controllers/subscriptionController.ts`**:
   - Implement Razorpay Subscriptions creation & prorated seat upgrade order handling.
   - Add seat downgrade project density validation (`validateSeatReduction`).
   - Add Razorpay Subscription update handler (`razorpay.subscriptions.update`).

4. **`backend/controllers/webhookController.ts`** *(New)*:
   - Listen for Razorpay webhooks: `subscription.charged`, `subscription.authenticated`, `subscription.halted`, `subscription.cancelled`.

5. **`frontend/src/pages/Role/Billing/Billing.tsx`**:
   - Integrate Razorpay Subscriptions Checkout.
   - Show prorated breakdown & AutoPay renewal indicator.
