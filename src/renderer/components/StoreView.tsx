import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export function StoreView({
  isPro,
  setIsPro,
}: {
  isPro: boolean;
  setIsPro: (val: boolean) => void;
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      let machineId = localStorage.getItem("sw_machine_id");
      if (!machineId) {
        machineId =
          Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("sw_machine_id", machineId);
      }

      const activateLicenseFn = httpsCallable(functions, "activateLicense");
      const result = await activateLicenseFn({
        licenseKey: licenseKey.trim(),
        machineId,
      });
      const data = result.data as { success: boolean; message?: string };

      if (data.success) {
        const valid = await window.electron.verifyLicense("PRO_TEST");
        if (valid) setIsPro(true);
      } else {
        alert("Activation failed: " + (data.message || "Invalid Key"));
      }
    } catch (err) {
      const error = err as Error;
      alert("Verification Failed: " + (error.message || error));
    } finally {
      setActivating(false);
    }
  };

  return (
    <motion.div
      className="view-container"
      style={{
        flex: 1,
        overflowY: "auto",
        scrollbarGutter: "stable",
        paddingBottom: "40px",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header" style={{ marginBottom: "32px" }}>
        <h1 className="view-title">Shrink Wizard Pro</h1>
        <p className="view-subtitle">
          Unlock unlimited compression speeds and JPEG XL transcoding.
        </p>
      </div>

      {isPro ? (
        <div
          className="settings-card"
          style={{
            borderLeft: "4px solid var(--success)",
            background: "rgba(16, 185, 129, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "16px",
            }}
          >
            <div
              style={{
                background: "var(--success)",
                borderRadius: "50%",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "black",
              }}
            >
              <CheckCircle size={32} />
            </div>
            <div>
              <h2
                style={{
                  color: "var(--text-primary)",
                  fontSize: "20px",
                  margin: "0 0 8px 0",
                }}
              >
                Pro Actived
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Thank you for supporting the development of Shrink Wizard! You
                have unlimited access to all features, full CPU core
                utilization, and priority updates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className="settings-card"
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            <div>
              <h2 className="settings-card-title">
                Upgrade to Pro - $10 One-Time
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  marginTop: "8px",
                  lineHeight: "1.6",
                }}
              >
                The Free tier gives you a 3GB Free Trial, followed by a 1GB
                daily quota. Upgrading to Pro unlocks:
              </p>
              <ul
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  marginTop: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingLeft: "20px",
                }}
              >
                <li>
                  <strong>Unlimited Savings:</strong> Bypass the daily limits
                  and compress hundreds of Gigabytes with absolutely no
                  throttling.
                </li>
                <li>
                  <strong>Archival JPEG XL:</strong> Access the next-generation
                  JXL format natively.
                </li>
              </ul>
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: "16px", fontSize: "16px" }}
              onClick={() =>
                window.electron.openUrl(
                  "https://buy.stripe.com/test_3cI6oG9b78D17wfeIj00000",
                )
              }
            >
              Buy Pro License
            </button>
          </div>

          <div className="settings-card" style={{ marginTop: "24px" }}>
            <h2 className="settings-card-title">Already purchased?</h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "8px",
                marginBottom: "16px",
              }}
            >
              Enter the License Key you received via email to activate your
              copy.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                placeholder="e.g. SW-ABCD-1234-EFGH-5678"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                style={{
                  flex: 1,
                  background: "var(--bg-root)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  outline: "none",
                  fontFamily: "monospace",
                  fontSize: "15px",
                }}
              />
              <button
                className="btn btn-primary"
                disabled={!licenseKey.trim() || activating}
                onClick={handleActivate}
              >
                {activating ? "Validating..." : "Activate"}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
