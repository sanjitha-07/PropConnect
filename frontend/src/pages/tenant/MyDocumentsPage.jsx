import { useContext, useState, useEffect, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import PageHero from "../../components/PageHero.jsx";
import { DOCUMENTS } from "../../data/db.js";
import { fetchDocuments, createDocument, downloadDocument } from "../../utils/apiClient.js";
import "./TenantAccountDocs.css";

const CATEGORIES = [
  { id: "all", label: "All Documents", icon: "📁" },
  { id: "Rental Agreement", label: "Rental Agreement", icon: "📄" },
  { id: "Identity Documents", label: "Identity Documents", icon: "🪪" },
  { id: "Payment Receipts", label: "Payment Receipts", icon: "🧾" },
  { id: "Utility Bills", label: "Utility Bills", icon: "⚡" },
  { id: "Other Documents", label: "Other Documents", icon: "📑" },
];

function normalizeCategory(type) {
  if (!type) return "Other Documents";
  const t = type.toLowerCase();
  if (t.includes("agreement") || t.includes("lease") || t.includes("tenancy")) return "Rental Agreement";
  if (t.includes("kyc") || t.includes("identity") || t.includes("aadhaar") || t.includes("passport") || t.includes("pan") || t.includes("voter")) return "Identity Documents";
  if (t.includes("receipt") || t.includes("payment") || t.includes("invoice")) return "Payment Receipts";
  if (t.includes("utility") || t.includes("eb") || t.includes("electricity") || t.includes("water") || t.includes("tneb")) return "Utility Bills";
  return "Other Documents";
}

function getCategoryIcon(cat) {
  switch (cat) {
    case "Rental Agreement": return "📄";
    case "Identity Documents": return "🪪";
    case "Payment Receipts": return "🧾";
    case "Utility Bills": return "⚡";
    default: return "📑";
  }
}

export default function MyDocumentsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const entityId = user?.entityId || user?.entity_id || "TEN001";
  const [docList, setDocList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedCat, setSelectedCat] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Active Document
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [toast, setToast] = useState({ text: "", type: "info" });

  // Upload Form State
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState("Identity Documents");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const showToast = (text, type = "info") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "info" }), 4500);
  };

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      if (Array.isArray(data) && data.length > 0) {
        // Enforce tenant ownership scoping
        const filtered = data.filter(
          (d) =>
            d.relatedTo === entityId ||
            d.tenantId === entityId ||
            d.tenant_id === entityId ||
            d.related_to === entityId
        );
        setDocList(filtered);
      } else {
        const localFiltered = DOCUMENTS.filter(
          (d) => d.relatedTo === entityId || d.tenantId === entityId || d.tenant_id === entityId
        );
        setDocList(localFiltered);
      }
    } catch (err) {
      const localFiltered = DOCUMENTS.filter(
        (d) => d.relatedTo === entityId || d.tenantId === entityId || d.tenant_id === entityId
      );
      setDocList(localFiltered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [entityId]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!docName.trim()) {
      setDocName(file.name.replace(/\.[^/.]+$/, ""));
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!docName.trim()) {
      showToast("Please enter a document title.", "error");
      return;
    }

    setIsUploading(true);
    // Explicitly set status to "Pending Verification" - never automatically mark as verified
    const newDocPayload = {
      name: docName.trim(),
      type: docCategory,
      category: docCategory,
      relatedTo: entityId,
      tenantId: entityId,
      status: "Pending Verification",
      fileName: selectedFile?.name || `${docName.trim().replace(/\s+/g, "_")}.pdf`,
      fileSize: selectedFile?.size || 1024 * 128,
      mimeType: selectedFile?.type || "application/pdf",
      fileData: fileBase64 || "",
      uploadedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    };

    try {
      const savedDoc = await createDocument(newDocPayload);
      // Ensure local state reflects "Pending Verification"
      const confirmedDoc = { ...savedDoc, status: "Pending Verification" };
      setDocList((prev) => [confirmedDoc, ...prev]);
      setDocName("");
      setDocCategory("Identity Documents");
      setSelectedFile(null);
      setFileBase64("");
      setUploadModalOpen(false);
      showToast(`✓ Document "${confirmedDoc.name}" uploaded. Status: Pending Verification.`, "success");
    } catch (err) {
      showToast(err.message || "Failed to persist document to backend", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      showToast(`Initiating secure download for ${doc.name}…`, "info");
      await downloadDocument(doc.id, doc.fileName || `${doc.name}.pdf`);
      showToast(`✓ ${doc.name} downloaded successfully!`, "success");
    } catch (err) {
      showToast(`⚠️ ${err.message || "Failed to download document"}`, "error");
    }
  };

  // Filtered documents calculation
  const filteredDocs = useMemo(() => {
    return docList.filter((doc) => {
      const cat = normalizeCategory(doc.category || doc.type);
      if (selectedCat !== "all" && cat !== selectedCat) return false;

      const docStatus = doc.status || "Pending Verification";
      if (statusFilter !== "all" && docStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (doc.name || "").toLowerCase().includes(q);
        const matchesFile = (doc.fileName || "").toLowerCase().includes(q);
        const matchesCat = cat.toLowerCase().includes(q);
        const matchesDate = (doc.uploadedOn || doc.uploadedAt || "").toLowerCase().includes(q);
        if (!matchesName && !matchesFile && !matchesCat && !matchesDate) return false;
      }

      return true;
    });
  }, [docList, selectedCat, statusFilter, searchQuery]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts = { all: docList.length };
    CATEGORIES.forEach((c) => {
      if (c.id !== "all") {
        counts[c.id] = docList.filter((d) => normalizeCategory(d.category || d.type) === c.id).length;
      }
    });
    return counts;
  }, [docList]);

  return (
    <div className="tad-container">
      <PageHero
        badge="Document Management"
        title={t("myDocuments", "My Documents")}
        subtitle="Secure vault for rental agreements, government KYC, payment receipts, and utility records."
      />

      {toast.text && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "13.5px",
            background:
              toast.type === "error"
                ? "#fee2e2"
                : toast.type === "success"
                ? "#ecfdf5"
                : "#eff6ff",
            color:
              toast.type === "error"
                ? "#b91c1c"
                : toast.type === "success"
                ? "#047857"
                : "#1d4ed8",
            border: `1px solid ${
              toast.type === "error"
                ? "#fca5a5"
                : toast.type === "success"
                ? "#a7f3d0"
                : "#bfdbfe"
            }`,
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Top Filter & Action Bar */}
      <div className="tad-filter-bar">
        <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
              🔍
            </span>
            <input
              type="text"
              className="inp"
              placeholder="Search documents by name, filename, category, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "36px", height: "40px", fontSize: "13px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            )}
          </div>

          <select
            className="inp"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "170px", height: "40px", fontSize: "13px" }}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="pending verification">Pending Verification</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ height: "40px", padding: "0 18px", display: "inline-flex", alignItems: "center", gap: "8px" }}
          onClick={() => setUploadModalOpen(true)}
        >
          <span>📤</span> {t("uploadDocument", "Upload Document")}
        </button>
      </div>

      {/* Document Categories Tabs */}
      <div className="tad-cat-tabs">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCat === cat.id;
          const count = categoryCounts[cat.id] || 0;
          return (
            <button
              key={cat.id}
              type="button"
              className={`tad-cat-btn ${isActive ? "active" : ""}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="tad-badge-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Document Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
          <div>Loading your secure documents…</div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "50px 20px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
          <h4 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "16px" }}>No documents found</h4>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "13px" }}>
            {searchQuery || statusFilter !== "all" || selectedCat !== "all"
              ? "Try adjusting your search query or filters to find what you're looking for."
              : "You haven't uploaded any documents in this category yet."}
          </p>
          <button
            type="button"
            className="btn-outline"
            style={{ fontSize: "13px" }}
            onClick={() => setUploadModalOpen(true)}
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="tad-doc-grid">
          {filteredDocs.map((doc) => {
            const cat = normalizeCategory(doc.category || doc.type);
            const icon = getCategoryIcon(cat);
            const status = doc.status || "Pending Verification";
            const isVerified = status.toLowerCase() === "verified";
            const isRejected = status.toLowerCase() === "rejected";
            const statusClass = isVerified ? "verified" : isRejected ? "rejected" : "pending";
            const statusLabel = isVerified
              ? "Verified"
              : isRejected
              ? "Rejected"
              : "Pending Verification";

            return (
              <div key={doc.id} className="tad-doc-card">
                <div>
                  <div className="tad-doc-top">
                    <div className="tad-doc-icon">{icon}</div>
                    <span className={`tad-status-pill ${statusClass}`}>
                      {isVerified ? "✓" : isRejected ? "✕" : "⏳"} {statusLabel}
                    </span>
                  </div>

                  <h4
                    style={{
                      margin: "12px 0 6px",
                      fontSize: "14.5px",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: "1.35",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                    title={doc.name}
                  >
                    {doc.name}
                  </h4>

                  <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "8px" }}>
                    {cat}
                  </div>

                  <div className="tad-doc-meta">
                    <span>Uploaded: {doc.uploadedOn || doc.uploadedAt || "Recent"}</span>
                    <span>{doc.fileName ? doc.fileName.split(".").pop().toUpperCase() : "PDF"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ flex: 1, padding: "6px 10px", fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    👁️ Preview
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ flex: 1, padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#0284c7", borderColor: "#bae6fd" }}
                    onClick={() => handleDownload(doc)}
                  >
                    📥 Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleUploadSubmit} style={{ maxWidth: "520px" }}>
            <div className="settings-header" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>📤</span>
                <h3 style={{ margin: 0 }}>{t("uploadDocument", "Upload Document")}</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setUploadModalOpen(false)}>✕</button>
            </div>

            <div className="field">
              <label style={{ fontWeight: 600, fontSize: "13px" }}>{t("documentName", "Document Title")}</label>
              <input
                className="inp"
                autoFocus
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. Aadhaar Card, Passport, June Rent Receipt"
                required
              />
            </div>

            <div className="field">
              <label style={{ fontWeight: 600, fontSize: "13px" }}>Document Category</label>
              <select
                className="inp"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
              >
                <option value="Rental Agreement">Rental Agreement</option>
                <option value="Identity Documents">Identity Documents</option>
                <option value="Payment Receipts">Payment Receipts</option>
                <option value="Utility Bills">Utility Bills</option>
                <option value="Other Documents">Other Documents</option>
              </select>
            </div>

            <div className="field">
              <label style={{ fontWeight: 600, fontSize: "13px" }}>Select File (PDF, Images, Scan)</label>
              <input
                type="file"
                className="inp"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
              />
              <span style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px", display: "block" }}>
                Allowed formats: PDF, PNG, JPG, DOCX (Max size: 15MB). Stored securely on PropConnect backend.
              </span>
            </div>

            <div
              style={{
                margin: "12px 0 16px",
                padding: "10px 14px",
                background: "#fffbeb",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#b45309",
                border: "1px solid #fde68a",
                lineHeight: "1.4",
              }}
            >
              🔒 <strong>Verification Policy:</strong> All newly uploaded documents are automatically registered under <strong>Pending Verification</strong> status until reviewed by property management.
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="btn-outline" onClick={() => setUploadModalOpen(false)}>
                {t("cancel", "Cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={isUploading}>
                {isUploading ? "Uploading..." : "Submit for Verification"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Document Preview & Details Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", padding: "24px" }}
          >
            <div className="settings-header" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>{getCategoryIcon(normalizeCategory(previewDoc.category || previewDoc.type))}</span>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Document Preview &amp; Details</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPreviewDoc(null)}>✕</button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "18px", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>{previewDoc.name}</h4>
                <span
                  className={`tad-status-pill ${(previewDoc.status || "").toLowerCase() === "verified" ? "verified" : (previewDoc.status || "").toLowerCase() === "rejected" ? "rejected" : "pending"}`}
                >
                  {previewDoc.status || "Pending Verification"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                <div>
                  <span style={{ color: "#64748b" }}>Document ID:</span>{" "}
                  <strong>{previewDoc.id}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Category:</span>{" "}
                  <strong>{normalizeCategory(previewDoc.category || previewDoc.type)}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Uploaded Date:</span>{" "}
                  <strong>{previewDoc.uploadedOn || previewDoc.uploadedAt || "N/A"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>File Format:</span>{" "}
                  <strong>{previewDoc.fileName ? previewDoc.fileName.split(".").pop().toUpperCase() : "PDF"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Owner / Tenant:</span>{" "}
                  <strong>{entityId}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Security:</span>{" "}
                  <strong style={{ color: "#059669" }}>Encrypted &amp; Scoped</strong>
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "24px",
                textAlign: "center",
                background: "#fdfdfd",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>📄</div>
              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "14px" }}>
                {previewDoc.fileName || `${previewDoc.name}.pdf`}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Backend secure storage path: /api/documents/{previewDoc.id}/download
              </div>
            </div>

            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setPreviewDoc(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleDownload(previewDoc)}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <span>📥</span> Secure Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
