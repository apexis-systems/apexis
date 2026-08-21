"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Send,
  Building2,
  Smartphone,
  CreditCard,
  Mail,
  Receipt,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCustomPlanInvoiceDetails,
  sendCustomPlanInvoice,
} from "@/services/superadminService";
import { toast } from "sonner";

interface SendCustomInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: number;
    organizationId: number | null;
    name: string;
    company: string;
    email: string;
  } | null;
  onSuccess?: () => void;
}

export default function SendCustomInvoiceModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
}: SendCustomInvoiceModalProps) {
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [details, setDetails] = useState<any>(null);

  // Form states
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");

  // Bank Transfer Fields (Initialized empty as requested)
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [bankRef, setBankRef] = useState("");

  // UPI Fields (Initialized empty as requested)
  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [upiBankName, setUpiBankName] = useState("");
  const [upiRef, setUpiRef] = useState("");

  useEffect(() => {
    if (isOpen && lead?.organizationId) {
      setFetching(true);
      setDetails(null);
      setRecipientEmail(lead.email || "");

      getCustomPlanInvoiceDetails(lead.organizationId)
        .then((data) => {
          setDetails(data);
          const amt = data.defaultAmount || data.organization?.plan_price || 0;
          setPaymentAmount(String(amt));
          if (data.adminUser?.email) {
            setRecipientEmail(data.adminUser.email);
          }

          // If there is an existing direct transaction with saved payment method, keep method selection
          if (data.transaction?.payment_method === "upi") {
            setPaymentMethod("upi");
          } else {
            setPaymentMethod("bank_transfer");
          }
        })
        .catch((err) => {
          console.error("Failed to load invoice details:", err);
          toast.error("Failed to load invoice details.");
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [isOpen, lead?.organizationId]);

  if (!isOpen || !lead) return null;

  const handleSendInvoice = async () => {
    if (!lead.organizationId) {
      toast.error("Organization ID is missing.");
      return;
    }

    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast.error("Please enter a valid recipient email.");
      return;
    }

    const paymentDetails =
      paymentMethod === "upi"
        ? {
            upi_id: upiId.trim(),
            account_name: upiPayeeName.trim(),
            payee_name: upiPayeeName.trim(),
            bank_name: upiBankName.trim(),
            transaction_ref: upiRef.trim(),
          }
        : {
            bank_name: bankName.trim(),
            account_name: accountName.trim(),
            account_number: accountNumber.trim(),
            ifsc_code: ifscCode.trim(),
            branch: branch.trim(),
            transaction_ref: bankRef.trim(),
          };

    setSending(true);
    try {
      const response = await sendCustomPlanInvoice({
        organizationId: lead.organizationId,
        transactionId: details?.transaction?.id,
        paymentAmount: numAmount,
        paymentMethod,
        paymentDetails,
        recipientEmail: recipientEmail.trim(),
        customNotes: customNotes.trim(),
      });

      toast.success(response.message || `Invoice sent to ${recipientEmail}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to send invoice:", error);
      toast.error(error?.response?.data?.error || "Failed to send invoice.");
    } finally {
      setSending(false);
    }
  };

  const parsedAmount = Number(paymentAmount) || 0;
  const org = details?.organization;
  const invoiceNo = details?.transaction?.invoice_number || details?.suggestedInvoiceNumber || "APX-INV-PENDING";
  const todayStr = new Date().toLocaleDateString("en-GB");

  const planSeats = org?.seats || 1;
  const cycleText = org?.subscription_cycle ? org.subscription_cycle.charAt(0).toUpperCase() + org.subscription_cycle.slice(1) : "Monthly";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border border-[hsl(35_15%_85%)] bg-background shadow-2xl dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_10%_12%)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(24_95%_53%/0.15)] text-[hsl(24_95%_53%)]">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Customize & Send Invoice
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  GST-Free (0%)
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Edit payment information & amount for <span className="font-semibold text-foreground">{lead.company || lead.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Split Screen */}
        <div className="flex-1 overflow-y-auto p-6">
          {fetching ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(24_95%_53%)]" />
              <p className="text-sm text-muted-foreground">Loading invoice specifications...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Controls (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Organization Summary Box */}
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-semibold text-foreground">{lead.company || "Company"}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Invoice: <span className="font-mono text-foreground font-semibold">{invoiceNo}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span>Seats: </span>
                      <strong className="text-foreground">{planSeats} Contributor Seats</strong>
                    </div>
                    <div>
                      <span>Cycle: </span>
                      <strong className="text-foreground">{cycleText}</strong>
                    </div>
                  </div>
                </div>

                {/* Amount Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[hsl(24_95%_53%)]" />
                    Payment Amount (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm font-bold text-foreground shadow-sm focus:border-[hsl(24_95%_53%)] focus:outline-none focus:ring-1 focus:ring-[hsl(24_95%_53%)]"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This is the final billed amount (0% GST applied).
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank_transfer")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === "bank_transfer"
                          ? "border-[hsl(24_95%_53%)] bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)] shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Building2 className="h-4 w-4" />
                      Bank Transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === "upi"
                          ? "border-[hsl(24_95%_53%)] bg-[hsl(24_95%_53%/0.12)] text-[hsl(24_95%_53%)] shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      UPI Transfer
                    </button>
                  </div>
                </div>

                {/* Dynamic Payment Fields */}
                {paymentMethod === "bank_transfer" ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-blue-500" />
                      Bank Transfer Details
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank Ltd"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Account Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Apexis Systems Pvt Ltd"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Account Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 50200118128748"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">IFSC Code</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC0009817"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Branch</label>
                        <input
                          type="text"
                          placeholder="e.g. Banjara Hills, Hyd"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">UTR / Ref No. (Opt.)</label>
                        <input
                          type="text"
                          placeholder="e.g. UTR12345678"
                          value={bankRef}
                          onChange={(e) => setBankRef(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                      UPI Details
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">UPI ID / VPA</label>
                        <input
                          type="text"
                          placeholder="e.g. apexis@hdfcbank"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Payee / Account Name</label>
                        <input
                          type="text"
                          placeholder="e.g. APEXIS Systems Pvt Ltd"
                          value={upiPayeeName}
                          onChange={(e) => setUpiPayeeName(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">Bank / UPI App</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank / GPay"
                          value={upiBankName}
                          onChange={(e) => setUpiBankName(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[11px]">UPI Txn ID / Ref (Opt.)</label>
                        <input
                          type="text"
                          placeholder="e.g. 402819284918"
                          value={upiRef}
                          onChange={(e) => setUpiRef(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-[hsl(24_95%_53%)] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipient Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-sky-500" />
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="customer@company.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm focus:border-[hsl(24_95%_53%)] focus:outline-none"
                  />
                </div>

                {/* Notes (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Custom Notes / Memo (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Direct payment verified for custom 5-user pack."
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground shadow-sm focus:border-[hsl(24_95%_53%)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Right Column: Live Dynamic Invoice Preview (7 cols) */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    Live Invoice Preview
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Updates automatically as you type
                  </span>
                </div>

                {/* White sheet container */}
                <div className="rounded-xl border border-border bg-white text-slate-900 p-6 shadow-sm overflow-hidden text-[11px] leading-relaxed">
                  {/* Top Header */}
                  <div className="text-center pb-3 border-b-2 border-[#f97415]">
                    <div className="text-xl font-black tracking-tight text-[#f97415]">
                      APEXIS<span className="text-xs font-semibold text-slate-500">PRO™</span>
                    </div>
                    <div className="text-[8px] font-bold text-slate-500 tracking-wider mt-0.5">
                      RECORD · REPORT · RELEASE .
                    </div>
                    <div className="mt-2 text-xs font-bold uppercase text-slate-900">
                      INVOICE – SOFTWARE SUBSCRIPTION
                    </div>
                  </div>

                  {/* Company & Invoice Details Grid */}
                  <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">APEXIS Systems Private Limited</div>
                      <div className="text-slate-600 text-[10px]">
                        H.No. 10-5-37, Rose Residency<br />
                        Masab Tank, Hyderabad – 500028<br />
                        Email: info@apexis.in | +91-8125958073
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <div>
                        <span className="text-slate-500">Invoice No: </span>
                        <strong className="text-slate-900 font-mono">{invoiceNo}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Date: </span>
                        <span className="text-slate-800">{todayStr}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Plan: </span>
                        <span className="font-semibold text-slate-900">{org?.plan_name || "Custom Enterprise"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Cycle: </span>
                        <span className="text-slate-800">{cycleText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className="py-2.5 border-b border-slate-200">
                    <div className="text-[9px] font-bold uppercase text-[#f97415] mb-1">BILL TO</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500">Company: </span>
                        <strong className="text-slate-900">{lead.company || lead.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Contact: </span>
                        <span className="text-slate-900 font-medium">{lead.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Email: </span>
                        <span className="text-slate-900">{recipientEmail || lead.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">GSTIN: </span>
                        <span className="text-slate-500">—</span>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="my-3 overflow-hidden rounded border border-slate-200">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-900 text-white font-semibold">
                        <tr>
                          <th className="p-1.5">Description</th>
                          <th className="p-1.5">Period</th>
                          <th className="p-1.5 text-right">Unit Price</th>
                          <th className="p-1.5 text-right">GST (0%)</th>
                          <th className="p-1.5 text-right">Total (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-slate-50">
                        <tr>
                          <td className="p-1.5">
                            Seat Subscription ({planSeats} seat{planSeats > 1 ? "s" : ""})
                          </td>
                          <td className="p-1.5">{cycleText}</td>
                          <td className="p-1.5 text-right">₹{parsedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="p-1.5 text-right">₹0.00</td>
                          <td className="p-1.5 text-right font-bold text-slate-900">
                            ₹{parsedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-end pr-2 text-right">
                    <div className="space-y-0.5 w-48 text-[10px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span>₹{parsedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-300 pt-1 text-xs font-bold text-[#f97415]">
                        <span>Grand Total:</span>
                        <span>INR {parsedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Box (Dynamic Preview) */}
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-[9px] font-bold uppercase text-[#f97415] mb-1">
                      {paymentMethod === "upi" ? "PAYMENT INFORMATION (UPI)" : "PAYMENT INFORMATION (BANK TRANSFER)"}
                    </div>
                    {paymentMethod === "upi" ? (
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div><span className="text-slate-500">Mode: </span><span className="font-semibold text-slate-900">UPI / QR Transfer</span></div>
                        <div><span className="text-slate-500">UPI ID / VPA: </span><span className="font-bold text-slate-900 font-mono">{upiId || "—"}</span></div>
                        <div><span className="text-slate-500">Payee Name: </span><span className="text-slate-900">{upiPayeeName || "—"}</span></div>
                        <div><span className="text-slate-500">Bank / App: </span><span className="text-slate-900">{upiBankName || "—"}</span></div>
                        {upiRef ? <div><span className="text-slate-500">Txn Ref: </span><span className="text-slate-900 font-mono">{upiRef}</span></div> : null}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div><span className="text-slate-500">Bank Name: </span><span className="font-semibold text-slate-900">{bankName || "—"}</span></div>
                        <div><span className="text-slate-500">Account Name: </span><span className="text-slate-900">{accountName || "—"}</span></div>
                        <div><span className="text-slate-500">Account No: </span><span className="font-bold text-slate-900 font-mono">{accountNumber || "—"}</span></div>
                        <div><span className="text-slate-500">IFSC Code: </span><span className="font-bold text-slate-900 font-mono uppercase">{ifscCode || "—"}</span></div>
                        <div><span className="text-slate-500">Branch: </span><span className="text-slate-900">{branch || "—"}</span></div>
                        {bankRef ? <div><span className="text-slate-500">UTR / Ref: </span><span className="text-slate-900 font-mono">{bankRef}</span></div> : null}
                      </div>
                    )}
                  </div>

                  {/* Signatory */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-500">
                    <div>For APEXIS Systems Private Limited</div>
                    <div className="font-semibold text-slate-800">Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5 bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>PDF invoice will be attached and sent directly to {recipientEmail || "customer"}.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendInvoice}
              disabled={sending || fetching}
              className="bg-[hsl(24_95%_53%)] text-white hover:bg-[hsl(24_95%_48%)]"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sending Invoice...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send Invoice to Customer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
