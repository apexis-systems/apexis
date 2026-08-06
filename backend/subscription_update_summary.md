# APEXIS Subscription & Dynamic Seat Management Update Summary

## Overview

This document provides a comprehensive technical breakdown of all architectural enhancements, API additions, database updates, and UI component implementations made to the **Apexis Subscription & Resource Management System** across Backend, Web Frontend, and Mobile Expo.

---

## Key Achievements & Feature Matrix

| Feature Area | Description | Impact |
| :--- | :--- | :--- |
| **Razorpay AutoPay Architecture** | Detailed plan for Razorpay Subscriptions API, UPI AutoPay, and mandate management for prepaid seats. | Saved in `backend/razorpay_autopay_seat_management_plan.md` for future AutoPay rollout. |
| **Per-Organization Storage Overrides** | Prioritizes `organizations.storage_limit_mb` over global `plans.storage_limit_mb`. | Allows per-tenant custom storage quotas without modifying shared plan definitions. |
| **Per-Project Capacity Display** | Scaled total seats (`seats * projectCount`) and total storage (`storage * projectCount`) in usage UI. | Accurately represents multi-project allocation and eliminates false storage limit warnings. |
| **Seat Reduction Pre-Validation API** | New endpoint `POST /api/subscriptions/validate-seat-change` checking project member density. | Ensures team members are not stranded when reducing seats. |
| **Global Member Management Modal** | Native & Web modals allowing admins to delete project members directly during seat reduction. | Built in Web (`ProjectMemberManagementModal.tsx`) & Mobile Expo (`ProjectMemberManagementModal.tsx`). |
| **Prepaid Seat Reduction (No Payment)** | Mid-cycle seat downgrades directly update DB seats (`payment_amount = 0`) without opening Razorpay. | Aligns with SaaS prepaid rules: pay on upgrade, zero charge on downgrade. |

---

## Detailed File Change Tree & Architectural Details

```
apexis/
├── backend/
│   ├── controllers/
│   │   └── subscriptionController.ts       # Added validateSeatChange, direct seat downgrade update, per-org storage check
│   ├── routes/
│   │   └── subscriptionRoutes.ts           # Registered POST /subscription/validate-seat-change
│   ├── utils/
│   │   └── subscriptionAccess.ts           # Updated checkStorageLimit to prioritize org.storage_limit_mb
│   └── razorpay_autopay_seat_management_plan.md  # Architecture doc for Razorpay AutoPay mandate integration
│
├── frontend/ (Web)
│   ├── src/services/
│   │   └── subscriptionService.ts         # Added validateSeatChange & removeProjectMember helpers
│   ├── src/components/subscription/
│   │   └── ProjectMemberManagementModal.tsx # [NEW] Web modal for managing & deleting project members
│   └── src/pages/Role/Billing/
│       └── Billing.tsx                    # Integrated seat stepper, validation check & zero-charge downgrade handler
│
└── mobile-expo/ (React Native App)
    ├── services/
    │   └── subscriptionService.ts         # Added validateSeatChange & removeProjectMember helpers
    ├── components/subscription/
    │   └── ProjectMemberManagementModal.tsx # [NEW] Mobile bottom-sheet modal for managing project members
    ├── app/
    │   ├── subscription.tsx               # Fixed seat stepper (- button), validation check & zero-charge downgrade handler
    │   └── usage.tsx                      # Scaled Team Seats & Cloud Storage limits by project count
```

---

## Section Breakdown of System Updates

### 1. Per-Organization Custom Storage Quotas
- **File**: `[subscriptionAccess.ts](file:///e:/word/apexis/backend/utils/subscriptionAccess.ts#L187)` & `[subscriptionController.ts](file:///e:/word/apexis/backend/controllers/subscriptionController.ts#L399)`
- **Change**: Updated storage limit resolution logic:
  ```typescript
  const limitMb = org.storage_limit_mb || org.plan?.storage_limit_mb || 5000;
  ```
- **Rationale**: Enables granting custom storage allocations (e.g. 5,120 MB or 10,000 MB) to specific organizations directly via PostgreSQL DB `organizations.storage_limit_mb` column without altering generic `plans` table rows.

---

