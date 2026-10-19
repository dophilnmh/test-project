"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { member } from "../lib/action";

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Static superadmin details (CHANGE THESE!)
  const superadminDetails = {
    name: "Super Admin",
    email: "jumahtitus@gmail.com", // CHANGE THIS TO YOUR EMAIL
    password: "Tito1234",
    role: "superadmin",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const data = await member(superadminDetails);

      setMessage(`✅ ${data.message}`);
      setMessage(
        (prev) =>
          prev +
          `\n📧 Email: ${data.user.email}` +
          `\n🔑 Role: ${data.user.role}` +
          `\n⏰ Created: ${new Date(data.user.createdAt).toLocaleString()}`
      );

      // Show success alert
      alert(
        "✅ Superadmin Account created successfully!\n" +
          `Email: ${data.user.email}\n` +
          "You can now login with these credentials.\n" +
          "⚠️ DELETE THIS PAGE AFTER USE!"
      );
    } catch (error) {
      setError(`❌ Error: ${error.message}`);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "10px",
          boxShadow: "0 0 20px rgba(0,0,0,0.1)",
          maxWidth: "500px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#333", marginBottom: "30px" }}>
          🛡️ Create Superadmin Account
        </h1>

        {/* Warning Box */}
        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            color: "#856404",
            padding: "15px",
            borderRadius: "5px",
            marginBottom: "25px",
            textAlign: "left",
          }}
        >
          <p style={{ margin: 0, fontWeight: "bold" }}>⚠️ SECURITY WARNING</p>
          <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>
            1. This page creates the FIRST superadmin user
            <br />
            2. Delete this page after successful creation
            <br />
            3. Change default password immediately
            <br />
            4. Use only in secure environment
          </p>
        </div>

        {/* Superadmin Details Card */}
        <div
          style={{
            backgroundColor: "#000000",
            border: "1px solid #b3d7ff",
            padding: "20px",
            borderRadius: "5px",
            marginBottom: "25px",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#0066cc" }}>
            Superadmin Details:
          </h3>
          <div style={{ marginBottom: "10px" }}>
            <strong>👤 Name:</strong> {superadminDetails.name}
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>📧 Email:</strong> {superadminDetails.email}
          </div>
          <div>
            <strong>🔒 Password:</strong> {superadminDetails.password}
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
            <em>These credentials will be used for the first login</em>
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div
            style={{
              backgroundColor: "#d4edda",
              color: "#155724",
              padding: "15px",
              borderRadius: "5px",
              marginBottom: "20px",
              whiteSpace: "pre-line",
              textAlign: "left",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: "#f8d7da",
              color: "#721c24",
              padding: "15px",
              borderRadius: "5px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#6c757d" : "#dc3545",
            color: "white",
            border: "none",
            padding: "15px 30px",
            fontSize: "18px",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer",
            width: "100%",
            fontWeight: "bold",
            marginBottom: "20px",
          }}
        >
          {loading
            ? "🔄 Creating Superadmin..."
            : "🚀 CREATE SUPERADMIN ACCOUNT"}
        </button>

        {/* Instructions */}
        <div
          style={{
            fontSize: "14px",
            color: "#666",
            textAlign: "left",
            borderTop: "1px solid #eee",
            paddingTop: "20px",
          }}
        >
          <p>
            <strong>📋 Instructions:</strong>
          </p>
          <ol style={{ margin: "10px 0", paddingLeft: "20px" }}>
            <li>Click the red button above</li>
            <li>Wait for success confirmation</li>
            <li>
              Go to{" "}
              <a href="/login" style={{ color: "#0066cc" }}>
                Login Page
              </a>
            </li>
            <li>Use the credentials shown above</li>
            <li>
              <strong>DELETE THIS PAGE</strong> after successful login
            </li>
          </ol>

          <p
            style={{ marginTop: "20px", fontSize: "12px", fontStyle: "italic" }}
          >
            Note: If superadmin already exists, youll get an error message. In
            that case, just delete this page and use the existing credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
