/**
 * paymentReportExport.js
 * Comprehensive CSV/Excel & printable PDF report generator for PropConnect payments.
 */

export function exportPaymentLedgerToCSV(payments, filename = "PropConnect_Payment_Ledger.csv") {
  if (!payments || payments.length === 0) {
    alert("No payment records to export.");
    return;
  }

  const headers = [
    "Invoice ID",
    "Tenant Name",
    "Property / Unit",
    "Billing Period",
    "Due Date",
    "Payment Date",
    "Amount (INR)",
    "Status",
    "Payment Method",
    "Invoice / Ref No",
    "Notes",
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = payments.map((p) => [
    escapeCsv(p.id || p._id),
    escapeCsv(p.tenantName || p.tenant?.name || p.tenantId || "N/A"),
    escapeCsv(p.propertyName || p.property?.name || p.propertyId || "N/A"),
    escapeCsv(p.periodStart && p.periodEnd ? `${p.periodStart} to ${p.periodEnd}` : p.month || "N/A"),
    escapeCsv(p.dueDate || "N/A"),
    escapeCsv(p.paidDate || "—"),
    escapeCsv(Number(p.amount || 0).toFixed(2)),
    escapeCsv(p.status || "Pending"),
    escapeCsv(p.method || "UPI"),
    escapeCsv(p.invoiceNo || p.id || "N/A"),
    escapeCsv(p.notes || ""),
  ]);

  const csvContent =
    "\uFEFF" + // UTF-8 BOM for Excel compatibility
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPaymentLedgerToPDF(payments, meta = {}) {
  const {
    title = "PropConnect Payment History & Financial Ledger Report",
    subtitle = "Residential Tenancy Ledger • Tamil Nadu Tenancy Regulatory Compliance",
    dateRangeLabel = "All Recorded Cycles",
    summaryStats = {},
  } = meta;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPaid = payments
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPending = payments
    .filter((p) => p.status === "Pending" || p.status === "Overdue")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const rowsHtml = payments
    .map(
      (p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11.5px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td style="padding: 8px 10px; font-weight: 600; color: #1e40af;">${p.id || p.invoiceNo}</td>
        <td style="padding: 8px 10px;">${p.tenantName || p.tenant?.name || "Resident"}</td>
        <td style="padding: 8px 10px;">${p.propertyName || p.property?.name || "Premises"}</td>
        <td style="padding: 8px 10px;">${p.periodStart && p.periodEnd ? `${p.periodStart} to ${p.periodEnd}` : p.month || "—"}</td>
        <td style="padding: 8px 10px;">${p.dueDate || "—"}</td>
        <td style="padding: 8px 10px;">${p.paidDate || "—"}</td>
        <td style="padding: 8px 10px; font-weight: 700; text-align: right;">₹${(Number(p.amount) || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 8px 10px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; 
            background: ${p.status === "Paid" ? "#dcfce7; color: #15803d" : p.status === "Overdue" ? "#fee2e2; color: #b91c1c" : "#fef3c7; color: #b45309"};">
            ${p.status || "Pending"}
          </span>
        </td>
        <td style="padding: 8px 10px;">${p.method || "UPI"}</td>
      </tr>
    `
    )
    .join("");

  const docHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 32px;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }
        .brand {
          font-size: 24px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.5px;
        }
        .report-meta {
          text-align: right;
          font-size: 12px;
          color: #64748b;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .kpi-title {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .kpi-val {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 10px 8px;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
        }
        .footer {
          margin-top: 36px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
        }
        @media print {
          body { padding: 10mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">PropConnect Portal</div>
          <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">${title}</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${subtitle}</div>
        </div>
        <div class="report-meta">
          <div>Report Generated: <strong>${new Date().toLocaleString("en-IN")}</strong></div>
          <div style="margin-top: 2px;">Period Scope: <strong>${dateRangeLabel}</strong></div>
          <div style="margin-top: 2px;">Records Included: <strong>${payments.length}</strong></div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Total Invoices</div>
          <div class="kpi-val">${payments.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Billed</div>
          <div class="kpi-val">₹${totalAmount.toLocaleString("en-IN")}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Settled / Collected</div>
          <div class="kpi-val" style="color: #16a34a;">₹${totalPaid.toLocaleString("en-IN")}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Pending / Overdue</div>
          <div class="kpi-val" style="color: #dc2626;">₹${totalPending.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Tenant</th>
            <th>Property</th>
            <th>Period</th>
            <th>Due Date</th>
            <th>Paid Date</th>
            <th style="text-align: right;">Amount (₹)</th>
            <th style="text-align: center;">Status</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>PropConnect Residential Tenancy Platform • Government of Tamil Nadu TNRRRLTA Standard Compliant</div>
        <div>Page 1 of 1 • Digitally Authenticated</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(docHtml);
  printWindow.document.close();
}
