import { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SettingsContext } from "../../context/SettingsContext.jsx";
import DataTable from "../../components/DataTable.jsx";
import PageHero from "../../components/PageHero.jsx";
import { DOCUMENTS, PROPERTIES, TENANTS } from "../../data/db.js";
import {
  fetchDocuments,
  fetchProperties,
  fetchTenants,
  createDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  verifyDocument,
  replaceDocument,
} from "../../utils/apiClient.js";
import "../tenant/TenantAccountDocs.css";

const CATEGORIES = [
  "All",
  "Identity Proof",
  "Address Proof",
  "Property Ownership Proof",
  "Tax Documents",
  "Bank Documents",
  "Lease Agreements",
  "Other",
];

export default function DocumentsPage() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(SettingsContext);

  const isAdmin = user?.role === "admin";
  const isLandlord = user?.role === "landlord";

  const [documents, setDocuments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();

  // Filter state
  const [activeCategory, setActiveCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Sync category query param
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat === "property") setActiveCategory("Property Ownership Proof");
    else if (cat === "tenant") setActiveCategory("Identity Proof");
    else if (cat === "lease") setActiveCategory("Rental Agreement");
    else if (cat && CATEGORIES.includes(cat)) setActiveCategory(cat);
  }, [searchParams]);

  // Modals & Action States
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [verifyingDoc, setVerifyingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [toast, setToast] = useState(null);

  // Upload Form State
  const initialForm = {
    name: "",
    category: "Property Ownership Proof",
    type: "PDF",
    documentNumber: "",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    propertyId: "",
    tenantId: "",
    file: null,
    fileName: "",
    fileSize: 0,
    mimeType: "application/pdf",
    fileData: "",
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Replace Form State
  const [replaceForm, setReplaceForm] = useState({
    name: "",
    documentNumber: "",
    expiryDate: "",
    notes: "",
    file: null,
    fileName: "",
    fileSize: 0,
    mimeType: "application/pdf",
    fileData: "",
  });

  // Admin Verification Form State
  const [verifyStatus, setVerifyStatus] = useState("Verified");
  const [rejectionReason, setRejectionReason] = useState("");

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [docData, propData, tenData] = await Promise.all([
        fetchDocuments(),
        fetchProperties(),
        fetchTenants(),
      ]);
      setDocuments(Array.isArray(docData) && docData.length > 0 ? docData : DOCUMENTS);
      setProperties(Array.isArray(propData) && propData.length > 0 ? propData : PROPERTIES);
      setTenants(Array.isArray(tenData) && tenData.length > 0 ? tenData : TENANTS);
    } catch (err) {
      console.warn("Could not load from API, using fallback data:", err.message);
      setDocuments(DOCUMENTS);
      setProperties(PROPERTIES);
      setTenants(TENANTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getProp = (pId) => properties.find((p) => p.id === pId || p._id === pId) || {};
  const getTen = (tId) => tenants.find((t) => t.id === tId || t._id === tId) || {};

  const getRelatedLabel = (doc) => {
    if (doc.tenantId || doc.tenant_id) {
      const ten = getTen(doc.tenantId || doc.tenant_id);
      if (ten && ten.name) return `${ten.name} (${ten.id})`;
    }
    if (doc.propertyId || doc.property_id) {
      const prop = getProp(doc.propertyId || doc.property_id);
      if (prop && prop.name) return `${prop.name} (${prop.id})`;
    }
    if (doc.relatedTo && doc.relatedTo !== "LDL001") {
      const ten = getTen(doc.relatedTo);
      if (ten && ten.name) return `${ten.name} (${ten.id})`;
      const prop = getProp(doc.relatedTo);
      if (prop && prop.name) return `${prop.name} (${prop.id})`;
      return doc.relatedTo;
    }
    return "Estate General Record";
  };

  // Convert File to Base64
  const handleFileChange = (e, isReplace = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast("File size exceeds 15MB limit. Please upload a smaller file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      if (isReplace) {
        setReplaceForm((prev) => ({
          ...prev,
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          fileData: base64Data,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          fileData: base64Data,
          name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateUpload = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = "Document title is required";
    if (!formData.category) errors.category = "Please select a category";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!validateUpload()) return;

    setIsSubmitting(true);
    try {
      const newDoc = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        category: formData.category,
        documentNumber: formData.documentNumber.trim(),
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
        propertyId: formData.propertyId || null,
        tenantId: formData.tenantId || null,
        fileName: formData.fileName || `${formData.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        fileSize: formData.fileSize || 0,
        mimeType: formData.mimeType || "application/pdf",
        fileData: formData.fileData || "",
      };

      const res = await createDocument(newDoc);
      setDocuments((prev) => [res || newDoc, ...prev]);
      setIsUploadOpen(false);
      setFormData(initialForm);
      showToast(`Document "${formData.name}" uploaded successfully!`);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to upload document", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!replacingDoc) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: replaceForm.name || replacingDoc.name,
        documentNumber: replaceForm.documentNumber || replacingDoc.documentNumber,
        expiryDate: replaceForm.expiryDate || replacingDoc.expiryDate,
        notes: replaceForm.notes || "Replaced with updated document version",
        fileName: replaceForm.fileName || replacingDoc.fileName,
        fileSize: replaceForm.fileSize || replacingDoc.fileSize,
        mimeType: replaceForm.mimeType || replacingDoc.mimeType,
        fileData: replaceForm.fileData || "",
      };

      const res = await replaceDocument(replacingDoc.id, payload);
      showToast(`Document updated to version ${res?.document?.version || 2}!`);
      setReplacingDoc(null);
      loadData();
    } catch (err) {
      showToast(err.message || "Failed to replace document", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyingDoc) return;

    if (verifyStatus === "Rejected" && !rejectionReason.trim()) {
      showToast("Please provide a reason for document rejection.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyDocument(verifyingDoc.id, verifyStatus, rejectionReason);
      showToast(`Document ${verifyingDoc.id} marked as ${verifyStatus}!`);
      setVerifyingDoc(null);
      setRejectionReason("");
      loadData();
    } catch (err) {
      showToast(err.message || "Verification failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    try {
      await deleteDocument(deletingDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      showToast(`Document ${deletingDoc.id} deleted from vault.`);
      setDeletingDoc(null);
    } catch (err) {
      showToast(err.message || "Failed to delete document", "error");
    }
  };

  const handleDownload = async (doc) => {
    try {
      showToast(`Downloading ${doc.name}...`, "info");
      await downloadDocument(doc.id, doc.fileName || `${doc.id}.pdf`);
      showToast(`✓ Downloaded ${doc.name}`);
    } catch (err) {
      showToast(`⚠️ ${err.message || "Download failed"}`, "error");
    }
  };

  // Dynamic status evaluation
  const todayStr = new Date().toISOString().split("T")[0];

  const processedRows = useMemo(() => {
    return documents.map((doc) => {
      const isExp = Boolean(doc.expiryDate && doc.expiryDate < todayStr);
      let calculatedStatus = doc.status || "Pending Verification";
      if (isExp && calculatedStatus !== "Rejected") {
        calculatedStatus = "Expired";
      }
      return {
        ...doc,
        displayName: doc.name || doc.title || "Legal Document",
        calculatedStatus,
        isExpired: isExp,
        relatedLabel: getRelatedLabel(doc),
        category: doc.category || "Other",
        version: doc.version || 1,
      };
    });
  }, [documents, todayStr, properties, tenants]);

  // Filtering
  const filteredRows = useMemo(() => {
    return processedRows.filter((d) => {
      const matchCat = activeCategory === "All" || d.category === activeCategory;
      const matchStatus =
        statusFilter === "All" ||
        d.calculatedStatus.toLowerCase() === statusFilter.toLowerCase();
      return matchCat && matchStatus;
    });
  }, [processedRows, activeCategory, statusFilter]);

  // KPI Calculations
  const totalCount = processedRows.length;
  const verifiedCount = processedRows.filter((r) => r.calculatedStatus === "Verified").length;
  const pendingCount = processedRows.filter(
    (r) => r.calculatedStatus === "Pending Verification" || r.calculatedStatus === "Pending"
  ).length;
  const actionRequiredCount = processedRows.filter(
    (r) => r.calculatedStatus === "Rejected" || r.calculatedStatus === "Expired"
  ).length;

  // Table Columns
  const columns = [
    {
      key: "name",
      label: "Document Details",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: r.calculatedStatus === "Expired" ? "#f1f5f9" : "#eff6ff",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0,
            }}
          >
            {r.category === "Property Ownership Proof"
              ? "📜"
              : r.category === "Identity Proof"
              ? "🪪"
              : r.category === "Bank Documents"
              ? "🏦"
              : r.category === "Tax Documents"
              ? "📑"
              : r.type === "Image"
              ? "🖼️"
              : "📕"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{r.displayName}</strong>
              {r.version > 1 && (
                <span
                  className="tad-version-pill"
                  title="Click to view version history"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryDoc(r);
                  }}
                >
                  v{r.version} 🕒
                </span>
              )}
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
              <span style={{ fontWeight: 600 }}>Ref:</span> {r.id}
              {r.documentNumber && (
                <>
                  {" • "}
                  <span style={{ fontWeight: 600 }}>No:</span> {r.documentNumber}
                </>
              )}
            </div>
            {r.rejectionReason && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "11px",
                  color: "#b91c1c",
                  background: "#fee2e2",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  display: "inline-block",
                }}
              >
                ⚠️ Reason: {r.rejectionReason}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: "6px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: "11.5px",
            fontWeight: 600,
            color: "#334155",
          }}
        >
          {r.category}
        </span>
      ),
    },
    {
      key: "relatedLabel",
      label: "Associated Entity",
      render: (r) => (
        <div style={{ fontSize: "12.5px", color: "#334155" }}>
          <div>{r.relatedLabel}</div>
        </div>
      ),
    },
    {
      key: "dates",
      label: "Issue & Expiry",
      render: (r) => (
        <div style={{ fontSize: "12px", color: "#475569" }}>
          <div>
            <span style={{ color: "#94a3b8" }}>Issued:</span> {r.issueDate || r.uploadedOn || "—"}
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>Expires:</span>{" "}
            {r.expiryDate ? (
              <span
                style={{
                  fontWeight: r.isExpired ? 700 : 500,
                  color: r.isExpired ? "#dc2626" : "inherit",
                }}
              >
                {r.expiryDate} {r.isExpired && "⚠️"}
              </span>
            ) : (
              <span style={{ color: "#94a3b8" }}>Lifetime / None</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Verification Status",
      render: (r) => {
        let pillClass = "pending";
        let label = r.calculatedStatus;
        if (r.calculatedStatus === "Verified") {
          pillClass = "verified";
          label = "✓ Verified";
        } else if (r.calculatedStatus === "Rejected") {
          pillClass = "rejected";
          label = "✕ Rejected";
        } else if (r.calculatedStatus === "Expired") {
          pillClass = "expired";
          label = "⌛ Expired";
        } else {
          pillClass = "pending";
          label = "⏳ Pending Verification";
        }

        return <span className={`tad-status-pill ${pillClass}`}>{label}</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px" }}
            onClick={() => setSelectedDoc(r)}
            title="Preview Details &amp; Certificate"
          >
            👁️ View
          </button>
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px" }}
            onClick={() => handleDownload(r)}
            title="Download Verified File"
          >
            📥
          </button>
          {(r.calculatedStatus === "Expired" || r.calculatedStatus === "Rejected") && (
            <button
              className="btn-primary"
              style={{ padding: "4px 8px", fontSize: "11px", background: "#f59e0b", borderColor: "#f59e0b" }}
              onClick={() => {
                setReplacingDoc(r);
                setReplaceForm({
                  name: r.displayName,
                  documentNumber: r.documentNumber || "",
                  expiryDate: "",
                  notes: "",
                  file: null,
                  fileName: "",
                  fileSize: 0,
                  mimeType: "application/pdf",
                  fileData: "",
                });
              }}
              title="Replace Expired/Rejected Document"
            >
              🔄 Replace
            </button>
          )}
          {isAdmin && (
            <button
              className="btn-outline"
              style={{ padding: "4px 8px", fontSize: "11px", color: "#059669", borderColor: "#059669" }}
              onClick={() => {
                setVerifyingDoc(r);
                setVerifyStatus(r.calculatedStatus === "Verified" ? "Verified" : "Verified");
                setRejectionReason(r.rejectionReason || "");
              }}
              title="Admin KYC Verification Review"
            >
              🛡️ Verify
            </button>
          )}
          <button
            className="btn-outline"
            style={{ padding: "4px 8px", fontSize: "11.5px", color: "var(--danger)" }}
            onClick={() => setDeletingDoc(r)}
            title="Delete Document"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="tad-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: toast.type === "error" ? "#dc2626" : toast.type === "info" ? "#0284c7" : "#059669",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          <span>{toast.type === "error" ? "⚠️" : toast.type === "info" ? "ℹ️" : "✅"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <PageHero
        badge="Legal &amp; KYC Compliance"
        title="Documents &amp; KYC Center"
        subtitle="Manage certified property titles, Patta certificates, tenant Aadhaar verifications, statutory tax records, and authenticated agreements"
      />

      {/* KPI Summary Banner */}
      <div className="tad-kpi-banner">
        <div className="tad-kpi-card">
          <span className="tad-kpi-val">{totalCount}</span>
          <span className="tad-kpi-label">Total Documents</span>
        </div>
        <div className="tad-kpi-card">
          <span className="tad-kpi-val" style={{ color: "#059669" }}>
            {verifiedCount}
          </span>
          <span className="tad-kpi-label">Certified &amp; Verified</span>
        </div>
        <div className="tad-kpi-card">
          <span className="tad-kpi-val" style={{ color: "#0284c7" }}>
            {pendingCount}
          </span>
          <span className="tad-kpi-label">Pending Review</span>
        </div>
        <div className="tad-kpi-card">
          <span className="tad-kpi-val" style={{ color: actionRequiredCount > 0 ? "#dc2626" : "#64748b" }}>
            {actionRequiredCount}
          </span>
          <span className="tad-kpi-label">Expired / Rejected</span>
        </div>
      </div>

      {/* Category Tabs & Quick Filter */}
      <div className="tad-filter-bar">
        <div className="tad-cat-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`tad-cat-btn ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat !== "All" && (
                <span className="tad-badge-count">
                  {processedRows.filter((r) => r.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            className="inp"
            style={{ fontSize: "12.5px", padding: "6px 10px", borderRadius: "8px", minWidth: "150px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Verification Statuses</option>
            <option value="Verified">Verified Only</option>
            <option value="Pending Verification">Pending Verification</option>
            <option value="Expired">Expired Documents</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main DataTable */}
      <DataTable
        title="Compliance &amp; Document Records"
        columns={columns}
        rows={filteredRows}
        addLabel="+ Upload Document"
        onAdd={() => {
          setFormData(initialForm);
          setFormErrors({});
          setIsUploadOpen(true);
        }}
        searchKeys={["displayName", "id", "documentNumber", "category", "relatedLabel"]}
        searchPlaceholder="Search by document title, ID, Aadhaar/Patta number, or property..."
        pageSize={10}
      />

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="tad-modal-backdrop" onClick={() => setIsUploadOpen(false)}>
          <div className="tad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Upload Document to Vault</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Encrypted storage with verification workflow</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsUploadOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateDocument} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  className="inp"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Registered Sale Deed / Patta Extract"
                  required
                />
                {formErrors.name && <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px" }}>{formErrors.name}</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                    Category *
                  </label>
                  <select
                    className="inp"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Property Ownership Proof">Property Ownership Proof (Patta / Deed)</option>
                    <option value="Identity Proof">Identity Proof (Aadhaar / Passport)</option>
                    <option value="Address Proof">Address Proof</option>
                    <option value="Tax Documents">Tax Documents (Property Tax / PAN)</option>
                    <option value="Bank Documents">Bank Documents (Cancelled Cheque)</option>
                    <option value="Lease Agreements">Lease Agreement Copy</option>
                    <option value="Other">Other Statutory Document</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                    Document / Registration Number
                  </label>
                  <input
                    type="text"
                    className="inp"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    placeholder="e.g. TN-PATTA-4821 or PAN"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="inp"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                    Expiry Date (Leave empty if lifetime)
                  </label>
                  <input
                    type="date"
                    className="inp"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Link to Owned Property (Optional)
                </label>
                <select
                  className="inp"
                  value={formData.propertyId}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                >
                  <option value="">-- General / Not Property Specific --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Attachment */}
              <div style={{ border: "2px dashed #cbd5e1", borderRadius: "10px", padding: "18px", textAlign: "center", background: "#f8fafc" }}>
                <input
                  type="file"
                  id="vault-file-input"
                  style={{ display: "none" }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => handleFileChange(e, false)}
                />
                <label htmlFor="vault-file-input" style={{ cursor: "pointer", display: "block" }}>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>📁</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0284c7" }}>
                    {formData.fileName ? formData.fileName : "Click to select document file"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Supported formats: PDF, PNG, JPG, WEBP (Max 15MB)
                  </div>
                </label>
              </div>

              <div style={{ background: "#eff6ff", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", color: "#1e40af" }}>
                ℹ️ <strong>Verification Notice:</strong> Uploaded documents will be registered with status <strong>Pending Verification</strong> until certified by an administrator.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Encrypting & Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace Document Modal */}
      {replacingDoc && (
        <div className="tad-modal-backdrop" onClick={() => setReplacingDoc(null)}>
          <div className="tad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>
                  Replace Document — Version {(replacingDoc.version || 1) + 1}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Previous version will be archived in Version History
                </span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setReplacingDoc(null)}>✕</button>
            </div>

            <form onSubmit={handleReplaceSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12.5px" }}>
                <div><strong>Current Document:</strong> {replacingDoc.name}</div>
                <div><strong>Ref ID:</strong> {replacingDoc.id}</div>
                <div><strong>Status:</strong> {replacingDoc.calculatedStatus}</div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Updated Document Number
                </label>
                <input
                  type="text"
                  className="inp"
                  value={replaceForm.documentNumber}
                  onChange={(e) => setReplaceForm({ ...replaceForm, documentNumber: e.target.value })}
                  placeholder="e.g. Renewed certificate or policy number"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  New Expiry Date
                </label>
                <input
                  type="date"
                  className="inp"
                  value={replaceForm.expiryDate}
                  onChange={(e) => setReplaceForm({ ...replaceForm, expiryDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Replacement Notes
                </label>
                <input
                  type="text"
                  className="inp"
                  value={replaceForm.notes}
                  onChange={(e) => setReplaceForm({ ...replaceForm, notes: e.target.value })}
                  placeholder="e.g. Uploaded annual renewal copy from Sub-Registrar office"
                />
              </div>

              {/* File Attachment */}
              <div style={{ border: "2px dashed #cbd5e1", borderRadius: "10px", padding: "18px", textAlign: "center", background: "#f8fafc" }}>
                <input
                  type="file"
                  id="vault-replace-input"
                  style={{ display: "none" }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => handleFileChange(e, true)}
                />
                <label htmlFor="vault-replace-input" style={{ cursor: "pointer", display: "block" }}>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>🔄</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0284c7" }}>
                    {replaceForm.fileName ? replaceForm.fileName : "Click to select renewed document file"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Supported formats: PDF, PNG, JPG, WEBP (Max 15MB)
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setReplacingDoc(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Updating Version..." : "Submit New Version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Drawer/Modal */}
      {historyDoc && (
        <div className="tad-modal-backdrop" onClick={() => setHistoryDoc(null)}>
          <div className="tad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Version History — {historyDoc.id}</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Audit trail of all document iterations</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setHistoryDoc(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Current Version */}
              <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "14px", borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#166534" }}>Version {historyDoc.version || 1} (Current Active)</span>
                  <span className="tad-status-pill verified">Active</span>
                </div>
                <div style={{ fontSize: "12px", color: "#374151", marginTop: "6px" }}>
                  Uploaded on: {historyDoc.uploadedOn || historyDoc.uploadedAt}
                </div>
                {historyDoc.documentNumber && (
                  <div style={{ fontSize: "12px", color: "#374151" }}>
                    Document No: {historyDoc.documentNumber}
                  </div>
                )}
              </div>

              {/* Historical Versions */}
              {Array.isArray(historyDoc.versionHistory) && historyDoc.versionHistory.length > 0 ? (
                historyDoc.versionHistory.map((hist, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>Version {hist.version || idx + 1}</strong>
                      <span style={{ color: "#64748b" }}>{hist.uploadDate || "Archived"}</span>
                    </div>
                    {hist.notes && <div style={{ color: "#475569", marginTop: "4px" }}>Note: {hist.notes}</div>}
                    {hist.documentNumber && <div style={{ color: "#64748b" }}>Ref No: {hist.documentNumber}</div>}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: "13px" }}>
                  No prior versions on record. This is the initial certified submission.
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button className="btn-outline" onClick={() => setHistoryDoc(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Verification Modal */}
      {verifyingDoc && isAdmin && (
        <div className="tad-modal-backdrop" onClick={() => setVerifyingDoc(null)}>
          <div className="tad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Administrative Verification</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Certify or reject KYC &amp; compliance records</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setVerifyingDoc(null)}>✕</button>
            </div>

            <form onSubmit={handleVerifySubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                <div><strong>Document:</strong> {verifyingDoc.name}</div>
                <div><strong>Category:</strong> {verifyingDoc.category}</div>
                <div><strong>Entity:</strong> {verifyingDoc.relatedLabel}</div>
                {verifyingDoc.documentNumber && <div><strong>Document No:</strong> {verifyingDoc.documentNumber}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Verification Decision
                </label>
                <select
                  className="inp"
                  value={verifyStatus}
                  onChange={(e) => setVerifyStatus(e.target.value)}
                >
                  <option value="Verified">Approve &amp; Mark Verified</option>
                  <option value="Rejected">Reject Document</option>
                  <option value="Pending Verification">Reset to Pending Review</option>
                </select>
              </div>

              {verifyStatus === "Rejected" && (
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px", color: "#b91c1c" }}>
                    Reason for Rejection *
                  </label>
                  <textarea
                    className="inp"
                    rows="3"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Document image blurry; Patta survey number does not match property record"
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button type="button" className="btn-outline" onClick={() => setVerifyingDoc(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    background: verifyStatus === "Rejected" ? "#dc2626" : "#059669",
                    borderColor: verifyStatus === "Rejected" ? "#dc2626" : "#059669",
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : `Confirm ${verifyStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <div className="tad-modal-backdrop" onClick={() => setDeletingDoc(null)}>
          <div className="tad-modal-box" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>Delete Document?</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>ID: {deletingDoc.id}</span>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "#475569", margin: "10px 0 16px" }}>
              Are you sure you want to permanently delete <strong>{deletingDoc.displayName}</strong> from the secure vault? This action cannot be reversed.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setDeletingDoc(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleDelete}
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview & Verification Certificate Modal */}
      {selectedDoc && (
        <div className="tad-modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="tad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a" }}>{selectedDoc.displayName}</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Vault ID: {selectedDoc.id}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedDoc(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "10px 0" }}>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Document Category:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDoc.category}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Document Number:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDoc.documentNumber || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Associated Entity:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDoc.relatedLabel}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Issue / Upload Date:</span>
                  <span>{selectedDoc.issueDate || selectedDoc.uploadedOn}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Expiry Date:</span>
                  <span>{selectedDoc.expiryDate || "None (Permanent)"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Verification Status:</span>
                  <span className={`tad-status-pill ${selectedDoc.calculatedStatus === "Verified" ? "verified" : selectedDoc.calculatedStatus === "Rejected" ? "rejected" : selectedDoc.calculatedStatus === "Expired" ? "expired" : "pending"}`}>
                    {selectedDoc.calculatedStatus}
                  </span>
                </div>
              </div>

              {/* Digital Certificate Seal */}
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: "10px",
                  padding: "20px",
                  textAlign: "center",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "6px" }}>📜</div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a", marginBottom: "4px" }}>
                  Official Recorded Document
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", maxWidth: "420px", margin: "0 auto" }}>
                  Certified in PropConnect Tamil Nadu Vault with 256-bit encryption and immutable SHA-256 integrity checksum.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-outline" onClick={() => setSelectedDoc(null)}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => handleDownload(selectedDoc)}
              >
                📥 Download Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}