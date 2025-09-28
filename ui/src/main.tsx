import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider, useSuiClientContext } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { registerEnokiWallets } from "@mysten/enoki";
import App from "./App.tsx";
import { networkConfig } from "./networkConfig.ts";
import { config } from "./config/environment";

const queryClient = new QueryClient();

// RegisterEnokiWallets component
function RegisterEnokiWallets() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    console.log('Registering Enoki wallets for network:', network);

    const { unregister } = registerEnokiWallets({
      apiKey: 'enoki_public_112e16a1ce7fc2ff1e4e9bd06b951de6',
      providers: {
        google: {
          clientId: '20125149505-k6stooabdj31t2lsibg5jq645ge90vbl.apps.googleusercontent.com',
        },
      },
      client,
      network,
    });

    console.log('Enoki wallets registered successfully');

    return unregister;
  }, [client, network]);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
          <RegisterEnokiWallets />
          <WalletProvider 
            autoConnect
          >
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </Theme>
  </React.StrictMode>,
);
