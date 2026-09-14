import React, { useEffect, useState } from "react";
import { getSession, onAuthChange, getSubscriberProfile, signOut } from "./lib/auth";
import AuthGate from "./components/AuthGate";
import ScannerDashboard from "./components/ScannerDashboard";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

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

  if (session === undefined) {
    return <div style={{ background: "#000", minHeight: "100vh" }} />;
  }

  if (!session) {
    return <AuthGate />;
  }

  return <ScannerDashboard profile={profile} onSignOut={signOut} userId={session.user.id} />;
}
