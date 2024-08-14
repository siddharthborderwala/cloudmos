"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { useWallet as useConnectedWallet, useWalletClient } from "@cosmos-kit/react";
import { Modal } from "@mui/material";
import { event } from "nextjs-google-analytics";

import { useWallet } from "@src/context/WalletProvider";
import { AnalyticsEvents } from "@src/utils/analytics";

export type NonUndefined<T> = T extends undefined ? never : T;

const ToggleLiquidityModalButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const _onClick = () => {
    event(AnalyticsEvents.LEAP_GET_MORE_TOKENS, {
      category: "wallet",
      label: "Open Leap liquidity modal"
    });

    onClick();
  };

  return (
    <Button variant="default" size="sm" onClick={_onClick}>
      Get More
    </Button>
  );
};

const useConnectedWalletType = (): string => {
  const { isWalletConnected } = useWallet();
  const { mainWallet } = useConnectedWallet();

  const walletName = isWalletConnected ? mainWallet?.walletName : undefined;

  const walletType = useMemo(() => {
    switch (walletName) {
      case "leap-extension":
        return window.LeapElements?.WalletType.LEAP;
      case "keplr-extension":
        return window.LeapElements?.WalletType.KEPLR;
      case "cosmostation-extension":
        return window.LeapElements?.WalletType.COSMOSTATION;
      case "keplr-mobile":
        return window.LeapElements?.WalletType.WC_KEPLR_MOBILE;
      default:
        return undefined;
    }
  }, [walletName]);

  return walletType;
};

type Props = { address: string; aktBalance: number; refreshBalances: () => void };

const LiquidityModal: React.FC<Props> = ({ refreshBalances }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isWalletConnected } = useWallet();
  const { client: walletClient } = useWalletClient();
  const isElementsMountedRef = useRef(false);

  const connectedWalletType = useConnectedWalletType();

  const handleConnectWallet = useCallback(() => {
    if (!isWalletConnected && walletClient) {
      if (walletClient.enable) {
        return walletClient.enable("akashnet-2");
      } else if (walletClient.connect) {
        return walletClient.connect("akashnet-2");
      }
    } else {
      throw new Error("Wallet is not connected");
    }
  }, [isWalletConnected, walletClient]);

  const tabsConfig = useMemo(() => {
    const txnLifecycleHooks = {
      onTxnComplete: () => {
        refreshBalances();
        event(AnalyticsEvents.LEAP_TRANSACTION_COMPLETE, {
          category: "wallet",
          label: "Completed a transaction on Leap liquidity modal"
        });
      }
    };

    return {
      aggregated: {
        enabled: true,
        orderIndex: 0,
        title: "Swap or Bridge",
        allowedDestinationChains: [
          {
            chainId: "akashnet-2"
          }
        ],
        defaultValues: {
          sourceChainId: "osmosis-1",
          sourceAsset: "uosmo",
          destinationChainId: "akashnet-2",
          destinationAsset: "uakt"
        },
        txnLifecycleHooks
      },
      swap: {
        enabled: false
      },
      "fiat-on-ramp": {
        enabled: true,
        title: "Buy AKT",
        orderIndex: 1,
        allowedDestinationChains: [
          {
            chainId: "akashnet-2"
          }
        ],
        defaultValues: {
          currency: "USD",
          sourceAmount: "10",
          destinationChainId: "akashnet-2",
          destinationAsset: "uakt"
        },
        onTxnComplete: txnLifecycleHooks.onTxnComplete
      },
      transfer: {
        enabled: true,
        orderIndex: 2,
        title: "IBC Transfer",
        defaultValues: {
          sourceChainId: "osmosis-1",
          sourceAsset: { originChainId: "akashnet-2", originDenom: "uakt" }
        },
        txnLifecycleHooks
      }
    };
  }, [refreshBalances]);

  useEffect(() => {
    if (isOpen && !isElementsMountedRef.current) {
      window.LeapElements?.mountElements?.({
        connectWallet: handleConnectWallet,
        connectedWalletType,
        element: {
          name: "multi-view",
          props: {
            tabsConfig
          }
        },
        enableSmartSwap: true,
        skipClientId: `akashnet-console-${process.env.NODE_ENV}`,
        enableCaching: true,
        elementsRoot: "#leap-elements-portal"
      });
      isElementsMountedRef.current = true;
    }
  }, [connectedWalletType, handleConnectWallet, isOpen, tabsConfig]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isOpen]);

  return (
    <>
      <ToggleLiquidityModalButton onClick={() => setIsOpen(o => !o)} />
      {walletClient ? (
        <Modal keepMounted open={isOpen} onClose={() => setIsOpen(false)} className="flex items-center justify-center">
          <div className="relative h-full max-h-[34rem] w-full max-w-[26rem]">
            <Spinner className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2" />
            <div id="leap-elements-portal" className="leap-ui dark h-full w-full rounded-xl" />
          </div>
        </Modal>
      ) : null}
    </>
  );
};

LiquidityModal.displayName = "LiquidityModal";

export default LiquidityModal;
