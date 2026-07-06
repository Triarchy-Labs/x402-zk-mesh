"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  isConnected as checkFreighterConnected,
  requestAccess,
} from "@stellar/freighter-api";

interface WalletState {
  connected: boolean;
  publicKey: string;      // Full G... key
  displayKey: string;     // GBAH...4E2V truncated
  connecting: boolean;
  freighterMissing: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  connected: false,
  publicKey: "",
  displayKey: "",
  connecting: false,
  freighterMissing: false,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [displayKey, setDisplayKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [freighterMissing, setFreighterMissing] = useState(false);

  const setKeyPair = useCallback((fullKey: string) => {
    setPublicKey(fullKey);
    setDisplayKey(fullKey.substring(0, 4) + "..." + fullKey.substring(fullKey.length - 4));
    setConnected(true);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    const checkConn = async () => {
      try {
        const status = await checkFreighterConnected();
        if (status.isConnected) {
          const access = await requestAccess();
          if (access.address) {
            setKeyPair(access.address);
          }
        }
      } catch { /* Freighter not available */ }
    };
    checkConn();
  }, [setKeyPair]);

  const connect = useCallback(async () => {
    if (connected) return;

    if (freighterMissing) {
      window.open("https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk", "_blank");
      return;
    }

    setConnecting(true);
    try {
      const status = await checkFreighterConnected();
      if (status.isConnected) {
        const access = await requestAccess();
        if (access.error) {
          console.log("Freighter connection rejected.", access.error);
        } else if (access.address) {
          setKeyPair(access.address);
        }
      } else {
        setFreighterMissing(true);
      }
    } catch (error) {
      console.error("Freighter connect failed", error);
    } finally {
      setConnecting(false);
    }
  }, [connected, freighterMissing, setKeyPair]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setPublicKey("");
    setDisplayKey("");
  }, []);

  return (
    <WalletContext.Provider value={{ connected, publicKey, displayKey, connecting, freighterMissing, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
