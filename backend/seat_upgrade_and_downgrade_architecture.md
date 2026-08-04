# Seat Upgrade and Downgrade Architecture

This document details the exact technical flow, payment calculation formulas, and validation rules for handling **Seat Modifications (Increasing or Decreasing Seats)** on active subscriptions in the Apexis platform.

---

## Architecture Diagram

```
                        ┌───────────────────────────────┐
                        │   User Modifies Seat Count    │
                        └───────────────┬───────────────┘
                                        │
                         Is newSeats > currentSeats?
                                  ╱           ╲
                            Yes  ╱             ╲  No
                                ╱               ╲
                               ▼                 ▼
                 ┌───────────────────┐     ┌────────────────────────────────┐
                 │  SEAT INCREASE    │     │        SEAT DECREASE           │
                 │  (Seat Upgrade)   │     │       (Seat Downgrade)         │
                 └─────────┬─────────┘     └───────────────┬────────────────┘
                           │                               │
                           ▼                               ▼
                 Calculate Charge:              Check Max Members in Projects:
                 - Prorated Top-Up OR           If (maxProjectMembers > newSeats)
                 - Full Cycle Extension         ==> BLOCK & Prompt to remove members
                           │                    If (maxProjectMembers <= newSeats)
                           ▼                    ==> ALLOW & Update seat count
                 Process Razorpay               
                 Payment & Update Seats
```

---

## 1. Increasing Seats (Seat Upgrade / Adding Seats)

### Scenario:
An Organization currently has **5 Seats** purchased (ends in 15 days). The Admin wants to increase to **10 Seats** (+5 new seats).

### Option 1: Full-Period Reset & Credit (Recommended & Standard)
1. **Calculation**:
   - The user selects the new seat count (`10 seats`).
   - The system calculates full cycle amount for new seats:
     - **Monthly**: `10 seats * ₹159` = **₹1,590**
     - **Annual**: `10 seats * ₹99 * 12` = **₹11,880**
   - *(Optional Proration Discount)*: Calculate unused value of current 5 seats for remaining 15 days = `5 * (159/30) * 15` = ₹397 discount applied to new total.
2. **Execution & Activation**:
   - User pays the checkout amount via Razorpay.
   - Upon successful payment:
     - `organizations.seats_purchased` is updated to **`10`**.
     - `organizations.plan_end_date` is extended for a full new cycle (30 days / 365 days from today).
     - Admin can **immediately** add up to 10 members in any project!

---

## 2. Decreasing Seats (Seat Downgrade / Removing Seats)

### Scenario:
An Organization currently has **10 Seats** purchased. The Admin wants to decrease to **5 Seats**.

### Safeguard & Validation Rule:
Before allowing a reduction in seat count, the backend executes a **Project Member Density Check**:

```typescript
// Find the maximum number of active team members in ANY single project
const maxMembersInAnyProject = await getMaxProjectMembers(organizationId);

if (maxMembersInAnyProject > requestedNewSeats) {
  return res.status(400).json({
    error: "Cannot Decrease Seats",
    message: `Cannot decrease to ${requestedNewSeats} seats because one of your projects currently has ${maxMembersInAnyProject} active team members. Please remove team members from that project first.`,
    maxMembersInAnyProject
  });
}
```

### Flow:
1. **If `maxMembersInAnyProject > newSeats`**:
   - **BLOCKED**: User is prompted with an explicit alert:
     > *"Cannot reduce to 5 seats because Project 'Commercial Complex A' has 7 active members. Please remove 2 members from that project first."*
2. **If `maxMembersInAnyProject <= newSeats`**:
   - **APPROVED**:
     - `organizations.seats_purchased` is updated to **`5`**.
     - Future renewals will be billed at the reduced seat count (`5 * ₹159` = ₹795/mo).

---

## Technical File Locations to Modify (Future Execution)

1. **`backend/controllers/subscriptionController.ts`**:
   - Update `createOrder` to handle seat modification charges and invoke `validateSeatReduction`.
   - Add `getMaxProjectMembers` query function.

2. **`frontend/src/pages/Role/Billing/Billing.tsx`**:
   - Show active seat count indicator and dynamic upgrade/downgrade indicators on seat stepper.

3. **`mobile-expo/app/subscription.tsx`**:
   - Update modal sheet stepper with live seat change validation.
