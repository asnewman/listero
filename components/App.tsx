"use client";

import { useUser } from "@clerk/nextjs";
import { localStore } from "@/lib/store/local";
import { remoteStore } from "@/lib/store/remote";
import Workspace from "./Workspace";

export default function App() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  const signedIn = !!isSignedIn;
  // key resets all list state when switching between local and account mode
  return <Workspace key={signedIn ? "remote" : "local"} store={signedIn ? remoteStore : localStore} signedIn={signedIn} />;
}