### 2. Multi-Project Capacity Scaling in Usage UI
- **Files**: `[subscriptionController.ts](file:///e:/word/apexis/backend/controllers/subscriptionController.ts#L402)` | `[usage.tsx](file:///e:/word/apexis/mobile-expo/app/usage.tsx#L111)` | `[Billing.tsx](file:///e:/word/apexis/frontend/src/pages/Role/Billing/Billing.tsx#L568)`
- **Behavior**:
  - `Team Seats Total Capacity` = `seats_purchased * Math.max(1, projectCount)`
  - `Cloud Storage Total Capacity` = `storage_limit_per_project_mb * Math.max(1, projectCount)`
- **Rationale**: Since seat and storage limits are enforced **per project**, total capacity in the usage breakdown is displayed across all organization projects. For example, 3 seats across 4 projects displays **`3 / 12 Seats`**, and 5 MB across 4 projects displays **`18 MB / 20 MB`** instead of showing an overflow alert (`18 MB / 5 MB`).

---

### 3. Seat Density Validation & Pre-Checkout API
- **Endpoint**: `POST /api/subscriptions/validate-seat-change`
- **Request Body**: `{ targetSeats: number }`
- **Logic**:
  - Scans all projects in the organization.
  - Counts active team members (`contributor`, `consultant`, `vendor`).
  - Identifies any project where `teamMemberCount > targetSeats`.
  - Returns member details (`project_member_id`, `user_id`, `name`, `email`, `role`, `profile_pic`).

---

### 4. Global Project Member Management Modals (Web & Mobile)
- **Web Component**: `[ProjectMemberManagementModal.tsx](file:///e:/word/apexis/frontend/src/components/subscription/ProjectMemberManagementModal.tsx)`
- **Mobile Component**: `[ProjectMemberManagementModal.tsx](file:///e:/word/apexis/mobile-expo/components/subscription/ProjectMemberManagementModal.tsx)`
- **Features**:
  - Modal pops up automatically if seat reduction causes any project to exceed `targetSeats`.
  - Filter tabs (`All`, `Contributor`, `Consultant`, `Vendor`, `Client`).
  - Displays project cards with seat density badges (`Team Seats: 5 / 3`).
  - Provides a **Delete Member** action next to each user that invokes `DELETE /api/projects/:id/members/:userId`.
  - Live compliance re-validation: as soon as all projects reach $\le$ target seats, enables **Proceed to Payment / Update**.

---

### 5. Prepaid Seat Reduction (Zero-Cost Direct Update)
- **Files**: `[subscriptionController.ts](file:///e:/word/apexis/backend/controllers/subscriptionController.ts#L114)` | `[Billing.tsx](file:///e:/word/apexis/frontend/src/pages/Role/Billing/Billing.tsx#L187)` | `[subscription.tsx](file:///e:/word/apexis/mobile-expo/app/subscription.tsx#L211)`
- **Logic**:
  - **Seat Upgrade (`seatsCount > currentSeats`)**: Calculates prorated top-up cost for remaining days, creates Razorpay Order, and opens Razorpay Checkout popup.
  - **Seat Downgrade (`seatsCount < currentSeats`)**: 
    - Verifies project member density.
    - Directly updates `organizations.seats_purchased = seatsCount` in database.
    - Creates zero-amount transaction record (`payment_amount: 0`, `status: success`).
    - Emits real-time socket event `subscription-updated`.
    - Returns `{ is_downgrade: true }`.
    - Frontend & Mobile display a success toast/alert and refresh usage/user context **without opening Razorpay payment modal**.

---

## Verification & Testing Guide

1. **Custom Storage Test**:
   - Set `organizations.storage_limit_mb = 5` in DB.
   - Upload 4 MB file in Project A and 4 MB file in Project B.
   - Verify that individual projects allow up to 5 MB each, and total storage UI shows `8 MB / 10 MB` (90% capacity across 2 projects).

2. **Seat Upgrade Test**:
   - Increase seat stepper from 3 seats to 5 seats.
   - Click **Upgrade to 5 Seats**.
   - Verify Razorpay payment modal opens with the calculated prorated top-up amount.

3. **Seat Downgrade & Member Modal Test**:
   - Set seat stepper from 5 seats to 2 seats.
   - Click **Update to 2 Seats**.
   - If a project has 4 members, verify **ProjectMemberManagementModal** pops up.
   - Delete 2 excess team members inside the modal.
   - Verify compliance banner turns green and **Proceed to Update** enables.
   - Click **Proceed to Update** -> Verify seat count updates directly to 2 seats with success notification and **no Razorpay payment modal**.
