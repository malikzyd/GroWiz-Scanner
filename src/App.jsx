import React, { useEffect, useState } from "react";
import { getSession, onAuthChange, getSubscriberProfile, signOut } from "./lib/auth";
import AuthGate from "./components/AuthGate";
import ScannerDashboard from "./components/ScannerDashboard";
import PaymentOffer from "./components/PaymentOffer";
import AdminPage from "./components/AdminPage";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const path = window.location.pathname;

  useEffect(() => {
    getSession().then(setSession);
    const unsubscribe = onAuthChange(setSession);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (session?.user) {
      getSubscriberProfile(session.user.id)
        .then(setProfile)
        .catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
  }, [session]);

  // /admin has its own password gate — doesn't need a logged-in session.
  if (path === "/admin") {
    return <AdminPage />;
  }

  if (session === undefined) {
    return <div style={{ background: "#000", minHeight: "100vh" }} />;
  }

  if (!session) {
    return <AuthGate />;
  }

  if (path === "/upgrade") {
    return <PaymentOffer />;
  }

  return <ScannerDashboard profile={profile} onSignOut={signOut} userId={session.user.id} />;
}
